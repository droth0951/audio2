const axios = require('axios');
const { AudioFileProcessor } = require('./upload-utils');

// AssemblyAI API key - you'll need to set this
const ASSEMBLY_AI_API_KEY = process.env.ASSEMBLYAI_API_KEY || process.env.ASSEMBLYAI_KEY || 'your-assembly-ai-api-key';

module.exports = async (req, res) => {
  // COMPREHENSIVE ERROR LOGGING - Catch everything before it fails silently
  console.log('🚀 TRANSCRIPT ENDPOINT ENTRY');
  console.log('📥 Raw request method:', req.method);
  console.log('📥 Raw request headers:', JSON.stringify(req.headers, null, 2));
  console.log('📥 Raw request body type:', typeof req.body);
  console.log('📥 Raw request body:', JSON.stringify(req.body, null, 2));

  try {
    // Validate HTTP method
    if (req.method !== 'POST') {
      console.log('❌ Wrong HTTP method:', req.method);
      return res.status(405).json({ error: 'Method not allowed', expected: 'POST', received: req.method });
    }

    // Validate content type
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      console.log('❌ Wrong content type:', contentType);
      return res.status(400).json({ error: 'Content-Type must be application/json', received: contentType });
    }

    // Validate request body exists
    if (!req.body) {
      console.log('❌ No request body');
      return res.status(400).json({ error: 'Request body is required' });
    }

    // Extract and validate parameters
    const { audio_url, audio_start_from, audio_end_at, punctuate, format_text, speaker_labels, speakers_expected, word_boost } = req.body;
    
    console.log('🔍 PARAMETER EXTRACTION:');
    console.log('  audio_url:', audio_url);
    console.log('  audio_start_from:', audio_start_from, typeof audio_start_from);
    console.log('  audio_end_at:', audio_end_at, typeof audio_end_at);
    console.log('  punctuate:', punctuate);
    console.log('  format_text:', format_text);
    console.log('  speaker_labels:', speaker_labels);
    console.log('  speakers_expected:', speakers_expected);
    
    // Validate required fields
    if (!audio_url) {
      console.log('❌ Missing audio_url');
      return res.status(400).json({ error: 'audio_url is required' });
    }

    if (audio_start_from === undefined || audio_start_from === null) {
      console.log('❌ Missing audio_start_from');
      return res.status(400).json({ error: 'audio_start_from is required' });
    }

    if (audio_end_at === undefined || audio_end_at === null) {
      console.log('❌ Missing audio_end_at');
      return res.status(400).json({ error: 'audio_end_at is required' });
    }
    
    // Validate API key
    if (!ASSEMBLY_AI_API_KEY || ASSEMBLY_AI_API_KEY === 'your-assembly-ai-api-key') {
      console.log('❌ AssemblyAI API key not configured');
      return res.status(500).json({ error: 'AssemblyAI API key not configured' });
    }
    
    // CRITICAL: Convert milliseconds to seconds for AssemblyAI
    const startMs = parseInt(audio_start_from);
    const endMs = parseInt(audio_end_at);
    const startSeconds = Math.floor(startMs / 1000);
    const endSeconds = Math.floor(endMs / 1000);
    const durationSeconds = endSeconds - startSeconds;
    
    console.log('🔄 MILLISECONDS TO SECONDS CONVERSION:');
    console.log('  Input startMs:', startMs);
    console.log('  Input endMs:', endMs);
    console.log('  Converted startSeconds:', startSeconds);
    console.log('  Converted endSeconds:', endSeconds);
    console.log('  Duration seconds:', durationSeconds);
    
    // Validate duration
    if (durationSeconds > 240) {
      console.log('❌ Clip duration exceeds 4 minutes:', durationSeconds);
      return res.status(400).json({ error: 'Clip duration exceeds 4 minutes', duration: durationSeconds });
    }

    if (durationSeconds <= 0) {
      console.log('❌ Invalid duration:', durationSeconds);
      return res.status(400).json({ error: 'Invalid duration', duration: durationSeconds });
    }
    
    // FILE UPLOAD APPROACH - Download segment and upload to AssemblyAI
    console.log('🎯 STARTING FILE UPLOAD APPROACH');
    console.log('  Original URL:', audio_url);
    console.log('  Time range:', `${startSeconds}s - ${endSeconds}s`);
    
    let assemblyAIAudioUrl = null;
    let useFileUpload = true;
    
    try {
      // Create audio file processor
      const processor = new AudioFileProcessor();
      
      // Process audio segment: download → extract → upload
      assemblyAIAudioUrl = await processor.processAudioSegment(
        audio_url, 
        startSeconds, 
        endSeconds, 
        ASSEMBLY_AI_API_KEY
      );
      
      console.log('✅ FILE UPLOAD SUCCESS - AssemblyAI URL:', assemblyAIAudioUrl);
      
    } catch (fileError) {
      console.error('❌ FILE UPLOAD FAILED:', fileError.message);
      console.log('🔄 FALLING BACK to original URL method');
      
      // Fallback to original URL approach
      useFileUpload = false;
      assemblyAIAudioUrl = audio_url;
    }

    // Prepare AssemblyAI payload - different based on method
    const assemblyAIPayload = {
      audio_url: assemblyAIAudioUrl,  // Use file upload URL or fallback URL
      punctuate: punctuate !== undefined ? punctuate : true,
      format_text: format_text !== undefined ? format_text : true,
      speaker_labels: speaker_labels !== undefined ? speaker_labels : true,
      speakers_expected: speakers_expected || 2,
      word_boost: word_boost || [],
    };
    
    // Only add timing parameters for URL fallback method
    if (!useFileUpload) {
      assemblyAIPayload.audio_start_from = startSeconds;  // CONVERTED TO SECONDS
      assemblyAIPayload.audio_end_at = endSeconds;        // CONVERTED TO SECONDS
      console.log('⏰ Added timing parameters for URL fallback method');
    } else {
      console.log('✂️ No timing parameters needed - file contains exact segment');
    }
    
    console.log('🎬 ASSEMBLYAI REQUEST PAYLOAD:');
    console.log('  🔗 AUDIO SOURCE COMPARISON:');
    console.log('    Original URL:', audio_url);
    console.log('    AssemblyAI URL:', assemblyAIAudioUrl);
    console.log('    Method Used:', useFileUpload ? 'FILE UPLOAD' : 'URL FALLBACK');
    console.log('    URLs Match:', audio_url === assemblyAIAudioUrl);
    
    console.log('  📤 Full payload:', JSON.stringify(assemblyAIPayload, null, 2));
    
    console.log('  🕐 CRITICAL - Timing Information:');
    console.log('    Original timing (ms):', { startMs, endMs, durationMs: endMs - startMs });
    console.log('    Converted timing (seconds):', {
      startSeconds: assemblyAIPayload.audio_start_from,
      endSeconds: assemblyAIPayload.audio_end_at,
      durationSeconds: assemblyAIPayload.audio_end_at - assemblyAIPayload.audio_start_from
    });
    
    console.log('  🎯 FILE UPLOAD STATUS:');
    console.log('    File upload attempted:', useFileUpload);
    console.log('    Using static audio file:', useFileUpload);
    console.log('    Expected outcome:', useFileUpload ? 'PERFECT SYNC' : 'POSSIBLE MISMATCH');
    
    // Make request to AssemblyAI
    console.log('📡 Making request to AssemblyAI...');
    const response = await axios.post('https://api.assemblyai.com/v2/transcript', assemblyAIPayload, {
      headers: {
        'Authorization': `Bearer ${ASSEMBLY_AI_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Audio2-Railway/1.0',
      },
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: () => true, // Don't throw on non-2xx status
    });
    
    console.log('📡 AssemblyAI response status:', response.status);
    console.log('📡 AssemblyAI response headers:', JSON.stringify(response.headers, null, 2));
    console.log('📡 AssemblyAI response data:', JSON.stringify(response.data, null, 2));
    
    // Handle different response statuses
    if (response.status === 401 || response.status === 403) {
      console.log('❌ AssemblyAI auth failed');
      return res.status(502).json({ error: 'Upstream auth failed' });
    }
    
    if (response.status === 404) {
      console.log('❌ AssemblyAI endpoint not found');
      return res.status(502).json({ error: 'Upstream not found' });
    }
    
    if (response.status === 429) {
      console.log('❌ AssemblyAI rate limited');
      return res.status(429).json({ 
        error: 'Rate limited', 
        retryAfterSec: response.headers['retry-after'] || 60 
      });
    }
    
    if (response.status >= 500) {
      console.log('❌ AssemblyAI server error:', response.status);
      return res.status(504).json({ error: 'Upstream timeout' });
    }
    
    if (response.status !== 200) {
      console.log('❌ AssemblyAI unexpected status:', response.status);
      return res.status(502).json({ 
        error: 'Upstream error', 
        status: response.status,
        details: response.data 
      });
    }
    
    console.log('✅ AssemblyAI request successful!');
    console.log('📤 Returning response to client:', JSON.stringify(response.data, null, 2));
    
    res.json(response.data);
    
  } catch (error) {
    console.error('💥 TRANSCRIPT ENDPOINT FATAL ERROR:');
    console.error('  Error type:', error.constructor.name);
    console.error('  Error message:', error.message);
    console.error('  Error stack:', error.stack);
    
    if (error.response) {
      console.error('  HTTP response status:', error.response.status);
      console.error('  HTTP response data:', error.response.data);
    }
    
    if (error.code === 'ECONNABORTED') {
      console.error('  ⏰ Request timeout');
      return res.status(504).json({ error: 'Upstream timeout' });
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error('  🌐 Network error');
      return res.status(502).json({ error: 'Network error', code: error.code });
    }
    
    console.error('  🔥 Unknown error - returning 500');
    res.status(500).json({ 
      error: 'Failed to request transcript',
      type: error.constructor.name,
      message: error.message,
      details: error.response?.data || 'No additional details'
    });
  }
};
