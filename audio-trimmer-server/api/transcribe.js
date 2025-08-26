const axios = require('axios');

// AssemblyAI API key - you'll need to set this
const ASSEMBLY_AI_API_KEY = process.env.ASSEMBLYAI_API_KEY || process.env.ASSEMBLYAI_KEY || 'your-assembly-ai-api-key';

module.exports = async (req, res) => {
  try {
    const { audioUrl, startTime, endTime, wordBoost, punctuate, formatText } = req.body;
    
    console.log('🎬 Transcript request:', { audioUrl, startTime, endTime, wordBoost, punctuate, formatText });
    
    if (!audioUrl) {
      return res.status(400).json({ error: 'audioUrl is required' });
    }
    
    if (!ASSEMBLY_AI_API_KEY || ASSEMBLY_AI_API_KEY === 'your-assembly-ai-api-key') {
      return res.status(500).json({ error: 'AssemblyAI API key not configured' });
    }
    
    // Request transcript from AssemblyAI
    const response = await axios.post('https://api.assemblyai.com/v2/transcript', {
      audio_url: audioUrl,
      audio_start_from: startTime,
      audio_end_at: endTime,
      word_boost: wordBoost || [],
      punctuate: punctuate !== undefined ? punctuate : true,
      format_text: formatText !== undefined ? formatText : true,
    }, {
      headers: {
        'Authorization': `Bearer ${ASSEMBLY_AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log('🎬 AssemblyAI response:', response.data);
    
    res.json(response.data);
    
  } catch (error) {
    console.error('❌ Transcript request failed:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to request transcript',
      details: error.response?.data || error.message 
    });
  }
};
