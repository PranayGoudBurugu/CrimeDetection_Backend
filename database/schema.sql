-- ============================================
-- NITHYA ANALYSIS DATABASE SCHEMA
-- ============================================

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS analyses CASCADE;

-- ============================================
-- ANALYSES TABLE
-- ============================================
-- This table stores video analysis results from Gemini API
CREATE TABLE analyses (
    -- Unique identifier for each analysis
    id SERIAL PRIMARY KEY,
    
    -- Original filename of the uploaded video
    video_filename VARCHAR(500) NOT NULL,
    
    -- Path where video is stored on server
    video_path VARCHAR(1000) NOT NULL,
    
    -- File size in bytes
    file_size BIGINT,
    
    -- MIME type (e.g., video/mp4, video/avi)
    mime_type VARCHAR(100),
    
    -- Duration of video in seconds
    duration INTEGER,
    
    -- Status of the analysis
    -- pending: waiting to be processed
    -- processing: currently being analyzed
    -- completed: analysis finished successfully
    -- failed: analysis encountered an error
    status VARCHAR(50) DEFAULT 'pending',
    
    -- The complete JSON response from ML API
    -- Stored as JSONB for efficient querying
    ml_response JSONB,
    
    -- Error message if analysis failed
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- When analysis was completed
    completed_at TIMESTAMP
);

-- ============================================
-- INDEXES for faster queries
-- ============================================

-- Index on status for filtering by analysis state
CREATE INDEX idx_analyses_status ON analyses(status);

-- Index on created_at for sorting by date (for history page)
CREATE INDEX idx_analyses_created_at ON analyses(created_at DESC);

-- Index on video_filename for searching
CREATE INDEX idx_analyses_video_filename ON analyses(video_filename);

-- ============================================
-- FUNCTION to update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_analyses_updated_at
    BEFORE UPDATE ON analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SAMPLE QUERY EXAMPLES
-- ============================================

-- Get all analyses ordered by most recent
-- SELECT * FROM analyses ORDER BY created_at DESC;

-- Get only completed analyses
-- SELECT * FROM analyses WHERE status = 'completed' ORDER BY created_at DESC;

-- Get analysis with ML response
-- SELECT id, video_filename, status, ml_response FROM analyses WHERE id = 1;

-- Count analyses by status
-- SELECT status, COUNT(*) FROM analyses GROUP BY status;
