// Neura live server: serves the page and holds the OpenRouter key.
//   OPENROUTER_API_KEY=sk-or-... node server.js      → http://localhost:3000
// Node 18+, no dependencies.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = +process.env.PORT || 3000;
const KEY = process.env.OPENROUTER_API_KEY;
const BASE = 'https://openrouter.ai/api/v1';
// Swap models here. Pin exact ids: no ":batch" variants, no "~...-latest" aliases.
const STT_MODEL = process.env.STT_MODEL || 'deepgram/nova-3';
const MAP_MODEL = process.env.MAP_MODEL || 'anthropic/claude-haiku-5.5';

if (!KEY) console.warn('⚠ OPENROUTER_API_KEY is not set: /transcribe and /extract will fail.');

const KINDS = ['Idea', 'Question', 'Task', 'Reference', 'Example', 'Outcome', 'Tangent', 'Supporting detail'];

// ---------- /transcribe: audio in, text out ----------
// If your tested request looks different, replace the body of this function with it.
// Keep it plain JSON output, no diarization / speaker labels.
async function transcribe(buf, mime){
  const ext = /mp4|m4a|aac/.test(mime) ? 'mp4' : /ogg/.test(mime) ? 'ogg' : /wav/.test(mime) ? 'wav' : 'webm';
  const form = new FormData();
  form.append('model', STT_MODEL);
  form.append('file', new Blob([buf], {type: mime || 'audio/webm'}), 'clip.' + ext);
  form.append('response_format', 'json');
  const r = await fetch(`${BASE}/audio/transcriptions`, {
    method: 'POST', headers: {Authorization: `Bearer ${KEY}`, 'X-Title': 'Neura'}, body: form, signal: AbortSignal.timeout(30000)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `transcription failed (${r.status})`);
  const text = j.text ?? j.transcript ?? j.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
  return String(text).trim();
}

// ---------- /extract: text + compact map in, patch out ----------
const str = {type: 'string'};
const PATCH_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['add_themes', 'add_nodes', 'add_links', 'update_nodes'],
  properties: {
    add_themes: {type: 'array', items: {type: 'object', additionalProperties: false, required: ['id', 'label', 'detail', 'quote'],
      properties: {id: str, label: str, detail: str, quote: str}}},
    add_nodes: {type: 'array', items: {type: 'object', additionalProperties: false, required: ['id', 'parent', 'label', 'kind', 'detail', 'quote'],
      properties: {id: str, parent: str, label: str, kind: {type: 'string', enum: KINDS}, detail: str, quote: str}}},
    add_links: {type: 'array', items: {type: 'object', additionalProperties: false, required: ['a', 'b'], properties: {a: str, b: str}}},
    update_nodes: {type: 'array', items: {type: 'object', additionalProperties: false, required: ['id', 'label', 'kind', 'detail', 'quote'],
      properties: {id: str, label: str, kind: {type: 'string', enum: ['', ...KINDS]}, detail: str, quote: str}}}
  }
};

const SYSTEM = `You keep a live idea map of a brainstorm up to date while people talk. Every ~15 seconds you get the newest stretch of an automatic transcript (no speaker names, words may be cut at clip edges) and the current map. You reply with a small patch.

THE MAP
- A tree. "root" is the whole conversation. Children of root are THEMES (big topics, each gets its own colour cloud). Below themes sit ideas, questions, tasks, references etc., at most 3 levels below root.
- Links connect two existing nodes in different branches that the speakers related to each other.

FOR EACH THING SAID, PICK ONE
1. Ignore: small talk, filler, logistics about the meeting itself, repeats, half-sentences with no content. Most text is ignored. An empty patch is a good answer.
2. Update: the speakers elaborate on an existing node → update_nodes with a better detail (or label/kind/quote). Use "" for fields you are not changing.
3. Link: they connect two existing ideas ("that's like…", "going back to…") → add_links.
4. New node: a genuinely new idea, question, task, example or reference → add_nodes under the existing node it belongs to (the most specific fitting parent).
5. New theme: only on a clear shift to a new topic that fits under no existing theme → add_themes. Then nodes in the same patch may use that theme id as parent.

KIND (decides the node's shape on the map)
- Question: a question or "what if…" the group is asking.
- Task: an action item, to-do, assignment, "we should / let's / I'll…".
- Reference: a named product, tool, company, competitor, paper, show or person's work.
- Example: a concrete example or anecdote.  Outcome: a goal or result they want.
- Tangent: a side-track.  Supporting detail: a small fact under a bigger node.  Idea: everything else.

WRITING
- label: at most 6 words, specific, no trailing punctuation. detail: one plain sentence on what was said. quote: a short exact excerpt from the new text (under 15 words), or "".
- New ids: short unique snake_case, never an id already in the map. parent must be an existing id, "root" only via add_themes, or a theme added in this same patch.
- At most 2 new themes and 6 new nodes per patch. Prefer fewer, better nodes.
- Only use the NEW text as evidence. "Earlier" text is context you already processed.`;

async function extract({map, text, context}){
  const user = `CURRENT MAP (id · parent · kind · label):
${(map?.nodes || []).map(n => `${n.id} · ${n.parent ?? '-'} · ${n.kind} · ${n.label}`).join('\n') || 'root · - · Conversation · (empty)'}
LINKS: ${(map?.cross || []).map(p => p.join('–')).join(', ') || 'none'}

EARLIER (already processed, context only):
${context || '(start of session)'}

NEW TEXT:
${text}`;
  const r = await fetch(`${BASE}/chat/completions`, {
    method: 'POST', signal: AbortSignal.timeout(45000),
    headers: {Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Title': 'Neura'},
    body: JSON.stringify({
      model: MAP_MODEL, temperature: 0.2, max_tokens: 1500,
      messages: [{role: 'system', content: SYSTEM}, {role: 'user', content: user}],
      response_format: {type: 'json_schema', json_schema: {name: 'map_patch', strict: true, schema: PATCH_SCHEMA}},
      provider: {require_parameters: true}
    })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `extraction failed (${r.status})`);
  const raw = j.choices?.[0]?.message?.content || '{}';
  const patch = JSON.parse(String(raw).replace(/^```(?:json)?\s*|\s*```$/g, ''));
  return {...patch, model: j.model, usage: j.usage};
}

// ---------- http ----------
function readBody(req, limit){
  return new Promise((ok, fail) => {
    const parts = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > limit){ fail(new Error('body too large')); req.destroy(); } else parts.push(c); });
    req.on('end', () => ok(Buffer.concat(parts))); req.on('error', fail);
  });
}
function send(res, code, body, type = 'application/json'){
  res.writeHead(code, {'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type'});
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '', 'text/plain');
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html'))
      return send(res, 200, fs.readFileSync(path.join(__dirname, 'index.html')), 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, {ok: true, key: !!KEY, stt: STT_MODEL, map: MAP_MODEL});
    if (req.method === 'POST' && url.pathname === '/transcribe'){
      const buf = await readBody(req, 5e6);
      if (buf.length < 800) return send(res, 200, {text: ''});
      const t = Date.now(), text = await transcribe(buf, req.headers['content-type']);
      console.log(`transcribe ${(buf.length / 1024).toFixed(0)}KB ${Date.now() - t}ms: ${text.slice(0, 80)}`);
      return send(res, 200, {text});
    }
    if (req.method === 'POST' && url.pathname === '/extract'){
      const body = JSON.parse((await readBody(req, 1e6)).toString() || '{}');
      if (!String(body.text || '').trim()) return send(res, 200, {add_themes: [], add_nodes: [], add_links: [], update_nodes: []});
      const t = Date.now(), patch = await extract(body);
      console.log(`extract ${Date.now() - t}ms +${patch.add_themes?.length || 0} themes +${patch.add_nodes?.length || 0} nodes ~${patch.update_nodes?.length || 0} updates +${patch.add_links?.length || 0} links`);
      return send(res, 200, patch);
    }
    send(res, 404, {error: 'not found'});
  } catch (e) {
    console.error(url.pathname, e.message);
    send(res, 502, {error: e.message});
  }
}).listen(PORT, () => console.log(`neura → http://localhost:${PORT}  (stt: ${STT_MODEL}, map: ${MAP_MODEL})`));
