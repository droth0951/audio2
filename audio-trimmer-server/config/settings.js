// Server configuration with safety limits

module.exports = {
  // Feature flags
  features: {
    ENABLE_SERVER_VIDEO: process.env.ENABLE_SERVER_VIDEO === 'true' || false,
    ENABLE_COST_TRACKING: true,
    ENABLE_DETAILED_LOGGING: true
  },
  
  // Storage paths
  storage: {
    VOLUME_PATH: '/data/videos', // Railway Volume (persistent across restarts)
    TEMP_PATH: require('path').join(__dirname, '../temp'), // Ephemeral storage
    USE_VOLUME: true // Use persistent volume storage for videos
  },

  // Job processing limits
  jobs: {
    MAX_CONCURRENT: 3,
    MAX_QUEUE_SIZE: 25, // Increased from 10 to handle more users
    JOB_TIMEOUT_MS: 120000, // 2 minutes
    CLEANUP_AFTER_HOURS: 168 // 7 days (7 days × 24 hours) - reduced for volume storage limits
  },
  
  // Cost control
  costs: {
    DAILY_SPENDING_CAP: 5.00, // $5 daily limit
    COST_PER_MINUTE_AUDIO: 0.006, // Estimated
    COST_PER_VIDEO_PROCESSING: 0.002,
    COST_PER_GB_STORAGE: 0.001
  },
  
  // Video generation settings
  video: {
    MIN_DURATION_SECONDS: 5,   // Allow short clips for testing
    MAX_DURATION_SECONDS: 240, // 4 minutes max (240 seconds)
    DEFAULT_ASPECT_RATIO: '9:16',
    FRAME_RATE: 8, // 8 fps - optimized for caption videos (was 12)
    VIDEO_QUALITY: 'medium' // low, medium, high
  },
  
  // Logging
  logging: {
    VERBOSE: process.env.NODE_ENV !== 'production',
    LOG_ERRORS_TO_FILE: true,
    ERROR_LOG_PATH: './logs/errors.log'
  }
};