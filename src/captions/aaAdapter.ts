type AssemblyAIWord = {
  text: string;
  start: number; // in milliseconds
  end: number;   // in milliseconds
  confidence: number;
  speaker?: string;
};

type AssemblyAIUtterance = {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: string;
  words: AssemblyAIWord[];
};

type AssemblyAIResponse = {
  text: string;
  words?: AssemblyAIWord[];
  utterances?: AssemblyAIUtterance[];
};

type Word = {
  text: string;
  startMs: number;  // inclusive
  endMs: number;    // exclusive
};

type ParagraphBoundary = {
  startWordIdx: number;
  endWordIdx: number;
};

type Transcript = {
  words: Word[];
  paragraphs: ParagraphBoundary[];
  speaker?: string;
};

// Build words from AssemblyAI response, normalizing to clip timebase
export function buildWordsFromAssemblyAI(resp: AssemblyAIResponse, clipStartMs: number): Word[] {
  let words: AssemblyAIWord[] = [];
  
  // Extract words from either words array or utterances
  if (resp.words) {
    words = resp.words;
  } else if (resp.utterances) {
    // Flatten words from all utterances
    words = resp.utterances.flatMap(utterance => utterance.words);
  }
  
  if (!words.length) {
    return [];
  }
  
  // Normalize to clip timebase and filter non-speech tokens
  const normalizedWords: Word[] = [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Skip non-speech tokens (usually punctuation-only)
    if (word.text.trim().match(/^[^\w]*$/)) {
      continue;
    }
    
    // Normalize timing to clip timebase
    const startMs = word.start - clipStartMs;
    const endMs = word.end - clipStartMs;
    
    // Skip words outside the clip range
    if (startMs < 0 || endMs < 0) {
      continue;
    }
    
    normalizedWords.push({
      text: word.text,
      startMs,
      endMs,
    });
  }
  
  // Merge stray punctuation onto previous word
  const mergedWords: Word[] = [];
  
  for (let i = 0; i < normalizedWords.length; i++) {
    const current = normalizedWords[i];
    
    // Check if this is punctuation that should be merged
    if (current.text.match(/^[^\w]*$/) && mergedWords.length > 0) {
      // Merge punctuation onto previous word
      const prev = mergedWords[mergedWords.length - 1];
      prev.text += current.text;
      prev.endMs = Math.max(prev.endMs, current.endMs);
    } else {
      mergedWords.push({ ...current });
    }
  }
  
  // Collapse hyphenated/split tokens
  const collapsedWords: Word[] = [];
  
  for (let i = 0; i < mergedWords.length; i++) {
    const current = mergedWords[i];
    
    // Check if this is a hyphen or split token
    if (current.text === '-' || current.text === '—' || current.text === '–') {
      if (collapsedWords.length > 0 && i + 1 < mergedWords.length) {
        // Merge with previous and next word
        const prev = collapsedWords[collapsedWords.length - 1];
        const next = mergedWords[i + 1];
        
        prev.text = prev.text.replace(/[-—–]$/, '') + next.text;
        prev.endMs = Math.max(prev.endMs, next.endMs);
        
        // Skip the next word since we merged it
        i++;
      }
    } else {
      collapsedWords.push({ ...current });
    }
  }
  
  return collapsedWords;
}

// Build paragraph boundaries from AssemblyAI utterances
function buildParagraphsFromUtterances(utterances: any[], words: Word[], clipStartMs: number): ParagraphBoundary[] {
  const boundaries: ParagraphBoundary[] = [];
  
  // Find which words belong to which utterances
  for (let utteranceIdx = 0; utteranceIdx < utterances.length; utteranceIdx++) {
    const utterance = utterances[utteranceIdx];
    const utteranceStartMs = utterance.start - clipStartMs;
    const utteranceEndMs = utterance.end - clipStartMs;
    
    // Find the first word that starts after this utterance begins
    let startWordIdx = words.findIndex(word => word.startMs >= utteranceStartMs);
    if (startWordIdx === -1) startWordIdx = words.length;
    
    // Find the last word that ends before this utterance ends
    let endWordIdx = words.findIndex(word => word.endMs > utteranceEndMs);
    if (endWordIdx === -1) endWordIdx = words.length;
    else endWordIdx = Math.max(0, endWordIdx - 1);
    
    // Add boundary if this utterance has words
    if (startWordIdx < endWordIdx) {
      boundaries.push({
        startWordIdx,
        endWordIdx,
      });
    }
  }
  
  return boundaries;
}

// Detect paragraph boundaries from words
export function detectParagraphs(words: Word[]): ParagraphBoundary[] {
  const boundaries: ParagraphBoundary[] = [];
  
  for (let i = 1; i < words.length; i++) {
    const prevWord = words[i - 1];
    const currWord = words[i];
    const gap = currWord.startMs - prevWord.endMs;
    
    // Check for paragraph break conditions
    const endsWithPunctuation = prevWord.text.match(/[.?!]["')\]]*$/);
    const longGap = gap >= 1000;
    const shortGapWithPunctuation = gap >= 600 && endsWithPunctuation;
    
    if (shortGapWithPunctuation || longGap) {
      boundaries.push({
        startWordIdx: i,
        endWordIdx: i - 1,
      });
    }
  }
  
  return boundaries;
}

// Convert AssemblyAI response to our transcript format
export function toTranscript(resp: AssemblyAIResponse, options: {
  clipStartMs: number;
  clipEndMs: number;
  useUtterances?: boolean;
}): Transcript {
  const { clipStartMs, clipEndMs, useUtterances = true } = options;
  
  // Log the raw response shape once
  console.log('[AAI]', { hasWords: !!resp.words?.length, keys: Object.keys(resp) });
  
  const dur = clipEndMs - clipStartMs;

  // AAI uses ms for word times (fields: start, end). Coerce + clamp.
  const words: Word[] = (resp.words ?? [])
    .map((w: any) => ({
      text: String(w.text ?? '').trim(),
      startMs: Number(w.start) - clipStartMs,
      endMs: Number(w.end) - clipStartMs,
    }))
    .filter(w =>
      Number.isFinite(w.startMs) &&
      Number.isFinite(w.endMs) &&
      w.endMs > 0 && w.startMs < dur &&
      w.text.length > 0
    )
    .map(w => ({
      ...w,
      // Clamp to [0, dur]
      startMs: Math.max(0, Math.min(dur, w.startMs)),
      endMs: Math.max(0, Math.min(dur, w.endMs)),
    }));

  // Add sanity logs
  console.log('[cap] firstWord:', words[0]);
  if (!words.length) {
    console.warn('[cap] No valid words after normalization');
  } else {
    const startMsValues = words.map(w => w.startMs);
    const endMsValues = words.map(w => w.endMs);
    console.log('[cap] After adapter: words.length=', words.length, 
      'min/max startMs:', Math.min(...startMsValues), '/', Math.max(...startMsValues),
      'min/max endMs:', Math.min(...endMsValues), '/', Math.max(...endMsValues));
  }
  
  // Use utterances for paragraph breaks if available and requested
  let paragraphs: ParagraphBoundary[];
  if (useUtterances && resp.utterances?.length) {
    paragraphs = buildParagraphsFromUtterances(resp.utterances, words, clipStartMs);
  } else {
    paragraphs = detectParagraphs(words);
  }
  
  return {
    words,
    paragraphs,
    speaker: resp.utterances?.[0]?.speaker,
  };
}
