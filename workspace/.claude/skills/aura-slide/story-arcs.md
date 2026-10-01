# Story arcs

Every deck tells one story with one main message (`work.message`). Open with why it matters, close on that message.
Pick the arc for `basics.type`, then fit it to the slide count (about one slide per minute of `audience.minutes`,
Q&A not included, never fewer than 6). Merge or drop the optional (opt) slides first when short of time; split the
results slides first when there is time to spare. Their own slide plan (`plan.slides`) always wins over these arcs.

| Talk type | Arc |
|---|---|
| **Thesis defence** | Title · The problem in one picture · Why it matters / gap · Objectives · Method (1–3) · Results (one finding per slide, 3–5) · Discussion and limits · Contributions · Future work (opt) · References · Thank you and questions |
| **Thesis progress** | Title · The aim, recapped · Done since last time · Results so far (1–3) · Problems and how we solved them · Plan and timeline · Where we need advice · Thank you |
| **Project** | Title · The problem · Our idea · How it works · How we built / tested it · Results (1–3) · What it means / impact · Next steps · Thank you and questions |
| **Class presentation** | Title · A hook (question, surprising fact) · Map of the talk (opt) · Point 1 · Point 2 · Point 3 · An example · Summary · Questions |
| **Seminar** | Title · Context · The big question · Background (1–2) · Main insights (2–4) · What it means · Open questions · Thank you |
| **Conference talk** | Title · The problem in one picture · Our contribution · Method · Key results (2–3, strongest first) · Takeaway · Thank you and contact |
| **Proposal** | Title · The need · Objectives · Approach · Work plan and timeline · Expected outcomes · Resources / budget (opt) · Risks (opt) · Thank you |
| **Lecture** | Title · Learning goals · Section openers + 2–4 slides each · A check-your-understanding question per section · Summary · Practice / reading |
| **Other** | Use `basics.typeOther` and pick the nearest arc above. |

Always add what `content.include` asks for (references in `content.citations` style, thank-you and questions,
acknowledgements, contact). The title slide carries title, subtitle, presenters (with IDs if given), supervisor with
title, institution / department, event and date; use `data-kind="title"`.

## Audience
- `audience.level`: "No background" → plain words, one everyday comparison per hard idea, define every term.
  "Some background" → name terms once with a short gloss. "Experts" → precise terms, more numbers, still one idea per slide.
- `audience.who`: examiners and supervisors want method rigour and honest limits; classmates want the story and
  the why; the public wants the impact. Put the slide time where your audience's questions will be.

## Presenter mode or document mode
- **Presenter** (default; a person talks over the slides): ≤ 25 words per content slide, image-led, the detail goes
  in the speaker notes.
- **Document** (read without a speaker, e.g. `delivery.where` says it is sent as a file or read online): ≤ 75 words,
  visible structure, sources on the slide.
Decide once per deck (`<main class="deck" data-mode="...">`) and never mix.

## Headlines
State the point, not the topic: "Moisture control saved 34% water", not "Results". ≤ 10 words, one idea.
Exactly one emphasis phrase (1–3 words) per slide, using the theme's device (`.em`).

## Timing
Give each slide `data-minutes`: title 0.5, section 0.25, content 1 (results and method slides 1–1.5), closing 0.5.
The total should equal `audience.minutes` (± 1). If the planned total is over, cut a slide rather than rushing.
