// Detailed logging system for hobbyist debugging

const fs = require('fs-extra');
const path = require('path');
const config = require('../config/settings');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'logs');
    this.ensureLogDir();
  }

  async ensureLogDir() {
    try {
      await fs.ensureDir(this.logDir);
    } catch (err) {
      console.error('Failed to create logs directory:', err);
    }
  }

  // Format log entry with timestamp and context
  formatEntry(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      message,
      ...context
    };
    return JSON.stringify(entry, null, 2);
  }

  // Console logging with emoji prefixes for easy scanning
  log(level, message, context = {}) {
    const emoji = {
      info: '📝',
      error: '❌',
      warn: '⚠️',
      success: '✅',
      debug: '🔍',
      cost: '💰',
      job: '⚡'
    };

    const prefix = emoji[level] || '📝';
    console.log(`${prefix} [${level.toUpperCase()}] ${message}`);
    
    if (context && Object.keys(context).length > 0) {
      console.log('   Context:', context);
    }

    // Write to file for error tracking
    if (level === 'error' && config.logging.LOG_ERRORS_TO_FILE) {
      this.writeToFile('errors.log', this.formatEntry(level, message, context));
    }
  }

  // Specific logging methods
  info(message, context) { this.log('info', message, context); }
  error(message, context) { this.log('error', message, context); }
  warn(message, context) { this.log('warn', message, context); }
  success(message, context) { this.log('success', message, context); }
  debug(message, context) { 
    if (config.logging.VERBOSE) {
      this.log('debug', message, context); 
    }
  }
  cost(message, context) { this.log('cost', message, context); }
  job(message, context) { this.log('job', message, context); }

  // Write to log file
  async writeToFile(filename, content) {
    try {
      const filepath = path.join(this.logDir, filename);
      await fs.appendFile(filepath, content + '\n');
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  // Job-specific logging with context
  logJobStart(jobId, request) {
    const duration = (request.clipEnd - request.clipStart) / 1000;
    this.job(`Job ${jobId} started`, {
      jobId,
      audioUrl: request.audioUrl,
      duration: `${duration}s`,
      aspectRatio: request.aspectRatio
    });
  }

  logJobError(jobId, error, stage = 'unknown') {
    this.error(`Job ${jobId} failed at ${stage}`, {
      jobId,
      stage,
      error: error.message,
      stack: error.stack
    });
  }

  logJobSuccess(jobId, metrics) {
    this.success(`Job ${jobId} completed`, {
      jobId,
      processingTime: `${metrics.processingTime}ms`,
      cost: `$${metrics.cost.toFixed(4)}`,
      outputSize: metrics.outputSize
    });
  }
}

module.exports = new Logger();