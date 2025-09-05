# AI Agent Instructions

Welcome, AI collaborator!

## Project Goal
Audio2 is a React Native app for creating social-ready podcast video clips with RSS feed integration, audio playback, and video frame generation.

## Current Implementation Status
- ✅ **RSS Integration**: Custom podcast feed URLs supported
- ✅ **Audio Playback**: expo-av with scrubbing and clip selection
- ✅ **Video Frame Generation**: react-native-view-shot for static frames
- ✅ **Screen Recording**: expo-screen-recorder implemented
- ✅ **Voice Recognition**: @react-native-voice/voice for captions
- ✅ **Railway Proxy Server**: Cost-optimized AssemblyAI integration
- 🔄 **Full Video Generation**: Frame generation working, full MP4 in progress

## 🚨 CRITICAL: Cost Optimization Strategy
**NEVER send full audio to AssemblyAI - only clips!**

### Cost Optimization Rules:
- **Clip Duration Limit**: Maximum 4 minutes (240 seconds)
- **AssemblyAI Trimming**: Use `audio_start_from` and `audio_end_at` parameters
- **Railway Proxy**: All AssemblyAI calls go through your proxy server
- **No Local Audio Processing**: Let AssemblyAI handle trimming server-side
- **Caching**: Transcripts are cached to avoid duplicate API calls

### Architecture:
```
Mobile App → Railway Proxy → AssemblyAI API
                ↓
         Environment Variables
         (ASSEMBLY_AI_API_KEY)
```

## 🚨 CRITICAL: Railway Deployment Branch
**⚠️ RAILWAY ONLY DEPLOYS FROM `main` BRANCH ⚠️**
- Railway server changes must be merged to `main` and pushed
- Feature branches are ignored by Railway deployment
- Always verify: `git checkout main && git merge feature-branch && git push origin main`

## Key Additions Made:

1. **Cost Optimization Strategy**: Added the critical rule about never sending full audio to AssemblyAI
2. **Railway Proxy Server**: Documented your proxy architecture for security and cost control
3. **AssemblyAI Integration**: Explained how you use server-side trimming to minimize costs
4. **4-Minute Limit**: Clarified this is a cost optimization, not just a technical limit
5. **Caching Strategy**: Added information about transcript caching to reduce API calls
6. **Architecture Diagram**: Shows the secure proxy pattern you're using
7. **Cost Priority**: Made it clear that cost optimization is a primary concern

This updated version now accurately reflects your sophisticated cost-optimized architecture and will help any AI assistant understand the critical importance of never sending full audio to AssemblyAI while maintaining great user experience.

## Key Technologies
- **expo-av**: Audio playback and control
- **expo-screen-recorder**: Screen and audio recording
- **react-native-view-shot**: Video frame capture
- **expo-media-library**: Save to Photos app
- **@react-native-voice/voice**: Speech recognition for captions
- **react-native-gesture-handler**: Swipe navigation and controls
- **react-native-reanimated**: Smooth animations
- **react-native-awesome-slider**: Audio scrubbing
- **Railway**: Proxy server for AssemblyAI integration
- **AssemblyAI**: Server-side audio transcription with trimming

## How to Help
- Please read `docs/project-progress-log.md` and `docs/experiments/` before suggesting new features or fixes.
- Prefer Expo-compatible, cross-platform solutions.
- If you try a new approach, add a summary to `docs/experiments/`.
- Keep commit messages clear and update the progress log.
- **Current focus**: Full MP4 video generation with synchronized audio
- **Cost priority**: Always optimize for minimal AssemblyAI API usage

## 🚨 CRITICAL: Audio2 Timing Rules
Before modifying any timing code in Audio2, remember:
- **ALL times are milliseconds** (see `docs/time_units_guide.md`)
- `currentTimeMs` should be ~185000 (not 185)
- `clipStartMs` should be ~45000 (not 45)  
- `word.startMs` should be ~12500 (not 12.5)
- Add `console.log` to verify time values are 4-6 digits
- Never divide by 1000 unless converting for display only

## Current Features
- **RSS Feed Support**: Load any podcast RSS feed URL
- **4-Minute Clips**: Extended clip duration support (cost-optimized)
- **Video Frames**: Generate static video frames in multiple aspect ratios
- **Screen Recording**: Record screen with audio (iOS audio ducking challenges)
- **Gesture Navigation**: Swipe between episode list and detail views
- **Voice Recognition**: Real-time speech-to-text for captions
- **Railway Proxy**: Secure, cost-optimized AssemblyAI integration
- **Transcript Caching**: Avoid duplicate API calls for same clips

## Cost Optimization Details
- **AssemblyAI Trimming**: Uses `audio_start_from` and `audio_end_at` to process only clip segments
- **4-Minute Limit**: Prevents expensive full-episode transcription
- **Proxy Server**: Centralized API key management and rate limiting
- **Caching Layer**: Reduces API calls for repeated clip requests
- **Error Handling**: Graceful fallbacks to prevent wasted API calls

## Open Questions
- Can we reliably record in-app audio on iOS (audio ducking issue)?
- Should we move full video generation server-side if local solutions fail?
- How to optimize voice recognition for better caption accuracy?
- Can we implement more aggressive caching to reduce AssemblyAI costs? 