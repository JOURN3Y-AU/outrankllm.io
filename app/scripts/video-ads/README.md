# Video Ad Generator

Generate animated video ads featuring the OutrankLLM ghost for Facebook and LinkedIn.

## Quick Start

```bash
# 1. Install dependencies
npm install puppeteer
brew install ffmpeg

# 2. Generate a video
cd app/scripts/video-ads
node record-video.js
```

## Templates Available

| Template | Message | Best For |
|----------|---------|----------|
| `ad-template.html` | "Your Business Is Invisible to AI" | Awareness |
| `ad-variation-2.html` | "87% of AI users trust recommendations" | Stats-driven |
| `ad-variation-3.html` | "Does AI recommend your business?" | Platform focus |

## Usage

```bash
# Default: 8 second video at 30fps
node record-video.js

# Custom duration
node record-video.js --duration 10

# Use different template
node record-video.js --template ad-variation-2.html --output ad-stats.mp4

# Higher quality (60fps)
node record-video.js --fps 60 --output ad-60fps.mp4
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--duration` | 8 | Video length in seconds |
| `--fps` | 30 | Frames per second |
| `--output` | ad-1080x1080.mp4 | Output filename |
| `--template` | ad-template.html | HTML template to use |

## Video Dimensions

Currently generates 1080×1080 (square) videos, which work on:
- LinkedIn Feed
- Facebook Feed
- Instagram Feed

To change dimensions, edit the `CONFIG` object in `record-video.js`.

## Customizing Ads

1. Copy an existing template: `cp ad-template.html my-ad.html`
2. Edit the HTML/CSS
3. Preview in browser: `open my-ad.html`
4. Generate: `node record-video.js --template my-ad.html --output my-ad.mp4`

## Troubleshooting

**"Cannot find module 'puppeteer'"**
```bash
npm install puppeteer
```

**"ffmpeg: command not found"**
```bash
brew install ffmpeg
```

**Ghost images not showing**
Ensure ghost images exist in `app/public/images/`:
- `ghost-eyes-open.png`
- `ghost-eyes-closed.png`

The script copies these automatically before recording.
