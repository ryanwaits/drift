import type { ApiSpec } from '../../../analysis/api-spec';
import { buildExportRegistry } from '../../../analysis/drift/compute';
import type { ExportRegistry } from '../../../analysis/drift/types';

/** Package name used by the clarinet fixture. */
export const CLARINET_PKG: string = '@stacks/clarinet-sdk';

/**
 * Stub spec: `Simnet.runSnippet` deprecated, `Simnet.execute` current.
 * Avoids the openpkg mapped-type flattening gap.
 */
export function clarinetSpec(): ApiSpec {
  return {
    meta: { name: CLARINET_PKG },
    exports: [
      {
        id: 'initSimnet',
        name: 'initSimnet',
        kind: 'function',
        signatures: [
          {
            returns: {
              schema: {
                $ref: '#/types/Promise',
                'x-ts-type-arguments': [{ $ref: '#/types/Simnet' }],
              },
            },
          },
        ],
      },
      {
        id: 'Simnet',
        name: 'Simnet',
        kind: 'type',
        members: [
          {
            name: 'runSnippet',
            kind: 'method',
            deprecated: true,
            tags: [{ name: 'deprecated', text: 'use simnet.execute(command) instead' }],
            signatures: [
              {
                parameters: [{ name: 'command', required: true, schema: { type: 'string' } }],
              },
            ],
          },
          {
            name: 'execute',
            kind: 'method',
            signatures: [
              {
                parameters: [{ name: 'snippet', required: true, schema: { type: 'string' } }],
              },
            ],
          },
        ],
      },
    ],
  };
}

/** Registry for the clarinet stub spec. */
export function clarinetRegistry(): ExportRegistry {
  return buildExportRegistry(clarinetSpec());
}
