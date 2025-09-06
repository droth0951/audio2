const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const FormData = require('form-data');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

class AudioFileProcessor {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    this.ensureTempDir();
  }

  async ensureTempDir() {
    try {
      await fs.ensureDir(this.tempDir);
      console.log('📁 Temp directory ready:', this.tempDir);
    } catch (error) {
      console.error('❌ Failed to create temp directory:', error);
      throw error;
    }
  }

  /**
   * Download audio from URL and extract specific segment
   */
  async downloadAndExtractSegment(audioUrl, startSeconds, endSeconds) {
    const tempId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const fullAudioPath = path.join(this.tempDir, `full_${tempId}.mp3`);
    const segmentPath = path.join(this.tempDir, `segment_${tempId}.mp3`);
    
    console.log('⬇️ STARTING AUDIO DOWNLOAD AND EXTRACTION');
    console.log('  Audio URL:', audioUrl);
    console.log('  Time range:', `${startSeconds}s - ${endSeconds}s`);
    
    try {
      // Download the full audio file
      console.log('📥 Downloading full audio file...');
      const response = await axios({
        method: 'GET',
        url: audioUrl,
        responseType: 'stream',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PodcastApp/1.0)',
        }
      });

      const writer = fs.createWriteStream(fullAudioPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      const stats = await fs.stat(fullAudioPath);
      console.log(`✅ Downloaded ${Math.round(stats.size / 1024 / 1024 * 100) / 100}MB`);

      // Extract the specific segment using FFmpeg
      console.log('✂️ Extracting audio segment...');
      await this.extractSegmentWithFfmpeg(fullAudioPath, segmentPath, startSeconds, endSeconds);

      const segmentStats = await fs.stat(segmentPath);
      console.log(`✅ Extracted segment: ${Math.round(segmentStats.size / 1024)}KB`);

      // Clean up the full audio file
      await fs.remove(fullAudioPath);
      console.log('🗑️ Cleaned up full audio file');

      return segmentPath;

    } catch (error) {
      console.error('❌ Audio download/extraction failed:', error.message);
      
      // Clean up any partial files
      try {
        await fs.remove(fullAudioPath);
        await fs.remove(segmentPath);
      } catch (cleanupError) {
        console.warn('⚠️ Cleanup warning:', cleanupError.message);
      }
      
      throw new Error(`Audio processing failed: ${error.message}`);
    }
  }

  /**
   * Extract audio segment using FFmpeg
   */
  async extractSegmentWithFfmpeg(inputPath, outputPath, startSeconds, endSeconds) {
    return new Promise((resolve, reject) => {
      const duration = endSeconds - startSeconds;
      
      ffmpeg(inputPath)
        .seekInput(startSeconds)
        .duration(duration)
        .audioCodec('libmp3lame')  // Use libmp3lame instead of mp3
        .audioBitrate('128k')
        .format('mp3')
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('🎬 FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`⚡ Processing: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          console.log('✅ FFmpeg extraction complete');
          resolve();
        })
        .on('error', (error) => {
          console.error('❌ FFmpeg error:', error);
          reject(error);
        })
        .run();
    });
  }

  /**
   * Upload file to AssemblyAI
   */
  async uploadToAssemblyAI(filePath, apiKey) {
    console.log('📤 UPLOADING TO ASSEMBLYAI');
    console.log('  File path:', filePath);
    
    try {
      const stats = await fs.stat(filePath);
      console.log(`  File size: ${Math.round(stats.size / 1024)}KB`);

      const form = new FormData();
      const fileStream = fs.createReadStream(filePath);
      form.append('file', fileStream);

      const response = await axios.post('https://api.assemblyai.com/v2/upload', form, {
        headers: {
          ...form.getHeaders(),
          'authorization': apiKey,
        },
        timeout: 60000,
      });

      const uploadUrl = response.data.upload_url;
      console.log('✅ Upload successful. AssemblyAI URL:', uploadUrl);
      
      return uploadUrl;

    } catch (error) {
      console.error('❌ AssemblyAI upload failed:', error.message);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Clean up temporary file
   */
  async cleanup(filePath) {
    try {
      await fs.remove(filePath);
      console.log('🗑️ Cleaned up temp file:', filePath);
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error.message);
    }
  }

  /**
   * Process audio segment from URL to AssemblyAI upload URL
   */
  async processAudioSegment(audioUrl, startSeconds, endSeconds, apiKey) {
    let segmentPath = null;
    
    try {
      console.log('🚀 STARTING AUDIO SEGMENT PROCESSING');
      
      // Download and extract segment
      segmentPath = await this.downloadAndExtractSegment(audioUrl, startSeconds, endSeconds);
      
      // Upload to AssemblyAI
      const uploadUrl = await this.uploadToAssemblyAI(segmentPath, apiKey);
      
      console.log('🎉 AUDIO PROCESSING COMPLETE');
      return uploadUrl;
      
    } finally {
      // Always clean up temp files
      if (segmentPath) {
        await this.cleanup(segmentPath);
      }
    }
  }
}

module.exports = { AudioFileProcessor };