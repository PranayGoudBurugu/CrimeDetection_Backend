import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import dotenv from "dotenv";
import { ThreatAnalysisResult, ThreatSegment } from "../types";

dotenv.config();

/**
 * ML AI Service - CrimeWatch AI
 *
 * This service handles all interactions with Google's Gemini AI API
 * It sends CCTV video files to the Gemini API and gets structured threat analysis results
 */

// Initialize Gemini Client with dynamic API key support
let ai: any = null;

const getGeminiClient = async () => {
  if (ai) return ai;

  let apiKey: string | null | undefined;

  // Try to get API key from database
  try {
    const { getApiKey } = await import("../controllers/settingsController");
    apiKey = await getApiKey();

    if (apiKey) {
      console.log("ℹ️ Using Gemini API key from database");
      const { GoogleGenAI } = await import("@google/genai");
      ai = new GoogleGenAI({ apiKey });
      return ai;
    }
  } catch (error) {
    console.warn(
      "Could not fetch API key from database, using environment variable",
    );
  }

  // Fallback to environment variable
  apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error(
      "❌ GEMINI_API_KEY is not set in environment variables or database!",
    );
    throw new Error("GEMINI_API_KEY is required but not configured");
  }

  console.log("ℹ️ Using Gemini API key from environment variable");
  const { GoogleGenAI } = await import("@google/genai");
  ai = new GoogleGenAI({ apiKey });
  return ai;
};

const SYSTEM_INSTRUCTION = `
You are an expert security analyst specializing in CCTV surveillance video analysis and crime detection. 
Your task is to analyze video footage frame-by-frame and detect potential criminal or dangerous activities.

**THREAT CATEGORIES TO DETECT:**
1. **CROWD**: Unusual gathering of people, crowd formation, mob activity, stampede risk, or abnormal crowd density
2. **WEAPON**: Sharp objects (knives, blades, scissors), guns, sticks, bats, improvised weapons, or any weapon-like objects being carried or brandished
3. **VIOLENCE**: Physical altercations, punching, kicking, pushing, aggressive behavior, fighting between individuals or groups
4. **SUSPICIOUS**: Unusual behavior, loitering, trespassing, vandalism, theft attempts, or any other suspicious activity

**CRITICAL RULES FOR TIMING:**
1. **NO GAPS**: The analysis must cover the video from 0.0 seconds to the very end.
2. **CONTINUITY**: The End Time of one segment MUST be the Start Time of the next segment.
3. **MINIMUM DURATION**: Each segment MUST be AT LEAST 1.5-3 seconds long. Do NOT create segments shorter than 1 second.
4. **REALISTIC TIMING**: Match your timing to actual events in the footage. A fight sequence may last 5-10 seconds, crowd activity 3-5 seconds.
5. **EXAMPLE TIMING**: For a 10-second video, create 3-5 segments (e.g., 0.0-2.5s, 2.5-5.0s, 5.0-7.5s, 7.5-10.0s).

**SEVERITY LEVELS:**
- **LOW**: Minor or potential concern (e.g., people gathering, someone carrying a bag suspiciously)
- **MEDIUM**: Moderate concern requiring attention (e.g., verbal altercation, unusual crowd density)
- **HIGH**: Significant threat requiring immediate attention (e.g., physical fight starting, sharp object visible)
- **CRITICAL**: Immediate danger (e.g., active violence with weapons, large-scale fight, weapon being used)

**CONTENT RULES:**
1. **DEFAULT STATE**: If no specific threat is clear, or the scene is calm, label the threatType as "Normal Activity" or "Monitoring" and describe what is visible (people walking, empty area, etc.) with severity "LOW".
2. **Be Specific**: Describe exactly what you see — number of people, type of object, nature of altercation.
3. **Err on caution**: If something looks suspicious but you're not certain, still flag it with appropriate severity.

**INCIDENT SUMMARY GENERATION:**
After analyzing all segments, create a cohesive incident summary that describes the overall security situation.
Example: "The footage shows a normal street scene that escalates when two individuals begin a physical altercation at 5.2 seconds. A sharp object appears to be produced at 8.0 seconds, escalating the threat level to CRITICAL. Crowd gathers around the incident. Immediate security response recommended."

**CONTENT VALIDATION (CRITICAL):**
1. **Analyze the visual content first.** Determine if the video contains surveillance-relevant content (people, objects, activities).
2. **Non-relevant content**: If the video is clearly a movie/TV clip, animation, or content with no surveillance value, set "isValid" to false and provide a reason.
3. **If VALID**: Proceed with the full threat analysis as described above.

Return the output strictly as a JSON object containing:
1. "isValid": boolean (true if the video has surveillance-relevant content, false otherwise)
2. "rejectionReason": string (if invalid, explain why)
3. The scene type description (if valid) - e.g., "Street Surveillance", "Indoor Camera", "Parking Lot"
4. An array of segments with proper timing and threat classification (if valid)
5. An incident summary that describes the overall security assessment (if valid)
`;

/**
 * Helper to convert video file to Base64 string (for Node.js fs)
 */
const fileToGenerativePart = async (
  filePath: string,
): Promise<{ base64Data: string; mimeType: string }> => {
  const videoBuffer = await fs.promises.readFile(filePath);
  const base64Data = videoBuffer.toString("base64");

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
const validateSegmentTiming = (segments: ThreatSegment[]): ThreatSegment[] => {
  if (!segments || segments.length === 0) return segments;

  const MIN_DURATION = 1.0;
  const sorted = [...segments].sort((a, b) => a.startTime - b.startTime);
  const validated: ThreatSegment[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const duration = current.endTime - current.startTime;

    if (duration < MIN_DURATION && i < sorted.length - 1) {
      const next = sorted[i + 1];
      validated.push({
        ...current,
        endTime: next.endTime,
        description: `${current.description} ${next.description}`,
      });
      i++;
    } else {
      validated.push(current);
    }
  }

  return validated;
};

/**
 * Analyze a CCTV video using Gemini AI
 *
 * @param videoPath - Full path to the video file on disk
 * @param prompt - Custom prompt for analysis (optional)
 * @returns Gemini AI response as structured JSON
 */
export const analyzeVideoWithML = async (
  videoPath: string,
  prompt?: string,
): Promise<ThreatAnalysisResult> => {
  try {
    console.log("🤖 Starting ML threat analysis for:", videoPath);

    // 1. Convert video file to Base64
    const { base64Data, mimeType } = await fileToGenerativePart(videoPath);

    // 2. Define the schema for structured JSON output
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        isValid: {
          type: Type.BOOLEAN,
          description:
            "Set to true if the video contains surveillance-relevant content. Set to false for animations, movie clips, or non-relevant content.",
        },
        rejectionReason: {
          type: Type.STRING,
          description:
            "If isValid is false, explain why (e.g., 'Video is an animation', 'No surveillance-relevant content detected').",
        },
        sceneType: {
          type: Type.STRING,
          description:
            "The type of surveillance scene (e.g., 'Street Surveillance', 'Indoor Camera', 'Parking Lot', 'Mall Corridor'). Null if invalid.",
        },
        segments: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              startTime: {
                type: Type.NUMBER,
                description: "Start time of the detected event in seconds",
              },
              endTime: {
                type: Type.NUMBER,
                description: "End time of the detected event in seconds",
              },
              threatType: {
                type: Type.STRING,
                description: "Type of threat detected (e.g., 'Physical Fight', 'Sharp Object Detected', 'Crowd Gathering', 'Normal Activity', 'Suspicious Movement')",
              },
              severity: {
                type: Type.STRING,
                description: "Severity level: LOW, MEDIUM, HIGH, or CRITICAL",
              },
              alertCategory: {
                type: Type.STRING,
                description: "Category of alert: CROWD, WEAPON, VIOLENCE, or SUSPICIOUS",
              },
              description: {
                type: Type.STRING,
                description: "Detailed description of what is happening in this segment",
              },
            },
            required: [
              "startTime",
              "endTime",
              "threatType",
              "severity",
              "alertCategory",
              "description",
            ],
          },
        },
        incidentSummary: {
          type: Type.STRING,
          description:
            "A comprehensive incident summary describing the overall security assessment, key threats detected, and recommended response level",
        },
      },
      required: ["isValid"],
    };

    // 3. Call Gemini API — model fallback chain with retry on overload
    // Source: https://ai.google.dev/gemini-api/docs/models
    // gemini-2.5-flash = current stable, supports video
    // gemini-2.5-flash-preview-09-2025 = preview variant
    // gemini-2.0-flash-001 = deprecated but still operational fallback
    const MODEL_CHAIN = [
      "gemini-2.5-flash",
      "gemini-2.5-flash-preview-09-2025",
      "gemini-2.0-flash-001",
    ];
    const MAX_RETRIES_PER_MODEL = 2;
    // 429 = quota exceeded (needs ~60s), 503 = overload (needs ~6s)
    const QUOTA_BACKOFF_MS = 60000;
    const OVERLOAD_BACKOFF_MS = 6000;

    const customPrompt =
      prompt ||
      "Analyze this CCTV footage for threats. Detect crowds, sharp objects, weapons, fights, violence, or any suspicious activity. Create segments that are AT LEAST 1.5-3 seconds long each. Include severity levels (LOW/MEDIUM/HIGH/CRITICAL) and alert categories (CROWD/WEAPON/VIOLENCE/SUSPICIOUS) for each detection.";

    let lastError: Error = new Error("Analysis failed");

    for (const modelName of MODEL_CHAIN) {
      let attempt = 0;

      while (attempt < MAX_RETRIES_PER_MODEL) {
        try {
          console.log(`🤖 Trying model: ${modelName} (attempt ${attempt + 1}/${MAX_RETRIES_PER_MODEL})`);

          const geminiClient = await getGeminiClient();

          const response = await geminiClient.models.generateContent({
            model: modelName,
            contents: [
              {
                role: "user",
                parts: [
                  { inlineData: { mimeType: mimeType, data: base64Data } },
                  { text: customPrompt },
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
          if (!textResponse) throw new Error("Empty response from AI model");

          console.log(`✅ ML analysis completed with ${modelName}`);

          const parsed = JSON.parse(textResponse) as ThreatAnalysisResult;

          // CHECK VALIDITY FIRST
          if (parsed.isValid === false) {
            console.warn(`⚠️ Video rejected by ML: ${parsed.rejectionReason}`);
            throw new Error(
              `Video Rejected: ${parsed.rejectionReason || "Content does not contain surveillance-relevant footage."}`,
            );
          }

          const validatedSegments = validateSegmentTiming(parsed.segments || []);
          return { ...parsed, segments: validatedSegments };

        } catch (error: any) {
          attempt++;
          const msg: string = error?.message || JSON.stringify(error) || "Unknown error";
          const statusCode = error?.status || error?.code || 0;

          console.error(`❌ ${modelName} attempt ${attempt} failed: ${msg.slice(0, 200)}`);

          // Don't retry on video rejection — content won't change with retries
          if (msg.includes("Video Rejected")) throw error;

          const isQuotaError = statusCode === 429 || /quota|rate.?limit|exceeded/i.test(msg);
          const isTransient =
            isQuotaError ||
            statusCode === 503 ||
            /unavailable|overload|high demand|capacity|exhausted/i.test(msg);

          if (isTransient && attempt < MAX_RETRIES_PER_MODEL) {
            // Quota errors need much longer waits than overload errors
            const baseWait = isQuotaError ? QUOTA_BACKOFF_MS : OVERLOAD_BACKOFF_MS;
            const waitMs = baseWait * attempt + Math.random() * 2000;
            console.warn(`⏳ ${isQuotaError ? "Quota" : "Overload"} error — waiting ${Math.round(waitMs / 1000)}s before retry ${modelName}...`);
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }

          lastError = new Error(`[${modelName}] ${msg}`);
          break; // move to the next model
        }
      }

      console.warn(`⚠️ ${modelName} exhausted — trying next model in chain...`);
    }

    throw new Error(`All Gemini models failed. Last error: ${lastError.message}`);
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
    return [
      "gemini-2.5-flash",
      "gemini-2.5-flash-preview-09-2025",
      "gemini-2.0-flash-001",
    ];
  } catch (error) {
    console.error("Error fetching models:", error);
    return [];
  }
};

/**
 * Unified video analysis function
 * Routes to either Gemini API or local model based on modelType
 */
export const analyzeVideo = async (
  videoPath: string,
  modelType: "gemini" | "local" = "gemini",
  prompt?: string,
): Promise<ThreatAnalysisResult> => {
  console.log(`🤖 Analyzing video with ${modelType} model`);

  if (modelType === "local") {
    const { analyzeVideoWithLocalModel } = await import("./localModelService");
    return analyzeVideoWithLocalModel(videoPath);
  } else {
    return analyzeVideoWithML(videoPath, prompt);
  }
};
