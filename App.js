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
} from 'react-native';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import AudioPlayer from './src/components/AudioPlayer';
import VideoCreationModal from './src/components/VideoCreationModal';

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
  
  // Video Creation Modal State
  const [showVideoModal, setShowVideoModal] = useState(false);

  useEffect(() => {
    loadTheTownFeed();
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  // RSS parsing and episode loading functions
  const loadTheTownFeed = async () => {
    setLoading(true);
    try {
      const response = await fetch(THE_TOWN_RSS);
      const xmlText = await response.text();
      const episodes = parseRSSFeed(xmlText);
      setEpisodes(episodes.slice(0, 10));
    } catch (error) {
      Alert.alert('Error', 'Failed to load podcast feed');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const parseRSSFeed = (xmlText) => {
    const episodes = [];
    const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/g);
    
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
        
        // Enhanced description parsing
        let description = 
          item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ||
          item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ||
          item.match(/<itunes:summary><!\[CDATA\[([\s\S]*?)\]\]><\/itunes:summary>/)?.[1] ||
          item.match(/<itunes:summary>([\s\S]*?)<\/itunes:summary>/)?.[1] ||
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
            duration: '00:00'
          });
        }
      });
    }
    
    return episodes;
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

  // Audio control handlers for AudioPlayer component
  const handleBack = () => {
    setSelectedEpisode(null);
    setClipStart(null);
    setClipEnd(null);
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
      if (clipLength > 240000) {
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
      setPreviewClipStart(clipStart);
      setPreviewClipEnd(clipEnd);
      
      await sound.setPositionAsync(clipStart);
      await sound.playAsync();
      
      setTimeout(async () => {
        if (sound) {
          await sound.pauseAsync();
        }
      }, clipEnd - clipStart);
    }
  };

  const handleSaveClip = async () => {
    if (!clipStart || !clipEnd) {
      Alert.alert('No Clip Selected', 'Please select start and end points first');
      return;
    }
    
    if (!selectedEpisode) {
      Alert.alert('No Episode', 'Please select an episode first');
      return;
    }
    
    setShowVideoModal(true);
  };

  const handleExitPreview = () => {
    setIsPreviewMode(false);
    setPreviewClipStart(null);
    setPreviewClipEnd(null);
  };

  const handleScrubStart = () => setIsScrubbing(true);
  const handleScrubEnd = () => setIsScrubbing(false);

  // URL input handlers
  const handleUrlSubmit = () => {
    if (urlInput.includes('podcasts.apple.com')) {
      Alert.alert('Feature Coming Soon', 'Apple Podcasts URL parsing will be added in next update. Using The Town feed for now.');
    } else {
      Alert.alert('Feature Coming Soon', 'Custom RSS feeds coming in next update');
    }
    setUrlInput('');
  };

  // Video modal handlers
  const handleCloseVideoModal = () => {
    setShowVideoModal(false);
  };

  // Utility functions
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
                  onChangeText={setUrlInput}
                  onSubmitEditing={handleUrlSubmit}
                />
                <TouchableOpacity style={styles.submitButton} onPress={handleUrlSubmit}>
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
            <AudioPlayer
              selectedEpisode={selectedEpisode}
              isLoading={isLoading}
              isPlaying={isPlaying}
              position={position}
              duration={duration}
              clipStart={clipStart}
              clipEnd={clipEnd}
              isScrubbing={isScrubbing}
              isPreviewMode={isPreviewMode}
              previewClipStart={previewClipStart}
              previewClipEnd={previewClipEnd}
              onBack={handleBack}
              onTogglePlayback={handleTogglePlayback}
              onSeekToPosition={handleSeekToPosition}
              onSkipBackward={handleSkipBackward}
              onSkipForward={handleSkipForward}
              onSkip5Backward={handleSkip5Backward}
              onSkip5Forward={handleSkip5Forward}
              onSetClipPoint={handleSetClipPoint}
              onPlayClip={handlePlayClip}
              onSaveClip={handleSaveClip}
              onExitPreview={handleExitPreview}
              onScrubStart={handleScrubStart}
              onScrubEnd={handleScrubEnd}
            />
          )}
        </ScrollView>
      </LinearGradient>

      {/* Video Creation Modal */}
      <VideoCreationModal
        visible={showVideoModal}
        onClose={handleCloseVideoModal}
        clipStart={clipStart}
        clipEnd={clipEnd}
        selectedEpisode={selectedEpisode}
        formatTime={formatTime}
      />
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
});