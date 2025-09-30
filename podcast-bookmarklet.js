javascript:(function(){
  const title = document.title;
  const url = window.location.href;
  let rssUrl = '';

  // Try to find RSS feed
  const rssLinks = document.querySelectorAll('link[type*=rss],link[type*=xml],a[href*=rss],a[href*=xml],a[href*=feed]');
  if(rssLinks.length > 0) {
    rssUrl = rssLinks[0].href || rssLinks[0].getAttribute('href');
  }

  // Clean up the podcast name
  const name = title
    .replace(/\s*\|\s*.*/,'')
    .replace(/\s*-\s*.*/,'')
    .replace(/\s*on Apple Podcasts/i,'')
    .trim();

  // Create the JSON entry
  const entry = {
    name: name,
    fallbackEmoji: '🎙️',
    category: 'Podcast',
    rssUrl: rssUrl || 'NEEDS_RSS_URL'
  };

  // Format as JSON
  const jsonText = JSON.stringify(entry, null, 2);

  // Copy to clipboard
  navigator.clipboard.writeText(jsonText).then(function() {
    alert('Podcast JSON copied to clipboard!\n\n' + jsonText + '\n\nPaste this into your popular-podcasts.json file.');
  }).catch(function() {
    // Fallback for browsers that don't support clipboard API
    prompt('Copy this JSON for ' + name + ':', jsonText);
  });
})();