# Design — MercenarioZ

A locked design system for the whole blog. Every page uses this system; page
structure may change, but type, colour, spacing, and interaction voice stay
consistent.

## Genre

Editorial with a technical register.

## Macrostructure family

- Home: Index-First — the archive is the interface.
- About: Long Document — personal, continuous, and lightly indexed.
- Posts: Long Document — narrow reading measure with restrained metadata.
- Utility pages: Index-First — a short message and one clear route onward.

## Theme

Warm paper, brown-zinc ink, and a restrained burnt-orange accent. Dark mode is
warm charcoal rather than pure black. All values live in `styles/global.css`.

## Typography

- Display: Newsreader, weight 700, roman.
- Body: IBM Plex Sans, weight 400.
- Mono: JetBrains Mono, weight 500; reserved for metadata and code.
- Display tracking: `-0.025em`.
- Scale: major-third with a fluid display clamp.

## Spacing

A named four-point scale from `--space-3xs` to `--space-5xl`, backed by
Tailwind’s `--spacing-*` theme namespace. Layout CSS uses tokens instead of
improvised spacing.

## Motion

- One quiet entrance on the home index.
- UI feedback uses `--ease-out`; focus appears instantly.
- Reduced-motion removes transforms and animations.

## CTA voice

- Primary actions are underlined typographic links.
- Navigation and footer links never wrap.
- Buttons are square-edged or minimally rounded; no glass or gradient pills.

## Per-page allowances

- Home may use tightly cropped article imagery as supporting information.
- About uses inline images only.
- Posts keep media within the reading column.
- Utility pages use typography only.

## Hero artwork

- Canvas: `1200 × 742`, wide editorial crop.
- Technical posts: deterministic SVG, warm paper, flat ink, fine rules, and
  exact monospaced labels; never fake browser or IDE chrome.
- Product posts: natural editorial photography with tactile grain and restrained
  color; preserve the real object and personal-desk context.
- Shared palette: cream paper, charcoal-brown ink, burnt orange, and muted sage.
- No gradients, glass, watermarks, decorative badges, or invented claims.

## What pages MUST share

- MercenarioZ wordmark.
- Orange accent at less than five percent of each viewport.
- Newsreader + IBM Plex Sans + JetBrains Mono.
- Hairline rules, square image treatment, and visible focus rings.
- Quiet motion and warm light/dark surfaces.

## Exports

The canonical CSS export is the `@theme` block in `styles/global.css`. Tailwind
v4 reads those values directly. The role mapping is:

- `paper` → page background
- `ink` → primary text
- `accent` → links and active states
- `rule` → dividers
- `display`, `body`, `outlier` → heading, prose, and code/metadata
