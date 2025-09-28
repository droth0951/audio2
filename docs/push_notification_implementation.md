# Audio2 Push Notification Implementation Guide
## Server-Side Video Generation with Push Delivery

---

## 🎯 OVERVIEW

**Goal**: Implement push notifications to deliver completed videos from Railway server to Audio2 mobile app
**Context**: Server-side video generation is working, now need delivery mechanism
**User Flow**: Submit video → Get instant feedback → Move on to another app → Receive push when ready → Download video to Photos

---

## 📱 MOBILE APP CHANGES (App.js)

### Dependencies to Add:
```bash
npx expo install expo-notifications expo-device expo-constants
```

### Import Statements:
```javascript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
```

### Notification Configuration (Add to App.js top level):
```javascript
// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

### Permission Request Function:
```javascript
async function registerForPushNotificationsAsync() {
  let token;
  
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig.extra.eas.projectId,
    })).data;
    
    console.log('Push token:', token);
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}
```

### Enhanced Server Video Creation Function:
```javascript
const handleCreateVideoServer = async () => {
  try {
    // Get push notification token
    const pushToken = await registerForPushNotificationsAsync();
    
    setVideoGenerationStatus('Submitting to server...');
    
    const response = await fetch(`${RAILWAY_SERVER_URL}/api/create-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioUrl: selectedEpisode.audioUrl,
        clipStart: clipStartMs,
        clipEnd: clipEndMs,
        podcast: {
          title: selectedEpisode.title,
          artwork: selectedEpisode.artwork,
          podcastName: selectedEpisode.podcastName
        },
        captionsEnabled,
        captionStyle,
        template: 'professional',
        aspectRatio: selectedAspectRatio,
        
        // Push notification delivery
        pushToken: pushToken,
        userEmail: null, // Optional backup email
        deliveryMethod: 'push'
      })
    });
    
    const { jobId, estimatedTime } = await response.json();
    
    // Instant feedback
    Alert.alert(
      'Video Processing Started!',
      `Your ${captionsEnabled ? 'captioned ' : ''}video is being generated. ` +
      `You'll get a notification when it's ready (usually ${estimatedTime} seconds). ` +
      `You can continue using the app normally.`,
      [
        { text: 'Got it!' },
        { 
          text: 'Track Progress', 
          onPress: () => trackVideoProgress(jobId) 
        }
      ]
    );
    
    setShowVideoModal(false);
    
    // Setup notification handlers for this job
    setupVideoNotificationHandler(jobId);
    
  } catch (error) {
    console.error('Server generation failed:', error);
    
    // Fallback to iOS method
    Alert.alert(
      'Server Unavailable',
      'Falling back to iOS recording method.',
      [{ text: 'OK', onPress: handleCreateVideoLocal }]
    );
  }
};
```

### Notification Handler Setup:
```javascript
const setupVideoNotificationHandler = (jobId) => {
  // Handle notification when app is in foreground
  const subscription = Notifications.addNotificationReceivedListener(notification => {
    const { videoUrl, jobId: notificationJobId, videoTitle } = notification.request.content.data;
    
    if (notificationJobId === jobId) {
      Alert.alert(
        'Video Ready!',
        `Your video "${videoTitle}" has been generated successfully.`,
        [
          { text: 'Later' },
          { 
            text: 'Download Now', 
            onPress: () => downloadVideo(videoUrl, notificationJobId) 
          }
        ]
      );
    }
  });
  
  // Handle notification tap when app is in background
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    const { videoUrl, jobId: notificationJobId } = response.notification.request.content.data;
    
    if (notificationJobId === jobId) {
      downloadVideo(videoUrl, notificationJobId);
    }
  });
  
  // Cleanup subscriptions after 10 minutes
  setTimeout(() => {
    subscription.remove();
    responseSubscription.remove();
  }, 600000);
};
```

### Video Download Function:
```javascript
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

const downloadVideo = async (videoUrl, jobId) => {
  try {
    setVideoGenerationStatus('Downloading video...');
    
    // Download video file
    const downloadResult = await FileSystem.downloadAsync(
      videoUrl,
      FileSystem.documentDirectory + `audio2_clip_${jobId}.mp4`
    );
    
    if (downloadResult.status === 200) {
      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      
      if (status === 'granted') {
        // Save to Photos library
        const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
        
        // Add to Audio2 album
        const album = await MediaLibrary.getAlbumAsync('Audio2 Clips');
        if (album == null) {
          await MediaLibrary.createAlbumAsync('Audio2 Clips', asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
        
        Alert.alert(
          'Video Downloaded!',
          'Your podcast clip has been saved to Photos and is ready to share.',
          [
            { text: 'Great!' },
            { 
              text: 'Share Now', 
              onPress: () => Sharing.shareAsync(downloadResult.uri)
            }
          ]
        );
      } else {
        // If no Photos permission, just show sharing option
        Alert.alert(
          'Video Ready!',
          'Your video is ready to share.',
          [
            { text: 'OK' },
            { 
              text: 'Share', 
              onPress: () => Sharing.shareAsync(downloadResult.uri)
            }
          ]
        );
      }
    } else {
      throw new Error('Download failed');
    }
    
    setVideoGenerationStatus('');
    
  } catch (error) {
    console.error('Download failed:', error);
    
    Alert.alert(
      'Download Failed',
      'Could not download video. You can try opening the link directly.',
      [
        { text: 'OK' },
        { 
          text: 'Open Link', 
          onPress: () => Linking.openURL(videoUrl) 
        }
      ]
    );
    
    setVideoGenerationStatus('');
  }
};
```

---

## 🚂 RAILWAY SERVER CHANGES

### Environment Variables to Add:
```bash
EXPO_ACCESS_TOKEN=your-expo-access-token  # For sending push notifications
```

### New Dependencies (package.json):
```json
{
  "dependencies": {
    "expo-server-sdk": "^3.7.0"
  }
}
```

### Push Notification Service (services/push-notification.js):
```javascript
const { Expo } = require('expo-server-sdk');

class PushNotificationService {
  constructor() {
    this.expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
      useFcmV1: true
    });
  }

  async sendVideoReadyNotification(pushToken, videoData) {
    // Validate push token
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error('Invalid push token:', pushToken);
      return false;
    }

    const message = {
      to: pushToken,
      sound: 'default',
      title: 'Video Ready!',
      body: `Your podcast clip "${videoData.episodeTitle}" is ready to download`,
      data: {
        videoUrl: videoData.downloadUrl,
        jobId: videoData.jobId,
        videoTitle: videoData.episodeTitle,
        podcastName: videoData.podcastName,
        type: 'video_ready'
      },
      priority: 'high',
      channelId: 'default',
    };

    try {
      const chunks = this.expo.chunkPushNotifications([message]);
      const tickets = [];

      for (let chunk of chunks) {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      }

      console.log('Push notification sent successfully:', tickets);
      return true;

    } catch (error) {
      console.error('Failed to send push notification:', error);
      return false;
    }
  }

  async sendVideoFailedNotification(pushToken, jobId, error) {
    if (!Expo.isExpoPushToken(pushToken)) {
      return false;
    }

    const message = {
      to: pushToken,
      sound: 'default',
      title: 'Video Generation Failed',
      body: 'There was an issue creating your video. You can try again.',
      data: {
        jobId: jobId,
        error: error,
        type: 'video_failed'
      },
      priority: 'normal',
      channelId: 'default',
    };

    try {
      const chunks = this.expo.chunkPushNotifications([message]);
      for (let chunk of chunks) {
        await this.expo.sendPushNotificationsAsync(chunk);
      }
      return true;
    } catch (error) {
      console.error('Failed to send failure notification:', error);
      return false;
    }
  }
}

module.exports = new PushNotificationService();
```

### Enhanced Video Creation API (api/create-video.js):
```javascript
// Add to existing create-video.js

const pushService = require('../services/push-notification');

// Modify the job completion handler
async function handleJobCompletion(jobId, result) {
  try {
    const job = await getJobById(jobId);
    
    if (result.success) {
      // Generate signed download URL
      const downloadUrl = generateSignedDownloadUrl(result.videoPath);
      
      // Update job status
      await updateJobStatus(jobId, 'completed', { downloadUrl });
      
      // Send push notification if token provided
      if (job.pushToken) {
        const videoData = {
          downloadUrl: downloadUrl,
          jobId: jobId,
          episodeTitle: job.podcast.title,
          podcastName: job.podcast.podcastName
        };
        
        await pushService.sendVideoReadyNotification(job.pushToken, videoData);
        console.log(`✅ Push notification sent for job ${jobId}`);
      }
      
      // Optional: Send email backup
      if (job.userEmail) {
        await sendEmailNotification(job.userEmail, downloadUrl, jobId);
      }
      
    } else {
      // Handle failure
      await updateJobStatus(jobId, 'failed', { error: result.error });
      
      if (job.pushToken) {
        await pushService.sendVideoFailedNotification(job.pushToken, jobId, result.error);
      }
    }
    
  } catch (error) {
    console.error(`Failed to handle job completion for ${jobId}:`, error);
  }
}

// Generate time-limited download URLs
function generateSignedDownloadUrl(videoPath) {
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  const signature = crypto
    .createHmac('sha256', process.env.DOWNLOAD_SECRET || 'default-secret')
    .update(`${videoPath}:${expiresAt}`)
    .digest('hex');
  
  const videoId = path.basename(videoPath, '.mp4');
  return `${process.env.RAILWAY_STATIC_URL || 'https://your-app.railway.app'}/api/download-video/${videoId}?expires=${expiresAt}&sig=${signature}`;
}
```

### Video Download Endpoint (api/download-video.js):
```javascript
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

module.exports = async (req, res) => {
  try {
    const { id } = req.params;
    const { expires, sig } = req.query;
    
    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', process.env.DOWNLOAD_SECRET || 'default-secret')
      .update(`${id}.mp4:${expires}`)
      .digest('hex');
    
    if (sig !== expectedSig) {
      return res.status(403).json({ error: 'Invalid signature' });
    }
    
    // Check expiration
    if (Date.now() > parseInt(expires)) {
      return res.status(410).json({ error: 'Download link expired' });
    }
    
    // Serve video file
    const videoPath = path.join(process.cwd(), 'temp', `${id}.mp4`);
    
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="audio2_${id}.mp4"`);
    
    const videoStream = fs.createReadStream(videoPath);
    videoStream.pipe(res);
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
};
```

---

## 🔧 IMPLEMENTATION STEPS

### Phase 1: Mobile App Setup
1. Install expo-notifications dependencies
2. Add notification permission request
3. Modify video creation to include push token
4. Add notification handlers

### Phase 2: Server Integration  
1. Install expo-server-sdk on Railway
2. Add push notification service
3. Modify job completion to send notifications
4. Add download endpoint with signed URLs

### Phase 3: Testing
1. Test notification permissions on device
2. Test video generation with push delivery
3. Test notification handling (foreground/background)
4. Test download and save to Photos

---

## 🎯 SUCCESS CRITERIA

- User submits video request and gets instant feedback
- User can continue using app normally
- Push notification arrives when video is ready (45-90 seconds)
- Tapping notification downloads video to Photos
- Video is ready to share on social media
- Graceful fallback if push fails

---

## ⚠️ IMPORTANT NOTES

### Expo Configuration:
- Requires EAS development build (push notifications don't work in Expo Go)
- Need Expo project ID in app.json/app.config.js
- Push notifications only work on physical devices

### Railway Environment:
- Set EXPO_ACCESS_TOKEN environment variable
- Ensure download URLs are accessible from mobile devices
- Implement proper video cleanup after 24-48 hours

### Error Handling:
- Always provide fallback options (email, manual download)
- Handle push token failures gracefully
- Provide clear error messages to users

This implementation provides a complete push notification system for Audio2's server-side video generation, enabling instant user feedback and background delivery.