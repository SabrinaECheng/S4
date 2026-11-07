# S4
Nova Hackathon CMU

## 🔗 [Open the live Neura prototype](https://neura-mu-eight.vercel.app/prototype/)

https://neura-mu-eight.vercel.app/prototype/

Logo explorations: https://sabrinaecheng.github.io/S4/prototype/logos.html

## Live mode

```bash
cd prototype
OPENROUTER_API_KEY=sk-or-... node server.js
```

Open http://localhost:3000 and press **Live** in the toolbar. Mic audio is sent in 2-second clips to `/transcribe` (Deepgram Nova-3), and each completed transcript clip goes immediately to `/extract` (Gemini 2.5 Flash Lite), which returns a patch of new themes, nodes, links and updates for the map. Pressing Stop waits for in-flight transcription and mapping, then runs a final full-transcript reconciliation before saving. To change models, set `STT_MODEL` / `MAP_MODEL`. The transcript button (lines icon) opens the full transcript. "replay a transcript file" runs a saved `.txt` through the same pipeline without a mic.

## Hosted on Vercel (Live works without running anything locally)

1. At vercel.com, choose **Add New → Project** and import this repo. Keep the defaults: no framework, root directory `./`.
2. Before deploying, open **Environment Variables** and add `OPENROUTER_API_KEY` with your key. Never commit the key to git.
3. Deploy. The prototype is at `https://<your-project>.vercel.app/prototype/`.

`api/neura.js` runs `/transcribe`, `/extract` and `/health` on Vercel. It uses the same code as `server.js` (`prototype/neura-core.js`). To make Live work on the GitHub Pages link too, set `HOSTED_API` near the top of the live code in `prototype/index.html` to your Vercel URL.

Set a credit limit on the OpenRouter key: anyone with the link can use Live.
