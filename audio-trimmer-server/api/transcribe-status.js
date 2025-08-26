const axios = require('axios');

// AssemblyAI API key - you'll need to set this
const ASSEMBLY_AI_API_KEY = process.env.ASSEMBLYAI_API_KEY || process.env.ASSEMBLYAI_KEY || 'your-assembly-ai-api-key';

module.exports = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Transcript ID is required' });
    }
    
    console.log('🔄 Polling transcript:', id);
    
    if (!ASSEMBLY_AI_API_KEY || ASSEMBLY_AI_API_KEY === 'your-assembly-ai-api-key') {
      return res.status(500).json({ error: 'AssemblyAI API key not configured' });
    }
    
    // Poll transcript status from AssemblyAI
    const response = await axios.get(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: {
        'Authorization': `Bearer ${ASSEMBLY_AI_API_KEY}`,
        'User-Agent': 'Audio2-Railway/1.0',
      },
      timeout: 30000,
      validateStatus: () => true,
    });
    
    console.log(`GET /api/transcript/${id} status=${response.status} state=${response.data?.status || 'unknown'}`);
    
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
    
    // Return the full response data
    res.json(response.data);
    
  } catch (error) {
    console.error('❌ Transcript polling failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Upstream timeout' });
    }
    
    res.status(500).json({ 
      error: 'Failed to poll transcript',
      details: error.response?.data || error.message 
    });
  }
};
