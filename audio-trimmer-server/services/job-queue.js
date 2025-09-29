// Job queue with concurrent limits and cost tracking

const config = require('../config/settings');
const logger = require('./logger');
const { v4: uuidv4 } = require('uuid');
const audioDownload = require('./audio-download');
const costAnalytics = require('./cost-analytics');

// NEW: Caption processing services
const audioProcessor = require('./audio-processor');
const captionProcessor = require('./caption-processor');

// URL helper for environment-aware URLs
const { generateVideoUrl, generateDownloadUrl } = require('../utils/url-helper');

// Database service for job persistence
const jobDatabase = require('./job-database');

// Lazy load video generation services to prevent Sharp loading at startup
let frameGenerator = null;
let videoComposer = null;

function getFrameGenerator() {
  if (!frameGenerator) {
    frameGenerator = require('./frame-generator');
  }
  return frameGenerator;
}

function getVideoComposer() {
  if (!videoComposer) {
    videoComposer = require('./video-composer');
  }
  return videoComposer;
}

class JobQueue {
  constructor() {
    this.jobs = new Map(); // jobId -> job data (in-memory cache)
    this.activeJobs = new Set(); // currently processing
    this.dailyCosts = new Map(); // date -> total cost
    this.startOfDay = this.getStartOfDay();
    this.usingDatabase = false;

    // Initialize database and restore jobs from previous session
    this.initializeFromDatabase();
  }

  async initializeFromDatabase() {
    try {
      if (jobDatabase.isAvailable()) {
        this.usingDatabase = true;

        // Restore jobs that were in progress during restart
        const processingJobs = await jobDatabase.getJobsByStatus('processing');
        const queuedJobs = await jobDatabase.getJobsByStatus('queued');

        // Convert database jobs back to memory format
        [...processingJobs, ...queuedJobs].forEach(dbJob => {
          const job = this.convertDbJobToMemory(dbJob);
          this.jobs.set(job.jobId, job);

          // Resume processing for jobs that were interrupted
          if (dbJob.status === 'processing') {
            logger.warn('Resuming interrupted job after restart', { jobId: job.jobId });
            // Reset to queued so it can be processed again
            job.status = 'queued';
            jobDatabase.updateJobStatus(job.jobId, 'queued');
          }
        });

        logger.success('📊 Job queue restored from database', {
          restoredJobs: processingJobs.length + queuedJobs.length,
          processingJobs: processingJobs.length,
          queuedJobs: queuedJobs.length
        });

        // Start processing any queued jobs
        this.processNextJob();

      } else {
        logger.debug('Using memory-only job storage (local development)');
      }
    } catch (error) {
      logger.error('Failed to initialize from database', { error: error.message });
      this.usingDatabase = false;
    }
  }

  // Convert database job format to memory format
  convertDbJobToMemory(dbJob) {
    return {
      jobId: dbJob.job_id,
      status: dbJob.status,
      request: dbJob.request_data,
      estimatedCost: parseFloat(dbJob.estimated_cost),
      estimatedTime: dbJob.estimated_time,
      createdAt: dbJob.created_at.toISOString(),
      startedAt: dbJob.started_at?.toISOString(),
      completedAt: dbJob.completed_at?.toISOString(),
      failedAt: dbJob.failed_at?.toISOString(),
      error: dbJob.error_message,
      result: dbJob.result_data,
      processingTime: dbJob.processing_time,
      retries: dbJob.retries || 0,
      maxRetries: dbJob.max_retries || 2
    };
  }

  // Helper method to update job status in both memory and database
  updateJobStatus(jobId, status, additionalData = {}) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // Update in-memory job
    job.status = status;

    // Update database
    if (this.usingDatabase) {
      const dbData = {
        ...additionalData
      };

      // Add specific fields based on status
      if (status === 'processing' && !job.startedAt) {
        job.startedAt = new Date().toISOString();
      } else if (status === 'completed') {
        job.completedAt = new Date().toISOString();
        if (additionalData.result) {
          job.result = additionalData.result;
          dbData.resultData = additionalData.result;
        }
        if (additionalData.processingTime) {
          job.processingTime = additionalData.processingTime;
          dbData.processingTime = additionalData.processingTime;
        }
      } else if (status === 'failed') {
        job.failedAt = new Date().toISOString();
        if (additionalData.error) {
          job.error = additionalData.error;
          dbData.errorMessage = additionalData.error;
        }
        if (additionalData.retries !== undefined) {
          job.retries = additionalData.retries;
          dbData.retries = additionalData.retries;
        }
      }

      jobDatabase.updateJobStatus(jobId, status, dbData).catch(error => {
        logger.error('Failed to update job status in database', {
          jobId,
          status,
          error: error.message
        });
      });
    }
  }

  getStartOfDay() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }

  // Check feature flag before accepting jobs
  checkFeatureEnabled() {
    if (!config.features.ENABLE_SERVER_VIDEO) {
      throw new Error('Server-side video generation is currently disabled');
    }
  }

  // Check daily spending limit
  checkDailySpendingLimit(estimatedCost = 0.01) {
    const today = this.getStartOfDay();
    const todayCost = this.dailyCosts.get(today) || 0;
    
    if (todayCost + estimatedCost > config.costs.DAILY_SPENDING_CAP) {
      const remaining = config.costs.DAILY_SPENDING_CAP - todayCost;
      throw new Error(`Daily spending cap reached. Used: $${todayCost.toFixed(2)}, Remaining: $${remaining.toFixed(2)}`);
    }

    logger.cost(`Daily cost check passed`, {
      used: `$${todayCost.toFixed(2)}`,
      estimatedJobCost: `$${estimatedCost.toFixed(4)}`,
      remaining: `$${(config.costs.DAILY_SPENDING_CAP - todayCost).toFixed(2)}`
    });
  }

  // Check concurrent job limit
  checkConcurrentLimit() {
    if (this.activeJobs.size >= config.jobs.MAX_CONCURRENT) {
      throw new Error(`Maximum concurrent jobs (${config.jobs.MAX_CONCURRENT}) reached. Active: ${this.activeJobs.size}`);
    }
  }

  // Check queue size limit
  checkQueueLimit() {
    if (this.jobs.size >= config.jobs.MAX_QUEUE_SIZE) {
      throw new Error(`We're experiencing high demand! Please try again in a few minutes when some videos finish processing.`);
    }
  }

  // Create new job with all safety checks
  createJob(request) {
    try {
      // Safety checks
      this.checkFeatureEnabled();
      this.checkQueueLimit();
      
      // Estimate cost (include captions if enabled)
      const duration = (request.clipEnd - request.clipStart) / 1000;
      const estimatedCost = this.estimateJobCost(duration, request.captionsEnabled);
      this.checkDailySpendingLimit(estimatedCost);

      // Generate job
      const jobId = `vid_${uuidv4().substring(0, 8)}`;

      // Simple realistic estimate: ~5 minutes for Railway deployment
      const estimatedTime = 300; // 5 minutes in seconds

      const job = {
        jobId,
        status: 'queued',
        request,
        estimatedCost,
        createdAt: new Date().toISOString(),
        estimatedTime,
        retries: 0,
        maxRetries: 2
      };

      this.jobs.set(jobId, job);
      logger.logJobStart(jobId, request);

      // Save job to database for persistence
      if (this.usingDatabase) {
        jobDatabase.createJob(job).catch(error => {
          logger.error('Failed to persist job to database', {
            jobId,
            error: error.message
          });
        });
      }

      // Try to start processing immediately
      this.processNextJob();

      return {
        success: true,
        jobId,
        message: 'Video processing queued',
        estimatedTime: job.estimatedTime,
        queuePosition: this.getQueuePosition(jobId)
      };

    } catch (error) {
      logger.error('Job creation failed', { error: error.message, request });
      throw error;
    }
  }

  // Estimate job cost based on duration (includes captions if enabled)
  estimateJobCost(durationSeconds, captionsEnabled = false) {
    const audioCost = (durationSeconds / 60) * config.costs.COST_PER_MINUTE_AUDIO;
    const processingCost = config.costs.COST_PER_VIDEO_PROCESSING;
    const storageCost = config.costs.COST_PER_GB_STORAGE * 0.01; // ~10MB video

    // Add caption cost if enabled
    const captionCost = captionsEnabled ?
      captionProcessor.estimateCaptionCost(durationSeconds * 1000).total : 0;

    return audioCost + processingCost + storageCost + captionCost;
  }


  // Get job position in queue
  getQueuePosition(jobId) {
    const queuedJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'queued')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    return queuedJobs.findIndex(job => job.jobId === jobId) + 1;
  }

  // Get job status
  getJobStatus(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    return {
      success: true,
      ...job,
      queuePosition: job.status === 'queued' ? this.getQueuePosition(jobId) : 0,
      activeJobs: this.activeJobs.size
    };
  }

  // Get job by ID for metadata endpoint
  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  // Process next job if slot available
  async processNextJob() {
    try {
      this.checkConcurrentLimit();
      
      // Find next queued job
      const nextJob = Array.from(this.jobs.values())
        .filter(job => job.status === 'queued')
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];

      if (!nextJob) {
        logger.debug('No queued jobs to process');
        return;
      }

      // Start processing
      this.activeJobs.add(nextJob.jobId);

      // Update job status to processing with database sync
      this.updateJobStatus(nextJob.jobId, 'processing');
      
      logger.job(`Started processing job ${nextJob.jobId}`, {
        activeJobs: this.activeJobs.size,
        queuedJobs: Array.from(this.jobs.values()).filter(j => j.status === 'queued').length
      });

      // Start actual video processing
      this.processVideoJob(nextJob);

    } catch (error) {
      logger.error('Failed to process next job', { error: error.message });
    }
  }

  // Process video job with audio download
  async processVideoJob(job) {
    try {
      const { jobId, request } = job;
      logger.debug('Starting video processing', { 
        jobId,
        audioUrl: audioDownload.sanitizeUrl(request.audioUrl),
        duration: `${(request.clipEnd - request.clipStart) / 1000}s`
      });

      // Step 1: Download and extract audio clip
      const audioProcessor = require('./audio-processor');

      // Download full file and extract the exact clip for video composition
      const audioClipBuffer = await audioProcessor.downloadAndExtractClip(
        request.audioUrl,
        request.clipStart,
        request.clipEnd,
        jobId
      );

      // Save clipped audio to temp file for video composition
      const fs = require('fs').promises;
      const path = require('path');
      const tempDir = path.join(__dirname, '../temp');
      await fs.mkdir(tempDir, { recursive: true });
      const clippedAudioPath = path.join(tempDir, `clipped_audio_${jobId}.mp3`);
      await fs.writeFile(clippedAudioPath, audioClipBuffer);

      const audioResult = {
        tempPath: clippedAudioPath,
        fileSize: audioClipBuffer.length,
        downloadTime: 0, // Will be included in audioProcessor timing
        duration: (request.clipEnd - request.clipStart) / 1000
      };

      logger.success('Audio download completed', {
        jobId,
        fileSize: audioResult.fileSize,
        downloadTime: audioResult.downloadTime
      });

      // Step 1.5: Generate captions if enabled (file upload method)
      let transcript = null;
      if (request.captionsEnabled && captionProcessor.isCaptionsEnabled()) {
        try {
          logger.info('🎬 Starting caption generation using file upload method', { jobId });

          // Use the audio clip buffer we already extracted in Step 1

          // Generate captions using file upload (solves CDN timing issue)
          transcript = await captionProcessor.generateCaptions(
            audioClipBuffer,
            request.clipStart,
            request.clipEnd,
            jobId,
            request.enableSmartFeatures,
            request.captionStyle || 'uppercase'
          );

          if (transcript) {
            logger.success('✅ Caption generation completed', {
              jobId,
              utterances: transcript.utterances?.length || 0,
              words: transcript.words?.length || 0
            });

            // Log smart insights for future features
            audioProcessor.logSmartInsights(transcript, request.clipStart, request.clipEnd, jobId);
          } else {
            logger.warn('⚠️ Caption generation failed - continuing without captions', { jobId });
          }

        } catch (error) {
          logger.error('❌ Caption generation failed - continuing without captions', {
            jobId,
            error: error.message
          });
          // Continue video generation without captions (graceful fallback)
          transcript = null;
        }
      } else {
        if (request.captionsEnabled) {
          logger.info('ℹ️ Captions requested but not enabled via environment variable', { jobId });
        }
      }

      // Step 2: Generate video frames using SVG + Sharp (now with transcript data)
      const frameResult = await getFrameGenerator().generateFrames(
        audioResult.tempPath,
        audioResult.duration,
        request.podcast,
        jobId,
        transcript, // NEW: Pass transcript for captions
        request.captionsEnabled, // NEW: Pass caption toggle
        request.clipStart, // NEW: Pass clip timing for caption sync
        request.clipEnd
      );

      logger.success('Frame generation completed', {
        jobId,
        frameCount: frameResult.frameCount,
        generationTime: frameResult.generationTime
      });

      // Step 3: Combine audio + frames with FFmpeg
      const videoResult = await getVideoComposer().composeVideo(
        audioResult.tempPath,
        frameResult,
        jobId,
        audioResult.duration
      );

      logger.success('Video composition completed', {
        jobId,
        fileSize: `${Math.round(videoResult.fileSize / 1024 / 1024 * 100) / 100}MB`,
        duration: `${videoResult.duration}s`,
        compositionTime: videoResult.compositionTime
      });

      // Validate video output
      await getVideoComposer().validateVideoOutput(videoResult.videoPath, jobId);

      // Step 4: Generate video URL and complete job
      const videoUrl = getVideoComposer().generateVideoUrl(videoResult.videoPath, jobId);

      // 🎉 Big celebratory video completion announcement with URL! 🎉
      console.log('\n' + '🎬'.repeat(30));
      console.log('🎬🎬🎬  VIDEO READY! DOWNLOAD NOW!  🎬🎬🎬');
      console.log('🎬'.repeat(30));
      console.log(`\n🔗 VIDEO URL: ${videoUrl}`);
      console.log(`📹 JOB ID: ${jobId}`);
      console.log(`💾 FILE SIZE: ${Math.round(videoResult.fileSize / 1024 / 1024 * 100) / 100}MB`);
      console.log(`⏱️ DURATION: ${videoResult.duration}s`);
      console.log('═'.repeat(60) + '\n');

      logger.success('🎬 VIDEO READY FOR DOWNLOAD! 🎬', {
        jobId,
        videoUrl,
        downloadUrl: generateDownloadUrl(jobId),
        fileSize: `${Math.round(videoResult.fileSize / 1024 / 1024 * 100) / 100}MB`,
        duration: `${videoResult.duration}s`
      });

      // Step 5: Cleanup temp files (keep video for now - cleanup after download)
      await audioDownload.cleanupTempFile(audioResult.tempPath, jobId);
      await getFrameGenerator().cleanupFrames(frameResult.frameDir, jobId);

      // Calculate detailed cost breakdown
      const durationInMinutes = (request.clipEnd - request.clipStart) / 60000;
      const processingTimeMs = Date.now() - new Date(job.startedAt).getTime();
      const costBreakdown = {
        audioDownload: durationInMinutes * 0.002, // $0.002 per minute for download/processing
        frameGeneration: frameResult.frameCount * 0.0001, // $0.0001 per frame
        videoComposition: durationInMinutes * 0.003, // $0.003 per minute for FFmpeg
        storage: Math.max(0.0005, videoResult.fileSize * 0.00000001), // $0.0005 base + size
        processing: Math.max(0.001, processingTimeMs * 0.000001), // $0.001 base + time
        processingTimeMs: processingTimeMs // Keep as metadata, not part of cost calculation
      };

      const totalCost = costBreakdown.audioDownload + 
                        costBreakdown.frameGeneration + 
                        costBreakdown.videoComposition + 
                        costBreakdown.storage + 
                        costBreakdown.processing;

      // Complete job successfully
      await this.completeJob(jobId, {
        videoUrl,
        cost: totalCost,
        costBreakdown,
        processingTime: Date.now() - new Date(job.startedAt).getTime(),
        audioDownloadTime: audioResult.downloadTime,
        frameGenerationTime: frameResult.generationTime,
        videoCompositionTime: videoResult.compositionTime,
        fileSize: videoResult.fileSize,
        duration: videoResult.duration,
        videoPath: videoResult.videoPath // Keep for cleanup later
      });

    } catch (error) {
      logger.error('Video processing failed', {
        jobId: job.jobId,
        error: error.message,
        stack: error.stack
      });
      
      this.failJob(job.jobId, error);
    }
  }

  // Mark job as completed
  async completeJob(jobId, result) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const processingTime = Date.now() - new Date(job.startedAt).getTime();

    // Update job status using helper method for database sync
    this.updateJobStatus(jobId, 'completed', {
      result,
      processingTime
    });

    // Track daily costs (legacy)
    this.addToDailyCost(result.cost);

    // Track detailed cost analytics
    if (result.costBreakdown) {
      try {
        await costAnalytics.trackJobCost(jobId, result.costBreakdown);
      } catch (error) {
        logger.error('Failed to track job cost analytics', { 
          jobId, 
          error: error.message 
        });
      }
    }

    // Remove from active jobs
    this.activeJobs.delete(jobId);

    logger.logJobSuccess(jobId, {
      processingTime: job.processingTime,
      cost: result.cost,
      outputSize: result.fileSize ? `${Math.round(result.fileSize / 1024 / 1024 * 100) / 100}MB` : 'Unknown'
    });

    // Send notifications (both email for admin and push for user)
    const notifications = require('./email-notifications');
    const iosPush = require('./ios-push-notifications');

    // Admin email notification (existing)
    notifications.sendJobNotification(job, 'completed');

    // User iOS push notification (new)
    if (job.request?.deviceToken && job.request?.podcast) {
      await iosPush.sendVideoReadyNotification(
        job.request.deviceToken,
        job.jobId,
        job.request.podcast.podcastName || 'Unknown Podcast',
        job.request.podcast.title || 'Unknown Episode'
      );
    }

    // Process next job
    this.processNextJob();
  }

  // Mark job as failed
  failJob(jobId, error) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.retries += 1;

    if (job.retries < job.maxRetries) {
      // Retry
      this.updateJobStatus(jobId, 'queued', {
        retries: job.retries
      });
      logger.warn(`Job ${jobId} failed, retrying (${job.retries}/${job.maxRetries})`, {
        error: error.message
      });
      this.processNextJob();
    } else {
      // Give up
      this.updateJobStatus(jobId, 'failed', {
        error: error.message,
        retries: job.retries
      });
      
      logger.logJobError(jobId, error, 'final_failure');
      
      // Send failure notification
      const notifications = require('./email-notifications');
      notifications.sendJobNotification(job, 'failed');
    }

    this.activeJobs.delete(jobId);
    this.processNextJob();
  }

  // Add cost to daily tracking
  addToDailyCost(cost) {
    const today = this.getStartOfDay();
    const currentCost = this.dailyCosts.get(today) || 0;
    this.dailyCosts.set(today, currentCost + cost);

    logger.cost(`Updated daily cost`, {
      date: today,
      newTotal: `$${(currentCost + cost).toFixed(4)}`,
      thisJob: `$${cost.toFixed(4)}`
    });
  }

  // Get current stats
  getStats() {
    const today = this.getStartOfDay();
    const todayCost = this.dailyCosts.get(today) || 0;
    
    const jobsByStatus = {
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    for (const job of this.jobs.values()) {
      jobsByStatus[job.status] = (jobsByStatus[job.status] || 0) + 1;
    }

    return {
      activeJobs: this.activeJobs.size,
      maxConcurrent: config.jobs.MAX_CONCURRENT,
      todayCost: `$${todayCost.toFixed(4)}`,
      dailyLimit: `$${config.costs.DAILY_SPENDING_CAP}`,
      remainingBudget: `$${(config.costs.DAILY_SPENDING_CAP - todayCost).toFixed(4)}`,
      jobsByStatus,
      featureEnabled: config.features.ENABLE_SERVER_VIDEO
    };
  }
}

module.exports = new JobQueue();