import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let cached: string | undefined;

export function getVersion(): string {
	if (cached) return cached;
	try {
		cached =
			JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8')).version ?? '0.0.0';
	} catch {
		cached = '0.0.0';
	}
	return cached;
}
