import pool from '../config/database';

// Embedded SQL schemas to avoid file system issues on Vercel
const SCHEMA_SQL = `
-- ============================================
-- NITHYA ANALYSIS DATABASE SCHEMA
-- ============================================

-- Drop existing tables if they exist (for clean setup)
-- DROP TABLE IF EXISTS analyses CASCADE; -- Commented out to prevent accidental data loss in prod

-- ============================================
-- ANALYSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS analyses (
    id SERIAL PRIMARY KEY,
    video_filename VARCHAR(500) NOT NULL,
    video_path VARCHAR(1000) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    duration INTEGER,
    model_type VARCHAR(50) DEFAULT 'gemini',
    status VARCHAR(50) DEFAULT 'pending',
    ml_response JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_video_filename ON analyses(video_filename);
CREATE INDEX IF NOT EXISTS idx_analyses_model_type ON analyses(model_type);

-- ============================================
-- UPDATE TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_analyses_updated_at') THEN
        CREATE TRIGGER update_analyses_updated_at
            BEFORE UPDATE ON analyses
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
`;

const SETTINGS_SCHEMA_SQL = `
-- ============================================
-- SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    default_model VARCHAR(50) DEFAULT 'gemini',
    gemini_api_key TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings row
INSERT INTO settings (id, default_model, gemini_api_key)
VALUES (1, 'gemini', NULL)
ON CONFLICT (id) DO NOTHING;

-- Trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_settings_updated_at') THEN
        CREATE TRIGGER update_settings_updated_at
            BEFORE UPDATE ON settings
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
`;

/**
 * Initialize Database Schema
 * 
 * This script runs automatically when the server starts to ensure
 * the database schema exists in the connected database.
 */
export const initializeDatabase = async () => {
    try {
        console.log('🔄 Checking database initialization...');

        // Check if analyses table exists
        const checkTableQuery = `
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'analyses'
            );
        `;

        const result = await pool.query(checkTableQuery);
        const exists = result.rows[0].exists;

        if (!exists) {
            console.log('⚠️ Database tables not found. Initializing schema...');

            // Execute schema SQL
            await pool.query(SCHEMA_SQL);
            console.log('✅ Main schema applied successfully');

            // Execute settings schema SQL
            await pool.query(SETTINGS_SCHEMA_SQL);
            console.log('✅ Settings schema applied successfully');

            console.log('🎉 Database initialization complete!');
        } else {
            console.log('✅ Database tables already exist. Skipping initialization.');

            // Check settings table separately just in case
            const checkSettingsTableQuery = `
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'settings'
                );
            `;
            const settingsResult = await pool.query(checkSettingsTableQuery);
            if (!settingsResult.rows[0].exists) {
                console.log('⚠️ Settings table not found. Initializing settings schema...');
                await pool.query(SETTINGS_SCHEMA_SQL);
                console.log('✅ Settings schema applied successfully');
            }
        }

    } catch (error) {
        console.error('❌ Database initialization failed:', error);
    }
};
