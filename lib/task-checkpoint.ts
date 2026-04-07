/**
 * lib/task-checkpoint.ts — VibeEngineer Task Checkpoint
 *
 * Persists long-running AI task state to Supabase so GCP container
 * restarts don't lose in-progress work.
 *
 * Uses SUPABASE_SERVICE_ROLE key (server-side only — never expose to client).
 * Falls back gracefully if Supabase is not configured.
 */

function getServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE || '';
  if (!url || !key) return null;

  // Lazy import to avoid bundling in client components
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface TaskCheckpoint {
  session_id: string;
  goal: string;
  status: 'running' | 'completed' | 'failed';
  result?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Write a checkpoint when a task starts.
 * Non-throwing — checkpoint failure never blocks the actual task.
 */
export async function saveCheckpoint(sessionId: string, goal: string): Promise<void> {
  try {
    const db = getServiceClient();
    if (!db) return;
    await db.from('vibe_task_checkpoints').upsert({
      session_id: sessionId,
      goal: goal.slice(0, 500),
      status: 'running',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id' });
  } catch { /* non-fatal */ }
}

/**
 * Mark a checkpoint as completed with optional result summary.
 */
export async function completeCheckpoint(sessionId: string, result?: string): Promise<void> {
  try {
    const db = getServiceClient();
    if (!db) return;
    await db.from('vibe_task_checkpoints')
      .update({
        status: 'completed',
        result: result?.slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId);
  } catch { /* non-fatal */ }
}

/**
 * Mark a checkpoint as failed.
 */
export async function failCheckpoint(sessionId: string, reason?: string): Promise<void> {
  try {
    const db = getServiceClient();
    if (!db) return;
    await db.from('vibe_task_checkpoints')
      .update({
        status: 'failed',
        result: reason?.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId);
  } catch { /* non-fatal */ }
}

/**
 * Get all checkpoints with status='running'.
 * Used on server startup to detect interrupted tasks.
 */
export async function getRunningCheckpoints(): Promise<TaskCheckpoint[]> {
  try {
    const db = getServiceClient();
    if (!db) return [];
    const { data } = await db
      .from('vibe_task_checkpoints')
      .select('*')
      .eq('status', 'running')
      .order('created_at', { ascending: false })
      .limit(10);
    return (data as TaskCheckpoint[]) ?? [];
  } catch {
    return [];
  }
}
