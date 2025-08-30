// Enhanced CaptionService.js - Fixes timing issues with lookahead and linger
class EnhancedCaptionService {
  constructor() {
    this.transcript = null;
    this.clipStartMs = 0;
    this.clipEndMs = 0;
    this.debugMode = false;
    
    // TIMING FIXES - Add these constants
    this.CAPTION_LOOKAHEAD_MS = 200; // Show captions 200ms early
    this.CAPTION_LINGER_MS = 300;    // Keep captions visible 300ms longer
    this.MAX_CAPTION_LENGTH = 120; // Maximum characters per caption
  }

  setTranscript(transcript, clipStartMs, clipEndMs) {
    // Validate input (keeping your existing validation)
    if (!transcript) {
      console.warn('CaptionService: No transcript provided');
      return;
    }

    if (!transcript.words && !transcript.utterances) {
      console.warn('CaptionService: Invalid transcript format - missing words or utterances');
      return;
    }

    if (typeof clipStartMs !== 'number' || typeof clipEndMs !== 'number') {
      console.warn('CaptionService: Invalid clip timing provided');
      return;
    }

    this.transcript = transcript;
    this.clipStartMs = clipStartMs;
    this.clipEndMs = clipEndMs;

    if (this.debugMode) {
      console.log('🎬 CaptionService: Transcript set successfully', {
        wordCount: transcript.words?.length || 0,
        utteranceCount: transcript.utterances?.length || 0,
        clipDuration: clipEndMs - clipStartMs,
        clipStart: clipStartMs,
        clipEnd: clipEndMs
      });
    }
  }

  getCurrentCaption(currentTimeMs) {
    try {
      if (!this.transcript) {
        return { text: '', isActive: false, speaker: null };
      }

      if (typeof currentTimeMs !== 'number') {
        console.warn('CaptionService: Invalid currentTimeMs provided');
        return { text: '', isActive: false, speaker: null };
      }

      const clipRelativeTimeMs = currentTimeMs - this.clipStartMs;

      // Handle negative time (before clip starts)
      if (clipRelativeTimeMs < 0) {
        return { text: '', isActive: false, speaker: null };
      }

      // ENHANCED: Try utterance-based captions first with timing fixes
      if (this.transcript.utterances && this.transcript.utterances.length > 0) {
        const result = this.getCurrentUtterance(clipRelativeTimeMs);
        if (result.text) {
          return result;
        }
      }

      // ENHANCED: Fallback to word-based captions with timing fixes
      return this.getCurrentWords(clipRelativeTimeMs);

    } catch (error) {
      console.error('CaptionService: Error getting current caption:', error);
      return { text: '', isActive: false, speaker: null };
    }
  }

  // ENHANCED getCurrentUtterance with timing buffer fixes
  getCurrentUtterance(clipRelativeTimeMs) {
    if (!this.transcript?.utterances || this.transcript.utterances.length === 0) {
      return this.getCurrentWords(clipRelativeTimeMs); // Fallback
    }
    
    // Add lookahead time to current position
    const adjustedTimeMs = clipRelativeTimeMs + this.CAPTION_LOOKAHEAD_MS;
    
    // If we're at the very beginning (first 500ms), show first utterance
    if (clipRelativeTimeMs <= 500 && this.transcript.utterances.length > 0) {
      const rawText = this.normalizeTextCapitalization(this.transcript.utterances[0].text);
      const displayText = this.breakLongCaption(rawText);
      
      return {
        text: displayText,
        isActive: true,
        speaker: this.transcript.utterances[0].speaker
      };
    }
    
    // Find current utterance based on adjusted timing with linger
    const currentUtterance = this.transcript.utterances.find(utterance => 
      adjustedTimeMs >= utterance.startMs && 
      clipRelativeTimeMs <= (utterance.endMs + this.CAPTION_LINGER_MS)
    );
    
    if (currentUtterance) {
      const rawText = this.normalizeTextCapitalization(currentUtterance.text);
      const displayText = this.breakLongCaption(rawText); // Add this line
      
      return {
        text: displayText, // Use displayText instead of rawText
        isActive: true,
        speaker: currentUtterance.speaker
      };
    }
    
    // CRITICAL FIX: Check if we're near the end of clip and show last utterance
    const clipDurationMs = this.clipEndMs - this.clipStartMs;
    if (clipRelativeTimeMs > (clipDurationMs - 1000) && this.transcript.utterances.length > 0) {
      const lastUtterance = this.transcript.utterances[this.transcript.utterances.length - 1];
      const rawText = this.normalizeTextCapitalization(lastUtterance.text);
      const displayText = this.breakLongCaption(rawText);
      
      return {
        text: displayText,
        isActive: true,
        speaker: lastUtterance.speaker
      };
    }
    
    return { text: '', isActive: false, speaker: null };
  }

  // ENHANCED getCurrentWords with timing buffer
  getCurrentWords(clipRelativeTimeMs) {
    if (!this.transcript?.words || this.transcript.words.length === 0) {
      return { text: '', isActive: false, speaker: null };
    }
    
    // Add lookahead time to current position  
    const adjustedTimeMs = clipRelativeTimeMs + this.CAPTION_LOOKAHEAD_MS;
    
    // Find active words with timing buffer
    const activeWords = this.transcript.words.filter(word => 
      adjustedTimeMs >= word.startMs && 
      clipRelativeTimeMs <= (word.endMs + this.CAPTION_LINGER_MS)
    );
    
    if (activeWords.length > 0) {
      const rawText = activeWords.map(w => w.text).join(' ');
      const displayText = this.breakLongCaption(rawText);
      return { text: displayText, isActive: true, speaker: null };
    }
    
    // CRITICAL FIX: If no active words but we're near end of clip, show last few words
    const clipDurationMs = this.clipEndMs - this.clipStartMs;
    if (clipRelativeTimeMs > (clipDurationMs - 1000) && this.transcript.words.length > 0) {
      const lastWords = this.transcript.words.slice(-3); // Show last 3 words
      const rawText = lastWords.map(w => w.text).join(' ');
      const displayText = this.breakLongCaption(rawText);
      return { text: displayText, isActive: true, speaker: null };
    }
    
    // Look ahead for upcoming words if nothing is currently active
    const upcomingWords = this.transcript.words.filter(word => 
      word.startMs > clipRelativeTimeMs && 
      word.startMs <= (clipRelativeTimeMs + 1000) // Look 1 second ahead
    );
    
    if (upcomingWords.length > 0) {
      const rawText = upcomingWords.slice(0, 3).map(w => w.text).join(' ');
      const displayText = this.breakLongCaption(rawText);
      return { text: displayText, isActive: false, speaker: null };
    }
    
    return { text: '', isActive: false, speaker: null };
  }

  normalizeTextCapitalization(text) {
    if (!text) return text;

    // Split into sentences
    const sentences = text.split(/(?<=[.!?])\s+/);

    return sentences.map(sentence => {
      // Skip if empty
      if (!sentence.trim()) return sentence;

      // Check if it's a proper noun or should start with capital
      const firstWord = sentence.trim().split(' ')[0];
      const shouldCapitalize = 
        // Proper nouns (common ones)
        ['I', 'I\'m', 'I\'ll', 'I\'ve', 'I\'d'].includes(firstWord) ||
        // Names, places, etc.
        ['Yeah', 'Yes', 'No', 'Well', 'So', 'Now', 'Then', 'Here', 'There'].includes(firstWord) ||
        // If it's already capitalized and seems intentional
        firstWord[0] === firstWord[0].toUpperCase();

      if (shouldCapitalize) {
        return sentence;
      } else {
        // Lowercase the first letter
        return sentence.charAt(0).toLowerCase() + sentence.slice(1);
      }
    }).join(' ');
  }

  breakLongCaption(text, timingInfo) {
    if (!text || text.length <= this.MAX_CAPTION_LENGTH) {
      return text;
    }
    
    // Split by sentences first
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    if (sentences.length > 1) {
      let result = sentences[0];
      // Add second sentence if it fits
      if (sentences[1] && (result.length + sentences[1].length) <= this.MAX_CAPTION_LENGTH) {
        result += ' ' + sentences[1];
      }
      return result;
    }
    
    // Single long sentence - truncate at word boundary
    const words = text.split(' ');
    let result = '';
    for (const word of words) {
      const testLine = result + (result ? ' ' : '') + word;
      if (testLine.length > this.MAX_CAPTION_LENGTH) break;
      result = testLine;
    }
    
    return result + '...';
  }

  // NEW: Get timing debug information
  getTimingDebug(currentTimeMs) {
    if (!this.transcript) {
      return { error: 'No transcript loaded' };
    }

    const clipRelativeTimeMs = currentTimeMs - this.clipStartMs;
    const adjustedTimeMs = clipRelativeTimeMs + this.CAPTION_LOOKAHEAD_MS;

    return {
      currentTimeMs,
      clipRelativeTimeMs,
      adjustedTimeMs,
      lookaheadMs: this.CAPTION_LOOKAHEAD_MS,
      lingerMs: this.CAPTION_LINGER_MS,
      clipDuration: this.clipEndMs - this.clipStartMs,
      hasUtterances: !!this.transcript.utterances?.length,
      hasWords: !!this.transcript.words?.length,
      utteranceCount: this.transcript.utterances?.length || 0,
      wordCount: this.transcript.words?.length || 0
    };
  }

  // NEW: Set timing constants for fine-tuning
  setTimingConstants(lookaheadMs, lingerMs) {
    if (typeof lookaheadMs === 'number' && lookaheadMs >= 0) {
      this.CAPTION_LOOKAHEAD_MS = lookaheadMs;
    }
    if (typeof lingerMs === 'number' && lingerMs >= 0) {
      this.CAPTION_LINGER_MS = lingerMs;
    }

    if (this.debugMode) {
      console.log('🎬 CaptionService: Timing constants updated', {
        lookaheadMs: this.CAPTION_LOOKAHEAD_MS,
        lingerMs: this.CAPTION_LINGER_MS
      });
    }
  }

  reset() {
    this.transcript = null;
    this.clipStartMs = 0;
    this.clipEndMs = 0;

    if (this.debugMode) {
      console.log('🎬 CaptionService: Reset completed');
    }
  }

  getDebugInfo() {
    return {
      hasTranscript: !!this.transcript,
      wordCount: this.transcript?.words?.length || 0,
      utteranceCount: this.transcript?.utterances?.length || 0,
      clipStartMs: this.clipStartMs,
      clipEndMs: this.clipEndMs,
      clipDuration: this.clipEndMs - this.clipStartMs,
      debugMode: this.debugMode,
      lookaheadMs: this.CAPTION_LOOKAHEAD_MS,
      lingerMs: this.CAPTION_LINGER_MS,
      maxCaptionLength: this.MAX_CAPTION_LENGTH
    };
  }

  setDebugMode(enabled) {
    this.debugMode = enabled;
    console.log('🎬 CaptionService: Debug mode', enabled ? 'enabled' : 'disabled');
  }
}

// Export singleton instance
export const captionService = new EnhancedCaptionService();
