// Script to fetch and bundle podcast artwork for offline use
// Run with: node scripts/fetch-podcast-artwork.js

const fs = require('fs');
const path = require('path');
const https = require('https');

const POPULAR_PODCASTS_PATH = path.join(__dirname, '../popular-podcasts.json');
const OUTPUT_PATH = path.join(__dirname, '../src/data/bundled-artwork.json');

async function fetchArtworkFromRSS(rssUrl) {
  return new Promise((resolve, reject) => {
    https.get(rssUrl, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        // Extract podcast artwork from RSS feed
        const artworkMatch = data.match(/<itunes:image[^>]*href="([^"]*)"[^>]*\/?>/) ||
                             data.match(/<image[^>]*href="([^"]*)"[^>]*\/?>/) ||
                             data.match(/<media:content[^>]*url="([^"]*)"[^>]*\/?>/) ||
                             data.match(/<media:thumbnail[^>]*url="([^"]*)"[^>]*\/?>/);

        if (artworkMatch && artworkMatch[1]) {
          resolve(artworkMatch[1]);
        } else {
          reject(new Error('No artwork found in RSS'));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('📥 Loading popular-podcasts.json...');
  const podcastsData = JSON.parse(fs.readFileSync(POPULAR_PODCASTS_PATH, 'utf8'));

  const artworkBundle = {};
  let successCount = 0;
  let failCount = 0;

  // Get all podcasts from all categories
  const allPodcasts = podcastsData.categories.flatMap(category => category.podcasts);

  console.log(`\n🎨 Fetching artwork for ${allPodcasts.length} podcasts...\n`);

  for (const podcast of allPodcasts) {
    try {
      if (podcast.rssUrl) {
        console.log(`  Fetching: ${podcast.name}...`);
        const artwork = await fetchArtworkFromRSS(podcast.rssUrl);
        artworkBundle[podcast.name] = artwork;
        console.log(`  ✅ ${podcast.name}`);
        successCount++;

        // Be nice to servers - add small delay
        await new Promise(resolve => setTimeout(resolve, 200));
      } else {
        console.log(`  ⚠️  ${podcast.name} - No RSS URL`);
        failCount++;
      }
    } catch (error) {
      console.log(`  ❌ ${podcast.name} - ${error.message}`);
      failCount++;
    }
  }

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write bundled artwork
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(artworkBundle, null, 2));

  console.log(`\n✅ Done!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Output: ${OUTPUT_PATH}`);
  console.log(`\nNext steps:`);
  console.log(`1. Import this file in App.js: import BUNDLED_ARTWORK from './src/data/bundled-artwork.json'`);
  console.log(`2. Use BUNDLED_ARTWORK as initial state for popularPodcastsArtwork`);
  console.log(`3. Background fetch can still update artwork once per session`);
}

main().catch(console.error);
