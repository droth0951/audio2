// 6-hour video cleanup service for storage management

const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const config = require('../config/settings');

// REVIEW-CRITICAL: Lazy load job queue to prevent deleting active jobs (avoids Sharp loading at startup)
let jobQueue = null;
function getJobQueue() {
  if (!jobQueue) {
    jobQueue = require('./job-queue');
  }
  return jobQueue;
}

class CleanupService {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    this.cleanupIntervalMs = 60 * 60 * 1000; // Check every hour
    this.cleanupIntervalId = null;
  }

  // Start automatic cleanup service
  startCleanupService() {
    if (this.cleanupIntervalId) {
      logger.warn('Cleanup service already running');
      return;
    }

    logger.info('Starting automatic cleanup service', {
      interval: '1 hour',
      retentionHours: config.jobs.CLEANUP_AFTER_HOURS
    });

    // Run cleanup immediately
    this.performCleanup();

    // Schedule recurring cleanup
    this.cleanupIntervalId = setInterval(() => {
      this.performCleanup();
    }, this.cleanupIntervalMs);
  }

  // Stop automatic cleanup service
  stopCleanupService() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
      logger.info('Cleanup service stopped');
    }
  }

  // Perform cleanup of old video files
  async performCleanup() {
    try {
      const startTime = Date.now();
      const cutoffTime = Date.now() - (config.jobs.CLEANUP_AFTER_HOURS * 60 * 60 * 1000);
      
      logger.debug('Starting cleanup sweep', {
        cutoffTime: new Date(cutoffTime).toISOString(),
        retentionHours: config.jobs.CLEANUP_AFTER_HOURS
      });

      // Get all files in temp directory
      const files = await fs.readdir(this.tempDir);
      let videosFound = 0;
      let videosDeleted = 0;
      let totalSize = 0;

      for (const file of files) {
        if (file.startsWith('video_') && file.endsWith('.mp4')) {
          videosFound++;
          const filePath = path.join(this.tempDir, file);
          
          try {
            const stats = await fs.stat(filePath);
            const fileAge = Date.now() - stats.mtime.getTime();
            
            if (fileAge > (config.jobs.CLEANUP_AFTER_HOURS * 60 * 60 * 1000)) {
              // REVIEW-CRITICAL: Check if job is still active before deleting
              const jobId = file.replace('video_', '').replace('.mp4', '');
              const jobStatus = getJobQueue().getJobStatus(jobId);
              
              // Safety check: Don't delete if job is recent or still in system
              let shouldSkip = false;
              if (jobStatus.success) {
                const jobAge = Date.now() - new Date(jobStatus.createdAt).getTime();
                const isRecentJob = jobAge < 24 * 60 * 60 * 1000; // 24 hour safety buffer
                const isActiveStatus = ['queued', 'processing', 'completed'].includes(jobStatus.status);
                
                if (isRecentJob && isActiveStatus) {
                  shouldSkip = true;
                  logger.debug('Skipping recent job video', {
                    jobId,
                    file,
                    jobStatus: jobStatus.status,
                    jobAgeHours: Math.round(jobAge / (60 * 60 * 1000))
                  });
                }
              }
              
              if (!shouldSkip) {
                // File is older than retention period and safe to delete
                totalSize += stats.size;
                await fs.unlink(filePath);
                videosDeleted++;
                
                logger.debug('Cleaned up old video', {
                  file,
                  jobId,
                  ageHours: Math.round(fileAge / (60 * 60 * 1000)),
                  sizeMB: Math.round(stats.size / 1024 / 1024 * 100) / 100
                });
              }
            }
          } catch (error) {
            logger.warn('Failed to cleanup video file', {
              file,
              error: error.message
            });
          }
        }
      }

      const cleanupTime = Date.now() - startTime;
      
      if (videosDeleted > 0) {
        logger.success('Cleanup completed', {
          videosFound,
          videosDeleted,
          spaceFreedMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
          cleanupTime: `${cleanupTime}ms`
        });
      } else {
        logger.debug('Cleanup completed - no old videos found', {
          videosFound,
          cleanupTime: `${cleanupTime}ms`
        });
      }

      return {
        videosFound,
        videosDeleted,
        spaceFreedBytes: totalSize,
        cleanupTimeMs: cleanupTime
      };

    } catch (error) {
      logger.error('Cleanup service failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // Manual cleanup trigger
  async manualCleanup() {
    logger.info('Manual cleanup triggered');
    return await this.performCleanup();
  }

  // Get cleanup statistics
  async getCleanupStats() {
    try {
      const files = await fs.readdir(this.tempDir);
      let totalVideos = 0;
      let totalSize = 0;
      let oldVideos = 0;
      let oldSize = 0;
      
      const cutoffTime = Date.now() - (config.jobs.CLEANUP_AFTER_HOURS * 60 * 60 * 1000);

      for (const file of files) {
        if (file.startsWith('video_') && file.endsWith('.mp4')) {
          totalVideos++;
          const filePath = path.join(this.tempDir, file);
          
          try {
            const stats = await fs.stat(filePath);
            totalSize += stats.size;
            
            const fileAge = Date.now() - stats.mtime.getTime();
            if (fileAge > (config.jobs.CLEANUP_AFTER_HOURS * 60 * 60 * 1000)) {
              oldVideos++;
              oldSize += stats.size;
            }
          } catch (error) {
            // File may have been deleted, skip
          }
        }
      }

      return {
        totalVideos,
        totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
        oldVideos,
        oldSizeMB: Math.round(oldSize / 1024 / 1024 * 100) / 100,
        retentionHours: config.jobs.CLEANUP_AFTER_HOURS,
        nextCleanup: this.cleanupIntervalId ? 
          new Date(Date.now() + this.cleanupIntervalMs).toISOString() : 
          'Service not running'
      };
    } catch (error) {
      logger.error('Failed to get cleanup stats', { error: error.message });
      throw error;
    }
  }

  // Emergency cleanup - remove all videos (REQUIRES CONFIRMATION)
  async emergencyCleanup(confirmationToken = null) {
    // REVIEW-CRITICAL: Require explicit confirmation to prevent accidents
    if (confirmationToken !== 'EMERGENCY_DELETE_ALL_VIDEOS') {
      const error = new Error('Emergency cleanup requires confirmation token: EMERGENCY_DELETE_ALL_VIDEOS');
      logger.error('Emergency cleanup rejected - missing confirmation', {
        providedToken: confirmationToken ? '[REDACTED]' : 'null'
      });
      throw error;
    }

    logger.warn('Emergency cleanup triggered - removing ALL videos (including active jobs)');
    
    try {
      const files = await fs.readdir(this.tempDir);
      let deletedCount = 0;
      let deletedSize = 0;
      let activeJobsDeleted = 0;

      for (const file of files) {
        if (file.startsWith('video_') && file.endsWith('.mp4')) {
          const filePath = path.join(this.tempDir, file);
          
          try {
            const stats = await fs.stat(filePath);
            
            // Check if deleting an active job (for logging)
            const jobId = file.replace('video_', '').replace('.mp3', '');
            const jobStatus = getJobQueue().getJobStatus(jobId);
            if (jobStatus.success && ['queued', 'processing', 'completed'].includes(jobStatus.status)) {
              activeJobsDeleted++;
              logger.warn('Emergency cleanup deleting active job video', {
                jobId,
                file,
                jobStatus: jobStatus.status
              });
            }
            
            deletedSize += stats.size;
            await fs.unlink(filePath);
            deletedCount++;
          } catch (error) {
            logger.warn('Failed to delete video in emergency cleanup', {
              file,
              error: error.message
            });
          }
        }
      }

      logger.success('Emergency cleanup completed', {
        deletedVideos: deletedCount,
        activeJobsAffected: activeJobsDeleted,
        spaceFreedMB: Math.round(deletedSize / 1024 / 1024 * 100) / 100
      });

      return {
        deletedVideos: deletedCount,
        activeJobsAffected: activeJobsDeleted,
        spaceFreedBytes: deletedSize
      };

    } catch (error) {
      logger.error('Emergency cleanup failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = new CleanupService();