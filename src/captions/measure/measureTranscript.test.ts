import { measureTranscript, synthesizeParagraphBoundaries } from './measureTranscript';

// Mock transcript data for testing
const createTestTranscript = (words: Array<{text: string, startMs: number, endMs: number}>) => ({
  words,
  speaker: "Test Speaker"
});

const testTheme = {
  fontFamily: 'System',
  fontSize: 16,
  lineHeight: 20,
  maxWidthDp: 300,
  textColor: '#ffffff',
  paragraphSpacingDp: 8,
};

describe('measureTranscript - Paragraph Breaks', () => {
  test('punctuation-only break', async () => {
    const transcript = createTestTranscript([
      { text: "Hello.", startMs: 0, endMs: 500 },
      { text: "World", startMs: 800, endMs: 1200 }, // 300ms gap, but ends with period
    ]);
    
    const result = await measureTranscript(transcript, testTheme);
    
    // Should have paragraph break due to period + 300ms gap
    expect(result.lines.length).toBeGreaterThan(1);
    expect(result.lines[0].paragraphStart).toBe(true);
    expect(result.lines[1].paragraphStart).toBe(true);
  });

  test('long-gap-only break', async () => {
    const transcript = createTestTranscript([
      { text: "Hello", startMs: 0, endMs: 500 },
      { text: "World", startMs: 1500, endMs: 2000 }, // 1000ms gap
    ]);
    
    const result = await measureTranscript(transcript, testTheme);
    
    // Should have paragraph break due to 1000ms gap
    expect(result.lines.length).toBeGreaterThan(1);
    expect(result.lines[0].paragraphStart).toBe(true);
    expect(result.lines[1].paragraphStart).toBe(true);
  });

  test('combined break conditions', async () => {
    const transcript = createTestTranscript([
      { text: "First", startMs: 0, endMs: 500 },
      { text: "sentence.", startMs: 500, endMs: 1000 },
      { text: "Second", startMs: 1700, endMs: 2200 }, // 700ms gap + period
      { text: "paragraph", startMs: 2200, endMs: 2700 },
    ]);
    
    const result = await measureTranscript(transcript, testTheme);
    
    // Should have paragraph break
    expect(result.lines.length).toBeGreaterThan(1);
    // Check that paragraph spacing is applied
    expect(result.totalH).toBeGreaterThan(result.lines.length * testTheme.lineHeight);
  });

  test('no breaks', async () => {
    const transcript = createTestTranscript([
      { text: "Hello", startMs: 0, endMs: 500 },
      { text: "World", startMs: 600, endMs: 1100 }, // 100ms gap, no period
    ]);
    
    const result = await measureTranscript(transcript, testTheme);
    
    // Should not have paragraph break
    expect(result.lines[0].paragraphStart).toBe(true);
    if (result.lines.length > 1) {
      expect(result.lines[1].paragraphStart).toBe(false);
    }
  });

  test('custom paragraph boundaries', async () => {
    const transcript = createTestTranscript([
      { text: "Word1", startMs: 0, endMs: 500 },
      { text: "Word2", startMs: 600, endMs: 1100 },
      { text: "Word3", startMs: 1200, endMs: 1700 },
    ]);
    
    const customParagraphs = [{ startWordIdx: 2, endWordIdx: 1 }];
    const result = await measureTranscript(transcript, testTheme, customParagraphs);
    
    // Should have paragraph break at word index 2
    expect(result.lines.length).toBeGreaterThan(1);
    expect(result.lines[1].paragraphStart).toBe(true);
  });
});
