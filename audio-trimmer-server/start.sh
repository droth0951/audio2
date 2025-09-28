#!/bin/bash
# Startup script with fontconfig initialization
# Ensures fontconfig is properly initialized before Node.js/Sharp starts

echo "Initializing fontconfig..."

# Set environment variables (redundant with [variables] but ensures they're set)
export FONTCONFIG_FILE=/app/.fontconfig/fonts.conf
export FONTCONFIG_PATH=/app/.fontconfig
export XDG_CACHE_HOME=/app/.cache

# Force fontconfig initialization and cache rebuild
fc-cache -f -v

# Verify fontconfig is working
echo "Fontconfig initialized. Available fonts:"
fc-list | head -5

# Start the Node.js application
echo "Starting Node.js application..."
npm start