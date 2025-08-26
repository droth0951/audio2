import { buildWordsFromAssemblyAI, detectParagraphs, toTranscript } from './aaAdapter';
import { buildTimeToOffset, makeTimeToOffsetFn } from './timeToOffset';

// Mock AssemblyAI response data
const mockAssemblyAIResponse = {
  text: "Hello world. This is a test.",
  words: [
    { text: "Hello", start: 1000, end: 1500, confidence: 0.99 },
    { text: "world", start: 1500, end: 2000, confidence: 0.98 },
    { text: ".", start: 2000, end: 2100, confidence: 0.95 },
    { text: "This", start: 3000, end: 3500, confidence: 0.97 },
    { text: "is", start: 3500, end: 4000, confidence: 0.96 },
    { text: "a", start: 4000, end: 4500, confidence: 0.95 },
    { text: "test", start: 4500, end: 5000, confidence: 0.98 },
    { text: ".", start: 5000, end: 5100, confidence: 0.94 },
  ],
  utterances: [
    {
      text: "Hello world.",
      start: 1000,
      end: 2100,
      confidence: 0.99,
      speaker: "A",
      words: [
        { text: "Hello", start: 1000, end: 1500, confidence: 0.99 },
        { text: "world", start: 1500, end: 2000, confidence: 0.98 },
        { text: ".", start: 2000, end: 2100, confidence: 0.95 },
      ]
    },
    {
      text: "This is a test.",
      start: 3000,
      end: 5100,
      confidence: 0.97,
      speaker: "A",
      words: [
        { text: "This", start: 3000, end: 3500, confidence: 0.97 },
        { text: "is", start: 3500, end: 4000, confidence: 0.96 },
        { text: "a", start: 4000, end: 4500, confidence: 0.95 },
        { text: "test", start: 4500, end: 5000, confidence: 0.98 },
        { text: ".", start: 5000, end: 5100, confidence: 0.94 },
      ]
    }
  ]
};

describe('Caption Tests', () => {
  describe('Time Normalization', () => {
    test('normalizes times to clipStartMs', () => {
      const clipStartMs = 500;
      const words = buildWordsFromAssemblyAI(mockAssemblyAIResponse, clipStartMs);
      
      expect(words[0].startMs).toBe(500); // 1000 - 500
      expect(words[0].endMs).toBe(1000);   // 1500 - 500
      expect(words[1].startMs).toBe(1000); // 1500 - 500
      expect(words[1].endMs).toBe(1500);   // 2000 - 500
    });

    test('filters words outside clip range', () => {
      const clipStartMs = 2000;
      const words = buildWordsFromAssemblyAI(mockAssemblyAIResponse, clipStartMs);
      
      // Should filter out words that start before clipStartMs
      expect(words.length).toBeLessThan(mockAssemblyAIResponse.words.length);
      expect(words[0].startMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Paragraph Detection', () => {
    test('detects paragraphs with utterances present', () => {
      const transcript = toTranscript(mockAssemblyAIResponse, 0);
      
      // Should detect paragraph break between utterances
      expect(transcript.paragraphs.length).toBeGreaterThan(0);
      expect(transcript.paragraphs[0].startWordIdx).toBe(3); // "This" starts new paragraph
    });

    test('detects paragraphs with punctuation + gap fallback', () => {
      const responseWithoutUtterances = {
        text: "Hello world. This is a test.",
        words: [
          { text: "Hello", start: 1000, end: 1500, confidence: 0.99 },
          { text: "world", start: 1500, end: 2000, confidence: 0.98 },
          { text: ".", start: 2000, end: 2100, confidence: 0.95 },
          { text: "This", start: 3000, end: 3500, confidence: 0.97 }, // 900ms gap after period
          { text: "is", start: 3500, end: 4000, confidence: 0.96 },
          { text: "a", start: 4000, end: 4500, confidence: 0.95 },
          { text: "test", start: 4500, end: 5000, confidence: 0.98 },
          { text: ".", start: 5000, end: 5100, confidence: 0.94 },
        ]
      };
      
      const transcript = toTranscript(responseWithoutUtterances, 0);
      
      // Should detect paragraph break due to period + 900ms gap
      expect(transcript.paragraphs.length).toBeGreaterThan(0);
    });

    test('detects paragraphs with long gap only', () => {
      const responseWithLongGap = {
        text: "Hello world This is a test.",
        words: [
          { text: "Hello", start: 1000, end: 1500, confidence: 0.99 },
          { text: "world", start: 1500, end: 2000, confidence: 0.98 },
          { text: "This", start: 3000, end: 3500, confidence: 0.97 }, // 1000ms gap
          { text: "is", start: 3500, end: 4000, confidence: 0.96 },
          { text: "a", start: 4000, end: 4500, confidence: 0.95 },
          { text: "test", start: 4500, end: 5000, confidence: 0.98 },
          { text: ".", start: 5000, end: 5100, confidence: 0.94 },
        ]
      };
      
      const transcript = toTranscript(responseWithLongGap, 0);
      
      // Should detect paragraph break due to 1000ms gap
      expect(transcript.paragraphs.length).toBeGreaterThan(0);
    });
  });

  describe('Mapping Monotonicity', () => {
    test('ensures monotonic time-to-offset mapping', () => {
      const words = buildWordsFromAssemblyAI(mockAssemblyAIResponse, 0);
      const yByWordIndex = words.map((_, i) => i * 20); // Simple Y mapping
      const totalH = words.length * 20;
      
      const mapData = buildTimeToOffset(words, yByWordIndex, totalH);
      const mapFn = makeTimeToOffsetFn(mapData);
      
      // Test that mapping is monotonic
      let prevOffset = -1;
      for (let i = 0; i < mapData.times.length; i++) {
        const offset = mapData.offsets[i];
        expect(offset).toBeGreaterThanOrEqual(prevOffset);
        prevOffset = offset;
      }
      
      // Test that function returns monotonic results
      let prevResult = -1;
      for (let t = 0; t <= 6000; t += 100) {
        const result = mapFn(t);
        expect(result).toBeGreaterThanOrEqual(prevResult);
        prevResult = result;
      }
    });
  });

  describe('Hyphenation Handling', () => {
    test('collapses hyphenated tokens', () => {
      const responseWithHyphens = {
        text: "work-place",
        words: [
          { text: "work", start: 1000, end: 1500, confidence: 0.99 },
          { text: "-", start: 1500, end: 1600, confidence: 0.95 },
          { text: "place", start: 1600, end: 2000, confidence: 0.98 },
        ]
      };
      
      const words = buildWordsFromAssemblyAI(responseWithHyphens, 0);
      
      // Should collapse into single word
      expect(words.length).toBe(1);
      expect(words[0].text).toBe("workplace");
      expect(words[0].startMs).toBe(1000); // min(start)
      expect(words[0].endMs).toBe(2000);   // max(end)
    });
  });

  describe('Punctuation Merging', () => {
    test('merges stray punctuation onto previous word', () => {
      const responseWithPunctuation = {
        text: "Hello world!",
        words: [
          { text: "Hello", start: 1000, end: 1500, confidence: 0.99 },
          { text: "world", start: 1500, end: 2000, confidence: 0.98 },
          { text: "!", start: 2000, end: 2100, confidence: 0.95 },
        ]
      };
      
      const words = buildWordsFromAssemblyAI(responseWithPunctuation, 0);
      
      // Should merge punctuation
      expect(words.length).toBe(2);
      expect(words[1].text).toBe("world!");
    });
  });
});

// Device test helpers (for manual testing)
export const deviceTests = {
  // Test with real data clips
  async testRealDataClips() {
    console.log('Testing 15s and 60s clips at 1x & 1.25x...');
    // This would be implemented with actual AssemblyAI data
  },

  // Test seek functionality
  async testSeekFunctionality() {
    console.log('Testing seek: 10s → 1:30 → 5s...');
    // This would test instant snap behavior
  },

  // Test screen recording performance
  async testScreenRecordingPerformance() {
    console.log('Testing screen recording: frame time < 33ms...');
    // This would monitor frame times during recording
  }
};
