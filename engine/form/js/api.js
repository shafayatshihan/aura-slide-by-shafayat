// Calls to the local Lumi server (engine/form_server.py). Every call resolves; failures come back as {ok:false, error}.
async function req(method, url, body) {
  try {
    const r = await fetch(url, body === undefined ? { method } :
      { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? j : { ok: false, status: r.status, ...j };
  } catch (e) { return { ok: false, error: 'offline' }; }
}
export const getJSON = url => req('GET', url);
export const postJSON = (url, body = {}) => req('POST', url, body);
export const patchJSON = (url, body = {}) => req('PATCH', url, body);

// Upload one file to a "3 - Put your files here" folder. onProgress(0..1). Resolves {ok, path, name, size} or {ok:false}.
export function upload(file, folder, onProgress = () => {}) {
  return new Promise(resolve => {
    const x = new XMLHttpRequest();
    x.open('POST', `/api/upload?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(file.name)}`);
    x.setRequestHeader('Content-Type', 'application/octet-stream');
    x.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch (e) {}
      resolve(x.status < 300 ? { ok: true, ...j } : { ok: false, status: x.status, ...j }); };
    x.onerror = () => resolve({ ok: false, error: 'offline' });
    x.send(file);
  });
}

export const claude = {
  status: (refresh = false) => getJSON('/api/claude/status' + (refresh ? '?refresh=1' : '')),
  login: () => postJSON('/api/claude/login'),
  start: deckId => postJSON('/api/claude/start', deckId ? { deckId } : {}),
  // opts: { deckId, slide } (v0.3 editor): the server prefixes "[slide N]" and resumes that deck's own session.
  reply: (text, opts = {}) => postJSON('/api/claude/reply', { text, ...Object.fromEntries(Object.entries(opts).filter(([, v]) => v != null)) }),
  stop: () => postJSON('/api/claude/stop'),
  events: since => getJSON('/api/claude/events?since=' + (since | 0)),
};
export const openSlides = path => postJSON('/api/open-slides', path ? { path } : {});
export const openFiles = () => postJSON('/api/open-files');

// v0.3: readiness checks, repairs, deck library, usage.
export const health = () => getJSON('/api/health');
export const fix = name => postJSON('/api/fix/' + encodeURIComponent(name));
export const fixStatus = () => getJSON('/api/fix/status');
export const usage = () => getJSON('/api/usage');
export const decks = {
  list: () => getJSON('/api/decks'),
  create: () => postJSON('/api/decks'),
  get: id => getJSON('/api/decks/' + encodeURIComponent(id)),
  patch: (id, body) => patchJSON('/api/decks/' + encodeURIComponent(id), body),
  slides: id => getJSON('/api/decks/' + encodeURIComponent(id) + '/slides'),
  text: (id, editId, text) => postJSON('/api/decks/' + encodeURIComponent(id) + '/text', { editId, text }),
};
