// تشغيل الموقع على جهازك: بيبني الموقع، ويفتح سيرفر محلي،
// ويعيد البناء ويحدّث المتصفح تلقائياً كل ما تحفظ content.json أو أي ملف في src/.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { build, ContentError, DIST, SRC, ROOT } = require('./build');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8',
};
const RELOAD = '<script>new EventSource("/__reload").onmessage = () => location.reload();</script>';
const clients = new Set();

function rebuild() {
  try {
    build().forEach(w => console.warn('⚠ تحذير: ' + w));
    console.log(`✓ ${new Date().toLocaleTimeString()} — الموقع اتحدّث`);
    clients.forEach(res => res.write('data: reload\n\n'));
  } catch (e) {
    console.error('\n✗ ' + (e instanceof ContentError ? e.message : e.stack) + '\n  (المتصفح هيفضل على آخر نسخة سليمة)\n');
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(DIST, p);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    return res.end('Not found');
  }
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  if (file.endsWith('.html')) {
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    return res.end(fs.readFileSync(file, 'utf8').replace('</body>', RELOAD + '\n</body>'));
  }
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

let timer;
const schedule = () => { clearTimeout(timer); timer = setTimeout(rebuild, 150); };
fs.watch(ROOT, (_, name) => { if (name === 'content.json') schedule(); });
fs.watch(SRC, { recursive: true }, schedule);

rebuild();

let port = Number(process.env.PORT) || 3000;
server.on('error', e => {
  if (e.code === 'EADDRINUSE') server.listen(++port);
  else throw e;
});
server.on('listening', () => console.log(`\n  الموقع شغال على: http://localhost:${port}\n  عدّل content.json واحفظ، والصفحة هتتحدّث لوحدها. (Ctrl+C للإيقاف)\n`));
server.listen(port);
