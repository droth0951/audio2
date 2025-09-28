// Test endpoint for iOS push notifications
// Simulates a completed video job and sends push notification

const logger = require('../services/logger');
const iosPush = require('../services/ios-push-notifications');

module.exports = async (req, res) => {
  try {
    const { deviceToken, podcastName = 'Test Podcast', episodeTitle = 'Test Episode' } = req.body;

    if (!deviceToken) {
      return res.status(400).json({
        success: false,
        error: 'Device token required'
      });
    }

    // Check if iOS push is enabled
    if (!iosPush.isEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'iOS push notifications not enabled',
        status: iosPush.getStatus()
      });
    }

    // Generate test job ID
    const testJobId = `test_${Date.now()}`;

    logger.info('🧪 Testing iOS push notification', {
      jobId: testJobId,
      deviceToken: deviceToken.substring(0, 8) + '...',
      podcastName,
      episodeTitle
    });

    // Send test push notification
    await iosPush.sendVideoReadyNotification(
      deviceToken,
      testJobId,
      podcastName,
      episodeTitle
    );

    res.json({
      success: true,
      message: 'Test push notification sent',
      jobId: testJobId,
      deviceToken: deviceToken.substring(0, 8) + '...',
      pushStatus: iosPush.getStatus()
    });

  } catch (error) {
    logger.error('Failed to send test push notification', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};