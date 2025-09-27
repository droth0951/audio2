// Push Notification Service for Audio2
// Handles push notification permissions, device tokens, and notification handling

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

class PushNotificationService {
  constructor() {
    this.deviceToken = null;
    this.notificationListener = null;
    this.responseListener = null;
  }

  // Configure notification behavior
  configure() {
    // Set how notifications are handled when app is in foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }

  // Request push notification permissions and get device token
  async requestPermissions() {
    console.log('🔔 Requesting push notification permissions...');

    if (!Device.isDevice) {
      console.log('⚠️ Push notifications only work on physical devices');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Push notification permissions denied');
      return null;
    }

    // Get device token
    try {
      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      })).data;

      console.log('✅ Push notification permissions granted');
      console.log('📱 Device token:', token.substring(0, 20) + '...');

      this.deviceToken = token;
      return token;
    } catch (error) {
      console.error('❌ Failed to get push token:', error);
      return null;
    }
  }

  // Get stored device token
  getDeviceToken() {
    return this.deviceToken;
  }

  // Set up notification listeners
  setupNotificationListeners(onNotificationReceived, onNotificationTapped) {
    console.log('🔔 Setting up push notification listeners...');

    // Listen for notifications received while app is running
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Push notification received:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    // Listen for notification taps
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Push notification tapped:', response);

      // Extract jobId from notification data
      const jobId = response.notification.request.content.data?.jobId;
      if (jobId && onNotificationTapped) {
        onNotificationTapped(jobId, response.notification.request.content.data);
      }
    });
  }

  // Clean up listeners
  removeNotificationListeners() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
  }

  // Send a local test notification (for testing)
  async sendTestNotification() {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Audio2 Test',
        body: '🎧 Test notification - your video is ready!',
        data: { jobId: 'test_123', test: true },
      },
      trigger: { seconds: 2 },
    });
  }
}

export default new PushNotificationService();