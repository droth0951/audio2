const axios = require('axios');

// AssemblyAI API key - you'll need to set this
const ASSEMBLY_AI_API_KEY = process.env.ASSEMBLYAI_API_KEY || process.env.ASSEMBLYAI_KEY || 'your-assembly-ai-api-key';

module.exports = async (req, res) => {
  try {
    const { audio_url, audio_start_from, audio_end_at, punctuate, format_text } = req.body;
    
    console.log('🎬 Transcript request:', { audio_url, audio_start_from, audio_end_at, punctuate, format_text });
    
    if (!audio_url) {
      return res.status(400).json({ error: 'audio_url is required' });
    }
    
    if (!ASSEMBLY_AI_API_KEY || ASSEMBLY_AI_API_KEY === 'your-assembly-ai-api-key') {
      return res.status(500).json({ error: 'AssemblyAI API key not configured' });
    }
    
    // Normalize units and validate
    const startMs = Math.max(0, parseInt(audio_start_from) || 0);
    const endMs = Math.max(startMs + 1, parseInt(audio_end_at) || startMs + 1000);
    const duration = endMs - startMs;
    
    if (duration > 240000) {
      return res.status(400).json({ error: 'Clip duration exceeds 4 minutes' });
    }
    
    console.log(`AAI window(ms): ${startMs} → ${endMs} dur=${duration}`);
    console.log(`🎬 Sending to AssemblyAI: ${audio_url} (clipped to ${startMs}-${endMs}ms)`);
    
    // Add debug to diagnose audio windowing issue
    console.log('🔍 AUDIO SEGMENT DEBUG:', {
      originalUrl: audio_url,
      requestedStart: audio_start_from,
      requestedEnd: audio_end_at,
      duration: audio_end_at - audio_start_from,
      actualAudioPlaying: 'MANUAL CHECK NEEDED'
    });
    
    // Request transcript from AssemblyAI
    const response = await axios.post('https://api.assemblyai.com/v2/transcript', {
      audio_url,
      audio_start_from: Math.floor(startMs / 1000),  // Convert ms to seconds: 324000 → 324
      audio_end_at: Math.floor(endMs / 1000),        // Convert ms to seconds: 342000 → 342
      punctuate: punctuate !== undefined ? punctuate : true,
      format_text: format_text !== undefined ? format_text : true,
      speaker_labels: true,           // Enable speaker detection
      speakers_expected: 2,           // Most podcasts have 2 speakers
      word_boost: [],
    }, {
      headers: {
        'Authorization': `Bearer ${ASSEMBLY_AI_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Audio2-Railway/1.0',
      },
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: () => true,
    });
    
    console.log(`POST /api/transcript status=${response.status} id=${response.data?.id || '-'}`);
    
    // Handle different response statuses
    if (response.status === 401 || response.status === 403) {
      return res.status(502).json({ error: 'Upstream auth failed' });
    }
    
    if (response.status === 404) {
      return res.status(502).json({ error: 'Upstream not found' });
    }
    
    if (response.status === 429) {
      return res.status(429).json({ 
        error: 'Rate limited', 
        retryAfterSec: response.headers['retry-after'] || 60 
      });
    }
    
    if (response.status >= 500) {
      return res.status(504).json({ error: 'Upstream timeout' });
    }
    
    if (response.status !== 200) {
      return res.status(502).json({ 
        error: 'Upstream error', 
        details: response.data 
      });
    }
    
    res.json(response.data);
    
  } catch (error) {
    console.error('❌ Transcript request failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Upstream timeout' });
    }
    
    res.status(500).json({ 
      error: 'Failed to request transcript',
      details: error.response?.data || error.message 
    });
  }
};
