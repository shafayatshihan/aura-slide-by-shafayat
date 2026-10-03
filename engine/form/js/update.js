// "Update lumi" / "Repair lumi": the launcher stops this server, installs and starts it again; this watches for the server to go
// away and come back, then reloads the page in place. Shared by the loading screen and the home screen (it was written twice).
//   startUpdate('update' | 'repair', { say(text), sfx(name), alive() -> bool, button?, maxMs? })
import * as api from './api.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function startUpdate(name, { say = () => {}, sfx = () => {}, alive = () => true, button = null, maxMs = 15 * 60 * 1000 } = {}) {
  if (button) button.disabled = true;
  sfx('launch');
  const res = await api.fix(name);
  if (!alive()) return;
  if (!res || res.ok === false) {
    if (button) button.disabled = false;
    say(res && res.message ? res.message.charAt(0).toLowerCase() + res.message.slice(1) : 'that didn’t start. try again?'); sfx('error');
    return;
  }
  if (res.launched === false) { say(`the ${name === 'repair' ? 'repair' : 'updater'} would open now (test mode).`); if (button) button.disabled = false; return; }
  say(name === 'repair' ? 'repairing lumi… this window refreshes by itself.' : 'updating lumi… this window refreshes by itself.');
  let wentDown = false;
  const t0 = Date.now();
  for (let i = 0; alive() && Date.now() - t0 < maxMs; i++) {
    await sleep(api.pace(2000, i, { max: 4000 }));
    const up = await fetch('/api/ping', { cache: 'no-store' }).then(x => x.ok).catch(() => false);
    if (!up) wentDown = true;
    else if (wentDown) { sfx('success'); location.reload(); return; }
  }
  if (alive()) say('that is taking a while. if it finished, press check again.');
}
