# Agents Guide

**Keep this file up to date.** When you change behavior, constants, or architecture, update the relevant section here. This is the source of truth for how the codebase works.

## File Structure

```
index.html          # Gallery landing page (minimal, lists all fidgets/games)
404.html            # Not found page (GitHub Pages serves this for missing URLs)
one/
  index.html        # Dice fidget toy
assets/
  app.js            # Dice fidget: main logic, state, event handlers
  shared.js         # Shared utilities (announce function)
  particles.js      # Dice fidget: canvas-based glitch particle effects
  loot.js           # Dice fidget: loot tier logic and drop spawning
  physics.js        # Dice fidget: Rapier WASM physics for loot cubes
  styles.css        # Dice fidget: styles, CSS custom properties, animations
  fonts/            # Self-hosted Outfit font (woff2)
```

## Routing

Static file routing via directory structure (no client-side router). Each page is a standalone HTML file:

- `/` → `index.html` (gallery)
- `/one` → `one/index.html` (dice fidget)
- `/*` (not found) → `404.html` (GitHub Pages serves this automatically)

Future pages follow the same pattern: `/two/index.html`, etc. Each subpage (including 404) includes a back arrow nav linking to `/`.

## Development

Static site with no build step. Use a local server for proper routing:

```bash
python3 -m http.server 8000
```

Then visit `localhost:8000` for the gallery, `localhost:8000/one` for the dice fidget.

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

### Gallery Page

The landing page (`index.html`) is intentionally minimal:

- **No hover effects** — Mobile and desktop experiences should be identical. Hover states create divergence.
- **Self-contained styles** — Inline `<style>` block, doesn't load `styles.css`. Uses CSS variables for accent color consistency.
- **Section structure** — Each category (fidgets, games, etc.) is a `<section>` with a header. Header uses flexbox with `::before`/`::after` pseudo-elements for the line decoration.
- **Giant links** — Game links use fixed `11rem` bold text.
- **Tight header spacing** — Headers use negative margin (`-1.5rem`) to tuck close to the giant link text below.

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

### Color Palette

Warm charcoal + soft teal theme, designed for high contrast readability while being easy on the eyes:

**Core neutrals:**
- `--void`: `#080607` (warm near-black background)
- `--surface`: `#141113` (warm charcoal for panels)

**Text hierarchy:**
- `--text`: `#EDE7E1` (warm off-white, primary)
- `--text-dim`: `#C7BDB4` (secondary text)
- `--text-muted`: `#8E857D` (tertiary/disabled)

**Brand accents:**
- `--accent`: `#67D6C2` (soft teal-mint)
- `--accent-glow`: `#9FF0E2` (light teal for glows)
- `--accent-dim`: `#1F3D37` (dark teal for borders/subtle UI)
- `--secondary`: `#B58CFF` (amethyst)
- `--secondary-glow`: `#D7C2FF` (light amethyst for glows)

**Status:**
- `--danger`: `#E45B5B` (muted coral-red)

**Loot tiers (tier 1 = best, tier 7 = trash):**
1. `#F5C66A` (soft gold)
2. `#B58CFF` (amethyst)
3. `#5FA8FF` (azure)
4. `#62D49A` (mint)
5. `#A7B0BA` (silver)
6. `#B88B5A` (bronze)
7. `#4E4A46` (ash)

### CSS Architecture

- Theme tokens are in `:root` at the top of `styles.css`
- Use existing CSS custom properties (e.g., `--accent`, `--accent-glow`, `--secondary`, `--transition-smooth`)
- Mobile breakpoint is 480px
- Energy bar level controlled via `--energy-level` custom property
- Sliding indicator position controlled via `--indicator-left` and `--indicator-width`
- `.site-nav` provides back arrow navigation for subpages (fixed top-left)

### JavaScript Patterns

- Uses ES modules (`import`/`export`) with `type="module"` on the script tag
- Shared utilities live in `shared.js` to avoid circular dependencies
- State variables are declared at module level with descriptive names
- Core functions: `selectDie()`, `updateDieShape()`, `addEnergy()`, `startEnergyDrain()`, `finishRoll()`
- Energy system: Click/hold adds energy, die rolls continuously while energy > 0, drains faster on release
- Drag-to-select: Users can drag across dice buttons to change selection
- Uses `requestAnimationFrame` for smooth energy drain animation
- Magic numbers should be named constants at the top of each file for easy tuning

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

### Energy System

The energy bar is rendered as a CSS pseudo-element on `.dice-selection`, sized via `--energy-level` (0-1). Energy mechanics:

- **Charging:** Each click/tap adds `ENERGY_PER_CLICK_MS` (450ms). Holding continues adding energy every 500ms.
- **Draining:** Energy drains continuously via `requestAnimationFrame`. Slow drain while holding (`HOLD_DRAIN_RATE`), fast drain on release (`RELEASE_DRAIN_RATE`).
- **Ramp:** When energy reaches `MAX_ENERGY_MS` (2000ms), the die "ramps" to +1 max (d6→d7). Visual feedback includes sparkle particles and `.ramped` class. State tracked via `rampedMax`.
- **Loot:** Rolling while ramped triggers loot resolution. A result > normal max = hit (loot drops), otherwise = miss (consolation drop).

### Particle System

- `particles.js` handles glitch burst effects for ramp activation and loot hits
- Effect uses consistent intensity across all dice via `PARTICLE_MAGNITUDE` config
- Canvas-based renderer with pixel fragments, scanlines, and RGB color splits
- `spawnParticles(x, y)` for explosions, `spawnSparkles(x, y)` for ramp ambient effect
- Spawned from the selected die button's position, not the die shape
- **Object pooling**: Particles and scanlines are recycled via `acquireParticle()`/`releaseParticle()` to minimize GC pressure
- **Swap-and-pop removal**: Dead particles are removed in O(1) instead of O(n) splice operations
- **Resize debounce**: 100ms debounce on window resize to prevent excessive recalculation

### Loot System

- `loot.js` determines loot tier from die size, then spawns physics cubes via `physics.js`
- `physics.js` runs Rapier WASM simulation - cubes fall and stack up infinitely on the floor
- Cubes can be pulsed/scattered by clicking anywhere on screen
- `spawnLoot(dieSize, rollResult, originX, originY)` - rollResult determines drop count

### Physics System

- `physics.js` contains all physics constants at the top of the file for easy tuning
- **Resize debounce**: 100ms debounce on window resize to prevent jank
- **Impact marks**: Capped at `MAX_IMPACTS` (50) to prevent unbounded array growth
- **Named constants**: All magic numbers are named constants (e.g., `PULSE_BASE_STRENGTH`, `FLOOR_BOOST_STRENGTH`, `BOUNCE_DAMPING`)
- **Delta capping**: Physics step capped at `DELTA_CAP_MS` (50ms) to handle tab backgrounding gracefully

### Shared Utilities

- `shared.js` contains utilities shared across modules
- `announce(message)` - Screen reader announcements via the #announcements element
- Initialize with `initShared()` from `app.js` before other modules

### Accessibility

- ARIA labels on die buttons update dynamically during ramped state (e.g., "5-sided die" when d4 is ramped)
- Screen reader announcements via `aria-live="polite"` region
- Focus-visible outlines for keyboard navigation
- High contrast mode support via `prefers-contrast: high` media query
