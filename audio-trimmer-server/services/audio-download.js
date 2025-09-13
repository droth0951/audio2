// Audio download and validation service for video generation

const fs = require('fs').promises;
const path = require('path');
const { createWriteStream } = require('fs');
const logger = require('./logger');
const config = require('../config/settings');

class AudioDownloadService {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    this.ensureTempDir();
  }

  // Ensure temp directory exists
  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp directory', { error: error.message });
    }
  }

  // REVIEW-COST: Audio download efficiency - segment vs full file
  async downloadAudioSegment(audioUrl, startMs, endMs, jobId) {
    const startTime = Date.now();
    
    try {
      // REVIEW-CRITICAL: Feature flag check in audio download
      if (!config.features.ENABLE_SERVER_VIDEO) {
        throw new Error('Audio download disabled - server-side video generation is off');
      }

      logger.debug('Starting audio download', {
        jobId,
        audioUrl: this.sanitizeUrl(audioUrl),
        segment: `${startMs}ms-${endMs}ms`,
        duration: `${(endMs - startMs) / 1000}s`
      });

      // REVIEW-COST: Download strategy using proven app approach
      const { buffer: audioBuffer, tempPath } = await this.fetchAudioWithTimeout(audioUrl, jobId);
      
      const fileSize = audioBuffer.length;
      const downloadTime = Date.now() - startTime;
      
      // Validate downloaded file
      await this.validateAudioFile(tempPath, jobId);
      
      logger.success('Audio download completed', {
        jobId,
        fileSize: `${Math.round(fileSize / 1024)}KB`,
        downloadTime: `${downloadTime}ms`,
        tempPath: path.basename(tempPath)
      });

      return {
        tempPath,
        fileSize,
        downloadTime,
        duration: (endMs - startMs) / 1000
      };

    } catch (error) {
      logger.error('Audio download failed', {
        jobId,
        audioUrl: this.sanitizeUrl(audioUrl),
        error: error.message,
        downloadTime: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }

  // REVIEW-CRITICAL: Network timeout and error handling using proven app approach
  async fetchAudioWithTimeout(audioUrl, jobId, timeoutMs = 30000) {
    const axios = require('axios');
    const { createWriteStream } = require('fs');
    const path = require('path');
    
    try {
      // Use the same approach as the working app
      const response = await axios({
        method: 'GET',
        url: audioUrl,
        responseType: 'stream',
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PodcastApp/1.0)', // Same as working app
        }
      });

      // REVIEW-COST: Check content length before download
      const contentLength = response.headers['content-length'];
      if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) { // 50MB limit
        logger.warn('Large audio file detected', {
          jobId,
          contentLength: `${Math.round(parseInt(contentLength) / 1024 / 1024)}MB`
        });
      }

      // Stream directly to temp file (memory efficient)
      const tempPath = path.join(this.tempDir, `audio_${jobId}.mp3`);
      const writer = createWriteStream(tempPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Read file back as buffer for validation
      const fs = require('fs').promises;
      const buffer = await fs.readFile(tempPath);
      
      return { buffer, tempPath };

    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Audio download timeout after ${timeoutMs}ms`);
      }
      throw new Error(`HTTP ${error.response?.status || 'Network'}: ${error.message}`);
    }
  }

  // REVIEW-SECURITY: Audio file validation
  async validateAudioFile(filePath, jobId) {
    try {
      const stats = await fs.stat(filePath);
      
      // Basic file size validation
      if (stats.size === 0) {
        throw new Error('Downloaded audio file is empty');
      }
      
      if (stats.size < 1000) { // Less than 1KB is suspicious
        throw new Error('Downloaded audio file too small (likely error page)');
      }

      // REVIEW-DEBUG: Basic file format check
      const buffer = await fs.readFile(filePath, { encoding: null, flag: 'r' });
      const header = buffer.subarray(0, 12);
      
      // Check for common audio file signatures
      const signatures = {
        mp3: [0xFF, 0xFB], // MP3 frame sync
        mp3_id3: [0x49, 0x44, 0x33], // ID3 tag
        m4a: [0x66, 0x74, 0x79, 0x70], // ftyp box
        wav: [0x57, 0x41, 0x56, 0x45] // WAVE
      };

      let isValidAudio = false;
      for (const [format, sig] of Object.entries(signatures)) {
        if (sig.every((byte, i) => header[i] === byte)) {
          logger.debug('Audio format detected', { jobId, format, fileSize: stats.size });
          isValidAudio = true;
          break;
        }
      }

      if (!isValidAudio) {
        logger.warn('Audio format not recognized', {
          jobId,
          headerBytes: Array.from(header.subarray(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')
        });
      }

      logger.debug('Audio validation completed', {
        jobId,
        fileSize: stats.size,
        valid: isValidAudio
      });

    } catch (error) {
      logger.error('Audio validation failed', { jobId, error: error.message });
      throw new Error(`Audio validation failed: ${error.message}`);
    }
  }

  // REVIEW-CLEANUP: Temp file cleanup strategy
  async cleanupTempFile(filePath, jobId) {
    try {
      await fs.unlink(filePath);
      logger.debug('Temp audio file cleaned up', { 
        jobId, 
        file: path.basename(filePath) 
      });
    } catch (error) {
      logger.warn('Failed to cleanup temp audio file', { 
        jobId, 
        file: path.basename(filePath),
        error: error.message 
      });
    }
  }

  // REVIEW-CLEANUP: Clean old temp files (6 hour retention)
  async cleanupOldTempFiles() {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const sixHoursMs = config.jobs.CLEANUP_AFTER_HOURS * 60 * 60 * 1000;
      
      let cleaned = 0;
      for (const file of files) {
        if (!file.startsWith('audio_') && !file.startsWith('video_')) continue;
        
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > sixHoursMs) {
          await fs.unlink(filePath);
          cleaned++;
          logger.debug('Cleaned old temp file', { file, age: `${Math.round((now - stats.mtime.getTime()) / 1000 / 60 / 60)}h` });
        }
      }

      if (cleaned > 0) {
        logger.success('Temp file cleanup completed', { filesRemoved: cleaned });
      }

    } catch (error) {
      logger.error('Temp file cleanup failed', { error: error.message });
    }
  }

  // Sanitize URL for logging (hide sensitive params)
  sanitizeUrl(url) {
    try {
      const urlObj = new URL(url);
      // Keep domain and path, hide query params that might contain tokens
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return '[invalid-url]';
    }
  }

  // REVIEW-COST: Get estimated download cost
  estimateDownloadCost(audioUrl, durationSeconds) {
    // Estimate based on typical podcast file sizes (1MB per minute of audio)
    const estimatedMB = durationSeconds / 60;
    const downloadCost = estimatedMB * config.costs.COST_PER_GB_STORAGE * 0.001; // Convert to GB
    return Math.max(downloadCost, 0.001); // Minimum $0.001
  }
}

module.exports = new AudioDownloadService();