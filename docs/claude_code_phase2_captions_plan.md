# Audio2 Phase 2 - Updated Caption Integration Plan
## File Upload Method for Perfect CDN Sync

---

## 🎯 PROJECT OVERVIEW

**PHASE**: Phase 2 - Caption Integration with File Upload Method  
**CONTEXT**: Server-side video generation working on amusing-education test server  
**CURRENT BRANCH**: `railway-fix-test`  
**TEST SERVER**: `amusing-education-production.up.railway.app`  
**GOAL**: Implement file upload method to solve CDN timing mismatches  
**TIMELINE**: 1 week (focused caption fix)

---

## 🔍 THE CORE PROBLEM WE'RE SOLVING

### CDN Timing Issue (Current Production Problem):
```
User selects clip → App downloads audio from CDN URL
    ↓
AssemblyAI receives same URL → But CDN redirects to DIFFERENT content
    ↓
Result: Captions for different audio segment than user heard
```

**Examples from Production**:
- Audio: "Because I teach at NYU" 
- Captions: "You can build internal resources..."
- Audio: "take people"  
- Captions: "Talent. Sometimes..."

### Root Cause:
- Podcast URLs redirect through: `podtrac.com` → `traffic.megaphone.fm` → `dcs-spotify.megaphone.fm`
- Final URLs contain time-sensitive tokens: `key=4d7a538c...&timetoken=1757170079...`
- Between app download and AssemblyAI processing, CDN serves different content

---

## 🛠️ CURRENT PRODUCTION CAPTION SYSTEM

### What's Already Working:
1. **CaptionService Architecture**: Centralized caption logic with robust error handling
2. **getCurrentCaption() Method**: Production-tested timing calculations  
3. **Utterance-Based Logic**: Proper speaker boundaries (NOT word-based)
4. **SVG Integration**: Captions positioned at y=80, max 3 lines
5. **Font System**: Roboto properly installed and working

### Current Implementation Pattern:
```javascript
// From production app - this pattern works:
if (result.status === 'completed') {
  captionService.setTranscript(result, clipStart, clipEnd);
  setPreparedTranscript(result);
}

const getCurrentCaption = () => {
  if (!captionsEnabled) return '';
  const { text } = captionService.getCurrentCaption(currentTimeMs);
  return text;
};
```

### Key Production Rules (DO NOT CHANGE):
- **All time values in milliseconds** (no seconds conversion)
- **Utterance-based boundaries** (maintains speaker integrity)  
- **y=80 positioning** (doesn't block episode title)
- **Max 3 lines** (prevents screen overflow)
- **fontSize: '48'** (SVG units, not px)
- **Roboto font family** (already working)

---

## 🎯 SOLUTION: FILE UPLOAD METHOD

### The Fix:
```javascript
// Instead of sending URLs to AssemblyAI:
POST /api/create-video {
  audioUrl: "https://dynamic-cdn-url-with-tokens"
}

// NEW: Download exact audio and upload file:
1. Server downloads audio segment from audioUrl
2. Extract exact clip timeframe (clipStart to clipEnd)  
3. Create temporary audio file
4. Upload file to AssemblyAI (not URL)
5. AssemblyAI transcribes IDENTICAL audio user heard
```

### Why This Works:
- **Single source of truth**: Static file eliminates URL timing issues
- **Perfect synchronization**: AssemblyAI transcribes identical bytes to what user heard
- **Deterministic**: No race conditions or CDN variables

---

## 🏗️ IMPLEMENTATION PLAN

### Phase 2A: Server-Side File Processing (3-4 days)

#### 1. Enhance Video Creation Endpoint
```javascript
// Modify api/create-video.js on amusing-education server
POST /api/create-video
{
  audioUrl,           // Existing
  clipStart,          // Existing  
  clipEnd,            // Existing
  podcast,            // Existing
  captionsEnabled: true,    // NEW: Caption toggle
  template: 'professional'  // Existing
}
```

#### 2. Add Audio Download & Processing + Smart Feature Logging
```javascript
// NEW FILE: services/audio-processor.js
const FormData = require('form-data');
const fs = require('fs-extra');
const ffmpeg = require('fluent-ffmpeg');

class AudioProcessor {
  async downloadAndExtractClip(audioUrl, clipStartMs, clipEndMs) {
    try {
      // 1. Download full audio file
      console.log('🎵 Downloading audio from:', audioUrl);
      const audioResponse = await fetch(audioUrl);
      const audioBuffer = await audioResponse.buffer();
      
      // 2. Save to temporary file
      const tempInputPath = `/tmp/input-${Date.now()}.mp3`;
      const tempOutputPath = `/tmp/clip-${Date.now()}.mp3`;
      await fs.writeFile(tempInputPath, audioBuffer);
      
      // 3. Extract exact clip using FFmpeg
      const startSeconds = clipStartMs / 1000;
      const durationSeconds = (clipEndMs - clipStartMs) / 1000;
      
      await new Promise((resolve, reject) => {
        ffmpeg(tempInputPath)
          .setStartTime(startSeconds)
          .setDuration(durationSeconds)
          .output(tempOutputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      
      // 4. Read extracted clip
      const clipBuffer = await fs.readFile(tempOutputPath);
      
      // 5. Cleanup temp files
      await fs.remove(tempInputPath);
      await fs.remove(tempOutputPath);
      
      console.log('✅ Audio clip extracted successfully:', {
        originalSize: `${Math.round(audioBuffer.length / 1024)}KB`,
        clipSize: `${Math.round(clipBuffer.length / 1024)}KB`,
        duration: `${durationSeconds}s`
      });
      
      return clipBuffer;
      
    } catch (error) {
      console.error('❌ Audio processing failed:', error);
      throw error;
    }
  }

  // 🚀 NEW: Enhanced logging for smart features (Phase 1 foundation)
  logSmartInsights(transcript, clipStartMs, clipEndMs) {
    try {
      const clipDurationMs = clipEndMs - clipStartMs;
      const insights = {
        clipInfo: {
          duration: `${Math.round(clipDurationMs / 1000)}s`,
          words: transcript.words?.length || 0,
          speakers: transcript.utterances ? 
            [...new Set(transcript.utterances.map(u => u.speaker))].length : 0
        }
      };

      // Future Phase 2: Smart Clip Suggestions
      if (transcript.auto_highlights_result?.results?.length > 0) {
        const clipHighlights = transcript.auto_highlights_result.results.filter(h => 
          h.start >= clipStartMs && h.end <= clipEndMs
        );
        insights.highlights = {
          total: transcript.auto_highlights_result.results.length,
          inClip: clipHighlights.length,
          bestRank: clipHighlights.length > 0 ? Math.max(...clipHighlights.map(h => h.rank)) : 0
        };
      }

      // Future Phase 2: Mood-Based Captions  
      if (transcript.sentiment_analysis_results?.length > 0) {
        const clipSentiments = transcript.sentiment_analysis_results.filter(s =>
          s.start >= clipStartMs && s.end <= clipEndMs
        );
        const sentimentCounts = clipSentiments.reduce((acc, s) => {
          acc[s.sentiment] = (acc[s.sentiment] || 0) + 1;
          return acc;
        }, {});
        insights.sentiment = {
          dominant: Object.keys(sentimentCounts).sort((a,b) => sentimentCounts[b] - sentimentCounts[a])[0] || 'NEUTRAL',
          breakdown: sentimentCounts
        };
      }

      // Future Phase 2: Smart Tags
      if (transcript.entities?.length > 0) {
        const clipEntities = transcript.entities.filter(e =>
          e.start >= clipStartMs && e.end <= clipEndMs
        );
        insights.entities = clipEntities.reduce((acc, e) => {
          acc[e.entity_type] = acc[e.entity_type] || [];
          acc[e.entity_type].push(e.text);
          return acc;
        }, {});
      }

      // Future Phase 2: Auto-Themed Videos
      if (transcript.iab_categories_result?.summary) {
        const topicScores = Object.entries(transcript.iab_categories_result.summary)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3);
        insights.topics = {
          primary: topicScores[0]?.[0] || 'General',
          scores: Object.fromEntries(topicScores)
        };
      }

      console.log('🚀 Smart insights for clip:', insights);
      
      // Store insights for future features (Phase 2+)
      return insights;
      
    } catch (error) {
      console.warn('⚠️ Smart insights logging failed (non-critical):', error.message);
      return {};
    }
  }
}

module.exports = new AudioProcessor();
```

#### 3. Enhanced AssemblyAI Integration with Smart Features
```javascript
// Modify existing caption logic to use file upload + Phase 1 AI features
const { AssemblyAI } = require('assemblyai');
const assemblyai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

async function generateCaptions(audioBuffer, clipStartMs, clipEndMs, enableSmartFeatures = true) {
  try {
    // 1. Upload audio file (not URL)
    console.log('📤 Uploading audio file to AssemblyAI...');
    const uploadResponse = await assemblyai.files.upload(audioBuffer);
    
    // 2. Enhanced transcription request with Phase 1 AI features
    const transcriptRequest = {
      audio_url: uploadResponse.upload_url,  // Static file URL
      
      // Core caption features (existing)
      speaker_labels: true,
      speakers_expected: 2,
      format_text: true,
      punctuate: true,
      auto_chapters: false,
      
      // 🚀 NEW: Phase 1 Smart Features
      ...(enableSmartFeatures && {
        auto_highlights: true,        // Best moments for social sharing
        sentiment_analysis: true,     // Emotional tone analysis
        entity_detection: true,       // People, companies, topics mentioned
        iab_categories: true          // Topic classification
      })
    };
    
    console.log('🎬 Starting enhanced transcription with smart features...');
    const transcript = await assemblyai.transcripts.create(transcriptRequest);
    
    // 3. Wait for completion (existing polling logic)
    const completedTranscript = await assemblyai.transcripts.waitUntilReady(transcript.id);
    
    if (completedTranscript.status === 'completed') {
      console.log('✅ Enhanced transcription completed:', {
        utteranceCount: completedTranscript.utterances?.length || 0,
        wordCount: completedTranscript.words?.length || 0,
        highlightsFound: completedTranscript.auto_highlights_result?.results?.length || 0,
        entitiesFound: completedTranscript.entities?.length || 0,
        topicCategories: Object.keys(completedTranscript.iab_categories_result?.summary || {}).length
      });
      
      // 4. Process smart features for future use
      if (enableSmartFeatures) {
        await processSmartFeatures(completedTranscript);
      }
      
      return completedTranscript;
    } else {
      throw new Error(`Transcription failed: ${completedTranscript.error}`);
    }
    
  } catch (error) {
    console.error('❌ Caption generation failed:', error);
    return null; // Graceful fallback - continue video without captions
  }
}

// 🚀 NEW: Process Phase 1 smart features
async function processSmartFeatures(transcript) {
  try {
    // Extract highlights for future "Smart Clip Suggestions" feature
    if (transcript.auto_highlights_result?.results?.length > 0) {
      console.log('🎯 Found highlights:', transcript.auto_highlights_result.results.map(h => ({
        text: h.text.substring(0, 50) + '...',
        rank: h.rank,
        start: h.start,
        end: h.end
      })));
    }
    
    // Extract entities for future "Smart Tags" feature  
    if (transcript.entities?.length > 0) {
      const entitySummary = transcript.entities.reduce((acc, entity) => {
        acc[entity.entity_type] = (acc[entity.entity_type] || 0) + 1;
        return acc;
      }, {});
      console.log('🏷️  Found entities:', entitySummary);
    }
    
    // Extract sentiment for future "Mood Captions" feature
    if (transcript.sentiment_analysis_results?.length > 0) {
      const sentimentSummary = transcript.sentiment_analysis_results.reduce((acc, item) => {
        acc[item.sentiment] = (acc[item.sentiment] || 0) + 1;
        return acc;
      }, {});
      console.log('😊 Sentiment analysis:', sentimentSummary);
    }
    
    // Extract topics for future "Auto-Themed Videos" feature
    if (transcript.iab_categories_result?.summary) {
      const topTopics = Object.entries(transcript.iab_categories_result.summary)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);
      console.log('📂 Top topics:', topTopics);
    }
    
  } catch (error) {
    console.warn('⚠️ Smart features processing failed (non-critical):', error.message);
  }
}
```

#### 4. ⚠️ SAFE Caption Integration (NO Template Changes)
```javascript
// ADD caption data to existing Handlebars template data - DO NOT modify template
// The existing SVG template already has space reserved for captions

// Modify services/frame-generator.js - ONLY add caption data to templateData
async function generateSingleFrameSVG(jobId, framePath, frameNumber, podcast, progress, transcript, captionsEnabled) {
  
  // ... existing code for dimensions, scaling, etc. (don't change)
  
  // NEW: Get current caption text using production-tested logic
  const currentTimeMs = (progress * clipDurationMs); // Convert progress to time
  const currentCaption = captionsEnabled && transcript 
    ? getCurrentCaptionFromTranscript(transcript, currentTimeMs)
    : '';
  
  // Existing templateData object - just ADD caption field
  const templateData = {
    // All existing fields (don't change these)
    width: Math.floor(dimensions.width),
    height: Math.floor(dimensions.height),
    centerX: Math.floor(centerX),
    // ... all other existing fields ...
    
    // NEW: Add caption data to existing template
    captionText: currentCaption,          // Caption text for current time
    captionsEnabled: captionsEnabled,     // Show/hide captions
    captionLines: currentCaption ? splitCaptionIntoLines(currentCaption, 40) : []
  };

  // Existing template rendering (don't change)
  const svgContent = template(templateData);
  
  // Rest of existing frame generation (don't change)
  // ... Sharp conversion, artwork compositing, etc.
}

// NEW: Use production CaptionService patterns (don't reinvent)
function getCurrentCaptionFromTranscript(transcript, currentTimeMs) {
  if (!transcript.utterances?.length) return '';
  
  // Use same logic as CaptionService.getCurrentCaption()
  const currentUtterance = transcript.utterances.find(utterance => 
    currentTimeMs >= utterance.start && currentTimeMs <= utterance.end
  );
  
  return currentUtterance ? currentUtterance.text : '';
}

// Helper to split long captions (respects 3-line max rule)
function splitCaptionIntoLines(text, maxCharsPerLine) {
  if (text.length <= maxCharsPerLine) return [text];
  
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length >= 2) break; // Max 3 lines total
    }
  }
  
  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 3); // Enforce 3-line max
}
```

#### 5. Update SVG Template (ONE-TIME SAFE ADDITION)
```xml
<!-- Add to templates/audio2-frame.svg - ONLY in designated caption space -->
<!-- This goes in the space below episode title, above progress bar -->

{{#if captionsEnabled}}
{{#each captionLines}}
<text x="{{../centerX}}" y="{{../episodeTitleY}}" dy="{{add @index 2.5}}em" 
      text-anchor="middle" fill="#ffffff"
      font-size="32" font-weight="600"
      font-family="Roboto, 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
      filter="url(#textShadow)">{{this}}</text>
{{/each}}
{{/if}}
```

**KEY SAFETY MEASURES:**
- ✅ Uses existing Handlebars template system  
- ✅ NO string replacement or template modification
- ✅ Uses existing text positioning and styling patterns
- ✅ Respects existing spacing and layout
- ✅ Uses production-tested caption timing logic
- ✅ Only adds data to templateData object
```

### Phase 2B: Mobile App Connection (2-3 days)

#### 2. Add Caption Toggle + Smart Features to VideoCreationModal
```javascript
// Modify App.js VideoCreationModal section - ADD to existing modal
const [captionsEnabled, setCaptionsEnabled] = useState(false);
const [smartFeaturesEnabled, setSmartFeaturesEnabled] = useState(true); // 🚀 NEW

// Add to existing modal UI:
<View style={styles.captionSection}>
  <View style={styles.toggleRow}>
    <Text style={styles.toggleLabel}>Add Captions</Text>
    <Switch 
      value={captionsEnabled}
      onValueChange={setCaptionsEnabled}
      trackColor={{false: '#333', true: '#d97706'}}
      thumbColor={captionsEnabled ? '#d97706' : '#f4f4f4'}
    />
  </View>
  
  {/* 🚀 NEW: Smart Features Toggle */}
  {captionsEnabled && (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>Smart Analysis</Text>
      <Switch 
        value={smartFeaturesEnabled}
        onValueChange={setSmartFeaturesEnabled}
        trackColor={{false: '#333', true: '#d97706'}}
        thumbColor={smartFeaturesEnabled ? '#d97706' : '#f4f4f4'}
      />
    </View>
  )}
  
  <Text style={styles.helperText}>
    {captionsEnabled 
      ? (smartFeaturesEnabled 
          ? "AI captions with smart insights (highlights, sentiment, topics)"
          : "AI-generated captions synchronized with audio"
        )
      : "Add captions to your video for better engagement"
    }
  </Text>
</View>
```

#### 2. Connect to Test Server with Smart Features
```javascript
// Add enhanced server video generation option
const TEST_SERVER_URL = 'https://amusing-education-production.up.railway.app';

const handleCreateVideoServer = async () => {
  try {
    setVideoGenerationStatus('Submitting to server...');
    
    const response = await fetch(`${TEST_SERVER_URL}/api/create-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioUrl: selectedEpisode.audioUrl,
        clipStart: clipStartMs,
        clipEnd: clipEndMs,
        podcast: {
          title: selectedEpisode.title,
          artwork: selectedEpisode.artwork,
          podcastName: selectedEpisode.podcastName
        },
        captionsEnabled,
        enableSmartFeatures: smartFeaturesEnabled,  // 🚀 NEW: Smart features toggle
        template: 'professional'
      })
    });
    
    const { jobId } = await response.json();
    
    // Enhanced user feedback with smart features info
    Alert.alert(
      'Video Processing Started!',
      `Your video is being generated ${captionsEnabled ? 'with AI captions' : ''}` +
      `${captionsEnabled && smartFeaturesEnabled ? ' and smart analysis' : ''}. ` +
      `You'll be notified when ready. Job ID: ${jobId}`
    );
    
    setShowVideoModal(false);
    
  } catch (error) {
    console.error('Server generation failed:', error);
    // Fallback to iOS method
    Alert.alert(
      'Server Unavailable', 
      'Falling back to device recording.',
      [{ text: 'OK', onPress: handleCreateVideoLocal }]
    );
  }
};
```

---

## 🔍 MANDATORY TESTING CHECKLIST

### Pre-Implementation Questions:
- [ ] **Q**: Will this use utterance-based logic (✅ good) or word-based logic (❌ dangerous)?
- [ ] **Q**: Are we using existing `CaptionService.getCurrentCaption()` patterns?
- [ ] **Q**: Are all time values in milliseconds with no seconds conversion?
- [ ] **Q**: Does this respect speaker boundaries or could it mix speakers?

### Post-Implementation Testing:
- [ ] **TEST**: Do captions stay within 3 lines maximum?
- [ ] **TEST**: Are captions positioned at y=80 to not block episode title?
- [ ] **TEST**: When speakers change, do we get clean NEW captions (no mixing)?
- [ ] **TEST**: Is punctuation properly spaced? ("word." not "word .")
- [ ] **TEST**: Do captions show first words immediately when recording starts?
- [ ] **TEST**: No huge text chunks taking up whole screen?
- [ ] **TEST**: Proper capitalization (only when grammatically correct)?

### Required Test Scenarios:
```javascript
// Test with actual multi-speaker podcast clips that have:
- Multiple speakers (at least 2 speaker changes)
- Natural conversation flow (overlaps, interruptions) 
- Various punctuation (periods, commas, questions)
- Different speech patterns (fast/slow talkers, pauses)
- 60-90 second duration minimum
```

---

## 💰 COST ANALYSIS

### Updated Cost Breakdown (with file upload):
```javascript
const costTargets = {
  audioDownload: 0.002,     // Download full episode
  audioExtraction: 0.001,   // FFmpeg clip extraction  
  assemblyAI: 0.005,        // Transcription for 30-second clip
  videoGeneration: 0.002,   // Existing frame generation
  total: 0.010              // Target: $0.01 (maintained)
};
```

### File Upload Benefits:
- **Eliminates CDN sync issue**: Worth any small cost increase
- **Better accuracy**: Perfect audio/caption matching
- **User experience**: Instant feedback vs waiting for screen recording

---

## 🚨 PRODUCTION SAFETY

### Feature Flag Protection:
```javascript
// Environment variable control  
const CAPTIONS_ENABLED = process.env.ENABLE_SERVER_CAPTIONS === 'true';

// Route protection
app.post('/api/create-video', (req, res) => {
  if (req.body.captionsEnabled && !CAPTIONS_ENABLED) {
    console.log('⚠️  Captions requested but not enabled');
    // Continue without captions instead of failing
    req.body.captionsEnabled = false;
  }
  // ... rest of handler
});
```

### Error Handling:
```javascript
// Comprehensive error handling with graceful fallbacks
try {
  const audioBuffer = await audioProcessor.downloadAndExtractClip(audioUrl, clipStart, clipEnd);
  const transcript = await generateCaptions(audioBuffer, clipStart, clipEnd);
  console.log('✅ Caption generation successful');
  
} catch (error) {
  console.error('❌ Caption generation failed:', error.message);
  
  // Continue video generation without captions
  console.log('🎬 Continuing video generation without captions');
  const transcript = null;
}
```

### Rollback Strategy:
```bash
# Instant disable captions via Railway dashboard
railway env set ENABLE_SERVER_CAPTIONS=false

# Test rollback by disabling and verifying videos still generate
curl -X POST ${TEST_SERVER_URL}/api/create-video \
  -H "Content-Type: application/json" \
  -d '{"captionsEnabled":true,"audioUrl":"test-url"}'
```

---

## 📊 SUCCESS METRICS

### Technical Metrics:
- [ ] **CDN Sync Fix**: Audio content matches caption content 100%
- [ ] **Processing Time**: 45-90 seconds including captions and file processing
- [ ] **Cost Control**: < $0.01 per video including file download/processing
- [ ] **Success Rate**: > 99% video generation with captions

### User Experience Metrics:
- [ ] **Response Time**: Instant job submission feedback 
- [ ] **Error Recovery**: Graceful fallback to iOS method when server fails
- [ ] **Caption Quality**: Perfect audio/caption synchronization
- [ ] **Notification System**: Users notified when videos ready

---

## 🔄 DEVELOPMENT WORKFLOW

### Testing Process:
```bash
# 1. Test on amusing-education server
curl -X POST https://amusing-education-production.up.railway.app/api/create-video \
  -H "Content-Type: application/json" \
  -d '{
    "audioUrl": "https://dts.podtrac.com/redirect.mp3/chrt.fm/track/...",
    "clipStart": 30000,
    "clipEnd": 90000,
    "captionsEnabled": true,
    "podcast": {"title": "Test Episode", "artwork": "...", "podcastName": "Test Podcast"}
  }'

# 2. Monitor logs for file processing
railway logs --tail

# 3. Test mobile app connection
# Install EAS development build and test server integration
```

### Files to Modify/Create:
```
Railway Server (amusing-education):
├── services/audio-processor.js (NEW)      # Audio download & extraction
├── services/caption-processor.js (NEW)    # AssemblyAI file upload integration  
├── services/frame-generator.js (MODIFY)   # Add caption overlay support
├── api/create-video.js (MODIFY)          # Add caption parameters
└── package.json (MODIFY)                 # Add form-data, fs-extra deps

Mobile App:
└── App.js (MODIFY)                       # Add server integration & caption toggle
```

---

## 🎯 KEY INSIGHTS

### Technical Decisions:
1. **File Upload Method**: Definitively solves CDN sync issue
2. **Reuse Production Logic**: CaptionService patterns proven to work
3. **Graceful Fallbacks**: Caption failures never break video generation
4. **Feature Flag Control**: Safe rollout with instant disable capability

### Development Strategy:
1. **Test server first**: Prove file upload method works
2. **Maintain visual consistency**: Use existing SVG template and positioning
3. **Preserve production patterns**: Don't reinvent caption timing logic
4. **Mobile connection last**: Server must work before connecting app

### Risk Mitigation:
1. **Caption failures**: Continue video generation without captions
2. **Server downtime**: iOS fallback always available  
3. **Cost overruns**: File processing monitoring and limits
4. **Poor sync**: File upload guarantees single source of truth

---

This plan focuses on the actual problem: CDN timing mismatches. The file upload method provides a definitive solution while preserving all the caption logic that already works in production.