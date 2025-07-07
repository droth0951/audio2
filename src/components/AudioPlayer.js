import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

const AudioPlayer = ({
  selectedEpisode,
  isLoading,
  isPlaying,
  position,
  duration,
  clipStart,
  clipEnd,
  isScrubbing,
  isPreviewMode,
  previewClipStart,
  previewClipEnd,
  onBack,
  onTogglePlayback,
  onSeekToPosition,
  onSkipBackward,
  onSkipForward,
  onSkip5Backward,
  onSkip5Forward,
  onSetClipPoint,
  onPlayClip,
  onSaveClip,
  onExitPreview,
  onScrubStart,
  onScrubEnd,
}) => {
  const formatTime = (millis) => {
    if (!millis || isNaN(millis)) return '0:00';
    const minutes = Math.floor(millis / 60000);
    const seconds = Math.floor((millis % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProgressBarPress = (e) => {
    if (duration > 0) {
      const { locationX } = e.nativeEvent;
      const containerWidth = screenWidth - 40; // Account for padding
      const seekPosition = (locationX / containerWidth) * duration;
      onSeekToPosition(Math.max(0, Math.min(seekPosition, duration)));
    }
  };

  const handleClipProgressBarPress = (e) => {
    if (previewClipStart !== null && previewClipEnd !== null) {
      const { locationX } = e.nativeEvent;
      const containerWidth = 320;
      const clipDuration = previewClipEnd - previewClipStart;
      const relativePosition = (locationX / containerWidth) * clipDuration;
      const absolutePosition = previewClipStart + relativePosition;
      onSeekToPosition(absolutePosition);
    }
  };

  return (
    <View style={styles.container}>
      {/* Navigation Header */}
      <View style={styles.navigationHeader}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#d97706" />
          <Text style={styles.backButtonText}>Episodes</Text>
        </TouchableOpacity>

        <Image 
          source={require('../../assets/logo1.png')} 
          style={styles.smallLogo}
          resizeMode="contain"
        />
      </View>

      {/* Episode Header */}
      <View style={styles.episodeHeader}>
        {selectedEpisode.artwork && (
          <Image 
            source={{ uri: selectedEpisode.artwork }} 
            style={styles.episodeArtworkLarge}
            resizeMode="cover"
          />
        )}
        <Text style={styles.episodeTitle} numberOfLines={3}>
          {selectedEpisode?.title || 'Untitled Episode'}
        </Text>
      </View>

      {/* Loading State */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#d97706" />
          <Text style={styles.loadingText}>Loading episode...</Text>
          <Text style={styles.loadingSubtext}>Preparing audio playback</Text>
        </View>
      )}

      {/* Player Controls - Show when loaded */}
      {!isLoading && (
        <>
          {/* MAIN TIMELINE */}
          <View style={styles.mainTimelineSection}>
            <TouchableOpacity 
              style={styles.mainProgressBarContainer}
              onPressIn={onScrubStart}
              onPressOut={onScrubEnd}
              onPress={handleProgressBarPress}
            >
              <View style={[styles.mainProgressBar, isScrubbing && styles.mainProgressBarActive]}>
                <View 
                  style={[
                    styles.mainProgressFill, 
                    { width: `${duration ? (position / duration) * 100 : 0}%` }
                  ]} 
                />
                {/* Progress Handle */}
                <View 
                  style={[
                    styles.mainProgressHandle, 
                    { left: `${duration ? (position / duration) * 100 : 0}%` },
                    isScrubbing && styles.mainProgressHandleActive
                  ]} 
                />
                {/* Clip Markers */}
                {clipStart && duration && (
                  <View 
                    style={[
                      styles.mainClipMarker, 
                      { left: `${(clipStart / duration) * 100}%` }
                    ]} 
                  />
                )}
                {clipEnd && duration && (
                  <View 
                    style={[
                      styles.mainClipMarker, 
                      { left: `${(clipEnd / duration) * 100}%` }
                    ]} 
                  />
                )}
              </View>
            </TouchableOpacity>
            
            {/* Time Display Below Main Timeline */}
            <View style={styles.mainTimeContainer}>
              <Text style={styles.mainTimeText}>{formatTime(position)}</Text>
              <Text style={styles.mainTimeText}>{formatTime(duration)}</Text>
            </View>
          </View>

          {/* Fine Skip Controls */}
          <View style={styles.fineControls}>
            <TouchableOpacity style={styles.circularButton} onPress={onSkip5Backward}>
              <MaterialCommunityIcons name="rewind-5" size={24} color="#f4f4f4" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.circularButton} onPress={onSkip5Forward}>
              <MaterialCommunityIcons name="fast-forward-5" size={24} color="#f4f4f4" />
            </TouchableOpacity>
          </View>

          {/* Main Skip Controls */}
          <View style={styles.skipControls}>
            <TouchableOpacity style={styles.circularButtonLarge} onPress={onSkipBackward}>
              <MaterialCommunityIcons name="rewind-15" size={36} color="#f4f4f4" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.playButton} onPress={onTogglePlayback}>
              <MaterialCommunityIcons 
                name={isPlaying ? "pause" : "play"} 
                size={40} 
                color="#f4f4f4" 
              />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.circularButtonLarge} onPress={onSkipForward}>
              <MaterialCommunityIcons name="fast-forward-15" size={36} color="#f4f4f4" />
            </TouchableOpacity>
          </View>

          {/* Clip Controls */}
          <View style={styles.clipControls}>
            <TouchableOpacity style={styles.clipButton} onPress={onSetClipPoint}>
              <MaterialCommunityIcons name="content-cut" size={16} color="#f4f4f4" />
              <Text style={styles.clipButtonText}>
                {!clipStart ? 'Start' : (!clipEnd ? 'End' : 'New')}
              </Text>
            </TouchableOpacity>
            
            {clipStart && clipEnd && (
              <>
                <TouchableOpacity style={styles.clipButton} onPress={onPlayClip}>
                  <MaterialCommunityIcons name="play-outline" size={16} color="#f4f4f4" />
                  <Text style={styles.clipButtonText}>Preview</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.saveButton} onPress={onSaveClip}>
                  <MaterialCommunityIcons name="content-save" size={16} color="#f4f4f4" />
                  <Text style={styles.saveButtonText}>Save Clip</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Preview Mode */}
          {isPreviewMode && (
            <View style={styles.previewSection}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewTitle}>Clip Preview</Text>
                <TouchableOpacity onPress={onExitPreview}>
                  <Text style={styles.exitPreview}>✕</Text>
                </TouchableOpacity>
              </View>
              
              {/* Clip Timeline */}
              <View style={styles.clipTimeline}>
                <TouchableOpacity 
                  style={styles.clipProgressContainer}
                  onPress={handleClipProgressBarPress}
                >
                  <View style={styles.clipProgressBar}>
                    <View 
                      style={[
                        styles.clipProgressFill, 
                        { width: (() => {
                          if (!previewClipStart || !previewClipEnd) return '0%';
                          const clipDuration = previewClipEnd - previewClipStart;
                          const currentInClip = Math.max(0, Math.min(clipDuration, position - previewClipStart));
                          return `${(currentInClip / clipDuration) * 100}%`;
                        })() }
                      ]} 
                    />
                    <View 
                      style={[
                        styles.clipProgressHandle, 
                        { left: (() => {
                          if (!previewClipStart || !previewClipEnd) return '0%';
                          const clipDuration = previewClipEnd - previewClipStart;
                          const currentInClip = Math.max(0, Math.min(clipDuration, position - previewClipStart));
                          return `${(currentInClip / clipDuration) * 100}%`;
                        })() }
                      ]} 
                    />
                  </View>
                </TouchableOpacity>
                
                <View style={styles.clipTimeContainer}>
                  <Text style={styles.clipTimeText}>
                    {previewClipStart !== null ? 
                      formatTime(Math.max(0, position - previewClipStart)) : '0:00'}
                  </Text>
                  <Text style={styles.clipTimeText}>
                    {previewClipStart !== null && previewClipEnd !== null ? 
                      formatTime(previewClipEnd - previewClipStart) : '0:00'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Clip Info */}
          {(clipStart !== null && clipEnd !== null && clipEnd > clipStart) && (
            <Text style={styles.clipInfo}>
              Clip: {formatTime(clipEnd - clipStart)} ({formatTime(clipStart)} - {formatTime(clipEnd)})
            </Text>
          )}

          {/* Episode Notes */}
          <View style={styles.episodeNotes}>
            <Text style={styles.notesTitle}>Episode Notes</Text>
            <Text style={styles.notesText}>
              {selectedEpisode?.description || 'No description available.'}
            </Text>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navigationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#2d2d2d',
    borderRadius: 20,
  },
  backButtonText: {
    color: '#d97706',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  smallLogo: {
    width: 120,
    height: 48,
  },
  episodeHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  episodeArtworkLarge: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#404040',
    marginBottom: 16,
  },
  episodeTitle: {
    color: '#f4f4f4',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#b4b4b4',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 16,
  },
  loadingSubtext: {
    color: '#b4b4b4',
    fontSize: 14,
    marginTop: 4,
  },
  mainTimelineSection: {
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  mainProgressBarContainer: {
    paddingVertical: 20,
    paddingHorizontal: 0,
    marginHorizontal: 0,
  },
  mainProgressBar: {
    height: 8,
    backgroundColor: '#404040',
    borderRadius: 4,
    position: 'relative',
  },
  mainProgressBarActive: {
    height: 10,
    borderRadius: 5,
  },
  mainProgressFill: {
    height: '100%',
    backgroundColor: '#d97706',
    borderRadius: 4,
  },
  mainProgressHandle: {
    position: 'absolute',
    width: 20,
    height: 20,
    backgroundColor: '#d97706',
    borderRadius: 10,
    top: -6,
    marginLeft: -10,
    borderWidth: 3,
    borderColor: '#f4f4f4',
  },
  mainProgressHandleActive: {
    width: 24,
    height: 24,
    borderRadius: 12,
    top: -8,
    marginLeft: -12,
    borderWidth: 3,
  },
  mainClipMarker: {
    position: 'absolute',
    width: 4,
    height: 16,
    backgroundColor: '#ef4444',
    top: -4,
    borderRadius: 2,
  },
  mainTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  mainTimeText: {
    color: '#b4b4b4',
    fontSize: 14,
    fontWeight: '500',
  },
  fineControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    gap: 60,
  },
  circularButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#404040',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#555555',
  },
  skipControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    gap: 30,
  },
  circularButtonLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#404040',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#555555',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#d97706',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e97c0a',
  },
  clipControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 30,
    gap: 12,
  },
  clipButton: {
    backgroundColor: '#404040',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  clipButtonText: {
    color: '#f4f4f4',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  saveButton: {
    backgroundColor: '#d97706',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  saveButtonText: {
    color: '#f4f4f4',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  previewSection: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  previewTitle: {
    color: '#f4f4f4',
    fontSize: 16,
    fontWeight: '600',
  },
  exitPreview: {
    color: '#b4b4b4',
    fontSize: 18,
    fontWeight: 'bold',
  },
  clipTimeline: {
    marginBottom: 20,
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#444444',
  },
  clipProgressContainer: {
    paddingVertical: 20,
    paddingHorizontal: 0,
    marginHorizontal: 0,
  },
  clipProgressBar: {
    height: 8,
    backgroundColor: '#404040',
    borderRadius: 4,
    position: 'relative',
    marginBottom: 10,
  },
  clipProgressFill: {
    height: '100%',
    backgroundColor: '#d97706',
    borderRadius: 4,
  },
  clipProgressHandle: {
    position: 'absolute',
    width: 18,
    height: 18,
    backgroundColor: '#d97706',
    borderRadius: 9,
    top: -5,
    marginLeft: -9,
    borderWidth: 2,
    borderColor: '#f4f4f4',
  },
  clipTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  clipTimeText: {
    color: '#b4b4b4',
    fontSize: 12,
    fontWeight: '500',
  },
  clipInfo: {
    color: '#d97706',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 20,
  },
  episodeNotes: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#404040',
  },
  notesTitle: {
    color: '#f4f4f4',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  notesText: {
    color: '#b4b4b4',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default AudioPlayer;