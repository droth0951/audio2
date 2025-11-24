// Test Telegram bot notification endpoint

const telegramBot = require('../services/telegram-bot');
const logger = require('../services/logger');

module.exports = async (req, res) => {
  try {
    logger.info('Telegram bot test requested', { ip: req.ip });

    // Step 1: Test bot connection
    const connectionTest = await telegramBot.testConnection();

    logger.success('Telegram bot connected', connectionTest);

    // Step 2: Create mock jobs for all notification types
    const mockJobBase = {
      jobId: `test_${Date.now()}`,
      request: {
        audioUrl: 'https://example.com/test-podcast.mp3',
        clipStart: 30000,
        clipEnd: 60000,
        captionsEnabled: true,
        podcast: {
          title: 'Test Podcast: The Future of AI',
          episode: 'Episode 42: Testing Telegram Notifications',
          artwork: 'https://example.com/artwork.jpg'
        }
      },
      estimatedCost: 0.0045,
      estimatedTime: 300,
      createdAt: new Date().toISOString(),
      retries: 0,
      maxRetries: 2
    };

    // Test "started" notification
    const startedJob = { ...mockJobBase };
    await telegramBot.sendJobNotification(startedJob, 'started');

    // Test "completed" notification
    const completedJob = {
      ...mockJobBase,
      jobId: `test_${Date.now()}_completed`,
      result: {
        cost: 0.0045,
        processingTime: 45000,
        audioDownloadTime: 2000,
        frameGenerationTime: 15000,
        videoCompositionTime: 28000,
        fileSize: 4500000,
        videoUrl: 'http://localhost:3001/temp/test_video.mp4'
      },
      status: 'completed',
      completedAt: new Date().toISOString()
    };
    await telegramBot.sendJobNotification(completedJob, 'completed');

    // Test "failed" notification
    const failedJob = {
      ...mockJobBase,
      jobId: `test_${Date.now()}_failed`,
      error: 'Audio download failed: HTTP 404 - File not found',
      status: 'failed',
      retries: 2,
      failedAt: new Date().toISOString()
    };
    await telegramBot.sendJobNotification(failedJob, 'failed');

    res.json({
      success: true,
      message: 'Telegram bot test completed - check your Telegram chat!',
      botInfo: connectionTest.botInfo,
      chatId: connectionTest.chatId,
      testsSent: [
        { type: 'started', jobId: startedJob.jobId },
        { type: 'completed', jobId: completedJob.jobId },
        { type: 'failed', jobId: failedJob.jobId }
      ]
    });

  } catch (error) {
    logger.error('Telegram test failed', {
      error: error.message,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: error.message,
      hint: !process.env.TELEGRAM_BOT_TOKEN
        ? 'TELEGRAM_BOT_TOKEN not configured'
        : !process.env.TELEGRAM_CHAT_ID
          ? 'TELEGRAM_CHAT_ID not configured - send a message to your bot first'
          : 'Check error message for details'
    });
  }
};
