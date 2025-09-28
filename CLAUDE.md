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

## Common Commands
- Lint: `npm run lint` (if available)
- Typecheck: `npm run typecheck` (if available)