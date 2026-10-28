/**
 * dist/ をそのまま配信する軽量サーバー（gzip + キャッシュヘッダ付き）。
 * ビルド済みの実物を確認したいときは `npm run serve` を使う。
 *   PORT=5173 node scripts/serve-dist.mjs
 *
 * 音声・フォント・アイコンは dist/ 配下の実ファイルなので、dist フォルダごと配信すること。
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { createGzip } from 'node:zlib';

const ROOT = resolve(process.cwd(), 'dist');
const PORT = Number(process.env.PORT ?? 5173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.webmanifest', '.txt']);

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(ROOT, path);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html');
  if (!existsSync(file)) file = join(ROOT, 'index.html');

  const ext = extname(file).toLowerCase();
  const { size } = statSync(file);
  const immutable =
    path.startsWith('/audio/') || path.startsWith('/fonts/') || path.includes('/assets/');
  const gzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');

  const headers = {
    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'Access-Control-Allow-Origin': '*',
    Vary: 'Accept-Encoding',
  };
  if (gzip) headers['Content-Encoding'] = 'gzip';
  else headers['Content-Length'] = String(size);
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();

  const stream = createReadStream(file);
  stream.on('error', () => res.end());
  if (gzip) stream.pipe(createGzip({ level: 9 })).pipe(res);
  else stream.pipe(res);
}).listen(PORT, '0.0.0.0', () => {
  console.log(`serving dist/ on http://0.0.0.0:${PORT}`);
});
