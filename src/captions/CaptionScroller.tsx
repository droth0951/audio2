import React, { useMemo, useRef, forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedRef,
  scrollTo,
  useFrameCallback,
  runOnJS,
  withTiming,
} from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { buildTimeToOffset, makeTimeToOffsetFn } from './timeToOffset';
import { measureTranscript } from './measure/measureTranscript';

// Development flags
const DEV_FLAGS = {
  microEase: true,
};

// Constants
const START_EASE_MS = 350;
const END_FADE_MS = 300;

type Word = {
  text: string;
  startMs: number;  // inclusive
  endMs: number;    // exclusive
};

type Transcript = {
  words: Word[];             // contiguous, sorted by startMs
  speaker?: string;          // optional
};

type CaptionTheme = {
  fontFamily: string;
  fontSize: number;          // dp
  lineHeight: number;        // dp
  maxWidthDp: number;        // wrapping width for caption block
  highlightColor?: string;   // optional later
  textColor: string;
  paragraphSpacingDp: number;
};

type Props = {
  transcript: Transcript;
  theme: CaptionTheme;
  getMediaTimeMs: () => number; // native player getter
  onViewportReady?: (viewportH: number) => void;
  fontsReady?: boolean;
};

export type CaptionScrollerRef = {
  listRef: React.RefObject<Animated.FlatList<any>>;
  scrollY: Animated.SharedValue<number>;
  mediaTimeMs: Animated.SharedValue<number>;
  linesLength: number;
  maxOffset: number;
  totalH: number;
  viewportH: number;
  viewportW: number;
  contentH: number;
  padTop: number;
  padBottom: number;
  maxScroll: number;
  mapData: { times: Float64Array; offsets: Float64Array };
};

export const CaptionScroller = forwardRef<CaptionScrollerRef, Props>(({ transcript, theme, getMediaTimeMs, onViewportReady, fontsReady = true }, ref) => {
  const listRef = useAnimatedRef<Animated.FlatList<any>>();
  const [viewportH, setViewportH] = React.useState(0);
  const [viewportW, setViewportW] = React.useState(0);
  const [layoutData, setLayoutData] = React.useState<any>(null);
  const [measurementComplete, setMeasurementComplete] = React.useState(false);
  const [glyphsWarmed, setGlyphsWarmed] = React.useState(false);
  
  // Warm glyph caches first (but don't block measurement)
  useEffect(() => {
    if (!fontsReady) return;
    
    // Render caption text in 0x0 offscreen container to warm glyph caches
    const warmGlyphs = () => {
      console.log('🔥 Warming glyph caches...');
      setGlyphsWarmed(true);
    };
    
    // Small delay to ensure fonts are loaded
    const timer = setTimeout(warmGlyphs, 100);
    return () => clearTimeout(timer);
  }, [fontsReady]);

  // Measure transcript when fonts are ready and viewport is available
  useEffect(() => {
    if (!fontsReady || !viewportW || !viewportH) return;
    
    const performMeasurement = async () => {
      try {
        console.log('📏 Starting transcript measurement...');
        const result = await measureTranscript(transcript, theme);
        console.log('✅ Measurement complete:', {
          lines: result.lines.length,
          totalH: result.totalH,
          maxWidth: theme.maxWidthDp
        });
        setLayoutData(result);
        setMeasurementComplete(true);
      } catch (error) {
        console.error('❌ Measurement failed:', error);
        // Fallback to simple one-word-per-line layout
        const fallbackData = {
          lines: transcript.words.map((w, i) => ({ text: w.text, startWordIdx: i, endWordIdx: i })),
          itemHeights: transcript.words.map(() => theme.lineHeight),
          yByWordIndex: transcript.words.map((_, i) => i * theme.lineHeight),
          totalH: transcript.words.length * theme.lineHeight,
        };
        setLayoutData(fallbackData);
        setMeasurementComplete(true);
      }
    };
    
    performMeasurement();
  }, [fontsReady, viewportW, viewportH, transcript.words, theme]);

  // Precompute time->offset mapping
  const mapData = useMemo(() => {
    if (!layoutData) return { times: new Float64Array(0), offsets: new Float64Array(0) };
    return buildTimeToOffset(transcript.words, layoutData.yByWordIndex, layoutData.totalH);
  }, [transcript.words, layoutData]);

  const mapFn = useMemo(() => makeTimeToOffsetFn(mapData), [mapData]);

  // Log first 5 anchors after mapping
  useEffect(() => {
    if (mapData.times.length > 0) {
      console.log('🎯 First 5 anchors (t, y):');
      for (let i = 0; i < Math.min(5, mapData.times.length); i++) {
        console.log(`  ${i}: ${mapData.times[i].toFixed(0)}ms → ${mapData.offsets[i].toFixed(1)}px`);
      }
    }
  }, [mapData]);

  // Spacer/padding
  const padTop = Math.max(0, Math.floor((viewportH || 0) * 0.5));
  const padBottom = padTop + Math.floor((viewportH || 0) * 0.5);
  const contentH = (layoutData?.totalH || 0) + padTop + padBottom;

  const mediaTimeMs = useSharedValue(0);
  const scrollY = useSharedValue(0);

  // Expose ref
  useImperativeHandle(ref, () => ({
    listRef,
    scrollY,
    mediaTimeMs,
    linesLength: layoutData?.lines.length || 0,
    maxOffset: layoutData?.totalH || 0,
    totalH: layoutData?.totalH || 0,
    viewportH,
    viewportW,
    contentH,
    padTop,
    padBottom,
    maxScroll: Math.max(0, contentH - (viewportH || 0)),
    mapData,
  }), [listRef, scrollY, mediaTimeMs, layoutData, viewportH, viewportW, contentH, padTop, padBottom, mapData]);

  // Update media time from external getter (no longer needed with real playback driver)
  // The CaptionsDemoScreen now handles timing via useFrameCallback

  // Frame driver (native) - blended motion with drift corrector
  useFrameCallback((_frame) => {
    'worklet';
    if (!measurementComplete) return;
    
    const t = mediaTimeMs.value;
    const yMap = mapFn(t); // interpolated y position from anchors
    const yConst = scrollY.value; // current scroll position
    
    // Compute baseOffset only after viewportH is known
    const baseOffset = viewportH > 0 ? padTop - (viewportH / 2 - theme.lineHeight / 2) : 0;
    
    // Blended motion: target = BLEND*yConst + (1-BLEND)*yMap + baseOffset
    const BLEND = 0.75;
    let target = BLEND * yConst + (1 - BLEND) * yMap + baseOffset;

    // Clamp to [0, contentH - viewportH]
    const maxScroll = Math.max(0, contentH - (viewportH || 0));
    if (target > maxScroll) target = maxScroll;
    if (target < 0) target = 0;

    // Drift corrector: nudge ≤12px over 120ms if |expected−actual| exceeds threshold
    const expected = target;
    const actual = scrollY.value;
    const drift = Math.abs(expected - actual);
    const DRIFT_THRESHOLD = 12;
    const DRIFT_CORRECTION = 12;
    const DRIFT_TIME = 120; // ms
    
    if (drift > DRIFT_THRESHOLD) {
      const correction = Math.sign(expected - actual) * Math.min(DRIFT_CORRECTION, drift);
      target = actual + correction;
    }

    scrollY.value = target;
    scrollTo(listRef, 0, target, false);
  }, true);

  const renderItem = ({ item }: any) => (
    <Text style={[styles.text, { 
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      lineHeight: theme.lineHeight,
      color: theme.textColor,
      width: theme.maxWidthDp,
      alignSelf: 'center',
      textAlign: 'center',
      marginBottom: theme.paragraphSpacingDp,
    }]}>{item.text}</Text>
  );

  return (
    <View
      style={{ flex: 1 }}
      onLayout={(e) => {
        const height = e.nativeEvent.layout.height;
        const width = e.nativeEvent.layout.width;
        setViewportH(height);
        setViewportW(width);
        if (onViewportReady && height > 0) {
          onViewportReady(height);
        }
      }}
    >
      {/* Offscreen glyph cache warming container */}
      {fontsReady && !glyphsWarmed && (
        <View style={styles.glyphWarmingContainer}>
          <Text style={[styles.glyphWarmingText, {
            fontFamily: theme.fontFamily,
            fontSize: theme.fontSize,
            lineHeight: theme.lineHeight,
          }]}>
            {transcript.words.slice(0, 20).map(w => w.text).join(' ')}
          </Text>
        </View>
      )}
      
      <Animated.FlatList
        ref={listRef}
        data={layoutData?.lines || []}
        renderItem={renderItem}
        keyExtractor={(it, idx) => String(idx)}
        contentContainerStyle={{ paddingTop: padTop, paddingBottom: padBottom }}
        initialNumToRender={layoutData?.lines.length || 0}
        removeClippedSubviews={false}
        getItemLayout={(_, index) => ({
          length: layoutData?.itemHeights[index] || theme.lineHeight,
          offset: layoutData?.itemHeights.slice(0, index).reduce((a, b) => a + b, 0) || 0,
          index,
        })}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  text: {
    alignSelf: 'center',
    textAlign: 'center',
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
  glyphWarmingContainer: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  glyphWarmingText: {
    color: 'transparent',
  },
});
