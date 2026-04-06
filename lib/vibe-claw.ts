/**
 * lib/vibe-claw.ts — VibeEngineerClaw Safety Guardrail Engine
 *
 * Scans generated files for malicious patterns, dangerous Node.js APIs,
 * and credential leaks before they reach the user.
 */

/** Domains considered safe for fetch() calls */
const FETCH_WHITELIST = [
  'localhost',
  '127.0.0.1',
  'api.openai.com',
  'api.anthropic.com',
  'supabase.co',
  'supabase.com',
  'vercel.com',
  'firebase.googleapis.com',
];

/** Keys considered sensitive when used with localStorage */
const SENSITIVE_LOCALSTORAGE_KEYS = [
  'token',
  'auth',
  'password',
  'secret',
  'api_key',
  'apikey',
  'credential',
  'session',
  'jwt',
  'bearer',
  'private',
  'access_token',
  'refresh_token',
];

export interface ValidationResult {
  safe: boolean;
  issues: string[];
  blocked: string[];
}

/**
 * Validates all generated files for security issues.
 */
export function validateCode(files: Record<string, string>): ValidationResult {
  const issues: string[] = [];
  const blocked: string[] = [];

  for (const [filePath, content] of Object.entries(files)) {
    const fileIssues = scanFile(filePath, content);
    for (const issue of fileIssues) {
      const msg = `[${filePath}] ${issue}`;
      issues.push(msg);
      blocked.push(filePath);
    }
  }

  const uniqueBlocked = [...new Set(blocked)];

  return {
    safe: issues.length === 0,
    issues,
    blocked: uniqueBlocked,
  };
}

function scanFile(filePath: string, content: string): string[] {
  const found: string[] = [];

  // ── Malicious patterns ──────────────────────────────────────────

  // eval() usage
  if (/\beval\s*\(/.test(content)) {
    found.push('Detected eval() — potential code injection');
  }

  // document.cookie access
  if (/document\.cookie/.test(content)) {
    found.push('Detected document.cookie — potential cookie theft');
  }

  // localStorage with sensitive keys
  for (const key of SENSITIVE_LOCALSTORAGE_KEYS) {
    const pattern = new RegExp(
      `localStorage\\.(?:setItem|getItem)\\s*\\(\\s*['"\`][^'"\`]*${key}[^'"\`]*['"\`]`,
      'i'
    );
    if (pattern.test(content)) {
      found.push(`Detected localStorage access with sensitive key '${key}'`);
      break; // One report per file is enough
    }
  }

  // fetch() to external URLs not in whitelist
  const fetchMatches = content.matchAll(/fetch\s*\(\s*['"`](https?:\/\/[^'"`]+)['"`]/gi);
  for (const match of fetchMatches) {
    const url = match[1];
    const isWhitelisted = FETCH_WHITELIST.some(allowed => url.includes(allowed));
    if (!isWhitelisted) {
      found.push(`Detected fetch() to external URL not in whitelist: ${url}`);
    }
  }

  // Script injection patterns
  if (/innerHTML\s*=\s*.*<script/i.test(content) || /document\.write\s*\(/i.test(content)) {
    found.push('Detected potential script injection via innerHTML or document.write');
  }

  // Obfuscated code: many \u escapes
  const unicodeEscapeCount = (content.match(/\\u[0-9a-fA-F]{4}/g) ?? []).length;
  if (unicodeEscapeCount > 20) {
    found.push(`Detected heavy Unicode escape obfuscation (${unicodeEscapeCount} \\u escapes)`);
  }

  // btoa usage (base64 encoding — often used to obfuscate)
  if (/\bbtoa\s*\(/.test(content)) {
    found.push('Detected btoa() — potential code obfuscation or data exfiltration');
  }

  // ── Dangerous Node.js APIs ──────────────────────────────────────

  if (/require\s*\(\s*['"`]child_process['"`]\s*\)/.test(content)) {
    found.push("Detected require('child_process') — dangerous system access");
  }

  if (/\bexec\s*\(/.test(content) && /child_process|shelljs|execa/.test(content)) {
    found.push('Detected exec() from a shell execution library');
  }

  if (/\bspawn\s*\(/.test(content)) {
    found.push('Detected spawn() — potential arbitrary command execution');
  }

  if (/fs\.unlink\s*\(/.test(content) || /fs\.unlinkSync\s*\(/.test(content)) {
    found.push('Detected fs.unlink() — file deletion operation');
  }

  if (/rm\s+-rf/.test(content)) {
    found.push("Detected 'rm -rf' — destructive shell command pattern");
  }

  // ── Credential leaks ────────────────────────────────────────────

  // Hardcoded secret keys (sk-, pk- patterns)
  if (/['"`]sk-[a-zA-Z0-9]{20,}['"`]/.test(content)) {
    found.push('Detected hardcoded secret key (sk-...) — potential credential leak');
  }

  if (/['"`]pk-[a-zA-Z0-9]{20,}['"`]/.test(content)) {
    found.push('Detected hardcoded public key (pk-...) — potential credential leak');
  }

  // Bearer token hardcoded in strings
  if (/['"`]Bearer\s+[a-zA-Z0-9\-_.]{20,}['"`]/.test(content)) {
    found.push('Detected hardcoded Bearer token — credential leak');
  }

  return found;
}
