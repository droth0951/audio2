// AssemblyAI Caption Solution: Bulletproof Sentence-by-Sentence System

class BulletproofCaptionService {
  constructor() {
    this.reset();
    this.debugMode = false;
  }

  reset() {
    this.transcript = null;
    this.clipStartMs = 0;
    this.clipEndMs = 0;
    this.utterances = [];
    this.debugMode = false;
    this.previousUtteranceText = ''; // Track previous utterance for smart capitalization
    this.currentSpeaker = null; // Track current speaker for speaker change detection
  }

  setDebugMode(enabled) {
    this.debugMode = enabled;
  }

  // CRITICAL: Single source of truth for transcript setup
  setTranscript(assemblyAIResponse, clipStartMs, clipEndMs) {
    this.transcript = assemblyAIResponse;
    this.clipStartMs = clipStartMs;
    this.clipEndMs = clipEndMs;
    
    // Process utterances for sentence-by-sentence display
    this.utterances = this.processUtterances(assemblyAIResponse);
    
    if (this.debugMode) {
      console.log('[CaptionService] Setup complete:', {
        utteranceCount: this.utterances.length,
        clipDurationMs: clipEndMs - clipStartMs,
        firstUtterance: this.utterances[0]
      });
    }
  }

  // BULLETPROOF: Handle AssemblyAI timing normalization correctly
  processUtterances(response) {
    if (!response?.utterances?.length) {
      // Fallback: Create single utterance from full text
      return [{
        text: response.text || '',
        startMs: 0,
        endMs: this.clipEndMs - this.clipStartMs,
        speaker: null,
        normalized: true
      }];
    }

    let utterances;
    
    // Check if utterances are already normalized (from App.js)
    if (response.utterances[0]?.startMs !== undefined) {
      // Already normalized in App.js - use directly
      utterances = response.utterances;
    } else {
      // Legacy: Handle raw AssemblyAI format
      utterances = response.utterances.map(utterance => {
        return {
          text: utterance.text,
          startMs: utterance.start,     // Use raw AssemblyAI timing
          endMs: utterance.end,         // Use raw AssemblyAI timing
          speaker: utterance.speaker,
          confidence: utterance.confidence,
          normalized: true
        };
      });
    }
    
    // IMPROVEMENT: Combine very short utterances from the same speaker
    // and remove artificial periods from pause-based splits
    const combinedUtterances = [];
    let currentCombined = null;

    for (let i = 0; i < utterances.length; i++) {
      const utterance = utterances[i];
      const nextUtterance = utterances[i + 1];
      const utteranceDuration = utterance.endMs - utterance.startMs;
      const gapToNext = nextUtterance ? (nextUtterance.startMs - utterance.endMs) : Infinity;

      // Detect if this is an artificial split (not a real sentence ending):
      // 1. Same speaker as next utterance
      // 2. Gap is small (< 500ms indicates pause-based split, not speaker change)
      // 3. Current text ends with period
      const isArtificialSplit = nextUtterance &&
        utterance.speaker === nextUtterance.speaker &&
        gapToNext < 500 &&
        /[.]\s*$/.test(utterance.text);

      // Remove artificial period if detected
      let cleanedText = utterance.text;
      if (isArtificialSplit) {
        cleanedText = utterance.text.replace(/[.]\s*$/, '');
      }

      // Combine if:
      // 1. Same speaker as previous
      // 2. Previous utterance was very short (< 2 seconds) OR current is very short
      // 3. Gap between them is small (< 500ms)
      if (currentCombined &&
          currentCombined.speaker === utterance.speaker &&
          (utteranceDuration < 2000 || (currentCombined.endMs - currentCombined.startMs) < 2000) &&
          (utterance.startMs - currentCombined.endMs) < 500) {

        // Combine with previous - use a space (period was already removed if needed)
        currentCombined.text += ' ' + cleanedText;
        currentCombined.endMs = utterance.endMs;
      } else {
        // Start new utterance
        if (currentCombined) {
          combinedUtterances.push(currentCombined);
        }
        currentCombined = {
          ...utterance,
          text: cleanedText
        };
      }
    }

    // Don't forget the last one
    if (currentCombined) {
      combinedUtterances.push(currentCombined);
    }

    return combinedUtterances.length > 0 ? combinedUtterances : utterances;
  }

  // BULLETPROOF: Get current caption with robust error handling
  getCurrentCaption(currentTimeMs) {
    try {
      if (!this.utterances?.length) {
        return { text: '', speaker: null, isActive: false };
      }

      // Calculate clip-relative time
      const relativeTimeMs = currentTimeMs - this.clipStartMs;
      
      // DEBUG: Log caption lookup every few seconds during recording
      if (currentTimeMs % 3000 < 100) {
        console.log('[CaptionService] Caption lookup debug:', {
          currentTimeMs,
          clipStartMs: this.clipStartMs,
          relativeTimeMs,
          utteranceCount: this.utterances.length,
          firstUtterance: this.utterances[0] ? {
            start: this.utterances[0].startMs,
            end: this.utterances[0].endMs, 
            text: this.utterances[0].text.substring(0, 30)
          } : null,
          secondUtterance: this.utterances[1] ? {
            start: this.utterances[1].startMs,
            end: this.utterances[1].endMs,
            text: this.utterances[1].text.substring(0, 30) 
          } : null
        });
      }
      
      // Bounds checking
      if (relativeTimeMs < 0 || relativeTimeMs > (this.clipEndMs - this.clipStartMs)) {
        return { text: '', speaker: null, isActive: false };
      }

      // IMPROVED: Find the utterance that should be active right now
      const currentUtterance = this.utterances.find(utterance =>
        relativeTimeMs >= utterance.startMs && relativeTimeMs <= utterance.endMs
      );

      if (currentUtterance) {
        // SPEAKER CHANGE DETECTION: Add buffer at start of new speaker's utterance
        // This creates a visual break between speakers
        const SPEAKER_CHANGE_BUFFER_MS = 100; // Clear captions for 100ms when speaker changes

        if (this.currentSpeaker !== null &&
            this.currentSpeaker !== currentUtterance.speaker) {
          // Check if we're within the buffer period at the start of this utterance
          const timeIntoUtterance = relativeTimeMs - currentUtterance.startMs;

          if (timeIntoUtterance < SPEAKER_CHANGE_BUFFER_MS) {
            // Still in buffer period - don't show caption yet
            return {
              text: '',
              speaker: currentUtterance.speaker,
              isActive: false
            };
          }

          // Past buffer period - update speaker and continue
          this.currentSpeaker = currentUtterance.speaker;
        } else if (this.currentSpeaker === null) {
          // First utterance - just set the speaker
          this.currentSpeaker = currentUtterance.speaker;
        }

        let text = currentUtterance.text;

        // CORE FIX: Check if this should be capitalized based on the previous utterance
        const shouldCapitalize = !this.previousUtteranceText ||
          /[.!?]\s*$/.test(this.previousUtteranceText);

        // Only capitalize if it's truly a new sentence
        if (!shouldCapitalize && /^[A-Z]/.test(text)) {
          // If it starts with a capital but shouldn't, make it lowercase
          text = text.charAt(0).toLowerCase() + text.slice(1);
        }

        // Handle long utterances with progressive display
        const utteranceDuration = currentUtterance.endMs - currentUtterance.startMs;
        const timeIntoUtterance = relativeTimeMs - currentUtterance.startMs;
        const progressRatio = timeIntoUtterance / utteranceDuration;

        // For long text, break into chunks but preserve the corrected capitalization
        if (text.length > 120) {
          const chunks = this.breakIntoChunks(text, 120);
          const chunkIndex = Math.min(Math.floor(progressRatio * chunks.length), chunks.length - 1);
          text = chunks[chunkIndex];
        }

        // Store for next iteration
        this.previousUtteranceText = currentUtterance.text;

        return {
          text: text,
          speaker: currentUtterance.speaker,
          isActive: true
        };
      }
      
      // If no current utterance, find the next one coming up  
      const nextUtterance = this.utterances.find(utterance => 
        relativeTimeMs < utterance.startMs
      );
      
      if (nextUtterance) {
        // Upcoming utterance - preserve original text without forced capitalization
        return {
          text: this.smartCapitalize(nextUtterance.text, false), // false = not forcing start-of-utterance
          speaker: nextUtterance.speaker,
          isActive: false
        };
      }
      
      // FIX: If between utterances or past all, find the closest one
      let closestUtterance = this.utterances[0];
      let closestDistance = Math.abs(relativeTimeMs - closestUtterance.startMs);
      
      for (const utterance of this.utterances) {
        const startDistance = Math.abs(relativeTimeMs - utterance.startMs);
        const endDistance = Math.abs(relativeTimeMs - utterance.endMs);
        const minDistance = Math.min(startDistance, endDistance);
        
        if (minDistance < closestDistance) {
          closestUtterance = utterance;
          closestDistance = minDistance;
        }
      }
      
      // Fallback utterance - preserve original text without forced capitalization
      return {
        text: this.smartCapitalize(closestUtterance.text, false), // false = not forcing start-of-utterance
        speaker: closestUtterance.speaker,
        isActive: false // Show as inactive since we're not in the exact timing
      };

    } catch (error) {
      console.error('[CaptionService] Error getting current caption:', error);
      return { text: '', speaker: null, isActive: false };
    }
  }

  // Helper: Find closest utterance for graceful degradation
  findClosestUtterance(relativeTimeMs) {
    if (!this.utterances?.length) return null;
    
    let closest = this.utterances[0];
    let closestDistance = Math.abs(relativeTimeMs - closest.startMs);
    
    for (const utterance of this.utterances) {
      const distance = Math.min(
        Math.abs(relativeTimeMs - utterance.startMs),
        Math.abs(relativeTimeMs - utterance.endMs)
      );
      
      if (distance < closestDistance) {
        closest = utterance;
        closestDistance = distance;
      }
    }
    
    return closest;
  }

  // Helper: Progressive text display for long utterances
  getProgressiveText(text, progressRatio) {
    if (!text) return '';
    
    // Normalize whitespace first
    let normalizedText = text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/([.!?])\s*([a-z])/g, '$1 $2');
    
    const MAX_CHARS = 120; // Same as normalizeText limit

    // If text is short enough, just return it with smart capitalization
    if (normalizedText.length <= MAX_CHARS) {
      return this.smartCapitalize(normalizedText, true); // true = this is the start of utterance
    }
    
    // Break long text into chunks
    const chunks = this.breakIntoChunks(normalizedText, MAX_CHARS);
    
    // Determine which chunk to show based on progress
    const chunkIndex = Math.min(
      Math.floor(progressRatio * chunks.length),
      chunks.length - 1
    );
    
    // Only apply smart capitalization to the first chunk
    // Later chunks should preserve their original capitalization
    if (chunkIndex === 0) {
      return this.smartCapitalize(chunks[chunkIndex], true);
    } else {
      // Mid-utterance chunk - preserve original capitalization
      return chunks[chunkIndex];
    }
  }
  
  // New helper: Smart capitalization that knows context
  smartCapitalize(text, isStartOfUtterance) {
    if (!text) return '';
    
    // If this is the start of an utterance
    if (isStartOfUtterance) {
      const startsWithCapital = /^[A-Z]/.test(text);
      const isCommonPronoun = /^(i|i'm|i'll|i'd|i've)\b/i.test(text);
      
      if (startsWithCapital) {
        return text; // Already capitalized
      } else if (isCommonPronoun) {
        // Capitalize "i" pronouns
        return text.charAt(0).toUpperCase() + text.slice(1);
      } else if (/^[a-z]/.test(text)) {
        // Starts with lowercase - check if it looks like a sentence start
        // Only capitalize if it's after a long gap or at the very beginning
        return text; // Keep lowercase for mid-conversation utterances
      }
    }
    
    return text; // Default: preserve original
  }

  // Helper: Break text into display-sized chunks at natural boundaries
  breakIntoChunks(text, maxChars) {
    const chunks = [];
    let remainingText = text;
    
    while (remainingText.length > 0) {
      if (remainingText.length <= maxChars) {
        chunks.push(remainingText);
        break;
      }
      
      // Find the best break point within maxChars
      const breakPoints = ['. ', '! ', '? ', ', ', ' - ', ' — ', ' '];
      let bestBreak = -1;
      let bestBreakLength = 0;
      
      for (const breakPoint of breakPoints) {
        const index = remainingText.lastIndexOf(breakPoint, maxChars);
        if (index > maxChars * 0.3 && index > bestBreak) { // At least 30% through
          bestBreak = index;
          bestBreakLength = breakPoint.length;
        }
      }
      
      let chunkEnd;
      if (bestBreak > 0) {
        // Use natural break point
        chunkEnd = bestBreak + bestBreakLength;
        chunks.push(remainingText.substring(0, chunkEnd).trim());
      } else {
        // No natural break - cut at word boundary
        const words = remainingText.substring(0, maxChars).split(' ');
        words.pop(); // Remove the last potentially cut-off word
        const chunk = words.join(' ');
        chunks.push(chunk);
        chunkEnd = chunk.length;
      }
      
      remainingText = remainingText.substring(chunkEnd).trim();
    }
    
    return chunks;
  }

  // Helper: Final text formatting
  finalizeText(text) {
    if (!text) return '';
    
    // Only capitalize if this looks like the start of a sentence
    // Check if already starts with capital OR is a known sentence starter (case-sensitive)
    const startsWithCapital = /^[A-Z]/.test(text);
    const isCommonSentenceStarter = /^(I|We|You|They|He|She|It)\b/.test(text); // Single letters/pronouns that should be capitalized
    
    // DON'T capitalize if text starts with lowercase (unless it's a pronoun like "i")
    const startsWithLowercase = /^[a-z]/.test(text);
    
    if (startsWithCapital) {
      // Already capitalized - leave it
      return text;
    } else if (isCommonSentenceStarter) {
      // Common sentence starter that should be capitalized (like "i" → "I")
      return text.charAt(0).toUpperCase() + text.slice(1);
    } else if (startsWithLowercase) {
      // Starts with lowercase - this is mid-sentence, keep as-is
      return text;
    } else {
      // Starts with number or punctuation - keep as-is
      return text;
    }
  }

  // Helper: Text normalization for consistent display
  normalizeText(text) {
    if (!text) return '';
    
    // Normalize whitespace and fix sentence spacing
    let normalizedText = text
      .trim()
      .replace(/\s+/g, ' ')                    // Normalize whitespace
      .replace(/([.!?])\s*([a-z])/g, '$1 $2'); // Fix sentence spacing
    
    // INCREASED LIMIT: Allow up to 120 characters (about 3-4 lines)
    // This prevents cutting off mid-sentence for short utterances
    const MAX_CHARS = 120;
    
    if (normalizedText.length > MAX_CHARS) {
      // Try to find a natural break point (sentence or clause)
      const breakPoints = ['. ', '! ', '? ', ', ', ' - ', ' — '];
      let bestBreak = -1;
      let bestBreakChar = '';
      
      // Find the last natural break point before the limit
      for (const breakPoint of breakPoints) {
        const index = normalizedText.lastIndexOf(breakPoint, MAX_CHARS);
        if (index > bestBreak && index > MAX_CHARS * 0.5) { // At least halfway through
          bestBreak = index;
          bestBreakChar = breakPoint.trim();
        }
      }
      
      if (bestBreak > 0) {
        // Cut at natural break point
        normalizedText = normalizedText.substring(0, bestBreak + bestBreakChar.length);
      } else {
        // No natural break - cut at word boundary
        const words = normalizedText.split(' ');
        let truncated = '';
        for (const word of words) {
          if ((truncated + ' ' + word).trim().length <= MAX_CHARS) {
            truncated += (truncated ? ' ' : '') + word;
          } else {
            break;
          }
        }
        normalizedText = truncated + '...';
      }
    }
    
    // Ensure first letter is capitalized
    if (normalizedText.length > 0) {
      normalizedText = normalizedText.charAt(0).toUpperCase() + normalizedText.slice(1);
    }
    
    return normalizedText;
  }

  // Debug information
  getDebugInfo() {
    return {
      hasTranscript: !!this.transcript,
      utteranceCount: this.utterances?.length || 0,
      clipStartMs: this.clipStartMs,
      clipEndMs: this.clipEndMs,
      clipDuration: this.clipEndMs - this.clipStartMs,
      debugMode: this.debugMode,
      firstUtterance: this.utterances?.[0],
      lastUtterance: this.utterances?.[this.utterances?.length - 1]
    };
  }
}

// Export singleton instance
const captionService = new BulletproofCaptionService();
export default captionService;
