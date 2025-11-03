// Video Processing Banner Component
// Shows when a video is being processed on the server

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');

const VideoProcessingBanner = ({ clipDuration, onDismiss }) => {
  // Format duration as M:SS
  const formatDuration = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
          <MaterialCommunityIcons name="video-plus" size={28} color="#ffffff" />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.message}>
            Your {formatDuration(clipDuration)} clip is processing. Audio2 will notify you when it's ready in &lt;5 mins.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
        >
          <MaterialCommunityIcons name="close" size={20} color="#ffffff" />
        </TouchableOpacity>
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
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#ffffff',
  },
  dismissButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default VideoProcessingBanner;
