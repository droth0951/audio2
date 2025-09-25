// SVG + Sharp frame generation service for 9:16 videos

const Handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const config = require('../config/settings');

// Lazy load Sharp only when video generation is enabled
let sharp = null;
function getSharp() {
  if (!sharp) {
    try {
      sharp = require('sharp');
    } catch (error) {
      throw new Error('Sharp not available - video generation requires Sharp: ' + error.message);
    }
  }
  return sharp;
}

class FrameGenerator {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    this.templatePath = path.join(__dirname, '../templates/audio2-frame.svg');
    this.compiledTemplate = null; // Cache compiled template

    // Register Handlebars helpers for captions
    this.registerHandlebarsHelpers();
  }

  // Register Handlebars helpers for template processing
  registerHandlebarsHelpers() {
    // Add helper for numeric addition (needed for caption positioning)
    Handlebars.registerHelper('add', function(a, b) {
      return a + b;
    });

    // MVP: Helper for equality comparison in templates
    Handlebars.registerHelper('eq', function(a, b) {
      return a === b;
    });

    // MVP: Helper for array lookup by index
    Handlebars.registerHelper('lookup', function(array, index) {
      return array && array[index] ? array[index] : null;
    });

    // Add helper for word-level highlighting in captions
    Handlebars.registerHelper('wordsInLine', function(lineText, captionWords, currentTimeMs) {
      if (!lineText || !captionWords || captionWords.length === 0) {
        // Fallback: split line into words without highlighting
        return lineText.split(' ').map(word => ({
          text: word,
          isHighlighted: false
        }));
      }

      // Split line text into words
      const lineWords = lineText.split(' ');
      const result = [];

      // Match each word in the line to timing data
      let wordIndex = 0;
      for (const lineWord of lineWords) {
        const cleanLineWord = lineWord.toLowerCase().replace(/[^\w]/g, '');
        let isHighlighted = false;

        // Find matching word in caption timing data
        for (let i = wordIndex; i < captionWords.length; i++) {
          const captionWord = captionWords[i];
          const cleanCaptionWord = captionWord.text?.toLowerCase().replace(/[^\w]/g, '') || '';

          if (cleanLineWord === cleanCaptionWord) {
            // Check if this word should be highlighted (current time within word timing)
            isHighlighted = currentTimeMs >= captionWord.start && currentTimeMs <= captionWord.end;
            wordIndex = i + 1; // Move to next word for next iteration
            break;
          }
        }

        result.push({
          text: lineWord,
          isHighlighted: isHighlighted
        });
      }

      return result;
    });
  }

  // REVIEW-CRITICAL: Generate video frames with Audio2 design using SVG
  async generateFrames(audioPath, duration, podcast, jobId, transcript = null, captionsEnabled = false, clipStartMs = 0, clipEndMs = 0) {
    try {
      // REVIEW-CRITICAL: Feature flag check for frame generation
      if (!config.features.ENABLE_SERVER_VIDEO) {
        throw new Error('Frame generation disabled - server-side video generation is off');
      }

      const startTime = Date.now();
      const fps = 12; // 12 frames per second for smooth video playbook
      const frameCount = Math.round(duration * fps); // Use round instead of ceil for exact timing

      // 🔤 Debug: List available fonts
      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        const { stdout } = await execAsync('fc-list | grep -i roboto | head -5');
        logger.debug('🔤 Available Roboto fonts:', { jobId, fonts: stdout.trim() });
      } catch (error) {
        logger.warn('🔤 Font debug failed:', { jobId, error: error.message });
      }
      const frameDir = path.join(this.tempDir, `frames_${jobId}`);
      
      await fs.mkdir(frameDir, { recursive: true });

      logger.debug('Starting SVG frame generation', {
        jobId,
        frameCount,
        duration: `${duration}s`,
        fps,
        approach: 'SVG + Sharp'
      });

      // Load cached SVG template
      const template = await this.getTemplate();

      // MVP: Pre-calculate caption states for all frames to improve performance
      let captionStates = null;
      if (captionsEnabled && transcript) {
        const captionStartTime = Date.now();
        captionStates = this.precalculateCaptionStates(transcript, duration, fps, clipStartMs, clipEndMs, jobId);
        const captionTime = Date.now() - captionStartTime;
        logger.debug('📋 Caption states pre-calculated', {
          jobId,
          captionStatesCount: Object.keys(captionStates).length,
          precalcTime: `${captionTime}ms`,
          performance: 'optimized'
        });
      }

      // Download and process podcast artwork once - cache for all frames
      let processedArtwork = null;
      if (podcast.artwork) {
        try {
          const artworkStartTime = Date.now();
          const artworkBuffer = await this.downloadArtwork(podcast.artwork, jobId);
          logger.debug('Podcast artwork downloaded', {
            jobId,
            artworkUrl: this.sanitizeUrl(podcast.artwork),
            size: `${Math.round(artworkBuffer.length / 1024)}KB`
          });

          // Pre-process artwork once for all frames (resize + rounded corners)
          const dimensions = this.getAspectRatioDimensions('9:16');
          const scaleFactor = dimensions.width / 375;
          const artworkSize = Math.floor(140 * scaleFactor);

          const resizedArtwork = await getSharp()(artworkBuffer)
            .resize(artworkSize, artworkSize, { fit: 'cover' })
            .png()
            .toBuffer();

          // Add rounded corners using Sharp's built-in method (20px to match app)
          processedArtwork = await getSharp()(resizedArtwork)
            .composite([{
              input: Buffer.from(
                `<svg><rect x="0" y="0" width="${artworkSize}" height="${artworkSize}" rx="20" ry="20"/></svg>`
              ),
              blend: 'dest-in'
            }])
            .png()
            .toBuffer();

          const artworkProcessTime = Date.now() - artworkStartTime;
          logger.debug('📊 Artwork pre-processed and cached', {
            jobId,
            processTime: `${artworkProcessTime}ms`,
            size: `${artworkSize}x${artworkSize}`,
            cacheForFrames: frameCount
          });
        } catch (error) {
          logger.warn('Failed to download/process podcast artwork, using placeholder', {
            jobId,
            error: error.message
          });
        }
      }

      const frames = [];
      
      // Generate frames
      for (let i = 0; i < frameCount; i++) {
        const frameStartTime = Date.now();
        const frameTime = i / fps;
        const progress = frameTime / duration;

        const framePath = path.join(frameDir, `frame_${i.toString().padStart(6, '0')}.png`);
        await this.generateSingleFrame(framePath, progress, podcast, processedArtwork, template, duration, jobId, i, transcript, captionsEnabled, clipStartMs, clipEndMs, captionStates);
        frames.push(framePath);

        const frameRenderTime = Date.now() - frameStartTime;

        // Log slow frames and progress milestones
        if (frameRenderTime > 1000 || i % 30 === 0 || i === frameCount - 1) {
          logger.debug('Frame generation progress', {
            jobId,
            frame: i + 1,
            totalFrames: frameCount,
            progress: `${Math.round(progress * 100)}%`,
            frameTime: `${frameRenderTime}ms`,
            avgTime: `${Math.round((Date.now() - startTime) / (i + 1))}ms`,
            hasCaptions: captionsEnabled && transcript ? 'yes' : 'no'
          });
        }

        // Warn on very slow frames
        if (frameRenderTime > 2000) {
          logger.warn(`⚠️ Slow frame detected`, {
            jobId,
            frame: i + 1,
            renderTime: `${frameRenderTime}ms`,
            captionsEnabled,
            hasTranscript: !!transcript
          });
        }
      }

      const generationTime = Date.now() - startTime;
      
      logger.success('SVG frame generation completed', {
        jobId,
        frameCount: frames.length,
        generationTime: `${generationTime}ms`,
        avgTimePerFrame: `${Math.round(generationTime / frameCount)}ms`,
        frameDir: path.basename(frameDir)
      });

      return {
        frames,
        frameDir,
        frameCount: frames.length,
        generationTime,
        fps
      };

    } catch (error) {
      logger.error('SVG frame generation failed', {
        jobId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // REVIEW-PERFORMANCE: Cache compiled template for better performance
  async getTemplate() {
    // Force template reload for now to ensure changes are applied
    const svgTemplate = await fs.readFile(this.templatePath, 'utf8');
    this.compiledTemplate = Handlebars.compile(svgTemplate);
    logger.debug('SVG template recompiled (forced reload)');
    return this.compiledTemplate;
  }

  // REVIEW-DESIGN: Single frame generation using SVG template
  async generateSingleFrame(framePath, progress, podcast, processedArtwork, template, duration, jobId, frameIndex = 0, transcript = null, captionsEnabled = false, clipStartMs = 0, clipEndMs = 0, captionStates = null) {
    const frameStartTime = Date.now();
    const timings = {};

    try {
      // Calculate dimensions for 9:16 aspect ratio
      const dimensions = this.getAspectRatioDimensions('9:16');
      
      // SCALING FIX: Scale from app dimensions (375px width) to video dimensions (1080px width)
      const scaleFactor = dimensions.width / 375; // ≈ 2.88x
      
      // EXACT APP LAYOUT CALCULATIONS - SCALED FOR VIDEO
      // App uses 140x140 artwork (matches Recording View exactly) - now scaled
      const artworkSize = Math.floor(140 * scaleFactor); // Scaled artwork size (integer)
      
      // UNIVERSAL 8% MARGINS - Apply to ALL elements (text, artwork, waveform)
      const MARGIN = dimensions.width * 0.08; // 8% margins from edges
      const contentWidth = Math.floor(dimensions.width - (MARGIN * 2)); // Available content width
      const waveformWidth = contentWidth; // Waveform uses same width as content
      const progressFill = Math.floor(waveformWidth * progress);

      // Format times
      const currentTime = this.formatTime(progress * duration * 1000);
      const totalTime = this.formatTime(duration * 1000);

      // EXACT APP SPACING - tight layout matching Recording View - SCALED
      // App uses very tight spacing: 15px between elements - now scaled
      const podcastTitleLines = this.wrapText((podcast.podcastName || 'Podcast').toUpperCase(), 18);
      const episodeTitleLines = this.wrapText(podcast.title || 'Podcast Episode', 35);
      const podcastTitleHeight = Math.floor(26 * scaleFactor) * podcastTitleLines.length;
      const artworkHeight = artworkSize;
      const episodeTitleHeight = Math.floor(20 * scaleFactor) * episodeTitleLines.length;
      const progressHeight = Math.floor(8 * scaleFactor);
      const margin = Math.floor(15 * scaleFactor);

      // CAPTION SPACE - Reserve 20% at bottom for future caption overlay
      const captionSpaceHeight = dimensions.height * 0.20; // 20% bottom space for captions
      const availableHeight = dimensions.height - captionSpaceHeight;

      // Calculate total content height with exact app margins - scaled
      const totalContentHeight = podcastTitleHeight + margin + artworkHeight + margin + episodeTitleHeight + Math.floor(8 * scaleFactor) + progressHeight + Math.floor(10 * scaleFactor) + Math.floor(30 * scaleFactor); // + time display
      const startY = (availableHeight - totalContentHeight) / 2;

      // Position elements with exact app spacing - scaled
      const podcastNameY = startY + Math.floor(26 * scaleFactor); // First line baseline
      const artworkY = startY + podcastTitleHeight + margin; // After title + margin
      const episodeTitleY = artworkY + artworkHeight + margin + Math.floor(20 * scaleFactor); // First line baseline
      // Calculate the actual bottom of the episode title (accounting for multiple lines and proper line height)
      const lineHeight = Math.floor(24 * scaleFactor); // SVG line height for episode title
      const episodeTitleBottom = episodeTitleY + (episodeTitleLines.length - 1) * lineHeight + Math.floor(20 * scaleFactor); // Add font size for last line

      // Position waveform directly below episode title with proper spacing
      const waveformY = episodeTitleBottom + Math.floor(60 * scaleFactor); // Good spacing from text
      const waveformHeight = Math.floor(40 * scaleFactor); // Decent height

      // Generate new progress system with dancing bars watermark
      // Use actual frame index for proper animation
      const progressElements = this.generateProgressElements(progress, dimensions, scaleFactor, episodeTitleBottom, frameIndex);
      // Move branding up to leave caption space at bottom
      const brandingY = dimensions.height - captionSpaceHeight + Math.floor(30 * scaleFactor);

      // MVP: Use pre-calculated caption state for performance
      let currentCaptionData = null;
      let currentCaption = '';
      if (captionsEnabled && captionStates) {
        currentCaptionData = captionStates[frameIndex] || null;
        currentCaption = currentCaptionData?.text || '';
      }

      // NEW: Precise caption positioning - between progress bar and watermark
      const progressBarBottom = progressElements.progressBar.y + progressElements.progressBar.height;
      const watermarkY = progressElements.watermarkText.y;
      const captionY = progressBarBottom + ((watermarkY - progressBarBottom) * 0.3); // 30% of space between elements

      const templateData = {
        width: dimensions.width,
        height: dimensions.height,
        marginX: Math.floor(MARGIN), // Left margin at 8%
        centerX: Math.floor(dimensions.width / 2), // True center of screen
        // Artwork positioning and size - CENTERED on screen
        artworkX: Math.floor((dimensions.width - artworkSize) / 2),
        artworkY: Math.floor(artworkY),
        artworkSize: artworkSize,
        // No timeline positioning needed - no time counters displayed
        // Text positioning - SCALED
        podcastNameY: Math.floor(podcastNameY),
        podcastNameSize: Math.floor(26 * scaleFactor), // App size scaled for video
        episodeTitleY: Math.floor(episodeTitleY),
        episodeTitleSize: Math.floor(20 * scaleFactor), // App size scaled for video
        brandingY: Math.floor(brandingY),
        // Content - wrapped text lines and new progress system
        podcastNameLines: podcastTitleLines,
        episodeTitleLines: episodeTitleLines,
        progressElements: progressElements,

        // MVP: Pre-calculated caption data for performance
        captionText: currentCaption,                    // Caption text for current time
        captionsEnabled: captionsEnabled,               // Show/hide captions
        captionLines: currentCaptionData?.lines || [],  // Pre-calculated line breaks
        captionY: Math.floor(captionY),                 // Precise Y position between progress bar and watermark
        captionDisplayMode: currentCaptionData?.displayMode || 'two-lines', // MVP: 'one-line' or 'two-lines'

        // Pre-calculated word highlighting data (no per-frame processing)
        captionWords: currentCaptionData?.highlightedWords || [], // Pre-processed word highlighting
        currentTimeMs: clipStartMs + (progress * (clipEndMs - clipStartMs)) // For template reference only
      };

      // Time SVG template rendering
      const svgStartTime = Date.now();
      // Render SVG with professional layout
      const svgContent = template(templateData);
      timings.svgTemplate = Date.now() - svgStartTime;

      // Time Sharp PNG conversion
      const sharpStartTime = Date.now();
      // Convert SVG to PNG using Sharp
      let frameBuffer = await getSharp()(Buffer.from(svgContent))
        .png()
        .toBuffer();
      timings.sharpConversion = Date.now() - sharpStartTime;

      // REVIEW-DESIGN: Composite pre-processed artwork if available
      if (processedArtwork) {
        const artworkStartTime = Date.now();
        // Composite pre-processed artwork onto frame with correct positioning
        frameBuffer = await getSharp()(frameBuffer)
          .composite([{
            input: processedArtwork,
            left: Math.round((dimensions.width - artworkSize) / 2),
            top: Math.round(artworkY),
            blend: 'over'
          }])
          .png()
          .toBuffer();
        timings.artworkComposite = Date.now() - artworkStartTime;
      }

      // Time file writing
      const writeStartTime = Date.now();
      // Save frame
      await fs.writeFile(framePath, frameBuffer);
      timings.fileWrite = Date.now() - writeStartTime;

      // Log total frame time and breakdown for slow frames
      const totalFrameTime = Date.now() - frameStartTime;
      if (totalFrameTime > 500 || frameIndex % 50 === 0) {
        logger.debug('📊 Frame timing breakdown', {
          jobId,
          frame: frameIndex,
          total: `${totalFrameTime}ms`,
          captionLookup: captionTime ? `${captionTime}ms` : 'N/A',
          svgTemplate: `${timings.svgTemplate}ms`,
          sharpConversion: `${timings.sharpConversion}ms`,
          artworkComposite: timings.artworkComposite ? `${timings.artworkComposite}ms` : 'N/A',
          fileWrite: `${timings.fileWrite}ms`
        });
      }

    } catch (error) {
      logger.error('Single SVG frame generation failed', {
        jobId,
        framePath: path.basename(framePath),
        progress,
        error: error.message
      });
      throw error;
    }
  }

  // BREATHING GRADIENT PROGRESS SYSTEM + DANCING BARS WATERMARK
  generateProgressElements(progress, dimensions, scaleFactor = 1, episodeTitleBottom, frameNumber = 0) {
    // ========================================
    // 1. BREATHING GRADIENT PROGRESS BAR
    // ========================================
    const progressWidth = dimensions.width * 0.84; // 84% width (8% margins each side)
    const progressX = dimensions.width * 0.08; // 8% left margin
    const progressY = episodeTitleBottom + (15 * scaleFactor); // 15px spacing below title as requested
    const progressHeight = 6 * scaleFactor;
    const progressFillWidth = progressWidth * progress; // progress = 0.0 to 1.0

    // ========================================
    // 2. DANCING BARS WATERMARK (BOTTOM-RIGHT)
    // ========================================
    const watermarkRightMargin = 20 * scaleFactor; // Properly scaled for 1080p (~54px)
    const watermarkBottomMargin = 20 * scaleFactor; // Properly scaled for 1080p (~54px)
    const watermarkX = dimensions.width - watermarkRightMargin - (60 * scaleFactor); // Even smaller total width
    const watermarkY = dimensions.height - watermarkBottomMargin;

    // Dancing bars configuration
    const barHeights = [6, 10, 8, 12, 7]; // Base heights in logical pixels
    const barWidth = 2 * scaleFactor;
    const barSpacing = 2 * scaleFactor;
    const barCenterY = watermarkY - (8 * scaleFactor); // Center line for bars

    // Generate dancing bars with animation
    const dancingBars = [];
    let barsX = watermarkX;
    for (let i = 0; i < 5; i++) {
      const baseHeight = barHeights[i] * scaleFactor;

      // Animation: bars oscillate around center line with staggered timing
      const animationPhase = (frameNumber * 0.1) + (i * 0.3);
      const animationScale = 0.6 + (0.4 * Math.sin(animationPhase));
      const animatedHeight = baseHeight * animationScale;

      // Position so bar extends up and down from center line
      const barY = barCenterY - (animatedHeight / 2);

      dancingBars.push({
        x: Math.floor(barsX),
        y: Math.floor(barY),
        width: Math.floor(barWidth),
        height: Math.floor(animatedHeight)
      });

      barsX += barWidth + barSpacing;
    }

    // Audio2 text position - only one character space from dancing bars
    const textX = barsX + (4 * scaleFactor); // Reduced from 8px to 4px for closer spacing
    const textY = watermarkY - (2 * scaleFactor);

    return {
      progressBar: {
        x: Math.floor(progressX),
        y: Math.floor(progressY),
        width: Math.floor(progressWidth),
        height: Math.floor(progressHeight),
        fillWidth: Math.floor(progressFillWidth)
      },
      dancingBars,
      watermarkText: {
        x: Math.floor(textX),
        y: Math.floor(textY),
        fontSize: Math.floor(12 * scaleFactor)
      }
    };
  }

  // REVIEW-CRITICAL: Download podcast artwork efficiently
  async downloadArtwork(artworkUrl, jobId) {
    const axios = require('axios');
    
    try {
      const response = await axios({
        method: 'GET',
        url: artworkUrl,
        responseType: 'arraybuffer',
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PodcastApp/1.0)',
        }
      });

      return Buffer.from(response.data);

    } catch (error) {
      logger.warn('Artwork download failed', {
        jobId,
        artworkUrl: this.sanitizeUrl(artworkUrl),
        error: error.message
      });
      throw error;
    }
  }

  // REVIEW-CLEANUP: Cleanup generated frames
  async cleanupFrames(frameDir, jobId) {
    try {
      const files = await fs.readdir(frameDir);
      for (const file of files) {
        await fs.unlink(path.join(frameDir, file));
      }
      await fs.rmdir(frameDir);
      
      logger.debug('Frame cleanup completed', {
        jobId,
        filesRemoved: files.length,
        dir: path.basename(frameDir)
      });
      
    } catch (error) {
      logger.warn('Frame cleanup failed', {
        jobId,
        frameDir: path.basename(frameDir),
        error: error.message
      });
    }
  }

  // Helper: Get dimensions based on aspect ratio
  getAspectRatioDimensions(aspectRatio) {
    switch (aspectRatio) {
      case '9:16':
        return { width: 1080, height: 1920 };
      case '1:1':
        return { width: 1080, height: 1080 };
      case '16:9':
        return { width: 1920, height: 1080 };
      default:
        return { width: 1080, height: 1920 };
    }
  }

  // Helper: Truncate text to fit
  truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  // Helper: Wrap text into multiple lines
  wrapText(text, maxCharsPerLine) {
    if (text.length <= maxCharsPerLine) {
      return [text]; // Single line
    }

    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Word is too long, truncate it
          lines.push(word.substring(0, maxCharsPerLine - 3) + '...');
          currentLine = '';
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    // Allow more lines for full episode title display - no artificial truncation

    return lines;
  }

  // Helper: Format time in MM:SS
  formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // Helper: Sanitize URL for logging
  sanitizeUrl(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return '[invalid-url]';
    }
  }

  // REVIEW-COST: Estimate frame generation cost
  estimateFrameGenerationCost(duration) {
    const fps = 12; // 12 frames per second
    const frameCount = Math.ceil(duration * fps);
    const costPerFrame = 0.0001; // $0.0001 per frame
    return frameCount * costPerFrame;
  }

  // NEW: Use SRT captions with proper timing (industry standard 1.5-7 seconds)
  getCurrentCaptionFromTranscript(transcript, currentTimeMs) {
    // PRIORITY 1: Use SRT captions if available (best for readability)
    if (transcript?.srtCaptions?.length) {
      // Find the caption that should be displayed at current time
      const currentCaption = transcript.srtCaptions.find(caption =>
        currentTimeMs >= caption.startMs && currentTimeMs <= caption.endMs
      );

      if (currentCaption) {
        // Return both text and word-level timing data
        return {
          text: currentCaption.text,
          words: currentCaption.words || [], // Word-level timing from caption processor
          startMs: currentCaption.startMs,
          endMs: currentCaption.endMs
        };
      }
      return null;
    }

    // FALLBACK: Use word-level data if no SRT captions
    if (transcript?.words?.length) {
      // IMPROVED: Time-based caption chunks for better readability
      const CAPTION_WINDOW_MS = 3000; // 3 second window for stable display
      const MAX_WORDS_PER_CAPTION = 8; // Reduced for 32-char limit

      // Find words in current time window
      const windowStart = Math.max(0, currentTimeMs - CAPTION_WINDOW_MS);
      const windowEnd = currentTimeMs + 1000; // Small lookahead

      const wordsInWindow = transcript.words.filter(word =>
        word.start >= windowStart && word.start <= windowEnd
      );

      if (wordsInWindow.length === 0) {
        // Fallback: show recent words if no words in window
        const wordsSpokenSoFar = transcript.words.filter(word =>
          word.start <= currentTimeMs
        );
        const recentWords = wordsSpokenSoFar.slice(-6); // Reduced for better readability
        const fallbackText = recentWords.map(w => w.text).join(' ').trim();
        return {
          text: fallbackText,
          words: recentWords,
          startMs: recentWords[0]?.start || currentTimeMs,
          endMs: recentWords[recentWords.length - 1]?.end || currentTimeMs
        };
      }

      // Take reasonable chunk size
      const captionWords = wordsInWindow.slice(0, MAX_WORDS_PER_CAPTION);
      const captionText = captionWords.map(w => w.text).join(' ');

      return {
        text: captionText.trim(),
        words: captionWords,
        startMs: captionWords[0]?.start || currentTimeMs,
        endMs: captionWords[captionWords.length - 1]?.end || currentTimeMs
      };
    }

    // Final fallback to utterance-based if no word-level data
    if (!transcript?.utterances?.length) return null;

    const currentUtterance = transcript.utterances.find(utterance =>
      currentTimeMs >= utterance.start && currentTimeMs <= utterance.end
    );

    if (currentUtterance) {
      return {
        text: currentUtterance.text,
        words: [], // No word-level data available
        startMs: currentUtterance.start,
        endMs: currentUtterance.end
      };
    }

    return null;
  }

  // MVP: Pre-calculate caption states for all frames to improve performance
  precalculateCaptionStates(transcript, duration, fps, clipStartMs, clipEndMs, jobId) {
    const captionStates = {};
    const frameCount = Math.round(duration * fps);

    // Get SRT captions if available (best performance)
    const captions = transcript?.srtCaptions || [];
    if (captions.length === 0) {
      logger.warn('No SRT captions found for pre-calculation', { jobId });
      return captionStates;
    }

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const frameProgress = frameIndex / (frameCount - 1);
      const currentTimeMs = clipStartMs + (frameProgress * (clipEndMs - clipStartMs));

      // Find current caption
      const currentCaption = captions.find(caption =>
        currentTimeMs >= caption.startMs && currentTimeMs <= caption.endMs
      );

      if (currentCaption) {
        // Pre-process word highlighting for this frame
        const highlightedWords = this.preprocessWordHighlighting(
          currentCaption.lines,
          currentCaption.words || [],
          currentTimeMs
        );

        captionStates[frameIndex] = {
          text: currentCaption.text,
          lines: currentCaption.lines,
          displayMode: currentCaption.displayMode || 'two-lines', // From caption processor
          words: currentCaption.words,
          highlightedWords: highlightedWords,
          startMs: currentCaption.startMs,
          endMs: currentCaption.endMs
        };
      }
    }

    logger.debug('Caption states pre-calculated', {
      jobId,
      totalFrames: frameCount,
      captionFrames: Object.keys(captionStates).length,
      coverage: `${Math.round(Object.keys(captionStates).length / frameCount * 100)}%`
    });

    return captionStates;
  }

  // Pre-process word highlighting with predictive overlap logic (no lag!)
  preprocessWordHighlighting(lines, words, currentTimeMs, frameDurationMs = 83.33) {
    if (!lines || !words || words.length === 0) {
      return [];
    }

    // Calculate frame's time window for overlap detection
    const frameStartMs = currentTimeMs;
    const frameEndMs = currentTimeMs + frameDurationMs; // 12fps = ~83.33ms per frame

    const result = [];

    for (const lineText of lines) {
      if (!lineText) continue;

      const lineWords = lineText.split(' ');
      const lineResult = [];

      // Match each word in the line to timing data
      let wordIndex = 0;
      for (const lineWord of lineWords) {
        const cleanLineWord = lineWord.toLowerCase().replace(/[^\w]/g, '');
        let isHighlighted = false;

        // Find matching word in caption timing data
        for (let i = wordIndex; i < words.length; i++) {
          const captionWord = words[i];
          const cleanCaptionWord = captionWord.text?.toLowerCase().replace(/[^\w]/g, '') || '';

          if (cleanLineWord === cleanCaptionWord) {
            // PREDICTIVE HIGHLIGHTING: Check for overlap between word time and frame time window
            // Word should be highlighted if ANY part of the word's duration overlaps with frame's display time
            const wordOverlapsFrame = (
              captionWord.start < frameEndMs && // Word starts before frame ends
              captionWord.end > frameStartMs    // Word ends after frame starts
            );

            isHighlighted = wordOverlapsFrame;
            wordIndex = i + 1; // Move to next word
            break;
          }
        }

        lineResult.push({
          text: lineWord,
          isHighlighted: isHighlighted
        });
      }

      result.push(lineResult);
    }

    return result;
  }

  // Helper to split long captions (respects 2-line max rule for readability)
  splitCaptionIntoLines(text, maxCharsPerLine = 32) { // Changed to 32 chars as per industry standard
    if (!text || text.length <= maxCharsPerLine) return [text];

    // For SRT captions, lines may already be optimized
    if (text.includes('\n')) {
      return text.split('\n').slice(0, 2); // Max 2 lines
    }

    // Try smart breaking at punctuation/conjunctions first
    const breakPoints = [', ', ' and ', ' but ', ' or ', ' - ', ': '];

    if (text.length <= maxCharsPerLine * 2) {
      for (const breakPoint of breakPoints) {
        const index = text.indexOf(breakPoint, Math.floor(text.length * 0.3));
        if (index > 0 && index < Math.floor(text.length * 0.7)) {
          return [
            text.substring(0, index + (breakPoint === ', ' ? 1 : 0)).trim(),
            text.substring(index + breakPoint.length).trim()
          ].slice(0, 2);
        }
      }
    }

    // Fallback to word boundary breaking
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
        if (lines.length >= 1) break; // Max 2 lines total for better readability
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines.slice(0, 2); // Enforce 2-line max for optimal mobile viewing
  }
}

module.exports = new FrameGenerator();