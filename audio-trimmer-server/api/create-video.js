// ✅ Following lines 39-82 from instructions: POST /api/create-video endpoint
// With safety features: feature flags, concurrent limits, cost caps, detailed logging

const jobQueue = require('../services/job-queue');
const logger = require('../services/logger');
const config = require('../config/settings');

module.exports = async (req, res) => {
  // Big celebratory announcement for new video requests
  console.log('\n' + '🎉'.repeat(20));
  console.log('🎉🎉🎉  NEW VIDEO REQUEST INCOMING!  🎉🎉🎉');
  console.log('🎉'.repeat(20));

  logger.info('🎉🎉 Video creation request received', {
    ip: req.ip,
    userAgent: req.headers['user-agent']?.substring(0, 50)
  });

  try {
    // ✅ Following lines 46-62: Request format validation
    const {
      audioUrl,
      // Support both field name formats for backward compatibility
      clipStart: requestClipStart,
      clipEnd: requestClipEnd,
      audio_start_from: audioStartFrom,
      audio_end_at: audioEndAt,
      podcast,
      userEmail,
      aspectRatio = '9:16',  // Default to vertical
      template = 'professional',
      captionsEnabled = false,        // NEW: Caption toggle
      enableSmartFeatures = true,     // NEW: Smart features toggle
      captionStyle = 'normal',        // NEW: Caption text style (normal, uppercase, lowercase, title)
      deviceToken                     // NEW: iOS device token for push notifications
    } = req.body;

    // Map field names for backward compatibility
    const clipStart = requestClipStart ?? audioStartFrom;
    const clipEnd = requestClipEnd ?? audioEndAt;

    // Provide default podcast object if not provided (prevents crashes in frame-generator)
    const podcastData = podcast || {
      podcastName: 'Audio2',
      title: 'Podcast Clip',
      artwork: null // Will use Audio2 logo/placeholder in frame-generator
    };

    // Log the request details prominently (development only)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n📹 Podcast: ${podcast?.podcastName || 'Unknown'}`);
      console.log(`📝 Episode: ${podcast?.title?.substring(0, 50) || 'Unknown'}...`);
      console.log(`⏱️  Duration: ${((clipEnd - clipStart) / 1000).toFixed(1)}s`);
      console.log(`💬 Captions: ${captionsEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
      if (captionsEnabled) {
        console.log(`🎨 Caption Style: ${captionStyle.toUpperCase()}`);
      }
      console.log(`📱 Push Notifications: ${deviceToken ? '✅ ENABLED' : '❌ DISABLED'}`);
      if (deviceToken) {
        console.log(`🔔 Device Token: ${deviceToken.substring(0, 8)}...`);
      }
      console.log('═'.repeat(60) + '\n');
    }

    // Log which field format was used for debugging
    const fieldFormat = requestClipStart !== undefined ? 'clipStart/clipEnd' : 'audio_start_from/audio_end_at';
    logger.debug('Field format detected', {
      format: fieldFormat,
      clipStart,
      clipEnd,
      providedFields: Object.keys(req.body)
    });

    // Log URL type for CDN timing analysis
    const isCanonicalUrl = !audioUrl.includes('podtrac') &&
                          !audioUrl.includes('chartable') &&
                          !audioUrl.includes('chrt.fm') &&
                          !audioUrl.includes('prfx.byspotify.com');

    logger.info('🔗 URL Analysis', {
      jobId: 'pending',
      urlType: isCanonicalUrl ? 'canonical' : 'tracking',
      domain: audioUrl.split('/')[2] || 'unknown',
      isCanonical: isCanonicalUrl,
      audioUrlPreview: audioUrl.substring(0, 100) + '...'
    });
    // Validate required fields
    if (!audioUrl || clipStart === undefined || clipEnd === undefined) {
      logger.error('Missing required fields', { provided: Object.keys(req.body) });
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: audioUrl and either (clipStart, clipEnd) or (audio_start_from, audio_end_at)'
      });
    }

    // Validate clip duration (30-60 seconds as per requirements)
    const duration = (clipEnd - clipStart) / 1000;
    if (duration < config.video.MIN_DURATION_SECONDS || duration > config.video.MAX_DURATION_SECONDS) {
      logger.error('Invalid clip duration', { 
        duration, 
        min: config.video.MIN_DURATION_SECONDS, 
        max: config.video.MAX_DURATION_SECONDS 
      });
      return res.status(400).json({
        success: false,
        error: `Clip duration must be between ${config.video.MIN_DURATION_SECONDS} and ${config.video.MAX_DURATION_SECONDS} seconds`
      });
    }

    // Validate audio URL format
    if (!audioUrl.startsWith('http')) {
      logger.error('Invalid audio URL format', { audioUrl: audioUrl.substring(0, 50) });
      return res.status(400).json({
        success: false,
        error: 'Audio URL must be a valid HTTP/HTTPS URL'
      });
    }

    // Feature flag protection for captions
    if (captionsEnabled && process.env.ENABLE_SERVER_CAPTIONS !== 'true') {
      logger.warn('⚠️ Captions requested but not enabled via environment variable', { jobId: 'pending' });
      // Continue without captions instead of failing (graceful degradation)
      req.body.captionsEnabled = false;
    }

    // Create job through queue system (handles all safety checks)
    // Use podcastData which includes defaults if original podcast was undefined
    const result = jobQueue.createJob({
      ...req.body,
      podcast: podcastData
    });
    
    logger.success('Job created successfully', {
      jobId: result.jobId,
      queuePosition: result.queuePosition,
      estimatedTime: result.estimatedTime
    });

    // ✅ Following lines 66-72: Immediate response format (enhanced)
    res.status(202).json(result);
    
  } catch (error) {
    logger.error('Video creation failed', { 
      error: error.message,
      stack: config.logging.VERBOSE ? error.stack : undefined
    });
    
    // Return appropriate error codes
    let statusCode = 500;
    if (error.message.includes('disabled')) statusCode = 503;
    if (error.message.includes('limit') || error.message.includes('full')) statusCode = 429;
    if (error.message.includes('spending cap')) statusCode = 402;

    res.status(statusCode).json({
      success: false,
      error: error.message,
      stats: jobQueue.getStats() // Help with debugging
    });
  }
};