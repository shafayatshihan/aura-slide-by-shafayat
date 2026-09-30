---
brand: Mailchimp
slug: mailchimp
website: https://mailchimp.com
extracted_via: crawl of mailchimp.com HTML + 13 stylesheets (Firecrawl-style token extraction), 2026-10-01
---

# Mailchimp — Brand Style

## Visual Theme & Atmosphere
Warm, witty and a little weird. Full-bleed Cavendish-yellow sections carry dark peppercorn type; a characterful serif
headline sits over a plain grotesque body. Illustrations are loose black ink drawings over flat colour shapes printed
slightly off-register. Light theme.

## Colors
| Role | Hex | Notes |
|---|---|---|
| Background | `#ffe01b` | Cavendish yellow (110 uses); `#ffffff` / `#f6f6f4` for quiet sections |
| Primary | `#241c15` | peppercorn ink (`#231e15` in CSS, 290 uses) |
| Accent (one only) | `#4bc4c2` | light teal, used as flat fills |
| Supporting | `#007c89` teal · `#fbeeca` cream · `#692340` plum · `#f25f25` orange · `#ff3ebf` pink | sparing |
| Text Primary | `#241c15` | 14:1 on Cavendish |
| Text Muted | `#575757` | on white only |
| Border | `#dbd9d2` | |

**Color scheme:** light (yellow canvas)
**Accent rule:** teal for fills; the headline stays ink.

## Typography
- **Display:** Means Web (licensed serif, headlines and big numbers). Aura blend: **Fraunces** 600 (OFL).
- **Body:** Graphik Web (licensed grotesque). Aura blend: **Work Sans** (OFL). Fallback: Work Sans.
| Role | Size |
|---|---|
| H1 | 112 px, line-height 1.08, −0.01em |
| Kicker | 28 px, weight 600 |
| Body | 36 px |

## Spacing & Shape
- Base grid: 4 / 8 px
- Border radius: 4 px (`.25rem`), pills `6.25rem` for CTAs, circles for avatars
- Shadows: rare, soft `0 .25rem .75rem rgba(36,28,21,.12)`
- Framework hint: custom

## Voice & Personality
- Tone: warm, witty, plain-spoken
- Energy: medium-high
- Audience: small businesses and marketers

## Voice samples (real copy from the brand)
- "Email & SMS marketing minus the learning curve"
- "Effortless growth powered by your data"
- "An easier way to keep your community engaged"

## Illustration
Black ink line (5–6 px, round caps, slightly wobbly) drawn over flat fills (white, cream, teal) that are shifted
~12 px off the line, like a misregistered print. Dotted flight paths and loops add motion.

## Quick Reference (for Claude)
```css
:root {
  --bg: #ffe01b;
  --fg: #241c15;
  --accent: #4bc4c2;
  --radius: 4px;
}
```

---

## Reference
**Website:** [https://mailchimp.com](https://mailchimp.com)
