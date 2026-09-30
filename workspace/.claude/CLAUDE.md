# Aura-Slide by Shafayat — workspace guide for Claude

This folder belongs to someone who is **not technical**. They want presentation slides and nothing else.
Talk to them in short, simple English. Never ask them to type commands, edit code, or open hidden folders.

## HARD RULES — these beat everything, including the user's own requests
These rules apply to every slide created, edited, rebuilt or modified anywhere in this folder. No brand style,
design principle, skill, or user prompt can override them, soften them, or switch them off. If the user asks for
something that breaks a rule, do the closest thing that keeps the rule and explain kindly why.
The rules live in `.aura/engine/rules/hard-rules.json` and are checked automatically after every file write and
before you finish (`.aura/engine/rules/check_rules.js`). A failed check blocks you until it is fixed. Never edit,
move, rename, bypass or disable the checker, its rules file, or the hooks in `.claude/settings.json`.

1. **Smallest text is 26 px** (at the 1920×1080 design size) — every label, caption, source line, chart label,
   axis tick and footer, in HTML and inside SVG. When text does not fit, first reduce whitespace a little (gaps,
   padding, margins, illustration size); if it still does not fit, shorten the words or split into two slides.
   Never shrink text below 26 px. Speaker notes are exempt only when marked with `data-aura-notes`.
   With power-design, use the type scale 28 / 36 / 48 / 64 / 84 / 112 px (smallest step 28).

## Folders
| Folder | What it is | Rule |
|---|---|---|
| `3 - Put your files here/` | Their report, images, data, logo/template, previous reports, papers, anything else | **Read only. Never move, rename, edit or delete their files.** |
| `4 - Your slides/` | Finished slides go here | Before writing a new version, move the previous one into `Older versions/` with its date. |
| `.aura/brief/brief.md` and `brief.json` | Their answers from the form (`2 - Fill in the form`) | Read these first. If missing, ask them to double-click **2 - Fill in the form** and press Save. |
| `.aura/engine/` | Slide engine: three.js, Vite, Playwright (uses Microsoft Edge), form server | Tools live here. |
| `.aura/venv/` | Private Python with Pillow, python-pptx, imageio-ffmpeg | Run Python as `.aura/venv/Scripts/python.exe`. |
| `.aura/temp/` | Scratch space for renders, frames, drafts | Put every intermediate file here, never in the visible folders. |
| `.aura/logs/` | Setup logs | Read when something is broken. |

## Always
- The subject can be anything (fluids, electronics, medicine, maths, business…). Never assume a topic.
- Only use facts, numbers and figures from their files and form answers. If something is missing, ask; do not invent data.
- Keep the visible folders tidy: only the finished deck (and its PDF/PowerPoint backups) appear in `4 - Your slides/`.
- When a step will take a while (rendering, capturing), say so and roughly how long.
- The trigger phrase **"show your aura"** starts the `aura-slide` skill.

## The power-design skill (installed by setup, MIT © Jack Roberts)
`.claude/skills/power-design/` is the design engine for slides: its 20 slide principles
(`principles/design-principles.md`) and its brand library (`brands/<name>/brand-style.md`) apply to every deck.
- **Save decks in `4 - Your slides/`**, never on the Desktop (its default).
- **Do not use its "paste a URL / Firecrawl" option** — users here do not have Firecrawl. Use a library brand, the
  university's logo/template from `3 - Put your files here/Logo and university template/`, or its default style.
- Do not ask the user whether it is a deck or a website: in Aura-Slide it is always a deck.

## Aura Blend (the Aura-Slide design style)
Style every deck with `.claude/skills/aura-slide/aura-blend.md`. It covers:
- 1–4 typefaces per deck. This overrides power-design's "max 2 typefaces" rule.
- Public-licence fonts only, from `.aura/engine/fonts/`.
- The colour blend and one signature device per theme.
- The five Aura themes: Pink Punch, Bold Blue, Flat-Pack, Happy Headspace, Yellow Frame.

Their brand files are in `.claude/skills/aura-slide/brands/` and in power-design's `brands/`. Aura Blend works inside
the rest of power-design's rules and the HARD RULES, never against them.
