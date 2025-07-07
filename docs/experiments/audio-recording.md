# Experiment: Audio Recording Approaches

## Goal
Record both screen and in-app audio for podcast video clips (especially on iOS).

## Attempts

### 1. expo-screen-recorder
- **Setup:** Used expo-screen-recorder to record screen with microphone enabled.
- **Result:** Captures screen and mic, but iOS mutes in-app audio (audio ducking).
- **Notes:** Tried configuring Audio.setAudioModeAsync to allow recording, but iOS still ducks app audio.

### 2. expo-av + Audio Session Tweaks
- **Setup:** Used expo-av for playback, set allowsRecordingIOS: true.
- **Result:** App audio still ducked during screen recording on iOS.

### 3. (Planned) ffmpeg-kit-react-native
- **Setup:** Will attempt to generate video with audio programmatically.
- **Result:** TBD

## Conclusion
- iOS audio ducking is a major blocker for in-app audio capture.
- Android may work better; server-side composition is a possible fallback. 