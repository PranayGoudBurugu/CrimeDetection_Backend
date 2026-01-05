import express from 'express';
import { upload } from '../config/multer';
import {
    getAnalysis,
    getAnalysisHistory,
    getAnalysisById,
    deleteAnalysis
} from '../controllers/analysisController';

/**
 * ANALYSIS ROUTES
 * 
 * These routes define the API endpoints for video analysis
 */

const router = express.Router();

/**
 * POST /getanalysis
 * 
 * Upload a video and get analysis from Gemini AI
 * 
 * Request: multipart/form-data
 *  - video: video file (required)
 *  - prompt: custom analysis prompt (optional)
 * 
 * Response: JSON with analysis results
 * 
 * Example using curl:
 * curl -X POST http://localhost:5005/getanalysis \
 *   -F "video=@/path/to/video.mp4" \
 *   -F "prompt=Analyze this dance performance"
 */
router.post('/getanalysis', upload.single('video'), getAnalysis);

/**
 * GET /history
 * 
 * Get analysis history (for history page in frontend)
 * 
 * Query parameters:
 *  - status: filter by status (optional) - pending|processing|completed|failed
 *  - limit: number of results (default: 50)
 *  - offset: pagination offset (default: 0)
 * 
 * Example: GET /history?status=completed&limit=10&offset=0
 */
router.get('/history', getAnalysisHistory);

/**
 * GET /analysis/:id
 * 
 * Get a specific analysis by ID
 * 
 * Example: GET /analysis/1
 */
router.get('/analysis/:id', getAnalysisById);

/**
 * DELETE /analysis/:id
 * 
 * Delete an analysis and its associated video file
 * 
 * Example: DELETE /analysis/1
 */
router.delete('/analysis/:id', deleteAnalysis);

export default router;
