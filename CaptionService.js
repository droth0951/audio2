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

    // Check if utterances are already normalized (from App.js)
    if (response.utterances[0]?.startMs !== undefined) {
      // Already normalized in App.js - use directly
      return response.utterances;
    }
    
    // Legacy: Handle raw AssemblyAI format
    return response.utterances.map(utterance => {
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
        // For long utterances, advance through text chunks based on time position
        const utteranceDuration = currentUtterance.endMs - currentUtterance.startMs;
        const timeIntoUtterance = relativeTimeMs - currentUtterance.startMs;
        const progressRatio = timeIntoUtterance / utteranceDuration;
        
        const displayText = this.getProgressiveText(currentUtterance.text, progressRatio);
        
        // Debug long utterances every few seconds
        if (currentUtterance.text.length > 120 && relativeTimeMs % 3000 < 100) {
          console.log('[CaptionService] Progressive text debug:', {
            utteranceDuration: `${Math.round(utteranceDuration/1000)}s`,
            timeIntoUtterance: `${Math.round(timeIntoUtterance/1000)}s`,
            progressRatio: Math.round(progressRatio * 100) + '%',
            fullTextLength: currentUtterance.text.length,
            displayTextPreview: displayText.substring(0, 50) + '...'
          });
        }
        
        return {
          text: displayText,
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
      
      return {
        text: this.normalizeText(closestUtterance.text),
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
    
    // If text is short enough, just return it normally
    if (normalizedText.length <= MAX_CHARS) {
      return this.finalizeText(normalizedText);
    }
    
    // Break long text into chunks
    const chunks = this.breakIntoChunks(normalizedText, MAX_CHARS);
    
    // Determine which chunk to show based on progress
    const chunkIndex = Math.min(
      Math.floor(progressRatio * chunks.length),
      chunks.length - 1
    );
    
    return this.finalizeText(chunks[chunkIndex]);
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
    
    // Ensure first letter is capitalized
    const finalText = text.charAt(0).toUpperCase() + text.slice(1);
    
    return finalText;
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
