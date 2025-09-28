// Video Ready Banner Component
// Shows when a video is ready for download after push notification

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import VideoService from '../services/VideoService';

const { width: screenWidth } = Dimensions.get('window');

const VideoReadyBanner = ({ jobId, podcastName, episodeTitle, onDismiss, onDownloadComplete }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);

      // Download video to Photos
      const result = await VideoService.downloadVideoToPhotos(jobId);

      Alert.alert(
        '✅ Success!',
        `Your Audio2 video has been saved to your Photos library in the "Audio2" album.`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (onDownloadComplete) {
                onDownloadComplete(result);
              }
              if (onDismiss) {
                onDismiss();
              }
            }
          }
        ]
      );

    } catch (error) {
      console.error('Download failed:', error);
      Alert.alert(
        '❌ Download Failed',
        error.message || 'Failed to download video. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <LinearGradient
      colors={['#4F46E5', '#7C3AED']}
      style={styles.banner}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="video-check" size={28} color="#ffffff" />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>🎧 Video Ready!</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {podcastName} • {episodeTitle}
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          {isDownloading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={handleDownload}
                disabled={isDownloading}
              >
                <MaterialCommunityIcons name="download" size={20} color="#ffffff" />
                <Text style={styles.downloadButtonText}>Save</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dismissButton}
                onPress={handleDismiss}
                disabled={isDownloading}
              >
                <MaterialCommunityIcons name="close" size={20} color="#ffffff" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  banner: {
    width: screenWidth - 32,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#E5E7EB',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  dismissButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default VideoReadyBanner;