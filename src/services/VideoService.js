// Video Service for Audio2
// Handles video metadata fetching and downloading

import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

const API_BASE_URL = process.env.EXPO_PUBLIC_CAPTION_PROXY_BASE || 'https://audio-trimmer-service-production.up.railway.app';

class VideoService {
  // Fetch video metadata from server
  async getVideoMetadata(jobId) {
    try {
      console.log(`📹 Fetching video metadata for job: ${jobId}`);

      const response = await fetch(`${API_BASE_URL}/api/video-metadata/${jobId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch video metadata');
      }

      console.log('✅ Video metadata fetched:', {
        jobId: data.jobId,
        status: data.status,
        podcast: data.podcast?.podcastName
      });

      return data;
    } catch (error) {
      console.error('❌ Failed to fetch video metadata:', error);
      throw error;
    }
  }

  // Download video to device and save to Photos
  async downloadVideoToPhotos(jobId) {
    try {
      console.log(`⬇️ Downloading video for job: ${jobId}`);

      // Get video metadata first
      const metadata = await this.getVideoMetadata(jobId);

      if (metadata.status !== 'completed') {
        throw new Error(`Video is not ready yet. Status: ${metadata.status}`);
      }

      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Media library permissions required to save video');
      }

      // Download the video file
      const downloadUrl = `${API_BASE_URL}/api/download-video/${jobId}`;
      const fileName = `audio2_${jobId}_${Date.now()}.mp4`;
      const localUri = `${FileSystem.documentDirectory}${fileName}`;

      console.log('⬇️ Starting video download...');
      const downloadResult = await FileSystem.downloadAsync(downloadUrl, localUri);

      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status: ${downloadResult.status}`);
      }

      // Save to Photos library
      console.log('💾 Saving video to Photos...');
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);

      // Create or get Audio2 album
      let album = await MediaLibrary.getAlbumAsync('Audio2');
      if (!album) {
        album = await MediaLibrary.createAlbumAsync('Audio2', asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }

      // Clean up temporary file
      await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });

      console.log('✅ Video saved to Photos successfully');

      return {
        success: true,
        asset,
        album,
        metadata
      };

    } catch (error) {
      console.error('❌ Failed to download video:', error);
      throw error;
    }
  }

  // Create video with device token for push notifications
  async createVideoWithPushNotifications(audioUrl, clipStart, clipEnd, podcast, deviceToken, captionsEnabled = false) {
    try {
      console.log('🎬 Creating video with push notifications enabled');

      const requestBody = {
        audioUrl,
        clipStart,
        clipEnd,
        podcast,
        deviceToken, // Include device token for push notifications
        aspectRatio: '9:16',
        template: 'professional',
        captionsEnabled,
        enableSmartFeatures: true
      };

      const response = await fetch(`${API_BASE_URL}/api/create-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create video');
      }

      console.log('✅ Video creation started:', {
        jobId: data.jobId,
        estimatedTime: data.estimatedTime
      });

      return data;

    } catch (error) {
      console.error('❌ Failed to create video:', error);
      throw error;
    }
  }
}

export default new VideoService();