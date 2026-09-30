---
brand: Polaroid
slug: polaroid
website: https://www.polaroid.com
extracted_via: Firecrawl (branding + markdown formats, confidence 0.925) + stylesheet crawl, 2026-10-01
---

# Polaroid — Brand Style

## Visual Theme & Atmosphere
Formal, clean white pages and square corners, lit up by the classic five-colour spectrum stripe and warm, analogue
instant photographs. Retro without being kitsch: a serif for voice, a grotesque for information, a mono for details.
Light theme.

## Colors
| Role | Hex | Notes |
|---|---|---|
| Background | `#ffffff` | `#e9e9e9` / `#f8f8f8` for quiet panels |
| Primary | `#151515` | ink; primary button is ink with white text, 0 px radius |
| Spectrum (signature) | `#d31f26` red · `#ff8200` orange · `#ffb500` yellow · `#78be20` green · `#198cd9` blue | always together, always in this order |
| Accent (one only) | `#d31f26` | if a single colour is needed |
| Text Primary | `#151515` | |
| Text Muted | `#3d3d3d` | |
| Border | `#151515` | |

**Color scheme:** light
**Accent rule:** the spectrum is used as one unit (the stripe), never as five separate accents in text.

## Typography
Site faces: **Real Head** (grotesque, headings and text), **Saol Text** (serif), **Commit Mono**.
Aura blend (all SIL OFL):
- **Display:** Fraunces 600, optical size 144 (retro soft serif, stands in for Saol)
- **Body:** Jost 400 (geometric, early-modern retro, stands in for Real Head / Avenir)
- **Kicker:** DM Mono 500, uppercase, led by a mini spectrum stripe

| Role | Size |
|---|---|
| H1 | 112 px, line-height 1.05 |
| Kicker | 28 px mono |
| Body | 36 px |

## Spacing & Shape
- Base grid: 4 / 8 px
- Border radius: 0
- Shadows: soft only under photographs (`0 18px 32px rgba(21,21,21,.22)`)
- Framework hint: custom (Shopify)

## Voice & Personality
- Tone: warm, nostalgic, confident
- Energy: medium
- Audience: people who love analogue photography

## Voice samples (real copy from the brand)
- "Capture it all!"
- "The new Polaroid Mod"
- "Change film"
- "Product highlights"

## Illustration
An instant photograph (white frame, deep bottom border) tilted a few degrees with a soft shadow, showing a warm,
faded, vignetted scene, laid over the vertical five-colour spectrum stripe.

## Quick Reference (for Claude)
```css
:root {
  --bg: #ffffff;
  --fg: #151515;
  --accent: #d31f26;
  --spectrum: linear-gradient(90deg,#d31f26 0 20%,#ff8200 0 40%,#ffb500 0 60%,#78be20 0 80%,#198cd9 0);
  --radius: 0;
}
```

---

## Reference
**Website:** [https://www.polaroid.com](https://www.polaroid.com)
