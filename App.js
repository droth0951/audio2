import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
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
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS, withTiming } from 'react-native-reanimated';
import { useFonts } from 'expo-font';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');


const AnimatedWaveform = ({ 
  isPlaying = false,
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
    if (isPlaying) {
      const animations = animatedValues.map((animValue, index) => {
        return RNAnimated.loop(
          RNAnimated.sequence([
            RNAnimated.timing(animValue, {
              toValue: 1,
              duration: 400 + (index * 50),
              useNativeDriver: false,
            }),
            RNAnimated.timing(animValue, {
              toValue: 0.3,
              duration: 400 + (index * 50),
              useNativeDriver: false,
            }),
          ])
        );
      });

      animations.forEach((animation, index) => {
        setTimeout(() => {
          animation.start();
        }, index * 100);
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
  }, [isPlaying]);

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



function AppWithFonts() {
  const [fontsLoaded] = useFonts({
    'Lobster': require('./assets/fonts/Lobster-Regular.ttf'),
  });
  if (!fontsLoaded) return null;
  return <App />;
}

export default AppWithFonts;

function App() {
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

  const [currentRssFeed, setCurrentRssFeed] = useState('');

  // Add podcastTitle state
  const [podcastTitle, setPodcastTitle] = useState('');

  // 1. Add state variables
  const [showRecordingGuidance, setShowRecordingGuidance] = useState(false);
  const [dontShowGuidanceAgain, setDontShowGuidanceAgain] = useState(false);

  // Add these shared values for the new scrubber
  const progressSharedValue = useSharedValue(0);
  const minValue = useSharedValue(0);
  const maxValue = useSharedValue(100);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Add these new state variables after your existing state declarations (around line 102)
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentPodcasts, setRecentPodcasts] = useState([]);

  // Add a ref to keep track of the current AbortController
  const searchAbortController = useRef(null);

  // Add a ref for the TextInput
  const textInputRef = useRef(null);

  // Add a new state variable for the currently loading podcast
  const [loadingPodcastId, setLoadingPodcastId] = useState(null);

  // Add state for popular business podcasts
  const popularBusinessPodcasts = [
    'The Indicator from Planet Money',
    'How I Built This with Guy Raz',
    'This Is Working with Daniel Roth',
    'Acquired',
    'WorkLife with Adam Grant',
    'Masters of Scale',
    'The Ed Mylett Show',
    'The Tony Robbins Podcast',
    'The GaryVee Audio Experience',
    'The Dave Ramsey Show',
    'Marketplace',
    'Freakonomics Radio',
    'Planet Money',
    'Business Wars'
  ];

 // Place here:
  const translateX = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: 1 - translateX.value / screenWidth,
  }));
  
  // Add this new state after episodes state
  const [allEpisodes, setAllEpisodes] = useState([]);

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
      // Parse only first 10 episodes for faster loading
      const episodes = parseRSSFeed(xmlText, 10);
      console.log('🎧 Parsed episodes:', episodes.length);
      
      if (episodes.length === 0) {
        throw new Error('No episodes found in feed');
      }
      
      setAllEpisodes(episodes); // Store the limited episodes
      setEpisodes(episodes.slice(0, 7)); // Show only 7 by default
      setCurrentRssFeed(feedUrl);
      console.log('✅ Feed loaded successfully!');
      
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
          
          // Update podcast title for display
          setPodcastTitle(podcast.collectionName || 'Podcast');
          
          return rssUrl;
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
        if (status.isLoaded && !isScrubbing) {
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

  // 1. FINAL WORKING MODAL
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
          About Audio2 Clip Making
        </Text>
        
        <Text style={{
          color: '#b4b4b4',
          fontSize: 14,
          lineHeight: 20,
          marginBottom: 20,
        }}>
          Great job! You've found an insight worth sharing. We'll turn it into a file that will save to your photo library for sharing to social.{`\n`}
          1. Keep your screen on during the clip making process{`\n`}
          2. Don't switch apps or lock your phone{`\n`}
          3. Hit Start Recording. The clip will play.{`\n`}
          4. Check Photos to find and share your clip.
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

  // 2. Clean up handleCreateVideo (remove debug logs)
  const handleCreateVideo = async () => {
    if (!clipStart || !clipEnd) {
      Alert.alert('No Clip Selected', 'Please select start and end points first');
      return;
    }
    
    if (!selectedEpisode) {
      Alert.alert('No Episode', 'Please select an episode first');
      return;
    }
    
    // Show guidance modal if user hasn't disabled it
    if (!dontShowGuidanceAgain) {
      setShowRecordingGuidance(true);
    } else {
      setShowRecordingView(true);
    }
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

  // Enhanced URL input handler with Apple Podcasts support
  const handleUrlSubmit = async () => {
    console.log('🔴 handleUrlSubmit called! urlInput:', urlInput);
    
    const trimmedUrl = urlInput.trim();
    
    if (!trimmedUrl) {
      console.log('❌ Empty URL');
      Alert.alert('Error', 'Please enter a podcast URL');
      return;
    }
    
    // REMOVED: if (loading) return;
    
    console.log('📍 Trimmed URL:', trimmedUrl);
    
    // Basic URL validation
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      console.log('❌ URL missing protocol');
      Alert.alert('Error', 'URL must start with http:// or https://');
      return;
    }
    
    try {
      let rssUrl = trimmedUrl;
      
      // Handle Apple Podcasts URLs
      if (trimmedUrl.includes('podcasts.apple.com')) {
        console.log('🍎 Apple Podcasts URL detected, converting...');
        
        rssUrl = await getApplePodcastsRssUrl(trimmedUrl);
        
        if (!rssUrl) {
          Alert.alert(
            'RSS Feed Not Found', 
            'Could not find RSS feed for this Apple Podcasts URL. Please try a different podcast.'
          );
          setUrlInput('');
          return;
        }
        
        console.log('✅ Converted to RSS URL:', rssUrl);
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
  const handlePodcastSearch = async (queryOverride) => {
    const query = (typeof queryOverride === 'string' ? queryOverride : searchTerm).trim();
    if (!query) return;

    // If input looks like a URL, try to load as feed
    if (/^https?:\/\//i.test(query)) {
      setIsSearching(true);
      await loadPodcastFeed(query);
      setIsSearching(false);
      return;
    }

    // Otherwise, treat as search query
    setIsSearching(true);
    const results = await searchPodcasts(query);
    setSearchResults(results);
    setIsSearching(false);

    // If only one result, auto-select it and load its feed
    if (results.length === 1) {
      await handleSelectPodcast(results[0]);
    }
  };

  // Add function to handle selecting a podcast from search
  const handleSelectPodcast = async (podcast) => {
    try {
      // Add to recent podcasts (keep last 5)
      const updatedRecents = [podcast, ...recentPodcasts.filter(p => p.id !== podcast.id)].slice(0, 5);
      setRecentPodcasts(updatedRecents);
      
      // Load the podcast feed using existing function
      await loadPodcastFeed(podcast.feedUrl);
      
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

  // Recording view component - UPDATED to hide controls during recording
  const RecordingView = () => (
    <View style={styles.recordingContainer}>
      <StatusBar style="light" hidden={true} />
      
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
            {selectedEpisode?.podcastName || 'Podcast'}
          </Text>
        </View>
        
        {/* ONLY show controls when NOT actively recording */}
        {!isRecording && (
          <>
            {/* Control buttons */}
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
            
            {/* Status text */}
            {recordingStatus ? (
              <Text style={styles.recordingStatusText}>{recordingStatus}</Text>
            ) : null}
          </>
        )}
      </LinearGradient>
    </View>
  );

  // Show recording view when active
  if (showRecordingView) {
    return <RecordingView />;
  }

  // 3. Clean up the render conditional (remove debug wrapper)
  // Simple swipe back handler
  const handleSwipeBack = () => {
    if (selectedEpisode) {
      handleBack();
    } else if (showRecordingView) {
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
    .activeOffsetX([50, 999]) // More forgiving activation threshold
    .failOffsetY([-30, 30])
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
        selectedEpisode ||
        showRecordingView ||
        (searchTerm) ||
        (!selectedEpisode);

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

  // Compose the gestures
  const composedGesture = Gesture.Race(swipeBackGesture, scrollGesture);

  // Add a new function to load the complete RSS feed
  const loadCompleteFeed = async () => {
    if (!currentRssFeed) return;
    
    try {
      setLoading(true);
      console.log('📡 Loading complete RSS feed...');
      
      const response = await fetch(currentRssFeed, {
        headers: {
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const xmlText = await response.text();
      // Parse the complete feed without limit
      const completeEpisodes = parseRSSFeed(xmlText);
      
      setAllEpisodes(completeEpisodes);
      setEpisodes(completeEpisodes);
      
      console.log('✅ Complete feed loaded:', completeEpisodes.length, 'episodes');
      
    } catch (error) {
      console.error('❌ Error loading complete feed:', error);
      Alert.alert('Error', 'Failed to load complete feed');
    } finally {
      setLoading(false);
    }
  };

  // Shuffle function to randomize array order
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

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
              {loading && episodes.length === 0 && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#d97706" />
                  <Text style={styles.loadingOverlayText}>Loading recent episodes…</Text>
                </View>
              )}
              <ScrollView 
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
              >
                {/* Show Episode List when no episode is selected */}
                {!selectedEpisode && (
                  <>
                    {/* Header */}
                    <View style={styles.header}>
                      <View style={styles.logoContainer}>
                        <HomeAnimatedWaveform 
                          isPlaying={isPlaying} 
                          size="large"
                          style={{ width: 200, height: 80, marginBottom: -8 }} // Overlap: negative margin
                        />
                        <Text
                          style={{
                            fontFamily: 'Lobster',
                            fontSize: 48,
                            color: '#f4f4f4',
                            marginTop: -20, // Overlap: more negative margin
                            textAlign: 'center',
                            letterSpacing: 1,
                          }}
                        >
                          Audio2
                        </Text>
                        <Text style={styles.subtitle}>Turn audio to clips for social sharing</Text>
                      </View>
                    </View>

                    {/* Enhanced Input Section with Search Toggle */}
                    <View style={styles.inputSection}>
                      <View style={styles.inputContainer}>
                        <TextInput
                          ref={textInputRef}
                          style={styles.input}
                          placeholder="Search podcasts or paste RSS feed URL"
                          placeholderTextColor="#888"
                          value={urlInput}
                          blurOnSubmit={false}
                          onChangeText={(text) => {
                            console.log('📝 Input changed:', text);
                            setUrlInput(text);
                          }}
                          onSubmitEditing={() => {
                            console.log('⏎ Submit editing triggered');
                            handlePodcastSearch(urlInput);
                          }}
                        />
                      </View>
                      <View style={styles.buttonContainer}>
                        <Pressable 
                          style={styles.submitButton} 
                          onPress={() => {
                            const query = urlInput.trim();
                            if (query) {
                              handlePodcastSearch(query);
                            }
                          }}
                        >
                          <Text style={styles.submitButtonText}>Search</Text>
                        </Pressable>
                        <Text style={styles.searchHintText}>may need to 2x tap</Text>
                      </View>
                    </View>

                    {/* Recent Podcasts (show when there are recent podcasts and no current episodes) */}
                    {recentPodcasts.length > 0 && episodes.length === 0 && !loading && !isSearching && (
                      <View style={{ paddingHorizontal: 16 }}>
                        <View style={styles.recentSection}>
                          <Text style={styles.sectionTitle}>Recent Podcasts</Text>
                          <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            showsVerticalScrollIndicator={false}
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
                      </View>
                    )}

                    {/* Popular Business Podcasts (show when no episodes and no search results) */}
                    {episodes.length === 0 && searchResults.length === 0 && !loading && !isSearching && (
                      <View style={{ marginBottom: 24, paddingHorizontal: 16 }}>
                        <Text style={styles.sectionTitle}>Popular Business Podcasts</Text>
                        <View style={styles.pillRow}>
                          {shuffleArray(popularBusinessPodcasts).slice(0, 15).map((title, idx) => (
                            <TouchableOpacity key={title + idx} onPress={async () => {
                              setSearchTerm(title);
                              await handlePodcastSearch(title);
                            }} style={styles.popularPodcastPill}>
                              <Text style={styles.popularPodcastPillText}>{title}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                   {searchResults.length > 0 && (
<View style={styles.searchResultsSection}>
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

                    {/* Current Feed Info */}
                    {podcastTitle ? (
                      <View style={styles.feedInfo}>
                        <Text style={styles.feedTitle}>{podcastTitle}</Text>
                      </View>
                    ) : null}

                    {/* Episodes List */}
                    {loading ? (
                      <Text style={styles.loadingText}>Loading episodes...</Text>
                    ) : (
                      <>
                        {episodes.map((episode) => (
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
                        ))}
                        {/* Show All Episodes button */}
                        {allEpisodes.length > episodes.length && (
                          <TouchableOpacity
                            style={styles.submitButton}
                            onPress={loadCompleteFeed}
                          >
                            <Text style={styles.submitButtonText}>Show All Episodes</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* Show Audio Player when episode is selected */}
                {selectedEpisode && (
                  <>
                    {/* Navigation Header */}
                    <View style={styles.navigationHeader}>
                      <AnimatedWaveform 
                        isPlaying={isPlaying} 
                        size="medium"
                        style={{ width: 120, height: 48 }}
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
                                      backgroundColor: '#ef4444',
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
                                      backgroundColor: '#ef4444',
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
                                    }
                                  ]}
                                />
                              )}
                            </View>
                          </View>
                          
                          {/* Time Display Below Main Timeline */}
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
                                <Text style={styles.saveButtonText}>Generate Clip</Text>
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
            </Animated.View>
          </GestureDetector>
        </LinearGradient>
        {showRecordingGuidance && <RecordingGuidanceModal />}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1c',
    paddingTop: 0, // Remove any manual padding
    paddingBottom: 0, // Remove any bottom padding
    marginBottom: -34, // Negative margin to hide home indicator (iPhone specific)
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
    marginBottom: 30, // Reverted back to original
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
    overflow: 'hidden',
  },
  sliderContainer: {
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  clipMarkersContainer: {
    position: 'absolute',
    top: 20, // Match the paddingVertical of sliderContainer
    left: 20, // Account for thumb width (20px / 2 = 10px) + container padding
    right: 20,
    height: 40,
    pointerEvents: 'none', // Allow touches to pass through to slider
    // backgroundColor: 'red', // DEBUG REMOVED
  },
  clipMarkerOverlay: {
    position: 'absolute',
    top: 12, // Center on the track (40px height / 2 - 8px track height / 2 - 4px marker height / 2)
    width: 4,
    height: 16,
    borderRadius: 2,
    marginLeft: -2, // Center the marker
    zIndex: 10,
    // backgroundColor: 'red', // DEBUG REMOVED
  },
  clipRangeHighlight: {
    position: 'absolute',
    top: 14, // Slightly below track center
    height: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.3)', // Semi-transparent red (restored)
    borderRadius: 6,
    zIndex: 5,
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
  recentSection: {
    marginBottom: 20,
  },
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
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  popularPodcastPill: {
    backgroundColor: '#404040',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#555555',
    marginBottom: 8,
    marginRight: 8,
  },
  popularPodcastPillText: {
    color: '#f4f4f4',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    numberOfLines: 1,
    ellipsizeMode: 'tail',
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