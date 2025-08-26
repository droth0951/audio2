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

    // Actually trim the audio file to save AssemblyAI credits
    console.log('🎵 Trimming audio file to save AssemblyAI credits...');
    
    // Download the audio file
    const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });
    const audioBuffer = Buffer.from(audioResponse.data);
    
    // Create temporary files
    const tempDir = join(tmpdir(), 'audio-trimmer');
    await mkdir(tempDir, { recursive: true });
    
    const inputPath = join(tempDir, `input-${Date.now()}.mp3`);
    const outputPath = join(tempDir, `output-${Date.now()}.mp3`);
    
    // Write input file
    await writeFile(inputPath, audioBuffer);
    
    // Trim the audio using ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startSeconds)
        .setDuration(durationSeconds)
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    
    // Read the trimmed file
    const trimmedAudioBuffer = await readFile(outputPath);
    
    // Upload to a temporary storage (you might want to use a proper service like AWS S3)
    // For now, we'll return the original URL with timing parameters
    // TODO: Implement proper file hosting for trimmed clips
    
    // Clean up temporary files
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    
    console.log('🎵 Audio trimmed successfully, but using AssemblyAI trimming for now');
    
    return res.json({ 
      success: true,
      audioUrl: audioUrl, // Still using original URL for now
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
