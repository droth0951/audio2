// Caption generation service using AssemblyAI file upload method
// Solves CDN timing issue by uploading exact audio file instead of URL

const { AssemblyAI } = require('assemblyai');
const logger = require('./logger');

class CaptionProcessor {
  constructor() {
    this.assemblyai = null;
    this.initializeClient();
  }

  // Initialize AssemblyAI client
  initializeClient() {
    const apiKey = process.env.ASSEMBLYAI_API_KEY || process.env.ASSEMBLYAI_KEY;
    if (!apiKey) {
      logger.warn('⚠️ AssemblyAI API key not found - captions will be disabled');
      return;
    }

    try {
      this.assemblyai = new AssemblyAI({
        apiKey: apiKey
      });
      logger.debug('✅ AssemblyAI client initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize AssemblyAI client', { error: error.message });
    }
  }

  // Generate captions using file upload method (not URL)
  async generateCaptions(audioBuffer, clipStartMs, clipEndMs, jobId, enableSmartFeatures = true) {
    try {
      if (!this.assemblyai) {
        logger.warn('⚠️ AssemblyAI not available - skipping captions', { jobId });
        return null;
      }

      // 1. Upload audio file (not URL) - this is the key fix for CDN timing
      logger.info('📤 Uploading audio file to AssemblyAI', {
        jobId,
        fileSize: `${Math.round(audioBuffer.length / 1024)}KB`,
        duration: `${Math.round((clipEndMs - clipStartMs) / 1000)}s`
      });

      const uploadResponse = await this.assemblyai.files.upload(audioBuffer);
      logger.debug('AssemblyAI upload response:', { jobId, uploadResponse });

      // 2. Enhanced transcription request with Phase 1 AI features
      const audioUrl = uploadResponse.upload_url || uploadResponse;
      const transcriptRequest = {
        audio_url: audioUrl,  // Static file URL

        // Core caption features (existing)
        speaker_labels: true,
        speakers_expected: 2,
        format_text: true,
        punctuate: true,
        auto_chapters: false,

        // 🚀 NEW: Phase 1 Smart Features (if enabled via feature flags)
        ...(enableSmartFeatures && process.env.ENABLE_SMART_FEATURES === 'true' && {
          auto_highlights: true,        // Best moments for social sharing
          sentiment_analysis: true,     // Emotional tone analysis
          entity_detection: true,       // People, companies, topics mentioned
          iab_categories: true          // Topic classification
        })
      };

      logger.info('🎬 Starting enhanced transcription with smart features', {
        jobId,
        smartFeatures: enableSmartFeatures,
        uploadUrl: uploadResponse.upload_url ? uploadResponse.upload_url.substring(0, 50) + '...' : 'uploaded'
      });

      const transcript = await this.assemblyai.transcripts.create(transcriptRequest);

      // 3. Wait for completion with progress logging
      logger.debug('⏳ Waiting for transcription completion', {
        jobId,
        transcriptId: transcript.id
      });

      const completedTranscript = await this.assemblyai.transcripts.waitUntilReady(transcript.id);

      if (completedTranscript.status === 'completed') {
        logger.success('✅ Enhanced transcription completed', {
          jobId,
          transcriptId: completedTranscript.id,
          utteranceCount: completedTranscript.utterances?.length || 0,
          wordCount: completedTranscript.words?.length || 0,
          highlightsFound: completedTranscript.auto_highlights_result?.results?.length || 0,
          entitiesFound: completedTranscript.entities?.length || 0,
          topicCategories: Object.keys(completedTranscript.iab_categories_result?.summary || {}).length
        });

        // 4. Fetch SRT subtitles with 32-character chunking for optimal mobile readability
        try {
          logger.info('📝 Fetching SRT subtitles with 32-char chunking', { jobId, transcriptId: completedTranscript.id });
          const srtSubtitles = await this.assemblyai.transcripts.subtitles(
            completedTranscript.id,
            'srt',
            32  // chars_per_caption - CRITICAL for mobile optimization as per AssemblyAI docs
          );

          // Parse SRT into structured format
          completedTranscript.srtCaptions = this.parseSRT(srtSubtitles);

          logger.debug('✅ SRT subtitles fetched and parsed', {
            jobId,
            captionCount: completedTranscript.srtCaptions?.length || 0,
            sampleCaption: completedTranscript.srtCaptions?.[0]
          });
        } catch (srtError) {
          logger.warn('⚠️ SRT subtitle fetch failed, falling back to word-level', {
            jobId,
            error: srtError.message
          });
        }

        // 5. Process smart features for future use
        if (enableSmartFeatures && process.env.ENABLE_SMART_FEATURES === 'true') {
          await this.processSmartFeatures(completedTranscript, jobId);
        }

        return completedTranscript;
      } else {
        throw new Error(`Transcription failed: ${completedTranscript.error || 'Unknown error'}`);
      }

    } catch (error) {
      logger.error('❌ Caption generation failed', {
        jobId,
        error: error.message,
        stack: error.stack
      });
      return null; // Graceful fallback - continue video without captions
    }
  }

  // 🚀 Process Phase 1 smart features for future enhancements
  async processSmartFeatures(transcript, jobId) {
    try {
      // Extract highlights for future "Smart Clip Suggestions" feature
      if (transcript.auto_highlights_result?.results?.length > 0) {
        const highlights = transcript.auto_highlights_result.results.map(h => ({
          text: h.text.substring(0, 50) + '...',
          rank: h.rank,
          start: h.start,
          end: h.end
        }));
        logger.debug('🎯 Found highlights', { jobId, count: highlights.length, highlights });
      }

      // Extract entities for future "Smart Tags" feature
      if (transcript.entities?.length > 0) {
        const entitySummary = transcript.entities.reduce((acc, entity) => {
          acc[entity.entity_type] = (acc[entity.entity_type] || 0) + 1;
          return acc;
        }, {});
        logger.debug('🏷️ Found entities', { jobId, entitySummary });
      }

      // Extract sentiment for future "Mood Captions" feature
      if (transcript.sentiment_analysis_results?.length > 0) {
        const sentimentSummary = transcript.sentiment_analysis_results.reduce((acc, item) => {
          acc[item.sentiment] = (acc[item.sentiment] || 0) + 1;
          return acc;
        }, {});
        logger.debug('😊 Sentiment analysis', { jobId, sentimentSummary });
      }

      // Extract topics for future "Auto-Themed Videos" feature
      if (transcript.iab_categories_result?.summary) {
        const topTopics = Object.entries(transcript.iab_categories_result.summary)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3);
        logger.debug('📂 Top topics', { jobId, topTopics });
      }

    } catch (error) {
      logger.warn('⚠️ Smart features processing failed (non-critical)', {
        jobId,
        error: error.message
      });
    }
  }

  // Get current caption from transcript using production-tested logic
  getCurrentCaptionFromTranscript(transcript, currentTimeMs) {
    if (!transcript?.utterances?.length) return '';

    // Use same logic as CaptionService.getCurrentCaption() - utterance-based
    const currentUtterance = transcript.utterances.find(utterance =>
      currentTimeMs >= utterance.start && currentTimeMs <= utterance.end
    );

    return currentUtterance ? currentUtterance.text : '';
  }

  // Helper to split long captions (respects 3-line max rule from plan)
  splitCaptionIntoLines(text, maxCharsPerLine = 40) {
    if (!text || text.length <= maxCharsPerLine) return [text];

    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
        if (lines.length >= 2) break; // Max 3 lines total
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines.slice(0, 3); // Enforce 3-line max
  }

  // Estimate caption generation cost
  estimateCaptionCost(clipDurationMs) {
    const durationMinutes = clipDurationMs / (1000 * 60);
    const baseRate = 0.00025; // $0.00025 per minute for basic transcription
    const smartFeaturesRate = 0.00015; // Additional for smart features

    return {
      transcription: durationMinutes * baseRate,
      smartFeatures: durationMinutes * smartFeaturesRate,
      total: durationMinutes * (baseRate + smartFeaturesRate)
    };
  }

  // Check if captions are enabled via environment variable
  isCaptionsEnabled() {
    return process.env.ENABLE_SERVER_CAPTIONS === 'true' && this.assemblyai !== null;
  }

  // Parse SRT format into structured captions with timing
  parseSRT(srtString) {
    if (!srtString) return [];

    const captions = [];
    const blocks = srtString.trim().split('\n\n');

    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length >= 3) {
        const index = parseInt(lines[0]);
        const timingLine = lines[1];
        const text = lines.slice(2).join(' ').trim();

        // Parse SRT timecode: "00:00:01,500 --> 00:00:04,200"
        const timingMatch = timingLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);

        if (timingMatch) {
          const startMs = this.srtTimeToMs(timingMatch[1], timingMatch[2], timingMatch[3], timingMatch[4]);
          const endMs = this.srtTimeToMs(timingMatch[5], timingMatch[6], timingMatch[7], timingMatch[8]);

          // Validate timing (1.5-7 seconds as per industry standards)
          const duration = endMs - startMs;
          const validatedTiming = this.validateCaptionTiming(startMs, endMs, text);

          captions.push({
            index,
            startMs: validatedTiming.startMs,
            endMs: validatedTiming.endMs,
            text: text,
            duration: validatedTiming.endMs - validatedTiming.startMs,
            lines: this.optimizeLineBreaks(text, 32) // Smart line breaking at 32 chars
          });
        }
      }
    }

    return captions;
  }

  // Convert SRT time format to milliseconds
  srtTimeToMs(hours, minutes, seconds, milliseconds) {
    return parseInt(hours) * 3600000 +
           parseInt(minutes) * 60000 +
           parseInt(seconds) * 1000 +
           parseInt(milliseconds);
  }

  // Validate and adjust caption timing to meet industry standards
  validateCaptionTiming(startMs, endMs, text) {
    const duration = endMs - startMs;
    const MIN_DURATION = 1500; // 1.5 seconds minimum
    const MAX_DURATION = 7000; // 7 seconds maximum

    let validatedStart = startMs;
    let validatedEnd = endMs;

    if (duration < MIN_DURATION) {
      // Extend duration to minimum
      validatedEnd = startMs + MIN_DURATION;
      logger.debug('Caption duration extended to minimum', {
        original: `${duration}ms`,
        adjusted: `${MIN_DURATION}ms`,
        text: text.substring(0, 30)
      });
    } else if (duration > MAX_DURATION) {
      // Cap duration to maximum
      validatedEnd = startMs + MAX_DURATION;
      logger.debug('Caption duration capped to maximum', {
        original: `${duration}ms`,
        adjusted: `${MAX_DURATION}ms`,
        text: text.substring(0, 30)
      });
    }

    return {
      startMs: validatedStart,
      endMs: validatedEnd
    };
  }

  // Optimize line breaks for readability (smart grammatical breaks)
  optimizeLineBreaks(text, maxCharsPerLine = 32) {
    if (!text || text.length <= maxCharsPerLine) {
      return [text];
    }

    // Try to break at punctuation or conjunctions for natural reading
    const breakPoints = [', ', ' and ', ' but ', ' or ', ' - ', ': ', '; '];

    // If text fits in 2 lines, find optimal break point
    if (text.length <= maxCharsPerLine * 2) {
      for (const breakPoint of breakPoints) {
        const index = text.indexOf(breakPoint, Math.floor(text.length * 0.3));
        if (index > 0 && index < Math.floor(text.length * 0.7)) {
          return [
            text.substring(0, index + (breakPoint === ', ' ? 1 : 0)).trim(),
            text.substring(index + breakPoint.length).trim()
          ];
        }
      }
    }

    // Fallback to word boundary breaking
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
        if (lines.length >= 1) break; // Max 2 lines for readability
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines.slice(0, 2); // Enforce 2-line max for optimal readability
  }
}

module.exports = new CaptionProcessor();