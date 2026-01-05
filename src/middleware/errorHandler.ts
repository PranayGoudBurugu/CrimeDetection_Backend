import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

/**
 * ERROR HANDLING MIDDLEWARE
 * 
 * This middleware catches errors and sends appropriate responses
 */

/**
 * Handle Multer file upload errors
 */
export const handleMulterError = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (err instanceof multer.MulterError) {
        // Multer-specific errors
        if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({
                success: false,
                message: 'File too large. Maximum file size is 100MB.',
                error: err.message
            });
            return;
        }

        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            res.status(400).json({
                success: false,
                message: 'Unexpected field name. Use "video" as the field name.',
                error: err.message
            });
            return;
        }

        // Other multer errors
        res.status(400).json({
            success: false,
            message: 'File upload error',
            error: err.message
        });
        return;
    }

    // Pass to next error handler
    next(err);
};

/**
 * General error handler
 */
export const handleError = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    console.error('❌ Error:', err);

    // Check if it's a file type error from multer
    if (err.message && err.message.includes('Invalid file type')) {
        res.status(400).json({
            success: false,
            message: err.message,
            error: 'Invalid file type'
        });
        return;
    }

    // Default error response
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: err.message || 'Unknown error occurred'
    });
};

/**
 * 404 Not Found handler
 */
export const handle404 = (req: Request, res: Response): void => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        error: `Cannot ${req.method} ${req.path}`
    });
};
