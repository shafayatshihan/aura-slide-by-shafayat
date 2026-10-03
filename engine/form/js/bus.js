// Tiny app-wide event bus. emit('step:change', {...}); const off = on('step:change', e => ...); off();
export const bus = new EventTarget();
export const emit = (type, detail = {}) => bus.dispatchEvent(new CustomEvent(type, { detail }));
export function on(type, fn) {
  const h = e => fn(e.detail, e);
  bus.addEventListener(type, h);
  return () => bus.removeEventListener(type, h);
}

// F-10: ONE answer to "is Claude running?". Everything that learns something (the events poll in workshop.js, the plan
// poll of the plan/build pages, an optimistic "I just pressed build") reports here with setClaude(); everything that
// needs the answer reads claudeNow(). The freshest report wins, so two endpoints can never leave a stale "running" latched,
// and no route has to be mounted to keep it up to date.
const CLAUDE = { running: false, waiting: false, deckId: null, at: 0 };
export function setClaude(patch, at = Date.now()) {
  if (at < CLAUDE.at) return CLAUDE;                      // an older observation arriving late never overrides a newer one
  const was = `${CLAUDE.running}|${CLAUDE.waiting}|${CLAUDE.deckId}`;
  if ('running' in patch) CLAUDE.running = !!patch.running;
  if ('waiting' in patch) CLAUDE.waiting = !!patch.waiting;
  if ('deckId' in patch) CLAUDE.deckId = patch.deckId || null;
  CLAUDE.at = at;
  if (was !== `${CLAUDE.running}|${CLAUDE.waiting}|${CLAUDE.deckId}`) emit('claude:change', { ...CLAUDE });
  return CLAUDE;
}
// claudeNow(deckId?) -> { running, waiting }: for that deck (a run for another deck counts as "elsewhere", not "running")
// A report older than STALE_MS is not trusted (every poller reports on every poll, so a silent store means nobody is watching):
// that is what stops a "running" seen once from being believed for the rest of the session.
export const STALE_MS = 20000;
export function claudeNow(deckId = null, now = Date.now()) {
  const fresh = now - CLAUDE.at < STALE_MS;
  const mine = !deckId || !CLAUDE.deckId || CLAUDE.deckId === deckId;
  return { running: fresh && CLAUDE.running && mine, waiting: fresh && CLAUDE.waiting && mine, elsewhere: fresh && CLAUDE.running && !mine, deckId: CLAUDE.deckId };
}
export const _resetClaude = () => { CLAUDE.running = false; CLAUDE.waiting = false; CLAUDE.deckId = null; CLAUDE.at = 0; };   // tests
