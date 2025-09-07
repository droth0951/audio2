import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  Image,
  Dimensions,
  ActivityIndicator,
  Pressable,
  FlatList,
  Switch,
  Linking,
  Modal,
  ScrollView,
  AppState,
} from 'react-native';
import captionService from './CaptionService';
// Voice import - enabled for real speech recognition
import Voice from '@react-native-voice/voice';
import { Audio } from 'expo-av';
import { Animated as RNAnimated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ScreenRecorder from 'expo-screen-recorder';
import * as MediaLibrary from 'expo-media-library';
import { Slider } from 'react-native-awesome-slider';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS, withTiming } from 'react-native-reanimated';
import * as KeepAwake from 'expo-keep-awake';
import AboutModal from './src/components/AboutModal';
import SearchBar from './src/components/SearchBar';
// import { useFonts } from 'expo-font';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Utility function for formatting time
const formatTime = (millis) => {
  if (typeof millis !== 'number' || isNaN(millis) || millis < 0) {
    return '0:00';
  }
  const minutes = Math.floor(millis / 60000);
  const seconds = Math.floor((millis % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};


// REMOVED: WordBasedChunkedCaptionOverlay - Too complex, causing bugs

// SIMPLIFIED CAPTION OVERLAY - Uses CaptionService for reliability
const SimpleCaptionOverlay = ({ transcript, currentTimeMs, clipStartMs = 0 }) => {
  const [currentCaption, setCurrentCaption] = useState('');

  useEffect(() => {
    // DEBUG: Log what position the caption component receives
    if (typeof currentTimeMs === 'number' && currentTimeMs % 3000 < 100) { // Log every ~3 seconds
      console.log('🎬 SimpleCaptionOverlay received:', {
        currentTimeMs,
        clipStartMs,
        hasTranscript: !!transcript
      });
    }
    
    if (!transcript || typeof currentTimeMs !== 'number') {
      setCurrentCaption('');
      return;
    }

    // Use CaptionService for all caption logic
    const { text, isActive, speaker } = captionService.getCurrentCaption(currentTimeMs);
    
    if (isActive && text) {
      setCurrentCaption(text);
    } else {
      setCurrentCaption('');
    }

  }, [transcript, currentTimeMs, clipStartMs]);

  if (!currentCaption.trim()) return null;

  return (
    <View style={styles.speakerCaptionContainer}>
      <View style={styles.speakerCaptionBubble}>
        <Text style={styles.speakerCaptionText}>
          {currentCaption}
        </Text>
      </View>
    </View>
  );
};


// Recording View Component
const RecordingView = ({ 
  selectedEpisode, 
  podcastTitle, 
  duration, 
  clipStart, 
  clipEnd, 
  position, 
  isPlaying, 
  captionsEnabled, 
  preparedTranscript, 
  isRecording, 
  recordingStatus, 
  startVideoRecording, 
  cleanupRecording, 
  setShowRecordingView,
  styles 
}) => (
  <View style={styles.recordingContainer}>
    <StatusBar style="light" hidden={true} />
    
    {/* Full-screen wireframe design - ALWAYS VISIBLE */}
    <LinearGradient
      colors={['#1c1c1c', '#2d2d2d']}
      style={styles.recordingBackground}
    >
      {/* Episode artwork - ALWAYS VISIBLE */}
      {selectedEpisode?.artwork && (
        <Image 
          source={{ uri: selectedEpisode.artwork }} 
          style={styles.recordingArtwork}
          resizeMode="cover"
        />
      )}
      
      {/* Progress timeline - ALWAYS VISIBLE */}
      <View style={styles.recordingTimelineContainer}>
        <View style={styles.recordingTimeline}>
          <View 
            style={[
              styles.recordingTimelineFill, 
              { width: `${duration ? (Math.min(Math.max(0, position - clipStart), clipEnd - clipStart) / (clipEnd - clipStart)) * 100 : 0}%` }
            ]} 
          />
        </View>
        <View style={styles.recordingTimeLabels}>
          <Text style={styles.recordingTimeText}>{formatTime(Math.min(Math.max(0, position - clipStart), clipEnd - clipStart))}</Text>
          <Text style={styles.recordingTimeText}>{formatTime(clipEnd - clipStart)}</Text>
        </View>
      </View>
      
      {/* Animated waveform - ALWAYS VISIBLE */}
      <AnimatedWaveform 
        isPlaying={isPlaying}
        size="large"
        color="#d97706"
        style={styles.recordingWaveform}
        isRecording={isRecording} // Pass recording state for optimized animation
      />
      
      {/* Episode info - ALWAYS VISIBLE */}
      <View style={styles.recordingEpisodeInfo}>
        <Text style={styles.recordingEpisodeTitle} numberOfLines={2}>
          {selectedEpisode?.title}
        </Text>
        <Text style={styles.recordingPodcastName}>
          {podcastTitle || 'The Town with Matthew Belloni'}
        </Text>
      </View>

      {/* Captions - ALWAYS VISIBLE WHEN ENABLED */}
      {captionsEnabled && preparedTranscript && (
        <>
          <SimpleCaptionOverlay
            transcript={preparedTranscript}
            currentTimeMs={position}
            clipStartMs={clipStart}
          />
        </>
      )}

      {/* 🎯 KEY FIX: ONLY show controls when NOT actively recording */}
      {!isRecording && (
        <>
          {/* Control buttons - HIDDEN DURING RECORDING */}
          <View style={styles.recordingControls}>
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
          </View>
          
          {/* Status text - HIDDEN DURING RECORDING */}
          {recordingStatus ? (
            <Text style={styles.recordingStatusText}>{recordingStatus}</Text>
          ) : null}
        </>
      )}
    </LinearGradient>
  </View>
);
          


// Real Voice Manager for Captions
class VoiceManager {
  static isListening = false;
  static onResultCallback = null;
  static onErrorCallback = null;

  static async startListening(onResult, onError) {
    try {
      console.log('🎤 Starting real voice recognition...');
      
      this.isListening = true;
      this.onResultCallback = onResult;
      this.onErrorCallback = onError;

      // Set up event listeners
      Voice.onSpeechResults = (event) => {
        console.log('🎤 Speech result received:', event);
        if (this.isListening && event.value && event.value[0]) {
          this.onResultCallback(event.value[0]);
        }
      };

      Voice.onSpeechError = (error) => {
        console.log('🎤 Speech error:', error);
        if (this.onErrorCallback) {
          this.onErrorCallback(error);
        }
      };

      Voice.onSpeechStart = () => {
        console.log('🎤 Speech recognition started');
      };

      Voice.onSpeechEnd = () => {
        console.log('🎤 Speech recognition ended');
      };

      // Start voice recognition
      await Voice.start('en-US');
      console.log('🎤 Voice recognition started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start voice recognition:', error);
      this.isListening = false;
      
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
    }
  }

  static async stopListening() {
    try {
      console.log('🛑 Stopping voice recognition...');
      this.isListening = false;
      
      // Remove listeners first to prevent any callbacks during stop
      Voice.removeAllListeners();
      
      // Stop voice recognition
      await Voice.stop();
      console.log('🛑 Voice recognition stopped successfully');
      
    } catch (error) {
      console.error('❌ Failed to stop voice recognition:', error);
      // Even if stop fails, we should still clean up our state
      this.isListening = false;
      Voice.removeAllListeners();
    }
  }

  static async checkPermissions() {
    try {
      console.log('🔍 Checking Voice availability...');
      
      // Check if Voice is available
      const isAvailable = await Voice.isAvailable();
      console.log('🔍 Voice available:', isAvailable);
      
      if (!isAvailable) {
        return { granted: false, reason: 'Speech recognition not available on this device' };
      }

      // For now, let's assume permissions are granted and test the basic functionality
      // We'll handle actual permission errors when they occur during startListening
      console.log('🔍 Assuming permissions are available for testing');
      return { granted: true };
      
    } catch (error) {
      console.error('Permission check error:', error);
      return { granted: false, reason: 'Unable to check permissions' };
    }
  }

  static async requestPermissions() {
    try {
      // The Voice library doesn't have a direct requestPermissions method
      // Instead, we try to start recognition which will trigger the permission request
      const permissionCheck = await this.checkPermissions();
      
      if (permissionCheck.granted) {
        return true;
      }

      // If not granted, try to start recognition to trigger permission request
      try {
        await Voice.start('en-US');
        await Voice.stop();
        return true;
      } catch (error) {
        console.error('Permission request failed:', error);
        return false;
      }
    } catch (error) {
      console.error('Failed to request voice permissions:', error);
      return false;
    }
  }
}

// App-wide spacing constants
const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

const PADDING = {
  horizontal: SPACING.md, // 16px
  vertical: SPACING.lg,   // 20px
};

// Cache for RSS feeds to avoid re-fetching
const RSS_CACHE_KEY = 'rss_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Performance-optimized RSS parser
const fastParseRSSFeed = (xmlText, limit = 5, feedUrl = null) => {
  try {
    const episodes = [];
    
    // Find episodes by splitting on <item> tags to preserve document order
    const itemSplits = xmlText.split('<item>');
    
    // Skip the first split (before first <item>) and process only the first 'limit' episodes
    let count = 0;
    for (let i = 1; i < itemSplits.length && count < limit; i++) {
      const itemContent = itemSplits[i];
      const itemEndIndex = itemContent.indexOf('</item>');
      if (itemEndIndex === -1) continue;
      
      const item = itemContent.substring(0, itemEndIndex);
      
      // Fast title extraction
      const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?([^<>\]]+)(?:\]\]>)?<\/title>/);
      const title = titleMatch ? titleMatch[1].trim() : `Episode ${count + 1}`;
      
      // Fast audio URL extraction
      const audioMatch = item.match(/<enclosure[^>]*url="([^"]*)"[^>]*\/>/);
      const audioUrl = audioMatch ? audioMatch[1] : null;
      
      // Fast description extraction
      let description = 'No description available.';
      const descriptionMatch = item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
      console.log('🔍 Description match for episode', count + 1, ':', descriptionMatch ? 'Found' : 'Not found');
      if (descriptionMatch && descriptionMatch[1]) {
        description = descriptionMatch[1]
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
        console.log('📝 Parsed description length:', description.length);
      }
      
      // Fast artwork extraction
      let artwork = null;
      console.log('🔍 Extracting artwork for episode', count + 1);
      
      // Try multiple patterns for artwork extraction
      const artworkMatch = item.match(/<itunes:image[^>]*href="([^"]*)"[^>]*\/?>/) ||
                          item.match(/<image[^>]*href="([^"]*)"[^>]*\/?>/) ||
                          item.match(/<media:content[^>]*url="([^"]*)"[^>]*\/?>/) ||
                          item.match(/<enclosure[^>]*type="image[^"]*"[^>]*url="([^"]*)"[^>]*\/?>/) ||
                          item.match(/<media:thumbnail[^>]*url="([^"]*)"[^>]*\/?>/);
      
      if (artworkMatch) {
        artwork = artworkMatch[1];
        console.log('🖼️ Artwork found for episode', count + 1, ':', artwork);
      } else {
        console.log('🖼️ No episode artwork found for episode', count + 1);
        
        // Try to get podcast-level artwork as fallback
        console.log('🔍 Trying podcast-level artwork as fallback...');
        const podcastArtworkMatch = xmlText.match(/<itunes:image[^>]*href="([^"]*)"[^>]*\/?>/) ||
                                   xmlText.match(/<image[^>]*href="([^"]*)"[^>]*\/?>/) ||
                                   xmlText.match(/<media:content[^>]*url="([^"]*)"[^>]*\/?>/) ||
                                   xmlText.match(/<media:thumbnail[^>]*url="([^"]*)"[^>]*\/?>/);
        
        if (podcastArtworkMatch) {
          artwork = podcastArtworkMatch[1];
          console.log('🖼️ Using podcast artwork as fallback for episode', count + 1, ':', artwork);
        } else {
          console.log('🖼️ No podcast artwork found either for episode', count + 1);
        }
      }
      
      if (audioUrl) {
        episodes.push({
          id: count,
          title,
          audioUrl,
          pubDate: item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] || '',
          artwork: artwork,
          description: description || 'No description available.',
        });
        count++;
      }
    }
    
    // Sort episodes by publication date (newest first) as a safety measure
    episodes.sort((a, b) => {
      const dateA = new Date(a.pubDate);
      const dateB = new Date(b.pubDate);
      return dateB - dateA; // Newest first (reverse chronological)
    });
    
    return episodes;
  } catch (error) {
    console.error('Fast RSS parse error:', error);
    return [];
  }
};

const AnimatedWaveform = ({ 
  isPlaying = false,
  size = 'large',
  color = '#d97706',
  style,
  isRecording = false // NEW: Add recording mode for optimized animation
}) => {
  const animatedValues = useRef([
    new RNAnimated.Value(0.4),
    new RNAnimated.Value(0.4),
    new RNAnimated.Value(0.4),
    new RNAnimated.Value(0.4),
    new RNAnimated.Value(0.4),
    new RNAnimated.Value(0.4),
    new RNAnimated.Value(0.4),
    new RNAnimated.Value(0.4),
    new RNAnimated.Value(0.4),
  ]).current;

  const sizeConfig = {
    small: {
      barWidth: 3,
      barGap: 2,
      baseHeights: [12, 20, 16, 28, 18, 24, 16, 20, 12],
      containerHeight: 30,
    },
    medium: {
      barWidth: 4,
      barGap: 3,
      baseHeights: [16, 28, 22, 38, 24, 32, 22, 28, 16],
      containerHeight: 40,
    },
    large: {
      barWidth: 5,
      barGap: 4,
      baseHeights: [20, 35, 28, 48, 30, 40, 28, 35, 20],
      containerHeight: 50,
    }
  };

  const config = sizeConfig[size];

  useEffect(() => {
    if (isPlaying) {
      // 🎯 OPTIMIZATION: Use slower, smoother animation during screen recording
      const baseDuration = isRecording ? 800 : 400; // Slower for recording
      const staggerDelay = isRecording ? 150 : 100;  // More spacing for recording
      
      const animations = animatedValues.map((animValue, index) => {
        return RNAnimated.loop(
          RNAnimated.sequence([
            RNAnimated.timing(animValue, {
              toValue: 1,
              duration: baseDuration + (index * 50),
              useNativeDriver: false,
            }),
            RNAnimated.timing(animValue, {
              toValue: 0.3,
              duration: baseDuration + (index * 50),
              useNativeDriver: false,
            }),
          ])
        );
      });

      animations.forEach((animation, index) => {
        setTimeout(() => {
          animation.start();
        }, index * staggerDelay);
      });

      return () => {
        animatedValues.forEach(animValue => animValue.stopAnimation());
      };
    } else {
      const restAnimations = animatedValues.map(animValue =>
        RNAnimated.timing(animValue, {
          toValue: 0.4,
          duration: 300,
          useNativeDriver: false,
        })
      );

      RNAnimated.parallel(restAnimations).start();
    }
  }, [isPlaying, isRecording]); // Add isRecording to dependencies

  return (
    <View style={[waveformStyles.container, { height: config.containerHeight }, style]}>
      <View style={waveformStyles.waveform}>
        {animatedValues.map((animValue, index) => (
          <RNAnimated.View
            key={index}
            style={[
              waveformStyles.bar,
              {
                width: config.barWidth,
                marginHorizontal: config.barGap / 2,
                backgroundColor: color,
                height: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [config.baseHeights[index] * 0.3, config.baseHeights[index]],
                }),
                opacity: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 0.9],
                }),
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const HomeAnimatedWaveform = ({ 
  size = 'large',
  color = '#d97706',
  style 
}) => {
  const animatedValues = useRef([
    new RNAnimated.Value(0.4),
    new RNAnimated.Value(0.4),
    new RNAnimated.Value(0.4),
    new RNAnimated.Value(0.4),
    new RNAnimated.Value(0.4),
    new RNAnimated.Value(0.4),
    new RNAnimated.Value(0.4),
    new RNAnimated.Value(0.4),
    new RNAnimated.Value(0.4),
  ]).current;

  const sizeConfig = {
    small: {
      barWidth: 3,
      barGap: 2,
      baseHeights: [12, 20, 16, 28, 18, 24, 16, 20, 12],
      containerHeight: 30,
    },
    medium: {
      barWidth: 4,
      barGap: 3,
      baseHeights: [16, 28, 22, 38, 24, 32, 22, 28, 16],
      containerHeight: 40,
    },
    large: {
      barWidth: 5,
      barGap: 4,
      baseHeights: [20, 35, 28, 48, 30, 40, 28, 35, 20],
      containerHeight: 50,
    }
  };

  const config = sizeConfig[size];

  useEffect(() => {
    // Always animate on mount for home screen
    const animations = animatedValues.map((animValue, index) => {
      return RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(animValue, {
            toValue: 1,
            duration: 800 + (index * 100), // Slower, more elegant animation
            useNativeDriver: false,
          }),
          RNAnimated.timing(animValue, {
            toValue: 0.3,
            duration: 800 + (index * 100),
            useNativeDriver: false,
          }),
        ]),
        { iterations: -1 } // Infinite loop
      );
    });

    // Start animations with staggered timing
    animations.forEach((animation, index) => {
      setTimeout(() => {
        animation.start();
      }, index * 150);
    });

    // Cleanup on unmount
    return () => {
      animatedValues.forEach(animValue => animValue.stopAnimation());
    };
  }, []); // Empty dependency array - only run on mount

  return (
    <View style={[waveformStyles.container, { height: config.containerHeight }, style]}>
      <View style={waveformStyles.waveform}>
        {animatedValues.map((animValue, index) => (
          <RNAnimated.View
            key={index}
            style={[
              waveformStyles.bar,
              {
                width: config.barWidth,
                marginHorizontal: config.barGap / 2,
                backgroundColor: color,
                height: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [config.baseHeights[index] * 0.3, config.baseHeights[index]],
                }),
                opacity: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 0.9],
                }),
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};



export default function App() {
  // Font loading disabled for now - using system fonts

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
  
  // Clean UI Selection Mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectionStep, setSelectionStep] = useState('idle'); // 'idle', 'start', 'end'
  
  // Video recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingActive, setIsRecordingActive] = useState(false); // 🔧 NEW: Separate state for monitoring
  const [showRecordingView, setShowRecordingView] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('');
  
  // Caption-Safe Recording State Management
  const [recordingCleanupState, setRecordingCleanupState] = useState({
    isCleanupInProgress: false,
    hadRecordingError: false
  });

  // App state listener - ONLY for recording cleanup (not audio position)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      console.log('🔄 App state changed:', nextAppState);
      
      // ONLY cleanup recording state on background, don't touch audio
      if (nextAppState === 'background' && isRecording) {
        console.log('⚠️ App backgrounded during recording - cleanup recording only');
        await emergencyRecordingCleanup();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isRecording]); // Only depend on isRecording, not audio states
  
  // URL input state
  const [urlInput, setUrlInput] = useState('');
  const [currentRssFeed, setCurrentRssFeed] = useState('');
  const [podcastTitle, setPodcastTitle] = useState('');

  const [showRecordingGuidance, setShowRecordingGuidance] = useState(false);
  const [dontShowGuidanceAgain, setDontShowGuidanceAgain] = useState(false);

  // Shared values for the scrubber
  const progressSharedValue = useSharedValue(0);
  const minValue = useSharedValue(0);
  const maxValue = useSharedValue(100);
  const [isScrubbing, setIsScrubbing] = useState(false);


  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentPodcasts, setRecentPodcasts] = useState([]);

  const searchAbortController = useRef(null);
  const textInputRef = useRef(null);
  const searchTextRef = useRef('');
  const [localSearchText, setLocalSearchText] = useState('');
  
  // Memoize the onChangeText function to prevent re-renders
  const handleSearchTextChange = useCallback((text) => {
    console.log('🔍 Search input changed:', text);
    searchTextRef.current = text; // Store in ref, not state
    setLocalSearchText(text);     // Update local state for controlled input
  }, []);
  
  // Memoize the onSubmitEditing function to prevent re-renders
  const handleSearchSubmit = useCallback(() => {
    const query = searchTextRef.current.trim();
    console.log('🔍 Search submitted with:', query);
    if (query) {
      setUrlInput(query);
      handlePodcastSearch(query);
    }
  }, [handlePodcastSearch]);
  
  // Memoize the Search button press handler to prevent re-renders
  const handleSearchButtonPress = useCallback(() => {
    const query = searchTextRef.current.trim();
    console.log('🔍 Search button pressed with:', query);
    if (query) {
      setUrlInput(query);
      handlePodcastSearch(query);
    }
  }, [handlePodcastSearch]);
  
  // Memoize the onFocus handler to maintain focus
  const handleSearchFocus = useCallback(() => {
    console.log('🔍 Search input focused');
  }, []);

  const recordingTimerRef = useRef(null);
  const [loadingPodcastId, setLoadingPodcastId] = useState(null);
  const [popularPodcastsArtwork, setPopularPodcastsArtwork] = useState({});
  
  // Load cached artwork on app startup
  useEffect(() => {
    const loadCachedArtwork = async () => {
      try {
        const cached = await AsyncStorage.getItem('popular_podcasts_artwork');
        if (cached) {
          setPopularPodcastsArtwork(JSON.parse(cached));
          console.log('🎨 Loaded cached artwork for popular podcasts');
        }
      } catch (error) {
        console.log('❌ Error loading cached artwork:', error);
      }
    };
    
    loadCachedArtwork();
  }, []);
  
  const popularBusinessPodcasts = [
    { 
      name: 'The Indicator from Planet Money', 
      fallbackEmoji: '📊',
      category: 'Finance' 
    },
    { 
      name: 'How I Built This with Guy Raz', 
      fallbackEmoji: '💡',
      category: 'Ideas' 
    },
    { 
      name: 'This Is Working with Daniel Roth', 
      fallbackEmoji: '💡',
      category: 'Work' 
    },
    { 
      name: 'Acquired', 
      fallbackEmoji: '💰',
      category: 'Finance' 
    },
    { 
      name: 'WorkLife with Adam Grant', 
      fallbackEmoji: '💼',
      category: 'Work' 
    },
    { 
      name: 'Masters of Scale', 
      fallbackEmoji: '🚀',
      category: 'Ideas' 
    },
    { 
      name: 'The Ed Mylett Show', 
      fallbackEmoji: '🎯',
      category: 'Motivation' 
    },
    { 
      name: 'The Tony Robbins Podcast', 
      fallbackEmoji: '🎯',
      category: 'Motivation' 
    },
    { 
      name: 'The GaryVee Audio Experience', 
      fallbackEmoji: '💡',
      category: 'Ideas' 
    },
    { 
      name: 'The Dave Ramsey Show', 
      fallbackEmoji: '💰',
      category: 'Finance' 
    },
    { 
      name: 'Marketplace', 
      fallbackEmoji: '📰',
      category: 'News' 
    },
    { 
      name: 'Freakonomics Radio', 
      fallbackEmoji: '💡',
      category: 'Ideas' 
    },
    { 
      name: 'Planet Money', 
      fallbackEmoji: '📊',
      category: 'Finance' 
    },
    { 
      name: 'Business Wars', 
      fallbackEmoji: '⚔️',
      category: 'Business' 
    },
    { 
      name: 'Hello Monday', 
      fallbackEmoji: '💡',
      category: 'Work' 
    }
  ];

  // Add state for episode notes bottom sheet
  const [showEpisodeNotes, setShowEpisodeNotes] = useState(false);
  const [episodeNotesHeight] = useState(screenHeight * 0.7); // 70% of screen height
  const notesTranslateY = useSharedValue(screenHeight);
  const notesOpacity = useSharedValue(0);

  const [isEpisodeLoading, setIsEpisodeLoading] = useState(false);
  const [loadingEpisodeTitle, setLoadingEpisodeTitle] = useState('');

  // Caption state
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
  const [preparedTranscript, setPreparedTranscript] = useState(null);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [processingStep, setProcessingStep] = useState('');

  const translateX = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: 1 - translateX.value / screenWidth,
  }));
  
  const notesAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: notesTranslateY.value }],
  }));

  const notesOverlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: notesOpacity.value,
  }));

  const [allEpisodes, setAllEpisodes] = useState([]);
  const [showLoadMore, setShowLoadMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [imageCache, setImageCache] = useState(new Map());
  const [preloadingImages, setPreloadingImages] = useState(new Set());

  const preloadEpisodeArtwork = useCallback(async (episodes) => {
    const artworkUrls = episodes
      .map(ep => ep.artwork)
      .filter(Boolean)
      .slice(0, 8); // Preload first 8 episodes

    console.log('🖼️ Starting background preload of', artworkUrls.length, 'images');
    
    const batchSize = 2;
    for (let i = 0; i < artworkUrls.length; i += batchSize) {
      const batch = artworkUrls.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(uri => Image.prefetch(uri).catch(() => {}))
      );
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    console.log('🖼️ Background preload complete');
  }, []);

  const fetchPopularPodcastsArtwork = async () => {
    console.log('🎨 Fetching artwork for popular podcasts...');
    const artworkCache = {};
    
    try {
      for (const podcast of popularBusinessPodcasts) {
        try {
          const searchResults = await handlePodcastSearch(podcast.name, true); // silent search
          if (searchResults && searchResults.length > 0) {
            const podcastData = searchResults[0];
            if (podcastData.artwork) {
              artworkCache[podcast.name] = podcastData.artwork;
              console.log('✅ Found artwork for:', podcast.name);
            }
          }
        } catch (error) {
          console.log('❌ Failed to fetch artwork for:', podcast.name, error.message);
        }
      }
      
      setPopularPodcastsArtwork(artworkCache);
      
      try {
        await AsyncStorage.setItem('popular_podcasts_artwork', JSON.stringify(artworkCache));
        console.log('💾 Cached artwork for future use');
      } catch (error) {
        console.log('❌ Error caching artwork:', error);
      }
      
      console.log('🎨 Updated artwork cache with', Object.keys(artworkCache).length, 'podcasts');
      
    } catch (error) {
      console.log('❌ Error fetching popular podcasts artwork:', error);
    }
  };

  // Cache management functions
  const getCachedFeed = async (feedUrl) => {
    try {
      const cacheKey = `${RSS_CACHE_KEY}_${feedUrl}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          console.log('📦 Using cached feed');
          return data;
        }
      }
      return null;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  };

  const setCachedFeed = async (feedUrl, episodes) => {
    try {
      const cacheKey = `${RSS_CACHE_KEY}_${feedUrl}`;
      const cacheData = {
        data: episodes,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Cache write error:', error);
    }
  };

  const loadPodcastFeed = async (feedUrl) => {
    console.log('🎙️ loadPodcastFeed called with:', feedUrl);
    setLoading(true);
    
    try {
      // Check cache first
      const cachedEpisodes = await getCachedFeed(feedUrl);
      if (cachedEpisodes) {
        // Add stored podcast artwork to cached episodes
        const storedPodcastArtwork = await AsyncStorage.getItem(`podcast_artwork_${feedUrl}`);
        console.log('🔍 Checking for stored podcast artwork for cached feed:', feedUrl);
        console.log('🔍 Stored podcast artwork found:', !!storedPodcastArtwork);
        
        if (storedPodcastArtwork) {
          console.log('🖼️ Adding stored artwork to cached episodes:', storedPodcastArtwork);
          cachedEpisodes.forEach(episode => {
            if (!episode.artwork) {
              episode.artwork = storedPodcastArtwork;
              console.log('🖼️ Added stored artwork to cached episode:', episode.title);
            }
          });
        }
        
        setAllEpisodes(cachedEpisodes);
        setEpisodes(cachedEpisodes.slice(0, 5)); // Show only first 5 episodes
        setShowLoadMore(cachedEpisodes.length > 5);
        setCurrentRssFeed(feedUrl);
        
        // Trigger background preloading of episode artwork
        setTimeout(() => {
          preloadEpisodeArtwork(cachedEpisodes.slice(0, 5));
        }, 1500); // Wait for UI to render first
        
        // Set podcast title from cache if available
        const cachedPodcastTitle = await AsyncStorage.getItem(`podcast_title_${feedUrl}`);
        console.log('🔍 Cached podcast title:', cachedPodcastTitle);
        if (cachedPodcastTitle) {
          console.log('✅ Setting podcast title from cache:', cachedPodcastTitle);
          setPodcastTitle(cachedPodcastTitle);
        } else {
          console.log('❌ No cached podcast title found');
          // Try to extract from the original RSS feed if we have it cached
          const cachedRssContent = await AsyncStorage.getItem(`rss_content_${feedUrl}`);
          console.log('🔍 Cached RSS content exists:', !!cachedRssContent);
          if (cachedRssContent) {
            console.log('🔍 Attempting to extract podcast title from cached RSS content...');
            const channelTitleMatch = cachedRssContent.match(/<channel[\s\S]*?<title>(.*?)<\/title>/);
            console.log('🔍 Channel title match from cached RSS:', channelTitleMatch);
            if (channelTitleMatch) {
              const title = channelTitleMatch[1].trim();
              console.log('✅ Extracted podcast title from cached RSS:', title);
              setPodcastTitle(title);
              await AsyncStorage.setItem(`podcast_title_${feedUrl}`, title);
            } else {
              console.log('❌ Could not extract podcast title from cached RSS content');
              // Try alternative extraction
              const titleMatch = cachedRssContent.match(/<title>(.*?)<\/title>/);
              console.log('🔍 Alternative title match from cached RSS:', titleMatch);
              if (titleMatch) {
                const title = titleMatch[1].trim();
                console.log('✅ Extracted podcast title (alternative) from cached RSS:', title);
                setPodcastTitle(title);
                await AsyncStorage.setItem(`podcast_title_${feedUrl}`, title);
              }
            }
          } else {
            console.log('❌ No cached RSS content found, will need fresh fetch');
            // Force a fresh fetch to get the RSS content and extract title
            console.log('🔄 Forcing fresh fetch to get podcast title...');
            try {
              const response = await fetch(feedUrl);
              const xmlText = await response.text();
              await AsyncStorage.setItem(`rss_content_${feedUrl}`, xmlText);
              
              // Extract podcast title from fresh RSS
              const channelTitleMatch = xmlText.match(/<channel[\s\S]*?<title>(.*?)<\/title>/);
              if (channelTitleMatch) {
                const title = channelTitleMatch[1].trim();
                console.log('✅ Extracted podcast title from fresh RSS:', title);
                setPodcastTitle(title);
                await AsyncStorage.setItem(`podcast_title_${feedUrl}`, title);
              } else {
                console.log('❌ Could not extract podcast title from fresh RSS');
              }
            } catch (error) {
              console.log('❌ Error fetching fresh RSS for title extraction:', error);
            }
          }
        }
        
        console.log('✅ Feed loaded from cache!');
        console.log('📝 Cached first episode description:', cachedEpisodes[0]?.description?.substring(0, 100) || 'No description');
        console.log('📊 Cached total episodes:', cachedEpisodes.length);
        console.log('📊 Cached show load more:', cachedEpisodes.length > 5);
        return;
      }

      console.log('📡 Starting fetch...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced timeout
      
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
      
      // Cache the RSS content for later title extraction
      await AsyncStorage.setItem(`rss_content_${feedUrl}`, xmlText);
      
      console.log('🔧 Calling fastParseRSSFeed...');
      // Log a sample of the RSS feed structure for debugging
      console.log('🔍 RSS feed sample (first 1000 chars):', xmlText.substring(0, 1000));
      console.log('🔍 RSS feed contains <itunes:image>:', xmlText.includes('<itunes:image'));
      console.log('🔍 RSS feed contains <image>:', xmlText.includes('<image>'));
      console.log('🔍 RSS feed contains <media:content>:', xmlText.includes('<media:content'));
      
      // Parse up to 50 episodes to check if there are more available
      const allEpisodes = fastParseRSSFeed(xmlText, 50);
      console.log('🎧 Parsed episodes:', allEpisodes.length);
      
      // Add stored podcast artwork as fallback for episodes without artwork
      const storedPodcastArtwork = await AsyncStorage.getItem(`podcast_artwork_${feedUrl}`);
      console.log('🔍 Checking for stored podcast artwork for feed:', feedUrl);
      console.log('🔍 Stored podcast artwork found:', !!storedPodcastArtwork);
      
      // Also try to extract podcast-level artwork from RSS feed
      let podcastArtworkFromRss = null;
      const podcastArtworkMatch = xmlText.match(/<itunes:image[^>]*href="([^"]*)"[^>]*\/?>/) ||
                                 xmlText.match(/<image[^>]*href="([^"]*)"[^>]*\/?>/) ||
                                 xmlText.match(/<media:content[^>]*url="([^"]*)"[^>]*\/?>/) ||
                                 xmlText.match(/<media:thumbnail[^>]*url="([^"]*)"[^>]*\/?>/);
      
      if (podcastArtworkMatch) {
        podcastArtworkFromRss = podcastArtworkMatch[1];
        console.log('🖼️ Found podcast artwork in RSS feed:', podcastArtworkFromRss);
      }
      
      // Use stored artwork first, then RSS artwork as fallback
      const fallbackArtwork = storedPodcastArtwork || podcastArtworkFromRss;
      
      if (fallbackArtwork) {
        console.log('🖼️ Using fallback artwork:', fallbackArtwork);
        allEpisodes.forEach(episode => {
          if (!episode.artwork) {
            episode.artwork = fallbackArtwork;
            console.log('🖼️ Added fallback artwork to episode:', episode.title);
          }
        });
      } else {
        console.log('❌ No fallback artwork found for this feed');
      }
      
      // Extract podcast title from RSS feed
      console.log('🔍 Extracting podcast title from RSS feed...');
      
      // Try multiple patterns for podcast title extraction
      let podcastTitle = null;
      
      // Pattern 1: <channel><title>
      const channelTitleMatch = xmlText.match(/<channel[\s\S]*?<title>(.*?)<\/title>/);
      console.log('🔍 Channel title match:', channelTitleMatch);
      
      if (channelTitleMatch) {
        podcastTitle = channelTitleMatch[1].trim();
        console.log('✅ Found podcast title (channel):', podcastTitle);
      } else {
        // Pattern 2: <title> outside of items
        const titleMatch = xmlText.match(/<title>(.*?)<\/title>/);
        console.log('🔍 General title match:', titleMatch);
        
        if (titleMatch) {
          const title = titleMatch[1].trim();
          // Check if this is not an episode title (should be outside <item> tags)
          const beforeTitle = xmlText.substring(0, titleMatch.index);
          const afterTitle = xmlText.substring(titleMatch.index + titleMatch[0].length);
          
          // If there are no <item> tags before this title, it's likely the podcast title
          if (!beforeTitle.includes('<item>')) {
            podcastTitle = title;
            console.log('✅ Found podcast title (general):', podcastTitle);
          } else {
            console.log('❌ Title found but appears to be episode title, not podcast title');
          }
        }
      }
      
      if (podcastTitle) {
        console.log('✅ Setting podcast title:', podcastTitle);
        setPodcastTitle(podcastTitle);
        // Cache the podcast title
        await AsyncStorage.setItem(`podcast_title_${feedUrl}`, podcastTitle);
      } else {
        console.log('❌ No podcast title found in RSS feed');
      }
      
      // Show only first 5 episodes initially
      const episodes = allEpisodes.slice(0, 5);
      
      if (episodes.length === 0) {
        throw new Error('No episodes found in feed');
      }
      
      // Cache the results
      await setCachedFeed(feedUrl, allEpisodes);
      
      setAllEpisodes(allEpisodes);
      setEpisodes(episodes); // Show only first 5 episodes
      setShowLoadMore(allEpisodes.length > 5); // Show load more if there are more episodes
      setCurrentRssFeed(feedUrl);
      
      // Trigger background preloading of episode artwork
      setTimeout(() => {
        preloadEpisodeArtwork(episodes);
      }, 1500); // Wait for UI to render first
      console.log('✅ Feed loaded successfully!');
      console.log('📝 First episode description:', episodes[0]?.description?.substring(0, 100) || 'No description');
      console.log('📊 Total episodes parsed:', allEpisodes.length);
      console.log('📊 Episodes to show:', episodes.length);
      console.log('📊 Show load more:', allEpisodes.length > 5);
      
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

  // Load more episodes function
  const loadMoreEpisodes = useCallback(async () => {
    if (isLoadingMore || !currentRssFeed) return;
    
    setIsLoadingMore(true);
    try {
      const currentCount = episodes.length;
      let nextCount;
      
      // Progressive loading: 5 → 10 → 20 → All
      if (currentCount === 5) {
        nextCount = 10;
      } else if (currentCount === 10) {
        nextCount = 20;
      } else {
        nextCount = allEpisodes.length; // Load all remaining
      }
      
      // If we have enough episodes in allEpisodes, show more of them
      if (allEpisodes.length >= nextCount) {
        setEpisodes(allEpisodes.slice(0, nextCount));
        setShowLoadMore(nextCount < allEpisodes.length);
        console.log(`📊 Showing ${nextCount} of ${allEpisodes.length} episodes`);
      } else {
        // If we need to parse more episodes, fetch and parse more
        console.log('📊 Fetching more episodes...');
        const response = await fetch(currentRssFeed);
        const xmlText = await response.text();
        const moreEpisodes = fastParseRSSFeed(xmlText, 100); // Parse up to 100 episodes
        
        setAllEpisodes(moreEpisodes);
        const finalCount = Math.min(nextCount, moreEpisodes.length);
        setEpisodes(moreEpisodes.slice(0, finalCount));
        setShowLoadMore(finalCount < moreEpisodes.length);
        
        // Update cache with full data
        await setCachedFeed(currentRssFeed, moreEpisodes);
        console.log(`📊 Showing ${finalCount} of ${moreEpisodes.length} episodes from full parse`);
      }
      
    } catch (error) {
      console.error('Load more error:', error);
      Alert.alert('Error', 'Failed to load more episodes');
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, currentRssFeed, allEpisodes, episodes.length]);

  // Apple Podcasts URL to RSS converter
  const getApplePodcastsRssUrl = async (appleUrl) => {
    try {
      // Extract podcast ID from Apple Podcasts URL
      const idMatch = appleUrl.match(/id(\d+)/);
      
      if (!idMatch) {
        console.error('Could not extract podcast ID from URL:', appleUrl);
        return null;
      }
      
      const podcastId = idMatch[1];
      console.log('🍎 Extracted podcast ID:', podcastId);
      
      // Use Apple's iTunes lookup API to get RSS feed URL
      const lookupUrl = `https://itunes.apple.com/lookup?id=${podcastId}`;
      console.log('📡 Querying Apple API:', lookupUrl);
      
      const response = await fetch(lookupUrl);
      
      if (!response.ok) {
        console.error('Apple API request failed:', response.status);
        return null;
      }
      
      const data = await response.json();
      console.log('📡 Apple API response received');
      
      if (data.results && data.results.length > 0) {
        const podcast = data.results[0];
        const rssUrl = podcast.feedUrl;
        
        if (rssUrl) {
          console.log('✅ Found RSS URL:', rssUrl);
          console.log('📝 Podcast name:', podcast.collectionName);
          console.log('📝 Full Apple API response:', JSON.stringify(podcast, null, 2));
          
          // Update podcast title for display
          const podcastName = podcast.collectionName || 'Podcast';
          console.log('✅ Setting podcast title from Apple:', podcastName);
          setPodcastTitle(podcastName);
          
          return {
            rssUrl: rssUrl,
            podcastData: {
              id: podcast.collectionId,
              name: podcast.collectionName,
              artist: podcast.artistName,
              artwork: podcast.artworkUrl100?.replace('100x100', '600x600') || podcast.artworkUrl100,
              feedUrl: podcast.feedUrl,
              description: podcast.description || '',
              genres: podcast.genres || []
            }
          };
        }
      }
      
      console.error('❌ No RSS feed found in Apple API response');
      return null;
      
    } catch (error) {
      console.error('❌ Error converting Apple Podcasts URL:', error);
      return null;
    }
  };

  // THEN your useEffect:
  useEffect(() => {
    if (currentRssFeed) {
      loadPodcastFeed(currentRssFeed);
                    } else {
                  console.log('❌ Failed to load episodes from RSS feed');
                }
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [currentRssFeed]);

  // Set up duration and shared values
  useEffect(() => {
    if (duration > 0) {
      maxValue.value = duration;
      // Only update progress when NOT scrubbing AND position actually changed from audio playback
      if (!isScrubbing) {
        progressSharedValue.value = position;
      }
    }
  }, [duration]); // Remove position from dependencies!

  // Separate useEffect for audio playback updates
  useEffect(() => {
    // Only update shared value if we're not actively scrubbing
    if (!isScrubbing && duration > 0) {
      progressSharedValue.value = position;
    }
  }, [position, isScrubbing]);

  // RSS parsing and episode loading
  const parseRSSFeed = (xmlText, limit = null) => {
    console.log('🔍 parseRSSFeed called with XML length:', xmlText.length);
    
    try {
      // Extract <channel> section
      const channelMatch = xmlText.match(/<channel[\s\S]*?<\/channel>/);
      let channelXml = channelMatch ? channelMatch[0] : xmlText;
      // Extract podcast title from <channel>
      const channelTitleMatch = channelXml.match(/<title>(.*?)<\/title>/);
      if (channelTitleMatch) setPodcastTitle(channelTitleMatch[1].trim());
      
      const episodes = [];
      const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/g);
      
      console.log('🔍 Found items:', itemMatches ? itemMatches.length : 0);
      
      const channelImageMatch = xmlText.match(/<image[^>]*>[\s\S]*?<url>(.*?)<\/url>[\s\S]*?<\/image>/) ||
                               xmlText.match(/<itunes:image[^>]*href="([^"]*)"[^>]*\/?>/) ||
                               xmlText.match(/<image[^>]*href="([^"]*)"[^>]*\/?>/);
      const podcastArtwork = channelImageMatch?.[1] || null;
      
      if (itemMatches) {
        itemMatches.forEach((item, index) => {
          // Stop parsing after limit
          if (limit && episodes.length >= limit) return;
          
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

    
    console.log('🎧 Playing episode:', episode.title);
    console.log('🖼️ Episode artwork:', episode.artwork);
    
    // Show loading spinner
    setIsEpisodeLoading(true);
    setLoadingEpisodeTitle(episode.title);
    
    try {
      setIsLoading(true);
      
      if (sound) {
        await sound.unloadAsync();
      }
      
      // Pre-configure audio mode for faster setup
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
      // Use streaming for faster loading
      let newSound;
      try {
        const result = await Audio.Sound.createAsync(
          { uri: episode.audioUrl },
          { 
            shouldPlay: false,
            progressUpdateIntervalMillis: 1000, // Reduce update frequency
            positionMillis: 0,
            shouldCorrectPitch: false, // Disable for speed
            rate: 1.0,
            shouldRevert: false,
          }
        );
        newSound = result.sound;
      } catch (loadError) {
        throw loadError;
      }
      
      setSound(newSound);
      setSelectedEpisode(episode);
      setIsLoading(false);
      setIsEpisodeLoading(false); // Hide loading spinner
      
      // Optimized status update handler
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && !isScrubbing) {
          setPosition(status.positionMillis || 0);
          setDuration(status.durationMillis || 0);
          setIsPlaying(status.isPlaying || false);
          
          // DEBUG: Log why position might not be updating during recording
          if (newSound._isRecording && status.positionMillis % 5000 < 100) { // Log every ~5 seconds
            console.log('🎯 Recording position check:', {
              positionMillis: status.positionMillis,
              isLoaded: status.isLoaded,
              isScrubbing: isScrubbing,
              willUpdatePosition: status.isLoaded && !isScrubbing,
              isPlaying: status.isPlaying
            });
          }
          
          // Check if we need to stop recording - allow slight buffer for final captions
          if (newSound._isRecording && status.positionMillis >= (newSound._recordingClipEnd + 500)) {
            console.log('🎵 Audio reached clip end + buffer - stopping recording', {
              position: status.positionMillis,
              clipEnd: newSound._recordingClipEnd,
              buffer: 500,
              isRecording: newSound._isRecording
            });
            
            // IMMEDIATELY clear all recording flags to prevent repeated calls
            newSound._isRecording = false;
            setIsRecording(false);  // Also clear React state immediately
            
            // Clear timer to prevent double stopping
            if (recordingTimerRef.current) {
              clearTimeout(recordingTimerRef.current);
              recordingTimerRef.current = null;
            }
            
            stopVideoRecording();
          }
        }
      });
      
    } catch (error) {

      
      setIsLoading(false);
      setIsEpisodeLoading(false); // Hide loading spinner on error
      Alert.alert('Error', `Failed to load episode: ${error.message}`);
    }
  };

  // Audio control handlers
  const handleBack = () => {
    setSelectedEpisode(null);
    setClipStart(null);
    setClipEnd(null);
    setIsPreviewMode(false);
    captionService.reset(); // Reset CaptionService when going back
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



  const handleSkip1Backward = async () => {
    if (sound) {
      const newPosition = Math.max(0, position - 1000);
      await sound.setPositionAsync(newPosition);
    }
  };

  const handleSkip1Forward = async () => {
    if (sound && duration) {
      const newPosition = Math.min(duration, position + 1000);
      await sound.setPositionAsync(newPosition);
    }
  };

  const handleClearClip = () => {
    setClipStart(null);
    setClipEnd(null);
    setCaptionsEnabled(false);
    captionService.reset(); // Reset CaptionService when clearing clip
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

  // Clean UI Selection Functions
  const handleStartClipSelection = () => {
    if (!selectedEpisode || !sound) {
      Alert.alert('No Episode', 'Please select and load an episode first');
      return;
    }
    
    if (typeof position !== 'number' || position === null || position === undefined) {
      console.error('Position is not a valid number:', position);
      Alert.alert('Error', 'Unable to get current position');
      return;
    }
    
    // Set start point to current position
    setClipStart(position);
    setIsSelectionMode(true);
    setSelectionStep('end');
    Alert.alert('Clip Start Set', `Start: ${formatTime(position)}\n\nTap the scrubber to set the end point`);
  };

  const handleScrubberTap = (value) => {
    if (isSelectionMode && selectionStep === 'end') {
      const clipLength = value - clipStart;
      if (clipLength > 240000) { // 4 minutes = 240,000 milliseconds
        Alert.alert('Clip Too Long', 'Clips must be 4 minutes or less');
        return;
      }
      if (clipLength < 5000) { // 5 seconds minimum
        Alert.alert('Clip Too Short', 'Clips must be at least 5 seconds long');
        return;
      }
      
      setClipEnd(value);
      setIsSelectionMode(false);
      setSelectionStep('idle');
      Alert.alert('Clip Ready!', `Clip: ${formatTime(clipStart)} - ${formatTime(value)}\n\nTap "Record Clip" to create your video`);
    }
  };

  const handleClearSelection = () => {
    setClipStart(null);
    setClipEnd(null);
    setIsSelectionMode(false);
    setSelectionStep('idle');
    setCaptionsEnabled(false);
    captionService.reset(); // Reset CaptionService when clearing selection
  };

  const handleSetClipEnd = () => {
    if (!selectedEpisode || !sound) {
      Alert.alert('No Episode', 'Please select and load an episode first');
      return;
    }
    
    const clipLength = position - clipStart;
    console.log('🎬 Clip length check:', {
      start: clipStart,
      end: position,
      length: clipLength,
      lengthInSeconds: clipLength / 1000,
      maxAllowed: 240000
    });
    
    if (clipLength > 240000) { // 4 minutes = 240,000 milliseconds
      Alert.alert('Clip Too Long', `Clip length: ${Math.round(clipLength / 1000)}s. Clips must be 4 minutes or less`);
      return;
    }
    if (clipLength < 5000) { // 5 seconds minimum
      Alert.alert('Clip Too Short', `Clip length: ${Math.round(clipLength / 1000)}s. Clips must be at least 5 seconds long`);
      return;
    }
    
    setClipEnd(position);
    setIsSelectionMode(false);
    setSelectionStep('idle');
    Alert.alert('Clip Ready!', `Clip: ${formatTime(clipStart)} - ${formatTime(position)}\n\nTap "Record Clip" to create your video`);
  };

  // 1. PROCESSING MODAL
  const ProcessingModal = () => (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 99999,
    }}>
      <View style={{
        backgroundColor: '#2d2d2d',
        borderRadius: 16,
        padding: 24,
        marginHorizontal: 20,
        borderWidth: 2,
        borderColor: '#d97706',
        minWidth: 300,
      }}>
        <Text style={{
          color: '#f4f4f4',
          fontSize: 18,
          fontWeight: '600',
          textAlign: 'center',
          marginBottom: 16,
        }}>
          Preparing Your Clip
        </Text>
        
        <Text style={{
          color: '#b4b4b4',
          fontSize: 14,
          lineHeight: 20,
          marginBottom: 20,
          textAlign: 'center',
        }}>
          {processingStep}
        </Text>
        
        <Text style={{
          color: '#d97706',
          fontSize: 12,
          textAlign: 'center',
          fontStyle: 'italic',
        }}>
          Please don't switch apps or lock your phone
        </Text>
      </View>
    </View>
  );

  // 2. FINAL WORKING MODAL
  const RecordingGuidanceModal = () => (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 99999,
    }}>
      <View style={{
        backgroundColor: '#2d2d2d',
        borderRadius: 16,
        padding: 24,
        marginHorizontal: 20,
        borderWidth: 2,
        borderColor: '#d97706',
        minWidth: 300,
      }}>
        <Text style={{
          color: '#f4f4f4',
          fontSize: 18,
          fontWeight: '600',
          textAlign: 'center',
          marginBottom: 16,
        }}>
          Ready to make your Audio2 clip!
        </Text>
        
        <Text style={{
          color: '#b4b4b4',
          fontSize: 14,
          lineHeight: 20,
          marginBottom: 16,
        }}>
          • Keep your screen on during recording{`\n`}
          • Don't switch apps or lock your phone{`\n`}
          • The recording will start automatically{`\n`}
          • Your clip will be saved to Photos when complete
        </Text>
        
        <Text style={{
          color: '#d97706',
          fontSize: 12,
          lineHeight: 16,
          marginBottom: 20,
          textAlign: 'center',
          fontStyle: 'italic',
        }}>
          iOS will ask for screen recording permission. Tap "Start Recording" to allow Audio2 to capture your screen and audio for the video clip.
        </Text>
        
        <TouchableOpacity 
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 24,
          }}
          onPress={() => setDontShowGuidanceAgain(!dontShowGuidanceAgain)}
        >
          <View style={{
            width: 20,
            height: 20,
            borderWidth: 2,
            borderColor: dontShowGuidanceAgain ? '#d97706' : '#404040',
            backgroundColor: dontShowGuidanceAgain ? '#d97706' : 'transparent',
            borderRadius: 4,
            marginRight: 8,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            {dontShowGuidanceAgain && (
              <MaterialCommunityIcons name="check" size={16} color="#f4f4f4" />
            )}
          </View>
          <Text style={{
            color: '#b4b4b4',
            fontSize: 14,
          }}>
            Don't show this again
          </Text>
        </TouchableOpacity>
        
        <View style={{
          flexDirection: 'row',
          gap: 12,
        }}>
          <TouchableOpacity 
            style={{
              flex: 1,
              backgroundColor: '#404040',
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: 'center',
            }}
            onPress={() => setShowRecordingGuidance(false)}
          >
            <Text style={{
              color: '#f4f4f4',
              fontSize: 14,
              fontWeight: '500',
            }}>
              Cancel
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={{
              flex: 1,
              backgroundColor: '#d97706',
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: 'center',
            }}
            onPress={() => {
              setShowRecordingGuidance(false);
              setShowRecordingView(true);
            }}
          >
            <Text style={{
              color: '#f4f4f4',
              fontSize: 14,
              fontWeight: '600',
            }}>
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // BULLETPROOF: Video creation with comprehensive error handling
  const handleCreateVideo = async () => {
    console.log('🎬 === HANDLE CREATE VIDEO CALLED ===');
    console.log('🎬 Function entry state:', {
      clipStart,
      clipEnd,
      selectedEpisode: selectedEpisode?.title,
      isGeneratingCaptions,
      captionsEnabled
    });
    
    // Guard: Prevent multiple simultaneous calls
    if (isGeneratingCaptions) {
      console.log('🎬 Already generating captions, ignoring duplicate call');
      return;
    }
    
    if (clipStart === null || clipEnd === null) {
      console.log('🎬 Validation failed: clipStart or clipEnd is null');
      Alert.alert('No Clip Selected', 'Please select start and end points first');
      return;
    }
    
    if (!selectedEpisode) {
      console.log('🎬 Validation failed: no selectedEpisode');
      Alert.alert('No Episode', 'Please select an episode first');
      return;
    }

    // Stop audio playback when entering Create Video mode
    if (sound) {
      try {
        console.log('🎵 Stopping audio for video creation...');
        console.log('🎵 Sound object state:', {
          isLoaded: sound._loaded,
          isPlaying: sound._playing,
          position: sound._position
        });
        
        await sound.stopAsync();
        setIsPlaying(false);
        console.log('🎵 Audio stopped for video creation');
      } catch (error) {
        console.error('🎵 Error stopping audio:', error);
      }
    } else {
      console.log('🎵 No sound object available');
    }

    // BULLETPROOF: Reset CaptionService for new clip
    if (captionsEnabled) {
      console.log('🎬 Clip selection - Start:', clipStart, 'End:', clipEnd, 'Duration:', clipEnd - clipStart);
      
      // CRITICAL: Reset CaptionService state for new clip
      captionService.reset();
      
      setIsGeneratingCaptions(true);
      
      // Show processing modal with step-by-step feedback
      setShowProcessingModal(true);
      setProcessingStep('Preparing your audio clip...');
      
      try {
        // Step 1: Get timing info from Railway
        setProcessingStep('Preparing your audio clip...');
        const trimResponse = await trimAudioToClip(selectedEpisode.audioUrl, clipStart, clipEnd);
        
        // Step 2: Submit job with AssemblyAI's built-in trimming
        // NOTE: We send the full podcast URL but use audio_start_from/audio_end_at
        // AssemblyAI handles the clipping server-side (more efficient than downloading/re-uploading)
        setProcessingStep('Sending clip to transcription service...');
        
        console.log('🎬 === ASSEMBLYAI SUBMISSION DEBUG ===');
        const assemblyAIPayload = {
          audio_url: trimResponse.audioUrl, // Original podcast URL
          audio_start_from: clipStart, // Use clipStart directly (already in milliseconds)
          audio_end_at: clipEnd, // Use clipEnd directly (already in milliseconds)
          punctuate: true,
          format_text: true,
          speaker_labels: true,
          speakers_expected: 2,
          word_boost: []
        };

        console.log('🎬 AssemblyAI Request Payload:', {
          audio_url: assemblyAIPayload.audio_url.substring(0, 100) + '...',
          audio_start_from: assemblyAIPayload.audio_start_from,
          audio_end_at: assemblyAIPayload.audio_end_at,
          clip_duration_ms: assemblyAIPayload.audio_end_at - assemblyAIPayload.audio_start_from,
          clip_duration_seconds: (assemblyAIPayload.audio_end_at - assemblyAIPayload.audio_start_from) / 1000,
          start_time_seconds: assemblyAIPayload.audio_start_from / 1000,
          end_time_seconds: assemblyAIPayload.audio_end_at / 1000,
          speaker_labels: assemblyAIPayload.speaker_labels,
          speakers_expected: assemblyAIPayload.speakers_expected
        });

        // CRITICAL: Log exact URLs for CDN debugging
        console.log('🌐 === URL CONSISTENCY DEBUG ===');
        console.log('🌐 Original Episode URL:', selectedEpisode?.audioUrl);
        console.log('🌐 TrimResponse URL:', trimResponse.audioUrl);
        console.log('🌐 AssemblyAI Payload URL:', assemblyAIPayload.audio_url);
        console.log('🌐 URLs Match Original?', {
          trimResponseMatchesOriginal: trimResponse.audioUrl === selectedEpisode?.audioUrl,
          assemblyAIMatchesOriginal: assemblyAIPayload.audio_url === selectedEpisode?.audioUrl,
          allUrlsMatch: trimResponse.audioUrl === selectedEpisode?.audioUrl && assemblyAIPayload.audio_url === selectedEpisode?.audioUrl
        });
        
        // Verify the timing makes sense for the selected episode
        console.log('🎬 Episode Context Check:', {
          selectedEpisodeTitle: selectedEpisode?.title?.substring(0, 50) + '...',
          selectedEpisodeAudioUrl: selectedEpisode?.audioUrl?.substring(0, 100) + '...',
          urlsMatch: assemblyAIPayload.audio_url === selectedEpisode?.audioUrl,
          clipStartFormatted: formatTime(clipStart),
          clipEndFormatted: formatTime(clipEnd)
        });

        // Debug: Log the exact payload being sent to Railway
        console.log('🚨 RAILWAY DEBUG - Payload being sent:', JSON.stringify(assemblyAIPayload, null, 2));

        const submitResponse = await fetch('https://audio-trimmer-service-production.up.railway.app/api/transcript', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(assemblyAIPayload)
        });
          
        const job = await submitResponse.json();

        console.log('🎬 AssemblyAI Job Created:', {
          jobId: job.id,
          status: job.status,
          hasError: !!job.error,
          error: job.error || 'None',
          response: JSON.stringify(job, null, 2).substring(0, 200) + '...'
        });
        
        if (!job.id) {
          throw new Error(`AssemblyAI submission failed: ${job.error || 'Unknown error'}`);
        }
        
        console.log('🎬 Assembly job created:', job.id, 'Status:', job.status);
        
        // Step 2: Wait and check (simple polling)
        setProcessingStep('Transcribing your clip...');
        let attempts = 0;
        
        while (attempts < 24) { // 2 minutes max (24 * 5 seconds)
          // Update with engaging message based on timing
          if (attempts === 1) {
            setProcessingStep('Transcribing: This part is super interesting!');
          } else if (attempts === 2) {
            setProcessingStep('Transcribing: Ohhh, genius point...');
          } else if (attempts === 4) {
            setProcessingStep('Transcribing: Almost there, almost there...');
          } else if (attempts >= 6) {
            setProcessingStep('Transcribing: This is taking awhile; I swear I\'m working');
          }
          
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          const checkResponse = await fetch(`https://audio-trimmer-service-production.up.railway.app/api/transcript/${job.id}`, {
            headers: { 'Content-Type': 'application/json' }
          });
          
          const result = await checkResponse.json();
          
                      if (result.status === 'completed') {
              setProcessingStep('Done!');
              
              console.log('🎬 === ASSEMBLYAI RESPONSE DEBUG ===');
              console.log('🎬 AssemblyAI Completed Successfully');
              
              // Log the raw response structure
              console.log('🎬 Raw Response Analysis:', {
                hasText: !!result.text,
                textLength: result.text?.length || 0,
                textPreview: result.text?.substring(0, 100) + '...',
                hasWords: !!result.words?.length,
                wordCount: result.words?.length || 0,
                hasUtterances: !!result.utterances?.length,
                utteranceCount: result.utterances?.length || 0,
                hasSpeakerLabels: !!result.speaker_labels
              });
              
              // Log first few words to verify they match expected audio
              if (result.words?.length > 0) {
                console.log('🎬 First 5 Words from AssemblyAI:', 
                  result.words.slice(0, 5).map(w => ({
                    text: w.text,
                    start: w.start,
                    end: w.end,
                    startSeconds: (w.start / 1000).toFixed(1),
                    endSeconds: (w.end / 1000).toFixed(1)
                  }))
                );
              }
              
              // Log utterance breakdown
              if (result.utterances?.length > 0) {
                console.log('🎬 Utterance Breakdown from AssemblyAI:', 
                  result.utterances.map((u, i) => ({
                    index: i,
                    speaker: u.speaker,
                    startSeconds: (u.start / 1000).toFixed(1),
                    endSeconds: (u.end / 1000).toFixed(1),
                    duration: ((u.end - u.start) / 1000).toFixed(1),
                    textPreview: u.text.substring(0, 50) + '...'
                  }))
                );
              }
              
              // CRITICAL: Compare what we requested vs what we got
              console.log('🎬 Request vs Response Verification:', {
                requestedStartMs: clipStart,
                requestedEndMs: clipEnd,
                requestedDuration: (clipEnd - clipStart) / 1000,
                responseFirstWordMs: result.words?.[0]?.start || 'No words',
                responseLastWordMs: result.words?.[result.words?.length - 1]?.end || 'No words',
                responseDuration: result.words?.length > 0 ? 
                  ((result.words[result.words.length - 1].end - result.words[0].start) / 1000).toFixed(1) : 'Unknown'
              });
              
              // Most important: Does the returned text make sense for the selected clip?
              console.log('🎬 CONTENT VERIFICATION:');
              console.log('🎬 What AssemblyAI returned:', result.text?.substring(0, 200) + '...');
              console.log('🎬 Expected audio content: [MANUAL VERIFICATION NEEDED]');
              console.log('🎬 Do these match what you hear? ☝️');
              
              // After AssemblyAI completes, log the raw response structure:
              console.log('🔍 AssemblyAI Raw Response Structure:', {
                hasUtterances: !!result.utterances,
                utterancesLength: result.utterances?.length || 0,
                hasSegments: !!result.segments, 
                segmentsLength: result.segments?.length || 0,
                hasWords: !!result.words,
                wordsLength: result.words?.length || 0,
                speakerLabels: result.speaker_labels,
                firstUtterance: result.utterances?.[0],
                firstSegment: result.segments?.[0]
              });
              
              const words = result.words || [];
              console.log('🎬 Assembly completed! Captions ready');
              
              if (words.length > 0) {
                // File upload only - timestamps already start from 0, no normalization needed
                console.log('🎬 Using FILE UPLOAD response - timestamps start from 0, no normalization needed');
                console.log('🔍 AssemblyAI File URL:', result.audio_url);
                
                // Store the raw AssemblyAI response - no normalization needed for file upload
                const processedUtterances = result.utterances?.map(utterance => ({
                  ...utterance,
                  startMs: utterance.start,  // No clipStart subtraction needed
                  endMs: utterance.end,      // No clipStart subtraction needed
                  text: utterance.text,
                  speaker: utterance.speaker,
                  normalized: true
                })) || [];
                
                const normalizedResult = {
                  ...result,
                  // Keep original AssemblyAI structure - timestamps are already clip-relative
                  words: result.words || [],
                  utterances: processedUtterances  // These are NOW normalized
                };
                
                // Set up CaptionService with the transcript
                captionService.setTranscript(normalizedResult, clipStart, clipEnd);
                
                // Store prepared transcript for simple caption overlay
                setPreparedTranscript(normalizedResult);
                console.log('🎬 Captions ready for', words.length, 'words');
                
                // BULLETPROOF: Debug info for new system
                if (__DEV__) {
                  console.log('🎬 CaptionService debug info:', captionService.getDebugInfo());
                }
                
                // BULLETPROOF: Log what we're storing in the transcript
                console.log('🔍 Stored Transcript Structure:', {
                  hasWords: !!normalizedResult.words,
                  wordsLength: normalizedResult.words?.length || 0,
                  hasUtterances: !!normalizedResult.utterances,
                  utterancesLength: normalizedResult.utterances?.length || 0,
                  firstWord: normalizedResult.words?.[0],
                  firstUtterance: normalizedResult.utterances?.[0]
                });
              } else {
                // Fallback: use the full text
                console.log('🎬 No words data, using full text fallback');
                
                // BULLETPROOF: Same approach - no normalization needed for file upload
                const processedUtterances = result.utterances?.map(utterance => ({
                  ...utterance,
                  startMs: utterance.start,  // No clipStart subtraction needed
                  endMs: utterance.end,      // No clipStart subtraction needed
                  text: utterance.text,
                  speaker: utterance.speaker,
                  normalized: true
                })) || [];
                
                const normalizedResult = {
                  ...result,
                  words: result.words || [],
                  utterances: processedUtterances  // These are NOW normalized
                };
                
                // Set up CaptionService with the transcript
                captionService.setTranscript(normalizedResult, clipStart, clipEnd);
                setPreparedTranscript(normalizedResult);
              }
              break;
            }
          
          if (result.status === 'error') {
            throw new Error('Transcription failed');
          }
          
          attempts++;
        }
        
        if (attempts >= 24) {
          throw new Error('Timeout');
        }
        
      } catch (error) {
        console.error('🎬 CRITICAL: Caption generation failed:', error);
        console.error('🎬 Error details:', {
          message: error.message,
          stack: error.stack,
          clipStart,
          clipEnd,
          selectedEpisode: selectedEpisode?.title
        });
        
        // BULLETPROOF: Don't disable captions on error, just log and continue
        setPreparedTranscript(null);
        captionService.reset(); // Reset CaptionService on error
        
        // Show user-friendly error message
        Alert.alert(
          'Caption Generation Failed', 
          'Continuing without captions. You can still record your clip.',
          [{ text: 'OK' }]
        );
      }
      
      setIsGeneratingCaptions(false);
      setShowProcessingModal(false); // Close processing modal
    } else {
      // Captions disabled - clear any existing caption data
      console.log('🎬 Captions disabled - proceeding without captions');
      setPreparedTranscript(null);
      captionService.reset(); // Reset CaptionService when captions disabled
      setIsGeneratingCaptions(false);
    }



    // Proceed with existing video creation
    // Stop audio playback when entering Create Video mode
    if (sound && isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
    }
    
    // Ensure sound is loaded before proceeding
    if (!sound || !sound._loaded) {
      console.log('🎬 Sound not loaded, loading now...');
      await loadEpisode(selectedEpisode);
    }
    
    if (!dontShowGuidanceAgain) {
      setShowRecordingGuidance(true);
    } else {
      setShowRecordingView(true);
    }
  };

  // Add caption status info display (optional)
  const getCaptionStatusText = () => {
    if (!captionsEnabled) return '';
    if (isGeneratingCaptions) return 'Generating captions...';
    if (preparedTranscript) return 'Captions ready';
    return '';
  };



// Test function for CaptionService (temporary debugging)
  const testCaptions = () => {
    console.log('🧪 Caption Test:', {
      enabled: captionsEnabled,
      currentTime: position,
      debugInfo: captionService.getDebugInfo(),
      currentCaption: captionService.getCurrentCaption(position)
    });
  };

  // Audio trimming function - returns timing info for AssemblyAI
  const trimAudioToClip = async (audioUrl, startMs, endMs) => {
    try {
      console.log('🎵 Getting timing info for clip:', startMs, 'to', endMs, 'ms');
      
      // CRITICAL: Test URL resolution on device for CDN debugging
      console.log('🌐 === AUDIO2 URL RESOLUTION DEBUG ===');
      console.log('🌐 Audio2 will send URL:', audioUrl);
      try {
        const parsedUrl = new URL(audioUrl);
        console.log('🌐 URL Domain:', parsedUrl.hostname);
        console.log('🌐 URL Path:', parsedUrl.pathname);
        console.log('🌐 URL Query:', parsedUrl.search);
      } catch (urlError) {
        console.log('🌐 URL parsing failed:', urlError.message);
      }
      
      // Use original URL - no resolution to avoid CDN session mismatch
      
      // Call Railway server for timing validation
      const response = await fetch('https://audio-trimmer-service-production.up.railway.app/api/trim-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrl: audioUrl, // Use original URL to maintain CDN session
          start: startMs,
          end: endMs
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('🎵 Server response:', result.message);
        console.log('🎵 Timing info:', { startTime: result.startTime, endTime: result.endTime, duration: result.duration });
        
        return result; // Return the full response object
      } else {
        console.error('🎵 Server error:', result.error);
        // Fallback: return basic timing info with resolved URL
        return {
          audioUrl: audioUrl, // Use original URL to maintain CDN session
          startTime: startMs / 1000,
          endTime: endMs / 1000,
          duration: (endMs - startMs) / 1000
        };
      }
      
    } catch (error) {
      console.error('🎵 Audio trimming failed:', error);
      // Fallback: return basic timing info with resolved URL
      return {
        audioUrl: resolvedAudioUrl, // Use resolved URL for consistency
        startTime: startMs / 1000,
        endTime: endMs / 1000,
        duration: (endMs - startMs) / 1000
      };
    }
  };

  // Emergency cleanup - ONLY touches recording state, preserves audio/caption state
  const emergencyRecordingCleanup = async () => {
    if (recordingCleanupState.isCleanupInProgress) {
      console.log('🔄 Cleanup already in progress');
      return;
    }

    setRecordingCleanupState(prev => ({ ...prev, isCleanupInProgress: true }));
    
    try {
      console.log('🧹 Emergency recording cleanup (preserving audio state)...');
      
      // 🔋 DEACTIVATE WAKE LOCK in emergency cleanup
      KeepAwake.deactivateKeepAwake();
      console.log('🔋 Emergency wake lock deactivation');
      
      // Clear ONLY recording timers (not audio position tracking)
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      if (window.audioStatusCheckInterval) {
        clearInterval(window.audioStatusCheckInterval);
        window.audioStatusCheckInterval = null;
      }
      
      // Stop screen recording if active - use try/catch to prevent crashes
      try {
        await ScreenRecorder.stopRecording();
        console.log('📹 Stopped active recording during cleanup');
      } catch (error) {
        console.log('⚠️ Error stopping recording during cleanup:', error.message);
        // Don't throw - we're in cleanup mode
      }
      
      // Reset ONLY recording-related state (preserve audio/caption state)
      setIsRecording(false);
      setIsRecordingActive(false);
      setRecordingStatus('');
      setShowRecordingView(false);
      
      // DON'T touch these - they affect captions:
      // - Don't pause audio (let user control)
      // - Don't reset audio position
      // - Don't change currentTimeMs tracking
      // - Don't modify sound playback state
      
    } catch (error) {
      console.error('❌ Emergency cleanup failed:', error);
      setRecordingCleanupState(prev => ({ ...prev, hadRecordingError: true }));
    } finally {
      setRecordingCleanupState(prev => ({ ...prev, isCleanupInProgress: false }));
    }
  };

  const startVideoRecording = async () => {

    
    // Guard: Don't start if cleanup is in progress
    if (recordingCleanupState.isCleanupInProgress) {
      console.log('⚠️ Recording cleanup in progress, waiting...');
      return;
    }
    
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

      // 🔋 ACTIVATE WAKE LOCK - Prevent device sleep during recording
      KeepAwake.activateKeepAwake();
      console.log('🔋 Wake lock activated - device will stay awake during recording');

      setRecordingStatus('Starting recording...');
      
      // 🎯 KEY: Set isRecording=true BEFORE starting ReplayKit
      setIsRecording(true);
      
      // Start screen recording with microphone disabled (we want app audio only)
      const micEnabled = false;
      console.log('📹 Starting screen recording with mic disabled...');
      await ScreenRecorder.startRecording(micEnabled);
      console.log('📹 Screen recording started successfully');
      
      setRecordingStatus('Recording in progress...');
      
      // Seek to clip start and play
      console.log('🎵 Seeking to clip start:', clipStart);
      console.log('🎯 Position state before seek:', position);
      await sound.setPositionAsync(clipStart);
      console.log('🎵 Starting audio playback');
      await sound.playAsync();
      console.log('🎵 Audio playback started');
      console.log('🎯 Position state after playback start:', position);
      
      // Stop recording after clip duration + 1 second buffer for captions
      const clipDuration = clipEnd - clipStart;
      const recordingDuration = clipDuration + 1000; // Add 1 second buffer
      console.log('🎬 Starting recording timer:', { clipStart, clipEnd, clipDuration, recordingDuration });
      recordingTimerRef.current = setTimeout(async () => {
        console.log('⏰ Recording timer expired - stopping recording');
        await stopVideoRecording();
      }, recordingDuration);
      
      // Set a flag to indicate we're recording so the existing callback can handle stopping
      sound._isRecording = true;
      sound._recordingClipEnd = clipEnd;
      console.log('🎬 Set recording flags:', { isRecording: sound._isRecording, clipEnd: sound._recordingClipEnd });
      
      // Add a periodic check to debug recording state
      // Debug logging removed to prevent white screen during recording
      // Position and recording state are monitored by audio status callback
      
    } catch (error) {
      console.error('Recording error:', error);
      setRecordingStatus(`Error: ${error.message}`);
      setIsRecording(false); // Reset on error
      
      // 🔋 DEACTIVATE WAKE LOCK on error
      KeepAwake.deactivateKeepAwake();
      console.log('🔋 Wake lock deactivated due to recording error');
      
      Alert.alert(
        'Recording Error',
        `Could not start screen recording: ${error.message}`,
        [{ text: 'OK', onPress: () => setShowRecordingView(false) }]
      );
    }
  };

  const stopVideoRecording = async () => {
    console.log('🛑 stopVideoRecording called', {
      isCleanupInProgress: recordingCleanupState.isCleanupInProgress,
      isRecording: isRecording,
      soundIsRecording: sound?._isRecording,
      position: position,
      clipEnd: clipEnd,
      hasTimer: !!recordingTimerRef.current
    });
    
    // Guard: Don't stop if cleanup is in progress
    if (recordingCleanupState.isCleanupInProgress) {
      console.log('⚠️ Cleanup already in progress');
      return;
    }
    
    // ALWAYS proceed with cleanup - the fact that this function was called means we need to clean up
    // The flags might be temporarily out of sync due to async React state updates
    console.log('🧹 Proceeding with cleanup regardless of flag states');
    
    // Set cleanup flag to prevent multiple calls
    recordingCleanupState.isCleanupInProgress = true;
    
    // IMMEDIATE: Clear timer and stop audio to prevent continued calls
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
      console.log('⏰ Recording timer cleared');
    }
    
    // DON'T pause audio immediately - let it continue playing for caption display
    // Audio will be paused when user dismisses the recording view
    console.log('🎵 Keeping audio playing to maintain caption display');
    
    // 🔋 DEACTIVATE WAKE LOCK - Allow device to sleep again
    KeepAwake.deactivateKeepAwake();
    console.log('🔋 Wake lock deactivated - device can sleep again');
    
    // Clean up recording flags  
    if (sound) {
      sound._isRecording = false;
      sound._recordingClipEnd = null;
      console.log('🧹 Cleaned up recording flags');
    }
    
    try {
      setRecordingStatus('Stopping recording...');
      
      // Keep audio playing - don't pause it here to maintain caption display
      console.log('🎵 Audio continues playing for caption display');
      
      // Stop recording and get the URI - with crash protection
      let outputUrl = null;
      try {
        console.log('📹 Attempting to stop screen recording...');
        outputUrl = await ScreenRecorder.stopRecording();
        console.log('📹 Recording stopped successfully, outputUrl:', outputUrl);
      } catch (stopError) {
        console.error('❌ Critical: Failed to stop recording:', stopError);
        // This is the error that was causing crashes
        throw new Error(`Stop recording failed: ${stopError.message}`);
      }
      
      setRecordingStatus('Saving to Photos...');
      
      // Save to Photos app
      if (outputUrl) {
        await MediaLibrary.saveToLibraryAsync(outputUrl);
        setRecordingStatus('Video saved to Photos!');
        
        setRecordingStatus('Video saved to Photos!');
        
        Alert.alert(
          'Video Created!',
          'Your podcast clip has been saved to Photos. You can now share it on social media.',
          [
            { text: 'OK', onPress: async () => {
              // Stop audio playback and reset position when returning to episode detail page
              if (sound) {
                await sound.pauseAsync();
                setIsPlaying(false);
                // Reset position to clip start so user can replay the clip
                if (clipStart !== null) {
                  await sound.setPositionAsync(clipStart);
                  setPosition(clipStart);
                }
                console.log('🎵 Audio stopped and reset to clip start when returning to episode detail page');
              }
              setShowRecordingView(false);
              setRecordingStatus('');
              setIsRecording(false); // Reset recording state
            }}
          ]
        );
      } else {
        setRecordingStatus('Failed to save recording. Try again.');
        setIsRecording(false); // Reset on failure
      }
      
    } catch (error) {
      console.error('Stop recording error:', error);
      setRecordingStatus(`Error: ${error.message}`);
      setIsRecording(false); // Reset on error
      
      // 🔋 DEACTIVATE WAKE LOCK on error
      KeepAwake.deactivateKeepAwake();
      console.log('🔋 Wake lock deactivated due to stop recording error');
    } finally {
      // Always clear cleanup flag so future recordings can work
      recordingCleanupState.isCleanupInProgress = false;
      console.log('🧹 Recording cleanup completed');
    }
  };

  // Cleanup function to handle recording state when exiting
  const cleanupRecording = async () => {
    console.log('🧹 cleanupRecording called');
    
    // 🔋 DEACTIVATE WAKE LOCK during cleanup
    KeepAwake.deactivateKeepAwake();
    console.log('🔋 Wake lock deactivated during cleanup');
    
    try {
      // Clear the recording timer
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
        console.log('🧹 Cleared recording timer');
      }
      
      // Clean up recording flags
      if (sound) {
        sound._isRecording = false;
        sound._recordingClipEnd = null;
        console.log('🧹 Cleaned up recording flags');
      }
      
      // Also reset the React state to match
      setIsRecording(false);
      
      // Clear any audio status check intervals
      if (window.audioStatusCheckInterval) {
        clearInterval(window.audioStatusCheckInterval);
        window.audioStatusCheckInterval = null;
        console.log('🧹 Cleared audio status check interval');
      }
      
      // 🔧 NEW: Stop monitoring state
      setIsRecordingActive(false);
      
      if (isRecording) {
        await ScreenRecorder.stopRecording();
        console.log('Cleaned up recording state');
      }
      
      // Stop audio playback when cleaning up
      if (sound) {
        await sound.pauseAsync();
        setIsPlaying(false);
        console.log('🎵 Audio stopped during cleanup');
      }
      
      // Clean up voice recognition if it's active
      if (isListening) {
        console.log('🧹 Cleaning up voice recognition...');
        await VoiceManager.stopListening();
        setIsListening(false);

      }
    } catch (error) {
      console.log('Cleanup recording error:', error.message);
    } finally {
      setIsRecording(false);
      setRecordingStatus('');
    }
  };

  // Enhanced URL input handler with Apple Podcasts support
  const handleUrlSubmit = async () => {
    console.log('🔴 handleUrlSubmit called! urlInput:', urlInput);
    
    const trimmedUrl = urlInput.trim();
    
    if (!trimmedUrl) {
      console.log('❌ Empty URL');
      Alert.alert('Error', 'Please enter a podcast URL');
      return;
    }
    
    console.log('📍 Trimmed URL:', trimmedUrl);
    
    // Basic URL validation
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      console.log('❌ URL missing protocol');
      Alert.alert('Error', 'URL must start with http:// or https://');
      return;
    }
    
    try {
      let rssUrl = trimmedUrl;
      let podcastData = null;
      
      // Handle Apple Podcasts URLs
      if (trimmedUrl.includes('podcasts.apple.com')) {
        console.log('🍎 Apple Podcasts URL detected, converting...');
        
        const result = await getApplePodcastsRssUrl(trimmedUrl);
        if (result && result.rssUrl) {
          rssUrl = result.rssUrl;
          podcastData = result.podcastData;
          console.log('✅ Converted to RSS URL:', rssUrl);
        } else {
          Alert.alert(
            'RSS Feed Not Found', 
            'Could not find RSS feed for this Apple Podcasts URL. Please try a different podcast.'
          );
          setUrlInput('');
          return;
        }
      } else {
        // For RSS URLs, try to find the podcast in Apple Podcasts
        console.log('🔍 RSS URL detected, searching Apple Podcasts for podcast data...');
        try {
          // Extract podcast name from RSS feed first
          const response = await fetch(trimmedUrl);
          const xmlText = await response.text();
          
          // Extract podcast title from RSS
          const channelTitleMatch = xmlText.match(/<channel[\s\S]*?<title>(.*?)<\/title>/);
          const podcastTitle = channelTitleMatch ? channelTitleMatch[1].trim() : null;
          
          if (podcastTitle) {
            console.log('🔍 Found podcast title in RSS:', podcastTitle);
            // Search Apple Podcasts for this podcast
            const searchResults = await searchPodcasts(podcastTitle);
            if (searchResults.length > 0) {
              // Use the first result as it's likely the best match
              podcastData = searchResults[0];
              console.log('✅ Found matching podcast in Apple Podcasts:', podcastData.name);
            }
          }
        } catch (error) {
          console.log('❌ Error searching Apple Podcasts:', error);
        }
      }
      
      // Store podcast data if we found it
      if (podcastData && podcastData.artwork) {
        await AsyncStorage.setItem(`podcast_artwork_${rssUrl}`, podcastData.artwork);
        console.log('✅ Stored Apple Podcasts artwork for RSS feed:', podcastData.artwork);
      }
      
      // Load the RSS feed - loadPodcastFeed handles its own loading state
      console.log('📡 Loading RSS feed:', rssUrl);
      await loadPodcastFeed(rssUrl);
      setUrlInput('');
      
    } catch (error) {
      console.error('❌ Error in handleUrlSubmit:', error);
      Alert.alert(
        'Error', 
        'Failed to load podcast. Please check the URL and try again.'
      );
    }
  };


  // Add the iTunes Search API function after your existing functions (around line 180)
  const searchPodcasts = async (searchTerm) => {
    if (!searchTerm.trim()) return [];
    
    // Abort any previous search
    if (searchAbortController.current) {
      searchAbortController.current.abort();
    }
    const controller = new AbortController();
    searchAbortController.current = controller;

    try {
      const response = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm.trim())}&media=podcast&limit=20&country=US`,
        { signal: controller.signal }
      );
      
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      const data = await response.json();
      return data.results.map(podcast => ({
        id: podcast.collectionId,
        name: podcast.collectionName,
        artist: podcast.artistName,
        artwork: podcast.artworkUrl100?.replace('100x100', '600x600') || podcast.artworkUrl100,
        feedUrl: podcast.feedUrl,
        description: podcast.description || '',
        genres: podcast.genres || []
      }));
    } catch (error) {
      if (error.name === 'AbortError') {
        // Search was cancelled
        return [];
      }
      console.error('Podcast search error:', error);
      Alert.alert('Search Error', 'Unable to search podcasts. Please check your connection.');
      return [];
    }
  };

  // Refactor handlePodcastSearch to handle both URLs and free text
  const handlePodcastSearch = useCallback(async (queryOverride, silent = false) => {
    const query = (typeof queryOverride === 'string' ? queryOverride : searchTerm).trim();
    if (!query) return;

    // If input looks like a URL, try to load as feed
    if (/^https?:\/\//i.test(query)) {
      if (!silent) setIsSearching(true);
      await loadPodcastFeed(query);
      if (!silent) setIsSearching(false);
      return;
    }

    // Otherwise, treat as search query
    if (!silent) setIsSearching(true);
    const results = await searchPodcasts(query);
    if (!silent) {
      setSearchResults(results);
      setIsSearching(false);
    }

    // If only one result and not silent, auto-select it and load its feed
    if (results.length === 1 && !silent) {
      await handleSelectPodcast(results[0]);
    }
    
    // Return results for silent searches
    return results;
  }, [searchTerm]); // ✅ Simplified dependency array - only searchTerm is needed

  // Add function to handle selecting a podcast from search
  const handleSelectPodcast = async (podcast) => {
    try {
      // Add to recent podcasts (keep last 5)
      const updatedRecents = [podcast, ...recentPodcasts.filter(p => p.id !== podcast.id)].slice(0, 5);
      setRecentPodcasts(updatedRecents);
      
      // Store the podcast artwork for use as fallback
      if (podcast.artwork) {
        await AsyncStorage.setItem(`podcast_artwork_${podcast.feedUrl}`, podcast.artwork);
        console.log('✅ Stored podcast artwork for fallback:', podcast.artwork);
      }
      
      // Load the podcast feed using existing function
      await loadPodcastFeed(podcast.feedUrl);
      
      // Fetch artwork for popular podcasts in the background
      fetchPopularPodcastsArtwork();
      
      // Exit search mode
      setSearchTerm('');
      setSearchResults([]);
    } catch (error) {
      Alert.alert('Error', 'Unable to load this podcast. Please try another.');
    }
  };

  // Add a cancel handler
  const handleCancelSearch = () => {
    if (searchAbortController.current) {
      searchAbortController.current.abort();
      searchAbortController.current = null;
    }
    setIsSearching(false);
  };

  // Component cleanup - only recording state
  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting - cleanup recording state only');
      // Clear timers but don't touch audio/caption state
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
      }
      if (window.audioStatusCheckInterval) {
        clearInterval(window.audioStatusCheckInterval);
      }
    };
  }, []);



  const handleProgressBarPress = (e) => {
    if (duration > 0) {
      const { locationX } = e.nativeEvent;
      const containerWidth = screenWidth - 40;
      const seekPosition = (locationX / containerWidth) * duration;
      handleSeekToPosition(Math.max(0, Math.min(seekPosition, duration)));
    }
  };

  // Episode notes bottom sheet functions
  const showEpisodeNotesSheet = () => {
    setShowEpisodeNotes(true);
    notesOpacity.value = withTiming(1, { duration: 300 });
    notesTranslateY.value = withSpring(0, {
      damping: 20,
      stiffness: 300,
      mass: 0.8,
    });
  };

  const hideEpisodeNotesSheet = () => {
    notesOpacity.value = withTiming(0, { duration: 300 });
    notesTranslateY.value = withSpring(screenHeight, {
      damping: 20,
      stiffness: 300,
      mass: 0.8,
    }, () => {
      runOnJS(setShowEpisodeNotes)(false);
    });
  };

  const handleNotesPanGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        notesTranslateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 500) {
        hideEpisodeNotesSheet();
      } else {
        notesTranslateY.value = withSpring(0, {
          damping: 20,
          stiffness: 300,
          mass: 0.8,
        });
      }
    });



  // 3. Clean up the render conditional (remove debug wrapper)
  // Simple swipe back handler
  const handleSwipeBack = async () => {
    if (selectedEpisode) {
      handleBack();
    } else if (showRecordingView) {
      await cleanupRecording();
      setShowRecordingView(false);
    } else if (searchTerm) {
      setSearchTerm('');
    } else {
      // On podcast results page, go back to home (show business podcasts)
      setSearchTerm('');
      setPodcastTitle('');
      setEpisodes([]);
      setAllEpisodes([]);
      setSearchResults([]);
      setCurrentRssFeed('');
    }
  };

  // Create native gesture for ScrollView
  const scrollGesture = Gesture.Native();

  // Create swipe gesture that coordinates with ScrollView
  const swipeBackGesture = Gesture.Pan()
    .simultaneousWithExternalGesture(scrollGesture)
    .activeOffsetX([80, 999]) // Higher activation threshold for more intentional swipes
    .failOffsetY([-15, 15]) // Tighter vertical constraint for straighter swipes
    .shouldCancelWhenOutside(true) // Cancel if finger goes outside bounds
    .onBegin((event) => {
      // (debug log removed)
    })
    .onUpdate((event) => {
      if (event.translationX > 0) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      const canGoBack =
        showRecordingView ||
        (searchTerm) ||
        (episodes.length > 0 && !selectedEpisode);

      const threshold = 80;
      if (canGoBack && event.translationX > threshold) {
        // Animate off-screen, then navigate
        translateX.value = withTiming(screenWidth, { duration: 180 }, () => {
          runOnJS(handleSwipeBack)();
          translateX.value = 0; // Reset for next time
        });
      } else {
        // Animate back to original position
        translateX.value = withSpring(0, {
          damping: 14,
          stiffness: 250,
          mass: 0.8,
        });
      }
    });

  // Compose the gestures - disable swipe-back on episode detail page to preserve scrubber
  const composedGesture = (showRecordingView || searchTerm || (episodes.length > 0 && !selectedEpisode))
    ? Gesture.Race(swipeBackGesture, scrollGesture) // Allow both when there's content to go back from
    : scrollGesture; // Only allow scroll on home screen and episode detail page (no swipe-back)





  // Font loading check temporarily disabled
  // if (!fontsLoaded) {
  //   return (
  //     <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1c1c1c' }}>
  //       <ActivityIndicator size="large" color="#d97706" />
  //       <Text style={{ color: '#f4f4f4', marginTop: 10 }}>Loading fonts...</Text>
  //     </View>
  //   );
  // }

  // Add state for about modal
  const [showAboutModal, setShowAboutModal] = useState(false);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={styles.container}>
        <StatusBar 
          style="light" 
          backgroundColor="#1c1c1c" 
          translucent={false}
        />
        <LinearGradient
          colors={['#1c1c1c', '#2d2d2d']}
          style={styles.gradient}
        >
          <GestureDetector gesture={composedGesture}>
            <Animated.View style={[animatedStyle, { flex: 1 }]}>
              {/* Show recording view when active */}
              {showRecordingView ? (
                <RecordingView 
                  selectedEpisode={selectedEpisode}
                  podcastTitle={podcastTitle}
                  duration={duration}
                  clipStart={clipStart}
                  clipEnd={clipEnd}
                  position={position}
                  isPlaying={isPlaying}
                  captionsEnabled={captionsEnabled}
                  preparedTranscript={preparedTranscript}
                  isRecording={isRecording}
                  recordingStatus={recordingStatus}
                  startVideoRecording={startVideoRecording}
                  cleanupRecording={cleanupRecording}
                  setShowRecordingView={setShowRecordingView}
                  styles={styles}
                />
              ) : (
                <>
                  {loading && episodes.length === 0 && (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="large" color="#d97706" />
                      <Text style={styles.loadingOverlayText}>Loading recent episodes…</Text>
                    </View>
                  )}
                            {/* Show Episode List when no episode is selected */}
              {!selectedEpisode && (
                <>
                  {/* Loading State */}
                  {loading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#d97706" />
                      <Text style={styles.loadingText}>Loading episodes...</Text>
                    </View>
                  ) : (
                    <FlatList
                      data={episodes}
                      keyExtractor={(item) => item.id.toString()}
                      renderItem={({ item: episode }) => (
                        <TouchableOpacity
                          style={styles.episodeItem}
                          onPress={() => playEpisode(episode)}
                        >
                          {episode.artwork ? (
                            <Image 
                              source={{ uri: episode.artwork }} 
                              style={styles.episodeArtwork}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={[styles.episodeArtwork, { backgroundColor: '#404040', justifyContent: 'center', alignItems: 'center' }]}>
                              <MaterialCommunityIcons name="music-note" size={24} color="#888" />
                            </View>
                          )}
                          <View style={styles.episodeInfo}>
                            <Text style={styles.episodeTitle} numberOfLines={2}>
                              {episode.title}
                            </Text>
                            <Text style={styles.episodeDate}>
                              {episode.pubDate ? (() => {
                                const date = new Date(episode.pubDate);
                                return isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
                              })() : 'Unknown date'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}
                      showsVerticalScrollIndicator={false}
                      removeClippedSubviews={true}
                      maxToRenderPerBatch={5}
                      windowSize={10}
                      initialNumToRender={5}
                      scrollEnabled={true}
                      directionalLockEnabled={true}
                      alwaysBounceVertical={false}
                      alwaysBounceHorizontal={false}
                      showsHorizontalScrollIndicator={false}
                      ListHeaderComponent={() => (
                        <>
                          {/* Header */}
                          <View style={styles.header}>
                            <View style={styles.logoContainer}>
                              <HomeAnimatedWaveform 
                                isPlaying={isPlaying} 
                                size="large"
                                style={{ width: 200, height: 80, marginBottom: -8 }}
                              />
                              <TouchableOpacity onPress={() => setShowAboutModal(true)}>
                                <Text
                                  style={{
                                    fontFamily: 'Lobster',
                                    fontSize: 48,
                                    color: '#f4f4f4',
                                    marginTop: -20,
                                    textAlign: 'center',
                                    letterSpacing: 1,
                                  }}
                                >
                                  Audio2
                                </Text>
                              </TouchableOpacity>
                              <Text style={styles.subtitle}>Turn audio to clips for social sharing</Text>
                            </View>
                          </View>

                          {/* Search Bar Component */}
                          <SearchBar 
                            onSearch={handlePodcastSearch}
                            placeholder="Search podcasts or paste RSS feed URL"
                            containerStyle={styles.inputSection}
                          />

                          {/* Recent Podcasts */}
                          {recentPodcasts.length > 0 && episodes.length === 0 && !loading && !isSearching && (
                            <View style={{ marginBottom: 24, paddingHorizontal: PADDING.horizontal }}>
                              <Text style={styles.sectionTitle}>Recent Podcasts</Text>
                              <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                style={styles.recentScrollView}
                              >
                                {recentPodcasts.map((podcast) => (
                                  <TouchableOpacity
                                    key={podcast.id}
                                    style={styles.recentPodcastItem}
                                    onPress={() => handleSelectPodcast(podcast)}
                                  >
                                    <Image 
                                      source={{ uri: podcast.artwork }} 
                                      style={styles.recentPodcastArtwork}
                                      defaultSource={require('./assets/logo1.png')}
                                    />
                                    <Text style={styles.recentPodcastName} numberOfLines={2}>
                                      {podcast.name}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          )}

                          {/* Popular Business Podcasts */}
                          {episodes.length === 0 && searchResults.length === 0 && !loading && !isSearching && (
                            <View style={{ marginBottom: 24, paddingHorizontal: PADDING.horizontal }}>
                              <Text style={styles.sectionTitle}>Popular Business Podcasts</Text>
                              <View style={styles.popularPodcastsList}>
                                {popularBusinessPodcasts.map((podcast, idx) => (
                                  <TouchableOpacity 
                                    key={podcast.name + idx} 
                                    onPress={async () => {
                                      setSearchTerm(podcast.name);
                                      await handlePodcastSearch(podcast.name);
                                    }} 
                                    style={styles.popularPodcastItem}
                                  >
                                    {popularPodcastsArtwork[podcast.name] ? (
                                      <Image 
                                        source={{ uri: popularPodcastsArtwork[podcast.name] }} 
                                        style={styles.popularPodcastArtwork}
                                        defaultSource={require('./assets/logo1.png')}
                                      />
                                    ) : (
                                      <Text style={styles.popularPodcastEmoji}>{podcast.fallbackEmoji}</Text>
                                    )}
                                    <View style={styles.popularPodcastInfo}>
                                      <Text style={styles.popularPodcastName}>{podcast.name}</Text>
                                      <Text style={styles.popularPodcastCategory}>{podcast.category}</Text>
                                    </View>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>
                          )}

                          {/* Search Results */}
                          {searchResults.length > 0 && (
                            <View style={[styles.searchResultsSection, { paddingHorizontal: PADDING.horizontal }]}>
                              <Text style={styles.sectionTitle}>
                                Found {searchResults.length} podcast{searchResults.length !== 1 ? 's' : ''}
                              </Text>
                              {searchResults.map((podcast) => (
                                <TouchableOpacity
                                  key={podcast.id}
                                  style={styles.searchResultItem}
                                  onPress={() => handleSelectPodcast(podcast)}
                                >
                                  <Image 
                                    source={{ uri: podcast.artwork }} 
                                    style={styles.searchResultArtwork}
                                    defaultSource={require('./assets/logo1.png')}
                                  />
                                  <View style={styles.searchResultInfo}>
                                    <Text style={styles.searchResultName} numberOfLines={2}>
                                      {podcast.name}
                                    </Text>
                                    <Text style={styles.searchResultArtist} numberOfLines={1}>
                                      {podcast.artist}
                                    </Text>
                                    {podcast.genres.length > 0 && (
                                      <Text style={styles.searchResultGenre} numberOfLines={1}>
                                        {podcast.genres[0]}
                                      </Text>
                                    )}
                                  </View>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}

                          {/* Podcast Header */}
                          {podcastTitle && episodes.length > 0 && (
                            <View style={styles.podcastHeader}>
                              <Text style={styles.podcastHeaderTitle}>{podcastTitle}</Text>
                            </View>
                          )}
                          
                          {/* Podcast Title when loading */}
                          {podcastTitle && loading && episodes.length === 0 && (
                            <View style={styles.podcastHeader}>
                              <Text style={styles.podcastHeaderTitle}>{podcastTitle}</Text>
                            </View>
                          )}
                        </>
                      )}
                      ListFooterComponent={() => {
                        console.log('🔍 ListFooterComponent - showLoadMore:', showLoadMore);
                        return showLoadMore ? (
                          <TouchableOpacity
                            style={styles.submitButton}
                            onPress={loadMoreEpisodes}
                            disabled={isLoadingMore}
                          >
                            {isLoadingMore ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                                <Text style={styles.submitButtonText}>Loading...</Text>
                              </View>
                            ) : (
                              <Text style={styles.submitButtonText}>Load More Episodes</Text>
                            )}
                          </TouchableOpacity>
                        ) : null;
                      }}
                    />
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

                    <AnimatedWaveform 
                      isPlaying={isPlaying} 
                      size="medium"
                      style={{ width: 120, height: 48 }}
                    />
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
                    <ScrollView 
                      style={styles.playerControlsScrollView}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={styles.playerControlsContent}
                    >
                      {/* Episode Header */}
                      <View style={styles.episodeHeader}>
                        {selectedEpisode.artwork ? (
                          <Image 
                            source={{ uri: selectedEpisode.artwork }} 
                            style={styles.episodeArtworkLarge}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.episodeArtworkLarge, { backgroundColor: '#404040', justifyContent: 'center', alignItems: 'center' }]}>
                            <MaterialCommunityIcons name="music-note" size={48} color="#888" />
                          </View>
                        )}
                        <Text style={styles.episodeTitleLarge} numberOfLines={3}>
                          {selectedEpisode.title}
                        </Text>
                        {podcastTitle && (
                          <Text style={styles.episodePodcastName}>
                            {podcastTitle}
                          </Text>
                        )}
                      </View>
                      {/* MAIN TIMELINE - NEW AWESOME SLIDER */}
                      <View style={styles.mainTimelineSection}>
                        <View style={styles.sliderContainer}>
                          <Slider
                            style={styles.slider}
                            progress={progressSharedValue}
                            minimumValue={minValue}
                            maximumValue={maxValue}
                            thumbWidth={20}
                            thumbHeight={20}
                            trackHeight={8}
                            theme={{
                              disableMinTrackTintColor: true,
                              maximumTrackTintColor: '#404040',
                              minimumTrackTintColor: '#d97706',
                              cacheTrackTintColor: '#404040',
                              bubbleBackgroundColor: '#d97706',
                            }}
                            renderBubble={() => null}
                            onSlidingStart={() => {
                              console.log('Scrubbing started');
                              setIsScrubbing(true);
                            }}
                            onValueChange={(value) => {
                              if (isScrubbing) {
                                progressSharedValue.value = value;
                                setPosition(value);
                              }
                            }}
                            onSlidingComplete={(value) => {
                              console.log('Scrubbing complete:', value);
                              setPosition(value);
                              if (sound) {
                                sound.setPositionAsync(Math.max(0, Math.min(value, duration)));
                              }
                              setTimeout(() => {
                                setIsScrubbing(false);
                              }, 100);
                              
                              // Removed automatic clip end setting - user must click "End Clip" button
                            }}
                          />
                          
                          {/* Clip Markers Overlay - Fixed positioning */}
                          <View style={styles.clipMarkersContainer}>
                            {clipStart && duration && (
                              <View 
                                style={[
                                  styles.clipMarkerOverlay, 
                                  { 
                                    left: `${(clipStart / duration) * 100}%`,
                                    backgroundColor: '#d97706', // Orange for clean UI
                                  }
                                ]} 
                              />
                            )}
                            {clipEnd && duration && (
                              <View 
                                style={[
                                  styles.clipMarkerOverlay, 
                                  { 
                                    left: `${(clipEnd / duration) * 100}%`,
                                    backgroundColor: '#d97706', // Orange for clean UI
                                  }
                                ]} 
                              />
                            )}
                            
                            {/* Clip Range Highlight */}
                            {clipStart && clipEnd && duration && (
                              <View 
                                style={[
                                  styles.clipRangeHighlight,
                                  {
                                    left: `${(clipStart / duration) * 100}%`,
                                    width: `${((clipEnd - clipStart) / duration) * 100}%`,
                                    backgroundColor: '#d97706', // Orange highlight for clean UI
                                  }
                                ]}
                              />
                            )}
                          </View>
                        </View>
                        
                      </View>
                      
                      {/* Time Display Right Under Scrubber */}
                      <View style={styles.mainTimeContainer}>
                        <Text style={styles.mainTimeText}>{formatTime(position)}</Text>
                        <Text style={styles.mainTimeText}>{formatTime(duration)}</Text>
                      </View>

                      {/* PLAYBACK Section */}
                      <View style={styles.controlSection}>
                        <View style={styles.playbackControls}>
                          <TouchableOpacity style={styles.skipTextButton} onPress={handleSkip1Backward}>
                            <Text style={styles.skipText}>-1s</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity style={styles.skipTextButton} onPress={handleSkipBackward}>
                            <Text style={styles.skipText}>-15s</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity style={styles.largePlayButton} onPress={handleTogglePlayback}>
                            <MaterialCommunityIcons 
                              name={isPlaying ? "pause" : "play"} 
                              size={40} 
                              color="#f4f4f4" 
                            />
                          </TouchableOpacity>
                          
                          <TouchableOpacity style={styles.skipTextButton} onPress={handleSkipForward}>
                            <Text style={styles.skipText}>+15s</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity style={styles.skipTextButton} onPress={handleSkip1Forward}>
                            <Text style={styles.skipText}>+1s</Text>
                          </TouchableOpacity>
                        </View>
                      </View>



                      {/* CLIP SELECTION Section */}
                      <View style={styles.controlSection}>
                        {/* Clean UI: Single Action Button */}
                        {clipStart === null ? (
                          <TouchableOpacity style={styles.startClipButton} onPress={handleStartClipSelection}>
                            <MaterialCommunityIcons name="scissors-cutting" size={20} color="#f4f4f4" />
                            <Text style={styles.startClipButtonText}>Start Clip Selection</Text>
                          </TouchableOpacity>
                        ) : clipEnd === null ? (
                          <>
                            <TouchableOpacity style={styles.startClipButton} onPress={handleSetClipEnd}>
                              <MaterialCommunityIcons name="scissors-cutting" size={20} color="#f4f4f4" />
                              <Text style={styles.startClipButtonText}>End Clip</Text>
                            </TouchableOpacity>
                            
                            {/* Cancel Button */}
                            <TouchableOpacity style={styles.cancelButton} onPress={handleClearSelection}>
                              <MaterialCommunityIcons name="close" size={16} color="#f4f4f4" />
                              <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <View style={styles.clipReadyControls}>
                            <TouchableOpacity style={styles.previewClipButton} onPress={handlePlayClip}>
                              <MaterialCommunityIcons name="play-outline" size={16} color="#f4f4f4" />
                              <Text style={styles.previewClipButtonText}>Preview</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity style={styles.clearClipButton} onPress={handleClearSelection}>
                              <MaterialCommunityIcons name="delete" size={16} color="#f4f4f4" />
                              <Text style={styles.clearClipButtonText}>Clear</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                      {/* CREATE VIDEO Section */}
                      {clipStart !== null && clipEnd !== null && (
                        <View style={styles.controlSection}>
                          {/* Caption Toggle */}
                          <View style={styles.captionToggleContainer}>
                            <View style={styles.captionToggleWrapper}>
                              <TouchableOpacity 
                                style={[styles.captionToggle, captionsEnabled && styles.captionToggleActive]} 
                                onPress={() => {
                                  const newValue = !captionsEnabled;
                                  setCaptionsEnabled(newValue);
                                  if (!newValue) {
                                    // Clear caption data when disabling
                                    setPreparedTranscript(null);
                                  }
                                }}
                                disabled={isGeneratingCaptions}
                              >
                                <View style={[styles.captionToggleThumb, captionsEnabled && styles.captionToggleThumbActive]} />
                              </TouchableOpacity>
                              <Text style={styles.captionToggleText}>
                                Add automated captions to your clip
                              </Text>
                            </View>
                          </View>
                          
                          {/* Record Clip Button */}
                          <TouchableOpacity 
                            style={styles.recordClipButton} 
                            onPress={() => {
                              console.log('🎬 === RECORD CLIP BUTTON PRESSED ===');
                              console.log('🎬 Button state:', {
                                clipStart,
                                clipEnd,
                                selectedEpisode: selectedEpisode?.title,
                                isGeneratingCaptions,
                                captionsEnabled
                              });
                              handleCreateVideo();
                            }}
                            disabled={isGeneratingCaptions}
                          >
                            <MaterialCommunityIcons name="video-plus" size={20} color="#f4f4f4" />
                            <Text style={styles.recordClipButtonText}>
                              {isGeneratingCaptions ? 'Generating Captions...' : 'Record Clip'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Caption Status Display - Removed to prevent layout shift */}



                      {/* Episode Notes Button */}
                      <TouchableOpacity 
                        style={styles.episodeNotesButton}
                        onPress={showEpisodeNotesSheet}
                      >
                        <MaterialCommunityIcons name="text-box-outline" size={20} color="#d97706" />
                        <Text style={styles.episodeNotesButtonText}>Episode Notes</Text>
                        <MaterialCommunityIcons name="chevron-up" size={20} color="#d97706" />
                      </TouchableOpacity>
                      
                      {/* Helper Text */}
                      <Text style={styles.helperText}>
                        Drag the timeline or use the fine-tuning buttons to select the start of your clip. Then hit "Start Clip Selection" to continue.
                      </Text>
                    </ScrollView>
                  )}
                </>
              )}
            </>
          )}
          </Animated.View>
        </GestureDetector>
      </LinearGradient>
              {showRecordingGuidance && <RecordingGuidanceModal />}
        {showProcessingModal && <ProcessingModal />}
        {showAboutModal && <AboutModal visible={showAboutModal} onClose={() => setShowAboutModal(false)} />}
      
      {/* Episode Loading Spinner */}
      {isEpisodeLoading && (
        <View style={styles.episodeLoadingOverlay}>
          <View style={styles.episodeLoadingContent}>
            <ActivityIndicator size="large" color="#d97706" />
            <Text style={styles.episodeLoadingTitle}>Loading Episode</Text>
            <Text style={styles.episodeLoadingPodcastName}>
              {podcastTitle || 'Podcast'}
            </Text>
            <Text style={styles.episodeLoadingSubtitle} numberOfLines={2}>
              {loadingEpisodeTitle || 'Loading...'}
            </Text>
            <TouchableOpacity 
              style={styles.episodeLoadingCancelButton}
              onPress={() => {
                setIsEpisodeLoading(false);
                setLoadingEpisodeTitle('');
              }}
            >
              <Text style={styles.episodeLoadingCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Episode Notes Bottom Sheet */}
      {showEpisodeNotes && (
        <>
          <Animated.View style={[styles.episodeNotesOverlay, notesOverlayAnimatedStyle]}>
            <TouchableOpacity 
              style={styles.episodeNotesOverlayTouchable}
              onPress={hideEpisodeNotesSheet}
            />
          </Animated.View>
          <GestureDetector gesture={handleNotesPanGesture}>
            <Animated.View style={[styles.episodeNotesSheet, notesAnimatedStyle]}>
              <View style={styles.episodeNotesHandle} />
              <View style={styles.episodeNotesHeader}>
                <Text style={styles.episodeNotesHeaderTitle}>Episode Notes</Text>
                <TouchableOpacity onPress={hideEpisodeNotesSheet}>
                  <MaterialCommunityIcons name="close" size={24} color="#b4b4b4" />
                </TouchableOpacity>
              </View>
              <ScrollView 
                style={styles.episodeNotesContent}
                showsVerticalScrollIndicator={true}
              >
                <Text style={styles.episodeNotesText}>
                  {selectedEpisode?.description || 'No episode notes available.'}
                </Text>
              </ScrollView>
            </Animated.View>
          </GestureDetector>
        </>
      )}
    </SafeAreaView>
      </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1c',
    paddingTop: 0, // Remove any manual padding
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  mainScrollView: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: 40, // Add some bottom padding for better scrolling
  },
  
  // Header styles
  header: {
    alignItems: 'center',
    marginBottom: 20, // Reduced from 30
    marginTop: 10,    // Reduced from 20
  },
  logo: {
    width: 460,  // Reduced from 552 
    height: 184, // Reduced from 221
    marginBottom: -10, // Negative margin to pull subtitle closer
  },
  subtitle: {
    color: '#b4b4b4',
    fontSize: 16,
    fontWeight: '400',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    paddingVertical: 20,
  },
  
  appTitle: {
    color: '#f4f4f4',
    fontSize: 44,
    fontWeight: '400',
    marginTop: -15,
    letterSpacing: -1,
  },
  
  // Input section
  inputSection: {
    flexDirection: 'row',
    marginBottom: 30,
    paddingHorizontal: PADDING.horizontal,
  },
  inputContainer: {
    flex: 1,
    marginRight: 10,
  },
  buttonContainer: {
    justifyContent: 'center',
  },
  input: {
    backgroundColor: '#2d2d2d',
    color: '#f4f4f4',
    padding: 15,
    borderRadius: 12,
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
    textAlign: 'center',
  },
  
  // Podcast header
  podcastHeader: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  podcastHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f4f4f4',
    textAlign: 'center',
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
    marginBottom: 10, // Reduced from 20 to remove space between Episodes and episode art
    paddingVertical: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    // Removed backgroundColor and borderRadius to remove the box
  },
  backButtonText: {
    color: '#d97706',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  smallLogo: {
    width: 240, // Increased from 180
    height: 96,  // Increased from 72
    alignSelf: 'flex-end', // Justify to the right
  },
  episodeHeader: {
    alignItems: 'center',
    marginBottom: 15, // Reduced from 30 to bring scrubber closer
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
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  episodePodcastName: {
    color: '#d97706',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  
  // Timeline styles
  mainTimelineSection: {
    marginBottom: 0, // Removed margin since timestamps are now outside
    paddingHorizontal: 10,
  },
  sliderContainer: {
    position: 'relative',
    paddingVertical: 8, // Reduced from 20 to bring timestamps closer
    paddingHorizontal: 10,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  clipMarkersContainer: {
    position: 'absolute',
    top: 8, // Match the new paddingVertical of sliderContainer
    left: 20, // Account for thumb width (20px / 2 = 10px) + container padding
    right: 20,
    height: 40,
    pointerEvents: 'none', // Allow touches to pass through to slider
  },
  clipMarkerOverlay: {
    position: 'absolute',
    top: 12, // Center on the track (40px height / 2 - 8px track height / 2 - 4px marker height / 2)
    width: 4,
    height: 16,
    borderRadius: 2,
    marginLeft: -2, // Center the marker
    zIndex: 10,
  },
  clipRangeHighlight: {
    position: 'absolute',
    top: 14, // Slightly below track center
    height: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.3)', // Semi-transparent red
    borderRadius: 6,
    zIndex: 5,
  },
  mainTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 0, // Removed margin to be right under scrubber
    paddingHorizontal: 10, // Add horizontal padding to match timeline section
  },
  mainTimeText: {
    color: '#b4b4b4',
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Player controls scroll view
  playerControlsScrollView: {
    flex: 1,
  },
  playerControlsContent: {
    paddingBottom: 20,
  },
  
  // Control sections
  controlSection: {
    marginBottom: 16, // Reduced from 24
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 12, // Reduced from 14
    fontWeight: '600',
    color: '#d97706',
    marginBottom: 8, // Reduced from 12
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  
  // PLAYBACK Section
  playbackControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15, // Reduced for tighter spacing around play button
  },
  

  
  // CLIP SELECTION Section
  clipStatusContainer: {
    backgroundColor: '#2d2d2d',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#404040',
  },
  clipStatusText: {
    color: '#b4b4b4',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  clipSelectionControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  clipSelectionButton: {
    backgroundColor: '#404040',
    paddingVertical: 8, // Reduced from 10
    paddingHorizontal: 10, // Reduced from 12
    borderRadius: 12, // Reduced from 16
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70, // Reduced from 80
    borderWidth: 1,
    borderColor: '#555555',
  },
  clipSelectionButtonText: {
    color: '#f4f4f4',
    fontSize: 11, // Reduced from 12
    fontWeight: '500',
    marginLeft: 4,
  },
  
  // CREATE VIDEO Section
  captionToggleContainer: {
    backgroundColor: '#2d2d2d',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#404040',
    minHeight: 48,
  },
  captionToggleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  captionToggleText: {
    color: '#f4f4f4',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  captionToggleState: {
    color: '#d97706',
    fontSize: 14,
    fontWeight: '600',
  },
  captionToggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#404040',
    padding: 2,
    borderWidth: 1,
    borderColor: '#555555',
  },
  captionToggleActive: {
    backgroundColor: '#d97706',
    borderColor: '#e97c0a',
  },
  captionToggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#f4f4f4',
  },
  captionToggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  createVideoButton: {
    backgroundColor: '#d97706',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e97c0a',
  },
  createVideoButtonText: {
    color: '#f4f4f4',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Clean UI Button Styles
  startClipButton: {
    backgroundColor: '#d97706',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e97c0a',
    marginTop: 8,
  },
  startClipButtonText: {
    color: '#f4f4f4',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  clearClipButton: {
    backgroundColor: '#404040',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#555555',
  },
  clearClipButtonText: {
    color: '#f4f4f4',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  clipReadyControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  previewClipButton: {
    backgroundColor: '#404040',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#555555',
  },
  previewClipButtonText: {
    color: '#f4f4f4',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
  recordClipButton: {
    backgroundColor: '#d97706',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e97c0a',
    marginTop: 8,
  },
  recordClipButtonText: {
    color: '#f4f4f4',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Legacy control buttons (keeping for compatibility)
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
    width: 60, // Reduced from 80
    height: 60, // Reduced from 80
    borderRadius: 30, // Reduced from 40
    backgroundColor: '#404040',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#555555',
  },
  playButton: {
    width: 60, // Reduced from 80
    height: 60, // Reduced from 80
    borderRadius: 30, // Reduced from 40
    backgroundColor: '#d97706',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e97c0a',
  },
  
  // Clean UI - Large Play Button
  largePlayButton: {
    width: 85,
    height: 85,
    borderRadius: 42.5,
    backgroundColor: '#d97706',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e97c0a',
    shadowColor: '#d97706',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  
  // Clean UI - Small Skip Buttons
  skipButton: {
    backgroundColor: '#404040',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#555555',
    minWidth: 60,
  },
  
  // Clean UI - Smaller Skip Buttons for +/- 1s
  smallSkipButton: {
    backgroundColor: '#404040',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#555555',
    minWidth: 40,
  },
  
  // Clean UI - Text-based Skip Buttons for left side
  skipTextButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  skipText: {
    color: '#d97706',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButtonText: {
    color: '#f4f4f4',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  
  // Cancel Button Style
  cancelButton: {
    backgroundColor: '#2d2d2d',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#404040',
    marginTop: 8,
    alignSelf: 'center',
  },
  cancelButtonText: {
    color: '#b4b4b4',
    fontSize: 12,
    fontWeight: '400',
    marginLeft: 4,
  },
  
  // Clip controls
  clipControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 30,
    paddingBottom: 100, // Extra padding for large text accessibility
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
  clipButtonActive: {
    backgroundColor: '#d97706', // Audio2 orange when captions enabled
    borderWidth: 2,
    borderColor: '#e97c0a', // Slightly lighter orange border
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
  saveButtonDisabled: {
    backgroundColor: '#666666', // Grayed out when generating captions
    opacity: 0.7,
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
  
  // Optional: Caption status indicator
  captionStatus: {
    alignItems: 'center',
    marginBottom: 15,
  },
  
  captionStatusText: {
    color: '#d97706',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
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
    paddingHorizontal: 40, // Increased padding to prevent timeline from running off screen
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
    marginBottom: 10,
  },
  recordingEpisodeInfo: {
    alignItems: 'center',
    marginBottom: 20,
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
  cancelButton: {
    backgroundColor: '#2d2d2d',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#404040',
    marginTop: 8,
    alignSelf: 'center',
  },
  cancelButtonText: {
    color: '#b4b4b4',
    fontSize: 12,
    fontWeight: '400',
    marginLeft: 4,
  },
  recordingStatusText: {
    color: '#b4b4b4',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  
  // New recording button overlay styles
  recordingButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  recordingButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  recordingButtonWide: {
    backgroundColor: 'rgba(217, 119, 6, 0.8)', // Semi-transparent orange
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 2,
    borderWidth: 1,
    borderColor: 'rgba(233, 124, 10, 0.8)',
  },
  recordingCancelButton: {
    backgroundColor: 'rgba(64, 64, 64, 0.8)', // Semi-transparent gray
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(85, 85, 85, 0.8)',
  },
  recordingCancelButtonText: {
    color: '#f4f4f4',
    fontSize: 16,
    fontWeight: '500',
  },
  // 5. Add styles to StyleSheet.create()
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)', // Changed from 0.8 to 0.9
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999, // Changed from 1000 to 9999
  },
  modalContent: {
    backgroundColor: '#2d2d2d',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#404040',
  },
  modalTitle: {
    color: '#f4f4f4',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalText: {
    color: '#b4b4b4',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#404040',
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#d97706',
    borderColor: '#d97706',
  },
  checkboxText: {
    color: '#b4b4b4',
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#404040',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#f4f4f4',
    fontSize: 14,
    fontWeight: '500',
  },
  modalContinueButton: {
    flex: 1,
    backgroundColor: '#d97706',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalContinueText: {
    color: '#f4f4f4',
    fontSize: 14,
    fontWeight: '600',
  },
  // Mode toggle styles
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#2d2d2d',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#404040',
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: '#d97706',
  },
  modeButtonText: {
    color: '#b4b4b4',
    fontSize: 14,
    fontWeight: '500',
  },
  modeButtonTextActive: {
    color: '#f4f4f4',
    fontWeight: '600',
  },
  submitButtonDisabled: {
    backgroundColor: '#666666',
    opacity: 0.6,
  },
  // Search results styles
  sectionTitle: {
    color: '#f4f4f4',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    marginTop: 8,
  },
  searchResultsSection: {
    marginBottom: 20,
  },
  searchResultItem: {
    flexDirection: 'row',
    backgroundColor: '#2d2d2d',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#404040',
  },
  searchResultArtwork: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#404040',
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  searchResultName: {
    color: '#f4f4f4',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 20,
  },
  searchResultArtist: {
    color: '#b4b4b4',
    fontSize: 14,
    marginBottom: 2,
  },
  searchResultGenre: {
    color: '#888888',
    fontSize: 12,
    fontStyle: 'italic',
  },
  // Recent podcasts styles
  recentScrollView: {
    paddingLeft: 0,
  },
  recentPodcastItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  recentPodcastArtwork: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#404040',
    marginBottom: 8,
  },
  recentPodcastName: {
    color: '#b4b4b4',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  // Suggestions styles
  suggestionsSection: {
    marginBottom: 20,
  },
  suggestionTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionTag: {
    backgroundColor: '#404040',
    paddingVertical: 8,
    paddingHorizontal: 16, // increased for better appearance
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#555555',
    maxWidth: 160, // limit pill width
    marginBottom: 8,
},
suggestionTagText: {
  color: '#b4b4b4',
  fontSize: 13,
  fontWeight: '500',
  textAlign: 'center',
  numberOfLines: 1,
  ellipsizeMode: 'tail',
},
  // Add these styles to StyleSheet.create()
  searchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(28,28,28,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  searchOverlayContent: {
    backgroundColor: '#222',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  searchOverlayText: {
    color: '#f4f4f4',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  cancelSearchButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  cancelSearchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchInput: {
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
  searchButton: {
    backgroundColor: '#d97706',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#f4f4f4',
    fontWeight: '600',
  },
  // Popular Business Podcasts styles
  popularPodcastItem: {
    color: '#f4f4f4',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
    textDecorationLine: 'underline',
  },
  popularPodcastsList: {
    paddingBottom: 20, // Add bottom padding to ensure content is visible
  },
  popularPodcastItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d2d',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#404040',
    marginBottom: 8,
  },
  popularPodcastEmoji: {
    fontSize: 24,
    marginRight: 12,
    width: 32,
    textAlign: 'center',
  },
  popularPodcastArtwork: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: '#404040',
  },
  popularPodcastInfo: {
    flex: 1,
  },
  popularPodcastName: {
    color: '#f4f4f4',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  popularPodcastCategory: {
    color: '#b4b4b4',
    fontSize: 12,
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(28,28,28,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingOverlayText: {
    color: '#f4f4f4',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  searchHintText: {
    color: '#b4b4b4',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 10,
  },
  
  // Episode Notes Button styles
  episodeNotesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2d2d2d',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#404040',
    marginTop: 20,
  },
  episodeNotesButtonText: {
    color: '#d97706',
    fontSize: 16,
    fontWeight: '600',
  },
  helperText: {
    color: '#b4b4b4', // Light grey color
    fontSize: 12, // Small type
    textAlign: 'center',
    marginTop: 25, // Increased from 15 to move it down
    paddingHorizontal: 20,
    lineHeight: 16,
  },
  
  // Episode Loading Spinner styles
  episodeLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(28,28,28,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  episodeLoadingContent: {
    backgroundColor: '#2d2d2d',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 40,
    borderWidth: 1,
    borderColor: '#404040',
  },
  episodeLoadingTitle: {
    color: '#f4f4f4',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  episodeLoadingPodcastName: {
    color: '#d97706',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  episodeLoadingSubtitle: {
    color: '#b4b4b4',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  episodeLoadingCancelButton: {
    backgroundColor: '#404040',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  episodeLoadingCancelText: {
    color: '#f4f4f4',
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Episode Notes Bottom Sheet styles
  episodeNotesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9998,
  },
  episodeNotesOverlayTouchable: {
    flex: 1,
  },
  episodeNotesSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: screenHeight * 0.7,
    backgroundColor: '#2d2d2d',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#404040',
    zIndex: 9999,
  },
  episodeNotesHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#555555',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  episodeNotesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  episodeNotesHeaderTitle: {
    color: '#f4f4f4',
    fontSize: 18,
    fontWeight: '600',
  },
  episodeNotesContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  episodeNotesText: {
    color: '#b4b4b4',
    fontSize: 14,
    lineHeight: 22,
  },
  
  // Caption styles
  captionToggleContainer: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  captionToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  captionToggleLabel: {
    color: '#f4f4f4',
    fontSize: 16,
    fontWeight: '600',
  },
  captionToggleSubtitle: {
    color: '#b4b4b4',
    fontSize: 12,
    lineHeight: 16,
  },
  captionOverlay: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    minHeight: 120,
  },

  // Bold Caption Styles
  boldCaptionContainer: {
    position: 'absolute',
    bottom: 120,
    left: 30,
    right: 60,
    alignItems: 'center',
    zIndex: 100,
  },
  boldBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  boldText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 26,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  highlightedWord: {
    color: '#d97706',
    textShadowColor: 'rgba(217, 119, 6, 0.8)',
    textShadowRadius: 6,
  },

  // Speaker-Aware Caption Styles
  speakerCaptionContainer: {
    position: 'absolute',
    bottom: 120,
    left: 30,
    right: 60,
    alignItems: 'center',
    zIndex: 1000, // Increased z-index to ensure captions appear in screen recording
  },
  speakerCaptionBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    minWidth: 200,
  },
  speakerLabel: {
    color: '#d97706',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  speakerCaptionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },

  // Natural Rhythm Caption Styles (follows speech patterns)
  naturalCaptionContainer: {
    position: 'absolute',
    bottom: 120,
    left: 24,
    right: 24,
    alignItems: 'center',
    zIndex: 1000, // High z-index for screen recording
  },
  naturalCaptionBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    maxWidth: '85%',                 // Constraint: Prevent edge-to-edge
    minHeight: 50,                   // Minimum height for stability
    justifyContent: 'center',        // Center text vertically
  },
  naturalCaptionText: {
    color: '#ffffff',
    fontSize: 17,                    // Optimized for readability
    fontWeight: '700',               
    textAlign: 'center',
    lineHeight: 22,                  // Tight line spacing for max 4 lines
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
    maxHeight: 88,                   // Height constraint: 4 lines * 22px = 88px
    includeFontPadding: false,       // Remove extra padding
  },

  // Word-Based Natural Chunked Caption Styles
  wordChunkedCaptionContainer: {
    position: 'absolute',
    bottom: 120,
    left: 24,
    right: 24,
    alignItems: 'center',
    zIndex: 1000,
  },
  wordChunkedCaptionBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    maxWidth: '88%',                 // Prevent edge-to-edge text
    maxHeight: 92,                   // Height limit: ~4 lines max
  },
  wordChunkedCaptionText: {
    color: '#ffffff',
    fontSize: 16,                    // Smaller font for better line control
    fontWeight: '700',               
    textAlign: 'center',
    lineHeight: 21,                  // Tight spacing: 4 lines = 84px + padding = ~92px
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },

});

const waveformStyles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    borderRadius: 2.5,
  },
});