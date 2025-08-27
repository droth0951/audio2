# Audio2 Caption Sync Debugging Guide

## 🚨 CRITICAL: TIMING ISSUES
**If captions show wrong text or timing is off, check this FIRST:**
📋 **[Utterance Timing Guide](./utterance_timing_guide.md)** - The most fragile part of the caption system

## Common Symptom: Caption Text Doesn't Match Audio
**Problem**: Audio says "X" but caption shows "Y" - completely different words.

## 🔍 Debug Steps:

### 1. Check shouldShow Array
```javascript
console.log('🎯 Caption Debug:', {
  relativeTime: currentRelativeTimeMs,
  shouldShow: transcript.words.filter(w => 
    currentRelativeTimeMs >= w.startMs && currentRelativeTimeMs <= w.endMs
  ).map(w => w.text),
  actuallyShowing: captionText
});
```

### 2. Verify Active Words Match Display
- **shouldShow array** = what SHOULD be displaying
- **actuallyShowing** = what IS displaying
- These must match exactly

### 3. Common Bugs:

#### Context Window Bug
**Problem**: Showing words around active word instead of active word
```javascript
// WRONG: This adds context that breaks sync
const startIndex = Math.max(0, currentIndex - 1);
const endIndex = Math.min(words.length, currentIndex + 1);
```

#### Timing Offset Bug
**Problem**: Using wrong time reference (absolute vs relative)
```javascript
// WRONG: Using absolute time instead of relative
const wordTime = word.start; // Should be word.startMs - clipStartMs

// CORRECT: Use relative time
const wordTime = word.startMs; // Already normalized to clip start
```

#### Word Overlap Bug
**Problem**: Multiple words active simultaneously due to timing gaps
```javascript
// WRONG: This can show multiple words
const activeWords = transcript.words.filter(word => 
  currentRelativeTimeMs >= word.startMs && 
  currentRelativeTimeMs <= word.endMs
);
// If timing is off, this could return multiple words
```

### 4. The Fix:
```javascript
// CORRECT: Show only active words
const activeWords = transcript.words.filter(word => 
  currentRelativeTimeMs >= word.startMs && 
  currentRelativeTimeMs <= word.endMs
);
const captionText = activeWords.map(w => w.text).join(' ');
```

### 5. Never Do This:
```javascript
// WRONG: Don't add arbitrary context
const startIndex = Math.max(0, currentIndex - 2);
const endIndex = Math.min(words.length, currentIndex + 3);
// This creates sync problems!
```

## 🎯 Debug Checklist:

- [ ] `shouldShow` array contains expected words
- [ ] `actuallyShowing` matches `shouldShow`
- [ ] Time units are in milliseconds (not seconds)
- [ ] Using relative time (not absolute)
- [ ] No arbitrary context windows
- [ ] AssemblyAI parameters include `speaker_labels: true`

## 📊 Expected Debug Output:
```javascript
🎯 Caption Debug: {
  relativeTime: 140000,        // Should be positive, reasonable
  shouldShow: ["world"],       // Should match audio
  actuallyShowing: "world"     // Must match shouldShow
}
```

## 🚨 Red Flags:
- `shouldShow` is empty but audio is playing
- `shouldShow` has multiple words when only one should be active
- `actuallyShowing` doesn't match `shouldShow`
- `relativeTime` is negative or very large

## 🔧 Quick Fix Pattern:
```javascript
// If captions are wrong, always check this first:
console.log('🎯 TIMING DEBUG:', {
  currentTimeMs,
  clipStartMs,
  relativeTime: currentTimeMs - clipStartMs,
  firstWord: transcript.words?.[0],
  activeWords: transcript.words?.filter(w => 
    (currentTimeMs - clipStartMs) >= w.startMs && 
    (currentTimeMs - clipStartMs) <= w.endMs
  )
});
```

---

*📌 REFERENCE THIS GUIDE EVERY TIME YOU WORK ON CAPTION TIMING CODE*
