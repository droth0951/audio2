const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const axios = require('axios');
const { writeFile, unlink, readFile } = require('fs/promises');
const { join } = require('path');
const { tmpdir } = require('os');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

module.exports = async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let inputFile = null;
  let outputFile = null;

  try {
    const { audioUrl, start, end } = req.body;
    
    console.log('🎵 Audio trim request:', { audioUrl, startMs: start, endMs: end });
    
    if (!audioUrl || start === undefined || end === undefined) {
      return res.status(400).json({ 
        error: 'Missing required parameters: audioUrl, start, end' 
      });
    }

    // Convert milliseconds to seconds for FFmpeg
    const startSeconds = start / 1000;
    const durationSeconds = (end - start) / 1000;
    
    console.log('🎵 FFmpeg timing:', { startSeconds, durationSeconds });

    // Cost protection: reject clips longer than 2 minutes
    const maxDurationSeconds = 120; // 2 minutes
    if (durationSeconds > maxDurationSeconds) {
      return res.status(400).json({ 
        error: 'Clip too long',
        message: `Maximum clip duration is ${maxDurationSeconds} seconds. Requested: ${durationSeconds} seconds`,
        success: false
      });
    }

    // Generate unique filenames
    const timestamp = Date.now();
    inputFile = join(tmpdir(), `input-${timestamp}.mp3`);
    outputFile = join(tmpdir(), `output-${timestamp}.mp3`);

    console.log('🎵 Downloading audio file...');
    
    // Download the audio file
    const response = await axios({
      method: 'get',
      url: audioUrl,
      responseType: 'arraybuffer',
      timeout: 30000, // 30 second timeout
    });

    console.log('🎵 Audio downloaded, size:', response.data.length, 'bytes');

    // Write to temporary file
    await writeFile(inputFile, response.data);
    console.log('🎵 Temp file created, starting FFmpeg trim...');

    // Trim audio using FFmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(inputFile)
        .seekInput(startSeconds)
        .duration(durationSeconds)
        .output(outputFile)
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .on('start', (commandLine) => {
          console.log('🎵 FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('🎵 FFmpeg progress:', progress.percent + '%');
        })
        .on('end', () => {
          console.log('🎵 FFmpeg trimming completed');
          resolve();
        })
        .on('error', (err) => {
          console.error('🎵 FFmpeg error:', err);
          reject(err);
        })
        .run();
    });

    console.log('🎵 Reading trimmed file...');
    
    // Read the trimmed file and return as base64
    const trimmedData = await readFile(outputFile);
    const base64Audio = trimmedData.toString('base64');
    
    // Return the trimmed audio as a data URL
    const dataUrl = `data:audio/mpeg;base64,${base64Audio}`;
    
    console.log('🎵 Trimmed audio ready, size:', trimmedData.length, 'bytes');
    
    return res.json({ 
      success: true,
      trimmedUrl: dataUrl,
      message: `Audio trimmed from ${startSeconds}s to ${startSeconds + durationSeconds}s`,
      originalSize: response.data.length,
      trimmedSize: trimmedData.length,
      costSavings: `${Math.round((1 - trimmedData.length / response.data.length) * 100)}%`
    });
    
  } catch (error) {
    console.error('🎵 Audio trim error:', error);
    return res.status(500).json({ 
      error: 'Audio trimming failed',
      details: error.message 
    });
  } finally {
    // Clean up temporary files
    try {
      if (inputFile) await unlink(inputFile);
      if (outputFile) await unlink(outputFile);
      console.log('🎵 Temporary files cleaned up');
    } catch (cleanupError) {
      console.error('🎵 Cleanup error:', cleanupError);
    }
  }
}
