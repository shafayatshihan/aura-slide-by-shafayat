# Editing a finished deck (the app's editor)

The editor sends one request per message, usually prefixed with the slide the user had selected:

```
[slide 3] make the headline shorter
[slide 5] use the file pump-photo.jpg instead of the drawing
[slide 2] q1: Bar heights
```
- `[slide N]` is the 1-based slide number as the deck shows it now. No prefix = a request about the whole deck.
- "use the file <name>" means a file they just added to `3 - Put your files here/Anything else/` (look there first,
  then the other folders). It is read-only like all their files: copy it into the build folder's `assets/`.
- The user may also have changed some texts **directly** in the editor. The app writes those straight into the build
  folder and the packed file. So always **re-read the build source before editing**, and never put back old wording
  they changed themselves.

## Which deck
The deck is the one this conversation built: its build folder `.aura/temp/build/<slug>/` and its packed file
`4 - Your slides/<Title>.html`. If you are not sure, find the build folder whose `index.html` `<title>` matches the
packed file's name. Never hand-edit the packed file.

## Small change or bigger change?
- **Small** (text on one slide, swap one picture, a colour, move or resize one element, add a source line, notes):
  just do it. No questions.
- **Non-trivial** (add, remove, split or reorder slides; change the look; a change across many slides; anything that
  could mean two different things): first ask with up to 3 `[[aura:choice …]]` lines (each with a sensible
  default), `[[aura:ask]]` as the last line, end the turn, and continue when the answers come back.
- **Full rebuild** (a new look for the whole deck, "start again", a new story, more than about half the slides
  changing): treat it as a rebuild (see "Packing" below).

## Steps
1. `[[aura:stage=build]]` — one short line saying what you are changing ("Shortening the headline on slide 3").
   Change **only what they asked**, only on that slide unless the request is about the deck. Keep every other slide,
   style and animation exactly as it is.
   - **Keep `data-edit` ids stable.** An element whose text changes keeps its id. A moved element keeps its id. Never
     renumber, never reuse a deleted id. New text elements get new ids: after editing run
     `node .aura/engine/tools/new_deck.js --ids .aura/temp/build/<slug>`.
   - Inserting or deleting slides changes the numbers of the slides after it; ids stay as they are (they are names,
     not positions).
2. `[[aura:stage=check]]` — `node .aura/engine/tools/deck_check.js .aura/temp/build/<slug>` (add `--notes` if the
   deck has speaker notes as a deliverable). Look at the picture of the slide you changed (`.aura/temp/shots/<slug>/`).
   Fix until `RESULT: clean`. The HARD RULES apply to edits exactly as to the first build: if a request would need
   text under 26 px, trim whitespace, shorten words or split the slide, and say so kindly.
3. `[[aura:stage=export]]` — pack (see below), then
   `node .aura/engine/tools/deck_check.js "4 - Your slides/<Title>.html" --no-shots`.
   Backups: remake **only the ones that already exist** next to the deck — `<Title>.pdf` → `export_pdf.js`,
   `<Title>.pptx` → `export_pptx.py`, `<Title> - speaker notes.docx` → `export_notes.py` (with `--timed` if it was
   a timed script). Do not create backups they never had.
4. `[[aura:stage=done]]` — one or two short lines: what changed, and anything they should look at. Then 3–5 fresh
   `[[aura:hint slide=N text="…"]]` lines for the deck as it is now, then the last line
   `[[aura:done path="4 - Your slides/<Title>.html"]]` (same file as before).

## Packing
- **Edits:** pack to the **same file**, in place, without moving anything to Older versions:
  `.aura/venv/Scripts/python.exe .aura/engine/tools/pack_deck.py .aura/temp/build/<slug> --title "<Title>" --replace`
  Use exactly the same `--title` as before so the file name does not change.
- **Full rebuilds:** pack without `--replace`; the previous deck and its backups move to `4 - Your slides/Older
  versions/` with the date first. Then remake the backups the deck had before.
