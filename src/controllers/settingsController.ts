import { Request, Response } from 'express';
import pool from '../config/database';

/**
 * SETTINGS CONTROLLER
 * 
 * Handles application-wide settings management:
 * - Default model selection (Gemini vs Local)
 * - Gemini API key management
 */

// ============================================
// GET /settings
// Get current application settings
// ============================================
export const getSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('🔍 Fetching application settings');

        const query = 'SELECT id, default_model, gemini_api_key, updated_at FROM settings WHERE id = 1';
        const result = await pool.query(query);

        if (result.rows.length === 0) {
            // If no settings exist, create default
            const insertQuery = `
                INSERT INTO settings (id, default_model, gemini_api_key)
                VALUES (1, 'gemini', NULL)
                RETURNING id, default_model, gemini_api_key, updated_at
            `;
            const insertResult = await pool.query(insertQuery);

            res.status(200).json({
                success: true,
                data: {
                    ...insertResult.rows[0],
                    hasApiKey: false
                }
            });
            return;
        }

        const settings = result.rows[0];

        // Don't send the full API key to frontend, just indicate if it exists
        res.status(200).json({
            success: true,
            data: {
                id: settings.id,
                default_model: settings.default_model,
                hasApiKey: !!settings.gemini_api_key,
                // Send masked version of API key (first 10 chars + ***)
                apiKeyPreview: settings.gemini_api_key
                    ? `${settings.gemini_api_key.substring(0, 10)}***`
                    : null,
                updated_at: settings.updated_at
            }
        });

    } catch (error) {
        console.error('❌ Error fetching settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch settings',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// ============================================
// PUT /settings
// Update application settings
// ============================================
export const updateSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('📝 Updating application settings');

        const { default_model, gemini_api_key } = req.body;

        // Validate default_model if provided
        if (default_model && default_model !== 'gemini' && default_model !== 'local') {
            res.status(400).json({
                success: false,
                message: 'Invalid default_model. Must be "gemini" or "local".'
            });
            return;
        }

        // Build update query dynamically based on what's provided
        const updates: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (default_model !== undefined) {
            updates.push(`default_model = $${paramCount}`);
            values.push(default_model);
            paramCount++;
        }

        if (gemini_api_key !== undefined) {
            updates.push(`gemini_api_key = $${paramCount}`);
            values.push(gemini_api_key);
            paramCount++;
        }

        if (updates.length === 0) {
            res.status(400).json({
                success: false,
                message: 'No settings provided to update'
            });
            return;
        }

        const query = `
            UPDATE settings
            SET ${updates.join(', ')}
            WHERE id = 1
            RETURNING id, default_model, gemini_api_key, updated_at
        `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Settings not found'
            });
            return;
        }

        const settings = result.rows[0];

        console.log('✅ Settings updated successfully');

        res.status(200).json({
            success: true,
            message: 'Settings updated successfully',
            data: {
                id: settings.id,
                default_model: settings.default_model,
                hasApiKey: !!settings.gemini_api_key,
                apiKeyPreview: settings.gemini_api_key
                    ? `${settings.gemini_api_key.substring(0, 10)}***`
                    : null,
                updated_at: settings.updated_at
            }
        });

    } catch (error) {
        console.error('❌ Error updating settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update settings',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// ============================================
// GET /settings/api-key
// Get the actual API key (for backend use)
// This should be protected in production!
// ============================================
export const getApiKey = async (): Promise<string | null> => {
    try {
        const query = 'SELECT gemini_api_key FROM settings WHERE id = 1';
        const result = await pool.query(query);

        if (result.rows.length === 0 || !result.rows[0].gemini_api_key) {
            // Fallback to environment variable
            return process.env.GEMINI_API_KEY || null;
        }

        return result.rows[0].gemini_api_key;
    } catch (error) {
        console.error('❌ Error fetching API key from database:', error);
        // Fallback to environment variable
        return process.env.GEMINI_API_KEY || null;
    }
};

// ============================================
// GET /settings/default-model
// Get the default model type
// ============================================
export const getDefaultModel = async (): Promise<'gemini' | 'local'> => {
    try {
        const query = 'SELECT default_model FROM settings WHERE id = 1';
        const result = await pool.query(query);

        if (result.rows.length === 0) {
            return 'gemini'; // Default fallback
        }

        return result.rows[0].default_model as 'gemini' | 'local';
    } catch (error) {
        console.error('❌ Error fetching default model:', error);
        return 'gemini'; // Default fallback
    }
};
