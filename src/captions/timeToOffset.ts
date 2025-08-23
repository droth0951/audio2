'use strict';

type Word = {
  text: string;
  startMs: number;  // inclusive
  endMs: number;    // exclusive
};

// Build line anchors for smooth interpolation
export function buildLineAnchors(words: Word[], yByWordIndex: number[], totalHeight: number) {
  const anchors: { timeMs: number; yTop: number }[] = [];
  let currentLineY = -1;
  
  for (let i = 0; i < words.length; i++) {
    const wordY = yByWordIndex[i] ?? 0;
    
    // If this word starts a new line, add an anchor
    if (wordY !== currentLineY) {
      anchors.push({
        timeMs: words[i].startMs,
        yTop: wordY
      });
      currentLineY = wordY;
    }
  }
  
  // Add final anchor at the last word's end
  if (words.length > 0) {
    const lastWord = words[words.length - 1];
    const lastLineY = yByWordIndex[words.length - 1] ?? 0;
    anchors.push({
      timeMs: lastWord.endMs,
      yTop: lastLineY
    });
  }
  
  // Add synthetic final anchor at last.endMs + 2000 and interpolate to it
  if (anchors.length > 0) {
    const lastAnchor = anchors[anchors.length - 1];
    anchors.push({
      timeMs: lastAnchor.timeMs + 2000, // 2 seconds after last word
      yTop: totalHeight // Scroll to full content height
    });
  }
  
  // Dedupe anchors: remove consecutive anchors with same time or same y
  const dedupedAnchors: { timeMs: number; yTop: number }[] = [];
  for (let i = 0; i < anchors.length; i++) {
    const current = anchors[i];
    const previous = dedupedAnchors[dedupedAnchors.length - 1];
    
    if (!previous || (current.timeMs !== previous.timeMs && current.yTop !== previous.yTop)) {
      dedupedAnchors.push(current);
    }
  }
  
  return dedupedAnchors;
}

// Precomputes arrays for fast mapping and exposes a worklet-safe function.
export function buildTimeToOffset(words: Word[], yByWordIndex: number[], totalHeight: number) {
  const anchors = buildLineAnchors(words, yByWordIndex, totalHeight);
  const n = anchors.length;
  const times = new Float64Array(n);
  const offsets = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    times[i] = anchors[i].timeMs;
    offsets[i] = anchors[i].yTop;
  }
  
  // Assert that times.length === offsets.length and times is strictly ascending
  console.assert(times.length === offsets.length, 'times and offsets must have same length');
  for (let i = 1; i < times.length; i++) {
    console.assert(times[i] > times[i - 1], `times must be strictly ascending: ${times[i - 1]} <= ${times[i]}`);
  }
  
  return { times, offsets };
}

export function makeTimeToOffsetFn(map: { times: Float64Array; offsets: Float64Array }) {
  'worklet';
  const { times, offsets } = map;
  return (tMs: number) => {
    'worklet';
    const n = times.length;
    
    // Return offsets[0] if t <= times[0]
    if (tMs <= times[0]) {
      return offsets[0];
    }
    
    // Return offsets[last] if t >= times[last]
    if (tMs >= times[n - 1]) {
      return offsets[n - 1];
    }
    
    // Binary search to find the interval
    let lo = 0, hi = n - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= tMs) lo = mid + 1; else hi = mid - 1;
    }
    
    // Use lo - 1 as left index
    const idx = lo - 1;
    const t1 = times[idx];
    const t2 = times[idx + 1];
    const y1 = offsets[idx];
    const y2 = offsets[idx + 1];
    
    if (t2 === t1) return y1;
    const progress = (tMs - t1) / (t2 - t1);
    return y1 + progress * (y2 - y1);
  };
}
