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

### CRITICAL: Verify All Changes Are Included Before Version Bump

**⚠️ LESSON LEARNED: Version 2.1.0 missed 4 critical bug fixes because they were committed AFTER the version was bumped! ⚠️**

Before bumping version numbers, **ALWAYS verify your working directory includes ALL changes you want in the release**:

```bash
# 1. Review what commits have been made since last release
git log --oneline v2.0.0..HEAD  # or use the last version tag/commit

# 2. Review uncommitted changes
git status
git diff

# 3. If there are uncommitted changes you want in the release, commit them FIRST
git add .
git commit -m "Your bug fix description"

# 4. ONLY THEN bump the version numbers
```

**What Happened with 2.1.0:**
- Version was bumped to 2.1.0 at 22:07:39 on Oct 12
- HTTP fix committed at 23:29:31 (1hr 22min AFTER version bump)
- Artwork fix committed at 23:40:55 (1hr 33min AFTER version bump)
- Build next day used old commit → fixes missing from App Store build
- Required emergency 2.1.1 release to include the fixes

**Prevention:** Always commit all changes BEFORE bumping version numbers!

### Submission Steps (DO IN THIS EXACT ORDER)

1. **FIRST: Update version in app.json, package.json, AND ios/Audio2/Info.plist:**
   ```json
   // app.json
   {
     "expo": {
       "version": "2.2.0"
     }
   }

   // package.json
   {
     "version": "2.2.0"
   }
   ```

   ```xml
   <!-- ios/Audio2/Info.plist -->
   <key>CFBundleShortVersionString</key>
   <string>2.2.0</string>
   ```

   **CRITICAL**: ALL THREE files must have the SAME version! EAS reads from ios/Audio2/Info.plist when building.

2. **SECOND: Commit and push to main BEFORE building:**
   ```bash
   git add app.json package.json ios/Audio2/Info.plist
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
- **Root Cause #1 (MOST COMMON)**: ios/Audio2/Info.plist has different version
  - **Solution**: ALWAYS update ALL THREE files: app.json, package.json, AND ios/Audio2/Info.plist
  - **Why**: EAS builds read the version from ios/Audio2/Info.plist (CFBundleShortVersionString)
  - **Fix Applied**: Update Info.plist to match (commit 72ac58a)

- **Root Cause #2**: package.json has different version than app.json
  - **Solution**: ALWAYS update BOTH app.json AND package.json to the same version
  - **Why**: `expo prebuild` reads version from package.json, not app.json
  - **Fix Applied**: Now keep both files in sync (commit 826256f)

- **Root Cause #2**: When `eas.json` has `"appVersionSource": "local"` AND production build uses `prebuildCommand`, EAS reads version from the GENERATED native iOS project, not from app.json
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

### Submitting Bug Fix Releases to Apple

When submitting a bug fix release (e.g., 2.1.1), Apple may ask what changed. Here's how to communicate it's a bug fix:

**Where to Indicate Bug Fix in App Store Connect:**

1. **Version Information Section** - "What's New in This Version":
   ```
   Bug Fixes:
   • Fixed podcast artwork not displaying on homepage
   • Fixed support for HTTP-only RSS feeds
   • Fixed caption text overflow issues
   • Improved caption display on small screens
   ```

2. **App Review Information** - "Notes" field:
   ```
   This is a bug fix release (version 2.1.1). The previous release 2.1.0
   inadvertently missed several bug fixes that were committed to our
   repository. This update includes those fixes with no new features.

   Changes:
   - Enable HTTP for podcast RSS feeds (required for older podcasts)
   - Fix artwork fetching to use RSS feeds directly
   - Fix caption text overflow and display issues

   This release requires App Store review because it includes a native
   iOS configuration change (NSAllowsArbitraryLoads) that was intended
   for 2.1.0 but was missed.
   ```

**Apple's Review Process for Bug Fixes:**
- Bug fix releases typically get **faster review** (24-48 hours vs 2-3 days)
- No need to select "Expedited Review" unless critical crash
- Clear "What's New" description helps reviewers understand scope
- Be honest about what changed - reviewers appreciate transparency

**Expedited Review (only if necessary):**
- Only request if the bug causes crashes or prevents core functionality
- Provide specific justification (e.g., "Users cannot load 40% of podcasts")
- Link to user reports or support tickets if available

## iOS App Transport Security (ATS) Configuration

### Why We Allow HTTP Connections

**File**: `ios/Audio2/Info.plist`
**Setting**: `NSAllowsArbitraryLoads: true`

**Why This is Necessary**:
Audio2 loads podcast RSS feeds from thousands of third-party domains that we don't control. Many older podcasts still use HTTP-only RSS feeds instead of HTTPS. Without allowing HTTP connections, users cannot access these podcasts.

**Apple App Review Justification**:
> "Audio2 is a podcast app that loads RSS feeds from third-party podcast hosting services. We do not control these domains, and many established podcasts still use HTTP-only feeds. We need to allow HTTP connections to provide users access to the full catalog of available podcasts. All user-generated content and app data is transmitted over HTTPS - only third-party podcast RSS feeds and audio files use HTTP when HTTPS is unavailable."

**Security Considerations**:
- RSS feeds are public data (no sensitive user information)
- Audio files are public media content
- User authentication and app data always use HTTPS
- This is standard practice for podcast apps (see: Overcast, Pocket Casts, Apple Podcasts)

**Alternative Approaches Considered**:
1. ❌ `NSAllowsArbitraryLoadsForMedia` - Only covers AVFoundation requests, not `fetch()` calls for RSS feeds
2. ❌ Individual domain exceptions - Impractical to maintain list of thousands of podcast domains
3. ❌ HTTPS upgrade with fallback - Adds complexity and latency, doesn't solve the problem

**When This Was Added**: Version 2.1.1 (commit: [TBD])
**Why It Was Added**: Users reported inability to load certain podcasts shared from Spotify (e.g., "The Memory Palace") due to HTTP-only RSS feeds being blocked by iOS

## Common Commands
- Lint: `npm run lint` (if available)
- Typecheck: `npm run typecheck` (if available)