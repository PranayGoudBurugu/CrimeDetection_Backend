/**
 * Type Definitions for CrimeWatch AI Backend
 *
 * These interfaces define the shape of our data throughout the application.
 * TypeScript uses these to catch errors at compile time.
 */

// ============================================
// DATABASE MODELS
// ============================================

/**
 * Analysis record from the database
 * This matches the structure of our 'analyses' table
 */
export interface Analysis {
  id: number;
  video_filename: string;
  video_path: string;
  file_size?: number;
  mime_type?: string;
  duration?: number;
  status: "pending" | "processing" | "completed" | "failed";
  ml_response?: any; // JSON data from ML API
  error_message?: string;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

/**
 * Response sent back to the frontend
 */
export interface AnalysisResponse {
  success: boolean;
  message?: string;
  data?: Analysis;
  error?: string;
}

/**
 * Response for getting multiple analyses (history page)
 */
export interface AnalysisListResponse {
  success: boolean;
  count: number;
  data: Analysis[];
  error?: string;
}

// ============================================
// THREAT ANALYSIS TYPES
// ============================================

/**
 * A single threat segment detected in CCTV footage
 */
export interface ThreatSegment {
  startTime: number;
  endTime: number;
  threatType: string;
  severity: string; // LOW, MEDIUM, HIGH, CRITICAL
  alertCategory: string; // CROWD, WEAPON, VIOLENCE, SUSPICIOUS
  description: string;
}

/**
 * Complete threat analysis result from Gemini AI
 */
export interface ThreatAnalysisResult {
  sceneType: string;
  segments: ThreatSegment[];
  incidentSummary: string;
  isValid?: boolean;
  rejectionReason?: string;
}

// Keep backward-compatible aliases
export type DanceSegment = ThreatSegment;
export type DanceAnalysisResult = ThreatAnalysisResult;

// ============================================
// ML API TYPES
// ============================================

/**
 * Configuration for ML API request
 */
export interface MLConfig {
  model: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
}

/**
 * ML API response structure
 */
export interface MLResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason?: string;
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}
