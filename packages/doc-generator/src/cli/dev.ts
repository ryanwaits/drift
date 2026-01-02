import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import type { Command } from 'commander';
import { createDocs, type DocsInstance } from '../core/loader';
import { toHTML } from '../render/html';

export interface DevOptions {
  port: string;
  host?: string;
  open?: boolean;
  verbose?: boolean;
}

export function registerDevCommand(program: Command): void {
  program
    .command('dev <spec>')
    .description('Start dev server with hot reload')
    .option('-p, --port <port>', 'Port to serve on', '3001')
    .option('-h, --host <host>', 'Host to bind to', 'localhost')
    .option('--open', 'Open browser on start')
    .option('--verbose', 'Verbose output')
    .action(async (specPath: string, options: DevOptions) => {
      try {
        const resolvedSpec = path.resolve(specPath);

        if (!fs.existsSync(resolvedSpec)) {
          console.error(`Error: Spec file not found: ${resolvedSpec}`);
          process.exit(1);
        }

        const port = Number.parseInt(options.port, 10);
        const host = options.host ?? 'localhost';

        // Load initial spec
        let docs = createDocs(resolvedSpec);
        let lastMtime = fs.statSync(resolvedSpec).mtimeMs;

        console.log('\nStarting dev server...');
        console.log(`  Spec: ${resolvedSpec}`);
        console.log(`  Exports: ${docs.getAllExports().length}`);

        // Watch for spec changes
        const watcher = fs.watch(resolvedSpec, (eventType) => {
          if (eventType === 'change') {
            const currentMtime = fs.statSync(resolvedSpec).mtimeMs;
            if (currentMtime !== lastMtime) {
              lastMtime = currentMtime;
              try {
                docs = createDocs(resolvedSpec);
                console.log(
                  `\n[${new Date().toLocaleTimeString()}] Spec reloaded (${docs.getAllExports().length} exports)`,
                );
              } catch (err) {
                console.error(
                  `\n[${new Date().toLocaleTimeString()}] Error reloading spec:`,
                  err instanceof Error ? err.message : err,
                );
              }
            }
          }
        });

        // Create server
        const server = http.createServer((req, res) => {
          const url = new URL(req.url || '/', `http://${host}:${port}`);
          const pathname = url.pathname;

          if (options.verbose) {
            console.log(`${req.method} ${pathname}`);
          }

          try {
            // Handle API pages
            if (pathname.startsWith('/api/')) {
              const exportName = pathname
                .replace('/api/', '')
                .replace('.html', '')
                .replace(/-/g, '');
              const exp = findExport(docs, exportName);

              if (exp) {
                const html = toHTML(docs.spec, {
                  export: exp.name,
                  includeStyles: true,
                  fullDocument: true,
                  headContent: hotReloadScript(port),
                });
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
                return;
              }
            }

            // Handle index
            if (pathname === '/' || pathname === '/index.html') {
              const html = toHTML(docs.spec, {
                includeStyles: true,
                fullDocument: true,
                headContent: hotReloadScript(port),
              });
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(html);
              return;
            }

            // Handle hot reload endpoint
            if (pathname === '/__reload') {
              res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
              });

              // Send ping every 2s to keep connection alive
              const interval = setInterval(() => {
                res.write('data: ping\n\n');
              }, 2000);

              // Watch for changes and send reload signal
              const reloadWatcher = fs.watch(resolvedSpec, () => {
                res.write('data: reload\n\n');
              });

              req.on('close', () => {
                clearInterval(interval);
                reloadWatcher.close();
              });

              return;
            }

            // 404
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 Not Found</h1>');
          } catch (err) {
            console.error('Server error:', err);
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(
              `<h1>500 Server Error</h1><pre>${err instanceof Error ? err.message : err}</pre>`,
            );
          }
        });

        server.listen(port, host, () => {
          console.log(`\n  Local:   http://${host}:${port}/`);
          console.log('\n  Watching for spec changes...');
          console.log('  Press Ctrl+C to stop\n');

          // Open browser if requested
          if (options.open) {
            const openCmd =
              process.platform === 'darwin'
                ? 'open'
                : process.platform === 'win32'
                  ? 'start'
                  : 'xdg-open';

            import('node:child_process').then(({ exec }) => {
              exec(`${openCmd} http://${host}:${port}/`);
            });
          }
        });

        // Cleanup on exit
        process.on('SIGINT', () => {
          console.log('\n\nShutting down...');
          watcher.close();
          server.close();
          process.exit(0);
        });
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : err);
        process.exit(1);
      }
    });
}

function findExport(docs: DocsInstance, searchName: string) {
  const lowerSearch = searchName.toLowerCase();
  return docs.getAllExports().find((exp) => {
    const lowerName = exp.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return lowerName === lowerSearch || exp.id === searchName;
  });
}

function hotReloadScript(port: number): string {
  return `
<script>
(function() {
  const source = new EventSource('http://localhost:${port}/__reload');
  source.onmessage = function(e) {
    if (e.data === 'reload') {
      window.location.reload();
    }
  };
  source.onerror = function() {
    source.close();
    setTimeout(() => window.location.reload(), 1000);
  };
})();
</script>`;
}
