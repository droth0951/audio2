// iOS Push Notification service using APNs (Apple Push Notification service)
// Sends push notifications to iOS devices when videos are ready

const http2 = require('http2');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const logger = require('./logger');

class IOSPushNotificationService {
  constructor() {
    this.enabled = process.env.ENABLE_IOS_PUSH === 'true';
    this.teamId = process.env.APNS_TEAM_ID;
    this.keyId = process.env.APNS_KEY_ID;
    this.bundleId = process.env.APNS_BUNDLE_ID || 'com.yourapp.audio2';
    this.keyPath = process.env.APNS_KEY_PATH; // Path to .p8 file (legacy)
    this.keyBase64 = process.env.APNS_KEY_BASE64; // Base64 encoded .p8 content (preferred)
    this.isProduction = process.env.NODE_ENV === 'production';

    this.apnsHost = this.isProduction
      ? 'api.push.apple.com'
      : 'api.sandbox.push.apple.com';

    if (this.enabled) {
      this.initializeAPNs();
    }
  }

  // Initialize APNs authentication
  initializeAPNs() {
    if (!this.teamId || !this.keyId || (!this.keyPath && !this.keyBase64)) {
      logger.warn('⚠️ iOS Push notifications not fully configured', {
        hasTeamId: !!this.teamId,
        hasKeyId: !!this.keyId,
        hasKeyPath: !!this.keyPath,
        hasKeyBase64: !!this.keyBase64
      });
      this.enabled = false;
      return;
    }

    try {
      // Load the APNs private key (prefer base64, fallback to file path)
      if (this.keyBase64) {
        // Decode base64 private key
        this.privateKey = Buffer.from(this.keyBase64, 'base64').toString('utf8');
        logger.debug('✅ iOS Push notification service initialized (from base64)', {
          host: this.apnsHost,
          bundleId: this.bundleId
        });
      } else if (this.keyPath && fs.existsSync(this.keyPath)) {
        // Legacy file path method
        this.privateKey = fs.readFileSync(this.keyPath, 'utf8');
        logger.debug('✅ iOS Push notification service initialized (from file)', {
          host: this.apnsHost,
          bundleId: this.bundleId
        });
      } else {
        logger.error('❌ APNs private key not found', {
          keyPath: this.keyPath,
          hasKeyBase64: !!this.keyBase64
        });
        this.enabled = false;
      }
    } catch (error) {
      logger.error('❌ Failed to initialize iOS Push notifications', {
        error: error.message
      });
      this.enabled = false;
    }
  }

  // Generate JWT token for APNs authentication
  generateAuthToken() {
    const payload = {
      iss: this.teamId,
      iat: Math.floor(Date.now() / 1000)
    };

    const header = {
      alg: 'ES256',
      kid: this.keyId
    };

    return jwt.sign(payload, this.privateKey, {
      algorithm: 'ES256',
      header: header
    });
  }

  // Send push notification to iOS device
  async sendVideoReadyNotification(deviceToken, jobId, podcastName, episodeTitle) {
    if (!this.enabled) {
      logger.debug('iOS Push notifications disabled', { jobId });
      return;
    }

    try {
      const payload = {
        aps: {
          alert: {
            title: 'Audio2',
            body: '🎧 Your Audio2 video clip is ready!'
          },
          badge: 1,
          sound: 'default',
          category: 'VIDEO_READY'
        },
        // Custom data
        jobId: jobId,
        podcastName: podcastName,
        episodeTitle: episodeTitle,
        deepLink: `audio2://video-ready?jobId=${jobId}`
      };

      const authToken = this.generateAuthToken();

      await this.sendAPNsRequest(deviceToken, payload, authToken, jobId);

      logger.success('📱 iOS push notification sent', {
        jobId,
        deviceToken: deviceToken.substring(0, 8) + '...',
        podcastName
      });

    } catch (error) {
      logger.error('❌ Failed to send iOS push notification', {
        jobId,
        error: error.message,
        stack: error.stack
      });
    }
  }

  // Send HTTP/2 request to APNs
  async sendAPNsRequest(deviceToken, payload, authToken, jobId) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(payload);

      // Create HTTP/2 client session
      const client = http2.connect(`https://${this.apnsHost}`, {
        // TLS settings for Apple's servers
        secureProtocol: 'TLSv1_2_method',
      });

      client.on('error', (error) => {
        logger.error('HTTP/2 client error:', {
          error: error.message,
          code: error.code,
          host: this.apnsHost
        });
        reject(error);
      });

      // Set up the request
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${deviceToken}`,
        'authorization': `bearer ${authToken}`,
        'apns-id': jobId,
        'apns-expiration': '0',
        'apns-priority': '10',
        'apns-topic': this.bundleId,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(postData)
      });

      req.on('response', (headers) => {
        const status = headers[':status'];
        let responseData = '';

        req.on('data', (chunk) => {
          responseData += chunk;
        });

        req.on('end', () => {
          client.close();

          if (status === 200) {
            resolve({ success: true, response: responseData });
          } else {
            reject(new Error(`APNs error: ${status} - ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        client.close();
        logger.error('APNs request error:', {
          error: error.message,
          code: error.code,
          host: this.apnsHost
        });
        reject(error);
      });

      // Set timeout
      req.setTimeout(10000, () => {
        client.close();
        reject(new Error('APNs request timeout'));
      });

      // Send the payload
      req.write(postData);
      req.end();
    });
  }

  // Check if push notifications are enabled and configured
  isEnabled() {
    return this.enabled;
  }

  // Get configuration status for debugging
  getStatus() {
    return {
      enabled: this.enabled,
      host: this.apnsHost,
      bundleId: this.bundleId,
      hasTeamId: !!this.teamId,
      hasKeyId: !!this.keyId,
      hasPrivateKey: !!this.privateKey
    };
  }
}

module.exports = new IOSPushNotificationService();