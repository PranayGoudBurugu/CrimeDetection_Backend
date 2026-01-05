# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites Checklist

- [x] Node.js 16+ installed
- [x] PostgreSQL 17 running
- [x] Gemini API key in `.env`
- [ ] FFmpeg installed (optional, for video annotation)

### Step 1: Install FFmpeg (Optional but Recommended)

```bash
# macOS - Quick install
brew install ffmpeg

# Verify
ffmpeg -version
```

**Skip this if**: You only want ML analysis and storylines (no video overlays)

---

### Step 2: Start the Backend

```bash
# If not already running
cd nithya-analysis-backend
npm run dev
```

You should see:
```
🚀 Server running on port 3000
✅ Database connected successfully
```

---

### Step 3: Test the System

#### Option A: Using cURL (Terminal)

```bash
# Upload a test video
curl -X POST http://localhost:3000/getanalysis \
  -F "file=@/path/to/your/dance_video.mp4" \
  -F "prompt=Analyze this Bharatanatyam performance"
```

#### Option B: Using Postman/Thunder Client

1. Create new POST request to `http://localhost:3000/getanalysis`
2. Body → form-data
3. Add key `file`, type `File`, select your video
4. Add key `prompt` (optional), type `Text`, value: "Your custom prompt"
5. Send request

#### Option C: Using Frontend (if available)

Just upload a video through your React/Next.js frontend!

---

### Step 4: Check the Response

You should receive:

```json
{
  "success": true,
  "message": "Video analysis completed successfully",
  "data": {
    "id": 1,
    "video_filename": "dance_video.mp4",
    "status": "completed",
    "ml_response": {
      "danceStyle": "Bharatanatyam",
      "segments": [
        {
          "startTime": 0.0,
          "endTime": 2.5,
          "mudraName": "Alapadma",
          "meaning": "Blooming Lotus",
          "expression": "Peace",
          "description": "Dancer performs graceful opening stance..."
        }
      ],
      "storyline": "The dancer uses Alapadma to express purity, conveying a sense of peace..."
    }
  },
  "annotatedVideoPath": "/uploads/annotated/dance_video_annotated.mp4",
  "subtitlePath": "/uploads/annotated/dance_video.srt",
  "storyline": "The dancer uses Alapadma to express purity..."
}
```

---

### Step 5: View Results

#### View Annotated Video (if FFmpeg is installed)

```bash
# macOS
open nithya-analysis-backend/uploads/annotated/dance_video_annotated.mp4

# Linux
xdg-open nithya-analysis-backend/uploads/annotated/dance_video_annotated.mp4

# Windows
start nithya-analysis-backend\uploads\annotated\dance_video_annotated.mp4
```

#### Check Subtitle File

```bash
cat nithya-analysis-backend/uploads/annotated/dance_video.srt
```

You should see:
```srt
1
00:00:00,000 --> 00:00:02,500
Mudra: Alapadma
Meaning: Blooming Lotus
Expression: Peace

2
00:00:02,500 --> 00:00:05,000
Mudra: Katakamukha
Meaning: Garland
Expression: Love
```

---

## 🎯 What You Get

### 1. Storyline (Always)
A narrative summary of the entire performance.

**Use case**: Display as a summary paragraph on your frontend.

### 2. Segments (Always)
Timestamped mudra information for each section.

**Use case**: Create a timeline, synchronized captions, or frame-by-frame analysis.

### 3. Annotated Video (If FFmpeg installed)
Original video with text overlays showing mudra info.

**Use case**: Direct playback with professional-looking annotations.

### 4. Subtitle File (If FFmpeg installed)
Standard .srt file with timestamped captions.

**Use case**: Use with any video player that supports subtitles.

---

## 🔧 Troubleshooting

### "FFmpeg not installed" warning

**What it means**: Video annotation will be skipped, but ML analysis still works.

**Fix**:
```bash
brew install ffmpeg  # macOS
```

### "Gemini quota exceeded"

**What it means**: You've hit your API rate limit.

**Fix**:
- Wait a few minutes
- Check your Google Cloud billing
- Upgrade your API quota

### "Video too large"

**What it means**: The video file exceeds upload limits.

**Fix**:
- Compress the video
- Use shorter clips for testing
- Increase upload limits in `server.ts`

### Backend not responding

**Check**:
```bash
# Is the server running?
ps aux | grep node

# Check logs
npm run dev
```

---

## 📖 Next Steps

### For Beginners

1. ✅ Test with a short video (10-30 seconds)
2. ✅ Verify the storyline makes sense
3. ✅ Check if segments have proper timing
4. ✅ View the annotated video

### For Developers

1. Read `IMPLEMENTATION_SUMMARY.md` for complete feature overview
2. Read `VIDEO_ANNOTATION_GUIDE.md` for annotation details
3. Read `SYSTEM_ARCHITECTURE.md` for architecture insights
4. Integrate with your frontend

### For Production

1. Install FFmpeg on your server
2. Set up background job queue for long videos
3. Configure video storage (S3, CloudFront, etc.)
4. Monitor Gemini API usage
5. Set up error tracking (Sentry, etc.)

---

## 🎓 Understanding the Output

### Storyline Example

```
"The dancer begins with Alapadma, expressing purity and peace. 
This transitions smoothly into Katakamukha, symbolizing a garland 
and conveying love. The performance concludes with Chandrakala, 
representing the moon and evoking serenity."
```

**Use this for**: Summary cards, performance descriptions, social media

### Segments Example

```javascript
[
  {
    startTime: 0.0,
    endTime: 2.5,
    mudraName: "Alapadma",
    meaning: "Blooming Lotus",
    expression: "Peace",
    description: "Opening stance with graceful hand position"
  },
  // ... more segments
]
```

**Use this for**: Video timeline, synchronized captions, frame analysis

---

## 💡 Tips

### 1. Video Quality
- **Best**: 720p or 1080p, 24-30 fps, H.264 codec
- **Format**: MP4, MOV, or WebM
- **Length**: 10-60 seconds for faster processing

### 2. Custom Prompts
```javascript
// Generic
prompt: "Analyze this dance video"

// Specific
prompt: "Focus on Bharatanatyam mudras and identify specific hastas"

// Detailed
prompt: "Analyze hand gestures, identify Asamyuta and Samyuta hastas, and note emotional expressions"
```

### 3. Performance
- First upload: ~2 minutes (includes FFmpeg processing)
- Subsequent: Faster with caching
- Large videos: Consider compression

---

## 🎉 You're Ready!

Your system now:
- ✨ Analyzes dance videos with AI
- 📖 Generates storylines automatically
- 🎬 Creates annotated videos with overlays
- 📝 Produces subtitle files
- 🚀 Handles errors gracefully

Start uploading dance videos and see the magic happen! 🎭

---

## 📚 Documentation Index

1. **IMPLEMENTATION_SUMMARY.md** - What was built and why
2. **VIDEO_ANNOTATION_GUIDE.md** - Complete annotation feature guide
3. **FFMPEG_INSTALLATION.md** - How to install FFmpeg
4. **SYSTEM_ARCHITECTURE.md** - Technical architecture
5. **THIS FILE** - Quick start guide

Questions? Check the docs or review the code comments! 🌟
