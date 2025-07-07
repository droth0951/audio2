# Architecture Overview: Audio2

## Main Components
- **App.js**: Main entry, state management, and navigation
- **AudioPlayer.js**: Audio playback, scrubbing, and clip selection
- **VideoCreationModal.js**: Video frame generation UI and logic
- **ScreenRecorderTest**: Experimental screen/audio recording harness

## Data Flow
- RSS feed → Episode list → User selects episode → Audio player loads episode
- User sets clip start/end → Can preview or save clip
- Video frame generated from selected clip
- (Planned) Full video with audio generated and saved

## Key Dependencies
- **expo-av**: Audio playback
- **expo-media-library**: Save images/videos to Photos
- **react-native-view-shot**: Capture video frames
- **expo-screen-recorder**: (Experimental) Screen/audio recording
- **expo-file-system**: File management

## Design
- Claude-inspired dark theme
- Modular, component-based structure 