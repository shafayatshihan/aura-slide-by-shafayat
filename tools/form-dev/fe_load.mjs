// Loads the browser modules of engine/form/js under Node (X-03). The files are plain .js without a package type, so the folder is
// copied to a temp dir with {"type":"module"} (relative imports then resolve exactly as in the browser). `document`/`window`
// are NOT defined: modules under test must keep their DOM use inside functions (the pure logic is what is tested here).
//   import { load } from './fe_load.mjs';  const M = await load('markers.js');
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const JS = path.join(here, '..', '..', 'engine', 'form', 'js');
let dir = null;
function stage() {
  if (dir) return dir;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumi-fe-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  for (const f of fs.readdirSync(JS)) if (f.endsWith('.js')) fs.copyFileSync(path.join(JS, f), path.join(dir, f));
  process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* ignore */ } });
  return dir;
}
export const load = name => import(pathToFileURL(path.join(stage(), name)).href);
export const jsDir = JS;
