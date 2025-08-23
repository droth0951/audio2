import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFrameCallback, runOnJS } from 'react-native-reanimated';

// Performance budgets from spec
const PERFORMANCE_BUDGETS = {
  TARGET_FPS: 60,
  TARGET_FRAME_TIME_MS: 16.7,
  MAX_FRAME_TIME_MS: 20,
  FRAME_TIME_WINDOW: 120, // frames to average over
  JANK_THRESHOLD_MS: 20,
  JANK_SPIKE_LIMIT: 1, // max spikes per 10 seconds
} as const;

export const FpsBanner: React.FC = () => {
  const [frameTimes, setFrameTimes] = useState<number[]>([]);
  const [jankCount, setJankCount] = useState(0);
  const [lastJankReset, setLastJankReset] = useState(Date.now());

  useFrameCallback((frameInfo) => {
    'worklet';
    const frameTime = frameInfo.timestamp - (frameInfo.previousTimestamp || frameInfo.timestamp);
    
    runOnJS(setFrameTimes)(prev => {
      const newTimes = [...prev, frameTime];
      // Keep only the last FRAME_TIME_WINDOW frames
      if (newTimes.length > PERFORMANCE_BUDGETS.FRAME_TIME_WINDOW) {
        newTimes.shift();
      }
      return newTimes;
    });

    // Track jank spikes
    if (frameTime > PERFORMANCE_BUDGETS.JANK_THRESHOLD_MS) {
      runOnJS(setJankCount)(prev => prev + 1);
    }

    // Reset jank counter every 10 seconds
    const now = Date.now();
    if (now - lastJankReset > 10000) {
      runOnJS(setJankCount)(0);
      runOnJS(setLastJankReset)(now);
    }
  }, true);

  const averageFrameTime = frameTimes.length > 0 
    ? frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length 
    : 0;

  const isInBudget = averageFrameTime <= PERFORMANCE_BUDGETS.TARGET_FRAME_TIME_MS && 
                    jankCount <= PERFORMANCE_BUDGETS.JANK_SPIKE_LIMIT;

  const fps = averageFrameTime > 0 ? Math.round(1000 / averageFrameTime) : 0;

  return (
    <View style={[styles.container, { backgroundColor: isInBudget ? '#4CAF50' : '#F44336' }]}>
      <Text style={styles.text}>
        FPS: {fps} | Avg: {averageFrameTime.toFixed(1)}ms | Jank: {jankCount}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    padding: 8,
    borderRadius: 4,
    zIndex: 1000,
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

// Hook for logging jank to console
export const useJankCounter = () => {
  const [jankSpikes, setJankSpikes] = useState(0);

  useFrameCallback((frameInfo) => {
    'worklet';
    const frameTime = frameInfo.timestamp - (frameInfo.previousTimestamp || frameInfo.timestamp);
    
    if (frameTime > PERFORMANCE_BUDGETS.JANK_THRESHOLD_MS) {
      runOnJS(setJankSpikes)(prev => {
        const newCount = prev + 1;
        console.log(`🚨 Jank spike #${newCount}: ${frameTime.toFixed(1)}ms`);
        return newCount;
      });
    }
  }, true);

  return jankSpikes;
};
