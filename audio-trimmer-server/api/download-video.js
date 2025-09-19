// ✅ Following lines 39-44 from instructions: GET /api/download-video/:id endpoint

const path = require('path');
const fs = require('fs-extra');

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

    // Check if video exists
    const videoPath = path.join(__dirname, '..', 'temp', `video_${videoId}.mp4`);

    if (await fs.pathExists(videoPath)) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${videoId}.mp4"`);
      const stream = fs.createReadStream(videoPath);
      stream.pipe(res);
    } else {
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