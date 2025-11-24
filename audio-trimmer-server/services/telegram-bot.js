// Telegram bot notification service for job updates

const logger = require('./logger');

class TelegramBotService {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.enableNotifications = process.env.ENABLE_TELEGRAM_NOTIFICATIONS !== 'false'; // Default enabled
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  // Send job notification to Telegram
  async sendJobNotification(job, status = 'completed') {
    if (!this.enableNotifications) {
      logger.debug('Telegram notifications disabled', { jobId: job.jobId });
      return;
    }

    if (!this.botToken || !this.chatId) {
      logger.warn('Telegram notifications not configured', {
        hasBotToken: !!this.botToken,
        hasChatId: !!this.chatId
      });
      return;
    }

    try {
      const message = this.formatJobNotification(job, status);

      await this.sendMessage(message);

      logger.success(`📱 Telegram notification sent for job ${job.jobId}`, {
        status,
        chatId: this.chatId
      });

    } catch (error) {
      // DON'T retry - just log for debugging (video still works, Telegram is bonus)
      logger.error(`📱 Telegram notification failed for job ${job.jobId}:`, {
        error: error.message
      });
    }
  }

  // Format job notification message with Telegram Markdown
  formatJobNotification(job, status) {
    const request = job.request || {};
    const result = job.result || {};

    // Extract podcast info from request
    const podcast = request.podcast || {};
    const clipStart = this.formatTime(request.clipStart);
    const clipEnd = this.formatTime(request.clipEnd);
    const duration = ((request.clipEnd - request.clipStart) / 1000).toFixed(1);

    // Calculate cost and processing time
    const cost = result.cost || job.estimatedCost || 0;
    const processingTime = result.processingTime
      ? this.formatDuration(result.processingTime)
      : job.estimatedTime
        ? `~${Math.round(job.estimatedTime / 60)}min`
        : 'Unknown';

    let message;

    if (status === 'started') {
      message = `
🎬 *Video Processing Started*

🎙 *Podcast:* ${this.escape(podcast.title || 'Unknown')}
📻 *Episode:* ${this.escape(podcast.episode || 'Unknown')}
⏱ *Clip:* ${this.escape(clipStart)} \\- ${this.escape(clipEnd)} \\(${this.escape(duration)}s\\)

💰 *Estimated Cost:* ${this.escape('$' + cost.toFixed(4))}
⏳ *Estimated Time:* ${this.escape(processingTime)}
🔑 *Job ID:* \`${job.jobId}\`
🎬 *Captions:* ${request.captionsEnabled ? '✅ Enabled' : '❌ Disabled'}

_Processing your video\\.\\.\\._
`.trim();

    } else if (status === 'completed') {
      const videoUrl = this.generateVideoUrl(job.jobId);

      message = `
✅ *Video Ready\\!*

🎙 *Podcast:* ${this.escape(podcast.title || 'Unknown')}
📻 *Episode:* ${this.escape(podcast.episode || 'Unknown')}
⏱ *Clip:* ${this.escape(clipStart)} \\- ${this.escape(clipEnd)} \\(${this.escape(duration)}s\\)

💰 *Cost:* ${this.escape('$' + cost.toFixed(4))}
⏱ *Processing Time:* ${this.escape(processingTime)}
💾 *Size:* ${this.escape(this.formatFileSize(result.fileSize))}
🔑 *Job ID:* \`${job.jobId}\`

🔗 [Download Video](${videoUrl})
`.trim();

    } else if (status === 'failed') {
      message = `
❌ *Video Processing Failed*

🎙 *Podcast:* ${this.escape(podcast.title || 'Unknown')}
📻 *Episode:* ${this.escape(podcast.episode || 'Unknown')}
⏱ *Clip:* ${this.escape(clipStart)} \\- ${this.escape(clipEnd)} \\(${this.escape(duration)}s\\)

⚠️ *Error:* ${this.escape(job.error || 'Unknown error')}
🔁 *Retries:* ${job.retries || 0}/${job.maxRetries || 2}
🔑 *Job ID:* \`${job.jobId}\`

_Check Railway logs for details\\._
`.trim();
    }

    return message;
  }

  // Send message to Telegram using fetch
  async sendMessage(text) {
    const url = `${this.apiUrl}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: this.chatId,
        text: text,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Telegram API returned error: ${data.description || 'Unknown error'}`);
    }

    logger.debug('Telegram message sent', {
      messageId: data.result?.message_id,
      chatId: this.chatId
    });

    return data.result;
  }

  // Test the bot connection
  async testConnection() {
    if (!this.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }

    if (!this.chatId) {
      throw new Error('TELEGRAM_CHAT_ID not configured');
    }

    const url = `${this.apiUrl}/getMe`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to connect to Telegram API: ${response.status}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description || 'Unknown error'}`);
    }

    return {
      botInfo: data.result,
      chatId: this.chatId,
      status: 'connected'
    };
  }

  // Helper: Escape special characters for Telegram MarkdownV2
  escape(text) {
    if (!text) return '';
    return String(text)
      .replace(/\\/g, '\\\\')
      .replace(/_/g, '\\_')
      .replace(/\*/g, '\\*')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/~/g, '\\~')
      .replace(/`/g, '\\`')
      .replace(/>/g, '\\>')
      .replace(/#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/-/g, '\\-')
      .replace(/=/g, '\\=')
      .replace(/\|/g, '\\|')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\./g, '\\.')
      .replace(/!/g, '\\!');
  }

  // Helper: Format milliseconds to MM:SS
  formatTime(milliseconds) {
    if (!milliseconds) return '00:00';
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // Helper: Format duration in milliseconds to human readable
  formatDuration(milliseconds) {
    if (!milliseconds) return 'Unknown';
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  // Helper: Format file size
  formatFileSize(bytes) {
    if (!bytes) return 'Unknown';
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)}KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
  }

  // Helper: Generate video download URL
  generateVideoUrl(jobId) {
    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
      || process.env.RAILWAY_STATIC_URL
      || 'audio-trimmer-service-production.up.railway.app';

    const url = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
    return `${url}/api/download-video/${jobId}`;
  }
}

module.exports = new TelegramBotService();
