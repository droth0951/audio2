const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const axios = require('axios');
const { writeFile, unlink, readFile, mkdir, readdir } = require('fs/promises');
const { join } = require('path');
const { tmpdir } = require('os');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

module.exports = async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audioUrl, start, end } = req.body;
    
    console.log('🎵 Audio trim request:', { audioUrl, startMs: start, endMs: end });
    
    if (!audioUrl || start === undefined || end === undefined) {
      return res.status(400).json({ 
        error: 'Missing required parameters: audioUrl, start, end' 
      });
    }

    // Convert milliseconds to seconds
    const startSeconds = start / 1000;
    const endSeconds = end / 1000;
    const durationSeconds = endSeconds - startSeconds;
    
    console.log('🎵 Timing info:', { startSeconds, endSeconds, durationSeconds });

    // Validate duration
    if (durationSeconds > 240) { // 4 minutes max
      return res.status(400).json({ 
        error: 'Clip duration exceeds 4 minutes',
        details: `${durationSeconds}s > 240s`
      });
    }

    if (durationSeconds < 1) { // 1 second minimum
      return res.status(400).json({ 
        error: 'Clip duration too short',
        details: `${durationSeconds}s < 1s`
      });
    }

    console.log('🎵 Timing validation passed - using AssemblyAI trimming');
    
    return res.json({ 
      success: true,
      audioUrl: audioUrl, // Return original URL for AssemblyAI
      startTime: startSeconds, // In seconds
      endTime: endSeconds,
      duration: durationSeconds,
      message: `Audio clip: ${startSeconds}s to ${endSeconds}s (${durationSeconds}s duration) - Using AssemblyAI trimming`
    });
    
  } catch (error) {
    console.error('🎵 Audio trim error:', error);
    return res.status(500).json({ 
      error: 'Audio trimming failed',
      details: error.message 
    });
  }
}
