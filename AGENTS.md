# Agents Guide

Keep this file up to date when behavior, constants, or architecture changes.

## File Structure

```
index.html          # Homepage
404.html            # Not found page
one/index.html      # Dice fidget toy
assets/
  app.js            # Main game logic, state machine, event handlers
  shared.js         # Shared utilities (announce function)
  particles.js      # Canvas particle/glitch effects
  loot.js           # Loot tier logic and drop spawning
  physics.js        # Rapier WASM physics for dice fidget loot cubes
  styles.css        # Dice fidget styles, tokens, and animations
  fonts/            # Self-hosted Geist Pixel Square + Outfit fonts
```

## Development

Static site, no build step:

```bash
python3 -m http.server 8000
```

## Constraints

- No build tooling, bundler, minification, or test harness.
- No loot persistence. Refresh starts fresh.
- `prefers-reduced-motion` is intentionally not honored. Show the warning modal on first visit and store dismissal in `localStorage`.
- For dice page background (`assets/styles.css`), use `body::before`; do not set background directly on `html` or `body`.
- Do not add `color-scheme: dark`.
- Prefer animation events (`animationiteration`, `animationend`) over timers when syncing JS with CSS animation boundaries.
- Avoid transitioning properties that are also actively animated.

## Dice Fidget Model

```javascript
const GameState = {
  IDLE: 'idle',
  RAMPING: 'ramping',
  RAMPED: 'ramped',
  LOOT_RESOLUTION: 'loot_resolution'
};
```

- Input is blocked during `LOOT_RESOLUTION` only for hits; misses allow immediate retry.
- Click/hold adds energy, energy drains over time, and full energy ramps max die value by +1 for the next resolution.

## Implementation Notes

- Use ES modules (`type="module"`).
- Keep shared utilities in `shared.js` to avoid circular dependencies.
- Keep gameplay constants named at the top of each file.
- Homepage is self-contained inline CSS and font-loading script (no module imports/canvas).
- Font-loading hide rules must be JS-gated (`.js.fonts-loading`) so no-JS visits still render content.
