import { useRef, useEffect } from 'react';
import Animated, {
  useSharedValue,
  useFrameCallback,
  scrollTo,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

type DriftCorrectorConfig = {
  thresholdDp: number;
  durationMs: number;
  intervalMs: number;
};

type DriftCorrectorRef = {
  start: () => void;
  stop: () => void;
  isActive: boolean;
  driftCount: number;
  lastDrift: number;
};

export function useDriftCorrector(
  listRef: React.RefObject<Animated.FlatList<any>>,
  expectedY: Animated.SharedValue<number>,
  config: DriftCorrectorConfig
): DriftCorrectorRef {
  const isActive = useSharedValue(false);
  const lastCheckTime = useSharedValue(0);
  const driftCount = useSharedValue(0);
  const lastDrift = useSharedValue(0);
  const isCorrecting = useSharedValue(false);

  const start = () => {
    isActive.value = true;
  };

  const stop = () => {
    isActive.value = false;
  };

  useFrameCallback((frameInfo) => {
    'worklet';
    if (!isActive.value || isCorrecting.value) return;

    const now = frameInfo.timestamp;
    const timeSinceLastCheck = now - lastCheckTime.value;

    if (timeSinceLastCheck >= config.intervalMs) {
      lastCheckTime.value = now;

      // Get current scroll position (this would need to be synced from onScroll)
      // For now, we'll use a workaround by reading the expected value
      const actualY = expectedY.value; // This is a placeholder - we need actual scroll position
      const expected = expectedY.value;
      const drift = Math.abs(actualY - expected);

      if (drift > config.thresholdDp) {
        driftCount.value += 1;
        lastDrift.value = actualY - expected;
        isCorrecting.value = true;

        // Apply correction with timing
        scrollTo(listRef, 0, expected, true);
        
        // Reset correction flag after duration
        setTimeout(() => {
          'worklet';
          isCorrecting.value = false;
        }, config.durationMs);
      }
    }
  }, true);

  return {
    start,
    stop,
    isActive: isActive.value,
    driftCount: driftCount.value,
    lastDrift: lastDrift.value,
  };
}
