/**
 * FileSystem implementation for project detection.
 *
 * NodeFileSystem: Node.js fs module (CLI / library).
 */

import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import type { FileSystem } from './types';

/**
 * Node.js filesystem implementation for CLI usage.
 * Wraps Node.js fs module with a base path.
 */
export class NodeFileSystem implements FileSystem {
  constructor(private basePath: string) {}

  private resolve(relativePath: string): string {
    return nodePath.join(this.basePath, relativePath);
  }

  async exists(relativePath: string): Promise<boolean> {
    return fs.existsSync(this.resolve(relativePath));
  }

  async readFile(relativePath: string): Promise<string> {
    return fs.readFileSync(this.resolve(relativePath), 'utf-8');
  }

  async readDir(relativePath: string): Promise<string[]> {
    return fs.readdirSync(this.resolve(relativePath));
  }

  async isDirectory(relativePath: string): Promise<boolean> {
    const fullPath = this.resolve(relativePath);
    if (!fs.existsSync(fullPath)) return false;
    return fs.statSync(fullPath).isDirectory();
  }
}
