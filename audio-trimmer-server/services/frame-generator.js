// SVG + Sharp frame generation service for 9:16 videos

const sharp = require('sharp');
const Handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const config = require('../config/settings');

class FrameGenerator {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    this.templatePath = path.join(__dirname, '../templates/audio2-frame.svg');
    this.compiledTemplate = null; // Cache compiled template
  }

  // REVIEW-CRITICAL: Generate video frames with Audio2 design using SVG
  async generateFrames(audioPath, duration, podcast, jobId) {
    try {
      // REVIEW-CRITICAL: Feature flag check for frame generation
      if (!config.features.ENABLE_SERVER_VIDEO) {
        throw new Error('Frame generation disabled - server-side video generation is off');
      }

      const startTime = Date.now();
      const fps = 12; // 12 frames per second for smooth video playback
      const frameCount = Math.ceil(duration * fps);
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
        const frameTime = i / fps;
        const progress = frameTime / duration;
        
        const framePath = path.join(frameDir, `frame_${i.toString().padStart(6, '0')}.png`);
        await this.generateSingleFrame(framePath, progress, podcast, artworkBuffer, template, duration, jobId);
        frames.push(framePath);
        
        logger.debug('Generated frame', {
          jobId,
          frame: i + 1,
          totalFrames: frameCount,
          progress: `${Math.round(progress * 100)}%`
        });
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
  async generateSingleFrame(framePath, progress, podcast, artworkBuffer, template, duration, jobId) {
    try {
      // Calculate dimensions for 9:16 aspect ratio
      const dimensions = this.getAspectRatioDimensions('9:16');
      
      // SCALING FIX: Scale from app dimensions (375px width) to video dimensions (1080px width)
      const scaleFactor = dimensions.width / 375; // ≈ 2.88x
      
      // EXACT APP LAYOUT CALCULATIONS - SCALED FOR VIDEO
      // App uses 140x140 artwork (matches Recording View exactly) - now scaled
      const artworkSize = Math.floor(140 * scaleFactor); // Scaled artwork size (integer)
      
      // HORIZONTAL SAFE ZONES - 5% margins left/right for social media protection
      const horizontalSafeMargin = dimensions.width * 0.05; // 5% from left and right edges
      const contentWidth = Math.floor(dimensions.width - (horizontalSafeMargin * 2)); // Available content width
      const waveformWidth = contentWidth; // Waveform spans full width between safe margins
      const progressFill = Math.floor(waveformWidth * progress);

      // Format times
      const currentTime = this.formatTime(progress * duration * 1000);
      const totalTime = this.formatTime(duration * 1000);

      // EXACT APP SPACING - tight layout matching Recording View - SCALED
      // App uses very tight spacing: 15px between elements - now scaled
      const podcastTitleLines = this.wrapText((podcast.title || 'Podcast').toUpperCase(), 18);
      const episodeTitleLines = this.wrapText(podcast.episode || 'Podcast Episode', 35);
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
      // Position timeline closer to episode title
      const timeY = episodeTitleBottom + Math.floor(40 * scaleFactor); // Reduced spacing for closer timeline
      // Waveform positioned at SAME level as timeline - integrated into timeline display
      const waveformY = timeY; // Same Y position as time counters - integrated display

      // Generate combined progress waveform (replaces progress bar) - AFTER waveformY is calculated
      const progressWaveform = this.generateProgressWaveform(progress, dimensions, scaleFactor, waveformWidth, waveformY, horizontalSafeMargin);
      // Move branding up to leave caption space at bottom
      const brandingY = dimensions.height - captionSpaceHeight + Math.floor(30 * scaleFactor);


      const templateData = {
        width: dimensions.width,
        height: dimensions.height,
        centerX: Math.floor(horizontalSafeMargin + contentWidth / 2), // Center within safe area
        // Artwork positioning and size - centered within safe area
        artworkX: Math.floor(horizontalSafeMargin + (contentWidth - artworkSize) / 2),
        artworkY: Math.floor(artworkY),
        artworkSize: artworkSize,
        // Timeline positioning - aligned within safe area
        progressX: Math.floor(horizontalSafeMargin),
        timeY: Math.floor(timeY),
        waveformY: Math.floor(waveformY),
        progressWidth: waveformWidth,
        progressFill: progressFill,
        progressEndX: Math.floor(horizontalSafeMargin + waveformWidth),
        // Text positioning - SCALED
        podcastNameY: Math.floor(podcastNameY),
        podcastNameSize: Math.floor(26 * scaleFactor), // App size scaled for video
        episodeTitleY: Math.floor(episodeTitleY),
        episodeTitleSize: Math.floor(20 * scaleFactor), // App size scaled for video
        brandingY: Math.floor(brandingY),
        // Content - wrapped text lines
        podcastNameLines: podcastTitleLines,
        episodeTitleLines: episodeTitleLines,
        progressWaveform: progressWaveform,
        currentTime,
        totalTime
      };


      // Render SVG with professional layout
      const svgContent = template(templateData);

      // Convert SVG to PNG using Sharp
      let frameBuffer = await sharp(Buffer.from(svgContent))
        .png()
        .toBuffer();

      // REVIEW-DESIGN: Composite podcast artwork if available
      if (artworkBuffer) {
        // Resize artwork to match the larger size
        const resizedArtwork = await sharp(artworkBuffer)
          .resize(artworkSize, artworkSize, { fit: 'cover' })
          .png()
          .toBuffer();

        // Add rounded corners to artwork using Sharp's built-in method (20px to match app)
        const roundedArtwork = await sharp(resizedArtwork)
          .composite([{
            input: Buffer.from(
              `<svg><rect x="0" y="0" width="${artworkSize}" height="${artworkSize}" rx="20" ry="20"/></svg>`
            ),
            blend: 'dest-in'
          }])
          .png()
          .toBuffer();

        // Composite artwork onto frame with correct positioning
        frameBuffer = await sharp(frameBuffer)
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

  // PROGRESS WAVEFORM - Combined progress bar and waveform
  generateProgressWaveform(progress, dimensions, scaleFactor = 1, progressBarWidth, progressY, socialMediaMargin = 0) {
    const bars = [];

    // Use progress bar width instead of fixed width - more bars for smoother progress
    const totalBars = 25; // More bars for smoother progress visualization
    const barWidth = Math.floor(4 * scaleFactor); // Slightly thinner bars
    const barGap = Math.floor(2 * scaleFactor); // Tighter spacing

    // Generate consistent waveform pattern - use fixed seed for consistent heights across frames
    const baseHeights = [];
    for (let i = 0; i < totalBars; i++) {
      // Use deterministic pattern instead of random for smooth video
      const phase = (i / totalBars) * Math.PI * 4; // Create varied pattern
      const speechLike = (Math.sin(phase) + 1) * 0.2 + 0.3; // 30-70% base volume
      const peakPhase = (i / totalBars) * Math.PI * 8;
      const peaks = Math.sin(peakPhase) > 0.6 ? Math.cos(peakPhase) * 0.3 + 0.3 : 0; // Occasional peaks
      const heightFactor = Math.min(1.0, speechLike + Math.abs(peaks));
      baseHeights.push(Math.floor(heightFactor * 32 * scaleFactor)); // Max height scaled
    }

    // Calculate space BETWEEN the time counters for waveform placement
    const timeCounterWidth = Math.floor(60 * scaleFactor); // Approximate width needed for time text like "0:10"
    const waveformSpaceStart = socialMediaMargin + timeCounterWidth; // Start after left time counter
    const waveformSpaceEnd = socialMediaMargin + progressBarWidth - timeCounterWidth; // End before right time counter
    const availableWaveformWidth = waveformSpaceEnd - waveformSpaceStart;

    const totalWaveformWidth = (totalBars * barWidth) + ((totalBars - 1) * barGap);
    const actualWidth = Math.min(availableWaveformWidth, totalWaveformWidth);
    const startX = Math.floor(waveformSpaceStart + (availableWaveformWidth - actualWidth) / 2); // Center in available space

    // Use the actual progress bar Y position passed in

    for (let i = 0; i < totalBars; i++) {
      const x = startX + (i * (barWidth + barGap));

      // Skip bars that would exceed the progress bar width
      if (x + barWidth > startX + actualWidth) break;

      // Calculate this bar's position in the timeline
      const barProgress = i / totalBars;

      // Determine if this bar should be "played" (orange) or "unplayed" (grey)
      const isPlayed = barProgress <= progress;

      const baseHeight = baseHeights[i];

      // Use consistent height for smooth video (no janky frame-by-frame animation)
      const height = baseHeight;

      // Use the waveform position passed in (already positioned correctly)
      const y = progressY - height / 2; // Center waveform around the position

      bars.push({
        x: Math.floor(x),
        y: Math.floor(y),
        barWidth: barWidth,
        height: Math.floor(height),
        radius: Math.floor(2 * scaleFactor),
        // Color based on progress - orange if played, grey if not
        color: isPlayed ? '#d97706' : '#404040',
        opacity: isPlayed ? '0.9' : '0.6'
        // Removed animation for smooth video playback
      });
    }

    return bars;
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
}

module.exports = new FrameGenerator();