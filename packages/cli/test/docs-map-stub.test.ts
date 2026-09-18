import { describe, expect, test } from 'bun:test';
import { collectStubCandidates, stubPage } from '../src/utils/docs-map-stub';

const types = new Map([['Cl', new Set(['int', 'uint', 'bool', 'list', 'tuple'])]]);

function page(heading: string) {
  return [
    '# Reference',
    '',
    `## ${heading}`,
    '',
    '| Key | Description |',
    '| --- | --- |',
    '| `int` | Signed |',
    '| `uint` | Unsigned |',
    '| `bool` | Boolean |',
  ].join('\n');
}

describe('collectStubCandidates', () => {
  test('default-matching heading needs no sectionRe', () => {
    const [stub] = collectStubCandidates(
      [{ path: '/repo/README.md', content: page('Configuration options') }],
      types,
      '/repo',
    );
    expect(stub.type).toBe('Cl');
    expect(stub.sectionRe).toBeUndefined();
  });

  // The ranking matches every heading; scan only opens option|config sections.
  // Without sectionRe the stub's own table would count as 0 documented keys.
  test('non-default heading is carried into the stub as sectionRe', () => {
    const [stub] = collectStubCandidates(
      [{ path: '/repo/README.md', content: page('Clarity values (Cl.*)') }],
      types,
      '/repo',
    );
    expect(stub.sectionRe).toBe('Clarity values \\(Cl\\.\\*\\)');
    expect(new RegExp(stub.sectionRe ?? '', 'i').test('Clarity values (Cl.*)')).toBe(true);
  });

  // init and propose --docs both build entries from candidates; one builder so
  // neither can drop sectionRe.
  test('stubPage carries sectionRe into the docs-file entry', () => {
    const [stub] = collectStubCandidates(
      [{ path: '/repo/README.md', content: page('Clarity values') }],
      types,
      '/repo',
    );
    expect(stubPage(stub)).toEqual({
      page: 'README.md',
      type: 'Cl',
      sectionRe: 'Clarity values',
      baselineGaps: 0,
    });
  });
});
