# Claude Code Configuration

## Important Rules
- Review CRITICAL_VIDEO_UI_RULES.md before any video-related changes
- Never modify visual elements in video generation
- Test on dedicated test branch before main deployment

## API Endpoints
- Video creation: /api/create-video
- Video status: /api/video-status/{jobId}

## Caption Styling Feature
The `/api/create-video` endpoint supports optional caption text styling:

### Parameter
- `captionStyle` (optional, string, default: "normal")

### Available Styles
- `"normal"` - Default sentence case (e.g., "Today we're hearing from Dan Porter")
- `"uppercase"` - ALL CAPS (e.g., "TODAY WE'RE HEARING FROM DAN PORTER")
- `"lowercase"` - all lowercase (e.g., "today we're hearing from dan porter")
- `"title"` - Title Case (e.g., "Today We're Hearing From Dan Porter")

### Example Usage
```json
{
  "audioUrl": "https://example.com/audio.mp3",
  "clipStart": 593000,
  "clipEnd": 677000,
  "captionsEnabled": true,
  "captionStyle": "uppercase"
}
```

### Backward Compatibility
- Parameter is completely optional
- Existing API calls without `captionStyle` continue working with normal sentence case
- Feature only applies when `captionsEnabled: true`

## EAS Build & Update Workflow

### Important: TestFlight Channel Configuration
**TestFlight builds use the `production` channel**, not `staging` as might be expected. When pushing OTA updates for TestFlight users:
```bash
eas update --platform ios --branch production --message "Your update message"
```

### Ensuring New Builds Include All OTA Updates
**Problem**: EAS builds and OTA updates can get out of sync, causing new development builds to miss recent updates.

**Solution**: Always ensure both are built from the same git commit:

1. **Before creating a new build**, check what commit your latest OTA update used:
   ```bash
   eas update:list --platform=ios --limit=1
   ```

2. **Make sure your local git includes all OTA changes**:
   ```bash
   git log --oneline -5  # Check recent commits
   git status           # Ensure clean working directory
   ```

3. **If needed, commit any missing changes** that were in the OTA update:
   ```bash
   git add .
   git commit -m "Include OTA update changes in build"
   ```

4. **Build from current git state**:
   ```bash
   eas build --platform ios --profile development
   ```

5. **Verify the build uses the correct commit** in build logs or:
   ```bash
   eas build:view [BUILD_ID]
   ```

### Key Point
- **OTA updates** are published from your local git state when you run `eas update`
- **EAS builds** are built from your local git state when you run `eas build`
- Both must use the same git commit to stay in sync

## Debugging Caption Issues

### DEBUG_CAPTIONS Environment Variable
For targeted caption debugging without hitting Railway's 500 logs/sec rate limit:

**When to Use**: Caption generation, chunking, or timing issues in production

**How to Enable**:
1. Go to Railway dashboard → audio-trimmer-service
2. Add environment variable: `DEBUG_CAPTIONS=true`
3. Restart the service
4. Debug caption issues with detailed logs
5. Remove the variable when done

**What it Shows**:
- Caption chunk creation details
- Text length and line break decisions
- AssemblyAI transcription progress
- Smart features processing (highlights, entities, sentiment)

**What it Hides** (avoids rate limit):
- General AssemblyAI upload responses
- Verbose transcription request details
- Non-caption debug output

**Alternative**: Temporarily set `NODE_ENV=development` but this enables ALL debug logs (not recommended in production)

### Caption Timing Issues: Lessons Learned

**Problem**: Captions racing ahead of slow speakers by 2-3 seconds, appearing/disappearing before words were actually spoken.

#### The Smoking Gun Discovery 🎯

When debugging a user's video, we observed the caption "STARTED WITH AN OBSESSION WITH THE CUSTOMER AROUND" highlighted "THE CUSTOMER" from the **FIRST** time the phrase was said, not the **SECOND** time (the actual caption text). This revealed the core issue: **sequential word extraction was matching duplicate phrases from previous captions**.

#### Root Cause Chain

1. **Progressive Text Chunking** (commit 6dcf05b):
   - Split long utterances into display-sized chunks
   - Calculated timing by evenly dividing utterance duration (`avgMsPerChar`)
   - ❌ This proportional timing was **wrong for slow speakers**

2. **Word Extraction Filtering**:
   - `extractWordTimingsForCaption()` filtered words by estimated timing ranges
   - For slow speakers, estimated ranges were wrong → returned 0 words
   - ❌ Timing validation never ran because `wordTimings.length === 0`

3. **Duplicate Word Matching**:
   - When words were found, sequential search through transcript matched text
   - Without position tracking, matched **FIRST occurrence** of duplicate phrases
   - ❌ Caused wrong word highlighting and incorrect timing adjustments

#### The Solution (Commits 9cb48b3, 742c39c)

**Key Insight**: Don't trust estimated timing for word extraction. Match by **text content first**, then use actual word timestamps.

**Implementation**:
1. **Text-First Matching**: Match words by content within wide time window (±5s), not narrow estimated ranges
2. **Position Tracking**: Track `lastWordIndexUsed` across all captions to maintain position in transcript
3. **Sequential Search Prevention**: Start each search AFTER previous caption's last word to avoid duplicates
4. **Adjusted Thresholds**: Lower to 300ms gap threshold (from 500ms), increase lookback to 300ms

**Code Location**: `audio-trimmer-server/services/caption-processor.js`
- Line 334: `lastWordIndexUsed` tracking in `createCaptionsFromUtterances()`
- Line 359-367: Pass position to `extractWordTimingsForCaption()` and update after each caption
- Line 650-694: Rewritten word extraction with text-first matching

#### Key Lessons for Future Debugging

1. **Look for duplicate content**: When captions contain repeated phrases (names, common words), check if word matching is finding the correct occurrence
2. **Don't trust proportional timing**: Audio has natural pauses and slow/fast sections - proportional division will be wrong
3. **Use actual word timestamps**: AssemblyAI provides word-level timing - always prefer actual over estimated
4. **Track position in transcript**: For sequential processing, maintain position to avoid re-matching earlier content
5. **Wide search windows**: When dealing with unreliable timing estimates, use generous search windows (±5s)

#### Testing Caption Timing

To verify caption timing is working correctly:
1. Set `DEBUG_CAPTIONS=true` in Railway
2. Generate video with slow speaker (look for ⏱️ timing adjustment logs)
3. Check for duplicate phrases and verify correct word highlighting
4. Verify captions stay visible until speaker finishes the sentence

**Test Clip Used**: LI5985002440.mp3, 232000-269000ms (slow female speaker)

## App Store Submission Process

### Critical Order of Operations

**⚠️ ALWAYS DO THIS IN EXACT ORDER OR YOU WASTE EAS BUILDS ⚠️**

EAS builds from your **git commit**, not your local files. If you build before committing version changes, the build will have the OLD version and submission will fail.

### Submission Steps (DO IN THIS EXACT ORDER)

1. **FIRST: Update version in app.json:**
   ```json
   {
     "expo": {
       "version": "2.2.0"
     }
   }
   ```

2. **SECOND: Commit and push to main BEFORE building:**
   ```bash
   git add app.json
   git commit -m "Bump version to 2.2.0 for App Store submission"
   git push origin main
   ```

3. **THIRD: Verify you're on main with latest commit:**
   ```bash
   git status  # Should say "Your branch is up to date with 'origin/main'"
   git log --oneline -1  # Should show your version bump commit
   ```

4. **FOURTH: Now build for production:**
   ```bash
   eas build --platform ios --profile production --non-interactive
   ```
   - Wait for build to complete (~15-20 minutes)
   - EAS will auto-increment the build number

5. **FIFTH: Submit to App Store:**
   ```bash
   eas submit --platform ios --latest
   ```

### Why This Order Matters

- **EAS builds from git commits**, not local files
- If version is 2.1.0 locally but git has 2.0.0, the build will be 2.0.0
- You can't submit the same build twice to Apple
- Each failed submission wastes an EAS build

### Common Errors and Fixes

**Error**: "You've already submitted this build of the app"
- **Cause**: Built before committing version change, so build has old version
- **Prevention**: ALWAYS commit version changes BEFORE building
- **Fix**: Update version again (e.g., 2.1.0 → 2.1.1), commit, push, then build

**Error**: Build shows old version number even after updating app.json
- **Root Cause**: When `eas.json` has `"appVersionSource": "local"` AND production build uses `prebuildCommand`, EAS reads version from the GENERATED native iOS project, not from app.json
- **The Problem**: `expo prebuild` regenerates the ios/ directory during build, but may use cached or incorrect version
- **Solution**: Use `"appVersionSource": "remote"` in eas.json to force EAS to use app.json as source of truth
- **Why This Happens**:
  1. app.json has correct version (e.g., 2.1.0)
  2. `prebuildCommand` runs `expo prebuild` which regenerates ios/
  3. Generated ios/Audio2.xcodeproj/project.pbxproj gets old version (e.g., 2.0.0)
  4. With `"appVersionSource": "local"`, EAS reads from native project → wrong version
- **Fix Applied**: Changed eas.json to `"appVersionSource": "remote"` (commit 3009349)

**Error**: Build shows old version number (other cases)
- **Cause**: Built before committing changes
- **Fix**: Check `git log` to confirm version commit is pushed, then build again

### After App Store Approval

For JavaScript-only updates between App Store releases:
```bash
eas update --platform ios --branch production --message "Bug fix description"
```

Remember: Keep `runtimeVersion` at "1.5.0" until native changes are needed.

## Common Commands
- Lint: `npm run lint` (if available)
- Typecheck: `npm run typecheck` (if available)