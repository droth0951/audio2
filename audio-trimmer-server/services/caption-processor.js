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
  async generateCaptions(audioBuffer, clipStartMs, clipEndMs, jobId, enableSmartFeatures = true, textStyle = 'normal') {
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
      if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_CAPTIONS === 'true') {
        logger.debug('AssemblyAI upload response:', { jobId, uploadResponse });
      }

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
      if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_CAPTIONS === 'true') {
        logger.debug('⏳ Waiting for transcription completion', {
          jobId,
          transcriptId: transcript.id
        });
      }

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
          logger.info('📝 Fetching SRT subtitles with 25-char chunking for ALL CAPS', { jobId, transcriptId: completedTranscript.id });
          const srtSubtitles = await this.assemblyai.transcripts.subtitles(
            completedTranscript.id,
            'srt',
            25  // chars_per_caption - Further reduced to prevent visual cutoff
          );

          // Create better captions from utterances instead of using awkward SRT chunks
          logger.info('🔄 Using utterance-based caption generation for better boundaries', {
            jobId,
            textStyle: textStyle
          });
          completedTranscript.srtCaptions = this.createCaptionsFromUtterances(completedTranscript, textStyle);
          logger.info('✅ Utterance-based captions created', {
            jobId,
            textStyle,
            captionCount: completedTranscript.srtCaptions?.length,
            sampleCaption: completedTranscript.srtCaptions?.[0]?.text
          });

          logger.debug('✅ SRT subtitles fetched and parsed', {
            jobId,
            captionCount: completedTranscript.srtCaptions?.length || 0,
            speakerCount: completedTranscript.utterances?.length || 0,
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
        if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_CAPTIONS === 'true') {
          logger.debug('🎯 Found highlights', { jobId, count: highlights.length, highlights });
        }
      }

      // Extract entities for future "Smart Tags" feature
      if (transcript.entities?.length > 0) {
        const entitySummary = transcript.entities.reduce((acc, entity) => {
          acc[entity.entity_type] = (acc[entity.entity_type] || 0) + 1;
          return acc;
        }, {});
        if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_CAPTIONS === 'true') {
          logger.debug('🏷️ Found entities', { jobId, entitySummary });
        }
      }

      // Extract sentiment for future "Mood Captions" feature
      if (transcript.sentiment_analysis_results?.length > 0) {
        const sentimentSummary = transcript.sentiment_analysis_results.reduce((acc, item) => {
          acc[item.sentiment] = (acc[item.sentiment] || 0) + 1;
          return acc;
        }, {});
        if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_CAPTIONS === 'true') {
          logger.debug('😊 Sentiment analysis', { jobId, sentimentSummary });
        }
      }

      // Extract topics for future "Auto-Themed Videos" feature
      if (transcript.iab_categories_result?.summary) {
        const topTopics = Object.entries(transcript.iab_categories_result.summary)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3);
        if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_CAPTIONS === 'true') {
          logger.debug('📂 Top topics', { jobId, topTopics });
        }
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
  splitCaptionIntoLines(text, maxCharsPerLine = 25) { // Aligned with AssemblyAI chars_per_caption
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

  // Clean up punctuation for caption optimization (vs transcript)
  cleanupCaptionPunctuation(text) {
    if (!text) return text;

    // Remove excessive periods that are speech pauses, not sentence ends
    // Keep periods only for true sentence boundaries
    let cleaned = text
      // Remove periods after very short fragments (likely speech pauses)
      .replace(/\b\w{1,3}\./g, (match) => {
        const word = match.slice(0, -1);
        // Keep periods after common abbreviations
        if (['Mr', 'Ms', 'Dr', 'vs', 'etc'].includes(word)) {
          return match;
        }
        return word; // Remove period from short words
      })
      // Remove periods before conjunctions (indicates pause, not sentence end)
      .replace(/\.\s+(and|but|or|so|yet|for|nor)\s+/gi, ' $1 ')
      // Remove periods before transition words (indicates pause)
      .replace(/\.\s+(then|now|well|you know|I mean|like)\s+/gi, ' $1 ')
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      .trim();

    // Ensure proper sentence endings for true sentence boundaries
    // Add period only if text doesn't end with punctuation and seems complete
    if (cleaned.length > 10 && !/[.!?]$/.test(cleaned)) {
      // Only add period if it looks like a complete thought
      const words = cleaned.split(' ');
      if (words.length >= 4) { // Reasonably complete sentences
        cleaned += '.';
      }
    }

    return cleaned;
  }

  // Apply text style transformation (normal, uppercase, etc.)
  applyTextStyle(text, style) {
    switch (style) {
      case 'uppercase':
      case 'caps':
      case 'allcaps':
        return text.toUpperCase();
      case 'lowercase':
        return text.toLowerCase();
      case 'title':
        // Smart title case that handles contractions properly
        return text.replace(/\b\w+(?:'\w+)*\b/g, (word) => {
          // Handle contractions like "don't", "we're", "George's"
          if (word.includes("'")) {
            const parts = word.split("'");
            return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase() +
                   "'" + parts.slice(1).join("'").toLowerCase();
          }
          // Regular title case for normal words
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        });
      case 'normal':
      default:
        return text;
    }
  }

  // Create captions from utterances for better speaker boundaries and complete thoughts
  createCaptionsFromUtterances(transcript, textStyle = 'normal') {
    if (!transcript?.utterances?.length) return [];

    const captions = [];
    let captionIndex = 1;

    for (const utterance of transcript.utterances) {
      let text = utterance.text.trim();
      if (!text) continue;

      // First cleanup punctuation for caption optimization
      text = this.cleanupCaptionPunctuation(text);

      // Then apply text style transformation
      text = this.applyTextStyle(text, textStyle);

      // Split long utterances into chunks while keeping complete thoughts
      // NOTE: utterance.start/end are already relative to clip since we use file upload
      const chunks = this.splitUtteranceIntoChunks(text, utterance.start, utterance.end);

      for (const chunk of chunks) {
        const displayMode = this.determineCaptionDisplayMode(
          chunk.text,
          chunk.startMs,
          chunk.endMs,
          [], // Speaker changes handled by utterance boundaries
          captions
        );

        const wordTimings = this.extractWordTimingsForCaption(
          transcript,
          chunk.text,
          chunk.startMs,
          chunk.endMs
        );

        // CRITICAL FIX: Validate chunk timing using word-level data
        // Only adjust if word extraction succeeded and there's a significant timing gap
        if (wordTimings.length > 0) {
          const firstWord = wordTimings[0];
          const lastWord = wordTimings[wordTimings.length - 1];
          const startGap = firstWord.start - chunk.startMs;

          // Tunable threshold: only adjust if caption would appear significantly early
          const TIMING_GAP_THRESHOLD_MS = 500; // 500ms threshold (tunable)
          const LOOKAHEAD_BUFFER_MS = 75;      // Small lookahead for smoothness
          const LOOKBACK_BUFFER_MS = 200;      // Keep visible briefly after

          if (startGap > TIMING_GAP_THRESHOLD_MS) {
            const oldStart = chunk.startMs;
            const oldEnd = chunk.endMs;

            // Adjust both start AND end times based on word timing
            chunk.startMs = firstWord.start - LOOKAHEAD_BUFFER_MS;
            chunk.endMs = lastWord.end + LOOKBACK_BUFFER_MS;

            // DEBUG ONLY: Log timing adjustments (avoids rate limits in production)
            if (process.env.DEBUG_CAPTIONS === 'true') {
              logger.info('⏱️ Slow speaker timing adjusted', {
                chunkText: chunk.text.substring(0, 40) + (chunk.text.length > 40 ? '...' : ''),
                originalTiming: `${oldStart}-${oldEnd}ms (${Math.round((oldEnd-oldStart)/1000)}s)`,
                adjustedTiming: `${chunk.startMs}-${chunk.endMs}ms (${Math.round((chunk.endMs-chunk.startMs)/1000)}s)`,
                startGap: `${startGap}ms`,
                adjustment: `+${chunk.startMs - oldStart}ms`,
                wordCount: wordTimings.length
              });
            }
          }
        } else {
          // Word extraction failed - log warning (rarely happens, so minimal overhead)
          if (process.env.DEBUG_CAPTIONS === 'true') {
            logger.warn('⚠️ Caption word extraction failed, using utterance timing', {
              chunkText: chunk.text.substring(0, 40) + (chunk.text.length > 40 ? '...' : ''),
              startMs: chunk.startMs,
              endMs: chunk.endMs,
              duration: `${Math.round((chunk.endMs - chunk.startMs)/1000)}s`
            });
          }
        }

        // Standard caption log (minimal, production-safe)
        const lines = this.optimizeLineBreaks(chunk.text, 32);
        logger.info('📝 Caption chunk created', {
          text: chunk.text,
          length: chunk.text.length,
          lines: lines,
          displayMode: displayMode
        });

        captions.push({
          index: captionIndex++,
          startMs: chunk.startMs,
          endMs: chunk.endMs,
          text: chunk.text,
          duration: chunk.endMs - chunk.startMs,
          lines: lines,
          words: wordTimings,
          displayMode: displayMode,
          speaker: utterance.speaker || 'A'
        });
      }
    }

    return captions;
  }

  // Split utterance into natural chunks while preserving complete thoughts
  splitUtteranceIntoChunks(text, startMs, endMs) {
    const maxChunkLength = 50; // Max 50 chars total to fit on 2 lines of ~25-30 chars each

    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔍 CHUNKING DEBUG: Input text: "${text}", length: ${text.length}`);
    }

    // For very short text, return as is
    if (text.length <= 35) {
      if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_CAPTIONS === 'true') {
        console.log(`✅ Short text (≤35), returning as single chunk`);
      }
      return [{ text, startMs, endMs }];
    }

    // For medium text that fits in maxChunkLength, return as single chunk
    if (text.length <= maxChunkLength) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`✅ Medium text (≤50), returning as single chunk`);
      }
      return [{ text, startMs, endMs }];
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`⚠️ Long text (>${maxChunkLength}), MUST split into chunks`);
    }
    const chunks = [];

    // Force split any text longer than 50 characters
    // Simple word-boundary splitting for reliable results
    const words = text.split(' ');
    let currentChunk = '';
    let chunkStartMs = startMs;
    const totalDuration = endMs - startMs;
    const avgMsPerChar = totalDuration / text.length;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testChunk = currentChunk ? `${currentChunk} ${word}` : word;

      // If adding this word would make chunk too long, finish current chunk
      if (testChunk.length > 50 && currentChunk.length > 0) {
        const chunkEndMs = chunkStartMs + (currentChunk.length * avgMsPerChar);
        chunks.push({
          text: currentChunk.trim(),
          startMs: Math.round(chunkStartMs),
          endMs: Math.round(chunkEndMs)
        });

        if (process.env.NODE_ENV !== 'production') {
          console.log(`📦 Created chunk: "${currentChunk.trim()}", length: ${currentChunk.trim().length}`);
        }

        // Start new chunk with current word
        currentChunk = word;
        chunkStartMs = chunkEndMs;
      } else {
        currentChunk = testChunk;
      }
    }

    // Add final chunk if any
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        startMs: Math.round(chunkStartMs),
        endMs: endMs
      });
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📦 Final chunk: "${currentChunk.trim()}", length: ${currentChunk.trim().length}`);
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`🎯 CHUNKING RESULT: Created ${chunks.length} chunks from ${text.length}-char text`);
    }
    return chunks.length > 0 ? chunks : [{ text, startMs, endMs }];
  }

  // Parse SRT format into structured captions with timing and speaker gaps (BACKUP METHOD)
  parseSRT(srtString, transcript) {
    if (!srtString) return [];

    const captions = [];
    const blocks = srtString.trim().split('\n\n');

    // Get speaker change points from utterances if available
    const speakerChanges = [];
    if (transcript?.utterances?.length > 1) {
      for (let i = 0; i < transcript.utterances.length - 1; i++) {
        const currentSpeaker = transcript.utterances[i].speaker || 'A';
        const nextSpeaker = transcript.utterances[i + 1].speaker || 'B';

        if (currentSpeaker !== nextSpeaker) {
          speakerChanges.push({
            changeTime: transcript.utterances[i].end,
            fromSpeaker: currentSpeaker,
            toSpeaker: nextSpeaker
          });

          logger.debug('Speaker change detected', {
            changeTime: transcript.utterances[i].end,
            from: currentSpeaker,
            to: nextSpeaker
          });
        }
      }
    }

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
          let endMs = this.srtTimeToMs(timingMatch[5], timingMatch[6], timingMatch[7], timingMatch[8]);

          // Check if there's a speaker change during or right after this caption
          const SPEAKER_GAP_MS = 300; // 300ms gap between speakers for better visual separation
          for (const change of speakerChanges) {
            // If speaker change happens right after this caption, end it slightly early
            if (change.changeTime > startMs && change.changeTime < endMs + 500) {
              endMs = Math.min(endMs, change.changeTime - SPEAKER_GAP_MS);
              logger.debug('Adjusted caption end for speaker change', {
                originalEnd: endMs,
                adjustedEnd: change.changeTime - SPEAKER_GAP_MS,
                text: text.substring(0, 30)
              });
            }
          }

          // Validate timing (1.5-7 seconds as per industry standards)
          const duration = endMs - startMs;
          const validatedTiming = this.validateCaptionTiming(startMs, endMs, text);

          // Extract word-level timing for this caption
          const wordTimings = this.extractWordTimingsForCaption(transcript, text, validatedTiming.startMs, validatedTiming.endMs);

          // MVP: Determine display mode (1 or 2 lines)
          const displayMode = this.determineCaptionDisplayMode(
            text,
            validatedTiming.startMs,
            validatedTiming.endMs,
            speakerChanges,
            captions // previous captions for context
          );

          captions.push({
            index,
            startMs: validatedTiming.startMs,
            endMs: validatedTiming.endMs,
            text: text,
            duration: validatedTiming.endMs - validatedTiming.startMs,
            lines: this.optimizeLineBreaks(text, 32), // Smart line breaking at 32 chars
            words: wordTimings, // Word-level timing for highlighting
            displayMode: displayMode // MVP: 'one-line', 'two-lines'
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

  // Extract word-level timing data for a specific caption from AssemblyAI transcript
  extractWordTimingsForCaption(transcript, captionText, captionStartMs, captionEndMs) {
    if (!transcript?.words?.length) return [];

    // Find words that fall within this caption's time range
    const captionWords = transcript.words.filter(word =>
      word.start >= captionStartMs && word.end <= captionEndMs
    );

    // If no exact matches, try fuzzy matching by text content
    if (captionWords.length === 0) {
      const captionWordsArray = captionText.toLowerCase().split(/\s+/);
      const matchedWords = [];

      for (const word of transcript.words) {
        const wordText = word.text.toLowerCase().replace(/[^\w]/g, '');
        if (captionWordsArray.some(captionWord =>
          captionWord.replace(/[^\w]/g, '') === wordText
        ) && word.start >= captionStartMs - 500 && word.end <= captionEndMs + 500) {
          matchedWords.push(word);
        }
      }

      return matchedWords.slice(0, captionWordsArray.length); // Limit to caption length
    }

    return captionWords;
  }

  // MVP: Determine whether caption should display as 1 or 2 lines
  determineCaptionDisplayMode(text, startMs, endMs, speakerChanges, previousCaptions) {
    // Default to two lines for engagement
    let mode = 'two-lines';

    // One-line only for very short phrases (like "LinkedIn news")
    const isShortPhrase = text.length <= 15; // "LinkedIn news" = 14 chars
    const hasNoCommasOrConjunctions = !text.includes(',') && !text.includes(' and ') && !text.includes(' where ');

    if (isShortPhrase && hasNoCommasOrConjunctions) {
      mode = 'one-line';
      logger.debug('Caption using one-line mode', {
        reason: 'short-phrase',
        textLength: text.length,
        text: text
      });
    } else {
      // Everything else uses two lines for engagement
      mode = 'two-lines';
      logger.debug('Caption using two-line mode', {
        reason: 'engagement-default',
        textLength: text.length,
        text: text.substring(0, 40) + '...'
      });
    }

    return mode;
  }

  // Optimize line breaks for readability (smart grammatical breaks)
  optimizeLineBreaks(text, maxCharsPerLine = 25) { // Aligned with AssemblyAI chars_per_caption
    // Only extremely short phrases stay as single line
    if (!text || text.length <= 15) {
      return [text];
    }

    // ALWAYS try to split into 2 lines for better engagement (unless very short)
    // Prioritize complete thoughts over character limits

    // First, try to break at strong natural boundaries that preserve complete thoughts
    const strongBreakPoints = [' where ', ' that ', ' which ', ' when ', ' while ', ' because ', ' since '];

    for (const breakPoint of strongBreakPoints) {
      const index = text.indexOf(breakPoint);
      if (index > 15) { // Ensure first part has substance
        const line1 = text.substring(0, index).trim();
        const line2 = text.substring(index + 1).trim(); // Skip the space

        // Cap lines at 35 chars max ("Today we're hearing from Dan Porter," length)
        if (line1.length >= 15 && line2.length >= 10 &&
            line1.length <= 35 && line2.length <= 35) {
          return [line1, line2];
        }
      }
    }

    // Secondary: try punctuation and weaker conjunctions
    const weakerBreakPoints = [', ', ' and ', ' but ', ' or ', ' - ', ': ', '; ', '. '];

    for (const breakPoint of weakerBreakPoints) {
      const index = text.indexOf(breakPoint);
      if (index > 10 && index < text.length - 10) {
        const line1 = text.substring(0, index + (breakPoint === ', ' ? 1 : 0)).trim();
        const line2 = text.substring(index + breakPoint.length).trim();

        // Cap at 35 chars per line max
        if (line1.length >= 8 && line2.length >= 8 &&
            line1.length <= 35 && line2.length <= 35) {
          return [line1, line2];
        }
      }
    }

    // If no natural break point, try to split at phrase boundaries
    const words = text.split(' ');

    // Look for natural phrase patterns to avoid awkward splits
    const phrasePatterns = [
      /^(Hey there|Hello there|Hi there),?\s*/i,
      /^(I'm|I am)\s+\w+/i,
      /^(Welcome to|Thanks for|This is)\s+/i,
      /\s+(where we|that we|when we)\s+/i,
      /(the|a|an)\s+\w+\s+(of|for|in|at|with)\s+/i
    ];

    // Try to find a good split point that respects phrase patterns
    let bestSplitIndex = Math.floor(words.length / 2); // Default to middle

    for (let i = 2; i < words.length - 2; i++) {
      const beforePhrase = words.slice(0, i).join(' ');
      const afterPhrase = words.slice(i).join(' ');

      // Check if this creates a natural phrase boundary
      const isGoodSplit = !phrasePatterns.some(pattern => {
        const match = text.match(pattern);
        if (match) {
          const patternEnd = match.index + match[0].length;
          const splitPoint = beforePhrase.length;
          // Avoid splitting in the middle of a pattern
          return splitPoint > match.index && splitPoint < patternEnd;
        }
        return false;
      });

      if (isGoodSplit && Math.abs(beforePhrase.length - afterPhrase.length) < Math.abs(words.slice(0, bestSplitIndex).join(' ').length - words.slice(bestSplitIndex).join(' ').length)) {
        bestSplitIndex = i;
      }
    }

    // Create two balanced lines avoiding awkward phrase splits
    const line1 = words.slice(0, bestSplitIndex).join(' ');
    const line2 = words.slice(bestSplitIndex).join(' ');

    // Only return two lines if both have content
    if (line1 && line2) {
      return [line1, line2];
    }

    // Fallback: Force split if text is too long (never return single line > 35 chars)
    if (text.length > 35) {
      const words = text.split(' ');
      const midPoint = Math.floor(words.length / 2);
      const line1 = words.slice(0, midPoint).join(' ');
      const line2 = words.slice(midPoint).join(' ');

      // If either line is still too long, try a different split
      if (line1.length > 35 || line2.length > 35) {
        // More aggressive splitting - find a split that keeps both under 35
        for (let i = 1; i < words.length - 1; i++) {
          const testLine1 = words.slice(0, i).join(' ');
          const testLine2 = words.slice(i).join(' ');
          if (testLine1.length <= 35 && testLine2.length <= 35) {
            return [testLine1, testLine2];
          }
        }
      }

      return [line1, line2];
    }

    return [text];
  }
}

module.exports = new CaptionProcessor();