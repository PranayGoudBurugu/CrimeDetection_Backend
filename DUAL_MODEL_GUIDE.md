# Dual Model Support - Gemini AI & Local Model

This backend now supports **two different analysis models**:

1. **Gemini AI** (Cloud-based) - Google's advanced multimodal AI
2. **Local Model** (On-premise) - Custom Bharatanatyam analysis using MediaPipe

## 🎯 How It Works

When you upload a video for analysis, you can specify which model to use via the `modelType` parameter:

- `modelType=gemini` → Uses Google Gemini AI (default)
- `modelType=local` → Uses the local Python ML model

The system automatically routes your request to the appropriate model and stores the model type in the database.

## 📊 Database Schema

The `analyses` table now includes a `model_type` column:

```sql
model_type VARCHAR(50) DEFAULT 'gemini'
```

This allows you to:
- Track which model was used for each analysis
- Filter analyses by model type
- Compare results between models

## 🔌 API Usage

### 1. Get Available Models

```bash
GET /models
```

**Response:**
```json
{
  "success": true,
  "data": {
    "gemini": {
      "name": "Google Gemini AI",
      "type": "gemini",
      "available": true,
      "description": "Cloud-based AI model with advanced video understanding capabilities",
      "features": [
        "Multi-modal understanding",
        "Detailed mudra identification",
        "Expression and Rasa analysis",
        "Cohesive storyline generation"
      ]
    },
    "local": {
      "name": "Local Bharatanatyam Model",
      "type": "local",
      "available": true,
      "description": "Local Bharatanatyam dance analysis model using MediaPipe and custom ML pipeline",
      "features": [
        "MediaPipe-based pose detection",
        "Frame-by-frame analysis",
        "Custom ML pipeline",
        "Offline processing"
      ]
    }
  }
}
```

### 2. Analyze Video with Gemini (Default)

```bash
curl -X POST http://localhost:5005/getanalysis \
  -F "video=@dance_video.mp4" \
  -F "modelType=gemini" \
  -F "prompt=Analyze this Bharatanatyam performance"
```

### 3. Analyze Video with Local Model

```bash
curl -X POST http://localhost:5005/getanalysis \
  -F "video=@dance_video.mp4" \
  -F "modelType=local"
```

**Note:** The `prompt` parameter is only used for Gemini AI and will be ignored for the local model.

## 🏗️ Architecture

### Request Flow

```
Client Request
    ↓
analysisController.ts
    ↓
Validates modelType ('gemini' or 'local')
    ↓
Stores in database with model_type
    ↓
mlService.ts → analyzeVideo()
    ↓
    ├─→ modelType === 'gemini' → analyzeVideoWithML() → Google Gemini API
    └─→ modelType === 'local'  → localModelService.ts → Python subprocess
```

### File Structure

```
src/
├── controllers/
│   └── analysisController.ts    # Handles modelType routing
├── services/
│   ├── mlService.ts             # Gemini AI + unified analyzeVideo()
│   └── localModelService.ts     # Local Python model integration
└── routes/
    └── analysisRoutes.ts        # API endpoints

database/
└── schema.sql                   # Updated with model_type column

Mudra-Analysis-backend-model/    # Local Python ML model
├── main_pipeline.py
├── src/
└── data/
```

## 🐍 Local Model Setup

The local model is located in the `Mudra-Analysis-backend-model` directory. To use it:

### 1. Install Python Dependencies

```bash
cd Mudra-Analysis-backend-model
pip install -r requirements.txt
```

### 2. Test the Model

```bash
python main_pipeline.py --mode inference --video_path "path/to/video.mp4"
```

### 3. Verify Integration

The backend will automatically detect if the local model is available by checking for:
- `Mudra-Analysis-backend-model/main_pipeline.py`

If the file exists, the local model will be marked as available in the `/models` endpoint.

## 🔄 How the Local Model Works

1. **Video Upload**: Client uploads video with `modelType=local`
2. **Subprocess Spawn**: Backend spawns a Python process running `main_pipeline.py`
3. **Analysis**: Python model processes video using MediaPipe
4. **Output**: Model generates JSON file with predictions
5. **Parsing**: Backend parses JSON and converts to `DanceAnalysisResult` format
6. **Response**: Unified response format sent back to client

## 📝 Response Format

Both models return the same response format:

```typescript
{
  success: true,
  message: "Video analysis completed successfully",
  data: {
    id: 1,
    video_filename: "dance.mp4",
    model_type: "gemini" | "local",
    status: "completed",
    ml_response: {
      danceStyle: "Bharatanatyam",
      segments: [
        {
          startTime: 0.0,
          endTime: 2.5,
          mudraName: "Alapadma",
          meaning: "Lotus flower",
          expression: "Peaceful",
          description: "..."
        }
      ],
      storyline: "..."
    }
  }
}
```

## 🎨 Frontend Integration

### Check Available Models

```javascript
const response = await fetch('/models');
const { data } = await response.json();

if (data.local.available) {
  // Show local model option in UI
}
```

### Submit Analysis Request

```javascript
const formData = new FormData();
formData.append('video', videoFile);
formData.append('modelType', selectedModel); // 'gemini' or 'local'

if (selectedModel === 'gemini') {
  formData.append('prompt', customPrompt);
}

const response = await fetch('/getanalysis', {
  method: 'POST',
  body: formData
});
```

## 🔍 Querying by Model Type

### Get All Gemini Analyses

```sql
SELECT * FROM analyses WHERE model_type = 'gemini' ORDER BY created_at DESC;
```

### Get All Local Model Analyses

```sql
SELECT * FROM analyses WHERE model_type = 'local' ORDER BY created_at DESC;
```

### Compare Model Performance

```sql
SELECT 
  model_type,
  COUNT(*) as total_analyses,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_processing_time
FROM analyses
WHERE status = 'completed'
GROUP BY model_type;
```

## ⚙️ Configuration

### Environment Variables

No additional environment variables needed! The system automatically:
- Uses `GEMINI_API_KEY` for Gemini AI
- Detects local model availability by checking file existence

### Model Selection Strategy

You can implement different strategies:

1. **User Choice**: Let users select the model
2. **Fallback**: Try Gemini first, fallback to local if quota exceeded
3. **Load Balancing**: Alternate between models
4. **Cost Optimization**: Use local model for bulk processing

## 🚨 Error Handling

### Gemini API Errors

- **Rate Limit**: Automatically retries with exponential backoff
- **Quota Exceeded**: Returns error message
- **Network Issues**: Fails gracefully

### Local Model Errors

- **Model Not Found**: Returns 500 with clear error message
- **Python Error**: Captures stderr and returns in error response
- **Timeout**: 5-minute timeout for processing
- **Output Parse Error**: Returns detailed parsing error

## 🎯 Best Practices

1. **Check Model Availability**: Always call `/models` endpoint first
2. **Handle Both Models**: Design UI to support both model types
3. **Store Model Type**: Display which model was used in history
4. **Error Messages**: Show user-friendly errors for each model type
5. **Performance**: Local model may be slower for long videos

## 📈 Performance Comparison

| Feature | Gemini AI | Local Model |
|---------|-----------|-------------|
| Speed | Fast (cloud) | Slower (CPU-bound) |
| Accuracy | Very High | Good |
| Cost | API quota | Free (compute) |
| Internet | Required | Not required |
| Storyline | AI-generated | Template-based |
| Mudra Detail | Excellent | Good |

## 🔐 Security Notes

- Local model runs in isolated subprocess
- Output files are cleaned up after processing
- No data sent to external services when using local model
- Gemini API uses secure HTTPS connection

## 🐛 Troubleshooting

### Local Model Not Available

```bash
# Check if Python script exists
ls Mudra-Analysis-backend-model/main_pipeline.py

# Test Python dependencies
cd Mudra-Analysis-backend-model
python3 -c "import cv2, mediapipe; print('OK')"
```

### Model Returns Empty Results

- Check video format (MP4 recommended)
- Verify video is not corrupted
- Check model logs in console output

### Timeout Issues

- Increase timeout in `localModelService.ts` (default: 5 minutes)
- Process shorter video clips
- Optimize Python model performance

## 📚 Additional Resources

- [Gemini API Documentation](https://ai.google.dev/docs)
- [MediaPipe Documentation](https://google.github.io/mediapipe/)
- Local Model README: `Mudra-Analysis-backend-model/README.md`
