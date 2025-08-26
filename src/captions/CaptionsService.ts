import { toTranscript } from './aaAdapter';
import { measureTranscript } from './measure/measureTranscript';
import { buildLineAnchors } from './timeToOffset';
import { 
  createCacheKey, 
  createThemeFingerprint, 
  cacheLayout, 
  getCachedLayout 
} from './CaptionCache';

type CaptionTheme = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  maxWidthDp: number;
  textColor: string;
  paragraphSpacingDp: number;
};

type TranscriptRequest = {
  episodeId: string;
  audioUrl: string;
  clipStartMs: number;
  clipEndMs: number;
};

type TranscriptResponse = {
  transcriptId: string;
};

type TranscriptStatus = {
  status: 'queued' | 'processing' | 'completed' | 'error';
  transcript?: any; // AssemblyAI response
  error?: string;
};

type LayoutResult = {
  words: any[];
  paragraphs: any[];
  lines: any[];
  yByWordIndex: number[];
  totalH: number;
  anchors: {
    times: number[];
    offsets: number[];
  };
};

// Configuration
// Get the API base URL from app.json configuration with validation
import { getProxyBase, requestTranscriptAPI, pollTranscriptAPI } from './api';
import { buildTimes } from './normalizeTimes';

const API_BASE_URL = getProxyBase();
const POLL_INTERVAL = 1500; // 1.5 seconds (increased from 2s)
const MAX_POLL_TIME = 60000; // 60 seconds

// Request transcript from proxy
export async function requestTranscript(request: TranscriptRequest): Promise<TranscriptResponse> {
  try {
    // Normalize times for AAI
    const { aaiStartMs, aaiEndMs, clipDurationMs } = buildTimes(
      0,                 // episodeStartMs not used here
      request.clipStartMs,  // already ms
      request.clipEndMs
    );

    // AAI payload (proxy will add the API key)
    const payload = {
      audio_url: request.audioUrl,
      audio_start_from: aaiStartMs,
      audio_end_at: aaiEndMs,
      punctuate: true,
      format_text: true,
      speaker_labels: false
    };

    const result = await requestTranscriptAPI(payload);
    console.log('✅ Transcript request successful:', result);
    return { transcriptId: result.transcriptId };
  } catch (error) {
    console.error('❌ Failed to request transcript:', error);
    throw error;
  }
}

// Poll transcript status
export async function pollTranscript(transcriptId: string): Promise<TranscriptStatus> {
  const startTime = Date.now();
  let pollCount = 0;
  
  console.log('🔄 Starting transcript polling for ID:', transcriptId);
  
  while (Date.now() - startTime < MAX_POLL_TIME) {
    try {
      pollCount++;
      console.log(`🔄 Poll ${pollCount} (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
      
      const result = await pollTranscriptAPI(transcriptId);
      console.log('📊 Poll result:', { status: result.status, hasTranscript: !!result.transcript });
      
      if (result.status === 'completed') {
        console.log('✅ Transcript completed successfully');
        return { status: 'completed', transcript: result.transcript };
      } else if (result.status === 'error') {
        console.error('❌ Transcript processing failed:', result.error);
        return { status: 'error', error: result.error };
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    } catch (error) {
      console.error('❌ Failed to poll transcript:', error);
      throw error;
    }
  }
  
  console.error('⏰ Transcript polling timed out after', MAX_POLL_TIME / 1000, 'seconds');
  throw new Error('Transcript polling timed out');
}

// Fetch or transcribe with caching
export async function fetchOrTranscribe(
  request: TranscriptRequest,
  theme: CaptionTheme
): Promise<LayoutResult> {
  const themeFingerprint = createThemeFingerprint(theme);
  const cacheKey = createCacheKey(
    request.episodeId,
    request.clipStartMs,
    request.clipEndMs,
    themeFingerprint
  );

  // Try cache first
  const cached = await getCachedLayout(cacheKey);
  if (cached) {
    console.log('📦 Cache hit for transcript');
    return {
      words: cached.words,
      paragraphs: cached.paragraphs,
      lines: cached.lines,
      yByWordIndex: cached.yByWordIndex,
      totalH: cached.totalH,
      anchors: cached.anchors,
    };
  }

  console.log('🌐 Cache miss, fetching transcript...');

  try {
    // Request transcript
    console.log('📝 Step 1: Requesting transcript...');
    const { transcriptId } = await requestTranscript(request);
    
    // Poll until complete
    console.log('📝 Step 2: Polling for completion...');
    const status = await pollTranscript(transcriptId);
    
    if (status.status === 'error') {
      throw new Error(status.error || 'Transcript processing failed');
    }

    // Convert to our format
    console.log('📝 Step 3: Converting AAI response...');
    const transcript = toTranscript(status.transcript, request.clipStartMs);
    console.log('📝 Transcript conversion result:', {
      wordCount: transcript.words.length,
      paragraphCount: transcript.paragraphs.length,
    });
    
    // Measure layout
    console.log('📝 Step 4: Measuring layout...');
    const layoutResult = await measureTranscript(
      { words: transcript.words },
      theme,
      transcript.paragraphs
    );
    console.log('📝 Layout measurement result:', {
      lineCount: layoutResult.lines.length,
      totalHeight: layoutResult.totalH,
    });
    
    // Build anchors
    console.log('📝 Step 5: Building anchors...');
    const anchors = buildLineAnchors(
      transcript.words,
      layoutResult.yByWordIndex,
      layoutResult.totalH
    );
    console.log('📝 Anchor building result:', {
      anchorCount: anchors.length,
    });
    
    // Create final result
    const result: LayoutResult = {
      words: transcript.words,
      paragraphs: transcript.paragraphs,
      lines: layoutResult.lines,
      yByWordIndex: layoutResult.yByWordIndex,
      totalH: layoutResult.totalH,
      anchors: {
        times: anchors.map(a => a.timeMs),
        offsets: anchors.map(a => a.yTop),
      },
    };
    
    // Cache the result
    console.log('📝 Step 6: Caching result...');
    await cacheLayout(cacheKey, result);
    
    console.log('✅ Transcript pipeline completed successfully');
    return result;
  } catch (error) {
    console.error('❌ Failed to fetch or transcribe:', error);
    
    // Log error for diagnostics
    const errorRecord = {
      episodeId: request.episodeId,
      clipStartMs: request.clipStartMs,
      clipEndMs: request.clipEndMs,
      reason: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    };
    
    // Store error record (you might want to send this to your analytics)
    console.warn('Error record:', errorRecord);
    
    throw error;
  }
}

// Pre-warm glyphs for theme
export async function warmGlyphs(theme: CaptionTheme): Promise<void> {
  // This would render hidden text with the theme to warm the font cache
  // Implementation depends on your font loading strategy
  console.log('🔥 Warming glyphs for theme:', theme.fontFamily);
  
  // Wait a bit to ensure fonts are loaded
  await new Promise(resolve => setTimeout(resolve, 100));
}

// Error tracking
export function logCaptionError(error: any, context: any): void {
  const errorRecord = {
    ...context,
    error: error instanceof Error ? error.message : String(error),
    timestamp: Date.now(),
  };
  
  console.error('Caption error:', errorRecord);
  // You could send this to your error tracking service
}
