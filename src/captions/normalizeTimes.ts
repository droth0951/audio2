export function buildTimes(episodeStartMs: number, clipStartMs: number, clipEndMs: number) {
  const clipStartMsAbs = Math.round(clipStartMs); // already ms
  const clipEndMsAbs   = Math.round(clipEndMs);   // already ms

  if (clipEndMsAbs <= clipStartMsAbs) {
    throw new Error('Invalid clip: end <= start');
  }
  const clipDur = clipEndMsAbs - clipStartMsAbs;

  // Guards: catch epoch-like values accidentally passed in
  if (clipStartMsAbs > 3_600_000 * 6) { // > 6 hours
    console.warn('[captions] Suspicious clipStartMsAbs:', clipStartMsAbs);
  }
  
  console.log('[captions] AAI window(ms):', clipStartMsAbs, '→', clipEndMsAbs, 'dur=', clipDur);
  
  return {
    aaiStartMs: clipStartMsAbs,         // send to AAI as audio_start_from
    aaiEndMs: clipEndMsAbs,             // send to AAI as audio_end_at
    scrollBaseOffsetMs: 0,              // scroller is 0..clipDur
    clipDurationMs: clipDur,
  };
}
