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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const VideoCreationModal = ({ 
  visible, 
  onClose, 
  clipStart, 
  clipEnd, 
  selectedEpisode, 
  formatTime 
}) => {
  const [selectedFormat, setSelectedFormat] = useState('9:16');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [generatedImageUri, setGeneratedImageUri] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  
  const videoFrameRef = useRef();

  const formats = [
    { id: '9:16', label: 'Vertical', width: 1080, height: 1920 },
    { id: '1:1', label: 'Square', width: 1080, height: 1080 },
  ];

  const handleClose = () => {
    setGeneratedImageUri(null);
    setShowPreview(false);
    setProgress(0);
    setGenerationStep('');
    onClose();
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

  const saveToPhotos = async () => {
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
        'Saved Successfully!', 
        'Your clip frame has been saved to the "Audio2 Clips" album in Photos.',
        [{ text: 'OK', onPress: handleClose }]
      );
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Save Failed', `Error saving to Photos: ${error.message}`);
    }
  };

  const generateWaveformBars = () => {
    const bars = [];
    const barCount = 15;
    for (let i = 0; i < barCount; i++) {
      const height = Math.random() * 30 + 10;
      const isActive = i < (barCount * 0.3);
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

              {/* Generate Button */}
              <View style={styles.actionSection}>
                {!isGenerating ? (
                  <TouchableOpacity 
                    style={styles.generateButton} 
                    onPress={generateVideoFrame}
                  >
                    <MaterialCommunityIcons name="video-plus" size={20} color="#f4f4f4" />
                    <Text style={styles.generateButtonText}>Generate Video Frame</Text>
                  </TouchableOpacity>
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
                  onPress={saveToPhotos}
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
  actionSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  generateButton: {
    backgroundColor: '#d97706',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generateButtonText: {
    color: '#f4f4f4',
    fontSize: 16,
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