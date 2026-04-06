/**
 * lib/patch-guard.ts — VibeEngineerClaw Patch Guard
 *
 * Validates patches before they are applied to the project.
 * Guards the /api/patch endpoint against malicious or dangerous modifications.
 */

const MAX_PATCH_SIZE_BYTES = 50 * 1024; // 50 KB

/** Extensions that are forbidden for new files introduced via patch */
const FORBIDDEN_NEW_EXTENSIONS = ['.sh', '.env', '.config', '.bash', '.zsh', '.ps1', '.cmd', '.bat'];

/** Patterns indicating dangerous system commands embedded in patch content */
const SYSTEM_COMMAND_PATTERNS: RegExp[] = [
  /\brm\s+-rf\b/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/,
  /require\s*\(\s*['"`]child_process['"`]\s*\)/,
  /\beval\s*\(/,
  /fs\.unlink(?:Sync)?\s*\(/,
  /curl\s+http/i,
  /wget\s+http/i,
  /os\.system\s*\(/,
  /subprocess\.(?:run|call|Popen)\s*\(/,
  /\bexecSync\s*\(/,
  /\bspawnSync\s*\(/,
];

export interface PatchValidationResult {
  safe: boolean;
  blocked: string[];
}

/**
 * Validates an array of patches.
 * Each patch must:
 * - Only modify existing files (no new .sh, .env, .config files)
 * - Have content smaller than 50 KB
 * - Not contain system command patterns
 */
export function validatePatch(
  patches: Array<{ path: string; content: string }>
): PatchValidationResult {
  const blocked: string[] = [];

  for (const patch of patches) {
    const patchBlocked = validateSinglePatch(patch);
    blocked.push(...patchBlocked);
  }

  return {
    safe: blocked.length === 0,
    blocked,
  };
}

function validateSinglePatch(patch: { path: string; content: string }): string[] {
  const issues: string[] = [];
  const { path, content } = patch;

  // ── Check for forbidden new file extensions ─────────────────────
  const lowerPath = path.toLowerCase();
  for (const ext of FORBIDDEN_NEW_EXTENSIONS) {
    if (lowerPath.endsWith(ext)) {
      issues.push(`Blocked patch: '${path}' — forbidden extension '${ext}' (shell/env/config files not allowed)`);
    }
  }

  // ── Check content size ──────────────────────────────────────────
  const sizeBytes = new TextEncoder().encode(content).length;
  if (sizeBytes > MAX_PATCH_SIZE_BYTES) {
    issues.push(
      `Blocked patch: '${path}' — content too large (${Math.round(sizeBytes / 1024)}KB > 50KB limit)`
    );
  }

  // ── Check for system command patterns ──────────────────────────
  for (const pattern of SYSTEM_COMMAND_PATTERNS) {
    if (pattern.test(content)) {
      issues.push(`Blocked patch: '${path}' — detected dangerous pattern: ${pattern.source}`);
    }
  }

  return issues;
}
