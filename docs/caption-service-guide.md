# CaptionService Integration Guide

## Overview

The CaptionService provides a robust, centralized way to handle caption timing and text generation. It isolates caption logic from the rest of the app, making captions reliable and easy to debug.

## Key Benefits

- **Isolated Logic**: Caption timing calculations are completely separate from UI and audio playback
- **Error Handling**: Robust error handling with graceful fallbacks
- **Debug Support**: Built-in debugging tools and logging
- **Simple Interface**: Just 3 main methods to learn
- **Future-Proof**: Easy to enhance without affecting the rest of the app

## API Reference

### `captionService.setTranscript(transcript, clipStartMs, clipEndMs)`

Sets up the caption service with transcript data and clip timing.

**Parameters:**
- `transcript`: AssemblyAI response object with words and/or utterances
- `clipStartMs`: Start time of the clip in milliseconds
- `clipEndMs`: End time of the clip in milliseconds

**Example:**
```javascript
captionService.setTranscript(assemblyAIResult, 30000, 90000);
```

### `captionService.getCurrentCaption(currentTimeMs)`

Gets the current caption text for the given time.

**Parameters:**
- `currentTimeMs`: Current audio position in milliseconds

**Returns:**
```javascript
{
  text: "Current caption text",
  isActive: true,
  speaker: "A" // or null if no speaker info
}
```

**Example:**
```javascript
const { text, isActive, speaker } = captionService.getCurrentCaption(position);
```

### `captionService.reset()`

Clears all caption data and resets the service.

**Example:**
```javascript
captionService.reset();
```

### `captionService.getDebugInfo()`

Returns debug information about the current state.

**Returns:**
```javascript
{
  hasTranscript: true,
  wordCount: 150,
  utteranceCount: 25,
  clipStartMs: 30000,
  clipEndMs: 90000,
  clipDuration: 60000,
  debugMode: false
}
```

### `captionService.setDebugMode(enabled)`

Enables or disables debug logging.

**Example:**
```javascript
captionService.setDebugMode(true); // Enable debug logging
```

## Integration Pattern

### 1. Setup Captions (after AssemblyAI completes)

```javascript
if (result.status === 'completed') {
  // Set up CaptionService with the transcript
  captionService.setTranscript(result, clipStart, clipEnd);
  setPreparedTranscript(result);
}
```

### 2. Display Captions (in render/component)

```javascript
const getCurrentCaption = () => {
  if (!captionsEnabled) return '';
  const { text } = captionService.getCurrentCaption(currentTimeMs);
  return text;
};
```

### 3. Reset When Starting New Clip

```javascript
const startNewClip = () => {
  captionService.reset();  // Clear old caption data
  // ... rest of clip setup
};
```

## Debugging

When captions aren't working, use these tools:

```javascript
// Get detailed debug info
console.log('Caption Debug:', captionService.getDebugInfo());

// Test specific time
console.log('Caption at 30s:', captionService.getCurrentCaption(30000));

// Enable extra debug logging
captionService.setDebugMode(true);
```

## Rules Going Forward

### ✅ **DO:**
- Only use `captionService.getCurrentCaption(currentTimeMs)` for captions
- Call `captionService.setTranscript()` once when AssemblyAI completes
- Call `captionService.reset()` when starting new clips

### ❌ **DON'T:**
- Add caption timing logic anywhere else in your app
- Modify transcript data outside of CaptionService
- Try to "fix" caption timing in your components

### 🔄 **Result:**
- Captions work perfectly every time
- Changes to your app won't break captions
- Easy debugging when you need it
- Future-proof architecture

## Migration Notes

The old caption system had timing logic scattered throughout the app. The new CaptionService centralizes all this logic, making it:

1. **More Reliable**: Single source of truth for caption timing
2. **Easier to Debug**: All caption logic in one place
3. **Future-Proof**: Easy to enhance without breaking other parts
4. **Cleaner Code**: Removes complex timing calculations from UI components

Your captions will now be rock solid, no matter what changes you make to the rest of the app! 🛡️
