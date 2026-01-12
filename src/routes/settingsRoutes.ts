import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController';
// import { requireAdmin } from '../middleware/adminAuth'; // TODO: Enable when JWT auth is implemented

/**
 * SETTINGS ROUTES
 * 
 * API endpoints for application settings management
 * 
 * NOTE: These endpoints should be protected with admin authentication in production.
 * Currently, the frontend restricts access to admin users only (anuragnarsingoju@gmail.com).
 * For full security, uncomment the requireAdmin middleware below.
 */

const router = express.Router();

/**
 * GET /settings
 * 
 * Get current application settings
 * 
 * Response: JSON with settings data
 * {
 *   success: true,
 *   data: {
 *     id: 1,
 *     default_model: 'gemini' | 'local',
 *     hasApiKey: boolean,
 *     apiKeyPreview: 'AIzaSyDO9B***' | null,
 *     updated_at: timestamp
 *   }
 * }
 * 
 * TODO: Add admin middleware: router.get('/settings', requireAdmin, getSettings);
 */
router.get('/settings', getSettings);

/**
 * PUT /settings
 * 
 * Update application settings
 * 
 * Request body:
 * {
 *   default_model?: 'gemini' | 'local',
 *   gemini_api_key?: string
 * }
 * 
 * Response: JSON with updated settings
 * 
 * TODO: Add admin middleware: router.put('/settings', requireAdmin, updateSettings);
 */
router.put('/settings', updateSettings);

export default router;
