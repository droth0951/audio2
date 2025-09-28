#!/usr/bin/env node
/**
 * Development Setup Script
 * Helps configure local development environment
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Audio2 Local Development Setup');
console.log('');

// Check for .env.local file
const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
  console.log('❌ .env.local file not found!');
  console.log('Please copy .env.local.template to .env.local and fill in your keys');
  process.exit(1);
}

// Load environment
require('dotenv').config({ path: envPath });

// Check required dependencies
const checks = [
  {
    name: 'FFmpeg',
    check: () => {
      try {
        require('child_process').execSync('ffmpeg -version', { stdio: 'ignore' });
        return true;
      } catch (e) {
        return false;
      }
    },
    install: 'brew install ffmpeg'
  },
  {
    name: 'Fontconfig',
    check: () => {
      try {
        require('child_process').execSync('fc-list', { stdio: 'ignore' });
        return true;
      } catch (e) {
        return false;
      }
    },
    install: 'brew install fontconfig'
  },
  {
    name: 'AssemblyAI API Key',
    check: () => !!(process.env.ASSEMBLYAI_API_KEY || process.env.ASSEMBLYAI_KEY),
    install: 'Add ASSEMBLYAI_API_KEY to .env.local'
  }
];

console.log('🔍 Checking dependencies...');
let allGood = true;

checks.forEach(check => {
  const passed = check.check();
  console.log(`${passed ? '✅' : '❌'} ${check.name}`);
  if (!passed) {
    console.log(`   Install: ${check.install}`);
    allGood = false;
  }
});

console.log('');

if (allGood) {
  console.log('✅ All dependencies ready!');
  console.log('');
  console.log('🎬 Start development server:');
  console.log('   cd audio-trimmer-server');
  console.log('   node dev-setup.js && npm run dev');
  console.log('');
  console.log('📱 Update your app to use: http://localhost:3001');
} else {
  console.log('❌ Please install missing dependencies first');
  console.log('');
  console.log('Quick install (requires admin password):');
  console.log('   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
  console.log('   brew install ffmpeg fontconfig font-dejavu font-liberation font-roboto');
}