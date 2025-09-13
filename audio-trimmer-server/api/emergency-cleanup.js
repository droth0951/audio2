// Emergency cleanup endpoint with authentication

const cleanupService = require('../services/cleanup');
const logger = require('../services/logger');

module.exports = async (req, res) => {
  try {
    // REVIEW-CRITICAL: Require authentication token for dangerous operation
    const authToken = req.headers['x-emergency-token'];
    const expectedToken = process.env.EMERGENCY_CLEANUP_TOKEN;
    
    if (!expectedToken) {
      logger.error('Emergency cleanup attempted but no token configured');
      return res.status(500).json({
        success: false,
        error: 'Emergency cleanup not configured - set EMERGENCY_CLEANUP_TOKEN environment variable'
      });
    }
    
    if (!authToken || authToken !== expectedToken) {
      logger.error('Emergency cleanup rejected - invalid authentication', {
        ip: req.ip,
        providedToken: authToken ? '[REDACTED]' : 'none'
      });
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - requires X-Emergency-Token header'
      });
    }
    
    logger.warn('Emergency cleanup authorized', { ip: req.ip });
    
    // Perform emergency cleanup with confirmation token
    const result = await cleanupService.emergencyCleanup('EMERGENCY_DELETE_ALL_VIDEOS');
    
    res.json({
      success: true,
      message: 'Emergency cleanup completed',
      ...result
    });

  } catch (error) {
    logger.error('Emergency cleanup failed', { 
      error: error.message,
      ip: req.ip 
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};