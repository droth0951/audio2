# Episode Search Feature Plan

## 🎯 Vision
Enable users to search for specific episodes across all podcasts by episode title and content, not just podcast names.

**Example searches:**
- "daily protein" → finds "How Protein Took Over America" from The Daily
- "tesla earnings" → finds recent Tesla earnings episodes across all business podcasts  
- "ukraine war" → finds relevant episodes from multiple news podcasts
- "interview with tim cook" → finds CEO interviews across shows

## 🔍 Current State Analysis

### What Works Now
- Podcast-level search (find shows by name)
- RSS parsing and caching infrastructure
- Episode metadata extraction (title, description, pubDate)

### What's Missing
- Episode content indexing
- Cross-podcast episode search
- Text matching/ranking system
- Search result presentation

## 📋 Implementation Plan

### Phase 1: Data Foundation
**Goal:** Build episode search index without changing UI

#### 1.1 Enhance Episode Data Structure
```javascript
// Current episode object
{
  id: 0,
  title: "How Protein Took Over America",
  description: "A deep dive into protein trends...",
  pubDate: "2025-01-15",
  audioUrl: "...",
  artwork: "..."
}

// Enhanced episode object
{
  id: "daily_20250115_protein", // Unique across all podcasts
  title: "How Protein Took Over America",
  description: "A deep dive into protein trends...",
  searchableText: "how protein took over america deep dive protein trends nutrition health food industry", // Processed for search
  pubDate: "2025-01-15",
  podcastTitle: "The Daily",
  podcastId: "the_daily",
  audioUrl: "...",
  artwork: "...",
  duration: "00:25:30" // Add if available
}
```

#### 1.2 Create Episode Index Storage
```javascript
// AsyncStorage structure
{
  "episode_search_index": {
    "episodes": [...allEpisodesFromAllPodcasts],
    "lastUpdated": "2025-01-15T10:00:00Z",
    "podcastCount": 15,
    "episodeCount": 847
  }
}
```

#### 1.3 Build Indexing System
- Extract searchable text from title + description
- Remove HTML tags, normalize text
- Store episodes from all cached podcasts in unified index
- Update index when new podcasts are loaded

### Phase 2: Search Engine
**Goal:** Implement episode search logic

#### 2.1 Text Matching Algorithm
```javascript
// Simple but effective approach
const searchEpisodes = (query, episodes) => {
  const normalizedQuery = query.toLowerCase().trim();
  const queryWords = normalizedQuery.split(/\s+/);
  
  return episodes
    .map(episode => ({
      episode,
      score: calculateRelevanceScore(episode, queryWords)
    }))
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20); // Limit results
};

const calculateRelevanceScore = (episode, queryWords) => {
  let score = 0;
  const title = episode.title.toLowerCase();
  const searchText = episode.searchableText.toLowerCase();
  
  queryWords.forEach(word => {
    // Title matches get higher weight
    if (title.includes(word)) score += 3;
    // Description matches get lower weight  
    if (searchText.includes(word)) score += 1;
    // Exact phrase matching bonus
    if (title.includes(queryWords.join(' '))) score += 5;
  });
  
  return score;
};
```

#### 2.2 Search Performance Optimization
- Index episodes by first letter for faster lookup
- Cache recent search results
- Debounce search input (300ms delay)
- Limit to most recent 1000 episodes for speed

### Phase 3: UI Integration  
**Goal:** Add episode search to existing search interface

#### 3.1 Enhanced Search Results
```javascript
// Current: Just shows podcasts
[
  { type: 'podcast', title: 'The Daily', ... }
]

// Enhanced: Shows podcasts AND episodes
[
  { type: 'podcast', title: 'The Daily', ... },
  { type: 'episode', title: 'How Protein Took Over America', podcastTitle: 'The Daily', ... },
  { type: 'episode', title: 'The Protein Revolution', podcastTitle: 'Science Today', ... }
]
```

#### 3.2 Search Result UI
- **Podcast results:** Show as current (podcast artwork + name)
- **Episode results:** Show with podcast context
  ```
  🎧 The Daily
     📻 How Protein Took Over America
     Jan 15 • 25 min
  ```

#### 3.3 Search Behavior
- Search input length < 3: Show popular podcasts (current behavior)
- Search input length >= 3: Show mixed podcast + episode results
- Tap episode result: Load podcast + jump to that episode
- Clear visual distinction between podcast and episode results

### Phase 4: Advanced Features
**Goal:** Polish and enhancement

#### 4.1 Search Improvements
- Fuzzy matching for typos ("protien" → "protein")  
- Date filtering ("tesla earnings last month")
- Podcast filtering ("daily protein" limits to The Daily episodes)
- Search within specific timeframes

#### 4.2 User Experience
- Search history/suggestions
- "Recently searched episodes"  
- Quick filters (This Week, This Month, News, Business, etc.)

#### 4.3 Performance & Caching
- Background index updates
- Compressed storage for episode index
- Search analytics to improve ranking

## 🛠 Technical Considerations

### Data Management
- **Index size**: ~50KB per 1000 episodes (acceptable for mobile)
- **Update strategy**: Incremental updates when podcasts refresh
- **Storage**: Use AsyncStorage with compression for episode index

### Search Performance
- **Target response time**: <100ms for search results
- **Memory usage**: Load index on app start, keep in memory
- **Network**: No additional API calls needed (uses existing RSS cache)

### Backward Compatibility  
- No breaking changes to current search
- Episode search is additive to existing podcast search
- Fallback to podcast-only search if episode index unavailable

## 🚀 Implementation Priority

### High Impact, Low Effort
1. **Phase 1.1-1.2**: Enhance data structure and storage (2-3 hours)
2. **Phase 2.1**: Basic text matching search (2-3 hours)  
3. **Phase 3.1-3.2**: UI integration (3-4 hours)

### Total Estimate: ~8-10 hours of development

### Success Metrics
- Users can find episodes by content, not just show names
- Search success rate improves (users find what they're looking for)
- Engagement increases (users discover more episodes)

## 📝 Future Considerations

### Potential Enhancements
- **Content-based search**: Search actual transcript content (requires transcription)
- **Semantic search**: "episodes about AI" finds relevant content even without exact keyword matches
- **Cross-platform sync**: Search history across devices
- **Recommendation engine**: "Similar episodes to this one"

### Technical Debt
- Eventually migrate to proper search engine (Elasticsearch, Algolia) if user base grows
- Consider server-side search for real-time index updates
- Advanced NLP for better content understanding

---

**💡 Key Insight:** Episode search solves the real user problem ("I can't find that specific episode I want") much better than fixing RSS ordering edge cases. Users think in terms of content, not publication dates.

*Ready to implement when caption issues are resolved.*