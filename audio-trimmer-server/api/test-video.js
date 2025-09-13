// ✅ Following lines 214-222 from instructions: Test endpoint

module.exports = async (req, res) => {
  console.log('🧪 Test video creation request');
  
  try {
    const {
      testCase = '30-second-clip',
      audioUrl = 'https://dts.podtrac.com/redirect.mp3/cdn-tr.npr.org/tw/8011/2025/01/20250109_tw_8011_segrw-8fc983fb-a37f-4fb8-84bb-9e9b6c9f2e5f.mp3?f=4932231&c=_rss',  // NPR example
      clipStart = 30000,
      clipEnd = 60000
    } = req.body;

    // Use Poem of the Day for easy testing (as you suggested)
    const testPodcast = {
      audioUrl: audioUrl || 'https://traffic.megaphone.fm/BWG7407513373.mp3',  // Poem of the Day backup
      clipStart,
      clipEnd,
      podcast: {
        title: testCase === 'npr' ? 'The Town' : 'Poem of the Day',
        artwork: 'https://picsum.photos/400/400',  // Placeholder artwork
        episode: 'Test Episode'
      },
      userEmail: 'test@audio2.app',
      aspectRatio: '9:16',
      template: 'professional'
    };

    // Forward to the actual create-video endpoint
    req.body = testPodcast;
    const createVideoHandler = require('./create-video.js');
    return createVideoHandler(req, res);
    
  } catch (error) {
    console.error('❌ Test video error:', error);
    res.status(500).json({
      success: false,
      error: 'Test video creation failed'
    });
  }
};