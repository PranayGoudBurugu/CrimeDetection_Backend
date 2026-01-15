import { put, del } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

/**
 * Storage Service
 * 
 * Handles file uploads to cloud storage (Vercel Blob)
 * Falls back to local storage in development
 */

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

/**
 * Upload a video file to storage
 * 
 * @param filePath - Local path to the file
 * @param filename - Desired filename in storage
 * @returns Public URL of the uploaded file
 */
export const uploadVideo = async (filePath: string, filename: string): Promise<string> => {
    try {
        if (isProduction) {
            // Use Vercel Blob in production
            console.log('☁️ Uploading to Vercel Blob:', filename);

            // Use streaming for efficient upload of large files
            const fileStream = fs.createReadStream(filePath);

            // Determine content type from file extension
            const ext = path.extname(filename).toLowerCase();
            const contentTypeMap: { [key: string]: string } = {
                '.mp4': 'video/mp4',
                '.mpeg': 'video/mpeg',
                '.mov': 'video/quicktime',
                '.avi': 'video/x-msvideo',
                '.mkv': 'video/x-matroska',
                '.webm': 'video/webm',
            };
            const contentType = contentTypeMap[ext] || 'video/mp4';

            const blob = await put(filename, fileStream, {
                access: 'public',
                addRandomSuffix: false,
                contentType: contentType,
            });

            console.log('✅ Uploaded to Vercel Blob:', blob.url);
            return blob.url;
        } else {
            // Use local storage in development
            console.log('💾 Using local storage:', filePath);
            return filePath;
        }
    } catch (error) {
        console.error('❌ Upload failed:', error);
        throw error;
    }
};

/**
 * Delete a video file from storage
 * 
 * @param url - URL or path of the file to delete
 */
export const deleteVideo = async (url: string): Promise<void> => {
    try {
        if (isProduction && url.includes('vercel-storage.com')) {
            // Delete from Vercel Blob
            console.log('🗑️ Deleting from Vercel Blob:', url);
            await del(url);
            console.log('✅ Deleted from Vercel Blob');
        } else if (!isProduction) {
            // Delete from local filesystem
            if (fs.existsSync(url)) {
                await fs.promises.unlink(url);
                console.log('✅ Deleted from local storage');
            }
        }
    } catch (error) {
        console.error('❌ Delete failed:', error);
        // Don't throw - deletion failures shouldn't break the app
    }
};

/**
 * Get the public URL for a video
 * 
 * @param videoPath - Database stored path/URL
 * @returns Public accessible URL
 */
export const getVideoUrl = (videoPath: string): string => {
    // If it's already a full URL (from Vercel Blob), return as-is
    if (videoPath.startsWith('http://') || videoPath.startsWith('https://')) {
        return videoPath;
    }

    // For local development, construct the URL
    const filename = path.basename(videoPath);
    return `/uploads/${filename}`;
};
