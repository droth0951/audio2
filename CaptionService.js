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

    return response.utterances.map(utterance => {
      // CRITICAL: AssemblyAI already provides clip-relative timing when using audio_start_from
      // DO NOT subtract clipStart again - that causes double normalization
      return {
        text: utterance.text,
        startMs: utterance.start,     // ✅ Already normalized by AssemblyAI
        endMs: utterance.end,         // ✅ Already normalized by AssemblyAI  
        speaker: utterance.speaker,
        confidence: utterance.confidence,
        normalized: true
      };
    });
  }

  // BULLETPROOF: Get current caption with robust error handling
  getCurrentCaption(currentTimeMs) {
    try {
      if (!this.utterances?.length) {
        return { text: '', speaker: null, isActive: false };
      }

      // Calculate clip-relative time
      const relativeTimeMs = currentTimeMs - this.clipStartMs;
      
      // Bounds checking
      if (relativeTimeMs < 0 || relativeTimeMs > (this.clipEndMs - this.clipStartMs)) {
        return { text: '', speaker: null, isActive: false };
      }

      // Show first utterance immediately when recording starts (0-1000ms grace period)
      if (relativeTimeMs <= 1000) {
        const firstUtterance = this.utterances[0];
        if (firstUtterance) {
          return {
            text: this.normalizeText(firstUtterance.text),
            speaker: firstUtterance.speaker,
            isActive: true
          };
        }
      }

      // SIMPLIFIED: Find the most appropriate utterance for the current time
      let bestUtterance = null;
      let bestScore = -1;
      
      for (const utterance of this.utterances) {
        let score = 0;
        
        // If we're within the utterance's time range, it's perfect
        if (relativeTimeMs >= utterance.startMs && relativeTimeMs <= utterance.endMs) {
          score = 100;
        }
        // If we're just before the utterance starts, it's good
        else if (relativeTimeMs < utterance.startMs && utterance.startMs - relativeTimeMs <= 1000) {
          score = 50;
        }
        // If we're just after the utterance ends, it's acceptable
        else if (relativeTimeMs > utterance.endMs && relativeTimeMs - utterance.endMs <= 1000) {
          score = 25;
        }
        // Otherwise, calculate distance-based score
        else {
          const distanceToStart = Math.abs(relativeTimeMs - utterance.startMs);
          const distanceToEnd = Math.abs(relativeTimeMs - utterance.endMs);
          const minDistance = Math.min(distanceToStart, distanceToEnd);
          score = Math.max(0, 100 - minDistance / 10); // Higher score for closer utterances
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestUtterance = utterance;
        }
      }
      
      if (bestUtterance) {
        const isActive = relativeTimeMs >= bestUtterance.startMs && relativeTimeMs <= bestUtterance.endMs;
        return {
          text: this.normalizeText(bestUtterance.text),
          speaker: bestUtterance.speaker,
          isActive: isActive
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
    
    // CRITICAL: Enforce 2-line maximum (approximately 60 characters)
    let normalizedText = text
      .trim()
      .replace(/\s+/g, ' ')                    // Normalize whitespace
      .replace(/([.!?])\s*([a-z])/g, '$1 $2'); // Fix sentence spacing
    
    // Enforce character limit for 2-line display
    if (normalizedText.length > 60) {
      // Find last complete sentence that fits
      const sentences = normalizedText.split(/[.!?]+/);
      let truncated = '';
      
      for (const sentence of sentences) {
        const candidate = truncated + (truncated ? '. ' : '') + sentence.trim();
        if (candidate.length <= 60 && sentence.trim()) {
          truncated = candidate;
        } else {
          break;
        }
      }
      
      if (!truncated) {
        // If no complete sentence fits, truncate at word boundary
        const words = normalizedText.split(' ');
        for (const word of words) {
          if ((truncated + ' ' + word).length <= 60) {
            truncated += (truncated ? ' ' : '') + word;
          } else {
            break;
          }
        }
      }
      
      normalizedText = truncated + '...';
    }
    
    // PRESERVE AssemblyAI's capitalization - don't force lowercase
    // Only ensure first letter is capitalized if it isn't already
    if (normalizedText.length > 0 && normalizedText.charAt(0) !== normalizedText.charAt(0).toUpperCase()) {
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
