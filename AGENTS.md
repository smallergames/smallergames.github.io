# Agents Guide

**Keep this file up to date.** When you change behavior, constants, or architecture, update the relevant section here. This is the source of truth for how the codebase works.

## File Structure

```
index.html          # Gallery landing page
404.html            # Not found page
one/index.html      # Dice fidget toy
assets/
  app.js            # Main logic, state machine, event handlers
  shared.js         # Shared utilities (announce function)
  particles.js      # Canvas-based glitch particle effects
  loot.js           # Loot tier logic and drop spawning
  physics.js        # Rapier WASM physics (homepage + dice fidget)
  styles.css        # Styles, CSS custom properties, animations
  fonts/            # Self-hosted Outfit font (woff2)
```

## Development

Static site, no build step. Run `python3 -m http.server 8000` and visit `localhost:8000`.

## Typography

- Use proper ellipsis `…` not `...`
- Use curly quotes `"` `"` and apostrophes `'` not straight `"` `'`

## Constraints

### No Build Tooling

No tests, no bundler, no minification. The project is too small to justify the overhead.

### No Loot Persistence

Refresh to start fresh. Persisting loot would require a reset UI—clutter for minimal benefit.

### prefers-reduced-motion

**The site does NOT honor prefers-reduced-motion.** Animations ARE the functionality. A warning modal appears on first visit; dismissal stored in localStorage. This is intentional—don't change it.

### Text Stability

**NEVER move, shake, or transform text.** No `text-shadow`, `box-shadow`, or glow effects on text. For glitch effects on the die, use only `filter` and `opacity`.

### Animation/JavaScript Sync

Use animation events (`animationiteration`, `animationend`) instead of `setTimeout` to sync with CSS animations. Timers drift.

### Animations vs Transitions

Don't transition properties that are also animated—removing an animation class triggers the transition back to rest state. The die SVG only transitions `filter`, not `transform`.

### Background Colors

**Use `body::before` pseudo-element for background, never html/body directly.** Direct backgrounds cause color banding on calibrated monitors. Also avoid `color-scheme: dark`.

```css
body::before { content: ''; position: fixed; inset: 0; background: var(--void); z-index: -1; }
```

## Color Palette

```
--void: #080607           --text: #EDE7E1
--surface: #141113        --text-dim: #C7BDB4
                          --text-muted: #8E857D

--accent: #67D6C2         --secondary: #B58CFF
--accent-glow: #9FF0E2    --secondary-glow: #D7C2FF
--accent-dim: #1F3D37     --danger: #E45B5B
```

**Loot tiers (1 = best, 7 = trash):**
1. `#F5C66A` gold  2. `#B58CFF` amethyst  3. `#5FA8FF` azure  4. `#62D49A` mint
5. `#A7B0BA` silver  6. `#B88B5A` bronze  7. `#4E4A46` ash

**Gallery colors:** Gold (#F5C66A) for headers, coral (#E45B5B) for free links, azure (#5FA8FF) for paid links.

## Architecture

### State Machine

```javascript
const GameState = {
  IDLE: 'idle',                      // Waiting for input
  RAMPING: 'ramping',                // Building energy, die rolling
  RAMPED: 'ramped',                  // Fully charged, +1 max active
  LOOT_RESOLUTION: 'loot_resolution' // Showing hit/miss result
};
```

Input blocked during LOOT_RESOLUTION on hits only—misses allow immediate retry.

### Energy System

Click/hold adds energy → die rolls while energy > 0 → drains faster on release. At max energy, die "ramps" to +1 max (d6→d7). Rolling while ramped = loot resolution.

### CSS Notes

- Mobile breakpoint: 480px
- Theme tokens in `:root` at top of `styles.css`
- Energy bar sized via `--energy-level` (0-1)
- Gallery page has self-contained inline styles and imports `physics.js` for ambient cubes

### JS Notes

- ES modules with `type="module"`
- Shared utilities in `shared.js` to avoid circular deps
- Magic numbers as named constants at top of each file
