# Aura deck toolkit

Use these tools instead of improvising. All commands run from the Aura folder (the one with `.aura/`).

| Job | Command |
|---|---|
| Read their files | `.aura/venv/Scripts/python.exe .aura/engine/tools/extract_text.py` |
| Start a deck | `node .aura/engine/tools/new_deck.js "<Title>" --theme <theme>` |
| Add missing text ids | `node .aura/engine/tools/new_deck.js --ids .aura/temp/build/<slug>` (`--check` only reports) |
| Check + screenshots | `node .aura/engine/tools/deck_check.js .aura/temp/build/<slug> [--notes]` |
| Pack (one offline file) | `.aura/venv/Scripts/python.exe .aura/engine/tools/pack_deck.py .aura/temp/build/<slug> --title "<Title>"` |
| Re-pack after an edit | same, plus `--replace` (overwrites in place, nothing moves to Older versions) |
| PDF backup | `node .aura/engine/tools/export_pdf.js "4 - Your slides/<Title>.html"` |
| PowerPoint backup | `.aura/venv/Scripts/python.exe .aura/engine/tools/export_pptx.py "4 - Your slides/<Title>.html"` |
| Speaker notes (Word) | `.aura/venv/Scripts/python.exe .aura/engine/tools/export_notes.py "4 - Your slides/<Title>.html" [--timed]` |
| Hard-rule check | `node .aura/engine/rules/check_rules.js "<file.html>"` (also runs by itself) |

Temporary files live in `.aura/temp/` only: `text/` (extracted text), `build/<slug>/` (the deck you edit),
`shots/<slug>/` (check pictures), `check/` (check reports), `export/` (pictures for backups), `plan.md`.

## Themes (file name for `--theme`)
| Theme | file | Good for |
|---|---|---|
| Pink Punch | `pink-punch` | creative work, student projects, startups, energetic class talks |
| Bold Blue | `bold-blue` | engineering, computing, finance, data-heavy and formal technical talks |
| Flat-Pack | `flat-pack` | processes, methods, builds, step-by-step how-it-works stories |
| Happy Headspace | `happy-headspace` | health, education, psychology, environment, friendly public talks |
| Yellow Frame | `yellow-frame` | science, field work, nature, geography, thesis defences that want gravitas |

The theme file already sets fonts, colours and classes: `.kicker`, `.title` (112), `.headline` (84), `.sub` (48),
body 36, `.label` (28), `.big-num`, `.em` (the ONE emphasis phrase, using the theme's device), `.sig` (signature
surface), `.card`, `.source`. Tokens: `--bg --ink --muted --surface --accent` plus the theme's own colours.
Type scale: 28 / 36 / 48 / 64 / 84 / 112 px (bigger display numbers: 150 / 200). Nothing below 28 in practice.
Extra fonts: only from `.aura/engine/fonts/` via `@font-face { src: url("../../../engine/fonts/<file>") }`, at most
4 typefaces in the deck.

## Deck structure
```html
<main class="deck" data-mode="presenter">              <!-- or "document" -->
  <section class="slide" data-kind="content" data-minutes="1" data-title="Short title for notes">
    <div class="safe"> ... </div>                         <!-- .safe = inset 96 px: keep ALL text inside -->
    <aside class="notes" data-aura-notes><p>What to say.</p><p>Second point.</p></aside>
  </section>
</main>
```
- Slides are exactly 1920 x 1080 and scale to any screen. Position things in px inside the slide (absolute or grid).
- `data-kind`: `title` (≤ 45 words incl. names), `section` (≤ 8), `content` (≤ 25 presenter / ≤ 75 document),
  `quote` (≤ 30), `closing` (≤ 20), `references` (dense list, still ≥ 28 px). Words with digits are not counted.
- Art may bleed off the edges; text, logos and focal points may not (96 px safe zone).
- Write your own layout CSS in the `<style>` block of `index.html`. Use 8-pt spacing (8/16/24/32/48/64/96/128).
- Pictures: copy into `assets/` and use `assets/<name>`. The packer resizes and compresses them; no need to by hand.
  Scripts that load a picture by name must use the literal string `'assets/<name>'` so the packer can inline it.
- **Never** link anything on the internet (no CDNs, Google Fonts, web images): the deck must work offline.

## Editable text ids (`data-edit`)
The app's editor lets the user click a text on a slide and retype it, without asking you. It finds the text by its
`data-edit` id in both the build source and the packed file, so every editable text needs one.
```html
<section class="slide" data-kind="content" data-minutes="1">
  <div class="safe">
    <span class="kicker" data-edit="s3-1">Results</span>
    <h2 class="headline" data-edit="s3-2">Moisture control saved <span class="em">34% water</span></h2>
    <p data-edit="s3-3">Measured over six weeks on two test beds.</p>
    <svg ...><text x="120" y="640" class="label" data-edit="s3-4">Before</text></svg>
    <p class="source" data-edit="s3-5">Source: field log, 2025</p>
  </div>
  <aside class="notes" data-aura-notes>...</aside>      <!-- notes never get ids -->
</section>
```
- Format `s<slide>-<n>`: the slide number when the element was **first** made, then 1, 2, 3… in reading order.
- Put it on the element that holds one piece of text: titles, kickers, headlines, subtitles, body paragraphs, list
  items, labels (HTML or SVG `<text>`), captions, big numbers, quotes, table cells, source lines. Inline emphasis
  (`.em`, `<strong>`, `<br>`) stays inside its parent and does not get its own id; never nest one `data-edit` inside
  another.
- No ids on speaker notes, runtime chrome, empty boxes that a script fills, or purely decorative letters in art.
  Mark an element `data-edit="no"` to keep it out on purpose (for example text drawn letter by letter by a script).
- **Ids are names, not positions.** Never renumber them, never reuse one that was deleted, keep the id when the text
  or the slide moves. Two elements may never share an id (the tool renames the copy).
- `node .aura/engine/tools/new_deck.js --ids <build folder>` adds every missing id and fixes duplicates without
  touching existing ones. Run it after writing slides and after every edit. `pack_deck.py` keeps every attribute as
  written and reports how many editable texts the packed deck has.
- In the app's preview (`?aura=edit`) clicking an element with an id selects it for editing instead of moving to the
  next slide, so ids must sit on the visible text, not on a large wrapper.

## Motion
- **Entrances**: `data-anim="fade|fade-up|fade-down|slide-left|slide-right|zoom|pop|rise|grow-x|draw"` and
  `data-delay="<ms>"` on any element. They replay every time the slide is entered and show their final state in the
  PDF, PowerPoint and check. `rise` grows bars/liquids from the bottom, `grow-x` from the left, `draw` draws an SVG
  stroke (give the shape `pathLength="1"`). Stagger 80–150 ms; keep a slide's entrances under ~1.2 s in total.
- **Loops** (calm, 3–6 s, seamless, no flashing): your own CSS `@keyframes` on SVG parts: flow dashes along a pipe
  (`stroke-dashoffset`), turning gears, rising bubbles, a marker tracing a curve. Loops pause on hidden slides by
  themselves. **The first keyframe must be a complete, readable picture** — that frame is used for PDF / PowerPoint.
  For SVG transforms use `transform-box: fill-box; transform-origin: center;`.
- Reduced motion is handled by the runtime (everything shows its final state).

## 3D (only when `style.threeD` is yes)
```html
<div class="aura-3d" data-scene="pump" data-still="2" style="left:960px; top:120px; width:860px; height:820px"></div>
<script>
Aura.scene('pump', ({ THREE, width, height }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
  camera.position.set(4, 3, 6); camera.lookAt(0, 0.4, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d4ea, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3, 6, 4); scene.add(sun);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 48), new THREE.MeshStandardMaterial({ color: 0xff7300, roughness: 0.55 }));
  scene.add(body);
  return { scene, camera, update(t) { body.rotation.y = t * 0.5; } };   // t = seconds since the slide was entered
});
</script>
```
- The runtime loads three.js only when a 3D slide is shown, runs it only while that slide is on screen, keeps at most
  3 alive, caps the pixel ratio, and renders a still at `data-still` seconds for the PDF / PowerPoint / check.
- Use `THREE` from the setup argument (classic `<script>`, no imports, no three.js add-ons). Build shapes from
  primitives (boxes, cylinders, spheres, tori, lathe/extrude shapes), flat-shaded or `MeshStandardMaterial` in the
  theme's palette, soft hemisphere light; transparent background so the slide shows through.
- Text labels for a 3D scene are HTML on top of the canvas (≥ 28 px), not text inside WebGL.
- One 3D scene per slide. Slow, steady motion (rotation ≤ 0.6 rad/s). Return `dispose()` only if you made extra
  resources yourself; the runtime frees geometry, materials and textures in the scene.
- 2D canvas loops work the same way: `<div class="aura-canvas" data-canvas="id">` +
  `Aura.canvas('id', ({ ctx, width, height }) => (t) => { ...draw frame t... })`. Prefer SVG + CSS when you can.

## Speaker notes and timing
- Notes: 2–4 short paragraphs per slide in `<aside class="notes" data-aura-notes>`, in the presenter's voice, adding
  what the slide does not say (Mayer: never just repeat the slide). Last slide: likely questions with short answers.
- `data-minutes` on every slide; they should add up to `audience.minutes`. The presenter view (N / P) shows the
  planned time window, the notes and the next slide; `export_notes.py --timed` prints a timed script.

## Reading the check
`deck_check.js` renders every slide in Microsoft Edge (all slides shown, final state) and reports per slide:
- **ERROR** (must fix): text < 26 px (HARD RULE) · text inside the 96 px edge band · text cut off · too many words for
  the slide kind · contrast below 3:1 · a picture that did not load · a 3D scene that failed · a script error · anything
  that needs the internet · more than 4 typefaces · a font that failed to load · a slide that is not 1920 x 1080.
- **warn** (fix unless there is a reason): contrast below 4.5:1 · more than 4 sizes on a slide or 6 in the deck ·
  sizes off the scale · less empty space than the slide kind needs · overlapping texts · a non-embedded font ·
  a slide without notes (with `--notes`).
- Fix order when text does not fit: reduce gaps / padding / illustration size a little → shorten words → split
  the slide. **Never shrink text below 26 px.**
- Then **look** at `.aura/temp/shots/<slug>/overview.png` and the slides themselves (Read the PNG). The check passes
  measurable rules; only your eyes catch a cramped corner, an awkward line break or art that fights the headline.

## Packing and backups
- `pack_deck.py` writes `4 - Your slides/<Title>.html` (the `<title>` or `--title`), with everything inside it:
  runtime, styles, fonts, pictures (resized to ≤ 1920 px, compressed), videos, and three.js when 3D is used. It
  refuses to pack when something is missing or online, and says what. An existing file with the same name, plus its
  `.pdf`, `.pptx` and ` - speaker notes.docx`, moves to `Older versions/` as `YYYY-MM-DD HHMM <name>`.
  With `--replace` (edits from the editor) the deck is overwritten in place and its backups stay where they are;
  then remake only the backups that exist.
- `delivery.backups`: "PDF" → `export_pdf.js` (real text, one page per slide). "PowerPoint" → `export_pptx.py` (one
  picture per slide, notes in the notes pane; tell them PowerPoint slides are pictures, so edits happen here).
- `delivery.help`: anything with "notes" → notes in the deck + `export_notes.py`; "script" or "timed" →
  `export_notes.py --timed`; other help (practice tips, likely questions) → put it in the last slide's notes.
- `delivery.clicker`: clickers send arrow / page keys, which the deck understands. Mention it in the summary.
- The deck keys: → / Space / Page Down next, ← / Page Up back, Home / End, a number + Enter jumps, F full screen,
  N notes view, P presenter window (second screen), B black screen.
