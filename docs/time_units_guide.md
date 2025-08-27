# Audio2 Time Units - MANDATORY DEVELOPER GUIDE

*Save this as `docs/TIME-UNITS.md` in your project root*

## 🚨 CRITICAL: Audio2 Uses MILLISECONDS Everywhere

**ALL time values in Audio2 are in MILLISECONDS. No exceptions.**

---

## 📏 The Audio2 Time Standard

### ✅ CORRECT - Always Milliseconds:
```javascript
// Audio playback position
position: 185000  // 3 minutes 5 seconds

// Clip boundaries  
clipStart: 45000  // 45 seconds
clipEnd: 65000    // 1 minute 5 seconds

// AssemblyAI word timestamps
word.startMs: 12500  // 12.5 seconds
word.endMs: 13200    // 13.2 seconds

// Time calculations
const clipRelativeTime = currentTimeMs - clipStartMs;
```

### ❌ WRONG - Never Use Seconds:
```javascript
// DON'T DO THIS
position: 185     // This is seconds, will break everything
clipStart: 45     // This is seconds, will break sync
word.start: 12.5  // This is seconds, captions won't work
```

---

## 🎯 Quick Reference Card

| What | Unit | Example | Notes |
|------|------|---------|-------|
| **expo-av position** | ms | `185000` | Audio player position |
| **expo-av duration** | ms | `1800000` | Total episode length |
| **clipStart/clipEnd** | ms | `45000/65000` | User-selected clip boundaries |
| **AssemblyAI words** | ms | `word.startMs: 12500` | After normalization |
| **All calculations** | ms | `currentTimeMs - clipStartMs` | Always subtract ms from ms |

---

## 🛡️ How to Prevent Time Unit Bugs

### 1. Variable Naming Convention
**ALWAYS include unit in variable names:**
```javascript
// GOOD - Units are clear
const currentTimeMs = 185000;
const clipStartMs = 45000;
const wordStartMs = 12500;

// BAD - Unclear units
const currentTime = 185000;  // Milliseconds? Seconds?
const start = 45;           // What unit is this?
```

### 2. Comment All Time Variables
```javascript
// ALWAYS add comments for time values
const LOOKAHEAD_MS = 1500;  // Show captions 1.5 seconds early
const position = 185000;    // Current playback position in milliseconds
const clipStart = 45000;    // User clip start in milliseconds
```

### 3. Add Validation Functions
```javascript
// Add these helper functions to catch unit mistakes:
const validateTimeMs = (timeMs, label = 'time') => {
  if (typeof timeMs !== 'number' || timeMs < 0) {
    console.error(`❌ Invalid ${label}:`, timeMs, '- Expected positive milliseconds');
    return false;
  }
  if (timeMs > 0 && timeMs < 1000) {
    console.warn(`⚠️ Suspicious ${label}:`, timeMs, '- This looks like seconds, not milliseconds');
  }
  return true;
};

// Use in your components:
useEffect(() => {
  validateTimeMs(currentTimeMs, 'currentTimeMs');
  validateTimeMs(clipStartMs, 'clipStartMs');
  // ... rest of your code
}, [currentTimeMs, clipStartMs]);
```

---

## 🔧 Common Conversion Patterns

### From Seconds to Milliseconds:
```javascript
const secondsToMs = (seconds) => Math.round(seconds * 1000);

// Usage:
const clipStartMs = secondsToMs(45);  // 45000ms
```

### From Milliseconds to Display:
```javascript
const formatTime = (millis) => {
  if (typeof millis !== 'number' || isNaN(millis) || millis < 0) {
    return '0:00';
  }
  const minutes = Math.floor(millis / 60000);  // 60000ms = 1 minute
  const seconds = Math.floor((millis % 60000) / 1000);  // 1000ms = 1 second
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
```

### Debug Helper:
```javascript
const debugTime = (timeMs, label) => {
  console.log(`🕒 ${label}:`, {
    milliseconds: timeMs,
    seconds: Math.round(timeMs / 1000 * 10) / 10,  // 1 decimal
    formatted: formatTime(timeMs),
    isValid: typeof timeMs === 'number' && timeMs >= 0
  });
};

// Usage in caption debugging:
debugTime(currentTimeMs, 'Current Position');
debugTime(clipStartMs, 'Clip Start');
debugTime(word.startMs, `Word "${word.text}"`);
```

---

## 📋 Caption Timing Checklist

Before working on captions, verify these are ALL in milliseconds:

```javascript
// ✅ Verify these are all milliseconds:
console.log('🔍 Time Units Check:', {
  currentTimeMs: currentTimeMs,        // From expo-av (should be ~185000)
  clipStartMs: clipStartMs,            // From user selection (should be ~45000) 
  clipEndMs: clipEndMs,                // From user selection (should be ~65000)
  wordStartMs: word.startMs,           // From AssemblyAI (should be ~12500)
  clipRelativeTime: currentTimeMs - clipStartMs,  // Should be positive number
});

// 🚨 RED FLAGS - These suggest wrong units:
// - currentTimeMs is under 1000 (probably seconds)
// - clipStartMs is under 1000 (probably seconds)  
// - wordStartMs is under 1000 (probably seconds)
// - Any time value looks like 45.5 or 12.3 (probably seconds)
```

---

## 🎯 Instructions for Cursor/AI

When working on Audio2 timing code:

1. **ALWAYS assume milliseconds** unless explicitly told otherwise
2. **Add Ms suffix** to all time variable names
3. **Never divide by 1000** unless converting for display only
4. **Never multiply by 1000** unless converting FROM seconds
5. **Add validation** for any time calculations
6. **Log time values** during debugging to catch unit mistakes

### Example Cursor Instruction:
```
"When modifying caption timing in Audio2, remember that ALL time values are in milliseconds:
- currentTimeMs (from expo-av)
- clipStartMs (user selection) 
- clipEndMs (user selection)
- word.startMs (from AssemblyAI)

Add validateTimeMs() calls and debug logs to verify units are correct. Never assume seconds."
```

---

## 🐛 Debugging Time Unit Issues

### Symptoms of Wrong Units:
- **Captions appear way too early/late**
- **Captions never appear**
- **Captions flicker rapidly** 
- **Sync gets worse over time**

### Quick Debug:
```javascript
// Add this to any timing function:
console.log('⏰ Time Debug:', {
  'Current (should be ~185000)': currentTimeMs,
  'Clip Start (should be ~45000)': clipStartMs, 
  'Word Time (should be ~12500)': word.startMs,
  'Relative (should be positive)': currentTimeMs - clipStartMs,
});
```

### Fix Pattern:
1. **Log all time values** 
2. **Check they're 4-6 digits** (milliseconds)
3. **If 1-3 digits**, multiply by 1000
4. **Test caption sync**

---

## 🎬 Audio2 Time Flow

```
User starts playback
    ↓
expo-av provides position in MS → currentTimeMs (185000)
    ↓  
User sets clip points in MS → clipStartMs (45000), clipEndMs (65000)
    ↓
Calculate relative time in MS → clipRelativeTime = currentTimeMs - clipStartMs
    ↓
AssemblyAI provides words in MS → word.startMs (12500), word.endMs (13200)
    ↓
Compare times in MS → if (clipRelativeTime >= word.startMs) showWord();
    ↓
Caption appears at correct time ✅
```

**Every step is milliseconds. No conversions needed.**

---

*📌 PIN THIS DOCUMENT. Reference it every time you work on timing code. Share it with any developer who touches Audio2.*