// Record each theme's two animated demo slides (docs/screenshots/theme-previews/<n>-<slug>.html = illustration,
// <n>-<slug>-flow.html = illustrated process, made by tools/theme_previews.py) into one seamless 12 s loop for the form:
// engine/form/themes/<n>-<slug>.mp4 + <n>-<slug>.jpg (poster). Illustration for 6 s, a 0.5 s crossfade, the process
// slide for 6 s, and a crossfade back. Frames are captured deterministically: every CSS animation and every SVG
// (SMIL) animation is paused and set to the exact frame time, so each 6 s slide loop joins perfectly.
//   FFMPEG=<path to ffmpeg.exe> node tools/build_previews.js
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const { chromium } = require(process.env.PW || 'X:/CLPHP_Project/frontend/node_modules/playwright');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const dir = path.resolve(__dirname, '..', 'docs', 'screenshots', 'theme-previews');
const out = path.resolve(__dirname, '..', 'engine', 'form', 'themes'); fs.mkdirSync(out, { recursive: true });
const LOOP = 6, FPS = 30, N = LOOP * FPS, FADE = 15;   // 15 frames = 0.5 s crossfade
const pad = i => String(i).padStart(4, '0');
async function record(page, file, tmp, tag) {
  await page.goto('file:///' + file.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
  for (let i = 0; i < N; i++) {
    await page.evaluate(ms => {
      document.getAnimations().forEach(a => { a.pause(); a.currentTime = ms; });
      document.querySelectorAll('svg').forEach(s => { s.pauseAnimations(); s.setCurrentTime(ms / 1000); });
    }, i * 1000 / FPS);
    await page.screenshot({ path: path.join(tmp, `${tag}${pad(i)}.png`) });
  }
}
(async () => {
  const b = await chromium.launch({ channel: 'msedge' });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const f of fs.readdirSync(dir).filter(f => /^\d-[a-z-]+\.html$/.test(f) && !f.endsWith('-flow.html')).sort()) {
    const name = f.replace('.html', ''), flow = path.join(dir, name + '-flow.html');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-' + name + '-'));
    await record(p, path.join(dir, f), tmp, 'a');
    const two = fs.existsSync(flow);
    if (two) await record(p, flow, tmp, 'b');
    // sequence: a(0..N) then b(0..N); both slides loop every N frames, so a crossfade can borrow frames by index modulo N
    const seq = [];
    if (!two) for (let i = 0; i < N; i++) seq.push([`a${pad(i)}`]);
    else for (let i = 0; i < 2 * N; i++) {
      const k = i % N, first = i < N ? 'a' : 'b', next = first === 'a' ? 'b' : 'a';
      const w = k >= N - FADE ? (k - (N - FADE) + 1) / (FADE + 1) : 0;
      seq.push(w ? [`${first}${pad(k)}`, `${next}${pad(k)}`, w] : [`${first}${pad(k)}`]);
    }
    const list = path.join(tmp, 'seq.txt'); const lines = [];
    seq.forEach((s, i) => {
      let src = path.join(tmp, s[0] + '.png');
      if (s.length === 3) {                                       // blend the two frames with ffmpeg
        src = path.join(tmp, `x${pad(i)}.png`);
        execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', path.join(tmp, s[0] + '.png'), '-i', path.join(tmp, s[1] + '.png'),
          '-filter_complex', `blend=all_expr='A*(1-${s[2].toFixed(4)})+B*${s[2].toFixed(4)}'`, src]);
      }
      lines.push(`file '${src.replace(/\\/g, '/')}'`, `duration ${(1 / FPS).toFixed(6)}`);
    });
    fs.writeFileSync(list, lines.join('\n') + '\n');
    const mp4 = path.join(out, name + '.mp4'), jpg = path.join(out, name + '.jpg');
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-r', String(FPS),
      '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', '-an', mp4]);
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', path.join(tmp, 'a0045.png'), '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '3', jpg]);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`${name}: ${two ? 12 : 6} s, ${(fs.statSync(mp4).size / 1024).toFixed(0)} KB video, ${(fs.statSync(jpg).size / 1024).toFixed(0)} KB poster`);
  }
  await b.close();
})();
