/**
 * Type Definitions for Nithya Analysis Backend
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
    status: 'pending' | 'processing' | 'completed' | 'failed';
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
// DANCE ANALYSIS TYPES
// ============================================

/**
 * A single segment in a dance video analysis
 */
export interface DanceSegment {
    startTime: number;
    endTime: number;
    mudraName: string;
    meaning: string;
    expression: string;
    description: string;
}

/**
 * Complete dance analysis result from Gemini AI
 */
export interface DanceAnalysisResult {
    danceStyle: string;
    segments: DanceSegment[];
    storyline: string;  // Narrative summary combining all mudras in sequence
}

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
 * (This can be customized based on your actual ML API response)
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
