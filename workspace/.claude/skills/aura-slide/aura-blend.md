# Aura Blend — how Aura-Slide styles a deck

Aura Blend sits on top of power-design. Power-design's 20 slide rules still apply, except for the one override below.
The HARD RULES in `.claude/CLAUDE.md` (no text under 26 px) beat everything.
Aura Blend adds three things: a type blend, a colour blend, and one signature style device per theme.

## Override of power-design's Font Pairing rule
The downloaded power-design rulebook says "maximum 2 typefaces per deck". **In Aura-Slide the limit is 4.**
This is the owner's rule, and it applies in this folder even though the rulebook file says 2.

## 1. Type: up to four voices, one job each
- **1–4 typefaces per deck.** Each has one fixed role for the whole deck:
  1. **display:** headline
  2. **text:** body
  3. **label (optional):** kicker, captions, numbers; usually a mono
  4. **emphasis (optional):** a second display voice for one short phrase
- Any two must clearly differ: serif vs sans vs mono, a different width, or a different weight personality.
  Two look-alike sans-serifs are not a blend.
- Sizes: 28 / 36 / 48 / 64 / 84 / 112 px (modular 1.333, floor 28). At most 3–4 sizes per slide.
- Emphasis inside a headline goes on **one phrase of 1–3 words**, using the theme's device.
  Never more than one emphasis per slide.
- **Fonts must have a public licence:** SIL Open Font License, Apache 2.0, or CC BY with credit.
  Use only the fonts in `.aura/engine/fonts/`; their licences are in `.aura/engine/fonts/licenses/`.
  Never use a font marked "personal use", "demo", "test" or "free for personal use", and never a paid brand font.

## 2. Colour: 60 · 30 · 10, with a blended 10
- 60 % canvas, 30 % the theme's signature surface (art block, stripe, panel), 10 % accent for emphasis.
- A theme may blend **3–5 brand colours**, but only inside the illustration and the signature surface.
  Text stays one ink colour; highlights use the single accent.
- Every text colour needs ≥ 4.5:1 contrast (≥ 3:1 at 24 px and up); aim for 7:1.

## 3. Style: one signature device per theme, used everywhere
The device makes a deck feel like one piece. Use it on the art, the kicker and the emphasis; never mix devices
from two themes.

## The five Aura themes
| # | Theme | Brand DNA | Fonts (all public licence) | Colour blend | Signature device |
|---|---|---|---|---|---|
| 1 | **Pink Punch** | Gumroad | Anton (display, uppercase) + Work Sans (text) | cream canvas · pink block · yellow, orange, teal, red pops | black outlines + hard 8 px black shadow, pill kicker, pink highlighter on one phrase |
| 2 | **Bold Blue** | Coinbase | Plus Jakarta Sans 800 (display) + Work Sans (text) | pure white · Coinbase blue block · black | flat geometric (Bauhaus) shapes; blue emphasis phrase |
| 3 | **Flat-Pack** | IKEA | Noto Sans 800 (display) + Noto Sans 400 (text) | pure white · grey card · IKEA blue · IKEA yellow | flat-pack assembly manual (numbered steps, parts with "6x", the happy figure), yellow price-tag kicker, blue emphasis phrase |
| 4 | **Happy Headspace** | Headspace | Quicksand 700 (display) + DM Sans (text) + Reno Mono (label) | pure white · orange, gold, amber, pink, purple, teal-navy | smiling blob characters, gold pill kicker, orange squiggle underline |
| 5 | **Yellow Frame** | National Geographic | Source Serif 4 (display) + Open Sans (text, uppercase label) | pure white · black · the yellow border; **never a dark background** | a bright daylight nature "photograph" inside the thick yellow rectangle; yellow-rectangle mark before the kicker |

Brand files:
- power-design library: `brands/coinbase`
- this skill folder: `brands/gumroad`, `brands/headspace`, `brands/ikea`, `brands/national-geographic`.
  IKEA and National Geographic were extracted with Firecrawl.
- `brands/mailchimp`, `brands/nothing` and `brands/polaroid` are kept as spares; they are not Aura themes.

## Font licences (engine/fonts)
- **SIL Open Font License:** Anton, Plus Jakarta Sans, DM Sans, DM Mono, Geist, Geist Mono, Doto, Fraunces, Jost,
  Noto Sans, Source Serif 4, Open Sans, Work Sans, Quicksand.
- **CC BY 4.0:** Reno Mono. Credit "Reno Mono by Renaud Futterer" wherever the fonts are listed.

All of these may be embedded in slides and shared.
