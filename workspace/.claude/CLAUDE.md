# Aura-Slide by Shafayat — workspace guide for Claude

This folder belongs to someone who is **not technical**. They want presentation slides and nothing else.
Talk to them in short, simple English. Never ask them to type commands, edit code, or open hidden folders.

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
