const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'User-Agent', 'AssemblyAI-Agent'],
}));

// Middleware
app.use(express.json({ limit: '50mb' }));

// Serve temp files statically
app.use('/temp', express.static(path.join(__dirname, 'temp')));

// Import our API handlers
const trimAudioHandler = require('./api/trim-audio.js');
const transcribeHandler = require('./api/transcribe.js');
const transcribeStatusHandler = require('./api/transcribe-status.js');

// Routes
app.post('/api/trim-audio', trimAudioHandler);
app.post('/api/transcript', transcribeHandler);
app.get('/api/transcript/:id', transcribeStatusHandler);

// OPTIONS handlers for CORS preflight
app.options('/api/transcript', (req, res) => {
  res.status(200).end();
});

app.options('/api/transcript/:id', (req, res) => {
  res.status(200).end();
});

// Debug endpoints
app.get('/debug/env', (req, res) => {
  const aaiKey = process.env.ASSEMBLYAI_API_KEY || process.env.ASSEMBLYAI_KEY;
  res.json({
    aaiKeyPresent: !!aaiKey,
    aaiKeyPrefix: aaiKey ? aaiKey.substring(0, 8) + '...' : null,
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎵 Audio trimmer server running on port ${PORT}`);
});
