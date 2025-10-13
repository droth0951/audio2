# Audio2 - Current Production Status
**Last Updated:** October 3, 2025  
**App Status:** 🟢 Live on App Store as "podknowledge"  
**Video Generation:** Server-side (Railway)  
**Platform:** iOS only

---

## 📱 PRODUCTION APP STATE

### Live Features (App Store)
- ✅ **Podcast Discovery**: iTunes Search API integration with artwork
- ✅ **RSS Feed Support**: Any podcast RSS URL, 30-minute caching
- ✅ **Full Audio Player**: Scrubbing, 5s/15s skip, waveform animations
- ✅ **Clip Selection**: Visual markers, 4-minute max duration, preview mode
- ✅ **Server-Side Video**: Railway backend generates MP4 files
- ✅ **AI Captions**: AssemblyAI integration with file upload method
- ✅ **Photos Export**: Direct save to iOS Photos app
- ✅ **OTA Updates**: Instant JavaScript updates via EAS

### User Flow (Production)
1. Search podcasts → iTunes API
2. Paste RSS URL → Load episodes
3. Play episode → Set clip start/end points
4. Optional: Enable captions toggle
5. Create video → Job sent to Railway server
6. Video generated → Download to Photos app
7. Share → Standard iOS sharing

---

## 🏗️ ARCHITECTURE

### Mobile App (React Native + Expo SDK 53)
**Repository:** github.com/droth0951/audio2  
**Branch:** `main` (production)

```
/src
├── /components
│   ├── AudioPlayer.js          # Core playback controls
│   ├── VideoCreationModal.js   # Video format selection
│   └── AboutModal.js           # App info & version
├── App.js                      # Main app (routing, state)
└── /services
    └── CaptionService.js       # Caption timing logic
```

**Key Dependencies:**
```json
{
  "expo": "~53.0.17",
  "expo-av": "~15.1.7",           // Audio playback
  "expo-media-library": "~17.1.7", // Photos integration
  "@expo/vector-icons": "~14.1.0", // UI icons
  "react-native-reanimated": "~3.16.3" // Animations
}
```

### Railway Server (Node.js + Express)
**Deployment:** Two instances
- **Production**: `audio-trimmer-service-production.up.railway.app`
- **Test**: `amusing-education-production.up.railway.app`

**Primary Functions:**
1. **Transcription Proxy** (`/api/transcribe`)
   - Routes requests to AssemblyAI
   - File upload method (solves CDN timing issues)
   - Caches transcripts to reduce API costs

2. **Video Generation** (`/api/create-video`)
   - Downloads audio segment from podcast CDN
   - Generates video frames with FFmpeg
   - Overlays captions (if enabled)
   - Returns MP4 file URL

**Key Technologies:**
- FFmpeg (audio/video processing)
- AssemblyAI API (speech-to-text)
- Font system: Roboto installed via Nixpacks
- Job queue for async processing

---

## 🎯 ACTIVE DEVELOPMENT

### Current Focus: Caption Synchronization Fix
**Problem:** CDN timing mismatches cause captions to not match audio  
**Root Cause:** Podcast URLs use time-sensitive tokens; audio content differs between app download and AssemblyAI processing  
**Solution:** File upload method instead of URL-based transcription

**Status:**
- ✅ File upload method implemented on Railway
- ✅ Audio extraction working with FFmpeg
- 🔄 Testing in production with real podcast URLs
- 🔄 Font rendering optimization ongoing

### Known Issues
1. **Caption Content Mismatch** (~70% of videos)
   - Audio: "Because I teach at NYU"
   - Captions: "You can build internal resources..."
   - Fix: File upload method deployment in progress

2. **Font Rendering** (Railway server)
   - Roboto font installation via Nixpacks
   - Configuration: `railway.toml` + `nixpacks.toml`
   - Recent fix deployed, awaiting verification

3. **Video Download Endpoint**
   - Static file serving working
   - Download endpoint needs update
   - Temporary workaround: direct `/temp/video_[ID].mp4` access

---

## 💰 COST STRUCTURE

### Current Costs (per video)
- **AssemblyAI Transcription**: ~$0.005 for 30-second clip
- **Railway Compute**: ~$0.003 per video
- **Total per video**: ~$0.008 (well under $0.20 target)

### Optimization Strategy
- **4-minute clip limit**: Prevents expensive full-episode transcription
- **Transcript caching**: Reduces duplicate API calls
- **File upload method**: Single audio source for perfect sync
- **Railway free tier**: Currently sufficient for testing

---

## 🚀 DEPLOYMENT WORKFLOW

### JavaScript Changes (Fast - OTA)
```bash
# Instant update to production users (no App Store review)
git commit -m "Fix caption timing"
eas update --channel production --message "Caption fixes"
```

### Native Changes (Slow - App Store)
```bash
# Requires App Store review (~24-48 hours)
# Update version in app.json first
eas build --platform ios --profile production
eas submit --platform ios --latest
```

### Railway Server Changes
```bash
# Must deploy from main branch (Railway ignores other branches)
git checkout main
git merge feature-branch
git push origin main
# Railway auto-deploys from main
```

---

## 🔧 TECHNICAL DETAILS

### Time Units (CRITICAL)
**All times in milliseconds throughout codebase**
- ❌ WRONG: `currentTime = 185` (seconds)
- ✅ CORRECT: `currentTimeMs = 185000` (milliseconds)
- Audio playback: milliseconds
- Caption timestamps: milliseconds  
- Clip boundaries: milliseconds
- Always verify values are 4-6 digits

### Caption System Architecture
**File:** `src/services/CaptionService.js`

```javascript
// Production-tested pattern:
class CaptionService {
  setTranscript(result, clipStartMs, clipEndMs) {
    // Stores transcript with clip boundaries
  }
  
  getCurrentCaption(currentTimeMs) {
    // Returns caption text for current playback position
    // Uses utterance-based boundaries (not word-based)
  }
}
```

**Key Rules:**
- Utterance-based boundaries (maintains speaker integrity)
- Max 3 lines per caption
- Position: y=80 (doesn't block episode title)
- Font: Roboto, size 48 (SVG units)

### Audio Configuration (Anti-Ducking)
```javascript
// Required for audio during recording/processing
await Audio.setAudioModeAsync({
  allowsRecordingIOS: true,
  staysActiveInBackground: true,
  playsInSilentModeIOS: true,
  interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX
});
```

---

## 📋 TESTING CHECKLIST

### Mobile App Testing
- [ ] Episode search and RSS feed loading
- [ ] Audio playback (play, pause, scrubbing, skip)
- [ ] Clip selection with visual markers
- [ ] Caption toggle functionality
- [ ] Video creation job submission
- [ ] Video download from Railway
- [ ] Photos app export
- [ ] Social media sharing

### Server Testing
- [ ] Transcription API with file upload
- [ ] Video generation with podcast metadata
- [ ] Caption overlay rendering
- [ ] Font rendering (Roboto)
- [ ] Cost tracking accuracy
- [ ] Job queue performance
- [ ] Error handling and recovery

### Critical Test Cases
1. **Caption Sync Test**: Verify caption text matches audio content exactly
2. **CDN Test**: Test with different podcast CDNs (Megaphone, Libsyn, etc.)
3. **Cost Test**: Verify costs stay under $0.01 per 30-second video
4. **Performance Test**: Video generation under 90 seconds

---

## 🎨 DESIGN SYSTEM

### Color Palette (Claude Theme)
```css
Primary Background: #1c1c1c → #2d2d2d (gradient)
Secondary Background: #2d2d2d
Accent: #d97706 (orange)
Text Primary: #f4f4f4
Text Secondary: #b4b4b4
Borders: #333333, #404040
```

### Video Output Specifications
- **Background**: Claude gradient
- **Artwork**: Centered podcast artwork, rounded corners
- **Progress Bar**: Orange, precise timing
- **Waveform**: 15 animated bars
- **Typography**: Clean hierarchy
- **Captions**: White text, black background (when enabled)
- **Resolution**: Server-generated, optimized for social media

---

## 📞 CRITICAL INFORMATION FOR AI ASSISTANTS

### Railway Deployment
- **MUST use `main` branch** - Railway ignores all other branches
- Configuration files: `railway.toml` + `nixpacks.toml`
- Auto-deploys on push to main

### Time Units
- **Everything is milliseconds** - Never use seconds
- Verify values are 4-6 digits before committing
- Add console.log to verify time values

### Caption System
- **File upload method** is the current solution (not URL-based)
- **Utterance boundaries** maintain speaker integrity
- **Y-position 80** keeps captions above UI elements

### Cost Optimization
- **4-minute clip limit** prevents expensive transcription
- **Caching critical** for reducing AssemblyAI costs
- **Monitor Railway usage** to stay within free tier during testing

---

## 🔗 KEY URLS

### Production
- **App Store**: Search "podknowledge" or "Audio2"
- **Railway Server**: `audio-trimmer-service-production.up.railway.app`
- **Test Server**: `amusing-education-production.up.railway.app`

### Development
- **GitHub**: github.com/droth0951/audio2
- **EAS Builds**: expo.dev/@danroth/podknowledge
- **AssemblyAI**: dashboard.assemblyai.com

---

## 📊 SUCCESS METRICS

### Current Performance
- ✅ App Store approved and live
- ✅ OTA updates working
- ✅ Server-side video generation operational
- 🔄 Caption accuracy: ~30% (fixing with file upload method)
- ✅ Cost per video: ~$0.008 (under target)
- ✅ User flow complete end-to-end

### Target Goals
- 🎯 Caption accuracy: 99%+ (file upload method)
- 🎯 Video generation time: Under 60 seconds
- 🎯 Cost per video: Under $0.01
- 🎯 Zero crashes in production

---

## 🚨 COMMON PITFALLS

1. **Don't push to non-main branches expecting Railway deploy**
2. **Don't use seconds anywhere in the codebase**
3. **Don't modify caption timing logic without understanding utterance boundaries**
4. **Don't bypass the file upload method for AssemblyAI**
5. **Don't forget to test with real podcast URLs (CDN behavior varies)**

---

## 🎯 NEXT MILESTONES

### Immediate (This Week)
- [ ] Verify file upload caption fix in production
- [ ] Confirm font rendering working on Railway
- [ ] Test download endpoint fix

### Short-term (This Month)
- [ ] Achieve 99%+ caption accuracy
- [ ] Optimize video generation to under 45 seconds
- [ ] Add notification system when videos ready

### Long-term (Next Quarter)
- [ ] Multiple aspect ratios (1:1, 9:16, 16:9)
- [ ] Custom caption styling options
- [ ] Direct social media posting
- [ ] Android support

---

**End of Current Status Document**  
*For historical context, see `/docs/archive/` folder*