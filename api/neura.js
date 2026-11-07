// Vercel serverless function: /transcribe, /extract and /health (see vercel.json rewrites).
// Set OPENROUTER_API_KEY in the Vercel project's Environment Variables. It stays on the server.
const {handle, send} = require('../prototype/neura-core');

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const route = url.searchParams.get('route') || url.pathname.split('/').filter(Boolean).pop();
  if (!(await handle(req, res, route))) send(res, 404, {error: 'not found'});
};
