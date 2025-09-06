# File Upload Caption Fix - Implementation Plan

## Problem Statement

**Current Issue**: Caption content doesn't match audio content due to time-sensitive podcast CDN URLs.

**Examples**:
- Audio: "Because I teach at NYU" 
- Captions: "You can build internal resources..."
- Audio: "take people"
- Captions: "Talent. Sometimes..."

## Root Cause Analysis

1. **Dynamic CDN URLs**: Podcast URLs redirect through multiple layers
   - `podtrac.com/pts/redirect.mp3` → `traffic.megaphone.fm` → `dcs-spotify.megaphone.fm`
2. **Time-sensitive tokens**: Final URLs contain authentication keys that change rapidly
   - `key=4d7a538c...&timetoken=1757170079...`
3. **Timing gap**: By the time AssemblyAI processes the URL, it resolves to different content than the app accessed

## Previous Failed Approaches

- ❌ **URL pre-resolution**: Still hit timing windows where CDN content changed
- ❌ **Server-side URL debugging**: Couldn't prevent content divergence
- ❌ **Railway deployment fixes**: Infrastructure wasn't the issue

## Solution: Direct File Upload (Gemini's Approach)

### Core Concept
Instead of sending dynamic URLs to AssemblyAI, download the exact audio segment and upload the static file.

### Why This Works
- **Single source of truth**: Static file eliminates URL timing issues
- **Perfect synchronization**: AssemblyAI transcribes identical bytes to what user heard
- **Deterministic**: No race conditions or CDN variables

## Cost Analysis (100 users, 2 clips/day, 2.5min each)

- **Data transfer**: 500MB/day = 15GB/month
- **Railway egress cost**: 15GB × $0.05 = **$0.75/month**
- **Total infrastructure**: Under $6/month (well within $20 budget)
- **Scale headroom**: Can handle 300-400 users before budget limits

## Implementation Steps

### Phase 1: Core Infrastructure
1. ✅ Create `file-upload-fix` branch
2. ✅ Add required dependencies (`form-data`, `fs-extra`)
3. Create temporary file management system
4. Implement audio segment download logic

### Phase 2: File Processing
1. Download audio segment from resolved URL
2. Extract exact timeframe (start/end seconds)
3. Use FFmpeg to create clean audio clip
4. Validate file before upload

### Phase 3: AssemblyAI Integration
1. Replace URL-based API calls with file upload
2. Use AssemblyAI's upload endpoint instead of `audio_url`
3. Maintain existing timestamp conversion logic
4. Preserve speaker labeling and formatting options

### Phase 4: Error Handling & Cleanup
1. Implement robust download timeout handling
2. Clean up temporary files after upload
3. Fallback to URL method if download fails
4. Add comprehensive logging for debugging

## Technical Architecture

```
App Request → Railway Server → Download Audio Segment → Upload to AssemblyAI
     ↓              ↓                    ↓                      ↓
URL + timing → Resolve CDN URLs → Static .mp3 file → File upload API
```

## Lean Development Principles

### Keep It Simple
- Minimal changes to existing app code
- Single-purpose functions for each step
- Clear separation of concerns

### Fail Fast
- Quick validation of download success
- Early error returns with clear messages
- Graceful degradation to URL method

### Incremental Progress
- Test each phase independently
- Maintain backward compatibility during development
- Small, focused commits

## Success Metrics

### Before (Current State)
- ❌ Caption content matches audio: ~20-30% of the time
- ❌ User experience: Frustrating, unreliable captions
- ❌ Debugging: Complex, timing-dependent issues

### After (Target State)
- ✅ Caption content matches audio: 99%+ of the time
- ✅ User experience: Reliable, accurate captions
- ✅ Debugging: Deterministic, easy to troubleshoot
- ✅ Cost: Under $1/month for infrastructure

## Risk Mitigation

### Potential Issues
1. **Download timeouts**: Use shorter timeouts, retry logic
2. **FFmpeg processing**: Validate input/output, handle errors gracefully
3. **Disk space**: Clean up files immediately after upload
4. **Network issues**: Fallback to original URL method

### Testing Strategy
1. Unit tests for each processing step
2. Integration tests with real podcast URLs
3. Load testing with multiple concurrent requests
4. Cost monitoring on Railway dashboard

## Implementation Notes

### File Structure
```
audio-trimmer-server/
├── api/
│   ├── transcribe.js (modified for file upload)
│   └── upload-utils.js (new - file processing utilities)
├── temp/ (temporary audio files - auto-cleanup)
└── package.json (updated dependencies)
```

### Key Dependencies
- `form-data`: For multipart file uploads to AssemblyAI
- `fs-extra`: Enhanced file system operations
- `fluent-ffmpeg`: Audio processing (already installed)
- `ffmpeg-static`: FFmpeg binary (already installed)

## Deployment Plan

1. **Branch development**: Complete implementation in `file-upload-fix`
2. **Local testing**: Validate with real podcast URLs
3. **Railway staging**: Test in production environment
4. **A/B comparison**: Compare results with current URL method
5. **Merge to main**: Deploy when caption accuracy > 95%

---

*Document created: 2025-09-06*  
*Last updated: 2025-09-06*  
*Status: Planning → Implementation*