#!/usr/bin/env node

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const port = Number(process.env.DESIGN_PREVIEW_PORT ?? 4300);
const host = '127.0.0.1';
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
]);

createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url ?? '/', `http://${host}:${port}`).pathname);

  if (requestPath === '/' || requestPath === '/healthz') {
    response.writeHead(200, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end('ok');
    return;
  }

  const safePath = normalize(requestPath).replace(/^[/\\]+/, '');
  const absolute = join(root, safePath);

  if (!absolute.startsWith(root) || !existsSync(absolute) || !statSync(absolute).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'content-type': mime.get(extname(absolute).toLowerCase()) ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(absolute).pipe(response);
}).listen(port, host, () => {
  console.log(`Design preview server listening on http://${host}:${port}`);
});
