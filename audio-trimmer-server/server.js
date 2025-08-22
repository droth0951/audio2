const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve temp files statically
app.use('/temp', express.static(path.join(__dirname, 'temp')));

// Import our trim-audio handler
const trimAudioHandler = require('./api/trim-audio.js');

// Routes
app.post('/api/trim-audio', trimAudioHandler);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎵 Audio trimmer server running on port ${PORT}`);
});
