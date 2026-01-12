#!/bin/bash

# Setup script for video ad generation

echo "🎬 OutrankLLM Video Ad Generator - Setup"
echo "========================================"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi
echo "✅ Node.js: $(node --version)"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm first."
    exit 1
fi
echo "✅ npm: $(npm --version)"

# Install Puppeteer locally
echo ""
echo "📦 Installing Puppeteer..."
npm install puppeteer
echo "✅ Puppeteer installed"

# Check for FFmpeg
echo ""
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg not found."
    echo ""
    echo "   Install with Homebrew:"
    echo "   brew install ffmpeg"
    echo ""
    echo "   Or download from: https://ffmpeg.org/download.html"
    exit 1
fi
echo "✅ FFmpeg: $(ffmpeg -version | head -1)"

# Check for ghost images
echo ""
GHOST_OPEN="../../public/images/ghost-eyes-open.png"
GHOST_CLOSED="../../public/images/ghost-eyes-closed.png"

if [[ -f "$GHOST_OPEN" && -f "$GHOST_CLOSED" ]]; then
    echo "✅ Ghost images found"
else
    echo "❌ Ghost images not found in public/images/"
    exit 1
fi

echo ""
echo "🎉 Setup complete! Generate your first video:"
echo ""
echo "   node record-video.js"
echo ""
