# Bold-Style Captions - LEAN Implementation Plan

## 🎯 LEAN Philosophy: Minimal Changes, Maximum Impact

**Goal**: Transform basic captions to bold, TikTok-style with the smallest possible code change.  
**Timeline**: 1 hour implementation  
**Approach**: Enhance existing `SimpleCaptionOverlay`, don't rebuild from scratch  

---

## ✅ What We DON'T Change

- ❌ AssemblyAI integration (keep existing)
- ❌ Railway service calls (keep existing) 
- ❌ Caption generation logic (keep existing)
- ❌ Recording system (keep existing)
- ❌ App.js structure (keep existing)
- ❌ Timing calculation (keep existing clipRelativeTime)

## ✨ What We DO Change

- ✅ Replace `SimpleCaptionOverlay` component (1 function)
- ✅ Add 5 new styles to existing stylesheet
- ✅ Add 3 timing constants
- ✅ Enhance word chunking (15 lines)

---

## 📋 Step-by-Step Implementation

### Step 1: Create Feature Branch (30 seconds)
```bash
git checkout -b feature/bold-captions
```

### Step 2: Replace SimpleCaptionOverlay (5 minutes)

**Find this in App.js (lines 104-178):**
```javascript
const SimpleCaptionOverlay = ({ transcript, currentTimeMs, clipStartMs = 0 }) => {
  // ... existing component
};
```

**Replace with:**
```javascript
// Bold-Style Caption Constants
const CAPTION_TIMING = {
  LOOKAHEAD_MS: 150,  // Show captions early
  LOOKBACK_MS: 400,   // Keep captions longer  
  MAX_WORDS: 3        // Max words per chunk
};

const BoldCaptionOverlay = ({ transcript, currentTimeMs, clipStartMs = 0 }) => {
  const [currentText, setCurrentText] = useState('');
  const [highlightedWord, setHighlightedWord] = useState('');
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (!transcript?.words?.length || typeof currentTimeMs !== 'number') {
      setCurrentText('');
      setHighlightedWord('');
      return;
    }

    const clipRelativeTime = currentTimeMs - clipStartMs;
    
    // Create 2-3 word chunks (LEAN: reuse existing timing logic)
    const visibleWords = [];
    for (const word of transcript.words) {
      const wordTime = word.startMs;
      if (clipRelativeTime >= wordTime - CAPTION_TIMING.LOOKAHEAD_MS && 
          clipRelativeTime <= wordTime + CAPTION_TIMING.LOOKBACK_MS) {
        visibleWords.push(word);
      }
    }
    
    // Take first 2-3 words for Bold style
    const chunkWords = visibleWords.slice(0, CAPTION_TIMING.MAX_WORDS);
    const newText = chunkWords.map(w => w.text).join(' ');
    
    // Find highlighted word
    const currentWord = chunkWords.find(word =>
      clipRelativeTime >= word.startMs && clipRelativeTime <= word.startMs + 500
    );
    
    if (newText !== currentText) {
      setCurrentText(newText);
      // Simple fade animation
      RNAnimated.timing(fadeAnim, {
        toValue: newText ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
    
    setHighlightedWord(currentWord?.text || '');
    
  }, [transcript, currentTimeMs, clipStartMs]);

  if (!currentText.trim()) return null;

  return (
    <RNAnimated.View style={[styles.boldCaptionContainer, { opacity: fadeAnim }]}>
      <View style={styles.boldBubble}>
        <Text style={styles.boldText}>
          {currentText.split(' ').map((word, index) => (
            <Text 
              key={index}
              style={word === highlightedWord ? styles.highlightedWord : {}}
            >
              {word}{index < currentText.split(' ').length - 1 ? ' ' : ''}
            </Text>
          ))}
        </Text>
      </View>
    </RNAnimated.View>
  );
};
```

### Step 3: Update Component Usage (30 seconds)

**Find this in RecordingView (around line 600):**
```javascript
<SimpleCaptionOverlay
  transcript={preparedTranscript}
  currentTimeMs={position}
  clipStartMs={clipStart}
/>
```

**Change to:**
```javascript
<BoldCaptionOverlay
  transcript={preparedTranscript}
  currentTimeMs={position}
  clipStartMs={clipStart}
/>
```

### Step 4: Add Bold Styles (2 minutes)

**Add to your existing styles object in App.js:**
```javascript
// Add these 5 styles to your StyleSheet.create():
boldCaptionContainer: {
  position: 'absolute',
  bottom: 120,
  left: 30,
  right: 60,
  alignItems: 'center',
  zIndex: 100,
},
boldBubble: {
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  paddingHorizontal: 18,
  paddingVertical: 12,
  borderRadius: 22,
  borderWidth: 2,
  borderColor: 'rgba(255, 255, 255, 0.15)',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
},
boldText: {
  color: '#ffffff',
  fontSize: 20,
  fontWeight: '800',
  textAlign: 'center',
  lineHeight: 26,
  letterSpacing: 0.5,
  textShadowColor: 'rgba(0, 0, 0, 0.9)',
  textShadowOffset: { width: 1, height: 2 },
  textShadowRadius: 4,
},
highlightedWord: {
  color: '#d97706',
  textShadowColor: 'rgba(217, 119, 6, 0.8)',
  textShadowRadius: 6,
},
```

### Step 5: Test & Commit (2 minutes)
```bash
# Test the implementation
npx expo start

# Commit when working
git add App.js
git commit -m "Add Bold-style captions with word highlighting"
```

---

## 🎯 LEAN Success Criteria

**✅ Working in 1 hour:**
- 2-3 word chunks appear in Bold-style bubbles
- Words highlight in Audio2 orange as spoken
- Smooth fade animations between chunks
- Safe zone positioning on all devices

**✅ Code changes under 100 lines:**
- 1 component replacement (~50 lines)
- 4 new styles (~30 lines) 
- 3 timing constants (~3 lines)
- 1 usage update (~1 line)

**✅ Zero architecture changes:**
- Same AssemblyAI data flow
- Same timing calculations
- Same recording system
- Same performance characteristics

---

## 🚫 What NOT to Build (Avoid Over-Engineering)

**Don't add these until users request:**
- ❌ Multiple caption styles/themes
- ❌ Advanced chunking algorithms  
- ❌ Complex animation sequences
- ❌ Caption position customization
- ❌ Font size/family options
- ❌ Tap-to-hide functionality
- ❌ Performance monitoring
- ❌ Debug overlays
- ❌ Unit tests for captions
- ❌ Caption caching systems

**Remember**: Ship simple Bold-style captions first, iterate based on user feedback.

---

## 🐛 Debugging Quick Fixes

**If captions don't appear:**
```javascript
// Add temporary debug log in useEffect:
console.log('🎬 Caption debug:', {
  hasWords: !!transcript?.words?.length,
  currentTime: clipRelativeTime,
  visibleWords: visibleWords.length,
  currentText
});
```

**If timing feels off:**
```javascript
// Adjust these constants:
const CAPTION_TIMING = {
  LOOKAHEAD_MS: 200,  // Increase if too late
  LOOKBACK_MS: 500,   // Increase if flickering
  MAX_WORDS: 2        // Reduce if too much text
};
```

**If highlights don't work:**
- Check that `word.startMs` exists in your transcript data
- Verify the highlighting time window (currently 500ms)

---

## 📱 Expected Output

**Before**: 
`"they are obsessed with what they do"` (static black box)

**After**: 
```
┌─────────────────────┐
│  they are OBSESSED  │  ← Bold bubble, orange highlight
└─────────────────────┘

┌─────────────────────┐  
│  with WHAT they do  │  ← Next chunk, new highlight
└─────────────────────┘
```

---

## 🚀 Merge to Main

**When satisfied:**
```bash
git checkout main
git merge feature/bold-captions
git push origin main
```

**Success = Bold, TikTok-style captions working in under 1 hour with minimal code changes!** 🎉