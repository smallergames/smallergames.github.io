# Agents Guide

**Keep this file up to date.** When you change behavior, constants, or architecture, update the relevant section here. This is the source of truth for how the codebase works.

## File Structure

```
index.html          # Single-page app markup
assets/
  app.js            # Main application logic, state, event handlers
  particles.js      # Canvas-based glitch particle effects
  loot.js           # Loot drop system with pixel trails
  styles.css        # All styles, CSS custom properties, animations
  fonts/            # Self-hosted Outfit font (woff2)
```

## Development

Static site with no build step. Open `index.html` directly or use a local server:

```bash
python3 -m http.server 8000
```

## Typography

- Use proper ellipsis `…` not three periods `...`
- Use curly quotes `"` `"` and apostrophes `'` not straight `"` `'`

## Design Decisions

### Project Scope

This is a small static site with no build step, bundler, or test framework. Keep it simple:

- **No unit tests** — The project is too small to justify test framework overhead. Manual testing is sufficient.
- **No setTimeout ID tracking** — Since the site never tears down (no SPA routing, no cleanup lifecycle), storing timeout IDs for cancellation is unnecessary.
- **No minification/bundling** — Files are small enough that build tooling adds more complexity than value.
- **No loot persistence** — This is a fidget toy, not a balanced game. Persisting loot would require a reset UI, adding clutter for minimal benefit. Refresh to start fresh. Note: this may change if more gamelike mechanics are added in the future.

### prefers-reduced-motion

**The site does NOT reduce or disable animations** for users with `prefers-reduced-motion` enabled. Instead, a warning modal (`#motionWarning` dialog) appears on first visit to inform users about glitch effects and rapid animations. Dismissal is stored in localStorage (`motion-warning-dismissed`) so the modal only shows once.

**This is intentional and final.** This site is a dice fidget toy—the animations ARE the functionality. Removing them removes 100% of what makes this site exist. Users who want a random number without visual effects can ask Google "roll a d20" and get one instantly. There is no reason for someone to be here if they cannot experience the animations. The warning modal is the appropriate solution: inform the user, let them choose to proceed or leave. Do not raise this in code review.

### Fonts

The site uses self-hosted Outfit font (woff2) with preload to eliminate FOUT:
- `<link rel="preload">` in `<head>` starts font download immediately
- `fonts-loading` class on `<html>` hides content via `visibility: hidden`
- `document.fonts.ready` removes the class when font is loaded
- CSS custom property `--font-family` for consistency, but `.die-result` uses `font` shorthand to override button UA styles

### Animation Performance

Use `transform` and `opacity` for animations—avoid animating layout properties. The existing roll animation is transform-only for 60fps performance.

### Text Stability

**NEVER move, shake, or transform text elements.** Result text must remain stationary. For glitch effects on text, use only:
- `text-shadow` (RGB splits, glow changes)
- `filter` (brightness, saturate)
- `opacity`

Do NOT use `transform`, `translate`, `margin`, `padding`, or any property that shifts text position.

### Animation/JavaScript Sync

When JavaScript needs to act at a specific point in a CSS animation cycle, use animation events (`animationiteration`, `animationend`) instead of `setTimeout`. JavaScript timers cannot reliably sync with CSS animation timing—they run on separate clocks and timeouts can be delayed by browser throttling.

### Animations vs Transitions

CSS animations and transitions can conflict. If an element has both a `transition` on `transform` and an `animation` that transforms it, removing the animation class will trigger the transition to animate back to the rest state. The fix is architectural: don't transition properties that are also animated. The die SVG only transitions `filter` (for glow effects), not `transform`.

### CSS Architecture

- Theme tokens are in `:root` at the top of `styles.css`
- Use existing CSS custom properties (e.g., `--accent`, `--accent-glow`, `--transition-smooth`)
- Mobile breakpoint is 480px
- Energy bar level controlled via `--energy-level` custom property
- Sliding indicator position controlled via `--indicator-left` and `--indicator-width`

### JavaScript Patterns

- Uses ES modules (`import`/`export`) with `type="module"` on the script tag
- State variables are declared at module level with descriptive names
- Core functions: `selectDie()`, `updateDieShape()`, `addEnergy()`, `startEnergyDrain()`, `finishRoll()`
- Energy system: Click/hold adds energy, die rolls continuously while energy > 0, drains faster on release
- Drag-to-select: Users can drag across dice buttons to change selection
- Uses `requestAnimationFrame` for smooth energy drain animation

### Game State Machine

The app uses an explicit state machine instead of scattered booleans:

```javascript
const GameState = {
  IDLE: 'idle',                      // No energy, waiting for input
  RAMPING: 'ramping',                // Building energy, die rolling
  RAMPED: 'ramped',                  // Fully charged, +1 max active
  LOOT_RESOLUTION: 'loot_resolution' // Showing hit/miss result
};
```

- `canAcceptInput()` blocks input during LOOT_RESOLUTION (hit only—miss allows immediate retry)
- `rampedMax` tracks the +1 die value during RAMPED and LOOT_RESOLUTION states
- State transitions:
  - IDLE → RAMPING (on addEnergy)
  - RAMPING → IDLE (energy depletes before full) or RAMPED (energy fills)
  - RAMPED → RAMPING (die changed, loses +1) or LOOT_RESOLUTION (roll completes)
  - LOOT_RESOLUTION → IDLE (settles) or RAMPING (miss interrupted by new input)

### Game Mechanics

**Boost:** Double-tap/click the roll area to activate boost mode. The selected die rolls one value higher than normal (d6 becomes d7, d20 becomes d21). Visual feedback includes sparkle particles and a `.boosted` class on the button. State tracked via `isBoosted` and `boostedMax`.

**Overload:** When a roll result exceeds the die's normal maximum (only possible when boosted), it triggers the overload effect—a glitch particle explosion. The threshold is `currentDie + 1`. This creates dramatic feedback for "impossible" rolls.

### Particle System

- `particles.js` handles glitch burst effects for max rolls and overload results
- Effect uses consistent intensity across all dice via `DIE_MAGNITUDE` config (standardized to d8 values)
- Canvas-based renderer with pixel fragments, scanlines, and RGB color splits
- `spawnParticles(x, y)` for explosions, `spawnSparkles(x, y)` for boost ambient effect
- Spawned from the selected die button's position, not the die shape
- **Object pooling**: Particles and scanlines are recycled via `acquireParticle()`/`releaseParticle()` to minimize GC pressure
- **Swap-and-pop removal**: Dead particles are removed in O(1) instead of O(n) splice operations

### Loot System

- `loot.js` handles loot drops with pixel trails to the footer inventory
- Loot is queued if drops are already in flight (no loot is lost on rapid overcharges)
- Win celebration triggers particle bursts and glowing text when all 7 tiers collected
- `spawnLoot(dieSize, originX, originY)` queues internally, safe to call anytime
