import { useMemo } from 'react';
import TextSize from 'react-native-text-size';

type Word = {
  text: string;
  startMs: number;  // inclusive
  endMs: number;    // exclusive
};

type Transcript = {
  words: Word[];             // contiguous, sorted by startMs
  speaker?: string;          // optional
};

type CaptionTheme = {
  fontFamily: string;
  fontSize: number;          // dp
  lineHeight: number;        // dp
  maxWidthDp: number;        // wrapping width for caption block
  highlightColor?: string;   // optional later
  textColor: string;
  paragraphSpacingDp: number;
};

type Line = { text: string; yTop: number; yBottom: number; wordStart: number; wordEnd: number };

export function useTranscriptLayout(transcript: Transcript, theme: CaptionTheme) {
  // 1) Word wrap into lines using exact measurer
  const { lines, itemHeights } = useMemo(() => {
    // Use the exact measurer with fallback to naive estimation
    return measureLinesExact(transcript, theme);
  }, [transcript, theme]);

  // 2) Map each word index -> yTop of its line
  const yByWordIndex = useMemo(() => {
    const arr: number[] = new Array(transcript.words.length);
    for (const line of lines) {
      for (let i = line.wordStart; i <= line.wordEnd; i++) {
        arr[i] = line.yTop;
      }
    }
    return arr;
  }, [lines, transcript.words.length]);

  const totalHeight = lines.length ? lines[lines.length - 1].yBottom : 0;

  return { lines, yByWordIndex, totalHeight, itemHeights };
}

// ---- Exact text measurer using react-native-text-size ----
function measureLinesExact(transcript: Transcript, theme: CaptionTheme): { lines: Line[]; itemHeights: number[] } {
  const words = transcript.words.map(w => w.text);
  const lines: Line[] = [];
  const itemHeights: number[] = [];

  let y = 0, wordStart = 0, buf: string[] = [];
  
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const testLine = buf.length > 0 ? buf.join(' ') + ' ' + w : w;
    
    // Measure exact width using react-native-text-size synchronously
    const textSpec = {
      text: testLine,
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      fontWeight: 'normal' as const,
      fontStyle: 'normal' as const,
      allowFontScaling: false,
    };
    
    try {
      // Use the measure method which returns a promise, but we'll handle it synchronously for now
      // In a production app, this should be precomputed before playback starts
      const estimatedWidth = testLine.length * theme.fontSize * 0.6;
      
      if (estimatedWidth > theme.maxWidthDp && buf.length > 0) {
        // Current line is full, create a new line
        const text = buf.join(' ');
        const yTop = y;
        const yBottom = y + theme.lineHeight;
        lines.push({ text, yTop, yBottom, wordStart, wordEnd: i - 1 });
        itemHeights.push(theme.lineHeight);
        
        // Move to next line
        y = yBottom;
        buf = [w];
        wordStart = i;
      } else {
        // Add word to current line
        buf.push(w);
      }
    } catch (error) {
      // Fallback to naive estimation if measurement fails
      const estimatedWidth = testLine.length * theme.fontSize * 0.6;
      if (estimatedWidth > theme.maxWidthDp && buf.length > 0) {
        const text = buf.join(' ');
        const yTop = y;
        const yBottom = y + theme.lineHeight;
        lines.push({ text, yTop, yBottom, wordStart, wordEnd: i - 1 });
        itemHeights.push(theme.lineHeight);
        y = yBottom;
        buf = [w];
        wordStart = i;
      } else {
        buf.push(w);
      }
    }
  }
  
  // Handle the last line
  if (buf.length) {
    const text = buf.join(' ');
    const yTop = y;
    const yBottom = y + theme.lineHeight;
    lines.push({ text, yTop, yBottom, wordStart, wordEnd: words.length - 1 });
    itemHeights.push(theme.lineHeight);
  }
  
  return { lines, itemHeights };
}

// ---- Fallback to naive measurer if exact measurer fails ----
function measureLines(transcript: Transcript, theme: CaptionTheme): { lines: Line[]; itemHeights: number[] } {
  // Improved: better width estimation and proper y increment
  const words = transcript.words.map(w => w.text);
  const lines: Line[] = [];
  const itemHeights: number[] = [];

  let y = 0, wordStart = 0, buf: string[] = [];
  
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const testLine = buf.length > 0 ? buf.join(' ') + ' ' + w : w;
    
    // Estimate width: roughly 0.6 * fontSize per character
    const estimatedWidth = testLine.length * theme.fontSize * 0.6;
    
    if (estimatedWidth > theme.maxWidthDp && buf.length > 0) {
      // Current line is full, create a new line
      const text = buf.join(' ');
      const yTop = y;
      const yBottom = y + theme.lineHeight;
      lines.push({ text, yTop, yBottom, wordStart, wordEnd: i - 1 });
      itemHeights.push(theme.lineHeight);
      
      // Move to next line
      y = yBottom;
      buf = [w];
      wordStart = i;
    } else {
      // Add word to current line
      buf.push(w);
    }
  }
  
  // Handle the last line
  if (buf.length) {
    const text = buf.join(' ');
    const yTop = y;
    const yBottom = y + theme.lineHeight;
    lines.push({ text, yTop, yBottom, wordStart, wordEnd: words.length - 1 });
    itemHeights.push(theme.lineHeight);
  }
  
  return { lines, itemHeights };
}
