import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  Image,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as ScreenRecorder from 'expo-screen-recorder';
import { Audio } from 'expo-av';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const VideoCreationModal = ({ 
  visible, 
  onClose, 
  clipStart, 
  clipEnd, 
  selectedEpisode, 
  formatTime,
  onSeekToPosition,
  onTogglePlayback
}) => {
  const [selectedFormat, setSelectedFormat] = useState('9:16');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [generatedImageUri, setGeneratedImageUri] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showRecordingView, setShowRecordingView] = useState(false);
  const [showWarning, setShowWarning] = useState(true); // User preference for warning
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  
  const videoFrameRef = useRef();
  const recordingViewRef = useRef();

  const formats = [
    { id: '9:16', label: 'Vertical', width: 1080, height: 1920 },
    { id: '1:1', label: 'Square', width: 1080, height: 1080 },
  ];

  const handleClose = () => {
    setGeneratedImageUri(null);
    setShowPreview(false);
    setShowRecordingView(false);
    setProgress(0);
    setGenerationStep('');
    setIsRecording(false);
    setRecordingProgress(0);
    onClose();
  };

  const showRecordingWarning = () => {
    Alert.alert(
      'Create Video Clip',
      'This will record your screen with audio for the clip duration. Please:\n\n• Keep the app open and visible\n• Avoid touching the screen during recording\n• Audio will play at normal volume\n\nThe recording will start automatically and stop when complete.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: "Don't Show Again", 
          onPress: () => {
            setShowWarning(false);
            startVideoRecording();
          }
        },
        { 
          text: 'Start Recording', 
          onPress: startVideoRecording,
          style: 'default'
        }
      ]
    );
  };

  const startVideoRecording = async () => {
    try {
      // Set up audio mode for recording (prevent ducking)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
      });

      // Start screen recording
      await ScreenRecorder.startRecording(false); // false = no microphone
      setIsRecording(true);
      setShowRecordingView(true);
      
      // Seek to clip start and play using existing handlers
      if (onSeekToPosition) {
        await onSeekToPosition(clipStart);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for seek
        if (onTogglePlayback) {
          await onTogglePlayback(); // Start playback
        }
      }

      // Calculate clip duration and set up progress tracking
      const clipDuration = clipEnd - clipStart;
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 100;
        const progress = Math.min((elapsed / clipDuration) * 100, 100);
        setRecordingProgress(progress);
        
        if (elapsed >= clipDuration) {
          clearInterval(interval);
          stopVideoRecording();
        }
      }, 100);

    } catch (error) {
      console.error('Recording start error:', error);
      Alert.alert('Recording Error', `Failed to start recording: ${error.message}`);
      setIsRecording(false);
      setShowRecordingView(false);
    }
  };

  const stopVideoRecording = async () => {
    try {
      // Stop audio playback using existing handler
      if (onTogglePlayback) {
        await onTogglePlayback(); // This will pause if currently playing
      }

      // Stop screen recording
      const outputUrl = await ScreenRecorder.stopRecording();
      setIsRecording(false);
      setShowRecordingView(false);

      // Save to Photos
      if (outputUrl) {
        await saveVideoToPhotos(outputUrl);
      }

    } catch (error) {
      console.error('Recording stop error:', error);
      Alert.alert('Recording Error', `Failed to complete recording: ${error.message}`);
      setIsRecording(false);
      setShowRecordingView(false);
    }
  };

  const saveVideoToPhotos = async (videoUri) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to save to Photos');
        return;
      }

      const asset = await MediaLibrary.createAssetAsync(videoUri);
      
      // Try to get existing album or create new one
      let album = await MediaLibrary.getAlbumAsync('Audio2 Clips');
      if (!album) {
        album = await MediaLibrary.createAlbumAsync('Audio2 Clips', asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }

      Alert.alert(
        'Video Saved! 🎬', 
        'Your podcast clip has been saved to the "Audio2 Clips" album in Photos. Ready to share on social media!',
        [{ text: 'Done', onPress: handleClose }]
      );

    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Save Failed', `Error saving video: ${error.message}`);
    }
  };

  const generateVideoFrame = async () => {
    if (!selectedEpisode || clipStart === null || clipEnd === null) {
      Alert.alert('Error', 'Missing episode or clip information');
      return;
    }

    try {
      setIsGenerating(true);
      setProgress(0);
      
      setGenerationStep('Preparing video frame...');
      setProgress(20);
      await new Promise(resolve => setTimeout(resolve, 500));

      setGenerationStep('Loading podcast artwork...');
      setProgress(40);
      await new Promise(resolve => setTimeout(resolve, 500));

      setGenerationStep('Generating waveform visualization...');
      setProgress(60);
      await new Promise(resolve => setTimeout(resolve, 500));

      setGenerationStep('Composing final frame...');
      setProgress(80);
      await new Promise(resolve => setTimeout(resolve, 500));

      setGenerationStep('Capturing high-resolution image...');
      setProgress(90);
      
      if (videoFrameRef.current) {
        const format = formats.find(f => f.id === selectedFormat);
        const uri = await captureRef(videoFrameRef, {
          format: 'png',
          quality: 1.0,
          width: format.width,
          height: format.height,
        });
        
        setGeneratedImageUri(uri);
        setProgress(100);
        setGenerationStep('Frame generated successfully!');
        
        await new Promise(resolve => setTimeout(resolve, 500));
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Frame generation error:', error);
      Alert.alert('Generation Failed', `Error: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveFrameToPhotos = async () => {
    if (!generatedImageUri) return;

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to save to Photos');
        return;
      }

      const asset = await MediaLibrary.createAssetAsync(generatedImageUri);
      
      // Try to get existing album or create new one
      let album = await MediaLibrary.getAlbumAsync('Audio2 Clips');
      if (!album) {
        album = await MediaLibrary.createAlbumAsync('Audio2 Clips', asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }

      Alert.alert(
        'Frame Saved!', 
        'Your clip frame has been saved to the "Audio2 Clips" album in Photos.',
        [{ text: 'OK', onPress: handleClose }]
      );
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Save Failed', `Error saving to Photos: ${error.message}`);
    }
  };

  const generateWaveformBars = () => {
    // Static waveform values to prevent infinite loops
    const waveformHeights = [15, 25, 20, 35, 22, 30, 18, 28, 16, 24, 26, 14, 32, 19, 29];
    
    const bars = [];
    const barCount = 15;
    for (let i = 0; i < barCount; i++) {
      const height = waveformHeights[i];
      const isActive = isRecording ? i < (barCount * (recordingProgress / 100)) : i < (barCount * 0.3);
      bars.push(
        <View
          key={i}
          style={[
            styles.waveformBar,
            { 
              height,
              backgroundColor: isActive ? '#d97706' : '#666',
              opacity: isActive ? 1 : 0.3,
            }
          ]}
        />
      );
    }
    return bars;
  };

  const renderCleanRecordingView = () => {
    return (
      <View style={styles.fullScreenRecordingView}>
        <StatusBar hidden />
        <LinearGradient
          colors={['#1c1c1c', '#2d2d2d']}
          style={styles.fullScreenBackground}
        >
          <View style={styles.fullScreenContent}>
            <View style={styles.artworkContainer}>
              {selectedEpisode?.artwork ? (
                <Image 
                  source={{ uri: selectedEpisode.artwork }}
                  style={styles.recordingArtwork}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.recordingArtwork, styles.placeholderArtwork]}>
                  <Text style={styles.placeholderText}>Podcast</Text>
                </View>
              )}
            </View>

            <View style={styles.timelineContainer}>
              <View style={styles.timelineBar}>
                <View style={[styles.timelineProgress, { width: `${recordingProgress}%` }]} />
              </View>
              <View style={styles.timeLabels}>
                <Text style={styles.timeLabel}>{formatTime(clipStart || 0)}</Text>
                <Text style={styles.timeLabel}>{formatTime(clipEnd || 0)}</Text>
              </View>
            </View>

            <View style={styles.waveformContainer}>
              {generateWaveformBars()}
            </View>

            <View style={styles.episodeInfoContainer}>
              <Text style={styles.recordingEpisodeTitle} numberOfLines={2}>
                {selectedEpisode?.title || 'Episode Title'}
              </Text>
              <Text style={styles.recordingPodcastName}>
                The Town with Matthew Belloni
              </Text>
            </View>

            {/* Only show minimal recording indicator when actually recording */}
            {isRecording && (
              <View style={styles.recordingMinimalIndicator}>
                <View style={styles.recordingDot} />
              </View>
            )}
          </View>
        </LinearGradient>
      </View>
    );
  };

  const renderVideoFrame = () => {
    const isVertical = selectedFormat === '9:16';
    
    return (
      <View
        ref={videoFrameRef}
        style={[
          styles.videoFrame,
          {
            width: isVertical ? 270 : 270,
            height: isVertical ? 480 : 270,
          }
        ]}
      >
        <LinearGradient
          colors={['#1c1c1c', '#2d2d2d']}
          style={styles.videoBackground}
        >
          <View style={styles.artworkContainer}>
            {selectedEpisode?.artwork ? (
              <Image 
                source={{ uri: selectedEpisode.artwork }}
                style={styles.videoArtwork}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.videoArtwork, styles.placeholderArtwork]}>
                <Text style={styles.placeholderText}>Podcast</Text>
              </View>
            )}
          </View>

          <View style={styles.timelineContainer}>
            <View style={styles.timelineBar}>
              <View style={[styles.timelineProgress, { width: '35%' }]} />
            </View>
            <View style={styles.timeLabels}>
              <Text style={styles.timeLabel}>{formatTime(clipStart || 0)}</Text>
              <Text style={styles.timeLabel}>{formatTime(clipEnd || 0)}</Text>
            </View>
          </View>

          <View style={styles.waveformContainer}>
            {generateWaveformBars()}
          </View>

          <View style={styles.episodeInfoContainer}>
            <Text style={styles.videoEpisodeTitle} numberOfLines={2}>
              {selectedEpisode?.title || 'Episode Title'}
            </Text>
            <Text style={styles.videoPodcastName}>
              The Town with Matthew Belloni
            </Text>
          </View>
        </LinearGradient>
      </View>
    );
  };

  if (!visible) return null;

  // Show full-screen recording view (CLEAN - no controls during recording)
  if (showRecordingView) {
    return renderCleanRecordingView();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <LinearGradient
          colors={['#1c1c1c', '#2d2d2d']}
          style={styles.modalGradient}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#d97706" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Video Clip</Text>
            <View style={{ width: 40 }} />
          </View>

          {!showPreview ? (
            <>
              {/* Format Selection */}
              <View style={styles.formatSection}>
                <Text style={styles.sectionTitle}>Video Format</Text>
                <View style={styles.formatRow}>
                  {formats.map((format) => (
                    <TouchableOpacity
                      key={format.id}
                      style={[
                        styles.formatOptionInline,
                        selectedFormat === format.id && styles.formatOptionSelected
                      ]}
                      onPress={() => setSelectedFormat(format.id)}
                    >
                      <Text style={styles.formatLabel}>{format.label}</Text>
                      <View style={[
                        styles.formatPreview,
                        format.id === '9:16' ? styles.formatVertical : styles.formatSquare
                      ]} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Preview */}
              <View style={styles.previewSection}>
                <Text style={styles.sectionTitle}>Preview</Text>
                <View style={styles.previewContainer}>
                  {renderVideoFrame()}
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionSection}>
                {!isGenerating ? (
                  <View style={styles.buttonRow}>
                    <TouchableOpacity 
                      style={styles.frameButton} 
                      onPress={generateVideoFrame}
                    >
                      <MaterialCommunityIcons name="image" size={18} color="#f4f4f4" />
                      <Text style={styles.frameButtonText}>Save Frame</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.videoButton} 
                      onPress={showWarning ? showRecordingWarning : startVideoRecording}
                    >
                      <MaterialCommunityIcons name="video" size={18} color="#f4f4f4" />
                      <Text style={styles.videoButtonText}>Create Video</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.generatingContainer}>
                    <ActivityIndicator size="large" color="#d97706" />
                    <Text style={styles.generatingText}>{generationStep}</Text>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${progress}%` }]} />
                    </View>
                    <Text style={styles.progressText}>{progress}%</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={styles.previewGeneratedSection}>
              <Text style={styles.sectionTitle}>Generated Frame</Text>
              <View style={styles.generatedPreviewContainer}>
                {generatedImageUri && (
                  <Image 
                    source={{ uri: generatedImageUri }}
                    style={styles.generatedPreview}
                    resizeMode="contain"
                  />
                )}
              </View>
              
              <View style={styles.previewActions}>
                <TouchableOpacity 
                  style={styles.backButton} 
                  onPress={() => setShowPreview(false)}
                >
                  <MaterialCommunityIcons name="arrow-left" size={18} color="#f4f4f4" />
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.saveButton} 
                  onPress={saveFrameToPhotos}
                >
                  <MaterialCommunityIcons name="download" size={18} color="#f4f4f4" />
                  <Text style={styles.saveButtonText}>Save to Photos</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  modalGradient: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2d2d2d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f4f4f4',
  },

  // Full-screen recording view (CLEAN - no recording UI during recording)
  fullScreenRecordingView: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  fullScreenBackground: {
    flex: 1,
  },
  fullScreenContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  recordingArtwork: {
    width: 160,
    height: 160,
    borderRadius: 20,
    marginBottom: 40,
  },
  recordingEpisodeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f4f4f4',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 28,
  },
  recordingPodcastName: {
    fontSize: 18,
    color: '#b4b4b4',
    textAlign: 'center',
  },
  // Minimal recording indicator (optional - can remove if you want completely clean)
  recordingMinimalIndicator: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
  },

  // Format selection
  formatSection: {
    marginHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f4f4f4',
    marginBottom: 8,
  },
  formatRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formatOptionInline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#2d2d2d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#404040',
  },
  formatOptionSelected: {
    borderColor: '#d97706',
  },
  formatLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#f4f4f4',
  },
  formatPreview: {
    backgroundColor: '#404040',
    borderRadius: 4,
  },
  formatVertical: {
    width: 20,
    height: 36,
  },
  formatSquare: {
    width: 28,
    height: 28,
  },

  // Preview section
  previewSection: {
    marginHorizontal: 20,
    marginBottom: 15,
  },
  previewContainer: {
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#2d2d2d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#404040',
  },
  videoFrame: {
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  videoBackground: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  artworkContainer: {
    marginBottom: 20,
  },
  videoArtwork: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  placeholderArtwork: {
    backgroundColor: '#404040',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#b4b4b4',
    fontSize: 12,
  },
  timelineContainer: {
    width: '80%',
    marginBottom: 20,
  },
  timelineBar: {
    height: 4,
    backgroundColor: '#404040',
    borderRadius: 2,
    marginBottom: 8,
  },
  timelineProgress: {
    height: '100%',
    backgroundColor: '#d97706',
    borderRadius: 2,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeLabel: {
    fontSize: 10,
    color: '#b4b4b4',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginBottom: 20,
    height: 40,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  episodeInfoContainer: {
    alignItems: 'center',
  },
  videoEpisodeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f4f4f4',
    textAlign: 'center',
    marginBottom: 4,
  },
  videoPodcastName: {
    fontSize: 12,
    color: '#b4b4b4',
    textAlign: 'center',
  },

  // Action buttons
  actionSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  frameButton: {
    flex: 1,
    backgroundColor: '#404040',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  frameButtonText: {
    color: '#f4f4f4',
    fontSize: 14,
    fontWeight: '600',
  },
  videoButton: {
    flex: 1,
    backgroundColor: '#d97706',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoButtonText: {
    color: '#f4f4f4',
    fontSize: 14,
    fontWeight: '600',
  },
  generatingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  generatingText: {
    color: '#f4f4f4',
    fontSize: 14,
    marginTop: 16,
    marginBottom: 12,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#404040',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#d97706',
    borderRadius: 2,
  },
  progressText: {
    color: '#b4b4b4',
    fontSize: 12,
  },

  // Generated preview section
  previewGeneratedSection: {
    flex: 1,
    paddingHorizontal: 20,
  },
  generatedPreviewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2d2d2d',
    borderRadius: 12,
    marginBottom: 20,
  },
  generatedPreview: {
    width: '90%',
    height: '90%',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 40,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#404040',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  backButtonText: {
    color: '#f4f4f4',
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#d97706',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonText: {
    color: '#f4f4f4',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default VideoCreationModal;