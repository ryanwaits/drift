import { describe, expect, mock, test } from 'bun:test';

// Mock process.stdout and process.stderr
const stdoutWrite = mock(() => true);
const stderrWrite = mock(() => true);
const origStdout = process.stdout.write;
const origStderr = process.stderr.write;

describe('formatOutput', () => {
  test('produces correct envelope shape', async () => {
    process.stdout.write = stdoutWrite as typeof process.stdout.write;
    process.stderr.write = stderrWrite as typeof process.stderr.write;

    try {
      const { formatOutput } = await import('../src/utils/output');
      const data = { exports: [{ name: 'foo' }] };
      const startTime = Date.now() - 100;

      const result = formatOutput('extract', data, startTime, '1.0.0');

      expect(result.ok).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.meta.command).toBe('extract');
      expect(result.meta.version).toBe('1.0.0');
      expect(result.meta.duration).toBeGreaterThanOrEqual(0);

      // stdout should have received JSON
      expect(stdoutWrite).toHaveBeenCalledTimes(1);
      const jsonOutput = (stdoutWrite.mock.calls[0] as unknown[])[0] as string;
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.ok).toBe(true);
      expect(parsed.data.exports[0].name).toBe('foo');

      // stderr should have received human summary
      expect(stderrWrite).toHaveBeenCalledTimes(1);
      const humanOutput = (stderrWrite.mock.calls[0] as unknown[])[0] as string;
      expect(humanOutput).toContain('drift extract');
    } finally {
      process.stdout.write = origStdout;
      process.stderr.write = origStderr;
    }
  });
});
