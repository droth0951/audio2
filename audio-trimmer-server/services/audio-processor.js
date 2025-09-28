// Audio download and processing service for caption integration
// Solves CDN timing issue by downloading exact audio that user heard

const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const logger = require('./logger');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

class AudioProcessor {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
  }

  // Download audio and extract exact clip for AssemblyAI processing
  async downloadAndExtractClip(audioUrl, clipStartMs, clipEndMs, jobId) {
    try {
      // 1. Download full audio file
      logger.info('🎵 Downloading audio from CDN', {
        jobId,
        url: this.sanitizeUrl(audioUrl),
        clipStart: clipStartMs,
        clipEnd: clipEndMs,
        duration: `${Math.round((clipEndMs - clipStartMs) / 1000)}s`
      });

      const axios = require('axios');
      const audioResponse = await axios({
        method: 'GET',
        url: audioUrl,
        responseType: 'arraybuffer',
        timeout: 60000, // 60 second timeout for large files
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Audio2App/1.0)',
        }
      });

      const audioBuffer = Buffer.from(audioResponse.data);

      // 2. Save to temporary file
      const tempInputPath = path.join(this.tempDir, `input-${jobId}-${Date.now()}.mp3`);
      const tempOutputPath = path.join(this.tempDir, `clip-${jobId}-${Date.now()}.mp3`);

      // Ensure temp directory exists
      await fs.ensureDir(this.tempDir);
      await fs.writeFile(tempInputPath, audioBuffer);

      // 3. Extract exact clip using FFmpeg
      const startSeconds = clipStartMs / 1000;
      const durationSeconds = (clipEndMs - clipStartMs) / 1000;

      logger.debug('🔧 Extracting clip with FFmpeg', {
        jobId,
        startSeconds,
        durationSeconds,
        inputSize: `${Math.round(audioBuffer.length / 1024)}KB`
      });

      await new Promise((resolve, reject) => {
        ffmpeg(tempInputPath)
          .setStartTime(startSeconds)
          .setDuration(durationSeconds)
          .output(tempOutputPath)
          .on('end', () => {
            logger.debug('✅ FFmpeg extraction completed', { jobId });
            resolve();
          })
          .on('error', (error) => {
            logger.error('❌ FFmpeg extraction failed', { jobId, error: error.message });
            reject(error);
          })
          .run();
      });

      // 4. Read extracted clip
      const clipBuffer = await fs.readFile(tempOutputPath);

      // 5. Cleanup temp files
      await fs.remove(tempInputPath);
      await fs.remove(tempOutputPath);

      logger.success('✅ Audio clip extracted successfully', {
        jobId,
        originalSize: `${Math.round(audioBuffer.length / 1024)}KB`,
        clipSize: `${Math.round(clipBuffer.length / 1024)}KB`,
        duration: `${durationSeconds}s`,
        compression: `${Math.round((1 - clipBuffer.length / audioBuffer.length) * 100)}%`
      });

      return clipBuffer;

    } catch (error) {
      logger.error('❌ Audio processing failed', {
        jobId,
        error: error.message,
        url: this.sanitizeUrl(audioUrl)
      });
      throw error;
    }
  }

  // 🚀 Enhanced logging for smart features (Phase 1 foundation)
  logSmartInsights(transcript, clipStartMs, clipEndMs, jobId) {
    // Feature flag protection for smart features
    if (process.env.ENABLE_SMART_FEATURES !== 'true') {
      logger.debug('⚙️ Smart features disabled - skipping insights logging', { jobId });
      return {};
    }

    try {
      const clipDurationMs = clipEndMs - clipStartMs;
      const insights = {
        clipInfo: {
          duration: `${Math.round(clipDurationMs / 1000)}s`,
          words: transcript.words?.length || 0,
          speakers: transcript.utterances ?
            [...new Set(transcript.utterances.map(u => u.speaker))].length : 0
        }
      };

      // Future Phase 2: Smart Clip Suggestions
      if (transcript.auto_highlights_result?.results?.length > 0) {
        const clipHighlights = transcript.auto_highlights_result.results.filter(h =>
          h.start >= clipStartMs && h.end <= clipEndMs
        );
        insights.highlights = {
          total: transcript.auto_highlights_result.results.length,
          inClip: clipHighlights.length,
          bestRank: clipHighlights.length > 0 ? Math.max(...clipHighlights.map(h => h.rank)) : 0
        };
      }

      // Future Phase 2: Mood-Based Captions
      if (transcript.sentiment_analysis_results?.length > 0) {
        const clipSentiments = transcript.sentiment_analysis_results.filter(s =>
          s.start >= clipStartMs && s.end <= clipEndMs
        );
        const sentimentCounts = clipSentiments.reduce((acc, s) => {
          acc[s.sentiment] = (acc[s.sentiment] || 0) + 1;
          return acc;
        }, {});
        insights.sentiment = {
          dominant: Object.keys(sentimentCounts).sort((a,b) => sentimentCounts[b] - sentimentCounts[a])[0] || 'NEUTRAL',
          breakdown: sentimentCounts
        };
      }

      // Future Phase 2: Smart Tags
      if (transcript.entities?.length > 0) {
        const clipEntities = transcript.entities.filter(e =>
          e.start >= clipStartMs && e.end <= clipEndMs
        );
        insights.entities = clipEntities.reduce((acc, e) => {
          acc[e.entity_type] = acc[e.entity_type] || [];
          acc[e.entity_type].push(e.text);
          return acc;
        }, {});
      }

      // Future Phase 2: Auto-Themed Videos
      if (transcript.iab_categories_result?.summary) {
        const topicScores = Object.entries(transcript.iab_categories_result.summary)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3);
        insights.topics = {
          primary: topicScores[0]?.[0] || 'General',
          scores: Object.fromEntries(topicScores)
        };
      }

      logger.info('🚀 Smart insights for clip', { jobId, insights });

      // Store insights for future features (Phase 2+)
      return insights;

    } catch (error) {
      logger.warn('⚠️ Smart insights logging failed (non-critical)', {
        jobId,
        error: error.message
      });
      return {};
    }
  }

  // Helper: Sanitize URL for logging (remove sensitive tokens)
  sanitizeUrl(url) {
    try {
      const urlObj = new URL(url);
      // Remove query parameters that might contain tokens
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return '[invalid-url]';
    }
  }

  // Helper: Estimate processing cost
  estimateProcessingCost(clipDurationMs) {
    const durationSeconds = clipDurationMs / 1000;
    return {
      audioDownload: 0.002,     // Fixed cost for download
      audioExtraction: 0.001,   // Fixed FFmpeg cost
      total: 0.003
    };
  }
}

module.exports = new AudioProcessor();