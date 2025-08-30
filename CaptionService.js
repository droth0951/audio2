// CaptionService.js - Robust caption system that stays reliable
class CaptionService {
  constructor() {
    this.transcript = null;
    this.clipStartMs = 0;
    this.clipEndMs = 0;
    this.debugMode = false;
  }

  setTranscript(transcript, clipStartMs, clipEndMs) {
    // Validate input
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

      // Try utterance-based captions first (more natural)
      if (this.transcript.utterances && this.transcript.utterances.length > 0) {
        const result = this.getCurrentUtterance(clipRelativeTimeMs);
        if (result.text) {
          return result;
        }
      }

      // Fallback to word-based captions
      return this.getCurrentWords(clipRelativeTimeMs);

    } catch (error) {
      console.error('CaptionService: Error getting current caption:', error);
      return { text: '', isActive: false, speaker: null };
    }
  }

  getCurrentUtterance(clipRelativeTimeMs) {
    // Show first utterance if we're at the very beginning
    if (clipRelativeTimeMs <= 500 && this.transcript.utterances.length > 0) {
      const firstUtterance = this.transcript.utterances[0];
      return {
        text: this.normalizeTextCapitalization(firstUtterance.text),
        isActive: true,
        speaker: firstUtterance.speaker
      };
    }

    // Find current utterance based on timing
    const currentUtterance = this.transcript.utterances.find(utterance => 
      clipRelativeTimeMs >= utterance.startMs && 
      clipRelativeTimeMs <= utterance.endMs
    );

    if (currentUtterance) {
      return {
        text: this.normalizeTextCapitalization(currentUtterance.text),
        isActive: true,
        speaker: currentUtterance.speaker
      };
    }

    return { text: '', isActive: false, speaker: null };
  }

  getCurrentWords(clipRelativeTimeMs) {
    if (!this.transcript.words || this.transcript.words.length === 0) {
      return { text: '', isActive: false, speaker: null };
    }

    // Find the current word being spoken
    const currentWord = this.transcript.words.find(word => 
      clipRelativeTimeMs >= word.startMs && 
      clipRelativeTimeMs <= word.endMs
    );

    if (!currentWord) {
      // If no current word, find the next word to come
      const nextWord = this.transcript.words.find(word => word.startMs > clipRelativeTimeMs);
      if (nextWord) {
        return { text: nextWord.text, isActive: false, speaker: null };
      }
      return { text: '', isActive: false, speaker: null };
    }

    // Show current word plus next 2 words for context
    const currentIndex = this.transcript.words.indexOf(currentWord);
    const wordsToShow = this.transcript.words.slice(currentIndex, currentIndex + 3);
    const text = wordsToShow.map(w => w.text).join(' ');

    return { text, isActive: true, speaker: null };
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
      debugMode: this.debugMode
    };
  }

  setDebugMode(enabled) {
    this.debugMode = enabled;
    console.log('🎬 CaptionService: Debug mode', enabled ? 'enabled' : 'disabled');
  }
}

// Export singleton instance
export const captionService = new CaptionService();
