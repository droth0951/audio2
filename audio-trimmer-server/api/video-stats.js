// Stats endpoint for monitoring system health and costs

const jobQueue = require('../services/job-queue');
const logger = require('../services/logger');
const config = require('../config/settings');

module.exports = async (req, res) => {
  logger.debug('Stats requested');
  
  try {
    const stats = jobQueue.getStats();
    
    // Add system configuration for debugging
    const systemInfo = {
      version: require('../package.json').version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    };

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      system: systemInfo,
      config: {
        features: config.features,
        limits: {
          maxConcurrentJobs: config.jobs.MAX_CONCURRENT,
          maxQueueSize: config.jobs.MAX_QUEUE_SIZE,
          dailySpendingCap: config.costs.DAILY_SPENDING_CAP,
          jobTimeoutMs: config.jobs.JOB_TIMEOUT_MS
        },
        video: config.video
      },
      ...stats
    };

    logger.debug('Stats generated', { 
      activeJobs: stats.activeJobs,
      todayCost: stats.todayCost,
      featureEnabled: stats.featureEnabled
    });
    
    res.json(response);
    
  } catch (error) {
    logger.error('Failed to generate stats', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system stats'
    });
  }
};