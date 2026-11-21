const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3030;
const ROOT_DIR = path.resolve(__dirname);
const HARDWARE_DIR = path.resolve(__dirname, '..', 'hardware');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.stl': 'application/octet-stream',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const reqUrl = (req.url || '/').split('?')[0];
  let safePath;
  try {
    safePath = decodeURIComponent(reqUrl);
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Solicitud invalida');
    return;
  }

  if (safePath === '/') {
    safePath = '/index.html';
  }

  let baseDir = ROOT_DIR;
  let fullPath;
  if (safePath.startsWith('/hardware/')) {
    const hwRel = safePath.slice('/hardware/'.length);
    baseDir = HARDWARE_DIR;
    fullPath = path.resolve(HARDWARE_DIR, hwRel);
  } else {
    const relativePath = safePath.replace(/^[/\\]+/, '');
    fullPath = path.resolve(ROOT_DIR, relativePath);
  }

  if (fullPath !== baseDir && !fullPath.startsWith(baseDir + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acceso denegado');
    return;
  }

  fs.stat(fullPath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Archivo no encontrado');
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(fullPath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end('Error al leer archivo');
    });
    stream.pipe(res);
  });
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.log(`El servidor ya estaba activo en http://localhost:${PORT}`);
    process.exit(0);
  }
  console.error('Error en el servidor:', err);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Visor 3D Offline activo en http://localhost:${PORT}`);
  console.log(`Carpeta servida: ${ROOT_DIR}`);
  console.log('Cierra esta ventana o presiona Ctrl+C para detener el servidor.');
});
