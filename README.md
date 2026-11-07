# S4
Nova Hackathon CMU

## 🔗 [Open the live Neura prototype](https://sabrinaecheng.github.io/S4/prototype/)

https://sabrinaecheng.github.io/S4/prototype/

Logo explorations: https://sabrinaecheng.github.io/S4/prototype/logos.html

## Live mode

```bash
cd prototype
OPENROUTER_API_KEY=sk-or-... node server.js
```

Open http://localhost:3000 and press **Live** in the toolbar. Mic audio is sent in 8-second clips to `/transcribe` (Deepgram Nova-3), and every ~15 s the new text goes to `/extract` (Claude Haiku 5.5), which returns a patch of new themes, nodes, links and updates for the map. To change models, set `STT_MODEL` / `MAP_MODEL`. The transcript button (lines icon) opens the full transcript. "replay a transcript file" runs a saved `.txt` through the same pipeline without a mic.
