import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';

const KEY_PREFIX = 'doccov_';

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const random = nanoid(32);
  const key = `${KEY_PREFIX}${random}`;
  const hash = hashApiKey(key);
  const prefix = key.slice(0, 12);
  return { key, hash, prefix };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function isValidKeyFormat(key: string): boolean {
  return key.startsWith(KEY_PREFIX) && key.length === KEY_PREFIX.length + 32;
}
