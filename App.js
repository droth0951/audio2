import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  StatusBar,
  Image
} from 'react-native';
import { Audio } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, MaterialIcons, Entypo } from '@expo/vector-icons';

// Hardcoded The Town RSS feed for Stage 1
const THE_TOWN_RSS = 'https://feeds.megaphone.fm/the-town-with-matthew-belloni';

export default function App() {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [clipStart, setClipStart] = useState(null);
  const [clipEnd, setClipEnd] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewClipStart, setPreviewClipStart] = useState(null);
  const [previewClipEnd, setPreviewClipEnd] = useState(null);


  useEffect(() => {
    loadTheTownFeed();
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  const loadTheTownFeed = async () => {
    setLoading(true);
    try {
      const response = await fetch(THE_TOWN_RSS);
      const xmlText = await response.text();
      const episodes = parseRSSFeed(xmlText);
      setEpisodes(episodes.slice(0, 10)); // Show latest 10 episodes
    } catch (error) {
      Alert.alert('Error', 'Failed to load podcast feed');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const parseRSSFeed = (xmlText) => {
    // Simple RSS parsing - in production, use a proper XML parser
    const episodes = [];
    const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/g);
    
    // Extract podcast artwork from channel level
    const channelImageMatch = xmlText.match(/<image[^>]*>[\s\S]*?<url>(.*?)<\/url>[\s\S]*?<\/image>/) ||
                             xmlText.match(/<itunes:image[^>]*href="([^"]*)"[^>]*\/?>/) ||
                             xmlText.match(/<image[^>]*href="([^"]*)"[^>]*\/?>/);
    const podcastArtwork = channelImageMatch?.[1] || null;
    
    if (itemMatches) {
      itemMatches.forEach((item, index) => {
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || 
                     item.match(/<title>(.*?)<\/title>/)?.[1] || 
                     `Episode ${index + 1}`;
        const audioUrl = item.match(/<enclosure[^>]*url="([^"]*)"[^>]*\/>/)?.[1];
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1];
        
        // Enhanced description parsing - try multiple formats
        let description = 
          // Try CDATA wrapped description first
          item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ||
          // Try regular description
          item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ||
          // Try iTunes summary with CDATA
          item.match(/<itunes:summary><!\[CDATA\[([\s\S]*?)\]\]><\/itunes:summary>/)?.[1] ||
          // Try regular iTunes summary
          item.match(/<itunes:summary>([\s\S]*?)<\/itunes:summary>/)?.[1] ||
          // Try iTunes subtitle
          item.match(/<itunes:subtitle><!\[CDATA\[(.*?)\]\]><\/itunes:subtitle>/)?.[1] ||
          item.match(/<itunes:subtitle>(.*?)<\/itunes:subtitle>/)?.[1] ||
          // Try content:encoded
          item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)?.[1] ||
          item.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/)?.[1] ||
          'No description available.';
        
        // Clean up HTML tags and entities
        if (description && description !== 'No description available.') {
          description = description
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
            .replace(/&amp;/g, '&') // Replace HTML entities
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim();
        }
        
        // Try to get episode-specific artwork, fall back to podcast artwork
        const episodeImageMatch = item.match(/<itunes:image[^>]*href="([^"]*)"[^>]*\/?>/) ||
                                 item.match(/<image[^>]*href="([^"]*)"[^>]*\/?>/);
        const episodeArtwork = episodeImageMatch?.[1] || podcastArtwork;
        
        if (audioUrl) {
          episodes.push({
            id: index,
            title: title.trim(),
            audioUrl,
            pubDate,
            artwork: episodeArtwork,
            description: description || 'No description available.',
            duration: '00:00' // We'll get actual duration when loading
          });
        }
      });
    }
    
    return episodes;
  };

  const parseApplePodcastsUrl = (url) => {
    // Extract podcast ID from Apple Podcasts URL
    // This is a simplified version - in production, use iTunes API
    Alert.alert('Feature Coming Soon', 'Apple Podcasts URL parsing will be added in next update. Using The Town feed for now.');
    return THE_TOWN_RSS;
  };

  const handleUrlSubmit = () => {
    if (urlInput.includes('podcasts.apple.com')) {
      parseApplePodcastsUrl(urlInput);
    } else {
      // Assume it's an RSS feed
      Alert.alert('Feature Coming Soon', 'Custom RSS feeds coming in next update');
    }
    setUrlInput('');
  };

  const playEpisode = async (episode) => {
    try {
      setIsLoading(true);
      
      if (sound) {
        await sound.unloadAsync();
      }
      
      // Set up audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
      console.log('Loading episode:', episode.title);
      console.log('Audio URL:', episode.audioUrl);
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: episode.audioUrl },
        { shouldPlay: false }
      );
      
      setSound(newSound);
      setSelectedEpisode(episode);
      setIsLoading(false);
      
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPosition(status.positionMillis || 0);
          setDuration(status.durationMillis || 0);
          setIsPlaying(status.isPlaying || false);
        }
      });
      
    } catch (error) {
      setIsLoading(false);
      Alert.alert('Error', `Failed to load episode: ${error.message}`);
      console.error('Episode loading error:', error);
    }
  };

  const togglePlayback = async () => {
    if (sound) {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    }
  };

  const seekToPosition = async (positionMillis) => {
    if (sound) {
      await sound.setPositionAsync(positionMillis);
    }
  };

  const skipBackward = async () => {
    if (sound) {
      const newPosition = Math.max(0, position - 15000); // 15 seconds back
      await sound.setPositionAsync(newPosition);
    }
  };

  const skipForward = async () => {
    if (sound && duration) {
      const newPosition = Math.min(duration, position + 15000); // 15 seconds forward
      await sound.setPositionAsync(newPosition);
    }
  };

  const skip5Backward = async () => {
    if (sound) {
      const newPosition = Math.max(0, position - 5000); // 5 seconds back
      await sound.setPositionAsync(newPosition);
    }
  };

  const skip5Forward = async () => {
    if (sound && duration) {
      const newPosition = Math.min(duration, position + 5000); // 5 seconds forward
      await sound.setPositionAsync(newPosition);
    }
  };

  const setClipPoint = () => {
    if (!selectedEpisode || !sound) {
      Alert.alert('No Episode', 'Please select and load an episode first');
      return;
    }
    
    if (!clipStart) {
      setClipStart(position);
      Alert.alert('Clip Start Set', `Start: ${formatTime(position)}`);
    } else if (!clipEnd) {
      const clipLength = position - clipStart;
      if (clipLength > 90000) { // 90 seconds
        Alert.alert('Clip Too Long', 'Clips must be 90 seconds or less');
        return;
      }
      if (clipLength < 1000) { // 1 second minimum
        Alert.alert('Clip Too Short', 'Clips must be at least 1 second long');
        return;
      }
      setClipEnd(position);
      Alert.alert('Clip End Set', `Clip: ${formatTime(clipStart)} - ${formatTime(position)}`);
    } else {
      // Reset and start new clip
      setClipStart(position);
      setClipEnd(null);
      Alert.alert('New Clip Started', `Start: ${formatTime(position)}`);
    }
  };

  const playClip = async () => {
    if (sound && clipStart && clipEnd) {
      console.log('Starting preview mode', { clipStart, clipEnd });
      
      // Enter preview mode
      setIsPreviewMode(true);
      setPreviewClipStart(clipStart);
      setPreviewClipEnd(clipEnd);
      
      await sound.setPositionAsync(clipStart);
      await sound.playAsync();
      
      // Stop at clip end (simplified - in production, use proper timer)
      setTimeout(async () => {
        if (sound) {
          await sound.pauseAsync();
        }
      }, clipEnd - clipStart);
    }
  };

  const exitPreview = () => {
    console.log('Exiting preview mode');
    setIsPreviewMode(false);
    setPreviewClipStart(null);
    setPreviewClipEnd(null);
  };

  const updatePreviewClip = (start, end) => {
    console.log('Updating preview clip', { start, end });
    setPreviewClipStart(start);
    setPreviewClipEnd(end);
    // Also update the main clip points
    setClipStart(start);
    setClipEnd(end);
  };

  const trimClipStart = () => {
    if (previewClipStart !== null && previewClipEnd !== null && position > previewClipStart && position < previewClipEnd) {
      const newStart = position;
      updatePreviewClip(newStart, previewClipEnd);
      Alert.alert('Trimmed Start', `New start: ${formatTime(newStart)}`);
    } else {
      Alert.alert('Cannot Trim', 'Position must be within the clip bounds');
    }
  };

  const trimClipEnd = () => {
    if (previewClipStart !== null && previewClipEnd !== null && position > previewClipStart && position < previewClipEnd) {
      const newEnd = position;
      updatePreviewClip(previewClipStart, newEnd);
      Alert.alert('Trimmed End', `New end: ${formatTime(newEnd)}`);
    } else {
      Alert.alert('Cannot Trim', 'Position must be within the clip bounds');
    }
  };

  const nudgeClipStart = (direction) => {
    if (previewClipStart !== null && previewClipEnd !== null) {
      const adjustment = direction === 'forward' ? 1000 : -1000; // 1 second
      const newStart = Math.max(0, Math.min(previewClipStart + adjustment, previewClipEnd - 1000));
      updatePreviewClip(newStart, previewClipEnd);
    }
  };

  const nudgeClipEnd = (direction) => {
    if (previewClipStart !== null && previewClipEnd !== null) {
      const adjustment = direction === 'forward' ? 1000 : -1000; // 1 second
      const newEnd = Math.max(previewClipStart + 1000, Math.min(previewClipEnd + adjustment, duration));
      updatePreviewClip(previewClipStart, newEnd);
    }
  };

  const saveClip = async () => {
    if (!clipStart || !clipEnd) {
      Alert.alert('No Clip Selected', 'Please select start and end points first');
      return;
    }
    
    // For Stage 1, just show success message
    // In Stage 2, we'll implement actual audio extraction
    Alert.alert('Success', 'Clip saved! (Full implementation coming in Stage 2)');
  };

  const formatTime = (millis) => {
    const minutes = Math.floor(millis / 60000);
    const seconds = Math.floor((millis % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#1c1c1c', '#2d2d2d']}
        style={styles.gradient}
      >
        <ScrollView style={styles.scrollView}>
          {/* Header */}
          <View style={styles.header}>
            <Image 
              source={require('./assets/logo1.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.subtitle}>Create social clips from podcasts</Text>
          </View>

          {/* URL Input - Only show on main menu */}
          {!selectedEpisode && (
            <View style={styles.inputSection}>
              <TextInput
                style={styles.input}
                placeholder="Paste Apple Podcasts URL or RSS feed"
                placeholderTextColor="#888"
                value={urlInput}
                onChangeText={setUrlInput}
                onSubmitEditing={handleUrlSubmit}
              />
              <TouchableOpacity style={styles.submitButton} onPress={handleUrlSubmit}>
                <Text style={styles.submitButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Current Feed Info - Only show on main menu */}
          {!selectedEpisode && (
            <View style={styles.feedInfo}>
              <Text style={styles.feedTitle}>The Town with Matthew Belloni</Text>
              <Text style={styles.feedSubtitle}>Latest Episodes</Text>
            </View>
          )}

          {/* Episodes List - Only show if no episode is selected */}
          {!selectedEpisode && (
            <>
              {loading ? (
                <Text style={styles.loadingText}>Loading episodes...</Text>
              ) : (
                episodes.map((episode) => (
                  <TouchableOpacity
                    key={episode.id}
                    style={styles.episodeItem}
                    onPress={() => playEpisode(episode)}
                  >
                    {episode.artwork && (
                      <Image 
                        source={{ uri: episode.artwork }} 
                        style={styles.episodeArtwork}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.episodeInfo}>
                      <Text style={styles.episodeTitle} numberOfLines={2}>
                        {episode.title}
                      </Text>
                      <Text style={styles.episodeDate}>
                        {episode.pubDate ? new Date(episode.pubDate).toLocaleDateString() : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </>
          )}

          {/* Audio Player - Show when episode is selected */}
          {selectedEpisode && (
            <View style={styles.episodeDetailContainer}>
              {/* Back Button */}
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => {
                  setSelectedEpisode(null);
                  setClipStart(null);
                  setClipEnd(null);
                  if (sound) {
                    sound.unloadAsync();
                    setSound(null);
                  }
                }}
              >
                <Text style={styles.backButtonText}>← Back to Episodes</Text>
              </TouchableOpacity>

              {/* Episode Header */}
              <View style={styles.episodeHeader}>
                {selectedEpisode.artwork && (
                  <Image 
                    source={{ uri: selectedEpisode.artwork }} 
                    style={styles.episodeArtwork}
                    resizeMode="cover"
                  />
                )}
                <Text style={styles.episodeTitle} numberOfLines={3}>
                  {selectedEpisode.title}
                </Text>
              </View>

              {/* Loading State */}
              {isLoading && (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading episode...</Text>
                  <Text style={styles.loadingSubtext}>Preparing audio playback</Text>
                </View>
              )}

              {/* Player Controls - Show when loaded */}
              {!isLoading && (
                <>
                  {/* Progress Bar */}
                  <View style={styles.progressSection}>
                    <TouchableOpacity 
                      style={styles.progressBarContainer}
                      onPressIn={() => setIsScrubbing(true)}
                      onPressOut={() => setIsScrubbing(false)}
                      onPress={(e) => {
                        if (duration > 0) {
                          const { locationX } = e.nativeEvent;
                          const containerWidth = 320;
                          const seekPosition = (locationX / containerWidth) * duration;
                          seekToPosition(Math.max(0, Math.min(seekPosition, duration)));
                        }
                      }}
                    >
                      <View style={[styles.progressBar, isScrubbing && styles.progressBarActive]}>
                        <View 
                          style={[
                            styles.progressFill, 
                            { width: `${duration ? (position / duration) * 100 : 0}%` }
                          ]} 
                        />
                        {/* Progress Handle */}
                        <View 
                          style={[
                            styles.progressHandle, 
                            { left: `${duration ? (position / duration) * 100 : 0}%` },
                            isScrubbing && styles.progressHandleActive
                          ]} 
                        />
                        {/* Clip Markers */}
                        {clipStart && duration && (
                          <View 
                            style={[
                              styles.clipMarker, 
                              { left: `${(clipStart / duration) * 100}%` }
                            ]} 
                          />
                        )}
                        {clipEnd && duration && (
                          <View 
                            style={[
                              styles.clipMarker, 
                              { left: `${(clipEnd / duration) * 100}%` }
                            ]} 
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                    
                    {/* Time Display Below Progress Bar */}
                    <View style={styles.timeContainer}>
                      <Text style={styles.timeText}>{formatTime(position)}</Text>
                      <Text style={styles.timeText}>{formatTime(duration)}</Text>
                    </View>
                  </View>

                  {/* Fine Skip Controls */}
                  <View style={styles.fineControls}>
                    <TouchableOpacity style={styles.circularButton} onPress={skip5Backward}>
                      <MaterialCommunityIcons name="rewind-5" size={24} color="#f4f4f4" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.circularButton} onPress={skip5Forward}>
                      <MaterialCommunityIcons name="fast-forward-5" size={24} color="#f4f4f4" />
                    </TouchableOpacity>
                  </View>

                  {/* Main Skip Controls */}
                  <View style={styles.skipControls}>
                    <TouchableOpacity style={styles.circularButtonLarge} onPress={skipBackward}>
                      <MaterialCommunityIcons name="rewind-15" size={36} color="#f4f4f4" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.playButton} onPress={togglePlayback}>
                      <MaterialCommunityIcons 
                        name={isPlaying ? "pause" : "play"} 
                        size={40} 
                        color="#f4f4f4" 
                      />
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.circularButtonLarge} onPress={skipForward}>
                      <MaterialCommunityIcons name="fast-forward-15" size={36} color="#f4f4f4" />
                    </TouchableOpacity>
                  </View>

                  {/* Clip Controls */}
                  <View style={styles.clipControls}>
                    <TouchableOpacity style={styles.clipButton} onPress={setClipPoint}>
                      <MaterialCommunityIcons name="content-cut" size={16} color="#f4f4f4" />
                      <Text style={styles.clipButtonText}>
                        {!clipStart ? 'Start' : !clipEnd ? 'End' : 'New'}
                      </Text>
                    </TouchableOpacity>
                    
                    {clipStart && clipEnd && (
                      <>
                        <TouchableOpacity style={styles.clipButton} onPress={playClip}>
                          <MaterialCommunityIcons name="play-outline" size={16} color="#f4f4f4" />
                          <Text style={styles.clipButtonText}>Preview</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.saveButton} onPress={saveClip}>
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
                        <TouchableOpacity onPress={exitPreview}>
                          <Text style={styles.exitPreview}>✕</Text>
                        </TouchableOpacity>
                      </View>
                      
                      {/* Clip Timeline */}
                      <View style={styles.clipTimeline}>
                        <TouchableOpacity 
                          style={styles.clipProgressContainer}
                          onPress={(e) => {
                            if (previewClipStart !== null && previewClipEnd !== null) {
                              const { locationX } = e.nativeEvent;
                              const containerWidth = 320;
                              const clipDuration = previewClipEnd - previewClipStart;
                              const relativePosition = (locationX / containerWidth) * clipDuration;
                              const absolutePosition = previewClipStart + relativePosition;
                              seekToPosition(absolutePosition);
                            }
                          }}
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
                  {(clipStart !== null && clipEnd !== null) && (
                    <Text style={styles.clipInfo}>
                      Clip: {formatTime(clipEnd - clipStart)} ({formatTime(clipStart)} - {formatTime(clipEnd)})
                    </Text>
                  )}

                  {/* Episode Notes */}
                  <View style={styles.episodeNotes}>
                    <Text style={styles.notesTitle}>Episode Notes</Text>
                    <Text style={styles.notesText}>
                      {selectedEpisode.description}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  logo: {
    width: 339,
    height: 135,
    marginBottom: 0,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f4f4f4',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#b4b4b4',
    textAlign: 'center',
  },
  inputSection: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  input: {
    flex: 1,
    backgroundColor: '#2d2d2d',
    color: '#f4f4f4',
    padding: 15,
    borderRadius: 12,
    marginRight: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#404040',
  },
  submitButton: {
    backgroundColor: '#d97706',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#f4f4f4',
    fontWeight: '600',
  },
  feedInfo: {
    marginBottom: 20,
  },
  feedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f4f4f4',
    marginBottom: 4,
  },
  feedSubtitle: {
    fontSize: 14,
    color: '#b4b4b4',
  },
  loadingText: {
    color: '#b4b4b4',
    textAlign: 'center',
    marginTop: 40,
  },
  episodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  episodeArtwork: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
    backgroundColor: '#404040',
  },
  episodeInfo: {
    flex: 1,
  },
  episodeDetailContainer: {
    flex: 1,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 30,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#d97706',
    fontSize: 16,
    fontWeight: '500',
  },
  episodeHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  episodeTitle: {
    color: '#f4f4f4',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 26,
    marginTop: 16,
  },
  episodeDate: {
    color: '#b4b4b4',
    fontSize: 12,
    marginTop: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingSubtext: {
    color: '#b4b4b4',
    fontSize: 14,
  },
  progressSection: {
    marginBottom: 20,
  },
  progressBarContainer: {
    paddingVertical: 20,
    paddingHorizontal: 0,
    marginHorizontal: 0,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#404040',
    borderRadius: 3,
    position: 'relative',
  },
  progressBarActive: {
    height: 8,
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#d97706',
    borderRadius: 3,
  },
  progressHandle: {
    position: 'absolute',
    width: 16,
    height: 16,
    backgroundColor: '#d97706',
    borderRadius: 8,
    top: -5,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: '#f4f4f4',
  },
  progressHandleActive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    top: -8,
    marginLeft: -11,
    borderWidth: 3,
  },
  clipMarker: {
    position: 'absolute',
    width: 3,
    height: 14,
    backgroundColor: '#ef4444',
    top: -4,
    borderRadius: 1.5,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  timeText: {
    color: '#b4b4b4',
    fontSize: 12,
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