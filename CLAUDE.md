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

## Common Commands
- Lint: `npm run lint` (if available)
- Typecheck: `npm run typecheck` (if available)