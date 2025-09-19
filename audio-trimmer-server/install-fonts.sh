#!/bin/bash
# Install fonts for video generation on Railway

# Create fonts directory
mkdir -p /app/fonts

# Install basic fonts for SVG rendering
apt-get update -qq
apt-get install -y fontconfig fonts-dejavu-core fonts-liberation

# Copy Inter fonts from node_modules if available
if [ -d "/app/node_modules/expo-dev-launcher/android/src/debug/assets" ]; then
  cp /app/node_modules/expo-dev-launcher/android/src/debug/assets/Inter-*.otf /app/fonts/ 2>/dev/null || true
fi

# Update fontconfig cache
fc-cache -fv

echo "Fonts installed successfully"