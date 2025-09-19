// Debug endpoint to list available videos on server
const fs = require('fs').promises;
const path = require('path');

module.exports = async (req, res) => {
  console.log('📹 Listing available videos');
  
  try {
    const tempDir = path.join(__dirname, '..', 'temp');
    
    // Check if temp directory exists
    try {
      await fs.access(tempDir);
    } catch {
      return res.json({
        success: true,
        message: 'Temp directory not found',
        videos: [],
        tempDir
      });
    }
    
    // Read all files in temp directory
    const files = await fs.readdir(tempDir);
    
    // Filter for video files and get stats
    const videoFiles = [];
    for (const file of files) {
      if (file.startsWith('video_') && file.endsWith('.mp4')) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        videoFiles.push({
          filename: file,
          videoId: file.replace('video_', '').replace('.mp4', ''),
          size: `${(stats.size / 1024 / 1024).toFixed(2)}MB`,
          sizeBytes: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          age: `${Math.round((Date.now() - stats.mtime.getTime()) / 1000 / 60)} minutes ago`,
          downloadUrl: `/api/download-video/${file.replace('video_', '').replace('.mp4', '')}`
        });
      }
    }
    
    // Sort by creation time (newest first)
    videoFiles.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    console.log(`📹 Found ${videoFiles.length} videos`);
    
    res.json({
      success: true,
      count: videoFiles.length,
      tempDir,
      videos: videoFiles,
      recentVideo: videoFiles[0] || null,
      note: 'Videos are cleaned up after 6 hours'
    });
    
  } catch (error) {
    console.error('❌ Failed to list videos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
