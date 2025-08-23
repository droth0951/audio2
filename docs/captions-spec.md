TikTok-Style Captions: Smooth, Native-Speed Scrolling

Artifact type: PRD + Tech Spec + Task Graph + Code Skeleton
Target stack: React Native (Expo dev build), iOS-first, Reanimated 3, FlashList
Audio2 context: ReplayKit screen recording; AssemblyAI word-timestamps; single-file app allowed

0) One-screen summary (use this in the repo README)

Outcome
A continuously scrolling transcript that glides like a teleprompter and stays synced to audio while screen recording—no popping, fading, or per-tick React work.

Strategy
Precompute layout and a monotonic, piecewise-linear mapping t → y once. At runtime, drive only scrollY from a UI-thread worklet. No .find(). No re-renders. Guard for bounds, center the active line, and add top/bottom padding plus a short “tail” so motion never clamps early.

Budgets

60fps target (≥30fps while iOS screen recording).

≤2 layout/measure passes before playback; gate playback until ready.

0 React commits per frame (≤1 per second incidental).

Jank spikes (>16.7ms) ≤ 1 per 10s.

Memory OK for 10-min transcripts with FlashList buffering (no pop-in).

1) User story & acceptance criteria

As a creator clipping podcasts
I want captions that glide upward like a teleprompter
So that my screen-recorded posts look Apple-smooth.

Accept when

Transcript is one continuous scroll; no chunk pops or fade/scale swaps.

Sync stays within ±60ms to the spoken word across the clip.

Scrubbing/seeking snaps text to the correct position immediately, then resumes smooth motion.

Screen recording introduces no visible stutter in the captions.

Long clips (10+ minutes / 5k+ words) remain smooth with FlashList (large buffer, no pop-in).

2) Non-goals (v1)

Per-word color “karaoke” highlight (can be layered later using the same mapping).

Decorative fades/scales for caption chunks.

React state updates on every tick.

3) Data contract (input)
type Word = {
  text: string;
  startMs: number;  // inclusive
  endMs: number;    // exclusive
};

type Transcript = {
  words: Word[];            // contiguous, sorted by startMs
  speaker?: string;
};

type CaptionTheme = {
  fontFamily: string;
  fontSize: number;         // dp
  lineHeight: number;       // dp
  maxWidthDp: number;       // wrapping width inside the caption card
  paragraphSpacingDp: number;
  textColor: string;
  highlightColor?: string;  // reserved for v2 karaoke
};

4) Architecture (how we remove jank)
4.1 Precompute once (before playback)

Text layout (deterministic)

Use react-native-text-size (RNTS) to measure word widths with the real font, fontSize, and maxWidthDp.

Greedy wrap into centered lines; produce:

lines: Array<{ text, startWordIdx, endWordIdx }>

itemHeights: number[] (usually all lineHeight)

yByWordIndex: number[] mapping each word → line yTop

totalH: number (sum of item heights)

Cache by (fontKey, maxWidth, lineHeight, textHash).

Time → offset mapping (line-anchor interpolation)

Create anchors at first word of each new line → arrays times[], offsets[].

Interpolate linearly within each interval; guard:

t <= times[0] → offsets[0]

t >= times[last] → offsets[last]

Store as Float64Array for worklet-friendly lookup with binary search (lo-1 left index).

Tail: append a synthetic final time (last.endMs + 2000ms) so motion eases to the bottom, not clamp early.

4.2 Runtime (playback driver)

Source of truth: current media time from the player (Audio2 can keep expo-av for now; plan to migrate to expo-audio when convenient).

Driver: Reanimated frame callback on UI thread:

yRaw = map(t) (interpolated anchors)

target = baseOffset + yRaw where baseOffset = padTop - (viewportH/2 - lineHeight/2)

Clamp to [0, contentH - viewportH]

scrollTo(listRef, 0, target, false)

Padding: padTop = 0.5*viewportH, padBottom = padTop + 0.5*viewportH (asymmetric bottom for end-glide).

Start gating: Don’t enable Play until fonts loaded, viewport measured, measurement finished.

4.3 Virtualization (only if needed)

Use FlashList with:

estimatedItemSize = lineHeight

drawDistance = 3 * viewportH

removeClippedSubviews = false

generous initialNumToRender (or all lines during testing)

getItemLayout prefilled from itemHeights/prefix sums.

renderItem memoized; no per-tick re-renders.

Optional later (polish): Blend constant-velocity with the mapped offset (e.g., target = 0.75 * yConst + 0.25 * yMap) plus a tiny drift corrector. Not required for v1 if measurement and anchors are correct.

5) Implementation plan (ordered)

Milestone A — Skeleton & budgets (½ day)

CaptionScroller with manual slider → scrollY.

FPS/Jank banner; budget guardrails.

Milestone B — Exact measurement (1–2 days)

measureTranscript() using RNTS; return { lines, itemHeights, yByWordIndex, totalH }.

Cache results; warm glyph cache with hidden <Text>.

Milestone C — Mapping (½ day)

buildLineAnchors() from yByWordIndex.

makeInterpolatedMapper() with guards and binary search (lo-1).

Add tail anchor.

Milestone D — Native-thread driver (1 day)

Frame callback reads time (no JS round-trip per frame).

Base centering + padding + clamp; log yRaw, target, maxScroll, padTop, padBottom.

Milestone E — Scrub/seek polish (½ day)

On seek, set time → scrollTo(listRef, 0, map(t), false) immediately; resume frame driver next tick.

Milestone F — Screen-record hardening (½–1 day)

Keep all lines mounted while testing; then re-enable FlashList with buffers.

Font preload; disable font scaling; optional rasterization once stable.

6) Code skeleton (kept minimal; RNTS plugs in)

CaptionScroller.tsx

Uses useTranscriptLayout(transcript, theme) (real RNTS implementation).

Builds anchors → mapFn.

Computes baseOffset, padTop, padBottom, contentH.

Frame callback → yRaw → target (center + padding + clamp) → scrollTo.

FlashList with memoized renderItem, getItemLayout, removeClippedSubviews=false.

measureTranscript.ts (RNTS)

Measure word widths (+ trailing space width).

Greedy wrap to maxWidthDp; fill outputs.

Returns stable results independent of runtime FPS.

timeToOffset.ts

buildLineAnchors(words, yByWordIndex, tailMs=2000)

makeInterpolatedMapper({times, offsets}) with first/last guards and lo-1 left index.

7) Cursor “recipes” (copy/paste tasks)

Add measurer

Implement measureTranscript() using react-native-text-size to return { lines, itemHeights, yByWordIndex, totalH }. Cache by (fontKey, maxWidth, lineHeight, textHash). Preload font; render hidden Text to warm glyphs.

Wire scroller

Use measured output in CaptionScroller. Compute padTop=0.5*viewportH, padBottom=padTop+0.5*viewportH, baseOffset=padTop-(viewportH/2-lineHeight/2). Clamp to [0, contentH-viewportH]. Gate Play until measurement ready.

Mapper with guards

Build line anchors (first word each line) + tail. Implement makeInterpolatedMapper with: t<=first → first, t>=last → last, binary search then lo-1 interval; return interpolated offset.

Debug HUD

Log t, yRaw, target, maxScroll, clampedTop/Bottom, i, t0→t1, o0→o1, slopePx/s, and mount values (viewportW/H, padTop/Bottom, contentH, lines.length).

FlashList tuning

After smoothness confirmed: estimatedItemSize=lineHeight, drawDistance=3*viewportH, initialNumToRender=Math.min(lines.length,120), removeClippedSubviews=false.

8) Visual & polish checklist

Caption text centered; container has overflow:'hidden'.

Sub-pixel offsets permitted (don’t round); optional shouldRasterizeIOS once static.

Only transcript moves; title/artwork/progress stay static.

Tiny ease (20–40ms) on play/pause toggle.

9) Test plan

Unit

Layout mapping returns monotonic y.

Mapper monotonic; exact equality at anchor boundaries.

Guards return first/last offsets correctly.

Integration (device)

15s / 60s / 10-min clips at 1×/1.25×/1.5×.

Seek 00:10 → 01:30 → 00:05; no visual jump; resumes glide.

With screen recording on: avg frametime ≤ 33ms; no bursts > 3/min.

Edge cases

Very long words; emoji; right-to-left scripts (grapheme handling via RNTS).

Font swap disabled; fonts preloaded.

10) Rollout & observability

CAPTION_DRIVER=v2 flag for the new pipeline.

Log per session: dropped frames, avg frametime, max drift (dp), clamp hits.

Optional analytics in prod; console logs in dev.

11) Security & platform notes (Audio2-specific)

AssemblyAI key must be moved to backend or EAS Secret (don’t ship raw key).

expo-av shows a deprecation warning in SDK 53; plan to migrate to expo-audio when convenient, but the caption driver is player-agnostic as long as we can read current time without JS thrash.

ReplayKit screen recording requires a dev build; simulator won’t record.

Why this will be “buttery”

Layout + mapping fully precomputed; no JS work per frame.

Single animated number (scrollY) driven on the native thread.

Centering + padding + tail remove early/late clamps.

FlashList overdraw prevents pop-in; measured getItemLayout prevents layout thrash.