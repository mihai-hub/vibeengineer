-- VibeEngineer Task Checkpoint Table
-- Persists long-running AI task state so GCP container restarts
-- don't lose in-progress work.

CREATE TABLE IF NOT EXISTS vibe_task_checkpoints (
    session_id  TEXT        PRIMARY KEY,
    goal        TEXT        NOT NULL DEFAULT '',
    status      TEXT        NOT NULL DEFAULT 'running',
    result      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast status queries on startup resume check
CREATE INDEX IF NOT EXISTS idx_vibe_checkpoints_status
    ON vibe_task_checkpoints(status);

-- RLS: service_role only
ALTER TABLE vibe_task_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON vibe_task_checkpoints
    FOR ALL
    USING    (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
