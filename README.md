# Audio2: Podcast Clip Creation App

Audio2 is a React Native app for creating and sharing podcast video clips for social media. It lets users select podcast segments, generate video frames, and (in the future) export full videos with audio.

## Features
- Browse podcast episodes (RSS feed)
- Audio player with scrubbing and skip controls
- Clip selection (up to 4 minutes)
- Video frame generation (vertical and square)
- Save to Photos app
- (WIP) Full video generation with audio

## Quick Start
```bash
# Install dependencies
npm install
# Start the app
npx expo start
```

## Documentation
- [Project Progress Log](docs/project-progress-log.md)
- [Architecture](docs/architecture.md)
- [AI Agent Instructions](docs/ai-instructions.md)
- [Experiments](docs/experiments/)
- [TODOs](docs/todo.md) 

## 🚨 Troubleshooting

### Caption Timing Issues
If captions show wrong text or don't sync with audio:
1. **Check the [Utterance Timing Guide](docs/utterance_timing_guide.md)** - The most common cause of timing problems
2. **Review [Caption Sync Debugging](docs/caption_sync_debugging.md)** - Step-by-step debugging process
3. **Verify [Time Units Guide](docs/time_units_guide.md)** - Understanding how timing works

### Screen Recording Issues
If screen recordings show blank captions:
- Check z-index values for caption components
- Verify captions are rendered in RecordingView component
- Ensure proper audio session configuration

## Development # Build trigger
