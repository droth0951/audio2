# Claude Code Instructions - Audio2 Server-Side Video Generation

## 🎯 Project Context

You are working on **Audio2**, a React Native podcast clip creation app. The current approach uses iOS screen recording, but we're implementing **server-side video generation** on Railway to solve CDN synchronization issues and improve user experience.

## 📁 Project Structure

```
audio-trimmer-server/           # Railway server (existing)
├── api/
│   ├── transcribe.js          # Current AssemblyAI integration
│   └── trim-audio.js          # Current audio utilities
├── server.js                  # Main Express server
└── package.json

audio2-mobile-app/              # React Native app (existing) 
├── App.js                     # Main app component
├── package.json
└── app.json
```

## 🚀 Phase 1 Implementation Goal

**Build**: Server-side video generation MVP that creates MP4 files with synchronized audio and basic UI.

**Success Criteria**:
- ✅ Railway endpoint accepts clip requests
- ✅ Downloads exact audio segment (30-60 seconds)
- ✅ Generates basic video frames (podcast artwork + progress bar)
- ✅ Combines with FFmpeg into MP4
- ✅ Returns download link
- ✅ Cost tracking shows under $0.01 per video

## 🛠️ Technical Requirements

### Railway Server Extensions (audio-trimmer-server/)

#### New Endpoints Needed:
```javascript
POST /api/create-video           # Submit video generation job
GET  /api/video-status/:jobId    # Check processing status  
GET  /api/download-video/:id     # Download completed video
```

#### Request Format:
```javascript
POST /api/create-video
{
  "audioUrl": "https://podcast-feed.mp3",
  "clipStart": 120000,           // milliseconds
  "clipEnd": 150000,             // milliseconds (30-second clip)
  "podcast": {
    "title": "The Town",
    "artwork": "https://artwork.jpg",
    "episode": "Episode #123"
  },
  "userEmail": "user@example.com",
  "aspectRatio": "9:16",         // or "1:1", "16:9"
  "template": "professional"     // visual style
}
```

#### Response Format:
```javascript
// Immediate response
{
  "success": true,
  "jobId": "vid_abc123",
  "message": "Video processing started",
  "estimatedTime": 45
}

// Status check response
{
  "jobId": "vid_abc123",
  "status": "completed",         // or "processing", "failed"
  "videoUrl": "https://storage.com/video.mp4",
  "cost": 0.008,
  "processingTime": 42000
}
```

### Key Dependencies to Add:
```bash
npm install canvas              # For generating video frames
npm install fluent-ffmpeg       # Video composition
npm install ffmpeg-static       # FFmpeg binary
npm install uuid               # Job ID generation
npm install multer             # File handling
```

### Video Frame Generation Logic:

Create video frames that match Audio2's current design:
- **Background**: Claude gradient (#1c1c1c to #2d2d2d)
- **Podcast artwork**: 160x160px, centered, rounded corners
- **Progress bar**: Orange (#d97706), shows real-time progress
- **Episode info**: Clean typography, episode title + podcast name
- **Waveform**: 15 animated bars (optional for Phase 1)

### Audio Processing Pipeline:

```javascript
async function processVideoRequest(requestData) {
  const jobId = generateJobId();
  
  // Immediate response to client
  respondImmediately({ jobId, status: 'processing' });
  
  // Background processing
  processInBackground(async () => {
    try {
      // 1. Download exact audio segment
      const audioBuffer = await downloadAudioSegment(
        requestData.audioUrl,
        requestData.clipStart, 
        requestData.clipEnd
      );
      
      // 2. Generate video frames (30 frames for 30-second clip)
      const frames = await generateVideoFrames({
        duration: (requestData.clipEnd - requestData.clipStart) / 1000,
        podcast: requestData.podcast,
        template: requestData.template,
        aspectRatio: requestData.aspectRatio
      });
      
      // 3. Combine with FFmpeg
      const videoPath = await combineAudioVideo(audioBuffer, frames);
      
      // 4. Upload to storage and cleanup
      const videoUrl = await uploadVideo(videoPath);
      await cleanup(audioBuffer, frames, videoPath);
      
      // 5. Update job status
      updateJobStatus(jobId, {
        status: 'completed',
        videoUrl,
        cost: calculateCost(audioBuffer, frames)
      });
      
    } catch (error) {
      updateJobStatus(jobId, { status: 'failed', error: error.message });
    }
  });
}
```

## 🎨 Video Frame Generation Specs

### Canvas Dimensions by Aspect Ratio:
- **9:16 (Vertical)**: 1080x1920px (Instagram Stories, TikTok)
- **1:1 (Square)**: 1080x1080px (Instagram Posts)
- **16:9 (Horizontal)**: 1920x1080px (LinkedIn, YouTube)

### Visual Elements:
```javascript
const frameLayout = {
  background: 'linear-gradient(135deg, #1c1c1c 0%, #2d2d2d 100%)',
  podcastArt: {
    size: '160x160px',
    position: 'center-top',
    borderRadius: '12px'
  },
  progressBar: {
    color: '#d97706',
    width: '80%',
    height: '6px',
    position: 'center'
  },
  episodeTitle: {
    font: 'bold 24px Arial',
    color: '#f4f4f4',
    maxWidth: '90%',
    textAlign: 'center'
  },
  podcastName: {
    font: '18px Arial', 
    color: '#b4b4b4',
    textAlign: 'center'
  }
};
```

## 💰 Cost Tracking Implementation

Track costs for optimization:
```javascript
function calculateCost(audioBuffer, frames) {
  const audioDurationMinutes = audioBuffer.duration / 60;
  const assemblyAICost = audioDurationMinutes * (0.37 / 60); // $0.37/hour
  const processingCost = 0.001; // Railway compute estimate
  const storageCost = 0.0005;   // File storage estimate
  
  return assemblyAICost + processingCost + storageCost;
}
```

## 🚫 What NOT to Build Yet

**Defer to later phases**:
- Caption generation (Phase 2)
- Multiple templates (Phase 3)
- Push notifications (Phase 4)
- User authentication
- Advanced waveform animations

**Focus only on**: Basic video generation with synchronized audio.

## 🧪 Testing Requirements

### Create Test Endpoint:
```javascript
POST /api/test-video
{
  "testCase": "30-second-clip",
  "audioUrl": "https://sample-podcast.mp3",
  "clipStart": 30000,
  "clipEnd": 60000
}
```

### Success Validation:
- Video file plays correctly in browser/phone
- Audio and visual progress are synchronized
- File size reasonable (2-8MB for 30-60 second clips)
- Processing completes in under 60 seconds
- Cost tracking shows realistic numbers

## 🔧 Development Approach

### Recommended Git Strategy:
**Use feature branch**: `git checkout -b server-side-video-generation`

Reasons:
- Large architectural change
- Easy to revert if needed
- Allows parallel development
- Clean PR review process

### Development Steps:
1. **Set up basic endpoints** with dummy responses
2. **Implement audio download** and validation
3. **Add canvas-based frame generation** 
4. **Integrate FFmpeg** for video composition
5. **Add job queue** and status tracking
6. **Test with real podcast URLs**
7. **Optimize and measure costs**

### Error Handling Priorities:
- Network timeouts during audio download
- FFmpeg processing failures  
- Disk space management
- Invalid audio URLs
- Job queue overflow

## 📋 Mobile App Integration (Later)

For now, test server endpoints directly. Mobile app integration comes after server MVP is proven.

## 🎯 Definition of Done

**Phase 1 Complete When**:
- ✅ POST /api/create-video accepts requests and returns jobId
- ✅ Background processing downloads audio and generates video
- ✅ GET /api/video-status/:jobId returns accurate status
- ✅ Generated MP4 files play with synchronized audio
- ✅ Cost tracking shows under $0.01 for 30-second clips
- ✅ Processing time averages under 60 seconds
- ✅ Error handling covers common failure modes

**Ready for Phase 2**: Caption integration and CDN sync testing

---

## 💡 Key Success Factors

1. **Single audio source**: Download once, use for both video and future captions
2. **Efficient processing**: Optimize for speed and cost
3. **Robust error handling**: Graceful failures and recovery
4. **Cost consciousness**: Track every API call and compute usage
5. **Quality output**: Professional-looking videos ready for social media

Start with the simplest possible implementation that proves the concept, then iterate based on results.