const axios = require('axios');

// AssemblyAI API key - you'll need to set this
const ASSEMBLY_AI_API_KEY = process.env.ASSEMBLYAI_API_KEY || process.env.ASSEMBLYAI_KEY || 'your-assembly-ai-api-key';

module.exports = async (req, res) => {
  try {
    const { jobId } = req.body;
    
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }
    
    console.log('🔄 Polling transcript:', jobId);
    
    if (!ASSEMBLY_AI_API_KEY || ASSEMBLY_AI_API_KEY === 'your-assembly-ai-api-key') {
      return res.status(500).json({ error: 'AssemblyAI API key not configured' });
    }
    
    // Poll transcript status from AssemblyAI
    const response = await axios.get(`https://api.assemblyai.com/v2/transcript/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${ASSEMBLY_AI_API_KEY}`,
      },
    });
    
    console.log('🔄 Transcript status:', response.data.status);
    
    // Return the full response data
    res.json(response.data);
    
  } catch (error) {
    console.error('❌ Transcript polling failed:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to poll transcript',
      details: error.response?.data || error.message 
    });
  }
};
