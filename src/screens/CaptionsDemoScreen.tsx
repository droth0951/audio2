import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  useFrameCallback,
  runOnJS,
  scrollTo
} from 'react-native-reanimated';
import { CaptionScroller, CaptionScrollerRef } from '../captions';
import { FpsBanner, useJankCounter } from '../captions/dev/FpsBanner';
import { DriftMeter } from '../captions/dev/DriftMeter';
import { DebugHUD } from '../captions/dev/DebugHUD';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Sample transcript with truly word-level timing
const SAMPLE_TRANSCRIPT = {
  words: [
    { text: "Welcome", startMs: 0, endMs: 220 },
    { text: "to", startMs: 220, endMs: 440 },
    { text: "This", startMs: 440, endMs: 660 },
    { text: "Is", startMs: 660, endMs: 880 },
    { text: "Working", startMs: 880, endMs: 1100 },
    { text: "with", startMs: 1100, endMs: 1320 },
    { text: "Daniel", startMs: 1320, endMs: 1540 },
    { text: "Roth.", startMs: 1540, endMs: 1760 },
    { text: "Today", startMs: 1760, endMs: 1980 },
    { text: "we're", startMs: 1980, endMs: 2200 },
    { text: "talking", startMs: 2200, endMs: 2420 },
    { text: "about", startMs: 2420, endMs: 2640 },
    { text: "leadership", startMs: 2640, endMs: 2860 },
    { text: "in", startMs: 2860, endMs: 3080 },
    { text: "the", startMs: 3080, endMs: 3300 },
    { text: "modern", startMs: 3300, endMs: 3520 },
    { text: "workplace.", startMs: 3520, endMs: 3740 },
    { text: "We'll", startMs: 3740, endMs: 3960 },
    { text: "explore", startMs: 3960, endMs: 4180 },
    { text: "how", startMs: 4180, endMs: 4400 },
    { text: "successful", startMs: 4400, endMs: 4620 },
    { text: "leaders", startMs: 4620, endMs: 4840 },
    { text: "adapt", startMs: 4840, endMs: 5060 },
    { text: "to", startMs: 5060, endMs: 5280 },
    { text: "change", startMs: 5280, endMs: 5500 },
    { text: "and", startMs: 5500, endMs: 5720 },
    { text: "inspire", startMs: 5720, endMs: 5940 },
    { text: "their", startMs: 5940, endMs: 6160 },
    { text: "teams", startMs: 6160, endMs: 6380 },
    { text: "to", startMs: 6380, endMs: 6600 },
    { text: "achieve", startMs: 6600, endMs: 6820 },
    { text: "great", startMs: 6820, endMs: 7040 },
    { text: "things.", startMs: 7040, endMs: 7260 },
    { text: "Let's", startMs: 7260, endMs: 7480 },
    { text: "dive", startMs: 7480, endMs: 7700 },
    { text: "in.", startMs: 7700, endMs: 7920 },
    { text: "The", startMs: 7920, endMs: 8140 },
    { text: "key", startMs: 8140, endMs: 8360 },
    { text: "to", startMs: 8360, endMs: 8580 },
    { text: "effective", startMs: 8580, endMs: 8800 },
    { text: "leadership", startMs: 8800, endMs: 9020 },
    { text: "lies", startMs: 9020, endMs: 9240 },
    { text: "in", startMs: 9240, endMs: 9460 },
    { text: "understanding", startMs: 9460, endMs: 9680 },
    { text: "your", startMs: 9680, endMs: 9900 },
    { text: "team.", startMs: 9900, endMs: 10120 },
    { text: "Every", startMs: 10120, endMs: 10340 },
    { text: "person", startMs: 10340, endMs: 10560 },
    { text: "brings", startMs: 10560, endMs: 10780 },
    { text: "unique", startMs: 10780, endMs: 11000 },
    { text: "perspectives", startMs: 11000, endMs: 11220 },
    { text: "and", startMs: 11220, endMs: 11440 },
    { text: "strengths.", startMs: 11440, endMs: 11660 },
    { text: "Great", startMs: 11660, endMs: 11880 },
    { text: "leaders", startMs: 11880, endMs: 12100 },
    { text: "recognize", startMs: 12100, endMs: 12320 },
    { text: "this", startMs: 12320, endMs: 12540 },
    { text: "and", startMs: 12540, endMs: 12760 },
    { text: "leverage", startMs: 12760, endMs: 12980 },
    { text: "it.", startMs: 12980, endMs: 13200 },
  ],
  speaker: "Daniel Roth"
};

// Theme matching the wireframe design
const CAPTION_THEME = {
  fontFamily: 'System',
  fontSize: 22,
  lineHeight: 28,
  maxWidthDp: screenWidth - 80, // 40px padding on each side
  textColor: '#ffffff',
  paragraphSpacingDp: 8,
};

export const CaptionsDemoScreen: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [viewportReady, setViewportReady] = useState(false);
  const playButtonScale = useSharedValue(1);
  
  // Ref for accessing CaptionScroller internals
  const captionScrollerRef = useRef<CaptionScrollerRef>(null);
  
  // Track jank for debugging
  const jankSpikes = useJankCounter();

  // Calculate END_MS from transcript
  const END_MS = SAMPLE_TRANSCRIPT.words[SAMPLE_TRANSCRIPT.words.length - 1].endMs + 2000; // Last word end + synthetic anchor

  // Simple playback driver
  useEffect(() => {
    if (!isPlaying || !viewportReady) return;

    const interval = setInterval(() => {
      setCurrentTimeMs(prev => {
        const next = prev + 100; // Advance 100ms every 100ms (1x speed)
        // Clamp to END_MS and stop if reached
        if (next >= END_MS) {
          setIsPlaying(false);
          return END_MS;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, viewportReady, END_MS]);

  // Update CaptionScroller's mediaTimeMs when currentTimeMs changes
  useEffect(() => {
    if (captionScrollerRef.current) {
      captionScrollerRef.current.mediaTimeMs.value = currentTimeMs;
    }
  }, [currentTimeMs]);

  // Media time getter
  const getMediaTimeMs = () => currentTimeMs;

  const handlePlayPause = () => {
    if (!viewportReady) return; // Disable until viewport is ready
    setIsPlaying(!isPlaying);
    
    // Animate button press
    playButtonScale.value = withTiming(0.9, { duration: 100 }, () => {
      playButtonScale.value = withTiming(1, { duration: 100 });
    });
  };

  const handleReset = () => {
    setCurrentTimeMs(0);
    setIsPlaying(false);
  };

  const playButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playButtonScale.value }],
  }));

  return (
    <LinearGradient
      colors={['#1c1c1c', '#2d2d2d']}
      style={styles.container}
    >
      {/* Performance monitoring */}
      <FpsBanner />
      {captionScrollerRef.current && (
        <DriftMeter 
          expectedScrollY={captionScrollerRef.current.scrollY}
          listRef={captionScrollerRef.current.listRef}
        />
      )}
      {captionScrollerRef.current && (
        <DebugHUD
          mediaTimeMs={captionScrollerRef.current.mediaTimeMs}
          currentOffsetY={captionScrollerRef.current.scrollY}
          linesLength={captionScrollerRef.current.linesLength}
          maxOffset={captionScrollerRef.current.maxOffset}
          totalH={captionScrollerRef.current.totalH}
          viewportH={captionScrollerRef.current.viewportH}
          viewportW={captionScrollerRef.current.viewportW || 0}
          contentH={captionScrollerRef.current.contentH}
          padTop={captionScrollerRef.current.padTop}
          padBottom={captionScrollerRef.current.padBottom}
          maxScroll={captionScrollerRef.current.maxScroll}
          mapData={captionScrollerRef.current.mapData}
          maxWidth={CAPTION_THEME.maxWidthDp}
          endMs={END_MS}
        />
      )}
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Smooth Captions Demo</Text>
        <Text style={styles.subtitle}>Performance: {jankSpikes} jank spikes</Text>
      </View>

      {/* Podcast artwork */}
      <View style={styles.artworkContainer}>
        <Image
          source={{ uri: 'https://megaphone.imgix.net/podcasts/2ed322b4-49c9-11ea-93e0-afa2585e78cd/image/TIW_Key_Art_2999.png?ixlib=rails-4.3.1&max-w=3000&max-h=3000&fit=crop&auto=format,compress' }}
          style={styles.artwork}
          resizeMode="cover"
        />
        <Text style={styles.podcastTitle}>This Is Working</Text>
        <Text style={styles.episodeTitle}>Leadership in the Modern Workplace</Text>
      </View>

      {/* Hidden text to warm font cache */}
      <Text style={styles.hiddenText}>
        Welcome to This Is Working with Daniel Roth. Today we're talking about leadership in the modern workplace.
      </Text>

      {/* Caption scroller */}
      <View style={styles.captionContainer}>
        <CaptionScroller
          ref={captionScrollerRef}
          transcript={SAMPLE_TRANSCRIPT}
          theme={CAPTION_THEME}
          getMediaTimeMs={getMediaTimeMs}
          onViewportReady={() => setViewportReady(true)}
          fontsReady={true}
        />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleReset}
        >
          <MaterialCommunityIcons name="refresh" size={24} color="#ffffff" />
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>

        <Animated.View style={playButtonStyle}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayPause}
          >
            <MaterialCommunityIcons
              name={isPlaying ? "pause" : "play"}
              size={32}
              color="#ffffff"
            />
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.timeDisplay}>
          <Text style={styles.timeText}>
            {Math.max(0, Math.floor(currentTimeMs / 1000))}s / {Math.floor(END_MS / 1000)}s
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60, // Account for status bar
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#b4b4b4',
  },
  artworkContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  artwork: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginBottom: 12,
  },
  podcastTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  episodeTitle: {
    fontSize: 14,
    color: '#b4b4b4',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  captionContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  resetButtonText: {
    color: '#ffffff',
    fontSize: 14,
    marginLeft: 4,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#d97706',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  timeDisplay: {
    alignItems: 'center',
  },
  timeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  hiddenText: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    fontFamily: 'System',
    fontSize: 22,
    lineHeight: 28,
    color: 'transparent',
  },
});
