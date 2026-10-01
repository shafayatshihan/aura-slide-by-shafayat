# v0.3 API + marker notes (for the front-end track)

## Markers (each alone on a line in Claude "say"/"done" text)
- `[[aura:stage=read|plan|build|check|export|done]]`, `[[aura:ask]]` (last line), `[[aura:done path="4 - Your slides/<file>.html"]]`
- Choice: `[[aura:choice id="q1" question="..." options="A|B|C" multi="no" default="B"]]` — 2–5 options, max 3 per message,
  always show a free-text box too. Regex: `/^\[\[aura:choice id="([a-z0-9-]+)" question="([^"]*)" options="([^"]*)" multi="(yes|no)" default="([^"]*)"\]\]$/`
  Answer sent as a normal reply, one line per question: `q1: <option>` (multi joined with ` | `), user text may follow; omitted = default.
- Hint: `[[aura:hint slide=3 text="..."]]` (3–5 after builds/edits). Regex `/^\[\[aura:hint slide=(\d+) text="([^"]*)"\]\]$/`
- Editor messages: send via reply with `slide` field (server prefixes `[slide N]`); attached file → append `use the file <name>`.

## Deck runtime edit mode (iframe `/deck/<id>/?aura=edit#<n>`)
- Deck posts to parent: `{aura:'slide', index /*1-based*/, count}` on slide change; `{aura:'edit', id, slide, text}` when a `[data-edit]` element is clicked.
- Parent posts `{aura:'go', index /*0-based*/}`. `[data-edit]` gets a hover outline. ids look like `s3-2` (fake Claude uses `s3-t1`).

## Server (engine/form_server.py)
- `POST /api/claude/start {deckId?}` → `{ok, running, sessionId, deckId, quality}` (no deckId = new record from draft brief).
- `POST /api/claude/reply {text, deckId?, slide?}`; events carry `deck`; `/api/claude/status` returns `deckId`, `subscriptionType`.
- Decks: `GET /api/decks` → `{ok, decks:[{id,title,file,look,quality,createdAt,updatedAt,sessionId,status:'draft|building|ready|missing',exists,mtime,url,thumb}]}` newest first;
  `POST /api/decks` → `{ok,id,deck}`; `GET/PATCH /api/decks/<id>` `{title?,look?,quality?}`.
- `GET /deck/<id>/` packed deck (same origin). `GET /api/decks/<id>/thumb.png`, `GET /api/decks/<id>/slides` → `{ok,count,slides:[{n,title,url}]}` (first render ~3 s → placeholder).
- `POST /api/decks/<id>/text {editId,text}` → `{ok:true,...,mtime}` or `{ok:false,error:'rules',reason}` (reverted), 409 while Claude works on it.
- `GET /api/usage` → `{ok, usage:{status,utilization,resetsAt,type,capturedAt}|null, subscriptionType}` (utilization may be 0–1 fraction; treat >1 as percent).
- `GET /api/health` → `{ok, checks:[{id,ok,label,detail,blocking,fix?}], version, latest, subscriptionType}`; ids engine,node,modules,edge,python,claude,signin,disk,version.
  `POST /api/fix/<npm|pip|signin|update>`; poll `GET /api/fix/status` → `{running,name,ok,log,message}`. update → 404 launcher-missing if no exe.
- Test env switches: AURA_HEALTH_FAIL=id,id ; AURA_FAKE_FIX ; AURA_NO_NETWORK ; fake Claude words `ask-me`, `usage-windows`.
