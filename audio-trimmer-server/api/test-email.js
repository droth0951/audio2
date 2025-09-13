// Test email notification endpoint

const emailNotifications = require('../services/email-notifications');
const logger = require('../services/logger');

module.exports = async (req, res) => {
  try {
    logger.info('Email notification test requested', { ip: req.ip });
    
    // Create a mock job for testing
    const mockJob = {
      jobId: `test_${Date.now()}`,
      request: {
        audioUrl: 'https://example.com/test-podcast.mp3',
        clipStart: 30000,
        clipEnd: 60000,
        podcast: {
          title: 'Test Podcast',
          episode: 'Email Test Episode',
          artwork: 'https://example.com/artwork.jpg'
        }
      },
      result: {
        cost: 0.0045,
        processingTime: 4500,
        audioDownloadTime: 2000,
        frameGenerationTime: 1500,
        videoCompositionTime: 1000,
        fileSize: 450000,
        videoUrl: 'http://localhost:3001/temp/test_video.mp4'
      },
      status: 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };

    // Send test notification
    await emailNotifications.sendJobNotification(mockJob, 'completed');
    
    res.json({
      success: true,
      message: 'Test email notification sent',
      jobId: mockJob.jobId
    });

  } catch (error) {
    logger.error('Email test failed', { 
      error: error.message,
      ip: req.ip 
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};