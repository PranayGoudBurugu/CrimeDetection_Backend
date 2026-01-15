import ImageKit from 'imagekit';
import fs from 'fs';
import path from 'path';

/**
 * Storage Service
 * 
 * Handles file uploads to cloud storage (ImageKit)
 * Falls back to local storage in development
 */

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

// Initialize ImageKit client
let imagekit: ImageKit | null = null;

const getImageKitClient = () => {
    if (imagekit) return imagekit;

    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

    if (!publicKey || !privateKey || !urlEndpoint) {
        console.warn('⚠️ ImageKit credentials not configured, uploads will fail in production');
        return null;
    }

    imagekit = new ImageKit({
        publicKey,
        privateKey,
        urlEndpoint,
    });

    return imagekit;
};

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
            // Use ImageKit in production
            const client = getImageKitClient();

            if (!client) {
                throw new Error('ImageKit not configured');
            }

            console.log('☁️ Uploading to ImageKit:', filename);

            // Read file as buffer for ImageKit
            const fileBuffer = await fs.promises.readFile(filePath);

            const response = await client.upload({
                file: fileBuffer,
                fileName: filename,
                folder: '/mudra-videos', // Organize videos in a folder
                useUniqueFileName: false,
            });

            console.log('✅ Uploaded to ImageKit:', response.url);
            return response.url;
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
        if (isProduction && url.includes('ik.imagekit.io')) {
            // Delete from ImageKit
            const client = getImageKitClient();

            if (!client) {
                console.warn('⚠️ ImageKit not configured, cannot delete');
                return;
            }

            // Extract fileId from URL
            // ImageKit URLs look like: https://ik.imagekit.io/your-id/path/filename.mp4
            const fileIdMatch = url.match(/\/([^\/]+)\.mp4$/);
            if (fileIdMatch) {
                const fileName = fileIdMatch[0].substring(1); // Remove leading slash

                console.log('🗑️ Deleting from ImageKit:', fileName);

                // List files to get fileId
                const files = await client.listFiles({
                    searchQuery: `name="${fileName}"`,
                });

                if (files.length > 0 && 'fileId' in files[0]) {
                    await client.deleteFile(files[0].fileId);
                    console.log('✅ Deleted from ImageKit');
                }
            }
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
    // If it's already a full URL (from ImageKit), return as-is
    if (videoPath.startsWith('http://') || videoPath.startsWith('https://')) {
        return videoPath;
    }

    // For local development, construct the URL
    const filename = path.basename(videoPath);
    return `/uploads/${filename}`;
};
