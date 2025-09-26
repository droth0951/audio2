// ✅ Following lines 39-82 from instructions: GET /api/video-status/:jobId endpoint
// With detailed logging and real job queue integration

const jobQueue = require('../services/job-queue');
const logger = require('../services/logger');

module.exports = async (req, res) => {
  const jobId = req.params.id;
  
  logger.debug('Status check requested', { jobId });
  
  try {
    if (!jobId) {
      logger.error('Status check missing job ID');
      return res.status(400).json({
        success: false,
        error: 'Job ID required'
      });
    }

    // Get status from job queue
    const result = jobQueue.getJobStatus(jobId);
    
    if (!result.success) {
      logger.warn('Job not found for status check', { jobId });
      return res.status(404).json(result);
    }

    // ✅ Following lines 74-81: Status check response format
    const response = {
      jobId: result.jobId,
      status: result.status,
      createdAt: result.createdAt,
      ...(result.startedAt && { startedAt: result.startedAt }),
      ...(result.completedAt && { completedAt: result.completedAt }),
      ...(result.failedAt && { failedAt: result.failedAt }),
      ...(result.result && {
        videoUrl: result.result.videoUrl,
        downloadUrl: `http://localhost:3001/api/download-video/${result.jobId}`,
        cost: result.result.cost,
        processingTime: result.processingTime
      }),
      ...(result.error && { error: result.error }),
      queuePosition: result.queuePosition,
      estimatedTime: result.estimatedTime,
      // Additional debug info
      debug: {
        activeJobs: result.activeJobs,
        retries: result.retries || 0
      }
    };

    // Add helpful message when completed
    if (result.status === 'completed') {
      console.log('\n🎥 VIDEO READY FOR DOWNLOAD!');
      console.log(`📥 Download URL: http://localhost:3001/api/download-video/${result.jobId}`);
      console.log(`🌐 Or open in browser: http://localhost:3001/temp/video_${result.jobId}.mp4\n`);
    }

    logger.debug('Status check completed', { 
      jobId, 
      status: result.status,
      queuePosition: result.queuePosition 
    });
    
    res.json(response);
    
  } catch (error) {
    logger.error('Status check failed', { 
      jobId, 
      error: error.message 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to check video status'
    });
  }
};