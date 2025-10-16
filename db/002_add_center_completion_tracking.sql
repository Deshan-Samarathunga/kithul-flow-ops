-- Add center completion tracking table
-- This table tracks which centers are completed for each draft

CREATE TABLE IF NOT EXISTS center_completions (
    id SERIAL PRIMARY KEY,
    draft_id VARCHAR(50) NOT NULL,
    center_id VARCHAR(50) NOT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(draft_id, center_id)
);

-- Add foreign key constraints
ALTER TABLE center_completions 
ADD CONSTRAINT fk_center_completions_draft 
FOREIGN KEY (draft_id) REFERENCES drafts(draft_id) ON DELETE CASCADE;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_center_completions_draft_center 
ON center_completions(draft_id, center_id);

-- Add comment
COMMENT ON TABLE center_completions IS 'Tracks which collection centers are completed for each draft';
