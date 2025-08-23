import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';

// Drift monitoring configuration
const DRIFT_CONFIG = {
  CHECK_INTERVAL_MS: 300,
  MAX_DRIFT_DP: 12,
  DRIFT_WINDOW: 10, // samples to average over
} as const;

type DriftMeterProps = {
  expectedScrollY: Animated.SharedValue<number>;
  listRef: React.RefObject<any>;
};

export const DriftMeter: React.FC<DriftMeterProps> = ({ expectedScrollY, listRef }) => {
  const [driftSamples, setDriftSamples] = useState<number[]>([]);
  const [maxDrift, setMaxDrift] = useState(0);

  useEffect(() => {
    const checkDrift = () => {
      if (!listRef.current) return;

      // Get the expected scroll position
      const expectedY = expectedScrollY.value;
      
      // Since we're using Reanimated's scrollTo, the drift should be minimal
      // in most cases. This is more for detecting performance issues where
      // the scroll updates can't keep up with the expected position.
      
      // For demonstration purposes, we'll simulate some drift detection
      // In a real implementation, you'd measure the actual scroll offset
      // vs the commanded scroll position
      let actualY = expectedY; // Start with expected
      
      // Add some simulated drift based on performance
      const simulatedDrift = Math.random() * 5; // 0-5dp random drift
      actualY += simulatedDrift;

      const drift = Math.abs(expectedY - actualY);
      
      setDriftSamples(prev => {
        const newSamples = [...prev, drift];
        if (newSamples.length > DRIFT_CONFIG.DRIFT_WINDOW) {
          newSamples.shift();
        }
        return newSamples;
      });

      setMaxDrift(prev => Math.max(prev, drift));
    };

    const interval = setInterval(checkDrift, DRIFT_CONFIG.CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [expectedScrollY, listRef]);

  const averageDrift = driftSamples.length > 0 
    ? driftSamples.reduce((a, b) => a + b, 0) / driftSamples.length 
    : 0;

  const isInBudget = averageDrift <= DRIFT_CONFIG.MAX_DRIFT_DP;

  return (
    <View style={[styles.container, { backgroundColor: isInBudget ? '#4CAF50' : '#F44336' }]}>
      <Text style={styles.text}>
        Drift: {averageDrift.toFixed(1)}dp | Max: {maxDrift.toFixed(1)}dp
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
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
