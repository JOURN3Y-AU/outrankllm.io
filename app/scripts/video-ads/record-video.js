#!/usr/bin/env node

/**
 * Video Ad Generator for OutrankLLM
 *
 * Records the ghost animation as an MP4 video for social media ads.
 * Uses Puppeteer to capture frames and FFmpeg to encode video.
 *
 * Usage:
 *   node record-video.js [options]
 *
 * Options:
 *   --duration <seconds>   Video duration (default: 8)
 *   --fps <number>         Frames per second (default: 30)
 *   --output <filename>    Output filename (default: ad-1080x1080.mp4)
 *   --template <name>      Template to use (default: ad-template.html)
 *
 * Requirements:
 *   npm install puppeteer
 *   FFmpeg must be installed: brew install ffmpeg
 */

const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
};

const CONFIG = {
  width: 1080,
  height: 1080,
  duration: parseInt(getArg('duration', '8'), 10),
  fps: parseInt(getArg('fps', '30'), 10),
  output: getArg('output', 'ad-1080x1080.mp4'),
  template: getArg('template', 'ad-template.html'),
};

const FRAMES_DIR = path.join(__dirname, 'frames');
const OUTPUT_PATH = path.join(__dirname, CONFIG.output);

async function ensureDirectories() {
  // Clean up old frames
  if (fs.existsSync(FRAMES_DIR)) {
    fs.rmSync(FRAMES_DIR, { recursive: true });
  }
  fs.mkdirSync(FRAMES_DIR);
}

async function copyAssets() {
  // Copy ghost images to the video-ads directory for the HTML to reference
  const publicImages = path.join(__dirname, '../../public/images');
  const ghostOpen = path.join(publicImages, 'ghost-eyes-open.png');
  const ghostClosed = path.join(publicImages, 'ghost-eyes-closed.png');

  if (fs.existsSync(ghostOpen)) {
    fs.copyFileSync(ghostOpen, path.join(__dirname, 'ghost-eyes-open.png'));
  }
  if (fs.existsSync(ghostClosed)) {
    fs.copyFileSync(ghostClosed, path.join(__dirname, 'ghost-eyes-closed.png'));
  }
}

async function captureFrames() {
  console.log('🎬 Starting frame capture...');
  console.log(`   Resolution: ${CONFIG.width}x${CONFIG.height}`);
  console.log(`   Duration: ${CONFIG.duration}s @ ${CONFIG.fps}fps`);
  console.log(`   Total frames: ${CONFIG.duration * CONFIG.fps}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      `--window-size=${CONFIG.width},${CONFIG.height}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: CONFIG.width,
    height: CONFIG.height,
    deviceScaleFactor: 1,
  });

  // Load the HTML template
  const templatePath = path.join(__dirname, CONFIG.template);
  await page.goto(`file://${templatePath}`, { waitUntil: 'networkidle0' });

  // Wait for fonts and images to load
  await page.evaluate(() => document.fonts.ready);
  await new Promise(resolve => setTimeout(resolve, 500));

  const totalFrames = CONFIG.duration * CONFIG.fps;
  const frameInterval = 1000 / CONFIG.fps;

  // Capture frames
  for (let i = 0; i < totalFrames; i++) {
    const frameNumber = String(i).padStart(5, '0');
    const framePath = path.join(FRAMES_DIR, `frame-${frameNumber}.png`);

    await page.screenshot({
      path: framePath,
      type: 'png',
    });

    // Progress indicator
    if (i % CONFIG.fps === 0) {
      const seconds = i / CONFIG.fps;
      console.log(`   Captured ${seconds}s / ${CONFIG.duration}s`);
    }

    // Wait for next frame timing
    await new Promise(resolve => setTimeout(resolve, frameInterval));
  }

  await browser.close();
  console.log('✅ Frame capture complete!');
}

async function encodeVideo() {
  console.log('🎥 Encoding video with FFmpeg...');

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y', // Overwrite output
      '-framerate', String(CONFIG.fps),
      '-i', path.join(FRAMES_DIR, 'frame-%05d.png'),
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', '18', // High quality
      '-pix_fmt', 'yuv420p', // Compatibility
      '-movflags', '+faststart', // Web optimization
      OUTPUT_PATH,
    ]);

    ffmpeg.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    ffmpeg.stderr.on('data', (data) => {
      // FFmpeg outputs progress to stderr
      const str = data.toString();
      if (str.includes('frame=')) {
        process.stdout.write(`   ${str.trim()}\r`);
      }
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Video encoded successfully!');
        console.log(`   Output: ${OUTPUT_PATH}`);
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
  });
}

async function cleanup() {
  console.log('🧹 Cleaning up frames...');
  if (fs.existsSync(FRAMES_DIR)) {
    fs.rmSync(FRAMES_DIR, { recursive: true });
  }
}

async function main() {
  console.log('\n🎨 OutrankLLM Video Ad Generator\n');
  console.log('================================\n');

  try {
    await ensureDirectories();
    await copyAssets();
    await captureFrames();
    await encodeVideo();
    await cleanup();

    console.log('\n🎉 Done! Your video ad is ready.\n');
    console.log(`   File: ${CONFIG.output}`);
    console.log(`   Size: ${CONFIG.width}x${CONFIG.height}`);
    console.log(`   Duration: ${CONFIG.duration}s`);
    console.log('\n   Upload to LinkedIn or Facebook!\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Install Puppeteer: npm install puppeteer');
    console.error('  2. Install FFmpeg: brew install ffmpeg');
    console.error('  3. Check that ghost images exist in public/images/\n');
    process.exit(1);
  }
}

main();