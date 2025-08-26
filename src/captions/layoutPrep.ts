import { measureTranscript } from './measure/measureTranscript';
import type { Transcript, CaptionTheme } from './index';

export async function precomputeCaptionLayout(
  transcript: Transcript,
  theme: CaptionTheme
) {
  console.log('[layout] Precomputing layout for', transcript.words.length, 'words');
  
  // Guard against width=0
  const safeMaxWidth = theme.maxWidthDp && theme.maxWidthDp > 0 ? theme.maxWidthDp : 320;
  const widthUsed = Math.min(safeMaxWidth, 360);
  
  const adjustedTheme = {
    ...theme,
    maxWidthDp: widthUsed
  };
  
  console.log('[layout] Using width:', widthUsed, 'original:', theme.maxWidthDp);
  
  try {
    const result = await measureTranscript(transcript, adjustedTheme);
    
    console.log('[layout] Precompute result:', {
      words: transcript.words.length,
      maxWidthDp: widthUsed,
      lines: result.lines.length,
      totalH: result.totalH
    });
    
    return result;
  } catch (error) {
    console.error('[layout] Precompute failed:', error);
    
    // Fallback to simple one-word-per-line layout
    const fallbackData = {
      lines: transcript.words.map((w, i) => ({ 
        text: w.text, 
        startWordIdx: i, 
        endWordIdx: i 
      })),
      itemHeights: transcript.words.map(() => theme.lineHeight),
      yByWordIndex: transcript.words.map((_, i) => i * theme.lineHeight),
      totalH: transcript.words.length * theme.lineHeight,
    };
    
    console.log('[layout] Using fallback layout:', {
      lines: fallbackData.lines.length,
      totalH: fallbackData.totalH
    });
    
    return fallbackData;
  }
}
