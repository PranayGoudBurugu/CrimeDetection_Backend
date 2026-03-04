import { Request, Response } from "express";
import prisma from "../lib/prisma";
import {
  createAnnotatedVideo,
  generateSubtitleFile,
} from "../services/videoAnnotationService";
import {
  Analysis,
  AnalysisResponse,
  AnalysisListResponse,
  DanceAnalysisResult,
} from "../types";
import path from "path";
import fs from "fs";

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
export const getAnalysis = async (
  req: Request,
  res: Response,
): Promise<void> => {
  let analysisId: number | null = null;

  try {
    console.log("📥 Received analysis request");

    // Check if file was uploaded
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "No video file uploaded. Please upload a video file.",
        error: "Missing video file",
      } as AnalysisResponse);
      return;
    }

    const videoFile = req.file;
    console.log("📹 Video file received:", videoFile.originalname);

    // Extract optional custom prompt from request body
    const customPrompt = req.body.prompt || null;

    // Get model type from request OR use admin-configured default
    let modelType: "gemini" | "local";

    if (req.body.modelType) {
      // Model type explicitly specified in request
      modelType = req.body.modelType;
    } else {
      // Use admin-configured default model from settings
      const { getDefaultModel } =
        await import("../controllers/settingsController");
      modelType = await getDefaultModel();
      console.log(`📋 Using admin-configured default model: ${modelType}`);
    }

    // Validate model type
    if (modelType !== "gemini" && modelType !== "local") {
      res.status(400).json({
        success: false,
        message: 'Invalid model type. Must be "gemini" or "local".',
        error: "Invalid modelType parameter",
      } as AnalysisResponse);
      return;
    }

    console.log(`🎯 Using model type: ${modelType}`);

    // Step 1: Insert initial record into database with 'pending' status

    // Extract user email from request body (if provided by frontend)
    const userEmail = req.body.userEmail || null;

    const insertQuery = `
      INSERT INTO analyses (
        video_filename, 
        video_path, 
        file_size, 
        mime_type, 
        model_type,
        status,
        user_email
      )
      VALUES ($1, $2, $3, $4, $5, 'pending', $6)
      RETURNING id
    `;

    const insertValues = [
      videoFile.originalname,
      videoFile.path,
      videoFile.size,
      videoFile.mimetype,
      modelType,
      userEmail,
    ];

    const insertResult = await prisma.analysis.create({
      data: {
        videoFilename: videoFile.originalname,
        videoPath: videoFile.path,
        fileSize: videoFile.size,
        mimeType: videoFile.mimetype,
        modelType,
        status: "pending",
        userEmail,
      },
    });
    analysisId = insertResult.id;

    console.log(`📝 Created analysis record with ID: ${analysisId}`);

    // Step 1.5: Upload video to cloud storage (Vercel Blob in production)
    const { uploadVideo } = await import("../services/storageService");
    let videoUrl: string;

    try {
      videoUrl = await uploadVideo(videoFile.path, videoFile.filename);
      console.log("☁️ Video uploaded to storage:", videoUrl);

      // Update database with cloud storage URL
      await prisma.analysis.update({
        where: { id: analysisId },
        data: { videoPath: videoUrl },
      });
    } catch (uploadError) {
      console.error("⚠️ Cloud upload failed, using local path:", uploadError);
      videoUrl = videoFile.path;
    }

    // Step 2: Update status to 'processing'
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: "processing" },
    });

    console.log("🤖 Sending to ML API for analysis...");

    // Step 3: Send video to appropriate ML model for analysis
    const { analyzeVideo } = await import("../services/mlService");
    const mlResponse = await analyzeVideo(
      videoFile.path, // Still use local path for analysis
      modelType,
      customPrompt,
    );

    console.log("✅ ML analysis completed");

    // Step 4: Create annotated video with threat overlays (optional)
    let annotatedVideoPath: string | null = null;
    let subtitlePath: string | null = null;

    try {
      const uploadsDir = path.dirname(videoFile.path);
      const annotatedDir = path.join(uploadsDir, "annotated");

      // Generate annotated video
      console.log("🎬 Creating annotated video...");
      annotatedVideoPath = await createAnnotatedVideo(
        videoFile.path,
        mlResponse as DanceAnalysisResult,
        annotatedDir,
        {
          fontSize: 24,
          fontColor: "white",
          backgroundColor: "black@0.7",
          position: "bottom",
        },
      );

      // Generate subtitle file as well
      const subtitleFilename =
        path.basename(videoFile.path, path.extname(videoFile.path)) + ".srt";
      subtitlePath = path.join(annotatedDir, subtitleFilename);
      generateSubtitleFile(mlResponse as DanceAnalysisResult, subtitlePath);

      console.log("✅ Video annotation completed");
    } catch (annotationError) {
      console.warn(
        "⚠️ Video annotation failed (continuing without it):",
        annotationError,
      );
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

    const updateResult = await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: "completed",
        mlResponse: mlResponse as any,
        completedAt: new Date(),
      },
    });

    const analysis = updateResult;

    console.log("💾 Analysis saved to database");

    // Step 6: Check for violence threats and send SMS alert via Twilio
    let alertSent = false;
    try {
      const { findViolenceAlert, sendThreatAlert } = await import("../services/twilioService");
      const violenceAlert = findViolenceAlert(mlResponse.segments || []);

      if (violenceAlert) {
        console.log("🚨 Violence detected! Sending SMS alert...");

        // Get video URL for the SMS
        const { getVideoUrl } = await import("../services/storageService");
        const videoLink = getVideoUrl(videoFile.path);

        // Get location and alertPhone from request body (sent by frontend)
        const location = req.body?.location || "Unknown Location";
        const alertPhone = req.body?.alertPhone;

        const smsResult = await sendThreatAlert({
          ...violenceAlert,
          incidentSummary: (mlResponse as DanceAnalysisResult).incidentSummary,
          videoUrl: videoLink,
          location: location,
          toPhone: alertPhone,
        });

        alertSent = smsResult.success;
        if (alertSent) {
          console.log("✅ SMS alert sent successfully");
        }
      }
    } catch (alertError) {
      console.warn("⚠️ SMS alert failed (continuing without it):", alertError);
    }

    // Step 7: Send response back to frontend
    res.status(200).json({
      success: true,
      message: "Video analysis completed successfully",
      data: analysis as any,
      annotatedVideoPath: annotatedVideoPath,
      subtitlePath: subtitlePath,
      storyline: (mlResponse as DanceAnalysisResult).incidentSummary,
      alertSent: alertSent,
    } as AnalysisResponse);
  } catch (error) {
    console.error("❌ Error during analysis:", error);

    // If we created a database record, update it with error status
    if (analysisId) {
      try {
        await prisma.analysis.update({
          where: { id: analysisId },
          data: {
            status: "failed",
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
            completedAt: new Date(),
          },
        });
      } catch (dbError) {
        console.error("Failed to update error status in database:", dbError);
      }
    }

    // Send error response
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const isValidationFailure = errorMessage.includes("Video Rejected");

    res.status(isValidationFailure ? 400 : 500).json({
      success: false,
      message: isValidationFailure ? errorMessage : "Failed to analyze video",
      error: errorMessage,
    } as AnalysisResponse);
  }
};

// ============================================
// GET /history
// Get all analysis records (for history page)
// ============================================
export const getAnalysisHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    console.log("📚 Fetching analysis history");

    // Optional query parameters for filtering
    const { status, limit = "50", offset = "0" } = req.query;

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
    let whereClause = "";

    // Add user email filter if provided
    const userEmail = req.query.userEmail;
    if (userEmail && typeof userEmail === "string") {
      whereClause += ` WHERE user_email = $1`;
      queryParams.push(userEmail);
    }

    // Add status filter if provided
    if (status && typeof status === "string") {
      if (whereClause) {
        whereClause += ` AND status = $${queryParams.length + 1}`;
      } else {
        whereClause += ` WHERE status = $${queryParams.length + 1}`;
      }
      queryParams.push(status);
    }

    query += whereClause;

    // Order by most recent first
    query += ` ORDER BY created_at DESC`;

    // Add pagination
    query += ` LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const result = await prisma.analysis.findMany({
      where: {
        ...(status ? { status: String(status) } : {}),
        ...(userEmail ? { userEmail: String(userEmail) } : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: Number(limit),
      skip: Number(offset),
    });

    console.log(`✅ Found ${result.length} analysis records`);

    // Map results to include stored_filename and public video URL
    const { getVideoUrl } = await import("../services/storageService");
    const analysesWithFilename = result.map((row: any) => ({
      ...row,
      stored_filename: path.basename(row.videoPath),
      video_url: getVideoUrl(row.videoPath), // Add public URL for frontend
    }));

    res.status(200).json({
      success: true,
      count: result.length,
      data: analysesWithFilename as any,
    } as AnalysisListResponse);
  } catch (error) {
    console.error("❌ Error fetching analysis history:", error);
    res.status(500).json({
      success: false,
      count: 0,
      data: [],
      error: error instanceof Error ? error.message : "Unknown error",
    } as AnalysisListResponse);
  }
};

// ============================================
// GET /analysis/:id
// Get a specific analysis by ID
// ============================================
export const getAnalysisById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    console.log(`🔍 Fetching analysis with ID: ${id}`);

    const result = await prisma.analysis.findUnique({
      where: { id: parseInt(id) },
    });

    if (!result) {
      res.status(404).json({
        success: false,
        message: "Analysis not found",
        error: "No analysis found with the given ID",
      } as AnalysisResponse);
      return;
    }

    console.log("✅ Analysis found");

    res.status(200).json({
      success: true,
      data: result as any,
    } as AnalysisResponse);
  } catch (error) {
    console.error("❌ Error fetching analysis:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch analysis",
      error: error instanceof Error ? error.message : "Unknown error",
    } as AnalysisResponse);
  }
};

// ============================================
// DELETE /analysis/:id
// Delete an analysis and its video file
// ============================================
export const deleteAnalysis = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    console.log(`🗑️ Deleting analysis with ID: ${id}`);

    // First, get the video path so we can delete the file
    const analysis = await prisma.analysis.findUnique({
      where: { id },
      select: { videoPath: true },
    });

    if (!analysis) {
      res.status(404).json({
        success: false,
        message: "Analysis not found",
      } as AnalysisResponse);
      return;
    }

    const videoPath = analysis.videoPath;

    // Delete from database
    await prisma.analysis.delete({
      where: { id },
    });

    // Delete video file from storage (cloud or local)
    const { deleteVideo } = await import("../services/storageService");
    await deleteVideo(videoPath);

    console.log("✅ Analysis deleted successfully");

    res.status(200).json({
      success: true,
      message: "Analysis deleted successfully",
    } as AnalysisResponse);
  } catch (error) {
    console.error("❌ Error deleting analysis:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete analysis",
      error: error instanceof Error ? error.message : "Unknown error",
    } as AnalysisResponse);
  }
};

// ============================================
// GET /models
// Get information about available models
// ============================================
export const getModelsInfo = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    console.log("🔍 Fetching available models info");

    const { getLocalModelInfo } = await import("../services/localModelService");
    const localModelInfo = getLocalModelInfo();

    const modelsInfo = {
      gemini: {
        name: "Google Gemini AI",
        type: "gemini",
        available: true,
        description:
          "Cloud-based AI model with advanced video understanding for threat detection",
        features: [
          "Multi-modal video analysis",
          "Crowd detection & counting",
          "Weapon & sharp object identification",
          "Violence & fighting detection",
        ],
      },
      local: {
        name: "Local Detection Model",
        type: "local",
        available: localModelInfo.available,
        description: localModelInfo.description,
        modelPath: localModelInfo.modelPath,
        features: [
          "MediaPipe-based detection",
          "Frame-by-frame analysis",
          "Custom ML pipeline",
          "Offline processing",
        ],
      },
    };

    res.status(200).json({
      success: true,
      data: modelsInfo,
    });
  } catch (error) {
    console.error("❌ Error fetching models info:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch models information",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
