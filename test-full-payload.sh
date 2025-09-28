#!/bin/bash
# Test server-side video creation with the new full payload format from Audio2

echo "🎬 Testing server-side video creation with Audio2's new payload format..."
echo ""

# Using the exact same NPR podcast data that Audio2 just sent, but with server field names
curl -X POST http://localhost:3001/api/create-video \
  -H "Content-Type: application/json" \
  -d '{
    "audioUrl": "https://chrt.fm/track/138C95/prfx.byspotify.com/e/play.podtrac.com/npr-510325/traffic.megaphone.fm/NPR7116632248.mp3?t=podcast&e=nx-s1-5553670&p=510325&d=508&size=8131065",
    "clipStart": 210106,
    "clipEnd": 286000,
    "podcast": {
      "title": "Argentina'\''s bailout, a new way to cool data centers, and a cold holiday hiring season",
      "artwork": "https://npr.brightspotcdn.com/dims3/default/strip/false/crop/1900x1900+0+0/resize/3000/quality/66/format/jpg/?url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com%2Fb8%2F1d%2F58a14ab4423f9d64676bad2d4cde%2F5902f2f9-2529-4242-a017-55405edab826.jpg",
      "podcastName": "The Indicator from Planet Money"
    },
    "captionsEnabled": true
  }'

echo ""
echo "✅ Server-side video request sent with full Audio2 payload!"
echo "📊 This tests compatibility with the exact payload Audio2 now sends"