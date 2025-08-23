export { CaptionScroller } from './CaptionScroller';
export type { CaptionScrollerRef } from './CaptionScroller';
export { useTranscriptLayout } from './useTranscriptLayout';
export { buildTimeToOffset, makeTimeToOffsetFn } from './timeToOffset';

// Types
export type Word = {
  text: string;
  startMs: number;  // inclusive
  endMs: number;    // exclusive
};

export type Transcript = {
  words: Word[];             // contiguous, sorted by startMs
  speaker?: string;          // optional
};

export type CaptionTheme = {
  fontFamily: string;
  fontSize: number;          // dp
  lineHeight: number;        // dp
  maxWidthDp: number;        // wrapping width for caption block
  highlightColor?: string;   // optional later
  textColor: string;
  paragraphSpacingDp: number;
};
