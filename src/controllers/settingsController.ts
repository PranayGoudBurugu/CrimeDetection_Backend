import { Request, Response } from "express";
import prisma from "../lib/prisma";

/**
 * SETTINGS CONTROLLER
 *
 * Handles application-wide settings management:
 * - Default model selection (Gemini vs Local)
 * - Gemini API key management
 */

// ============================================
// GET /settings
// Get current application settings
// ============================================
export const getSettings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    console.log("🔍 Fetching application settings");

    // Use upsert to ensure settings record exists
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        defaultModel: "gemini",
        geminiApiKey: null,
      },
      update: {},
    });

    // Don't send the full API key to frontend, just indicate if it exists
    res.status(200).json({
      success: true,
      data: {
        id: settings.id,
        default_model: settings.defaultModel,
        hasApiKey: !!settings.geminiApiKey,
        // Send masked version of API key (first 10 chars + ***)
        apiKeyPreview: settings.geminiApiKey
          ? `${settings.geminiApiKey.substring(0, 10)}***`
          : null,
        updated_at: settings.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch settings",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// ============================================
// PUT /settings
// Update application settings
// ============================================
export const updateSettings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    console.log("📝 Updating application settings");

    const { default_model, gemini_api_key } = req.body;

    // Validate default_model if provided
    if (
      default_model &&
      default_model !== "gemini" &&
      default_model !== "local"
    ) {
      res.status(400).json({
        success: false,
        message: 'Invalid default_model. Must be "gemini" or "local".',
      });
      return;
    }

    if (!default_model && gemini_api_key === undefined) {
      res.status(400).json({
        success: false,
        message: "No settings provided to update",
      });
      return;
    }

    // Build update data object
    const updateData: any = {};
    if (default_model !== undefined) {
      updateData.defaultModel = default_model;
    }
    if (gemini_api_key !== undefined) {
      updateData.geminiApiKey = gemini_api_key;
    }

    // Update settings using Prisma
    const settings = await prisma.settings.update({
      where: { id: 1 },
      data: updateData,
    });

    console.log("✅ Settings updated successfully");

    res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      data: {
        id: settings.id,
        default_model: settings.defaultModel,
        hasApiKey: !!settings.geminiApiKey,
        apiKeyPreview: settings.geminiApiKey
          ? `${settings.geminiApiKey.substring(0, 10)}***`
          : null,
        updated_at: settings.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Error updating settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update settings",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// ============================================
// GET /settings/api-key
// Get the actual API key (for backend use)
// This should be protected in production!
// ============================================
export const getApiKey = async (): Promise<string | null> => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 1 },
      select: { geminiApiKey: true },
    });

    if (!settings || !settings.geminiApiKey) {
      // Fallback to environment variable
      return process.env.GEMINI_API_KEY || null;
    }

    return settings.geminiApiKey;
  } catch (error) {
    console.error("❌ Error fetching API key from database:", error);
    // Fallback to environment variable
    return process.env.GEMINI_API_KEY || null;
  }
};

// ============================================
// GET /settings/default-model
// Get the default model type
// ============================================
export const getDefaultModel = async (): Promise<"gemini" | "local"> => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 1 },
      select: { defaultModel: true },
    });

    if (!settings) {
      return "gemini"; // Default fallback
    }

    return settings.defaultModel as "gemini" | "local";
  } catch (error) {
    console.error("❌ Error fetching default model:", error);
    return "gemini"; // Default fallback
  }
};
