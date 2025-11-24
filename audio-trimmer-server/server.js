const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'User-Agent', 'AssemblyAI-Agent'],
}));

// Middleware
app.use(express.json({ limit: '50mb' }));

// Serve temp files statically
app.use('/temp', express.static(path.join(__dirname, 'temp')));

// Import our API handlers
const trimAudioHandler = require('./api/trim-audio.js');
const transcribeHandler = require('./api/transcribe.js');
const transcribeStatusHandler = require('./api/transcribe-status.js');

// ✅ New video generation endpoints (lines 39-44 from instructions)
const createVideoHandler = require('./api/create-video.js');
const videoStatusHandler = require('./api/video-status.js');
const videoMetadataHandler = require('./api/video-metadata.js');
const downloadVideoHandler = require('./api/download-video.js');
const cleanupStatsHandler = require('./api/cleanup-stats.js');
const emergencyCleanupHandler = require('./api/emergency-cleanup.js');
const testEmailHandler = require('./api/test-email.js');

// PNG frame generation for testing
const createFrameHandler = require('./api/create-frame.js');

// ✅ Cleanup service for automatic video file management
const cleanupService = require('./services/cleanup.js');
const config = require('./config/settings.js');

// Routes
app.post('/api/trim-audio', trimAudioHandler);
app.post('/api/transcript', transcribeHandler);
app.get('/api/transcript/:id', transcribeStatusHandler);

// ✅ Video generation routes
app.post('/api/create-video', createVideoHandler);
app.post('/api/create-frame', createFrameHandler);
app.get('/api/video-status/:id', videoStatusHandler);
app.get('/api/video-metadata/:jobId', videoMetadataHandler);
app.get('/api/download-video/:id', downloadVideoHandler);

// ✅ Test endpoint (lines 214-222 from instructions)
const testVideoHandler = require('./api/test-video.js');
app.post('/api/test-video', testVideoHandler);

// Stats and monitoring endpoint
const videoStatsHandler = require('./api/video-stats.js');
const costAnalyticsHandler = require('./api/cost-analytics.js');
app.get('/api/video-stats', videoStatsHandler);
app.get('/api/cleanup-stats', cleanupStatsHandler);
app.get('/api/cost-analytics', costAnalyticsHandler);

// Emergency cleanup endpoint (requires authentication)
app.post('/api/emergency-cleanup', emergencyCleanupHandler);

// Test email endpoint
app.post('/api/test-email', testEmailHandler);

// Test push notification endpoint
const testPushHandler = require('./api/test-push.js');
app.post('/api/test-push', testPushHandler);

// Test Telegram notification endpoint
const testTelegramHandler = require('./api/test-telegram.js');
app.post('/api/test-telegram', testTelegramHandler);

// OPTIONS handlers for CORS preflight
app.options('/api/transcript', (req, res) => {
  res.status(200).end();
});

app.options('/api/transcript/:id', (req, res) => {
  res.status(200).end();
});

// Debug endpoints
app.get('/debug/env', (req, res) => {
  const aaiKey = process.env.ASSEMBLYAI_API_KEY || process.env.ASSEMBLYAI_KEY;
  res.json({
    aaiKeyPresent: !!aaiKey,
    aaiKeyPrefix: aaiKey ? aaiKey.substring(0, 8) + '...' : null,
  });
});

// Health check
app.get('/health', (req, res) => {
  console.log('🏥 Health check requested');
  res.status(200).send('OK');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎵 Audio trimmer server running on port ${PORT}`);
  console.log(`🏥 Health check available at http://0.0.0.0:${PORT}/health`);
  
  // ✅ Start cleanup service if video generation is enabled
  if (config.features.ENABLE_SERVER_VIDEO) {
    cleanupService.startCleanupService();
    console.log(`🧹 Cleanup service started - ${config.jobs.CLEANUP_AFTER_HOURS}h retention`);
  }
}).on('error', (err) => {
  console.error('❌ Server startup failed:', err);
  process.exit(1);
});
