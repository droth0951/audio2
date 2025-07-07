# AI Agent Instructions

Welcome, AI collaborator!

## Project Goal
Audio2 is a React Native app for creating social-ready podcast video clips. The main challenge is generating videos with in-app audio (especially on iOS).

## What We've Tried
- expo-av for audio playback
- react-native-view-shot for frame capture
- expo-screen-recorder for screen/audio recording (see experiments)
- ffmpeg-kit-react-native (planned for full video generation)

## How to Help
- Please read `docs/project-progress-log.md` and `docs/experiments/` before suggesting new features or fixes.
- Prefer Expo-compatible, cross-platform solutions.
- If you try a new approach, add a summary to `docs/experiments/`.
- Keep commit messages clear and update the progress log.

## Open Questions
- Can we reliably record in-app audio on iOS?
- Should we move video generation server-side if local solutions fail? 