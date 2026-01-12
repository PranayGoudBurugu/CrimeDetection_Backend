-- ============================================
-- SETTINGS TABLE
-- ============================================
-- This table stores application-wide settings
-- For now, there's only one row with id=1 (singleton pattern)

CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    
    -- Default model to use for analysis
    -- 'gemini' or 'local'
    default_model VARCHAR(50) DEFAULT 'gemini',
    
    -- Gemini API Key (encrypted in production!)
    gemini_api_key TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings row
INSERT INTO settings (id, default_model, gemini_api_key)
VALUES (1, 'gemini', NULL)
ON CONFLICT (id) DO NOTHING;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Index for quick lookup (though we only have one row)
CREATE INDEX IF NOT EXISTS idx_settings_id ON settings(id);
