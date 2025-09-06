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
    // This helps with AssemblyAI's tendency to fragment sentences
    const combinedUtterances = [];
    let currentCombined = null;
    
    for (const utterance of utterances) {
      const utteranceDuration = utterance.endMs - utterance.startMs;
      
      // Combine if:
      // 1. Same speaker as previous
      // 2. Previous utterance was very short (< 2 seconds) OR current is very short
      // 3. Gap between them is small (< 500ms)
      if (currentCombined && 
          currentCombined.speaker === utterance.speaker &&
          (utteranceDuration < 2000 || (currentCombined.endMs - currentCombined.startMs) < 2000) &&
          (utterance.startMs - currentCombined.endMs) < 500) {
        
        // Combine with previous
        currentCombined.text += ' ' + utterance.text;
        currentCombined.endMs = utterance.endMs;
      } else {
        // Start new utterance
        if (currentCombined) {
          combinedUtterances.push(currentCombined);
        }
        currentCombined = { ...utterance };
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
      
      // Verbose timing debug logs removed to prevent white screen performance issues
      
      if (this.debugMode) {
        console.log('[CaptionService] Timing debug:', {
          currentTimeMs,
          clipStartMs: this.clipStartMs,
          relativeTimeMs,
          firstUtteranceStart: this.utterances[0]?.startMs,
          firstUtteranceEnd: this.utterances[0]?.endMs,
          utteranceCount: this.utterances.length
        });
      }
      
      // Bounds checking
      if (relativeTimeMs < 0 || relativeTimeMs > (this.clipEndMs - this.clipStartMs)) {
        return { text: '', speaker: null, isActive: false };
      }

      // SIMPLE: Find the utterance that should be active right now
      const currentUtterance = this.utterances.find(utterance => 
        relativeTimeMs >= utterance.startMs && relativeTimeMs <= utterance.endMs
      );
      
      if (currentUtterance) {
        return {
          text: this.normalizeText(currentUtterance.text),
          speaker: currentUtterance.speaker,
          isActive: true
        };
      }
      
      // If no current utterance, find the next one coming up
      const nextUtterance = this.utterances.find(utterance => 
        relativeTimeMs < utterance.startMs
      );
      
      if (nextUtterance) {
        return {
          text: this.normalizeText(nextUtterance.text),
          speaker: nextUtterance.speaker,
          isActive: false
        };
      }
      
      // If no next utterance, show the last one
      const lastUtterance = this.utterances[this.utterances.length - 1];
      if (lastUtterance) {
        return {
          text: this.normalizeText(lastUtterance.text),
          speaker: lastUtterance.speaker,
          isActive: false
        };
      }

      return { text: '', speaker: null, isActive: false };

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
