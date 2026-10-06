// Optional desktop shell. Build the web application before starting Electron.
const { app, BrowserWindow, protocol, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
protocol.registerSchemesAsPrivileged([{ scheme: 'capital', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const root = path.resolve(__dirname, '../dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const csp = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-src 'none'";
if (!app.requestSingleInstanceLock()) app.quit();
else {
  let window;
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(() => {
    protocol.handle('capital', async request => {
      try {
        const url = new URL(request.url);
        if (url.host !== 'game' || request.method !== 'GET') return new Response('Forbidden', { status: 403 });
        const relative = decodeURIComponent(url.pathname) === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
        const file = path.resolve(root, relative);
        if (!file.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
        const bytes = await fs.readFile(file);
        return new Response(bytes, { headers: { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff' } });
      } catch { return new Response('Not found', { status: 404 }); }
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('capital://game/') && !details.url.startsWith('blob:capital://game/') }));
    window = new BrowserWindow({ width: 1440, height: 960, minWidth: 1024, minHeight: 700, title: 'SHIBUYA CAPITAL', backgroundColor: '#101719', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true } });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const allowedPages = new Set(['capital://game/', 'capital://game/index.html', 'capital://game/real-shibuya.html']);
    window.webContents.on('will-navigate', (event, url) => { if (!allowedPages.has(url)) event.preventDefault(); });
    window.loadURL('capital://game/');
  });
  app.on('window-all-closed', () => app.quit());
}
