#!/bin/bash
# Test video creation with NPR podcast data

echo "🎬 Testing NPR podcast video creation on local server..."
echo ""

curl -X POST http://localhost:3001/api/create-video \
  -H "Content-Type: application/json" \
  -d '{
    "audioUrl": "https://chrt.fm/track/138C95/prfx.byspotify.com/e/play.podtrac.com/npr-510325/traffic.megaphone.fm/NPR7116632248.mp3?t=podcast&e=nx-s1-5553670&p=510325&d=508&size=8131065",
    "clipStart": 185179,
    "clipEnd": 260179,
    "captionsEnabled": true,
    "podcast": {
      "title": "NPR Podcast Episode",
      "artwork": "https://media.npr.org/assets/img/2018/08/02/npr_generic_image_300.jpg",
      "podcastName": "NPR Podcast"
    }
  }'

echo ""
echo "✅ NPR podcast request sent! Check your server logs for chunking debug output..."