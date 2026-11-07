// Neura local server: serves the page and runs the AI routes with your OpenRouter key.
//   OPENROUTER_API_KEY=sk-or-... node server.js      → http://localhost:3000
// Node 18+, no dependencies. The same routes run on Vercel via ../api/neura.js.
const http = require('http');
const fs = require('fs');
const path = require('path');
const {handle, send, KEY, STT_MODEL, MAP_MODEL} = require('./neura-core');

const PORT = +process.env.PORT || 3000;
if (!KEY) console.warn('⚠ OPENROUTER_API_KEY is not set: /transcribe and /extract will fail.');

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html'))
    return send(res, 200, fs.readFileSync(path.join(__dirname, 'index.html')), 'text/html; charset=utf-8');
  const route = url.pathname.replace(/^\/(api\/)?/, '').replace(/\/$/, '');
  if (!(await handle(req, res, route))) send(res, 404, {error: 'not found'});
}).listen(PORT, () => console.log(`neura → http://localhost:${PORT}  (stt: ${STT_MODEL}, map: ${MAP_MODEL})`));
