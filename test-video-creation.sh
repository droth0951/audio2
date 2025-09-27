#!/bin/bash
# Test video creation with Audio2 approved payload

echo "🎬 Testing video creation on local server..."
echo ""

curl -X POST http://localhost:3001/api/create-video \
  -H "Content-Type: application/json" \
  -d '{
    "audioUrl": "https://www.podtrac.com/pts/redirect.mp3/traffic.megaphone.fm/LI1923927870.mp3?updated=1758165429",
    "clipStart": 0,
    "clipEnd": 30000,
    "captionsEnabled": true,
    "podcast": {
      "title": "This is Quick: Why Overtimes CEO prioritizes personality over experience when hiring",
      "artwork": "https://megaphone.imgix.net/podcasts/2ed322b4-49c9-11ea-93e0-afa2585e78cd/image/TIW_Key_Art_2999.png?ixlib=rails-4.3.1&max-w=3000&max-h=3000&fit=crop&auto=format,compress",
      "podcastName": "This Is Working with Daniel Roth"
    }
  }'

echo ""
echo "✅ Request sent! Check your server logs for progress..."