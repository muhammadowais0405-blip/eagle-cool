import { randomBytes } from 'crypto';

/**
 * Generates a collision-resistant, URL-safe CUID-style ID.
 * Format: c[timestamp_base36][random_base36]  ~25 chars, always starts with 'c'
 * Suitable as a filesystem directory name.
 */
export function generateId(): string {
  const ts = Date.now().toString(36);                        // ~8 chars
  const rand = randomBytes(10).toString('hex');              // 20 hex chars
  return `c${ts}${rand}`;
}

/**
 * Returns true if the string looks like a library-generated ID.
 */
export function isValidId(id: string): boolean {
  return /^c[0-9a-z]{28,}$/.test(id);
}
