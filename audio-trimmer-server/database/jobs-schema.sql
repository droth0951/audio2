-- Job Queue Database Schema
-- Stores job metadata to survive container restarts

CREATE TABLE IF NOT EXISTS jobs (
  job_id VARCHAR(50) PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  request_data JSONB NOT NULL,
  estimated_cost DECIMAL(10,4),
  estimated_time INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  result_data JSONB,
  processing_time INTEGER,
  retries INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 2,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();