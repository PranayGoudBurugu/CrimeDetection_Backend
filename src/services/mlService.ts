import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import dotenv from "dotenv";
import { DanceAnalysisResult, DanceSegment } from "../types";

dotenv.config();

/**
 * ML AI Service
 *
 * This service handles all interactions with Google's Gemini AI API
 * It sends video files to the Gemini API and gets structured analysis results
 */

// Initialize Gemini Client with dynamic API key support
// Will fetch from database first, then fallback to environment variable
let ai: any = null;

const getGeminiClient = async () => {
    if (ai) return ai;

    // Try to get API key from database
    try {
        const { getApiKey } = await import('../controllers/settingsController');
        const apiKey = await getApiKey();

        if (apiKey) {
            const { GoogleGenAI } = await import("@google/genai");
            ai = new GoogleGenAI({ apiKey });
            return ai;
        }
    } catch (error) {
        console.warn('Could not fetch API key from database, using environment variable');
    }

    // Fallback to environment variable
    const { GoogleGenAI } = await import("@google/genai");
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
    return ai;
};

const SYSTEM_INSTRUCTION = `
You are an expert scholar and critic of Indian Classical Dance (focusing on Bharatanatyam, Odissi, Kathak, and Kuchipudi). 
Your task is to analyze a video clip frame-by-frame and create a CONTINUOUS narrative of the performance.

**CRITICAL RULES FOR TIMING:**
1. **NO GAPS**: The analysis must cover the video from 0.0 seconds to the very end.
2. **CONTINUITY**: The End Time of one segment MUST be the Start Time of the next segment.
3. **MINIMUM DURATION**: Each segment MUST be AT LEAST 1.5-3 seconds long. Do NOT create segments shorter than 1 second.
4. **REALISTIC TIMING**: A typical mudra or pose is held for 2-4 seconds. Transitions take 1-2 seconds. Match your timing to realistic dance movements.
5. **EXAMPLE TIMING**: For a 10-second video, create 3-5 segments (e.g., 0.0-2.5s, 2.5-5.0s, 5.0-7.5s, 7.5-10.0s).

**CONTENT RULES:**
1. **DEFAULT STATE**: If no specific hand gesture (Mudra) is clear, or the dancer is transitioning, label the Mudra as "Nritta / Movement" or "Transition" and describe the body posture.
2. **Nritya & Mudras**: Identify the specific hand gestures (Samyuta and Asamyuta Hastas).
3. **Abhinaya (Expression)**: Analyze facial expressions and the corresponding sentiment (Rasa/Bhava).

**STORYLINE GENERATION:**
After analyzing all segments, create a cohesive narrative that flows naturally from one mudra to the next.
Example: "The dancer uses Alapadma to express purity, conveying a sense of peace. The performance then transitions to Katakamukha, representing a garland and expressing love. Finally, the dancer performs Chandrakala, symbolizing calmness and serenity."

Return the output strictly as a JSON object containing:
1. The identified dance style
2. An array of segments with proper timing
3. A storyline that weaves together all the mudras and their meanings in sequence
`;

/**
 * Helper to convert video file to Base64 string (for Node.js fs)
 */
const fileToGenerativePart = async (
    filePath: string
): Promise<{ base64Data: string; mimeType: string }> => {
    // Read the video file as buffer
    const videoBuffer = await fs.promises.readFile(filePath);
    const base64Data = videoBuffer.toString("base64");

    // Get file extension to determine MIME type
    const fileExtension = filePath.split(".").pop()?.toLowerCase();
    const mimeTypeMap: { [key: string]: string } = {
        mp4: "video/mp4",
        mpeg: "video/mpeg",
        mov: "video/quicktime",
        avi: "video/x-msvideo",
        mkv: "video/x-matroska",
        webm: "video/webm",
    };

    const mimeType = mimeTypeMap[fileExtension || "mp4"] || "video/mp4";

    return { base64Data, mimeType };
};

/**
 * Validate and fix segment timing to ensure realistic durations
 */
const validateSegmentTiming = (segments: DanceSegment[]): DanceSegment[] => {
    if (!segments || segments.length === 0) return segments;

    const MIN_DURATION = 1.0; // Minimum 1 second per segment
    const sorted = [...segments].sort((a, b) => a.startTime - b.startTime);
    const validated: DanceSegment[] = [];

    for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        const duration = current.endTime - current.startTime;

        // If segment is too short, try to merge with next or extend
        if (duration < MIN_DURATION && i < sorted.length - 1) {
            const next = sorted[i + 1];
            // Merge current with next
            validated.push({
                ...current,
                endTime: next.endTime,
                description: `${current.description} ${next.description}`,
            });
            i++; // Skip next since we merged it
        } else {
            validated.push(current);
        }
    }

    return validated;
};

/**
 * Analyze a video using Gemini AI
 *
 * @param videoPath - Full path to the video file on disk
 * @param prompt - Custom prompt for analysis (optional)
 * @returns Gemini AI response as structured JSON
 */
export const analyzeVideoWithML = async (
    videoPath: string,
    prompt?: string
): Promise<DanceAnalysisResult> => {
    try {
        console.log("🤖 Starting ML analysis for:", videoPath);

        // 1. Convert video file to Base64
        const { base64Data, mimeType } = await fileToGenerativePart(videoPath);

        // 2. Define the schema for structured JSON output
        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                danceStyle: {
                    type: Type.STRING,
                    description:
                        "The likely style of dance (e.g., Bharatanatyam, Odissi)",
                },
                segments: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            startTime: {
                                type: Type.NUMBER,
                                description: "Start time of the gesture in seconds",
                            },
                            endTime: {
                                type: Type.NUMBER,
                                description: "End time of the gesture in seconds",
                            },
                            mudraName: {
                                type: Type.STRING,
                                description: "Sanskrit name of the Mudra or 'Transition'",
                            },
                            meaning: {
                                type: Type.STRING,
                                description: "Brief meaning or context",
                            },
                            expression: {
                                type: Type.STRING,
                                description: "Facial expression or Rasa",
                            },
                            description: {
                                type: Type.STRING,
                                description: "A continuous description of the movement",
                            },
                        },
                        required: [
                            "startTime",
                            "endTime",
                            "mudraName",
                            "meaning",
                            "expression",
                            "description",
                        ],
                    },
                },
                storyline: {
                    type: Type.STRING,
                    description:
                        "A cohesive narrative that weaves together all the mudras and their meanings in sequence, telling the story of the performance",
                },
            },
            required: ["danceStyle", "segments", "storyline"],
        };

        // 3. Call Gemini API with Retry Logic
        const MAX_RETRIES = 5;
        const INITIAL_BACKOFF = 5000; // 5 seconds

        let attempt = 0;
        const customPrompt =
            prompt ||
            "Analyze this dance video continuously. Create segments that are AT LEAST 1.5-3 seconds long each. Each mudra or movement should have realistic timing (2-4 seconds for held poses, 1-2 seconds for transitions). Ensure captions flow seamlessly without flickering or rapid changes.";

        while (attempt < MAX_RETRIES) {
            try {
                if (attempt > 0) {
                    console.log(`Using model: gemini-3-flash-preview (Attempt ${attempt + 1}/${MAX_RETRIES})`);
                }

                // Get Gemini client (will fetch API key from database)
                const geminiClient = await getGeminiClient();

                const response = await geminiClient.models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: [
                        {
                            role: "user",
                            parts: [
                                {
                                    inlineData: {
                                        mimeType: mimeType,
                                        data: base64Data,
                                    },
                                },
                                {
                                    text: customPrompt,
                                },
                            ],
                        },
                    ],
                    config: {
                        systemInstruction: SYSTEM_INSTRUCTION,
                        responseMimeType: "application/json",
                        responseSchema: responseSchema,
                        temperature: 0.4,
                    },
                });

                const textResponse = response.text;
                if (!textResponse) {
                    throw new Error("No response from AI model");
                }

                console.log("✅ ML analysis completed");

                const parsed = JSON.parse(textResponse) as DanceAnalysisResult;

                // Post-process: Validate and fix segment timing
                const validatedSegments = validateSegmentTiming(parsed.segments);

                return {
                    ...parsed,
                    segments: validatedSegments,
                };

            } catch (error: any) {
                attempt++;

                // Detailed error logging
                console.error(`❌ Attempt ${attempt} failed:`, error?.message || error);

                // Check for rate limits (429 or RESOURCE_EXHAUSTED)
                const isRateLimit =
                    error?.status === 429 ||
                    error?.status === "RESOURCE_EXHAUSTED" ||
                    /quota|rate limit/i.test(error?.message || "");

                if (isRateLimit && attempt < MAX_RETRIES) {
                    // Exponential backoff with jitter: waitTime = (base * 2^attempt) + random_jitter
                    // Base 5s -> 10s, 20s, 40s, 80s
                    const backoff = INITIAL_BACKOFF * Math.pow(2, attempt - 1);
                    const jitter = Math.random() * 1000;
                    const waitTime = backoff + jitter;

                    console.warn(`⚠️ Rate limit hit. Waiting ${Math.round(waitTime / 1000)}s before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }

                // If not rate limit or max retries reached
                const msg = error?.message || "";
                if (isRateLimit) {
                    throw new Error("Gemini free tier quota exceeded. Please wait a minute before trying again.");
                }

                throw new Error(`ML analysis failed: ${msg}`);
            }
        }

        throw new Error("Analysis failed after maximum retries");
    } catch (error: any) {
        console.error("❌ Final ML Service Error:", error);
        throw error;
    }
};

/**
 * Get available ML models
 */
export const getAvailableModels = async (): Promise<string[]> => {
    try {
        // Available Gemini models
        return [
            "gemini-3-flash-preview",
            "gemini-2.0-flash-exp",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
        ];
    } catch (error) {
        console.error("Error fetching models:", error);
        return [];
    }
};

/**
 * Unified video analysis function
 * Routes to either Gemini API or local model based on modelType
 * 
 * @param videoPath - Full path to the video file
 * @param modelType - 'gemini' or 'local'
 * @param prompt - Optional custom prompt (only used for Gemini)
 * @returns Analysis result
 */
export const analyzeVideo = async (
    videoPath: string,
    modelType: 'gemini' | 'local' = 'gemini',
    prompt?: string
): Promise<DanceAnalysisResult> => {
    console.log(`🤖 Analyzing video with ${modelType} model`);

    if (modelType === 'local') {
        // Import local model service dynamically to avoid circular dependencies
        const { analyzeVideoWithLocalModel } = await import('./localModelService');
        return analyzeVideoWithLocalModel(videoPath);
    } else {
        // Use Gemini API
        return analyzeVideoWithML(videoPath, prompt);
    }
};
