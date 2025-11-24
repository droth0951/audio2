// Resend email notification service for job updates

const { Resend } = require('resend');
const logger = require('./logger');
const config = require('../config/settings');

class EmailNotificationService {
  constructor() {
    this.resendApiKey = process.env.RESEND_API_KEY;
    this.notificationEmail = process.env.NOTIFICATION_EMAIL;
    this.enableNotifications = process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true';
    this.resend = this.resendApiKey ? new Resend(this.resendApiKey) : null;
  }

  // Send job completion notification
  async sendJobNotification(job, status = 'completed') {
    if (!this.enableNotifications) {
      logger.debug('Email notifications disabled', { jobId: job.jobId });
      return;
    }

    if (!this.resend || !this.notificationEmail) {
      logger.warn('Email notifications not configured', {
        hasResendKey: !!this.resendApiKey,
        hasEmail: !!this.notificationEmail
      });
      return;
    }

    try {
      const notification = this.formatJobNotification(job, status);
      
      // REVIEW-COST: Resend API call (minimal cost)
      await this.sendWithResend(notification);
      
      logger.success(`📧 Email sent successfully for job ${job.jobId}`, {
        status,
        email: this.notificationEmail
      });

    } catch (error) {
      // DON'T retry - just log for debugging (video still works, email is bonus)
      logger.error(`📧 Email failed for job ${job.jobId}:`, { 
        error: error.message 
      });
      logger.error(`📧 Email data:`, JSON.stringify({
        jobId: job.jobId,
        status,
        hasResendKey: !!this.resendApiKey,
        email: this.notificationEmail
      }, null, 2));
    }
  }

  // Format job notification for email
  formatJobNotification(job, status) {
    const request = job.request || {};
    const result = job.result || {};
    
    // Extract podcast info from request
    const podcast = request.podcast || {};
    const clipStart = this.formatTime(request.clipStart);
    const clipEnd = this.formatTime(request.clipEnd);
    const duration = ((request.clipEnd - request.clipStart) / 1000).toFixed(1);
    
    // Calculate cost info
    const cost = result.cost || job.estimatedCost || 0;

    // Calculate timing info
    const startTime = job.createdAt ? new Date(job.createdAt) : null;
    const endTime = new Date(); // When notification is being sent
    const processingTimeMs = result.processingTime || 0;
    const processingTimeSec = Math.round(processingTimeMs / 1000);

    let subject, body;

    if (status === 'completed') {
      subject = `🎬 Video Created: ${podcast.title || 'Podcast'}`;

      // Generate video download URL
      const videoUrl = this.generateVideoUrl(job.jobId);

      body = `
📹 **Video Generation Complete**

**Podcast**: ${podcast.title || 'Unknown'}
**Episode**: ${podcast.episode || 'Unknown'}
**Clip**: ${clipStart} - ${clipEnd} (${duration}s)

🔗 **Download Your Video**:
${videoUrl}

**Processing Timeline**:
• Start Time: ${startTime ? this.formatTimestamp(startTime) : 'Unknown'}
• End Time: ${this.formatTimestamp(endTime)}
• Total Processing Time: ${processingTimeSec}s (${Math.floor(processingTimeSec / 60)}m ${processingTimeSec % 60}s)

**Job Details**:
• Job ID: ${job.jobId}
• Status: ✅ Completed
• Cost: $${cost.toFixed(4)}
• Video Size: ${this.formatFileSize(result.fileSize)}
• Captions: ${request.captionsEnabled ? '✅ Enabled' : '❌ Disabled'}

**Audio Source**: ${this.sanitizeUrl(request.audioUrl)}

Generated at ${this.formatTimestamp(endTime)}
`.trim();

    } else if (status === 'failed') {
      subject = `❌ Video Failed: ${podcast.title || 'Podcast'}`;
      body = `
📹 **Video Generation Failed**

**Podcast**: ${podcast.title || 'Unknown'}
**Episode**: ${podcast.episode || 'Unknown'}
**Clip**: ${clipStart} - ${clipEnd} (${duration}s)

**Error Details**:
• Job ID: ${job.jobId}
• Status: ❌ Failed
• Error: ${job.error || 'Unknown error'}
• Retries: ${job.retries || 0}/${job.maxRetries || 2}
• Failed Stage: ${this.determineFailureStage(job)}

**Debugging Info for Hobbyist**:
• Audio URL: ${this.sanitizeUrl(request.audioUrl)}
• Full Audio URL: ${request.audioUrl}
• Request Duration: ${duration}s
• Estimated Cost: $${job.estimatedCost?.toFixed(4) || 'Unknown'}
• Started At: ${job.startedAt ? this.formatTimestamp(new Date(job.startedAt)) : 'Unknown'}
• Failed At: ${job.failedAt ? this.formatTimestamp(new Date(job.failedAt)) : 'Unknown'}

**Next Steps**:
• Check if audio URL is accessible
• Verify clip times are within audio duration  
• Check Railway logs for detailed error stack trace
• Test with /api/test-video endpoint

Failed at ${this.formatTimestamp(new Date())}
`.trim();
    }

    return {
      to: this.notificationEmail,
      subject,
      body,
      metadata: {
        jobId: job.jobId,
        status,
        cost: cost.toFixed(4),
        podcast: podcast.title,
        episode: podcast.episode,
        duration: `${duration}s`,
        timestamp: new Date().toISOString()
      }
    };
  }

  // REVIEW-CRITICAL: Send notification via Resend API
  async sendWithResend(notification) {
    // Convert text to HTML for better formatting
    const htmlBody = notification.body
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')  // Bold
      .replace(/^• (.+)$/gm, '• $1')  // Bullet points
      .replace(/\n/g, '<br>')  // Line breaks
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>'); // Clickable links

    const emailData = {
      from: 'Audio2 Server <noreply@resend.dev>', // Using Resend's default domain
      to: [notification.to],
      subject: notification.subject,
      text: notification.body,
      html: htmlBody,
      headers: {
        'X-Job-ID': notification.metadata.jobId,
        'X-Notification-Type': notification.metadata.status
      }
    };

    const response = await this.resend.emails.send(emailData);
    
    logger.debug('Resend API response', {
      id: response.data?.id,
      status: 'sent'
    });

    return response.data;
  }

  // Helper: Format milliseconds to MM:SS
  formatTime(milliseconds) {
    if (!milliseconds) return '00:00';
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // Helper: Format file size
  formatFileSize(bytes) {
    if (!bytes) return 'Unknown';
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)}KB`;
    }
    return `${Math.round(bytes / 1024 / 1024 * 100) / 100}MB`;
  }

  // Helper: Sanitize URL for logging
  sanitizeUrl(url) {
    if (!url) return 'Unknown';
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return '[invalid-url]';
    }
  }

  // Helper: Format timestamp in EST timezone
  formatTimestamp(date) {
    return new Date(date).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  }

  // Helper: Generate video download URL for Railway deployment
  generateVideoUrl(jobId) {
    // Use Railway deployment URL
    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
      || process.env.RAILWAY_STATIC_URL
      || 'audio-trimmer-service-production.up.railway.app';

    // Ensure https:// protocol
    const url = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;

    // Return direct download link for the video
    return `${url}/api/download-video/${jobId}`;
  }

  // Helper: Determine failure stage for debugging
  determineFailureStage(job) {
    const error = job.error || '';
    
    if (error.includes('HTTP 404') || error.includes('Request failed')) {
      return 'Audio Download';
    } else if (error.includes('frame') || error.includes('SVG') || error.includes('Sharp')) {
      return 'Frame Generation';
    } else if (error.includes('FFmpeg') || error.includes('video') || error.includes('composition')) {
      return 'Video Composition';
    } else if (error.includes('Daily spending cap') || error.includes('cost')) {
      return 'Cost Limit Check';
    } else if (error.includes('queue') || error.includes('concurrent')) {
      return 'Job Queue Management';
    } else {
      return 'Unknown Stage';
    }
  }
}

module.exports = new EmailNotificationService();