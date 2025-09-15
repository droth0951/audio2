# Audio2 Phase 2 - Claude Code Implementation Plan
## Caption Integration & Mobile App Connection

---

## 🎯 PROJECT OVERVIEW

**PHASE**: Phase 2 - Caption Integration with Server-Side Video Generation
**CONTEXT**: Phase 1 Complete - Server-side video generation working perfectly
**GOAL**: Integrate caption generation with mobile app and perfect caption sync
**TIMELINE**: 1-2 weeks (caption integration focus)

---

## 📋 WHAT PHASE 1 ACHIEVED

### ✅ **Complete Server-Side Video Generation**
- **✅ SVG + Sharp Pipeline**: Template-based frame generation 
- **✅ Advanced Animation System**: Breathing gradient progress bar, dancing bars watermark
- **✅ Production-Ready Deployment**: Railway deployment with feature flags
- **✅ Perfect Visual Matching**: Exact Audio2 app layout scaling to 1080px
- **✅ Performance**: 8-second videos in ~45 seconds, under $0.01 cost

### 🎬 **Files Already Created (Phase 1)**
- `services/frame-generator.js` - Core video generation engine
- `templates/audio2-frame.svg` - SVG template with breathing gradients  
- `api/create-video.js` - Video creation endpoint
- `api/video-status.js` - Status tracking endpoint
- `services/video-processor.js` - Background job processing
- `config/settings.js` - Feature flags and limits

---

## 🎯 PHASE 2 OBJECTIVES

### **Primary Goals:**
1. **Caption Generation**: Integrate AssemblyAI with file upload method
2. **Mobile App Connection**: Connect Audio2 app to Railway server
3. **Perfect Caption Sync**: Solve CDN timing issues with single audio source
4. **User Experience**: Instant response, background processing, notifications

### **Success Criteria:**
- ✅ **Caption Accuracy**: 99%+ (vs current iOS Speech ~70%)
- ✅ **Perfect Audio Sync**: Single source of truth eliminates timing issues
- ✅ **Instant Response**: User gets immediate feedback, continues using app
- ✅ **Cost Control**: Stay under $0.01 per video including captions

---

## 🏗️ PHASE 2 IMPLEMENTATION PLAN

### Phase 2A: Caption Backend Integration (Week 1)
**GOAL**: Add caption generation to existing server pipeline

#### Primary Tasks:

1. **Enhance Video Creation Endpoint**
   ```javascript
   // Modify existing api/create-video.js
   POST /api/create-video
   {
     audioUrl, clipStart, clipEnd, podcast,
     captionsEnabled: true,      // NEW: Caption toggle
     captionStyle: 'classic',    // NEW: Style selection
     template: 'professional'    // EXISTING: Video template
   }
   ```

2. **AssemblyAI File Upload Integration**
   ```javascript
   // Add to services/caption-processor.js (NEW FILE)
   async function generateCaptions(audioBuffer, clipStart, clipEnd) {
     // 1. Upload exact audio segment to AssemblyAI
     const uploadResponse = await assemblyAI.files.upload(audioBuffer);
     
     // 2. Request transcription with speaker labels
     const transcriptRequest = {
       audio_url: uploadResponse.upload_url,  // Static file URL
       speaker_labels: true,
       speakers_expected: 2,
       format_text: true
     };
     
     // 3. Process utterances for clean speaker boundaries
     return processUtterances(transcript.utterances);
   }
   ```

3. **Caption Style Processing**
   ```javascript
   // Add to services/frame-generator.js
   const captionStyles = {
     classic: {
       backgroundColor: 'rgba(0,0,0,0.8)',
       color: '#ffffff',
       fontSize: '32px',
       position: 'bottom'
     },
     audio2: {
       backgroundColor: 'rgba(217, 119, 6, 0.9)',
       color: '#ffffff', 
       fontSize: '32px',
       position: 'bottom'
     },
     clean: {
       backgroundColor: 'rgba(255,255,255,0.9)',
       color: '#000000',
       fontSize: '32px',
       position: 'bottom'
     },
     outline: {
       backgroundColor: 'transparent',
       color: '#ffffff',
       fontSize: '32px',
       textShadow: '2px 2px 0 #000000',
       position: 'bottom'
     }
   };
   ```

4. **Enhanced Video Generation with Captions**
   ```javascript
   // Modify services/frame-generator.js
   async function generateFramesWithCaptions(options) {
     const { 
       podcast, audioBuffer, transcript, 
       captionsEnabled, captionStyle, duration 
     } = options;
     
     const frames = [];
     const totalFrames = Math.ceil(duration * 12); // 12 FPS
     
     for (let frame = 0; frame < totalFrames; frame++) {
       const timeMs = (frame / 12) * 1000;
       
       // Get current caption for this timestamp
       const currentCaption = captionsEnabled 
         ? getCurrentCaption(transcript, timeMs)
         : null;
       
       // Generate frame with optional caption overlay
       const frameBuffer = await generateFrame({
         ...baseFrameData,
         caption: currentCaption,
         captionStyle: captionStyles[captionStyle]
       });
       
       frames.push(frameBuffer);
     }
     
     return frames;
   }
   ```

### **🔍 MANDATORY TESTING (Based on Your QA Checklist):**

#### **Pre-Implementation Questions:**
- [ ] **Q**: Will this use utterance-based logic (good) or word-based logic (dangerous)?
- [ ] **Q**: Are we using existing `captionService.getCurrentCaption()` patterns?
- [ ] **Q**: Are all time values in milliseconds with no seconds conversion?
- [ ] **Q**: Does this respect speaker boundaries or could it mix speakers?

#### **Post-Implementation Testing:**
- [ ] **TEST**: Do captions stay within 2 lines maximum? 
- [ ] **TEST**: Are captions positioned at y=80 to not block episode title?
- [ ] **TEST**: When speakers change, do we get clean NEW captions (no mixing)?
- [ ] **TEST**: Is punctuation properly spaced? ("word." not "word .")
- [ ] **TEST**: Do captions show first words immediately when recording starts?
- [ ] **TEST**: No huge text chunks taking up whole screen?
- [ ] **TEST**: Proper capitalization (only when grammatically correct)?

#### **Required Test Scenarios:**
```javascript
// Test with actual multi-speaker podcast clips that have:
- Multiple speakers (at least 2 speaker changes)
- Natural conversation flow (overlaps, interruptions) 
- Various punctuation (periods, commas, questions)
- Different speech patterns (fast/slow talkers, pauses)
- 60-90 second duration minimum
```

#### **Success Metrics (Updated with Reality Check):**
- [ ] AssemblyAI file upload working (solves CDN sync issue)
- [ ] Caption text chunks limited to 2 lines maximum
- [ ] No speaker mixing in single captions
- [ ] Proper capitalization (not every chunk)
- [ ] Captions positioned safely (y=80, not blocking content)
- [ ] Perfect audio/caption timing with uploaded files
- [ ] Cost tracking under target ($0.01 including captions)

### Phase 2B: Mobile App Integration (Week 2) 
**GOAL**: Connect Audio2 app to server-side video generation

#### Primary Tasks:

1. **Add Server Option to VideoCreationModal**
   ```javascript
   // Modify App.js VideoCreationModal section
   const VideoCreationModal = () => {
     const [useServerGeneration, setUseServerGeneration] = useState(false);
     const [captionsEnabled, setCaptionsEnabled] = useState(false);
     const [captionStyle, setCaptionStyle] = useState('classic');
     
     return (
       <Modal visible={showVideoModal}>
         {/* Existing aspect ratio selection */}
         
         {/* NEW: Generation method selection */}
         <View style={styles.methodSelection}>
           <TouchableOpacity 
             onPress={() => setUseServerGeneration(false)}
             style={[styles.methodOption, !useServerGeneration && styles.selected]}
           >
             <Text>iOS Recording (Current)</Text>
           </TouchableOpacity>
           
           <TouchableOpacity 
             onPress={() => setUseServerGeneration(true)}
             style={[styles.methodOption, useServerGeneration && styles.selected]}
           >
             <Text>Server Generation (Beta)</Text>
           </TouchableOpacity>
         </View>
         
         {/* NEW: Caption options (only for server generation) */}
         {useServerGeneration && (
           <View style={styles.captionOptions}>
             <View style={styles.toggleRow}>
               <Text style={styles.toggleLabel}>Add Captions</Text>
               <Switch 
                 value={captionsEnabled}
                 onValueChange={setCaptionsEnabled}
                 trackColor={{false: '#333', true: '#d97706'}}
               />
             </View>
             
             {captionsEnabled && (
               <View style={styles.styleSelection}>
                 {['classic', 'audio2', 'clean', 'outline'].map(style => (
                   <TouchableOpacity 
                     key={style}
                     onPress={() => setCaptionStyle(style)}
                     style={[styles.styleOption, captionStyle === style && styles.selectedStyle]}
                   >
                     <Text style={styles.styleName}>{style}</Text>
                   </TouchableOpacity>
                 ))}
               </View>
             )}
           </View>
         )}
       </Modal>
     );
   };
   ```

2. **Server Video Generation Function**
   ```javascript
   // Add to App.js
   const handleCreateVideoServer = async () => {
     try {
       setVideoGenerationStatus('Submitting to server...');
       
       const response = await fetch(`${RAILWAY_SERVER_URL}/api/create-video`, {
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
           captionStyle,
           template: 'professional',
           aspectRatio: selectedAspectRatio
         })
       });
       
       const { jobId } = await response.json();
       
       // Instant feedback - user can continue using app
       Alert.alert(
         'Video Processing Started!',
         `Your video is being generated with ${captionsEnabled ? 'captions' : 'no captions'}. ` +
         `You'll be notified when it's ready (usually 45-90 seconds). Job ID: ${jobId}`
       );
       
       setShowVideoModal(false);
       
       // Optional: Poll for completion and notify user
       pollVideoStatus(jobId);
       
     } catch (error) {
       console.error('Server generation failed:', error);
       
       // Fallback to iOS method
       Alert.alert(
         'Server Unavailable',
         'Falling back to iOS recording method.',
         [{ text: 'OK', onPress: handleCreateVideoLocal }]
       );
     }
   };
   ```

3. **Video Status Polling (Optional)**
   ```javascript
   // Add to App.js
   const pollVideoStatus = async (jobId) => {
     const pollInterval = setInterval(async () => {
       try {
         const response = await fetch(`${RAILWAY_SERVER_URL}/api/video-status/${jobId}`);
         const { status, downloadUrl, error } = await response.json();
         
         if (status === 'completed') {
           clearInterval(pollInterval);
           
           Alert.alert(
             'Video Ready!',
             'Your video has been generated successfully.',
             [
               { text: 'Open Link', onPress: () => Linking.openURL(downloadUrl) },
               { text: 'OK' }
             ]
           );
         } else if (status === 'failed') {
           clearInterval(pollInterval);
           Alert.alert('Video Generation Failed', error || 'Please try again.');
         }
         
       } catch (error) {
         console.error('Polling error:', error);
         clearInterval(pollInterval);
       }
     }, 10000); // Poll every 10 seconds
     
     // Stop polling after 5 minutes
     setTimeout(() => clearInterval(pollInterval), 300000);
   };
   ```

4. **Environment Configuration**
   ```javascript
   // Add to App.js constants
   const RAILWAY_SERVER_URL = __DEV__ 
     ? 'http://localhost:3000'  // Local development
     : 'https://audio2-server-production.railway.app';  // Production
   
   const SERVER_GENERATION_ENABLED = true; // Feature flag
   ```

#### Success Metrics:
- [ ] Mobile app successfully submits jobs to server
- [ ] User gets instant feedback and can continue using app
- [ ] Fallback to iOS method works when server unavailable
- [ ] Caption options properly integrated in UI

---

## 🔍 TESTING STRATEGY

### Development Testing:
1. **Server Integration Testing**
   ```bash
   # Test server endpoints
   curl -X POST ${RAILWAY_URL}/api/create-video \
     -H "Content-Type: application/json" \
     -d '{"audioUrl":"test-url", "captionsEnabled":true}'
   ```

2. **Mobile App Testing** 
   ```bash
   # Test with EAS development build
   eas build --profile development --platform ios
   # Install on device and test server integration
   ```

3. **Caption Quality Testing**
   ```javascript
   // Test with known podcast clips
   const testClips = [
     { url: 'the-town-episode-url', expectedAccuracy: 0.95 },
     { description: 'Multi-speaker conversation' },
     { description: 'Technical podcast content' }
   ];
   ```

### Production Testing:
1. **Cost Monitoring**: Track AssemblyAI costs per video
2. **Performance Testing**: Verify 45-90 second generation times
3. **Error Handling**: Test network failures, invalid audio URLs
4. **User Experience**: Confirm instant response and notifications work

---

## 💰 COST ANALYSIS & CONTROL

### Updated Cost Breakdown (with captions):
```javascript
const costTargets = {
  audioDownload: 0.001,     # Network transfer
  videoGeneration: 0.003,   # Sharp + FFmpeg processing
  assemblyAI: 0.005,        # Transcription for 30-second clip
  storage: 0.001,           # Cloud upload
  total: 0.010              # Target: $0.01 (maintained)
};
```

### Caption Cost Calculation:
```javascript
// AssemblyAI pricing: $0.37/hour
const calculateCaptionCost = (durationMs) => {
  const durationHours = durationMs / (1000 * 60 * 60);
  return durationHours * 0.37;
};

// Examples:
// 30 seconds: $0.003
// 60 seconds: $0.006  
// 4 minutes: $0.025 (still reasonable)
```

---

## 🚨 PRODUCTION SAFETY

### Feature Flag Integration:
```javascript
// Environment variable control
const SERVER_GENERATION_ENABLED = process.env.ENABLE_SERVER_VIDEO === 'true';
const CAPTIONS_ENABLED = process.env.ENABLE_CAPTIONS === 'true';

// Route protection
app.post('/api/create-video', (req, res) => {
  if (!SERVER_GENERATION_ENABLED) {
    return res.status(404).json({ error: 'Server generation not enabled' });
  }
  
  if (req.body.captionsEnabled && !CAPTIONS_ENABLED) {
    return res.status(400).json({ error: 'Captions not enabled' });
  }
  
  // ... rest of handler
});
```

### Error Handling:
```javascript
// Comprehensive error handling
try {
  // Caption generation
  const captions = await generateCaptions(audioBuffer, clipStart, clipEnd);
  console.log(`✅ Generated ${captions.length} caption segments`);
  
} catch (error) {
  console.error(`❌ Caption generation failed: ${error.message}`);
  
  // Continue without captions instead of failing completely
  console.log('🎬 Continuing video generation without captions');
  const captions = null;
}
```

### Rollback Strategy:
```bash
# Instant disable captions via Railway dashboard
railway env set ENABLE_CAPTIONS=false

# Or disable entire server generation
railway env set ENABLE_SERVER_VIDEO=false
```

---

## 📊 SUCCESS METRICS

### Technical Metrics:
- [ ] **Caption Accuracy**: > 95% for typical podcast content
- [ ] **Processing Time**: 45-90 seconds including captions
- [ ] **Cost Control**: < $0.01 per video including captions
- [ ] **Success Rate**: > 99% video generation with captions

### User Experience Metrics:
- [ ] **Response Time**: Instant job submission feedback
- [ ] **Error Recovery**: Graceful fallback to iOS method
- [ ] **Caption Quality**: Clean speaker boundaries, proper timing
- [ ] **Notification System**: Users know when videos are ready

---

## 📝 DEVELOPMENT NOTES

### Key Technical Decisions:
1. **File Upload Method**: Solves CDN sync issue definitively
2. **Optional Caption Integration**: Users can choose captions or not
3. **Fallback Strategy**: iOS method always available
4. **Progressive Enhancement**: Server generation is additive, not replacement

### Files to Modify/Create:
```
Railway Server:
├── services/caption-processor.js (NEW)    # AssemblyAI integration
├── services/frame-generator.js (MODIFY)   # Add caption overlay support  
└── api/create-video.js (MODIFY)          # Add caption parameters

Mobile App:
└── App.js (MODIFY)                       # Add server integration UI
```

### Risk Mitigation:
1. **Caption Failures**: Continue video generation without captions
2. **Server Downtime**: iOS fallback always works
3. **Cost Runaway**: Caption cost limits and monitoring
4. **Poor Quality**: A/B testing between iOS speech and AssemblyAI

---

## 🎯 CLAUDE CODE USAGE GUIDELINES

### For Each Development Session:

1. **Start with Context**
   ```
   "Working on Audio2 Phase 2: Caption integration with server-side video generation.
   Phase 1 complete: Server-side video generation working.
   Current task: [specific caption or mobile integration task]
   Goal: Perfect caption sync with file upload method."
   ```

2. **Reference Existing Architecture**
   - Mention that video generation is already working
   - Reference existing files from Phase 1
   - Focus on caption additions, not rebuilding video system

3. **Code Quality Focus**
   - Feature flag integration for safe rollout
   - Comprehensive error handling for caption failures
   - Cost tracking for AssemblyAI usage
   - Fallback to iOS method when server fails

### Expected Outcomes by Task:
- **Phase 2A**: Server generating videos with captions
- **Phase 2B**: Mobile app connected to server with caption options
- **Testing**: Perfect caption sync verified, costs under control

---

This plan focuses on the actual Phase 2 work: integrating caption generation with the already-working server-side video generation system and connecting the mobile app to use the server instead of iOS recording.
