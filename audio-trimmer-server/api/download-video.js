// ✅ Following lines 39-44 from instructions: GET /api/download-video/:id endpoint

const path = require('path');
const fs = require('fs-extra');
const config = require('../config/settings');

module.exports = async (req, res) => {
  console.log('📥 Video download request:', req.params.id);

  try {
    const videoId = req.params.id;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'Video ID required'
      });
    }

    // Check for video in volume storage first (new location), then temp (legacy)
    const volumePath = path.join(config.storage.VOLUME_PATH, `video_${videoId}.mp4`);
    const tempPath = path.join(__dirname, '..', 'temp', `video_${videoId}.mp4`);

    let videoPath = null;
    if (await fs.pathExists(volumePath)) {
      videoPath = volumePath;
      console.log('📦 Video found in volume storage');
    } else if (await fs.pathExists(tempPath)) {
      videoPath = tempPath;
      console.log('📦 Video found in temp storage (legacy)');
    }

    if (videoPath) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${videoId}.mp4"`);
      const stream = fs.createReadStream(videoPath);
      stream.pipe(res);
    } else {
      console.log(`❌ Video not found: ${videoId}`);
      console.log(`   Checked volume: ${volumePath}`);
      console.log(`   Checked temp: ${tempPath}`);
      res.status(404).json({ success: false, error: 'Video not found' });
    }
    
  } catch (error) {
    console.error('❌ Download error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download video'
    });
  }
};