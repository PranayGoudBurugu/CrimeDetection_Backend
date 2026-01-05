import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Multer Configuration for Video Upload
 * 
 * Multer is a middleware that handles multipart/form-data (file uploads).
 * This configuration defines:
 * - Where to store uploaded files
 * - What to name them
 * - What types of files to accept
 */

// Create uploads directory if it doesn't exist
// Create uploads directory
// On Vercel (serverless), we must use /tmp as it's the only writable directory
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const uploadDir = isServerless ? os.tmpdir() : path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
    } catch (error) {
        console.warn(`Failed to create upload dir at ${uploadDir}, using /tmp instead`, error);
    }
}

/**
 * Storage configuration
 * Defines where and how to store uploaded files
 */
const storage = multer.diskStorage({
    // Where to save the file
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    // What to name the file
    // Format: timestamp-originalname.ext
    // Example: 1704481200000-dance-video.mp4
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const nameWithoutExt = path.basename(file.originalname, ext);
        cb(null, `${uniqueSuffix}-${nameWithoutExt}${ext}`);
    }
});

/**
 * File filter - Only accept video files
 * This prevents users from uploading non-video files
 */
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Allowed video MIME types
    const allowedMimeTypes = [
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/x-msvideo',
        'video/x-matroska',
        'video/webm'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        // Accept the file
        cb(null, true);
    } else {
        // Reject the file
        cb(new Error('Invalid file type. Only video files are allowed.'));
    }
};

/**
 * Multer upload instance
 * Configure size limits and file filter
 */
export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        // Maximum file size: 100MB
        // Adjust this based on your needs
        fileSize: 100 * 1024 * 1024, // 100MB in bytes
    }
});

export default upload;
