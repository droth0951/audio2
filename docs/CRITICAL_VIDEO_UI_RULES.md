# ⛔ CRITICAL: Video UI is FINALIZED - DO NOT MODIFY

## 🚨 ABSOLUTE RULES FOR VIDEO GENERATION CODE

### ⛔ NEVER MODIFY THESE FILES OR FEATURES:
- **audio-trimmer-server/services/frame-generator.js** - Video frame generation is PERFECT
- **audio-trimmer-server/templates/audio2-frame.svg** - SVG template is FINAL
- **Any visual/UI generation code**
- **Canvas/HTML rendering logic**
- **Color schemes** (#d97706 orange, gradients, backgrounds)
- **Layouts and positioning**
- **Caption positioning or styling** (y=80 position is calibrated)
- **Waveform/dancing bars visualization**
- **Breathing gradient progress bar**
- **Any animation timing or easing functions**

## ✅ WHAT CAN BE MODIFIED:
- Bug fixes in video processing pipeline (NOT visual bugs)
- Performance optimizations (that don't change output)
- Caption text content integration (NOT positioning)
- Audio processing and trimming
- API endpoints and job handling
- Error handling and logging
- Cost tracking and analytics
- Background job processing

## 🎯 WHY THIS MATTERS:
The video output design has been perfected over MANY iterations:
- The breathing gradient progress bar is exactly calibrated
- The dancing bars watermark animation is precisely timed
- The layout matches Audio2 app's UI perfectly at 1080px
- Colors match the Audio2 brand aesthetic exactly
- Caption positioning avoids overlapping with UI elements

**ANY visual changes will break the carefully crafted Audio2 brand aesthetic.**

## 📋 WHEN TESTING VIDEO GENERATION:
- Test the FUNCTIONALITY (does it generate? does it complete?)
- Test the PERFORMANCE (how long does it take?)
- Test the RELIABILITY (does it handle errors?)
- DO NOT test or modify the visual output

## 🔴 IF YOU THINK YOU NEED TO MODIFY VISUALS:
**STOP.** The answer is NO. The visuals are final. Find another solution that doesn't touch:
- frame-generator.js
- audio2-frame.svg
- Any color values
- Any positioning values
- Any animation timing

## 💀 CONSEQUENCES OF BREAKING THIS RULE:
Breaking the visual design means:
- Hours of work getting it pixel-perfect will be lost
- The Audio2 brand consistency will be broken
- Users will see inconsistent output
- You'll have to manually revert all changes

**This is not a suggestion. This is a hard requirement.**

---
Last Updated: 2025-09-19
Reason: Video UI has been finalized after extensive testing and calibration