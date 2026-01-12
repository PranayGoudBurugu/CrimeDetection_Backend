import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { DanceAnalysisResult, DanceSegment } from '../types';

/**
 * Local Model Service
 * 
 * This service handles interactions with the local Python ML model
 * located in Mudra-Analysis-backend-model directory
 */

const MODEL_DIR = path.join(__dirname, '../../Mudra-Analysis-backend-model');
const PYTHON_SCRIPT = path.join(MODEL_DIR, 'main_pipeline.py');

/**
 * Check if the local model is available
 */
export const isLocalModelAvailable = (): boolean => {
    try {
        return fs.existsSync(PYTHON_SCRIPT);
    } catch (error) {
        console.error('Error checking local model availability:', error);
        return false;
    }
};

/**
 * Parse the inference output from the Python model
 * The model outputs a JSON file with predictions
 */
const parseInferenceOutput = (outputPath: string): DanceAnalysisResult => {
    try {
        const rawData = fs.readFileSync(outputPath, 'utf-8');
        const predictions = JSON.parse(rawData);

        // Transform the Python model output to match our DanceAnalysisResult format
        const segments: DanceSegment[] = predictions.map((pred: any) => ({
            startTime: pred.start_frame / 30.0, // Assuming 30 FPS, convert frames to seconds
            endTime: pred.end_frame / 30.0,
            mudraName: pred.step || 'Unknown',
            meaning: pred.meaning || 'Movement sequence',
            expression: pred.expression || 'Neutral',
            description: pred.description || `Performing ${pred.step || 'movement'}`
        }));

        // Generate a simple storyline from the segments
        const storyline = generateStorylineFromSegments(segments);

        return {
            danceStyle: 'Bharatanatyam', // Default to Bharatanatyam for local model
            segments,
            storyline
        };
    } catch (error) {
        console.error('Error parsing inference output:', error);
        throw new Error(`Failed to parse model output: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Generate a cohesive storyline from segments
 */
const generateStorylineFromSegments = (segments: DanceSegment[]): string => {
    if (segments.length === 0) {
        return 'No dance movements detected in the video.';
    }

    const mudraDescriptions = segments.map((seg, idx) => {
        const timeRange = `${seg.startTime.toFixed(1)}s-${seg.endTime.toFixed(1)}s`;
        return `${idx + 1}. ${seg.mudraName} (${timeRange}): ${seg.meaning}`;
    });

    return `The performance consists of ${segments.length} distinct movements:\n\n${mudraDescriptions.join('\n')}`;
};

/**
 * Analyze video using the local Python ML model
 * 
 * @param videoPath - Full path to the video file
 * @returns Analysis result in DanceAnalysisResult format
 */
export const analyzeVideoWithLocalModel = async (
    videoPath: string
): Promise<DanceAnalysisResult> => {
    return new Promise((resolve, reject) => {
        console.log('🐍 Starting local model analysis for:', videoPath);

        // Check if model exists
        if (!isLocalModelAvailable()) {
            reject(new Error('Local model not found. Please ensure the Mudra-Analysis-backend-model directory exists.'));
            return;
        }

        // Prepare output paths
        const videoBasename = path.basename(videoPath, path.extname(videoPath));
        const outputJsonPath = path.join(MODEL_DIR, `${videoBasename}_inferred.json`);
        const outputStoryPath = path.join(MODEL_DIR, `${videoBasename}_story.txt`);

        // Clean up any existing output files
        if (fs.existsSync(outputJsonPath)) {
            fs.unlinkSync(outputJsonPath);
        }
        if (fs.existsSync(outputStoryPath)) {
            fs.unlinkSync(outputStoryPath);
        }

        // Spawn Python process
        const pythonProcess = spawn('python3', [
            PYTHON_SCRIPT,
            '--mode', 'inference',
            '--video_path', videoPath
        ], {
            cwd: MODEL_DIR,
            env: { ...process.env }
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            console.log('🐍 Model output:', output.trim());
        });

        pythonProcess.stderr.on('data', (data) => {
            const error = data.toString();
            stderr += error;
            console.error('🐍 Model error:', error.trim());
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error('❌ Python process exited with code:', code);
                console.error('stderr:', stderr);
                reject(new Error(`Local model failed with exit code ${code}: ${stderr}`));
                return;
            }

            // Check if output file was created
            if (!fs.existsSync(outputJsonPath)) {
                reject(new Error('Model did not produce output file. Check model logs.'));
                return;
            }

            try {
                // Parse the output
                const result = parseInferenceOutput(outputJsonPath);

                // Read storyline if available
                if (fs.existsSync(outputStoryPath)) {
                    const storyline = fs.readFileSync(outputStoryPath, 'utf-8');
                    result.storyline = storyline;
                }

                console.log('✅ Local model analysis completed');
                resolve(result);

                // Clean up output files
                setTimeout(() => {
                    try {
                        if (fs.existsSync(outputJsonPath)) fs.unlinkSync(outputJsonPath);
                        if (fs.existsSync(outputStoryPath)) fs.unlinkSync(outputStoryPath);
                    } catch (cleanupError) {
                        console.warn('Warning: Failed to clean up temporary files:', cleanupError);
                    }
                }, 1000);

            } catch (parseError) {
                reject(parseError);
            }
        });

        pythonProcess.on('error', (error) => {
            console.error('❌ Failed to start Python process:', error);
            reject(new Error(`Failed to start local model: ${error.message}`));
        });

        // Set timeout (5 minutes for video processing)
        const timeout = setTimeout(() => {
            pythonProcess.kill();
            reject(new Error('Local model analysis timed out after 5 minutes'));
        }, 5 * 60 * 1000);

        pythonProcess.on('close', () => {
            clearTimeout(timeout);
        });
    });
};

/**
 * Get information about the local model
 */
export const getLocalModelInfo = () => {
    return {
        available: isLocalModelAvailable(),
        modelPath: MODEL_DIR,
        scriptPath: PYTHON_SCRIPT,
        description: 'Local Bharatanatyam dance analysis model using MediaPipe and custom ML pipeline'
    };
};
