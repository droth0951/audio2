# Utterance Timing Guide - CRITICAL LESSONS LEARNED

## 🚨 WHY THIS MATTERS
Utterance timing is the most fragile part of Audio2's caption system. It breaks every time we modify caption logic, and when it's wrong, captions show completely different text than what's being spoken.

## 📋 THE CORE PROBLEM
AssemblyAI returns timestamps in **absolute time** (from the start of the full podcast), but we need **clip-relative time** (from the start of our selected clip).

## 🔧 THE WORKING SOLUTION (DO NOT CHANGE)

### 1. AssemblyAI Request Configuration
```javascript
// ALWAYS include these parameters in AssemblyAI requests:
{
  audio_url: originalPodcastUrl,
  audio_start_from: clipStartMs,    // CRITICAL: Server-side clipping
  audio_end_at: clipEndMs,          // CRITICAL: Server-side clipping
  speaker_labels: true,             // Enable speaker detection
  speakers_expected: 2,             // Most podcasts have 2 speakers
  word_boost: [],
  punctuate: true,
  format_text: true
}
```

### 2. Utterance Normalization (THE KEY)
```javascript
// When processing AssemblyAI response, normalize timestamps:
const processedUtterances = response.utterances?.map(utterance => ({
  ...utterance,
  startMs: utterance.start - clipStartMs,  // Convert to clip-relative
  endMs: utterance.end - clipStartMs,      // Convert to clip-relative
  text: utterance.text,
  speaker: utterance.speaker
})) || [];
```

### 3. Utterance Selection Logic
```javascript
const getCurrentUtterance = (transcript, currentRelativeTimeMs) => {
  if (!transcript?.utterances || transcript.utterances.length === 0) {
    return getCurrentWords(transcript, currentRelativeTimeMs); // Fallback
  }
  
  // Show first utterance immediately when recording starts
  if (currentRelativeTimeMs <= 500 && transcript.utterances.length > 0) {
    return {
      text: normalizeTextCapitalization(transcript.utterances[0].text),
      speaker: transcript.utterances[0].speaker
    };
  }
  
  // Find current utterance based on normalized timing
  const currentUtterance = transcript.utterances.find(utterance => 
    currentRelativeTimeMs >= utterance.startMs && 
    currentRelativeTimeMs <= utterance.endMs
  );
  
  if (currentUtterance) {
    return {
      text: normalizeTextCapitalization(currentUtterance.text),
      speaker: currentUtterance.speaker
    };
  }
  
  return { text: '', speaker: null };
};
```

## 🚫 COMMON MISTAKES THAT BREAK TIMING

### 1. Double Normalization
```javascript
// WRONG - This subtracts clipStart twice:
startMs: utterance.start - clipStartMs - clipStartMs
// Result: Negative timestamps, wrong utterances selected
```

### 2. Using Absolute Timestamps
```javascript
// WRONG - Using AssemblyAI's original timestamps:
currentRelativeTimeMs >= utterance.start  // This is absolute time!
// Result: Captions never match because timing is off by clipStart
```

### 3. Skipping Normalization
```javascript
// WRONG - Not normalizing at all:
const processedUtterances = response.utterances || [];
// Result: Captions show wrong text because timing is absolute
```

### 4. Wrong Time Calculation
```javascript
// WRONG - Using wrong relative time:
const clipRelativeTimeMs = position - clipStart;  // Missing Ms suffix
// Result: Timing calculations are off by 1000x
```

## 🔍 DEBUGGING UTTERANCE TIMING

### 1. Check AssemblyAI Response Structure
```javascript
console.log('🔍 AssemblyAI Raw Response Structure:', {
  firstUtterance: response.utterances?.[0],
  hasUtterances: !!response.utterances?.length,
  utterancesLength: response.utterances?.length || 0,
  speakerLabels: response.speaker_labels,
  wordsLength: response.words?.length || 0
});
```

### 2. Verify Normalization
```javascript
console.log('🔍 Stored Transcript Structure:', {
  firstUtterance: processedUtterances?.[0],
  hasUtterances: !!processedUtterances?.length,
  utterancesLength: processedUtterances?.length || 0,
  firstWord: processedWords?.[0]
});
```

### 3. Monitor Utterance Selection
```javascript
console.log('🎯 UTTERANCE CAPTION CHECK:', {
  relativeTime: clipRelativeTimeMs,
  hasUtterances: !!transcript?.utterances?.length,
  utteranceCount: transcript?.utterances?.length || 0,
  currentUtterance: currentCaption,
  showingFirstUtterance: clipRelativeTimeMs <= 500 && transcript?.utterances?.length > 0
});
```

## ✅ VERIFICATION CHECKLIST

Before considering utterance timing "working":

1. **AssemblyAI Response**: Contains `utterances` array with `start` and `end` timestamps
2. **Normalization**: `startMs` and `endMs` are calculated as `original - clipStartMs`
3. **Timing Range**: `startMs` should be around 0-1000ms, not negative
4. **Utterance Selection**: Correct utterance shows for current audio position
5. **First Utterance**: Shows immediately when recording starts (0-500ms)
6. **Speaker Labels**: Present and working correctly

## 🚨 RED FLAGS (TIMING IS BROKEN)

- Captions show "X" when audio says "Y"
- First utterance never appears
- All timestamps are negative
- Utterances jump randomly
- Console shows timing errors

## 🔧 QUICK FIXES

### If captions show wrong text:
1. Check `clipRelativeTimeMs` calculation
2. Verify utterance normalization
3. Ensure `currentRelativeTimeMs` is correct

### If first utterance doesn't show:
1. Check the 500ms condition
2. Verify `transcript.utterances.length > 0`
3. Ensure normalization didn't break the array

### If timing is completely off:
1. Check for double normalization
2. Verify `clipStartMs` value
3. Ensure AssemblyAI request includes `audio_start_from` and `audio_end_at`

## 📌 CRITICAL REMINDERS

1. **NEVER** modify utterance timing logic without testing
2. **ALWAYS** check console logs for timing debug info
3. **VERIFY** normalization is happening correctly
4. **TEST** with known audio clips to confirm timing
5. **DOCUMENT** any timing changes in this guide

## 🎯 THE GOLDEN RULE
**AssemblyAI timestamps are absolute, but we need clip-relative. Always normalize by subtracting `clipStartMs`.**

---

*📌 PIN THIS DOCUMENT. Reference it every time you work on utterance timing. This is the most fragile part of the caption system.*
