# Audio2 Share Intent - Simplified Implementation Guide
**Option B: Direct redirect approach using expo-share-intent**

---

## 🎯 FEATURE GOALS

### **What This Feature Does**
Enable Audio2 to appear in iOS share sheets when users share podcast episodes from apps like Spotify, Apple Podcasts, Overcast, or any podcast player. When tapped, Audio2 opens immediately with the shared podcast URL.

### **Target User Flow**

#### **Apple Podcasts (With Timestamp)**
```
1. User listening to "How I Built This" at 15:30
2. User taps Share → selects "From 15:30"
3. User taps "Audio2" icon in share sheet
4. Audio2 opens immediately
5. App shows: "Add How I Built This - starting at 15:30?"
6. User taps "Add" → Episode loads at 15:30
7. User creates clip
```

#### **Spotify (Search Required)**
```
1. User listening to "Joe Rogan Experience"
2. User shares episode
3. User taps "Audio2" in share sheet
4. Audio2 opens immediately
5. App shows: "Search for this podcast in Audio2?"
6. User confirms → Search/add podcast flow
7. User creates clip
```

### **Why This Approach**

**Simple and Effective:**
- ✅ No memory constraints (no custom UI in extension)
- ✅ No font scaling issues
- ✅ No App Groups complexity
- ✅ Fast implementation (~1 week)
- ✅ Easy to maintain
- ✅ Solves core problem: Get users into Audio2

**Technical Architecture:**
```
Share Sheet → expo-share-intent → Main App Opens → Parse URL → Show Add Podcast UI
```

No intermediate screen, no separate process, just direct handoff to main app.

---

## ✅ COMPLETED

- [x] Created feature branch: `feature/share-sheet`
- [x] Bumped runtime version from 1.4.0 to 1.5.0
- [x] Initiated development build: `eas build --profile development --platform ios --non-interactive`

---
Claude Code plan
Share Intent Implementation Plan (expo-share-intent)                                                   │ │
│ │                                                                                                        │ │
│ │ Step 1: Install expo-share-intent                                                                      │ │
│ │                                                                                                        │ │
│ │ npm install expo-share-intent                                                                          │ │
│ │                                                                                                        │ │
│ │ Step 2: Configure app.json                                                                             │ │
│ │                                                                                                        │ │
│ │ Add expo-share-intent plugin to EXISTING plugins array:                                                │ │
│ │ - Keep all current plugins (expo-media-library, expo-notifications, expo-font, expo-audio)             │ │
│ │ - Add expo-share-intent with iosActivationRules configuration                                          │ │
│ │ - Preserve current bundleIdentifier: com.danroth.podknowledge                                          │ │
│ │ - Preserve current version: 2.0.0                                                                      │ │
│ │ - Preserve current supportsTablet: true                                                                │ │
│ │                                                                                                        │ │
│ │ Step 3: Create PodcastURLParser utility                                                                │ │
│ │                                                                                                        │ │
│ │ - Create src/utils/PodcastURLParser.js                                                                 │ │
│ │ - Implement parsePodcastURL, extractTimestamp, formatTimestamp functions                               │ │
│ │ - Handle Spotify, Apple Podcasts, RSS feeds, unknown formats                                           │ │
│ │                                                                                                        │ │
│ │ Step 4: Add Share Intent Handler to App.js                                                             │ │
│ │                                                                                                        │ │
│ │ - Import useShareIntent hook from expo-share-intent                                                    │ │
│ │ - Add useEffect to handle share intents                                                                │ │
│ │ - Implement handleSharedURL, showAddPodcastPrompt, processPodcastURL functions                         │ │
│ │ - Add platform-specific handlers (Apple, Spotify, RSS)                                                 │ │
│ │ - Use TODOs for later integration with existing RSS feed system                                        │ │
│ │                                                                                                        │ │
│ │ Step 5: Commit Changes                                                                                 │ │
│ │                                                                                                        │ │
│ │ git add .                                                                                              │ │
│ │ git commit -m "Add expo-share-intent with podcast URL parsing"                                         │ │
│ │                                                                                                        │ │
│ │ Step 6: Test with Development Build                                                                    │ │
│ │                                                                                                        │ │
│ │ - Wait for current EAS build to complete                                                               │ │
│ │ - Install on physical iPhone                                                                           │ │
│ │ - Test with Apple Podcasts (with timestamp)                                                            │ │
│ │ - Test with Spotify                                                                                    │ │
│ │ - Verify console logs and alert behavior                                                               │ │
│ │                                                                                                        │ │
│ │ Why This Approach:                                                                                     │ │
│ │                                                                                                        │ │
│ │ ✅ Simple MVP (no custom UI, direct redirect)                                                           │ │
│ │ ✅ Handles all major podcast platforms                                                                  │ │
│ │ ✅ Apple Podcasts timestamp detection works                                                             │ │
│ │ ✅ Spotify gracefully handled (search fallback)                                                         │ │
│ │ ✅ Fast implementation (~3-4 days)                                                                      │ │
│ │ ✅ Can push production OTA fixes on main branch in parallel     

---

## 📋 IMPLEMENTATION STEPS

### Step 1: Install expo-share-intent
```bash
# Make sure you're on feature branch
git checkout feature/share-sheet

# Install the package
npm install expo-share-intent

# Verify installation
npm list expo-share-intent
```

---

### Step 2: Configure app.json
Add the expo-share-intent plugin:

```json
{
  "expo": {
    "name": "Audio2",
    "slug": "podknowledge",
    "version": "1.0.0",
    "runtimeVersion": "1.5.0",
    "scheme": "audio2",
    "ios": {
      "bundleIdentifier": "com.danroth.audio2",
      "supportsTablet": false
    },
    "plugins": [
      [
        "expo-share-intent",
        {
          "iosActivationRules": {
            "NSExtensionActivationSupportsWebURLWithMaxCount": 1
          }
        }
      ]
    ]
  }
}
```

**What this does:**
- Registers Audio2 for URL sharing
- Appears when users share web URLs
- No custom UI, direct redirect to main app

---

### Step 3: Create URL Parser Utility
**File:** `src/utils/PodcastURLParser.js`

```javascript
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
```

---

### Step 4: Add Share Intent Handler to App.js

Add this to your main `App.js` component:

```javascript
import { useEffect } from 'react';
import { useShareIntent } from 'expo-share-intent';
import { Alert } from 'react-native';
import { parsePodcastURL, formatTimestamp, getPlatformDisplayName } from './src/utils/PodcastURLParser';

// Inside your main App component:
export default function App() {
  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntent();

  useEffect(() => {
    if (hasShareIntent && shareIntent) {
      handleSharedURL(shareIntent);
    }
  }, [hasShareIntent, shareIntent]);

  const handleSharedURL = async (intent) => {
    try {
      console.log('📎 Received share intent:', intent);

      // Extract URL from share intent
      // expo-share-intent provides: { text, webUrl, files }
      const sharedURL = intent.webUrl || intent.text;

      if (!sharedURL) {
        Alert.alert('Error', 'No URL found in shared content');
        resetShareIntent();
        return;
      }

      // Parse podcast URL
      const parsed = parsePodcastURL(sharedURL);

      if (!parsed) {
        Alert.alert('Error', 'Could not parse podcast URL');
        resetShareIntent();
        return;
      }

      console.log('🎧 Parsed podcast data:', parsed);

      // Show user a prompt to add podcast
      showAddPodcastPrompt(parsed);

    } catch (error) {
      console.error('❌ Failed to handle shared URL:', error);
      Alert.alert('Error', 'Something went wrong processing the shared podcast');
      resetShareIntent();
    }
  };

  const showAddPodcastPrompt = (podcastData) => {
    const platform = getPlatformDisplayName(podcastData.platform);
    const timestamp = podcastData.timestamp ? formatTimestamp(podcastData.timestamp) : null;

    let message = `Add podcast from ${platform}?`;
    if (timestamp) {
      message += `\n\nStarting at ${timestamp}`;
    }

    Alert.alert(
      'Add Podcast',
      message,
      [
        {
          text: 'Cancel',
          onPress: () => resetShareIntent(),
          style: 'cancel',
        },
        {
          text: 'Add',
          onPress: () => processPodcastURL(podcastData),
        },
      ]
    );
  };

  const processPodcastURL = async (podcastData) => {
    try {
      console.log('🎯 Processing podcast:', podcastData);

      // TODO: Implement based on platform
      if (podcastData.platform === 'apple') {
        await handleApplePodcast(podcastData);
      } else if (podcastData.platform === 'spotify') {
        await handleSpotifyPodcast(podcastData);
      } else if (podcastData.platform === 'rss') {
        await handleRSSPodcast(podcastData);
      } else {
        Alert.alert('Not Supported', 'This podcast platform is not yet supported');
      }

      // Clear the share intent
      resetShareIntent();

    } catch (error) {
      console.error('❌ Failed to process podcast:', error);
      Alert.alert('Error', 'Could not add podcast');
      resetShareIntent();
    }
  };

  const handleApplePodcast = async (data) => {
    console.log('🍎 Handling Apple Podcasts URL');
    
    // Strategy: Get RSS feed from iTunes API
    try {
      const response = await fetch(
        `https://itunes.apple.com/lookup?id=${data.showId}`
      );
      const result = await response.json();
      
      if (result.results && result.results[0]) {
        const rssFeedURL = result.results[0].feedUrl;
        console.log('📡 Found RSS feed:', rssFeedURL);
        
        // TODO: Add this RSS feed to your app's podcast list
        // TODO: If episodeId provided, navigate to that episode
        // TODO: If timestamp provided, seek to that position
        
        Alert.alert('Success', 'Podcast added! (TODO: Implement full flow)');
      } else {
        Alert.alert('Error', 'Could not find podcast RSS feed');
      }
    } catch (error) {
      console.error('Failed to fetch Apple Podcasts data:', error);
      Alert.alert('Error', 'Could not load podcast');
    }
  };

  const handleSpotifyPodcast = async (data) => {
    console.log('🎵 Handling Spotify URL');
    
    // Strategy: Spotify doesn't provide audio, so prompt user to search
    Alert.alert(
      'Spotify Podcast',
      'Spotify podcasts need to be added via RSS feed. Would you like to search for this podcast?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Search',
          onPress: () => {
            // TODO: Open search screen or podcast search flow
            console.log('TODO: Open search for Spotify podcast');
            Alert.alert('TODO', 'Search functionality not yet implemented');
          },
        },
      ]
    );
  };

  const handleRSSPodcast = async (data) => {
    console.log('📡 Handling RSS feed URL');
    
    // TODO: Parse RSS feed and add to podcast list
    // This is your existing RSS parsing logic
    Alert.alert('Success', 'RSS feed added! (TODO: Implement full flow)');
  };

  // Rest of your existing App.js code...
  
  return (
    // Your existing app UI
  );
}
```

---

### Step 5: Commit Changes
```bash
git add .
git commit -m "Add expo-share-intent with podcast URL parsing"
```

---

### Step 6: Build & Test

#### Wait for Current Build to Complete
```bash
# Check build status
eas build:list --platform ios --profile development

# Once complete, download and install on iPhone
```

#### Testing Checklist
- [ ] Install development build on iPhone
- [ ] Open Apple Podcasts app
- [ ] Play an episode at a specific timestamp (e.g., 15:30)
- [ ] Tap Share → "Share Episode..." → Select "From 15:30"
- [ ] Verify Audio2 appears in share sheet
- [ ] Tap Audio2 icon
- [ ] Verify Audio2 opens immediately (no extension screen)
- [ ] Verify alert shows: "Add podcast from Apple Podcasts? Starting at 15:30"
- [ ] Check console logs for parsed data

**Spotify Testing:**
- [ ] Open Spotify app
- [ ] Share an episode
- [ ] Tap Audio2 in share sheet
- [ ] Verify Audio2 opens
- [ ] Verify prompt explains Spotify requires search
- [ ] Check console logs for Spotify URL parsing

---
CLAUDE PLAN -- USE FOR REFERENCE, BUT IMPLEMENT CLAUDE CODE PLAN
## 📋 PHASE 2: Integration with Existing Audio2 Features

### Step 7: Connect to Your RSS Feed System

Replace the TODO placeholders with your actual implementation:

```javascript
const handleApplePodcast = async (data) => {
  try {
    // Get RSS feed from iTunes
    const response = await fetch(
      `https://itunes.apple.com/lookup?id=${data.showId}`
    );
    const result = await response.json();
    
    if (result.results && result.results[0]) {
      const rssFeedURL = result.results[0].feedUrl;
      
      // REPLACE THIS with your actual RSS feed loading logic
      // This is wherever you currently load podcasts
      await loadPodcastFromRSS(rssFeedURL);
      
      // If specific episode was shared, navigate to it
      if (data.episodeId) {
        // REPLACE with your navigation logic
        navigateToEpisode(data.episodeId);
        
        // If timestamp provided, seek to it
        if (data.timestamp) {
          // REPLACE with your audio seek logic
          seekToTimestamp(data.timestamp);
        }
      }
      
      Alert.alert('Success', 'Podcast loaded!');
    }
  } catch (error) {
    console.error('Failed to load podcast:', error);
    Alert.alert('Error', 'Could not load podcast');
  }
};
```

### Step 8: Add Loading States

Improve UX with loading indicators:

```javascript
const [isLoadingSharedPodcast, setIsLoadingSharedPodcast] = useState(false);

const processPodcastURL = async (podcastData) => {
  setIsLoadingSharedPodcast(true);
  
  try {
    // Your processing logic...
    
    setIsLoadingSharedPodcast(false);
  } catch (error) {
    setIsLoadingSharedPodcast(false);
    Alert.alert('Error', 'Could not add podcast');
  }
};

// Show loading indicator in your UI
{isLoadingSharedPodcast && (
  <View style={styles.loadingOverlay}>
    <ActivityIndicator size="large" color="#d97706" />
    <Text>Loading podcast...</Text>
  </View>
)}
```

---

## 🎯 SUCCESS CRITERIA

**Before merging to production:**
- [ ] Share intent appears in iOS share sheet
- [ ] Audio2 opens when tapped (no crashes)
- [ ] Apple Podcasts URLs parsed correctly
- [ ] Timestamps extracted from Apple Podcasts URLs
- [ ] Spotify URLs parsed correctly
- [ ] User sees clear prompts for each platform
- [ ] Console logs show correct data parsing
- [ ] Integration with existing RSS feed system works
- [ ] Episode navigation works (if applicable)
- [ ] Timestamp seeking works (if applicable)

---

## 📝 TROUBLESHOOTING

### Share Intent Not Appearing in Share Sheet
**Check:**
- [ ] expo-share-intent plugin in app.json
- [ ] iosActivationRules configured correctly
- [ ] Built with EAS (not Expo Go)
- [ ] Testing on physical device (not simulator)
- [ ] Sharing a URL (not just text)

**Solution:**
```bash
# Rebuild with plugin
eas build --profile development --platform ios --clear-cache
```

### App Not Opening When Share Intent Tapped
**Check:**
- [ ] URL scheme `audio2://` configured in app.json
- [ ] useShareIntent hook is imported and used
- [ ] Console logs show share intent received

**Debug:**
```javascript
// Add extensive logging
const { hasShareIntent, shareIntent, error } = useShareIntent();

console.log('Share Intent Status:', {
  hasShareIntent,
  shareIntent,
  error,
});
```

### URL Parsing Fails
**Check:**
- [ ] Console logs show the actual URL received
- [ ] URL matches expected pattern
- [ ] parsePodcastURL returns valid object

**Test manually:**
```javascript
// Test your parser with known URLs
const testURLs = [
  'https://podcasts.apple.com/us/podcast/stuff-you-should-know/id278981407?i=1000123456&t=930',
  'https://open.spotify.com/episode/3KzQGTTqLGOVFQ2LZqLVXX',
];

testURLs.forEach(url => {
  console.log('Testing:', url);
  console.log('Result:', parsePodcastURL(url));
});
```

---

## 🚀 DEPLOYMENT TO PRODUCTION

### Step 9: Merge to Main Branch

**After thorough testing:**
```bash
# Switch to main branch
git checkout main

# Merge feature branch
git merge feature/share-sheet

# Push to GitHub
git push origin main
```

### Step 10: Build Production Version
```bash
# Build for App Store
eas build --profile production --platform ios

# Wait for build to complete (7-10 minutes)

# Submit to App Store
eas submit --platform ios
```

### Step 11: Update App Store Listing

**What's New in Version 1.1.0:**
```
New: Share podcasts directly to Audio2! 

Now you can share episodes from Apple Podcasts, Spotify, 
and other podcast apps directly to Audio2. Just tap the 
share button and select Audio2 to quickly create clips 
from your favorite podcasts.

Bug fixes and performance improvements.
```

---

## 🎉 FEATURE COMPLETE

**You've successfully implemented:**
- ✅ Share sheet integration with expo-share-intent
- ✅ URL parsing for Apple Podcasts, Spotify, RSS feeds
- ✅ Automatic timestamp extraction from Apple Podcasts
- ✅ Direct handoff to main Audio2 app
- ✅ User-friendly prompts and error handling
- ✅ Console logging for debugging
- ✅ Production-ready implementation

**Total implementation time: ~1 week**

**Users can now:**
- Share podcasts from any app to Audio2
- Get automatic timestamp detection (Apple Podcasts)
- Quickly add podcasts without manual searching
- Create clips faster than ever

---

## 📊 MONITORING SUCCESS

### Track These Metrics
- **Share intent usage**: How many users tap Audio2 in share sheet
- **Platform breakdown**: Apple Podcasts vs Spotify vs other
- **Conversion rate**: Share intent → podcast added → clip created
- **User feedback**: App Store reviews mentioning sharing

### If Feature is Successful
Consider these enhancements:
- Direct episode loading (skip confirmation prompt)
- Smarter Spotify handling (auto-search by podcast name)
- Support for more podcast platforms (Overcast, Castro, Pocket Casts)
- Recent shares history
- Share from Audio2 back to social media

---

**This simplified approach gets you 90% of the value with 30% of the complexity. Ship it, learn from user behavior, and iterate based on real usage data.** 🚀
