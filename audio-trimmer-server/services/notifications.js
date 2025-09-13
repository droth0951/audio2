// Email notification service for job updates

const logger = require('./logger');
const config = require('../config/settings');

class NotificationService {
  constructor() {
    this.adminEmail = process.env.ADMIN_EMAIL || 'your-email@example.com';
    this.enableEmails = process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true';
  }

  // Format email content
  formatJobNotification(job, status) {
    const duration = (job.request.clipEnd - job.request.clipStart) / 1000;
    const podcast = job.request.podcast;
    
    let subject, body;
    
    switch (status) {
      case 'completed':
        subject = `✅ Video Created - ${podcast?.title || 'Podcast'} (${duration}s)`;
        body = `
🎬 Video Generation Complete

📊 Job Details:
• Job ID: ${job.jobId}
• Duration: ${duration} seconds
• Cost: $${job.result?.cost?.toFixed(4) || '0.00'}
• Processing Time: ${Math.round(job.processingTime / 1000)}s

🎙️ Podcast Info:
• Title: ${podcast?.title || 'Unknown'}
• Episode: ${podcast?.episode || 'Unknown episode'}
• Clip: ${job.request.clipStart/1000}s - ${job.request.clipEnd/1000}s

🔗 Video URL: ${job.result?.videoUrl || 'Not available'}

📈 Daily Stats:
• Total Cost Today: ${job.dailyCost || 'Unknown'}
• Videos Created: ${job.videosToday || 'Unknown'}
        `.trim();
        break;
        
      case 'failed':
        subject = `❌ Video Failed - ${podcast?.title || 'Podcast'} (${duration}s)`;
        body = `
❌ Video Generation Failed

📊 Job Details:
• Job ID: ${job.jobId}
• Duration: ${duration} seconds
• Error: ${job.error || 'Unknown error'}
• Retries: ${job.retries}/${job.maxRetries}

🎙️ Podcast Info:
• Title: ${podcast?.title || 'Unknown'}
• Episode: ${podcast?.episode || 'Unknown episode'}
• Audio URL: ${job.request.audioUrl}

Need manual review if this keeps happening.
        `.trim();
        break;
        
      default:
        return null;
    }
    
    return { subject, body };
  }

  // Send email notification (Railway webhook approach)
  async sendJobNotification(job, status) {
    if (!this.enableEmails) {
      logger.debug('Email notifications disabled', { jobId: job.jobId });
      return;
    }

    try {
      const notification = this.formatJobNotification(job, status);
      if (!notification) return;

      // For Railway, we can use a webhook service like:
      // 1. Railway's built-in logging (shows up in dashboard)
      // 2. Webhook to email service (Zapier, Make.com)
      // 3. Direct SMTP (requires email service setup)

      // Option 1: Log in a format that can trigger webhooks
      logger.info('EMAIL_NOTIFICATION', {
        to: this.adminEmail,
        subject: notification.subject,
        body: notification.body,
        jobId: job.jobId,
        status,
        cost: job.result?.cost,
        timestamp: new Date().toISOString()
      });

      // Option 2: Railway webhook (if configured)
      if (process.env.RAILWAY_WEBHOOK_URL) {
        await this.sendWebhook({
          event: 'video_job_update',
          job: {
            id: job.jobId,
            status,
            cost: job.result?.cost,
            podcast: job.request.podcast,
            duration: (job.request.clipEnd - job.request.clipStart) / 1000
          },
          notification
        });
      }

      logger.success('Notification sent', { 
        jobId: job.jobId, 
        status, 
        method: process.env.RAILWAY_WEBHOOK_URL ? 'webhook' : 'log' 
      });

    } catch (error) {
      logger.error('Failed to send notification', {
        jobId: job.jobId,
        status,
        error: error.message
      });
    }
  }

  // Send webhook to external service
  async sendWebhook(data) {
    const webhookUrl = process.env.RAILWAY_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Audio2-Server/1.0'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }

    } catch (error) {
      logger.error('Webhook failed', { error: error.message });
    }
  }

  // Daily summary email
  async sendDailySummary(stats) {
    if (!this.enableEmails) return;

    const subject = `📊 Audio2 Daily Summary - ${stats.videosCreated} videos, $${stats.totalCost.toFixed(2)} cost`;
    const body = `
📊 Daily Video Generation Summary

🎬 Production Stats:
• Videos Created: ${stats.videosCreated}
• Total Cost: $${stats.totalCost.toFixed(4)}
• Average Cost/Video: $${(stats.totalCost / stats.videosCreated).toFixed(4)}
• Success Rate: ${stats.successRate}%

📈 Performance:
• Average Processing Time: ${stats.avgProcessingTime}s
• Queue Peak: ${stats.peakQueueSize} jobs
• Failed Jobs: ${stats.failedJobs}

🔧 System Health:
• Uptime: ${Math.round(process.uptime() / 3600)}h
• Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
• Feature Flag: ${stats.featureEnabled ? 'ON' : 'OFF'}

${stats.totalCost > 4 ? '⚠️ Approaching daily spending limit!' : '✅ Cost within limits'}
    `.trim();

    logger.info('DAILY_SUMMARY_EMAIL', {
      to: this.adminEmail,
      subject,
      body,
      stats
    });
  }
}

module.exports = new NotificationService();