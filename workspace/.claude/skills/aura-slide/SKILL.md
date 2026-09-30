---
name: aura-slide
description: Aura-Slide deck builder. Use when the user says "show your aura" (or asks to make, build or start their slides) inside the Aura-Slide by Shafayat folder. Reads their form answers and files, then builds the presentation.
---

# show your aura

> **Version 0.1: the start-up part only.** The full slide-building process (design choices, slide writing, 3D, video,
> PDF/PowerPoint backups) will be added in the next version. Until then, do only what is written below.

The user is not technical. Use short, friendly sentences. Never show code or commands to them.

## 1. Check the brief
Read `.aura/brief/brief.md`.
- If it does not exist: tell them "First, open your Aura-Slide folder and double-click **2 - Fill in the form**. Fill it in and press **Save**, then type **show your aura** again." Then stop.

## 2. Check their files
List everything under `3 - Put your files here/` (all subfolders). Note which folders are empty.

## 3. Say hello with a short summary
Reply in this shape, filled with their details:

> ✨ **Your aura is ready to shine.**
> **Talk:** <type> — "<title>" · <minutes> minutes · <slides or "I'll choose the number of slides">
> **Presenters:** <names> · **Supervisor:** <name if given>
> **I found:** <n> files — <one line per non-empty folder, e.g. "Report: thesis_final.pdf">
> **Missing:** <anything important that is empty, e.g. "no images yet — that's fine, I can make illustrations">
>
> Is this right? Reply **yes** to continue, or tell me what to change.

## 4. Stop and wait
Wait for their answer. The next steps of the process are not written yet.
