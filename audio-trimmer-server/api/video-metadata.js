// GET /api/video-metadata/:jobId endpoint
// Returns metadata about a completed video for the iOS app

const logger = require('../services/logger');
const jobQueue = require('../services/job-queue');

module.exports = async (req, res) => {
  const jobId = req.params.jobId;

  try {
    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Job ID required'
      });
    }

    // Get job details from the queue
    const job = jobQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    // Build the response metadata
    const metadata = {
      success: true,
      jobId: job.jobId,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,

      // Video details
      podcast: {
        podcastName: job.request?.podcast?.podcastName || 'Unknown Podcast',
        title: job.request?.podcast?.title || 'Unknown Episode',
        artwork: job.request?.podcast?.artwork
      },

      // Video info
      duration: job.result?.duration || Math.round((job.request?.clipEnd - job.request?.clipStart) / 1000),
      aspectRatio: job.request?.aspectRatio || '9:16',
      captionsEnabled: job.request?.captionsEnabled || false,
      captionStyle: job.request?.captionStyle || 'normal',

      // URLs
      videoUrl: job.result?.videoUrl,
      downloadUrl: `${req.protocol}://${req.get('host')}/api/download-video/${jobId}`,

      // Processing info
      processingTime: job.processingTime,
      cost: job.result?.cost,
      fileSize: job.result?.fileSize,
      queuePosition: job.queuePosition,
      estimatedTime: job.estimatedTime
    };

    // Add error info if job failed
    if (job.status === 'failed') {
      metadata.error = job.error;
      metadata.lastAttempt = job.lastAttempt;
      metadata.retries = job.retries || 0;
    }

    logger.debug('Video metadata requested', {
      jobId,
      status: job.status,
      hasVideo: !!job.result?.videoUrl
    });

    res.json(metadata);

  } catch (error) {
    logger.error('Failed to get video metadata', {
      jobId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve video metadata'
    });
  }
};