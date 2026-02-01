import path from "path";
import fs from "fs";
// @ts-ignore
import { openAsBlob } from "fs";
import { DanceAnalysisResult, DanceSegment } from "../types";

/**
 * Local Model Service
 *
 * This service handles interactions with the local Python ML model API
 * running on port 8000
 */

const LOCAL_API_URL =
  process.env.LOCAL_MODEL_API_URL || "http://localhost:8000";

/**
 * API Response Interfaces
 */
interface UploadResponse {
    task_id: string;
    status: string;
}

interface PollResponse {
    task_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'waiting';
    data?: any;
}

/**
 * Check if the local model is available
 */
export const isLocalModelAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${LOCAL_API_URL}/`);
    return response.ok;
  } catch (error) {
    console.error("Error checking local model availability:", error);
    return false;
  }
};

/**
 * Analyze video using the local Python ML model API
 *
 * @param videoPath - Full path to the video file
 * @returns Analysis result in DanceAnalysisResult format
 */
export const analyzeVideoWithLocalModel = async (
  videoPath: string,
): Promise<DanceAnalysisResult> => {
  console.log("🐍 Starting local model analysis for:", videoPath);

  // 1. Check availability
  const available = await isLocalModelAvailable();
  if (!available) {
    throw new Error("Local model API is not reachable at " + LOCAL_API_URL);
  }

  try {
    // 2. Verify file exists
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found at: ${videoPath}`);
    }

    // 3. Prepare upload using FormData
    const formData = new FormData();
    // Use Node's openAsBlob if available, otherwise read buffer
    // @ts-ignore
    const blob =
      typeof openAsBlob === "function"
        ? await openAsBlob(videoPath)
        : new Blob([fs.readFileSync(videoPath)]);

    const filename = path.basename(videoPath);
    formData.append("file", blob, filename);
    formData.append("use_mudra", "true");

    console.log("📤 Uploading video to local model API...");

    // 4. Send upload request
    const uploadResponse = await fetch(`${LOCAL_API_URL}/analyze`, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    const responseData = await uploadResponse.json() as UploadResponse;
    const { task_id } = responseData;
    console.log(`✅ Upload successful. Task ID: ${task_id}`);

    // 5. Poll for results
    const result = await pollForResults(task_id);

    // 6. Transform results
    return transformResult(result);
  } catch (error: any) {
    console.error("❌ Local model analysis failed:", error);
    throw error;
  }
};

/**
 * Poll the API for results
 */
const pollForResults = async (taskId: string): Promise<any> => {
  const POLL_INTERVAL = 2000; // 2 seconds
  const MAX_RETRIES = 150; // 5 minutes approx
  let attempts = 0;

  console.log("⏳ Polling for results...");

  while (attempts < MAX_RETRIES) {
    try {
      const response = await fetch(`${LOCAL_API_URL}/result/${taskId}`);

      if (response.ok) {
        const data = await response.json() as PollResponse;

        if (data.status === "completed") {
          console.log("✅ Analysis task completed");
          return data.data;
        } else if (data.status === "failed") {
          throw new Error("Task marked as failed by server");
        } else {
          // Still pending or processing
          if (attempts % 5 === 0) console.log(`...status: ${data.status}`);
        }
      }
    } catch (e) {
      console.warn("Polling error (ignoring):", e);
    }

    attempts++;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }

  throw new Error("Analysis timed out after polling limit reached");
};

/**
 * Transform Python API output to DanceAnalysisResult
 */
const transformResult = (predictions: any[]): DanceAnalysisResult => {
  try {
    // The API returns an array of predictions directly in 'data' field of result
    // Check if predictions is actually the array or wrapped
    const items = Array.isArray(predictions)
      ? predictions
      : (predictions as any).segments
        ? (predictions as any).segments
        : [];

    const segments: DanceSegment[] = items.map((pred: any) => ({
      startTime:
        typeof pred.start_frame === "number"
          ? pred.start_frame / 30.0
          : pred.startTime || 0,
      endTime:
        typeof pred.end_frame === "number"
          ? pred.end_frame / 30.0
          : pred.endTime || 0,
      mudraName: pred.step || pred.mudraName || "Unknown",
      meaning: pred.meaning || "Movement sequence",
      expression: pred.expression || "Neutral",
      description: pred.description || `Performing ${pred.step || "movement"}`,
    }));

    const storyline =
      `The performance consists of ${segments.length} distinct movements. ` +
      segments.map((s) => `${s.mudraName} (${s.meaning})`).join(", ") +
      ".";

    return {
      isValid: true,
      danceStyle: "Bharatanatyam",
      segments,
      storyline,
    };
  } catch (error) {
    console.error("Error transforming result:", error);
    // Return a safe fallback to avoid crashing
    return {
      isValid: true,
      danceStyle: "Bharatanatyam (Raw)",
      segments: [],
      storyline: "Analysis data could not be fully parsed.",
    };
  }
};

/**
 * Get information about the local model
 */
export const getLocalModelInfo = () => {
  return {
    available: true, // We check dynamically, but this static info assumes it's set up
    modelPath: LOCAL_API_URL,
    scriptPath: "Remote API",
    description: "Local Bharatanatyam dance analysis model (FastAPI)",
  };
};
