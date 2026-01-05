# FFmpeg Installation Guide

## What is FFmpeg?

FFmpeg is a powerful multimedia framework used to create annotated videos with text overlays. It's required for the video annotation feature.

## Installation

### macOS (Homebrew - Recommended)

```bash
# Install Homebrew if you haven't already
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install FFmpeg
brew install ffmpeg

# Verify installation
ffmpeg -version
```

### macOS (MacPorts)

```bash
sudo port install ffmpeg
```

### Ubuntu/Debian

```bash
sudo apt update
sudo apt install ffmpeg

# Verify installation
ffmpeg -version
```

### Windows

1. Download FFmpeg from: https://ffmpeg.org/download.html
2. Extract the ZIP file
3. Add the `bin` folder to your system PATH
4. Restart your terminal
5. Verify: `ffmpeg -version`

## Why Is It Needed?

FFmpeg is used to:
- Add text overlays to videos (mudra names, meanings, expressions)
- Process video frames in real-time
- Create professional-looking annotated videos

## Alternative: Run Without FFmpeg

If you can't install FFmpeg right now, the system will still work:

- ✅ ML analysis will complete normally
- ✅ You'll get the storyline and segments
- ❌ Annotated video won't be created
- ✅ Subtitle files (.srt) will still be generated

The backend gracefully handles FFmpeg absence - you'll see a warning but the analysis will succeed.

## Verify Installation

After installing, run:

```bash
ffmpeg -version
```

You should see output like:
```
ffmpeg version 6.0 Copyright (c) 2000-2023 the FFmpeg developers
built with Apple clang version ...
```

## Troubleshooting

### "command not found: ffmpeg"
- FFmpeg is not in your PATH
- Solution: Install using one of the methods above

### "Permission denied"
- Insufficient permissions
- Solution: Run with `sudo` (Linux) or check file permissions

### "Cannot find font"
- Font file not found
- Solution: Update font path in `videoAnnotationService.ts` to your system font

## Quick Install (macOS)

Run this single command:

```bash
brew install ffmpeg && echo "✅ FFmpeg installed successfully!"
```

Then restart your backend server.

## Performance Notes

- **First run**: May be slower as FFmpeg initializes
- **Subsequent runs**: Faster with caching
- **Large videos**: May take 1-2 minutes to process
- **Recommended**: Use videos under 1 minute for faster processing
