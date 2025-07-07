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
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ScreenRecorder from 'expo-screen-recorder';
import * as MediaLibrary from 'expo-media-library';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Hardcoded The Town RSS feed
const THE_TOWN_RSS = 'https://feeds.megaphone.fm/the-town-with-matthew-belloni';

export default function App() {
  // Main app state
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  
  // Audio player state
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Clip selection state
  const [clipStart, setClipStart] = useState(null);
  const [clipEnd, setClipEnd] = useState(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  // Video recording state
  const [isRecording, setIsRecording] = useState(false);
  const [showRecordingView, setShowRecordingView] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('');
  
  // URL input state
  const [urlInput, setUrlInput] = useState('');

  const [currentRssFeed, setCurrentRssFeed] = useState(THE_TOWN_RSS);

  // NOW define loadPodcastFeed INSIDE the component where it can access state:
  const loadPodcastFeed = async (feedUrl) => {
    console.log('🎙️ loadPodcastFeed called with:', feedUrl);
    setLoading(true);
    
    try {
      console.log('📡 Starting fetch...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(feedUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        }
      }).catch(err => {
        console.error('🔥 Fetch error:', err);
        throw err;
      });
      
      clearTimeout(timeoutId);
      
      console.log('📡 Response received! Status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log('📄 Getting text...');
      const xmlText = await response.text();
      console.log('📄 XML length:', xmlText.length);
      console.log('📄 First 200 chars:', xmlText.substring(0, 200));
      
      console.log('🔧 Calling parseRSSFeed...');
      const episodes = parseRSSFeed(xmlText);
      console.log('🎧 Parsed episodes:', episodes.length);
      
      if (episodes.length === 0) {
        throw new Error('No episodes found in feed');
      }
      
      console.log('💾 Setting episodes...');
      setEpisodes(episodes.slice(0, 10));
      setCurrentRssFeed(feedUrl);
      console.log('✅ Feed loaded successfully!');
      
      Alert.alert('Success', `Loaded ${episodes.length} episodes`);
      
    } catch (error) {
      console.error('❌ loadPodcastFeed error:', error);
      console.error('❌ Error type:', error.name);
      console.error('❌ Error message:', error.message);
      
      let errorMessage = 'Failed to load podcast feed';
      
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out - please try again';
      } else if (error.message.includes('Network request failed')) {
        errorMessage = 'Network error - check your internet connection';
      } else if (error.message.includes('HTTP')) {
        errorMessage = error.message;
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      
      Alert.alert('Feed Error', errorMessage);
    } finally {
      console.log('🏁 Setting loading to false');
      setLoading(false);
    }
  };

  // THEN your useEffect:
  useEffect(() => {
    loadPodcastFeed(currentRssFeed);
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, []); // Empty deps on initial load only

  // RSS parsing and episode loading
  const parseRSSFeed = (xmlText) => {
    console.log('🔍 parseRSSFeed called with XML length:', xmlText.length);
    
    try {
      const episodes = [];
      const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/g);
      
      console.log('🔍 Found items:', itemMatches ? itemMatches.length : 0);
      
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
          
          let description = 
            item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ||
            item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ||
            'No description available.';
          
          if (description && description !== 'No description available.') {
            description = description
              .replace(/<[^>]*>/g, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/\s+/g, ' ')
              .trim();
          }
          
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
            });
          }
        });
      }
      
      console.log('🔍 parseRSSFeed returning:', episodes.length, 'episodes');
      return episodes;
    } catch (error) {
      console.error('❌ parseRSSFeed error:', error);
      return []; // Return empty array instead of crashing
    }
  };

  // Audio player functions
  const playEpisode = async (episode) => {
    try {
      setIsLoading(true);
      
      if (sound) {
        await sound.unloadAsync();
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
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
    }
  };

  // Audio control handlers
  const handleBack = () => {
    setSelectedEpisode(null);
    setClipStart(null);
    setClipEnd(null);
    setIsPreviewMode(false);
    if (sound) {
      sound.unloadAsync();
      setSound(null);
    }
  };

  const handleTogglePlayback = async () => {
    if (sound) {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    }
  };

  const handleSeekToPosition = async (positionMillis) => {
    if (sound) {
      await sound.setPositionAsync(positionMillis);
    }
  };

  const handleSkipBackward = async () => {
    if (sound) {
      const newPosition = Math.max(0, position - 15000);
      await sound.setPositionAsync(newPosition);
    }
  };

  const handleSkipForward = async () => {
    if (sound && duration) {
      const newPosition = Math.min(duration, position + 15000);
      await sound.setPositionAsync(newPosition);
    }
  };

  const handleSkip5Backward = async () => {
    if (sound) {
      const newPosition = Math.max(0, position - 5000);
      await sound.setPositionAsync(newPosition);
    }
  };

  const handleSkip5Forward = async () => {
    if (sound && duration) {
      const newPosition = Math.min(duration, position + 5000);
      await sound.setPositionAsync(newPosition);
    }
  };

  const handleSetClipPoint = () => {
    if (!selectedEpisode || !sound) {
      Alert.alert('No Episode', 'Please select and load an episode first');
      return;
    }
    
    if (!clipStart) {
      setClipStart(position);
      Alert.alert('Clip Start Set', `Start: ${formatTime(position)}`);
    } else if (!clipEnd) {
      const clipLength = position - clipStart;
      if (clipLength > 240000) { // 4 minutes = 240,000 milliseconds
        Alert.alert('Clip Too Long', 'Clips must be 4 minutes or less');
        return;
      }
      if (clipLength < 1000) {
        Alert.alert('Clip Too Short', 'Clips must be at least 1 second long');
        return;
      }
      setClipEnd(position);
      Alert.alert('Clip End Set', `Clip: ${formatTime(clipStart)} - ${formatTime(position)}`);
    } else {
      setClipStart(position);
      setClipEnd(null);
      Alert.alert('New Clip Started', `Start: ${formatTime(position)}`);
    }
  };

  const handlePlayClip = async () => {
    if (sound && clipStart && clipEnd) {
      setIsPreviewMode(true);
      await sound.setPositionAsync(clipStart);
      await sound.playAsync();
      
      setTimeout(async () => {
        if (sound) {
          await sound.pauseAsync();
        }
      }, clipEnd - clipStart);
    }
  };

  // Video recording functions
  const handleCreateVideo = async () => {
    if (!clipStart || !clipEnd) {
      Alert.alert('No Clip Selected', 'Please select start and end points first');
      return;
    }
    
    if (!selectedEpisode) {
      Alert.alert('No Episode', 'Please select an episode first');
      return;
    }
    
    setShowRecordingView(true);
  };

  const startVideoRecording = async () => {
    try {
      setRecordingStatus('Requesting permissions...');
      
      // Request Photos permission
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photos access is needed to save videos');
        return;
      }

      setRecordingStatus('Setting up audio...');
      
      // Set audio mode for recording (this prevents ducking) - PROVEN WORKING CONFIG
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
      });

      setRecordingStatus('Starting recording...');
      
      // Start screen recording with microphone disabled (we want app audio only)
      const micEnabled = false;
      await ScreenRecorder.startRecording(micEnabled);
      
      setIsRecording(true);
      setRecordingStatus('Recording in progress...');
      
      // Seek to clip start and play
      await sound.setPositionAsync(clipStart);
      await sound.playAsync();
      
      // Stop recording after clip duration
      const clipDuration = clipEnd - clipStart;
      setTimeout(async () => {
        await stopVideoRecording();
      }, clipDuration);
      
    } catch (error) {
      console.error('Recording error:', error);
      setRecordingStatus(`Error: ${error.message}`);
      setIsRecording(false);
      
      // Show helpful error message
      Alert.alert(
        'Recording Error',
        `Could not start screen recording: ${error.message}`,
        [{ text: 'OK', onPress: () => setShowRecordingView(false) }]
      );
    }
  };

  const stopVideoRecording = async () => {
    try {
      setRecordingStatus('Stopping recording...');
      
      // Pause audio
      if (sound && isPlaying) {
        await sound.pauseAsync();
      }
      
      // Stop recording and get the URI
      const outputUrl = await ScreenRecorder.stopRecording();
      
      setRecordingStatus('Saving to Photos...');
      
      // Save to Photos app
      if (outputUrl) {
        await MediaLibrary.saveToLibraryAsync(outputUrl);
        setRecordingStatus('Video saved to Photos!');
        
        Alert.alert(
          'Video Created!',
          'Your podcast clip has been saved to Photos. You can now share it on social media.',
          [
            { text: 'OK', onPress: () => {
              setShowRecordingView(false);
              setRecordingStatus('');
            }}
          ]
        );
      } else {
        setRecordingStatus('Failed to save recording');
      }
      
    } catch (error) {
      console.error('Stop recording error:', error);
      setRecordingStatus(`Error: ${error.message}`);
    } finally {
      setIsRecording(false);
    }
  };

  // URL input handler
  const handleUrlSubmit = () => {
    console.log('🔴 handleUrlSubmit called! urlInput:', urlInput);
    
    const trimmedUrl = urlInput.trim();
    
    if (!trimmedUrl) {
      console.log('❌ Empty URL');
      Alert.alert('Error', 'Please enter a podcast RSS feed URL');
      return;
    }
    
    console.log('📍 Trimmed URL:', trimmedUrl);
    
    // Basic URL validation
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      console.log('❌ URL missing protocol');
      Alert.alert('Error', 'URL must start with http:// or https://');
      return;
    }
    
    // Apple Podcasts message
    if (trimmedUrl.includes('podcasts.apple.com')) {
      console.log('🍎 Apple Podcasts URL detected');
      Alert.alert('Feature Coming Soon', 'Apple Podcasts URL parsing will be added in next update. Using The Town feed for now.');
      setUrlInput('');
      return;
    }
    
    console.log('✅ About to call loadPodcastFeed with:', trimmedUrl);
    
    // Load the new feed!
    loadPodcastFeed(trimmedUrl);
    setUrlInput('');
  };

  // Utility functions
  const formatTime = (millis) => {
    const minutes = Math.floor(millis / 60000);
    const seconds = Math.floor((millis % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProgressBarPress = (e) => {
    if (duration > 0) {
      const { locationX } = e.nativeEvent;
      const containerWidth = screenWidth - 40;
      const seekPosition = (locationX / containerWidth) * duration;
      handleSeekToPosition(Math.max(0, Math.min(seekPosition, duration)));
    }
  };

  // Recording view component
  const RecordingView = () => (
    <View style={styles.recordingContainer}>
      <StatusBar hidden />
      
      {/* Full-screen wireframe design */}
      <LinearGradient
        colors={['#1c1c1c', '#2d2d2d']}
        style={styles.recordingBackground}
      >
        {/* Episode artwork */}
        {selectedEpisode?.artwork && (
          <Image 
            source={{ uri: selectedEpisode.artwork }} 
            style={styles.recordingArtwork}
            resizeMode="cover"
          />
        )}
        
        {/* Progress timeline */}
        <View style={styles.recordingTimelineContainer}>
          <View style={styles.recordingTimeline}>
            <View 
              style={[
                styles.recordingTimelineFill, 
                { width: `${duration ? ((position - clipStart) / (clipEnd - clipStart)) * 100 : 0}%` }
              ]} 
            />
          </View>
          <View style={styles.recordingTimeLabels}>
            <Text style={styles.recordingTimeText}>{formatTime(Math.max(0, position - clipStart))}</Text>
            <Text style={styles.recordingTimeText}>{formatTime(clipEnd - clipStart)}</Text>
          </View>
        </View>
        
        {/* Animated waveform */}
        <View style={styles.recordingWaveform}>
          {[...Array(15)].map((_, i) => (
            <View 
              key={i}
              style={[
                styles.recordingWaveformBar,
                { 
                  height: Math.random() * 40 + 10,
                  opacity: isPlaying ? 0.8 + Math.random() * 0.2 : 0.3
                }
              ]} 
            />
          ))}
        </View>
        
        {/* Episode info */}
        <View style={styles.recordingEpisodeInfo}>
          <Text style={styles.recordingEpisodeTitle} numberOfLines={2}>
            {selectedEpisode?.title}
          </Text>
          <Text style={styles.recordingPodcastName}>
            The Town with Matthew Belloni
          </Text>
        </View>
        
        {/* Recording status overlay */}
        {isRecording && (
          <View style={styles.recordingStatusOverlay}>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording</Text>
            </View>
          </View>
        )}
        
        {/* Control buttons */}
        <View style={styles.recordingControls}>
          {!isRecording ? (
            <>
              <TouchableOpacity 
                style={styles.recordingButton}
                onPress={startVideoRecording}
              >
                <MaterialCommunityIcons name="record" size={24} color="#f4f4f4" />
                <Text style={styles.recordingButtonText}>Start Recording</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowRecordingView(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity 
              style={styles.stopButton}
              onPress={stopVideoRecording}
            >
              <MaterialCommunityIcons name="stop" size={24} color="#f4f4f4" />
              <Text style={styles.stopButtonText}>Stop Recording</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Status text */}
        {recordingStatus ? (
          <Text style={styles.recordingStatusText}>{recordingStatus}</Text>
        ) : null}
      </LinearGradient>
    </View>
  );

  // Show recording view when active
  if (showRecordingView) {
    return <RecordingView />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#1c1c1c', '#2d2d2d']}
        style={styles.gradient}
      >
        <ScrollView style={styles.scrollView}>
          {/* Show Episode List when no episode is selected */}
          {!selectedEpisode && (
            <>
              {/* Header */}
              <View style={styles.header}>
                <Image 
                  source={require('./assets/logo1.png')} 
                  style={styles.logo}
                  resizeMode="contain"
                />
                <Text style={styles.subtitle}>Create social clips from podcasts</Text>
              </View>

              {/* URL Input */}
              <View style={styles.inputSection}>
                <TextInput
                  style={styles.input}
                  placeholder="Paste Apple Podcasts URL or RSS feed"
                  placeholderTextColor="#888"
                  value={urlInput}
                  onChangeText={(text) => {
                    console.log('📝 Input changed:', text);
                    setUrlInput(text);
                  }}
                  onSubmitEditing={() => {
                    console.log('⏎ Submit editing triggered');
                    handleUrlSubmit();
                  }}
                />
                <TouchableOpacity 
                  style={styles.submitButton} 
                  onPress={() => {
                    console.log('🔵 Add button pressed!');
                    handleUrlSubmit();
                  }}
                >
                  <Text style={styles.submitButtonText}>Add</Text>
                </TouchableOpacity>
              </View>

              {/* Current Feed Info */}
              <View style={styles.feedInfo}>
                <Text style={styles.feedTitle}>The Town with Matthew Belloni</Text>
                <Text style={styles.feedSubtitle}>Latest Episodes</Text>
              </View>

              {/* Episodes List */}
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

          {/* Show Audio Player when episode is selected */}
          {selectedEpisode && (
            <>
              {/* Navigation Header */}
              <View style={styles.navigationHeader}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                  <MaterialCommunityIcons name="arrow-left" size={20} color="#d97706" />
                  <Text style={styles.backButtonText}>Episodes</Text>
                </TouchableOpacity>

                <Image 
                  source={require('./assets/logo1.png')} 
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
                <Text style={styles.episodeTitleLarge} numberOfLines={3}>
                  {selectedEpisode.title}
                </Text>
              </View>

              {/* Loading State */}
              {isLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#d97706" />
                  <Text style={styles.loadingText}>Loading episode...</Text>
                </View>
              )}

              {/* Player Controls - Show when loaded */}
              {!isLoading && (
                <>
                  {/* MAIN TIMELINE */}
                  <View style={styles.mainTimelineSection}>
                    <TouchableOpacity 
                      style={styles.mainProgressBarContainer}
                      onPress={handleProgressBarPress}
                    >
                      <View style={styles.mainProgressBar}>
                        <View 
                          style={[
                            styles.mainProgressFill, 
                            { width: `${duration ? (position / duration) * 100 : 0}%` }
                          ]} 
                        />
                        <View 
                          style={[
                            styles.mainProgressHandle, 
                            { left: `${duration ? (position / duration) * 100 : 0}%` }
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
                    
                    <View style={styles.mainTimeContainer}>
                      <Text style={styles.mainTimeText}>{formatTime(position)}</Text>
                      <Text style={styles.mainTimeText}>{formatTime(duration)}</Text>
                    </View>
                  </View>

                  {/* Fine Skip Controls */}
                  <View style={styles.fineControls}>
                    <TouchableOpacity style={styles.circularButton} onPress={handleSkip5Backward}>
                      <MaterialCommunityIcons name="rewind-5" size={24} color="#f4f4f4" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.circularButton} onPress={handleSkip5Forward}>
                      <MaterialCommunityIcons name="fast-forward-5" size={24} color="#f4f4f4" />
                    </TouchableOpacity>
                  </View>

                  {/* Main Skip Controls */}
                  <View style={styles.skipControls}>
                    <TouchableOpacity style={styles.circularButtonLarge} onPress={handleSkipBackward}>
                      <MaterialCommunityIcons name="rewind-15" size={36} color="#f4f4f4" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.playButton} onPress={handleTogglePlayback}>
                      <MaterialCommunityIcons 
                        name={isPlaying ? "pause" : "play"} 
                        size={40} 
                        color="#f4f4f4" 
                      />
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.circularButtonLarge} onPress={handleSkipForward}>
                      <MaterialCommunityIcons name="fast-forward-15" size={36} color="#f4f4f4" />
                    </TouchableOpacity>
                  </View>

                  {/* Clip Controls */}
                  <View style={styles.clipControls}>
                    <TouchableOpacity style={styles.clipButton} onPress={handleSetClipPoint}>
                      <MaterialCommunityIcons name="content-cut" size={16} color="#f4f4f4" />
                      <Text style={styles.clipButtonText}>
                        {!clipStart ? 'Start' : !clipEnd ? 'End' : 'New'}
                      </Text>
                    </TouchableOpacity>
                    
                    {clipStart && clipEnd && (
                      <>
                        <TouchableOpacity style={styles.clipButton} onPress={handlePlayClip}>
                          <MaterialCommunityIcons name="play-outline" size={16} color="#f4f4f4" />
                          <Text style={styles.clipButtonText}>Preview</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.saveButton} onPress={handleCreateVideo}>
                          <MaterialCommunityIcons name="video-plus" size={16} color="#f4f4f4" />
                          <Text style={styles.saveButtonText}>Create Video</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>

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
            </>
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
  
  // Header styles
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
  subtitle: {
    fontSize: 16,
    color: '#b4b4b4',
    textAlign: 'center',
  },
  
  // Input section
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
  
  // Feed info
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
  
  // Episode list
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
  episodeTitle: {
    color: '#f4f4f4',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  episodeDate: {
    color: '#b4b4b4',
    fontSize: 12,
    marginTop: 4,
  },
  
  // Audio player styles
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
  episodeTitleLarge: {
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
  
  // Timeline styles
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
  
  // Control buttons
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
  
  // Clip controls
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
  clipInfo: {
    color: '#d97706',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 20,
  },
  
  // Episode notes
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
  
  // Recording view styles
  recordingContainer: {
    flex: 1,
  },
  recordingBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  recordingArtwork: {
    width: 160,
    height: 160,
    borderRadius: 20,
    marginBottom: 40,
    backgroundColor: '#404040',
  },
  recordingTimelineContainer: {
    width: '100%',
    marginBottom: 30,
  },
  recordingTimeline: {
    height: 8,
    backgroundColor: '#404040',
    borderRadius: 4,
    marginBottom: 10,
  },
  recordingTimelineFill: {
    height: '100%',
    backgroundColor: '#d97706',
    borderRadius: 4,
  },
  recordingTimeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recordingTimeText: {
    color: '#b4b4b4',
    fontSize: 14,
    fontWeight: '500',
  },
  recordingWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginBottom: 40,
    height: 50,
  },
  recordingWaveformBar: {
    width: 4,
    backgroundColor: '#d97706',
    borderRadius: 2,
    minHeight: 10,
  },
  recordingEpisodeInfo: {
    alignItems: 'center',
    marginBottom: 50,
  },
  recordingEpisodeTitle: {
    color: '#f4f4f4',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 26,
  },
  recordingPodcastName: {
    color: '#b4b4b4',
    fontSize: 16,
    textAlign: 'center',
  },
  recordingStatusOverlay: {
    position: 'absolute',
    top: 60,
    right: 20,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  recordingText: {
    color: '#f4f4f4',
    fontSize: 14,
    fontWeight: '500',
  },
  recordingControls: {
    alignItems: 'center',
    gap: 20,
  },
  recordingButton: {
    backgroundColor: '#d97706',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 180,
  },
  recordingButtonText: {
    color: '#f4f4f4',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  stopButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 180,
  },
  stopButtonText: {
    color: '#f4f4f4',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#404040',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  cancelButtonText: {
    color: '#f4f4f4',
    fontSize: 14,
    fontWeight: '500',
  },
  recordingStatusText: {
    color: '#b4b4b4',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
});