# Claude Code Configuration

## Important Rules
- Review CRITICAL_VIDEO_UI_RULES.md before any video-related changes
- Never modify visual elements in video generation
- Test on dedicated test branch before main deployment

## API Endpoints
- Video creation: /api/create-video
- Video status: /api/video-status/{jobId}

## Common Commands
- Lint: `npm run lint` (if available)
- Typecheck: `npm run typecheck` (if available)