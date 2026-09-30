---
brand: IKEA
slug: ikea
website: https://www.ikea.com
extracted_via: Firecrawl (branding + markdown formats, confidence 0.925) + page CSS check for the brand blue, 2026-10-01
---

# IKEA — Brand Style

## Visual Theme & Atmosphere
Clean, democratic Scandinavian retail: white pages, near-black type, soft grey product cards, the famous blue and
yellow used as signals (price tags, highlights). Its best-known illustration language is the wordless flat-pack
assembly manual. Light theme.

## Colors
| Role | Hex | Notes |
|---|---|---|
| Background | `#ffffff` | |
| Primary | `#0058a3` | IKEA blue (found in the page CSS; Firecrawl also reported a lighter link blue `#007cc1`) |
| Accent (one only) | `#ffdb00` | IKEA yellow: price tags and badges, always with `#111111` text |
| Text Primary | `#111111` | |
| Text Muted | `#484848` | |
| Surface | `#f5f5f5` | product and content cards |
| Secondary signal | `#ca5008` | orange, rare (offers) |

**Color scheme:** light
**Accent rule:** yellow for the label, blue for the one emphasised phrase; never large yellow text.

## Typography
- **Display + Body:** Noto IKEA (IKEA's customised Noto Sans). Aura: **Noto Sans** (SIL OFL), 800 display / 400 text / 700 labels.
| Role | Size |
|---|---|
| H1 | 112 px, 800, −0.02em, line-height 1.05 |
| Kicker | 28 px, 700, in a yellow tag (4 px radius) |
| Body | 36 px |
| Manual numbers | 48 px, 700 |

## Spacing & Shape
- Base grid: 4 / 8 px
- Border radius: 8 px cards, 4 px tags and inputs, 64 px pill buttons
- Shadows: none
- Framework hint: custom

## Voice & Personality
- Tone: friendly, practical, plain
- Energy: medium
- Audience: homeowners and renters furnishing on a budget

## Voice samples (real copy from the brand)
- "Welcome to IKEA USA"
- "Discover what's new at IKEA"
- "Inspiration for every room"
- "Right now at IKEA"

## Illustration
The assembly manual: 4 px black line drawings with round joins, a few flat fills (yellow, blue, white), big bold
step numbers, part counts like "6x", arrows between parts, and the smiling stick figure celebrating the result.
No words beyond numbers and counts.

## Quick Reference (for Claude)
```css
:root {
  --bg: #ffffff;
  --fg: #111111;
  --accent: #ffdb00;
  --brand: #0058a3;
  --surface: #f5f5f5;
  --radius: 8px;
}
```

---

## Reference
**Website:** [https://www.ikea.com](https://www.ikea.com)
