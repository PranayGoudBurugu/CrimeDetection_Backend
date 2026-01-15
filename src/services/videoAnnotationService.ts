import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { DanceAnalysisResult } from "../types";
import ffmpegStatic from "ffmpeg-static";

const execAsync = promisify(exec);

// Use the static FFmpeg binary (works locally and on Vercel)
const ffmpegPath = ffmpegStatic || "ffmpeg";

// Path to the bundled font file
// We use process.cwd() to resolve the path relative to the project root
// This is more reliable than __dirname which changes between src/ (ts-node) and dist/ (compiled)
const FONT_PATH = path.join(process.cwd(), "src/assets/fonts/Roboto-Regular.ttf");

/**
 * Video Annotation Service
 *
 * This service creates annotated videos with text overlays showing:
 * - Mudra name
 * - Meaning
 * - Expression/Emotion
 */

export interface AnnotationConfig {
    fontSize?: number;
    fontColor?: string;
    backgroundColor?: string;
    position?: "top" | "bottom" | "center";
}

/**
 * Generate FFmpeg drawtext filters for all segments
 */
const generateDrawtextFilters = (
    result: DanceAnalysisResult,
    config: AnnotationConfig = {}
): string => {
    const {
        fontSize = 24,
        fontColor = "white",
        backgroundColor = "black@0.7",
        position = "bottom",
    } = config;

    // Use a clean path for the font (handle spaces if necessary)
    // On Vercel/serverless, absolute paths are safer.
    // We check if the bundled font exists, otherwise fallback to system font (unlikely to work on Vercel but good for fallback)
    const fontFile = fs.existsSync(FONT_PATH) ? FONT_PATH : "/System/Library/Fonts/Supplemental/Arial.ttf";

    // Calculate Y position based on preference
    const getYPosition = (lineNumber: number) => {
        const lineHeight = fontSize + 10;
        switch (position) {
            case "top":
                return 30 + lineNumber * lineHeight;
            case "center":
                return `(h-${lineHeight * 3})/2+${lineNumber * lineHeight}`;
            case "bottom":
            default:
                return `h-${(3 - lineNumber) * lineHeight}-30`;
        }
    };

    const filters: string[] = [];

    result.segments.forEach((segment) => {
        const { startTime, endTime, mudraName, meaning, expression } = segment;

        // Format the text lines
        const line1 = `Mudra: ${mudraName}`;
        const line2 = `Meaning: ${meaning}`;
        const line3 = `Expression: ${expression}`;

        // Create drawtext filter for each line
        [line1, line2, line3].forEach((text, index) => {
            const escapedText = text.replace(/:/g, "\\:").replace(/'/g, "'\\\\\\''");

            const drawtextFilter = `drawtext=fontfile=${fontFile}:` +
                `text='${escapedText}':` +
                `fontcolor=${fontColor}:` +
                `fontsize=${fontSize}:` +
                `box=1:` +
                `boxcolor=${backgroundColor}:` +
                `boxborderw=5:` +
                `x=(w-text_w)/2:` +
                `y=${getYPosition(index)}:` +
                `enable='between(t,${startTime},${endTime})'`;

            filters.push(drawtextFilter);
        });
    });

    return filters.join(",");
};

/**
 * Create an annotated video with mudra information overlaid
 *
 * @param inputVideoPath - Path to the original video file
 * @param analysisResult - The dance analysis result with segments
 * @param outputDir - Directory to save the annotated video
 * @param config - Optional styling configuration
 * @returns Path to the annotated video file
 */
export const createAnnotatedVideo = async (
    inputVideoPath: string,
    analysisResult: DanceAnalysisResult,
    outputDir: string,
    config?: AnnotationConfig
): Promise<string> => {
    try {
        console.log("🎬 Starting video annotation...");
        console.log(`ℹ️ Using FFmpeg binary at: ${ffmpegPath}`);
        console.log(`ℹ️ Using Font at: ${FONT_PATH}`);

        // Create output directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Generate output filename
        const inputFilename = path.basename(inputVideoPath, path.extname(inputVideoPath));
        const outputFilename = `${inputFilename}_annotated.mp4`;
        const outputPath = path.join(outputDir, outputFilename);

        // Generate FFmpeg filters
        const drawtextFilters = generateDrawtextFilters(analysisResult, config);

        // Build FFmpeg command
        const ffmpegCommand = [
            `"${ffmpegPath}"`, // Use the static binary path
            "-i", `"${inputVideoPath}"`,
            "-vf", `"${drawtextFilters}"`,
            "-codec:a", "copy",
            "-y", // Overwrite output file if it exists
            `"${outputPath}"`
        ].join(" ");

        console.log("🔧 FFmpeg command generated");
        console.log("⏳ Processing video (this may take a while)...");

        // Execute FFmpeg command
        const { stdout, stderr } = await execAsync(ffmpegCommand);

        if (stderr && !stderr.includes("frame=")) {
            // Just log first 200 chars to avoid clutter if it's long
            console.warn("FFmpeg output (stderr):", stderr.substring(0, 200) + "...");
        }

        console.log("✅ Video annotation completed!");
        console.log("📹 Annotated video saved to:", outputPath);

        return outputPath;
    } catch (error: any) {
        console.error("❌ Video annotation failed:", error);

        // Check for FFmpeg installation (though static should prevent this)
        if (error.message.includes("command not found") || error.message.includes("not recognized")) {
            throw new Error(
                "FFmpeg binary not found. Please ensure ffmpeg-static is installed."
            );
        }

        throw new Error(
            `Video annotation failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
};

/**
 * Check if FFmpeg is installed and available
 */
export const checkFFmpegInstallation = async (): Promise<boolean> => {
    try {
        await execAsync(`"${ffmpegPath}" -version`);
        console.log(`✅ FFmpeg is installed at ${ffmpegPath}`);
        return true;
    } catch (error) {
        console.error("❌ FFmpeg is not installed or accessible");
        return false;
    }
};

/**
 * Generate a subtitle file (SRT) from the analysis result
 * This can be used as an alternative to video annotation
 */
export const generateSubtitleFile = (
    result: DanceAnalysisResult,
    outputPath: string
): string => {
    const srtContent = result.segments
        .map((segment, index) => {
            const formatTime = (seconds: number) => {
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                const secs = Math.floor(seconds % 60);
                const ms = Math.floor((seconds % 1) * 1000);
                return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
            };

            return [
                index + 1,
                `${formatTime(segment.startTime)} --> ${formatTime(segment.endTime)}`,
                `Mudra: ${segment.mudraName}`,
                `Meaning: ${segment.meaning}`,
                `Expression: ${segment.expression}`,
                "",
            ].join("\n");
        })
        .join("\n");

    fs.writeFileSync(outputPath, srtContent, "utf-8");
    console.log("📝 Subtitle file created:", outputPath);
    return outputPath;
};
