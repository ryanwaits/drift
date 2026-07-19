import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const TMP = path.resolve(__dirname, '.tmp-mcp');
const CLI = path.resolve(__dirname, '../src/drift.ts');

const SPEC = {
  openapi: '3.1.0',
  info: { title: 'Acme API', version: '1.0.0' },
  paths: {
    '/ping': {
      get: {
        operationId: 'ping',
        description: 'Health check.',
        responses: { '200': { description: 'pong' } },
      },
    },
  },
};

interface JsonRpcResponse {
  id?: number;
  result?: Record<string, unknown>;
  error?: { message: string };
}

/** Minimal newline-delimited JSON-RPC client over the drift mcp stdio transport. */
async function mcpSession(requests: Record<string, unknown>[]): Promise<JsonRpcResponse[]> {
  const proc = Bun.spawn(['bun', 'run', CLI, 'mcp'], {
    cwd: TMP,
    env: { ...process.env, NO_COLOR: '1' },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });

  for (const req of requests) {
    proc.stdin.write(`${JSON.stringify(req)}\n`);
  }
  await proc.stdin.flush();

  const expected = requests.filter((r) => r.id !== undefined).length;
  const responses: JsonRpcResponse[] = [];
  const decoder = new TextDecoder();
  let buffer = '';
  const deadline = Date.now() + 30_000;

  const reader = proc.stdout.getReader();
  while (responses.length < expected && Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value);
    let idx = buffer.indexOf('\n');
    while (idx !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) {
        const msg = JSON.parse(line) as JsonRpcResponse;
        if (msg.id !== undefined) responses.push(msg);
      }
      idx = buffer.indexOf('\n');
    }
  }

  proc.kill();
  return responses;
}

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(path.join(TMP, 'acme-api.json'), JSON.stringify(SPEC));
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('drift mcp', () => {
  test('initialize → tools/list → tools/call round-trip', async () => {
    const responses = await mcpSession([
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'drift-test', version: '0.0.0' },
        },
      },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'drift_list', arguments: { spec: 'acme-api.json' } },
      },
    ]);

    expect(responses).toHaveLength(3);

    const init = responses.find((r) => r.id === 1);
    expect(init?.result).toBeDefined();
    expect((init?.result?.serverInfo as { name: string } | undefined)?.name).toBe('drift');

    const toolsList = responses.find((r) => r.id === 2);
    const tools = ((toolsList?.result?.tools ?? []) as Array<{ name: string }>)
      .map((t) => t.name)
      .sort();
    expect(tools).toEqual([
      'drift_breaking',
      'drift_coverage',
      'drift_diff',
      'drift_extract',
      'drift_get',
      'drift_health',
      'drift_lint',
      'drift_list',
      'drift_scan',
    ]);

    const call = responses.find((r) => r.id === 3);
    expect(call?.error).toBeUndefined();
    const result = call?.result as {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
    };
    expect(result.isError).toBeFalsy();
    const envelope = JSON.parse(result.content[0].text);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.exports.map((e: { name: string }) => e.name)).toEqual(['ping']);
  }, 40_000);
});
