// FFmpeg video composition service - combines frames with audio

const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const config = require('../config/settings');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

class VideoComposer {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    this.volumeDir = config.storage.VOLUME_PATH;
    this.useVolume = config.storage.USE_VOLUME;

    // Initialize volume storage on startup
    this.initializeVolumeStorage();
  }

  // Initialize volume storage directory
  async initializeVolumeStorage() {
    if (!this.useVolume) {
      logger.debug('Volume storage disabled, using temp directory');
      return;
    }

    try {
      await fs.mkdir(this.volumeDir, { recursive: true });
      logger.success(`Volume storage initialized: ${this.volumeDir}`);
    } catch (error) {
      logger.warn(`Volume storage initialization failed: ${error.message}`, {
        volumePath: this.volumeDir,
        fallbackToTemp: true
      });
      this.useVolume = false; // Fallback to temp directory
    }
  }

  // Get appropriate storage directory for videos
  getVideoStorageDir() {
    return this.useVolume ? this.volumeDir : this.tempDir;
  }

  // REVIEW-CRITICAL: Combine frames + audio into MP4 video
  async composeVideo(audioPath, frameResult, jobId, duration) {
    try {
      // REVIEW-CRITICAL: Feature flag check for video composition
      if (!config.features.ENABLE_SERVER_VIDEO) {
        throw new Error('Video composition disabled - server-side video generation is off');
      }

      const startTime = Date.now();
      const storageDir = this.getVideoStorageDir();
      const outputPath = path.join(storageDir, `video_${jobId}.mp4`);
      
      logger.debug('Starting video composition', {
        jobId,
        audioPath: path.basename(audioPath),
        frameCount: frameResult.frameCount,
        frameDir: path.basename(frameResult.frameDir),
        fps: frameResult.fps,
        duration: `${duration}s`,
        calculatedFrameDuration: `${frameResult.frameCount / frameResult.fps}s`
      });

      // REVIEW-COST: FFmpeg processing - optimize for speed vs quality
      await this.createVideoWithFFmpeg(audioPath, frameResult, outputPath, jobId, duration);

      const compositionTime = Date.now() - startTime;
      const stats = await fs.stat(outputPath);
      
      logger.success('Video composition completed', {
        jobId,
        outputPath: path.basename(outputPath),
        storageType: this.useVolume ? 'volume' : 'temp',
        storagePath: storageDir,
        fileSize: `${Math.round(stats.size / 1024 / 1024 * 100) / 100}MB`,
        compositionTime: `${compositionTime}ms`
      });

      return {
        videoPath: outputPath,
        fileSize: stats.size,
        compositionTime,
        duration: duration
      };

    } catch (error) {
      logger.error('Video composition failed', {
        jobId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // REVIEW-CRITICAL: FFmpeg command construction and execution
  async createVideoWithFFmpeg(audioPath, frameResult, outputPath, jobId, duration) {
    return new Promise((resolve, reject) => {
      const framePattern = path.join(frameResult.frameDir, 'frame_%06d.png');

      const ffmpegStartTime = Date.now();
      let lastProgressTime = Date.now();

      // REVIEW-COST: FFmpeg settings optimized for Railway deployment
      const command = ffmpeg()
        .input(framePattern)
        .inputOptions([
          '-f', 'image2',
          '-framerate', frameResult.fps.toString()
        ])
        .input(audioPath)
        .outputOptions([
          '-c:v', 'libx264',           // REVIEW-COST: H.264 codec for compatibility
          '-preset', 'fast',           // REVIEW-COST: Fast encoding for Railway
          '-crf', '23',               // REVIEW-COST: Good quality vs file size
          '-pix_fmt', 'yuv420p',      // REVIEW-CRITICAL: Compatibility with all players
          '-c:a', 'aac',              // REVIEW-COST: AAC audio codec
          '-b:a', '128k',             // REVIEW-COST: Audio bitrate
          '-t', duration.toString(),  // REVIEW-CRITICAL: Use exact duration instead of -shortest
          '-movflags', '+faststart'   // REVIEW-CRITICAL: Web optimization
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          logger.debug('⏱️ FFmpeg encoding started', {
            jobId,
            frameCount: frameResult.frameCount,
            fps: frameResult.fps,
            duration: `${duration}s`,
            command: commandLine.split(' ').slice(0, 10).join(' ') + '...' // Truncate for logging
          });
        })
        .on('progress', (progress) => {
          const now = Date.now();
          const timeSinceLastProgress = now - lastProgressTime;
          lastProgressTime = now;

          if (progress.percent && (Math.round(progress.percent) % 20 === 0 || timeSinceLastProgress > 5000)) {
            logger.debug('⏱️ FFmpeg encoding progress', {
              jobId,
              percent: Math.round(progress.percent) + '%',
              timemark: progress.timemark,
              elapsed: `${Math.round((now - ffmpegStartTime) / 1000)}s`,
              progressDelay: `${timeSinceLastProgress}ms`
            });
          }
        })
        .on('end', () => {
          const totalEncodingTime = Date.now() - ffmpegStartTime;
          logger.success('⏱️ FFmpeg encoding completed', {
            jobId,
            totalTime: `${totalEncodingTime}ms`,
            seconds: `${Math.round(totalEncodingTime / 1000)}s`
          });
          resolve();
        })
        .on('error', (err) => {
          logger.error('FFmpeg processing failed', {
            jobId,
            error: err.message,
            stack: err.stack
          });
          reject(new Error(`FFmpeg failed: ${err.message}`));
        });

      // REVIEW-CRITICAL: FFmpeg timeout to prevent hanging
      const timeout = setTimeout(() => {
        command.kill('SIGKILL');
        reject(new Error('FFmpeg processing timeout (120s)'));
      }, 120000); // 2 minute timeout

      command.run();
      
      command.on('end', () => {
        clearTimeout(timeout);
      });

      command.on('error', () => {
        clearTimeout(timeout);
      });
    });
  }

  // REVIEW-CLEANUP: Cleanup composed video file
  async cleanupVideo(videoPath, jobId) {
    try {
      await fs.unlink(videoPath);
      logger.debug('Video file cleaned up', {
        jobId,
        file: path.basename(videoPath)
      });
    } catch (error) {
      logger.warn('Failed to cleanup video file', {
        jobId,
        file: path.basename(videoPath),
        error: error.message
      });
    }
  }

  // REVIEW-CRITICAL: Generate video URL for client access
  generateVideoUrl(videoPath, jobId) {
    // For now, return temp path - TODO: Upload to storage
    const filename = path.basename(videoPath);
    const port = process.env.PORT || 3000;
    return `http://localhost:${port}/temp/${filename}`;
  }

  // REVIEW-COST: Estimate video composition cost
  estimateCompositionCost(duration, frameCount) {
    // Estimate based on Railway compute time
    const processingTimeSeconds = Math.max(duration * 2, 30); // At least 30s processing
    const computeCostPerSecond = 0.000015; // Railway estimate
    return processingTimeSeconds * computeCostPerSecond;
  }

  // REVIEW-CRITICAL: Validate video output quality
  async validateVideoOutput(videoPath, jobId) {
    try {
      const stats = await fs.stat(videoPath);
      
      // Basic file size validation
      if (stats.size === 0) {
        throw new Error('Generated video file is empty');
      }
      
      if (stats.size < 10000) { // Less than 10KB is suspicious
        throw new Error('Generated video file too small (likely corrupted)');
      }

      // TODO: Could add more sophisticated validation
      // - Check video duration matches expected
      // - Verify video/audio streams exist
      // - Test if file is playable

      logger.debug('Video output validation passed', {
        jobId,
        fileSize: stats.size,
        filePath: path.basename(videoPath)
      });

      return true;

    } catch (error) {
      logger.error('Video output validation failed', {
        jobId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new VideoComposer();