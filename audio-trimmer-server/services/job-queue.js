// Job queue with concurrent limits and cost tracking

const config = require('../config/settings');
const logger = require('./logger');
const { v4: uuidv4 } = require('uuid');
const audioDownload = require('./audio-download');
const frameGenerator = require('./frame-generator');
const videoComposer = require('./video-composer');
const costAnalytics = require('./cost-analytics');

class JobQueue {
  constructor() {
    this.jobs = new Map(); // jobId -> job data
    this.activeJobs = new Set(); // currently processing
    this.dailyCosts = new Map(); // date -> total cost
    this.startOfDay = this.getStartOfDay();
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
      throw new Error(`Job queue full (${config.jobs.MAX_QUEUE_SIZE} max). Current: ${this.jobs.size}`);
    }
  }

  // Create new job with all safety checks
  createJob(request) {
    try {
      // Safety checks
      this.checkFeatureEnabled();
      this.checkQueueLimit();
      
      // Estimate cost
      const duration = (request.clipEnd - request.clipStart) / 1000;
      const estimatedCost = this.estimateJobCost(duration);
      this.checkDailySpendingLimit(estimatedCost);

      // Generate job
      const jobId = `vid_${uuidv4().substring(0, 8)}`;
      const job = {
        jobId,
        status: 'queued',
        request,
        estimatedCost,
        createdAt: new Date().toISOString(),
        estimatedTime: Math.min(45 + (duration * 0.5), 90), // Scale with duration
        retries: 0,
        maxRetries: 2
      };

      this.jobs.set(jobId, job);
      logger.logJobStart(jobId, request);
      
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

  // Estimate job cost based on duration
  estimateJobCost(durationSeconds) {
    const audioCost = (durationSeconds / 60) * config.costs.COST_PER_MINUTE_AUDIO;
    const processingCost = config.costs.COST_PER_VIDEO_PROCESSING;
    const storageCost = config.costs.COST_PER_GB_STORAGE * 0.01; // ~10MB video
    
    return audioCost + processingCost + storageCost;
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
      nextJob.status = 'processing';
      nextJob.startedAt = new Date().toISOString();
      
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

      // Step 1: Download audio segment
      const audioResult = await audioDownload.downloadAudioSegment(
        request.audioUrl,
        request.clipStart,
        request.clipEnd,
        jobId
      );

      logger.success('Audio download completed', {
        jobId,
        fileSize: audioResult.fileSize,
        downloadTime: audioResult.downloadTime
      });

      // Step 2: Generate video frames using SVG + Sharp
      const frameResult = await frameGenerator.generateFrames(
        audioResult.tempPath,
        audioResult.duration,
        request.podcast,
        jobId
      );

      logger.success('Frame generation completed', {
        jobId,
        frameCount: frameResult.frameCount,
        generationTime: frameResult.generationTime
      });

      // Step 3: Combine audio + frames with FFmpeg
      const videoResult = await videoComposer.composeVideo(
        audioResult.tempPath,
        frameResult,
        jobId
      );

      logger.success('Video composition completed', {
        jobId,
        fileSize: `${Math.round(videoResult.fileSize / 1024 / 1024 * 100) / 100}MB`,
        duration: `${videoResult.duration}s`,
        compositionTime: videoResult.compositionTime
      });

      // Validate video output
      await videoComposer.validateVideoOutput(videoResult.videoPath, jobId);

      // Step 4: Generate video URL and complete job
      const videoUrl = videoComposer.generateVideoUrl(videoResult.videoPath, jobId);

      // Step 5: Cleanup temp files (keep video for now - cleanup after download)
      await audioDownload.cleanupTempFile(audioResult.tempPath, jobId);
      await frameGenerator.cleanupFrames(frameResult.frameDir, jobId);

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

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.result = result;
    job.processingTime = Date.now() - new Date(job.startedAt).getTime();

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

    // Send notification  
    const notifications = require('./email-notifications');
    notifications.sendJobNotification(job, 'completed');

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
      job.status = 'queued';
      logger.warn(`Job ${jobId} failed, retrying (${job.retries}/${job.maxRetries})`, {
        error: error.message
      });
      this.processNextJob();
    } else {
      // Give up
      job.status = 'failed';
      job.error = error.message;
      job.failedAt = new Date().toISOString();
      
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