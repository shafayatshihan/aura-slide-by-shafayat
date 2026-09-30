---
brand: Gumroad
slug: gumroad
website: https://gumroad.com
extracted_via: crawl of gumroad.com HTML + stylesheet (Firecrawl-style token extraction), 2026-10-01
---

# Gumroad — Brand Style

## Visual Theme & Atmosphere
Loud, friendly neo-brutalism for creators. Flat, saturated blocks with black outlines and hard, un-blurred offset
shadows that look printed, not rendered. Huge tight headlines, pill buttons, cards with one sharp corner. Light theme.

## Colors
| Role | Hex | Notes |
|---|---|---|
| Background | `#f4f4f0` | warm grey-cream canvas; `#ffffff` for cards |
| Primary | `#000000` | text, every border, every shadow (103 uses in the CSS) |
| Accent (one only) | `#ff90e8` | hot pink: blocks, hover text, word highlights |
| Supporting pops | `#ffc900` yellow · `#f3a642` orange · `#dc341e` red · `#23a094` teal · `#90a8ed` periwinkle | illustration fills only |
| Text Primary | `#000000` | |
| Text Muted | `#242423` | |
| Border | `#000000` | 1–3 px solid |

**Color scheme:** light
**Accent rule:** pink is the voice; the pops live inside illustrations.

## Typography
- **Display:** ABC Favorit (Dinamo, licensed), `font-medium`, `tracking-tight`, up to 12rem on the site.
  Aura blend: **Anton** (OFL), uppercase.
- **Body:** ABC Favorit. Aura blend: **Work Sans** 500 (OFL).
| Role | Size |
|---|---|
| H1 | 112 px (slides) |
| Kicker | 28 px in a pill |
| Body | 36 px |

## Spacing & Shape
- Base grid: 4 / 8 px
- Border radius: pills `9999px`; cards `rounded-3xl` (24 px) with ONE corner `rounded-sm`, e.g. `48px 48px 48px 8px`
- Shadows: yes, hard only: `4px 4px 0 #000` (buttons), `8px 8px 0 #000` (cards). Never blurred.
- Framework hint: tailwind

## Voice & Personality
- Tone: playful, blunt, encouraging
- Energy: high
- Audience: independent creators selling their first thing

## Voice samples (real copy from the brand)
- "Go from 0 to $1"
- "Sell anything"
- "Make your own road"
- "Share your work. Someone out there needs it."

## Illustration
Flat geometric objects (coins, instruments, arrows, sparkles) filled with the pops, 4–5 px black outline, and a solid
black copy offset ~10 px behind each shape as its hard shadow.

## Quick Reference (for Claude)
```css
:root {
  --bg: #f4f4f0;
  --fg: #000000;
  --accent: #ff90e8;
  --radius: 48px 48px 48px 8px;
  --shadow: 8px 8px 0 #000;
}
```

---

## Reference
**Website:** [https://gumroad.com](https://gumroad.com)
