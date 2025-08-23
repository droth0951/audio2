import TextSize from 'react-native-text-size';

type Word = {
  text: string;
  startMs: number;
  endMs: number;
};

type Transcript = {
  words: Word[];
  speaker?: string;
};

type CaptionTheme = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  maxWidthDp: number;
  highlightColor?: string;
  textColor: string;
  paragraphSpacingDp: number;
};

type Line = {
  text: string;
  startWordIdx: number;
  endWordIdx: number;
  paragraphStart: boolean;
};

type LayoutResult = {
  lines: Line[];
  itemHeights: number[];
  yByWordIndex: number[];
  totalH: number;
};

type ParagraphBoundary = {
  startWordIdx: number;
  endWordIdx: number;
};

// Cache for layout results
const layoutCache = new Map<string, LayoutResult>();

// Create a simple hash for caching based on theme and text content
function createCacheKey(theme: CaptionTheme, words: Word[]): string {
  const themeKey = `${theme.fontFamily}-${theme.fontSize}-normal-${theme.maxWidthDp}-${theme.lineHeight}`;
  const textContent = words.map(w => w.text).join(' ');
  
  // Simple hash function for React Native
  let hash = 0;
  for (let i = 0; i < textContent.length; i++) {
    const char = textContent.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `${themeKey}-${Math.abs(hash).toString(16)}`;
}

// Measure a single word's width
async function measureWordWidth(word: string, theme: CaptionTheme): Promise<number> {
  const textSpec = {
    text: word,
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    fontWeight: 'normal' as const,
    fontStyle: 'normal' as const,
    allowFontScaling: false,
  };
  
  try {
    const measuredSize = await TextSize.measure(textSpec);
    return measuredSize.width;
  } catch (error) {
    // Fallback to estimation if measurement fails
    return word.length * theme.fontSize * 0.6;
  }
}

// Measure a line of text (words joined with spaces)
async function measureLineWidth(words: string[], theme: CaptionTheme): Promise<number> {
  if (words.length === 0) return 0;
  
  const lineText = words.join(' ');
  const textSpec = {
    text: lineText,
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    fontWeight: 'normal' as const,
    fontStyle: 'normal' as const,
    allowFontScaling: false,
  };
  
  try {
    const measuredSize = await TextSize.measure(textSpec);
    return measuredSize.width;
  } catch (error) {
    // Fallback to estimation if measurement fails
    return lineText.length * theme.fontSize * 0.6;
  }
}

// Precompute word widths for efficiency
async function precomputeWordWidths(words: Word[], theme: CaptionTheme): Promise<number[]> {
  const widths: number[] = [];
  
  for (const word of words) {
    const width = await measureWordWidth(word.text, theme);
    widths.push(width);
  }
  
  return widths;
}

// Synthesize paragraph boundaries if not provided
export function synthesizeParagraphBoundaries(words: Word[]): ParagraphBoundary[] {
  const boundaries: ParagraphBoundary[] = [];
  
  for (let i = 1; i < words.length; i++) {
    const prevWord = words[i - 1];
    const currWord = words[i];
    const gap = currWord.startMs - prevWord.endMs;
    
    // Check for paragraph break conditions
    const endsWithPunctuation = /[.!?]$/.test(prevWord.text.trim());
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

// Greedy line wrapping algorithm with paragraph breaks
function wrapWordsIntoLines(
  words: Word[], 
  wordWidths: number[], 
  theme: CaptionTheme,
  paragraphs?: ParagraphBoundary[]
): Line[] {
  const lines: Line[] = [];
  let currentLine: string[] = [];
  let currentWidth = 0;
  let startWordIdx = 0;
  
  // Synthesize boundaries if not provided
  const boundaries = paragraphs || synthesizeParagraphBoundaries(words);
  const boundarySet = new Set(boundaries.map(b => b.startWordIdx));
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordWidth = wordWidths[i];
    const spaceWidth = currentLine.length > 0 ? theme.fontSize * 0.3 : 0;
    
    // Check if this word starts a new paragraph
    const isParagraphStart = boundarySet.has(i);
    
    // If paragraph start and we have a current line, commit it
    if (isParagraphStart && currentLine.length > 0) {
      lines.push({
        text: currentLine.join(' '),
        startWordIdx,
        endWordIdx: i - 1,
        paragraphStart: false,
      });
      
      // Start new line
      currentLine = [word.text];
      currentWidth = wordWidth;
      startWordIdx = i;
    } else if (currentWidth + spaceWidth + wordWidth > theme.maxWidthDp && currentLine.length > 0) {
      // Current line is full, create a new line
      lines.push({
        text: currentLine.join(' '),
        startWordIdx,
        endWordIdx: i - 1,
        paragraphStart: false,
      });
      
      // Start new line with current word
      currentLine = [word.text];
      currentWidth = wordWidth;
      startWordIdx = i;
    } else {
      // Add word to current line
      currentLine.push(word.text);
      currentWidth += spaceWidth + wordWidth;
    }
  }
  
  // Handle the last line
  if (currentLine.length > 0) {
    lines.push({
      text: currentLine.join(' '),
      startWordIdx,
      endWordIdx: words.length - 1,
      paragraphStart: false,
    });
  }
  
  // Mark first line of each paragraph as paragraphStart
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFirstLineOfParagraph = i === 0 || 
      (line.startWordIdx > 0 && boundarySet.has(line.startWordIdx));
    line.paragraphStart = isFirstLineOfParagraph;
  }
  
  return lines;
}

// Main measurement function
export async function measureTranscript(
  transcript: Transcript, 
  theme: CaptionTheme,
  paragraphs?: ParagraphBoundary[]
): Promise<LayoutResult> {
  const cacheKey = createCacheKey(theme, transcript.words);
  
  // Check cache first
  if (layoutCache.has(cacheKey)) {
    return layoutCache.get(cacheKey)!;
  }
  
  // Precompute word widths
  const wordWidths = await precomputeWordWidths(transcript.words, theme);
  
  // Wrap words into lines
  const lines = wrapWordsIntoLines(transcript.words, wordWidths, theme, paragraphs);
  
  // Calculate item heights and yByWordIndex with paragraph spacing
  const itemHeights: number[] = [];
  const yByWordIndex: number[] = new Array(transcript.words.length);
  let currentY = 0;
  
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineY = currentY;
    
    // Add paragraph spacing before this line if it's a paragraph start
    if (line.paragraphStart && lineIdx > 0) {
      currentY += theme.paragraphSpacingDp;
    }
    
    // Assign this Y position to all words in this line
    for (let wordIdx = line.startWordIdx; wordIdx <= line.endWordIdx; wordIdx++) {
      yByWordIndex[wordIdx] = currentY;
    }
    
    // Add line height
    itemHeights.push(theme.lineHeight);
    currentY += theme.lineHeight;
  }
  
  // Calculate total height
  const totalH = currentY;
  
  const result: LayoutResult = {
    lines,
    itemHeights,
    yByWordIndex,
    totalH,
  };
  
  // Cache the result
  layoutCache.set(cacheKey, result);
  
  return result;
}

// Clear cache (useful for testing or memory management)
export function clearLayoutCache(): void {
  layoutCache.clear();
}

// Get cache size (useful for debugging)
export function getCacheSize(): number {
  return layoutCache.size;
}
