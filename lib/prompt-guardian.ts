/**
 * lib/prompt-guardian.ts — VibeEngineer Input Security Scanner
 *
 * Scans USER MESSAGES before they reach any AI API call.
 * Detects hidden/obfuscated attack surfaces:
 *   - Null byte injection
 *   - ANSI/terminal escape sequences
 *   - RTL override characters (text reversal attack)
 *   - Zero-width / invisible Unicode (hidden instruction smuggling)
 *   - Base64-encoded hidden instructions
 *   - Jailbreak patterns (role hijacking, mode override, prompt extraction)
 *   - Prompt injection markers (LLM format tokens)
 *
 * NOTE: lib/vibe-claw.ts scans GENERATED CODE (output).
 * This file scans USER INPUT (input). They are complementary.
 */

const INVISIBLE_CHARS = new Set([
  '\u200b', '\u200c', '\u200d', '\u200e', '\u200f',
  '\u202a', '\u202b', '\u202c', '\u202d', '\u202e',
  '\u2060', '\u2061', '\u2062', '\u2063', '\u2064',
  '\ufeff', '\u00ad',
]);

const JAILBREAK_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/i,
  /disregard\s+(all\s+)?(previous|your)\s+(instructions?|rules?|constraints?)/i,
  /(you\s+are\s+now|act\s+as|pretend\s+(you\s+are|to\s+be))\s+(dan|jailbreak|unrestricted|evil|admin|root)/i,
  /(switch|change)\s+(to|into)\s+(jailbreak|unrestricted|developer|god)\s+mode/i,
  /(forget|disregard)\s+(your\s+)?(training|guidelines?|rules?|values?|alignment)/i,
  /developer\s+mode\s+(on|enabled|override|activated)/i,
  /(enable|activate|turn\s+on)\s+(developer|god|admin|root|unrestricted)\s+mode/i,
  /do\s+anything\s+now/i,
  /bypass\s+(safety|restrictions?|filters?|guardrails?|content\s+policy)/i,
  /(disable|remove|turn\s+off)\s+(safety|filter|guardrail|restriction)/i,
  /(print|repeat|say|output|show|reveal|tell\s+me)\s+(your\s+)?(system\s+)?prompt/i,
  /ignore\s+safety/i,
  /<\|system\|>|<\|user\|>|<\|assistant\|>/i,
  /\[INST\]|\[\/INST\]|<<SYS>>|<<\/SYS>>/i,
  /<\|im_start\|>|<\|im_end\|>|<\|endoftext\|>/i,
  /from\s+now\s+on\s+(you\s+are|act\s+as|pretend)/i,
  /your\s+(true\s+)?(identity|name|role)\s+is/i,
  /execute\s+(the\s+)?(following|above)\s+(command|instruction|directive)/i,
];

const INJECTION_PATTERNS: RegExp[] = [
  /<\s*system\s*>/i,
  /<\s*\/\s*system\s*>/i,
  /\[\s*system\s*\]/i,
  /###\s*(instruction|system|prompt|role)/i,
  /^(human|assistant|user|system|ai|bot)\s*:/im,
  /<(instructions?|directive|command|role)\s*>/i,
  /```\s*(system|prompt|instruction)/i,
];

const ANSI_RE = /\x1b\[[0-9;]*[mABCDEFGHJKSTfinsulh]/;

/**
 * Scans a user message for security threats.
 * Returns null if clean, or a reason string if a threat is detected.
 */
export function scanPrompt(text: string): string | null {
  if (!text) return null;

  // Null byte injection
  if (text.includes('\x00')) return 'null-byte injection detected';

  // ANSI terminal escape sequences
  if (ANSI_RE.test(text)) return 'ANSI escape sequence in input';

  // RTL override — hides malicious text behind innocent-looking text
  if (text.includes('\u202e') || text.includes('\u202d')) {
    return 'right-to-left override character (text reversal attack)';
  }

  // Invisible zero-width characters — hidden instruction smuggling
  const invisCount = [...text].filter(c => INVISIBLE_CHARS.has(c)).length;
  if (invisCount >= 3) return `excessive invisible Unicode characters (${invisCount} found)`;

  // Base64 blob with hidden instructions
  const b64Matches = text.match(/(?:[A-Za-z0-9+/]{60,}={0,2})/g) ?? [];
  for (const blob of b64Matches) {
    try {
      const decoded = Buffer.from(blob, 'base64').toString('utf-8');
      const suspiciousKeywords = ['ignore', 'system', 'prompt', 'instruction', 'bypass', 'jailbreak', 'override', 'admin', 'sudo'];
      if (suspiciousKeywords.some(kw => decoded.toLowerCase().includes(kw))) {
        return 'base64-encoded hidden instruction detected';
      }
    } catch { /* not valid base64 */ }
  }

  // Jailbreak patterns
  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(text)) {
      return `jailbreak attempt: ${pattern.source.slice(0, 50)}`;
    }
  }

  // Prompt injection markers
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return `prompt injection marker: ${pattern.source.slice(0, 50)}`;
    }
  }

  return null; // clean
}

/**
 * Throws a Response with 400 status if the input is malicious.
 * Use at the top of any API route handler.
 */
export function guardInput(text: string): void {
  const threat = scanPrompt(text);
  if (threat) {
    throw new GuardianBlock(threat);
  }
}

export class GuardianBlock extends Error {
  constructor(public readonly reason: string) {
    super(`Blocked: ${reason}`);
    this.name = 'GuardianBlock';
  }

  toResponse(): Response {
    return Response.json(
      { error: 'Input blocked by security scanner', reason: this.reason },
      { status: 400 }
    );
  }
}
