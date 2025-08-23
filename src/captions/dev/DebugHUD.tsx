import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { FpsBanner, useJankCounter } from './FpsBanner';

type DebugHUDProps = {
  mediaTimeMs: Animated.SharedValue<number>;
  currentOffsetY: Animated.SharedValue<number>;
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
  maxWidth: number;
  endMs: number;
};

export const DebugHUD: React.FC<DebugHUDProps> = ({ 
  mediaTimeMs, 
  currentOffsetY, 
  linesLength, 
  maxOffset,
  totalH,
  viewportH,
  viewportW,
  contentH,
  padTop,
  padBottom,
  maxScroll,
  mapData,
  maxWidth,
  endMs
}) => {
  const [displayValues, setDisplayValues] = useState({
    mediaTime: 0,
    offsetY: 0,
    yRaw: 0,
    target: 0,
    i: 0,
    t0: 0,
    t1: 0,
    o0: 0,
    o1: 0,
    slopePxPerSec: 0,
    clampedTop: false,
    clampedBottom: false,
  });

  const fps = useJankCounter();

  useEffect(() => {
    // Log mount values once
    console.log('DebugHUD mount values:');
    console.log('  viewportH:', viewportH);
    console.log('  padTop:', padTop);
    console.log('  padBottom:', padBottom);
    console.log('  contentH:', contentH);

    const interval = setInterval(() => {
      const t = mediaTimeMs.value;
      const { times, offsets } = mapData;
      const n = times.length;
      
      // Guard against empty mapData
      if (n === 0) {
        setDisplayValues({
          mediaTime: t,
          offsetY: currentOffsetY.value,
          yRaw: 0,
          target: 0,
          i: 0,
          t0: 0,
          t1: 0,
          o0: 0,
          o1: 0,
          slopePxPerSec: 0,
          clampedTop: false,
          clampedBottom: false,
        });
        return;
      }
      
      // Find current anchor interval using the same logic as the worklet
      let i = 0;
      if (t <= times[0]) {
        i = 0;
      } else if (t >= times[n - 1]) {
        i = n - 2; // Last interval
      } else {
        // Binary search to find the interval
        let lo = 0, hi = n - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (times[mid] <= t) lo = mid + 1; else hi = mid - 1;
        }
        i = lo - 1;
      }
      
      // Ensure i is within bounds
      i = Math.max(0, Math.min(i, n - 2));
      
      const t0 = times[i] || 0;
      const t1 = times[i + 1] || t0;
      const o0 = offsets[i] || 0;
      const o1 = offsets[i + 1] || o0;
      const slopePxPerSec = t1 > t0 ? (o1 - o0) / ((t1 - t0) / 1000) : 0;
      
      // Calculate yRaw (interpolated)
      const progress = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
      const yRaw = o0 + progress * (o1 - o0);
      
      // Calculate target with baseOffset
      const baseOffset = padTop - (viewportH / 2 - 24 / 2); // Assuming lineHeight = 24
      let target = yRaw + baseOffset;
      
      // Check clamping
      const clampedTop = target < 0;
      const clampedBottom = target > maxScroll;
      if (clampedTop) target = 0;
      if (clampedBottom) target = maxScroll;

      // Log to confirm we advance past interval 0 after 1000ms
      if (t > 1000 && i === 0) {
        console.log('WARNING: Still in interval 0 at time', t, 'ms');
      }

      setDisplayValues({
        mediaTime: t,
        offsetY: currentOffsetY.value,
        yRaw,
        target,
        i,
        t0,
        t1,
        o0,
        o1,
        slopePxPerSec,
        clampedTop,
        clampedBottom,
      });
    }, 200); // Update every 200ms as requested

    return () => clearInterval(interval);
  }, [mediaTimeMs, currentOffsetY, mapData, viewportH, padTop, maxScroll]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>END_MS: {endMs.toFixed(0)}ms</Text>
      <Text style={styles.text}>t: {displayValues.mediaTime.toFixed(0)}ms</Text>
      <Text style={styles.text}>target: {displayValues.target.toFixed(1)}dp</Text>
      <Text style={styles.text}>maxScroll: {maxScroll.toFixed(1)}dp</Text>
      <Text style={styles.text}>clampedBottom: {displayValues.clampedBottom ? 'YES' : 'no'}</Text>
      <Text style={styles.text}>yRaw: {displayValues.yRaw.toFixed(1)}dp</Text>
      <Text style={styles.text}>i: {displayValues.i}, {displayValues.t0.toFixed(0)}→{displayValues.t1.toFixed(0)}ms</Text>
      <Text style={styles.text}>o0→o1: {displayValues.o0.toFixed(1)}→{displayValues.o1.toFixed(1)}px</Text>
      <Text style={styles.text}>slope: {displayValues.slopePxPerSec.toFixed(1)}px/s</Text>
      <Text style={styles.text}>FPS: {fps.toFixed(1)}</Text>
      <Text style={styles.text}>viewportW: {viewportW.toFixed(0)}dp</Text>
      <Text style={styles.text}>maxWidth: {maxWidth.toFixed(0)}dp</Text>
      <Text style={styles.text}>lines: {linesLength}</Text>
      <Text style={styles.text}>totalH: {totalH.toFixed(0)}dp</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 150,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 4,
    zIndex: 1000,
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
});
