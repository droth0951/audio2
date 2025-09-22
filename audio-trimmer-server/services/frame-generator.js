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

      // Download podcast artwork if available
      let artworkBuffer = null;
      if (podcast.artwork) {
        try {
          artworkBuffer = await this.downloadArtwork(podcast.artwork, jobId);
          logger.debug('Podcast artwork downloaded', { 
            jobId, 
            artworkUrl: this.sanitizeUrl(podcast.artwork),
            size: `${Math.round(artworkBuffer.length / 1024)}KB`
          });
        } catch (error) {
          logger.warn('Failed to download podcast artwork, using placeholder', {
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
        await this.generateSingleFrame(framePath, progress, podcast, artworkBuffer, template, duration, jobId, i, transcript, captionsEnabled, clipStartMs, clipEndMs);
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
  async generateSingleFrame(framePath, progress, podcast, artworkBuffer, template, duration, jobId, frameIndex = 0, transcript = null, captionsEnabled = false, clipStartMs = 0, clipEndMs = 0) {
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

      // NEW: Get current caption text using production-tested logic
      const clipDurationMs = clipEndMs - clipStartMs;
      const currentTimeMs = clipStartMs + (progress * clipDurationMs); // Absolute time for transcript lookup

      const captionStartTime = Date.now();
      const currentCaption = captionsEnabled && transcript
        ? this.getCurrentCaptionFromTranscript(transcript, currentTimeMs)
        : '';
      const captionTime = Date.now() - captionStartTime;

      // Log if caption processing is slow
      if (captionTime > 50) {
        logger.debug('Slow caption lookup', {
          jobId,
          frame: frameIndex,
          captionTime: `${captionTime}ms`,
          hasCaption: !!currentCaption
        });
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

        // NEW: Add caption data to existing template (NO visual changes to existing elements)
        captionText: currentCaption,          // Caption text for current time
        captionsEnabled: captionsEnabled,     // Show/hide captions
        captionLines: currentCaption ? this.splitCaptionIntoLines(currentCaption, 40) : [],
        captionY: Math.floor(captionY)        // Precise Y position between progress bar and watermark
      };


      // Render SVG with professional layout
      const svgContent = template(templateData);

      // Convert SVG to PNG using Sharp
      let frameBuffer = await getSharp()(Buffer.from(svgContent))
        .png()
        .toBuffer();

      // REVIEW-DESIGN: Composite podcast artwork if available
      if (artworkBuffer) {
        // Resize artwork to match the larger size
        const resizedArtwork = await getSharp()(artworkBuffer)
          .resize(artworkSize, artworkSize, { fit: 'cover' })
          .png()
          .toBuffer();

        // Add rounded corners to artwork using Sharp's built-in method (20px to match app)
        const roundedArtwork = await getSharp()(resizedArtwork)
          .composite([{
            input: Buffer.from(
              `<svg><rect x="0" y="0" width="${artworkSize}" height="${artworkSize}" rx="20" ry="20"/></svg>`
            ),
            blend: 'dest-in'
          }])
          .png()
          .toBuffer();

        // Composite artwork onto frame with correct positioning
        frameBuffer = await getSharp()(frameBuffer)
          .composite([{
            input: roundedArtwork,
            left: Math.round((dimensions.width - artworkSize) / 2),
            top: Math.round(artworkY),
            blend: 'over'
          }])
          .png()
          .toBuffer();
      }

      // Save frame
      await fs.writeFile(framePath, frameBuffer);

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

  // NEW: Use production CaptionService patterns (don't reinvent)
  getCurrentCaptionFromTranscript(transcript, currentTimeMs) {
    // Use word-level data if available (preferred for progressive captions like mobile app)
    if (transcript?.words?.length) {
      // MOBILE APP LOGIC: Show words that have already been spoken (progressive captions)
      const wordsSpokenSoFar = transcript.words.filter(word =>
        word.start <= currentTimeMs
      );

      // Show recent words (last 8 words like mobile app)
      const recentWords = wordsSpokenSoFar.slice(-8);
      const captionText = recentWords.map(w => w.text).join(' ');

      return captionText.trim();
    }

    // Fallback to utterance-based if no word-level data
    if (!transcript?.utterances?.length) return '';

    const currentUtterance = transcript.utterances.find(utterance =>
      currentTimeMs >= utterance.start && currentTimeMs <= utterance.end
    );

    return currentUtterance ? currentUtterance.text : '';
  }

  // Helper to split long captions (respects 3-line max rule)
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
}

module.exports = new FrameGenerator();