import { useSharedValue } from 'react-native-reanimated';

// Development configuration for captions
export const DEV = {
  // Caption timing offset for testing sync issues
  offsetMs: useSharedValue(0),
  
  // Recording mode toggle
  recordingMode: useSharedValue(false),
  
  // Cache control
  clearCache: () => {
    // This would clear the caption cache
    console.log('🧹 Clearing caption cache...');
  },
  
  // Performance monitoring
  enablePerformanceLogging: true,
  
  // Test scenarios
  testScenarios: {
    shortClip: { duration: 20000, speed: 1.0 },
    longClip: { duration: 60000, speed: 1.25 },
    screenRecording: { enabled: false },
  },
};

// Development flags
export const DEV_FLAGS = {
  // Enable micro-ease for smooth start
  microEase: true,
  
  // Enable drift correction
  driftCorrection: true,
  
  // Enable paragraph breaks
  paragraphBreaks: true,
  
  // Enable hardware acceleration in recording mode
  hardwareAcceleration: true,
};
