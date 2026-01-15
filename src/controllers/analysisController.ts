import { Request, Response } from 'express';
import pool from '../config/database';
import { createAnnotatedVideo, generateSubtitleFile } from '../services/videoAnnotationService';
import { Analysis, AnalysisResponse, AnalysisListResponse, DanceAnalysisResult } from '../types';
import path from 'path';
import fs from 'fs';

/**
 * ANALYSIS CONTROLLER
 * 
 * This controller handles all analysis-related operations:
 * 1. Receiving video upload
 * 2. Sending to ML API for analysis
 * 3. Storing results in database
 * 4. Retrieving analysis history
 */

// ============================================
// POST /getanalysis
// Upload video and get analysis from ML API
// ============================================
export const getAnalysis = async (req: Request, res: Response): Promise<void> => {
    let analysisId: number | null = null;

    try {
        console.log('📥 Received analysis request');

        // Check if file was uploaded
        if (!req.file) {
            res.status(400).json({
                success: false,
                message: 'No video file uploaded. Please upload a video file.',
                error: 'Missing video file'
            } as AnalysisResponse);
            return;
        }

        const videoFile = req.file;
        console.log('📹 Video file received:', videoFile.originalname);

        // Extract optional custom prompt and model type from request body
        const customPrompt = req.body.prompt || null;
        const modelType = (req.body.modelType || 'gemini') as 'gemini' | 'local';

        // Validate model type
        if (modelType !== 'gemini' && modelType !== 'local') {
            res.status(400).json({
                success: false,
                message: 'Invalid model type. Must be "gemini" or "local".',
                error: 'Invalid modelType parameter'
            } as AnalysisResponse);
            return;
        }

        console.log(`🎯 Using model type: ${modelType}`);

        // Step 1: Insert initial record into database with 'pending' status
        const insertQuery = `
      INSERT INTO analyses (
        video_filename, 
        video_path, 
        file_size, 
        mime_type, 
        model_type,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING id
    `;

        const insertValues = [
            videoFile.originalname,
            videoFile.path,
            videoFile.size,
            videoFile.mimetype,
            modelType
        ];

        const insertResult = await pool.query(insertQuery, insertValues);
        analysisId = insertResult.rows[0].id;

        console.log(`📝 Created analysis record with ID: ${analysisId}`);

        // Step 1.5: Upload video to cloud storage (Vercel Blob in production)
        const { uploadVideo } = await import('../services/storageService');
        let videoUrl: string;

        try {
            videoUrl = await uploadVideo(videoFile.path, videoFile.filename);
            console.log('☁️ Video uploaded to storage:', videoUrl);

            // Update database with cloud storage URL
            await pool.query(
                'UPDATE analyses SET video_path = $1 WHERE id = $2',
                [videoUrl, analysisId]
            );
        } catch (uploadError) {
            console.error('⚠️ Cloud upload failed, using local path:', uploadError);
            videoUrl = videoFile.path;
        }

        // Step 2: Update status to 'processing'
        await pool.query(
            'UPDATE analyses SET status = $1 WHERE id = $2',
            ['processing', analysisId]
        );

        console.log('🤖 Sending to ML API for analysis...');

        // Step 3: Send video to appropriate ML model for analysis
        const { analyzeVideo } = await import('../services/mlService');
        const mlResponse = await analyzeVideo(
            videoFile.path, // Still use local path for analysis
            modelType,
            customPrompt
        );

        console.log('✅ ML analysis completed');

        // Step 4: Create annotated video with mudra overlays (optional)
        let annotatedVideoPath: string | null = null;
        let subtitlePath: string | null = null;

        try {
            const uploadsDir = path.dirname(videoFile.path);
            const annotatedDir = path.join(uploadsDir, 'annotated');

            // Generate annotated video
            console.log('🎬 Creating annotated video...');
            annotatedVideoPath = await createAnnotatedVideo(
                videoFile.path,
                mlResponse as DanceAnalysisResult,
                annotatedDir,
                {
                    fontSize: 24,
                    fontColor: 'white',
                    backgroundColor: 'black@0.7',
                    position: 'bottom'
                }
            );

            // Generate subtitle file as well
            const subtitleFilename = path.basename(videoFile.path, path.extname(videoFile.path)) + '.srt';
            subtitlePath = path.join(annotatedDir, subtitleFilename);
            generateSubtitleFile(mlResponse as DanceAnalysisResult, subtitlePath);

            console.log('✅ Video annotation completed');
        } catch (annotationError) {
            console.warn('⚠️ Video annotation failed (continuing without it):', annotationError);
            // Continue even if annotation fails
        }

        // Step 5: Update database with results
        const updateQuery = `
      UPDATE analyses
      SET 
        status = 'completed',
        ml_response = $1,
        completed_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

        const updateResult = await pool.query(updateQuery, [
            JSON.stringify(mlResponse),
            analysisId
        ]);

        const analysis: Analysis = updateResult.rows[0];

        console.log('💾 Analysis saved to database');

        // Step 6: Send response back to frontend
        res.status(200).json({
            success: true,
            message: 'Video analysis completed successfully',
            data: analysis,
            annotatedVideoPath: annotatedVideoPath,
            subtitlePath: subtitlePath,
            storyline: (mlResponse as DanceAnalysisResult).storyline
        } as AnalysisResponse);

    } catch (error) {
        console.error('❌ Error during analysis:', error);

        // If we created a database record, update it with error status
        if (analysisId) {
            try {
                await pool.query(
                    `UPDATE analyses 
           SET status = 'failed', 
               error_message = $1,
               completed_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
                    [error instanceof Error ? error.message : 'Unknown error', analysisId]
                );
            } catch (dbError) {
                console.error('Failed to update error status in database:', dbError);
            }
        }

        // Send error response
        res.status(500).json({
            success: false,
            message: 'Failed to analyze video',
            error: error instanceof Error ? error.message : 'Unknown error'
        } as AnalysisResponse);
    }
};

// ============================================
// GET /history
// Get all analysis records (for history page)
// ============================================
export const getAnalysisHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('📚 Fetching analysis history');

        // Optional query parameters for filtering
        const { status, limit = '50', offset = '0' } = req.query;

        let query = `
      SELECT 
        id,
        video_filename,
        video_path,
        file_size,
        mime_type,
        status,
        ml_response,
        error_message,
        created_at,
        updated_at,
        completed_at
      FROM analyses
    `;

        const queryParams: any[] = [];

        // Add status filter if provided
        if (status && typeof status === 'string') {
            query += ` WHERE status = $1`;
            queryParams.push(status);
        }

        // Order by most recent first
        query += ` ORDER BY created_at DESC`;

        // Add pagination
        query += ` LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
        queryParams.push(limit, offset);

        const result = await pool.query(query, queryParams);

        console.log(`✅ Found ${result.rows.length} analysis records`);

        // Map results to include stored_filename and public video URL
        const { getVideoUrl } = await import('../services/storageService');
        const analysesWithFilename = result.rows.map(row => ({
            ...row,
            stored_filename: path.basename(row.video_path),
            video_url: getVideoUrl(row.video_path), // Add public URL for frontend
        }));

        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: analysesWithFilename
        } as AnalysisListResponse);

    } catch (error) {
        console.error('❌ Error fetching analysis history:', error);
        res.status(500).json({
            success: false,
            count: 0,
            data: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        } as AnalysisListResponse);
    }
};

// ============================================
// GET /analysis/:id
// Get a specific analysis by ID
// ============================================
export const getAnalysisById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        console.log(`🔍 Fetching analysis with ID: ${id}`);

        const query = `
      SELECT * FROM analyses WHERE id = $1
    `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Analysis not found',
                error: 'No analysis found with the given ID'
            } as AnalysisResponse);
            return;
        }

        console.log('✅ Analysis found');

        res.status(200).json({
            success: true,
            data: result.rows[0]
        } as AnalysisResponse);

    } catch (error) {
        console.error('❌ Error fetching analysis:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch analysis',
            error: error instanceof Error ? error.message : 'Unknown error'
        } as AnalysisResponse);
    }
};

// ============================================
// DELETE /analysis/:id
// Delete an analysis and its video file
// ============================================
export const deleteAnalysis = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        console.log(`🗑️ Deleting analysis with ID: ${id}`);

        // First, get the video path so we can delete the file
        const selectQuery = 'SELECT video_path FROM analyses WHERE id = $1';
        const selectResult = await pool.query(selectQuery, [id]);

        if (selectResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Analysis not found'
            } as AnalysisResponse);
            return;
        }

        const videoPath = selectResult.rows[0].video_path;

        // Delete from database
        const deleteQuery = 'DELETE FROM analyses WHERE id = $1 RETURNING *';
        await pool.query(deleteQuery, [id]);

        // Delete video file from storage (cloud or local)
        const { deleteVideo } = await import('../services/storageService');
        await deleteVideo(videoPath);

        console.log('✅ Analysis deleted successfully');

        res.status(200).json({
            success: true,
            message: 'Analysis deleted successfully'
        } as AnalysisResponse);

    } catch (error) {
        console.error('❌ Error deleting analysis:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete analysis',
            error: error instanceof Error ? error.message : 'Unknown error'
        } as AnalysisResponse);
    }
};

// ============================================
// GET /models
// Get information about available models
// ============================================
export const getModelsInfo = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('🔍 Fetching available models info');

        const { getLocalModelInfo } = await import('../services/localModelService');
        const localModelInfo = getLocalModelInfo();

        const modelsInfo = {
            gemini: {
                name: 'Google Gemini AI',
                type: 'gemini',
                available: true,
                description: 'Cloud-based AI model with advanced video understanding capabilities',
                features: [
                    'Multi-modal understanding',
                    'Detailed mudra identification',
                    'Expression and Rasa analysis',
                    'Cohesive storyline generation'
                ]
            },
            local: {
                name: 'Local Bharatanatyam Model',
                type: 'local',
                available: localModelInfo.available,
                description: localModelInfo.description,
                modelPath: localModelInfo.modelPath,
                features: [
                    'MediaPipe-based pose detection',
                    'Frame-by-frame analysis',
                    'Custom ML pipeline',
                    'Offline processing'
                ]
            }
        };

        res.status(200).json({
            success: true,
            data: modelsInfo
        });

    } catch (error) {
        console.error('❌ Error fetching models info:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch models information',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
