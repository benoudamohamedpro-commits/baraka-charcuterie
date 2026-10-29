// Aperçu local du site, servi comme GitHub Pages (/page -> page.html, 404.html).
// Usage : node apercu.mjs [port]
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', 'docs');
const PORT = Number(process.argv[2] || 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

async function find(urlPath) {
  const p = decodeURIComponent(urlPath);
  const tries = p.endsWith('/') ? [p + 'index.html'] : [p, p + '.html', p + '/index.html'];
  for (const t of tries) {
    const file = path.join(ROOT, t);
    try {
      if ((await fs.stat(file)).isFile()) return file;
    } catch {}
  }
  return null;
}

http
  .createServer(async (req, res) => {
    const urlPath = new URL(req.url, 'http://x').pathname;
    const file = await find(urlPath);
    const status = file ? 200 : 404;
    const body = await fs.readFile(file || path.join(ROOT, '404.html'));
    res.writeHead(status, { 'Content-Type': TYPES[path.extname(file || '.html')] || 'application/octet-stream' });
    res.end(body);
  })
  .listen(PORT, () => console.log(`Aperçu : http://localhost:${PORT}`));
