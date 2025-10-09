/**
 * Parse podcast URLs from various platforms
 * Extract episode info and timestamps
 */

export const parsePodcastURL = (url) => {
  if (!url) return null;

  // Spotify Episode Pattern
  if (url.includes('open.spotify.com/episode/')) {
    const episodeId = url.match(/episode\/([a-zA-Z0-9]+)/)?.[1];
    return {
      platform: 'spotify',
      episodeId,
      url,
      canExtractAudio: false, // Spotify doesn't provide direct audio
    };
  }

  // Spotify Show Pattern
  if (url.includes('open.spotify.com/show/')) {
    const showId = url.match(/show\/([a-zA-Z0-9]+)/)?.[1];
    return {
      platform: 'spotify',
      showId,
      url,
      canExtractAudio: false,
    };
  }

  // Apple Podcasts Pattern
  if (url.includes('podcasts.apple.com')) {
    const showId = url.match(/id(\d+)/)?.[1];
    const episodeId = url.match(/\?i=(\d+)/)?.[1];
    const timestamp = extractTimestamp(url);

    return {
      platform: 'apple',
      showId,
      episodeId,
      timestamp, // Will be in seconds, or null
      url,
      canExtractAudio: true, // Apple Podcasts have RSS feeds
    };
  }

  // Direct RSS Feed URL
  if (url.includes('.xml') || url.includes('rss') || url.includes('feed')) {
    return {
      platform: 'rss',
      url,
      canExtractAudio: true,
    };
  }

  // Unknown format
  return {
    platform: 'unknown',
    url,
    canExtractAudio: false,
  };
};

export const extractTimestamp = (url) => {
  // Apple Podcasts: &t=seconds
  const tMatch = url.match(/[&?]t=(\d+)/);
  if (tMatch) {
    return parseInt(tMatch[1]); // Return seconds as integer
  }
  return null;
};

export const formatTimestamp = (seconds) => {
  if (!seconds) return null;

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const getPlatformDisplayName = (platform) => {
  const names = {
    spotify: 'Spotify',
    apple: 'Apple Podcasts',
    rss: 'RSS Feed',
    unknown: 'Unknown Platform',
  };
  return names[platform] || 'Unknown';
};
