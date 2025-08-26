import AsyncStorage from '@react-native-async-storage/async-storage';

type Word = {
  text: string;
  startMs: number;
  endMs: number;
};

type ParagraphBoundary = {
  startWordIdx: number;
  endWordIdx: number;
};

type CaptionTheme = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  maxWidthDp: number;
  textColor: string;
  paragraphSpacingDp: number;
};

type Line = {
  text: string;
  startWordIdx: number;
  endWordIdx: number;
  paragraphStart: boolean;
};

type CachedLayout = {
  layoutV: number;
  words: Word[];
  paragraphs: ParagraphBoundary[];
  lines: Line[];
  yByWordIndex: number[];
  totalH: number;
  anchors: {
    times: number[];
    offsets: number[];
  };
};

type CacheKey = string;

// Create theme fingerprint for cache invalidation
export function createThemeFingerprint(theme: CaptionTheme): string {
  const { fontFamily, fontSize, lineHeight, maxWidthDp, paragraphSpacingDp } = theme;
  return `${fontFamily}-${fontSize}-${lineHeight}-${maxWidthDp}-${paragraphSpacingDp}`;
}

// Create cache key
export function createCacheKey(
  episodeId: string,
  clipStart: number,
  clipEnd: number,
  themeFingerprint: string
): CacheKey {
  return `${episodeId}-${clipStart}-${clipEnd}-${themeFingerprint}`;
}

// Store layout in cache
export async function cacheLayout(
  key: CacheKey,
  layout: Omit<CachedLayout, 'layoutV'>
): Promise<void> {
  try {
    const cachedLayout: CachedLayout = {
      ...layout,
      layoutV: 1,
    };
    
    await AsyncStorage.setItem(key, JSON.stringify(cachedLayout));
  } catch (error) {
    console.warn('Failed to cache layout:', error);
  }
}

// Retrieve layout from cache
export async function getCachedLayout(key: CacheKey): Promise<CachedLayout | null> {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;
    
    const layout: CachedLayout = JSON.parse(cached);
    
    // Check version compatibility
    if (layout.layoutV !== 1) {
      console.warn('Cached layout version mismatch, ignoring:', layout.layoutV);
      return null;
    }
    
    return layout;
  } catch (error) {
    console.warn('Failed to retrieve cached layout:', error);
    return null;
  }
}

// Clear all cached layouts
export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const captionKeys = keys.filter(key => key.includes('-'));
    await AsyncStorage.multiRemove(captionKeys);
  } catch (error) {
    console.warn('Failed to clear caption cache:', error);
  }
}

// Get cache size (for debugging)
export async function getCacheSize(): Promise<number> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter(key => key.includes('-')).length;
  } catch (error) {
    console.warn('Failed to get cache size:', error);
    return 0;
  }
}
