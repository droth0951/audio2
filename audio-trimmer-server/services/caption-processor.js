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
    if (!process.env.ASSEMBLYAI_API_KEY) {
      logger.warn('⚠️ AssemblyAI API key not found - captions will be disabled');
      return;
    }

    try {
      this.assemblyai = new AssemblyAI({
        apiKey: process.env.ASSEMBLYAI_API_KEY
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

      // 2. Enhanced transcription request with Phase 1 AI features
      const transcriptRequest = {
        audio_url: uploadResponse.upload_url,  // Static file URL

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
        uploadUrl: uploadResponse.upload_url.substring(0, 50) + '...'
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

        // 4. Process smart features for future use
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
}

module.exports = new CaptionProcessor();