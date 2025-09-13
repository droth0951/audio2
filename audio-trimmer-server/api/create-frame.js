// Simple PNG frame generation endpoint for layout testing
const frameGenerator = require('../services/frame-generator');
const logger = require('../services/logger');

module.exports = async (req, res) => {
  logger.info('Frame generation request received', { 
    ip: req.ip,
    userAgent: req.headers['user-agent']?.substring(0, 50) 
  });
  
  try {
    const {
      podcast,
      progress = 0.5 // Middle of progress for testing
    } = req.body;

    // Validate required fields
    if (!podcast) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: podcast'
      });
    }

    const jobId = `frame_${Date.now()}`;
    const duration = 30; // Fixed 30s for testing
    
    // Download artwork if available
    let artworkBuffer = null;
    if (podcast.artwork) {
      try {
        artworkBuffer = await frameGenerator.downloadArtwork(podcast.artwork, jobId);
        logger.debug('Podcast artwork downloaded for frame', { 
          jobId, 
          artworkUrl: frameGenerator.sanitizeUrl(podcast.artwork),
          size: `${Math.round(artworkBuffer.length / 1024)}KB`
        });
      } catch (error) {
        logger.warn('Failed to download artwork for frame', {
          jobId,
          error: error.message
        });
      }
    }

    // Get template
    const template = await frameGenerator.getTemplate();
    
    // Generate single frame
    const framePath = `/tmp/test_frame_${jobId}.png`;
    await frameGenerator.generateSingleFrame(framePath, progress, podcast, artworkBuffer, template, duration, jobId);
    
    logger.success('Frame generated successfully', {
      jobId,
      framePath,
      progress: `${Math.round(progress * 100)}%`
    });

    // Return the frame as response
    const fs = require('fs');
    const frameBuffer = fs.readFileSync(framePath);
    
    // Clean up temp file
    fs.unlinkSync(framePath);
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="audio2_frame_${jobId}.png"`);
    res.send(frameBuffer);
    
  } catch (error) {
    logger.error('Frame generation failed', { 
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};