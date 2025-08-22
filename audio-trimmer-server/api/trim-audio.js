const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const axios = require('axios');
const { writeFile, unlink, readFile, mkdir } = require('fs/promises');
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

    // Cost protection: reject clips longer than 2 minutes
    const maxDurationSeconds = 120; // 2 minutes
    if (durationSeconds > maxDurationSeconds) {
      return res.status(400).json({ 
        error: 'Clip too long',
        message: `Maximum clip duration is ${maxDurationSeconds} seconds. Requested: ${durationSeconds} seconds`,
        success: false
      });
    }

    // Don't actually trim the audio - just return the original URL with timing info
    console.log('🎵 Returning timing info for AssemblyAI trimming');
    
    return res.json({ 
      success: true,
      audioUrl: audioUrl, // Original podcast URL
      startTime: startSeconds, // In seconds
      endTime: endSeconds,
      duration: durationSeconds,
      message: `Audio clip: ${startSeconds}s to ${endSeconds}s (${durationSeconds}s duration)`
    });
    
  } catch (error) {
    console.error('🎵 Audio trim error:', error);
    return res.status(500).json({ 
      error: 'Audio trimming failed',
      details: error.message 
    });
  }
}
