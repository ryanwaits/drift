/**
 * Augment node:fs with globSync (available in Node 22+ and Bun).
 * @types/node@20 doesn't include this yet.
 */
declare module 'node:fs' {
  interface GlobSyncOptions {
    cwd?: string;
    exclude?: string[];
  }
  function globSync(pattern: string, options?: GlobSyncOptions): string[];
}
