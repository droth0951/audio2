// Cleanup statistics endpoint for monitoring storage

const cleanupService = require('../services/cleanup');
const logger = require('../services/logger');

module.exports = async (req, res) => {
  try {
    logger.debug('Cleanup stats requested', { ip: req.ip });
    
    const stats = await cleanupService.getCleanupStats();
    
    res.json({
      success: true,
      ...stats
    });

  } catch (error) {
    logger.error('Failed to get cleanup stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get cleanup statistics'
    });
  }
};