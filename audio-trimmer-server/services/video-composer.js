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
  }

  // REVIEW-CRITICAL: Combine frames + audio into MP4 video
  async composeVideo(audioPath, frameResult, jobId, duration) {
    try {
      // REVIEW-CRITICAL: Feature flag check for video composition
      if (!config.features.ENABLE_SERVER_VIDEO) {
        throw new Error('Video composition disabled - server-side video generation is off');
      }

      const startTime = Date.now();
      const outputPath = path.join(this.tempDir, `video_${jobId}.mp4`);
      
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
          '-shortest',                // REVIEW-CRITICAL: End when shortest stream ends
          '-movflags', '+faststart'   // REVIEW-CRITICAL: Web optimization
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          logger.debug('FFmpeg command started', {
            jobId,
            command: commandLine.split(' ').slice(0, 10).join(' ') + '...' // Truncate for logging
          });
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            logger.debug('FFmpeg progress', {
              jobId,
              percent: Math.round(progress.percent) + '%',
              timemark: progress.timemark
            });
          }
        })
        .on('end', () => {
          logger.debug('FFmpeg processing completed', { jobId });
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
    return `http://localhost:3001/temp/${filename}`;
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