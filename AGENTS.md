# Agents Guide

**Keep this file up to date.** When you change behavior, constants, or architecture, update the relevant section here. This is the source of truth for how the codebase works.

## File Structure

```
index.html          # Single-page app markup
assets/
  app.js            # Main application logic, state, event handlers
  particles.js      # Canvas-based glitch particle effects
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

### prefers-reduced-motion

**Do NOT add `prefers-reduced-motion` handling to this site.** We don't support it.

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
  IDLE: 'idle',       // Waiting for input, can roll
  ROLLING: 'rolling', // Die is spinning, draining energy
  SETTLING: 'settling' // Overcharged effect playing, input blocked
};
```

- `canAcceptInput()` returns `true` when `gameState !== GameState.SETTLING`
- Use `canAcceptInput()` in input handlers to block interaction during settling
- `isBoosted` is **separate** from GameState—it tracks the +1 max mechanic, not UI blocking
- State transitions: IDLE → ROLLING (on addEnergy) → IDLE (normal roll) or SETTLING (overcharged) → IDLE

### Game Mechanics

**Boost:** Double-tap/click the roll area to activate boost mode. The selected die rolls one value higher than normal (d6 becomes d7, d20 becomes d21). Visual feedback includes sparkle particles and a `.boosted` class on the button. State tracked via `isBoosted` and `boostedMax`.

**Overload:** When a roll result exceeds the die's normal maximum (only possible when boosted), it triggers the overload effect—a glitch particle explosion. The threshold is `currentDie + 1`. This creates dramatic feedback for "impossible" rolls.

### Particle System

- `particles.js` handles glitch burst effects for max rolls and overload results
- Effect uses consistent intensity across all dice via `DIE_MAGNITUDE` config (standardized to d8 values)
- Canvas-based renderer with pixel fragments, scanlines, and RGB color splits
- `spawnParticles(x, y, dieSize)` for explosions, `spawnSparkles(x, y)` for boost ambient effect
- Spawned from the selected die button's position, not the die shape
- **Object pooling**: Particles and scanlines are recycled via `acquireParticle()`/`releaseParticle()` to minimize GC pressure
- **Swap-and-pop removal**: Dead particles are removed in O(1) instead of O(n) splice operations

### Loot System

- `loot.js` handles loot drops with pixel trails to the footer inventory
- Loot is queued if drops are already in flight (no loot is lost on rapid overcharges)
- Win celebration triggers particle bursts and glowing text when all 7 tiers collected
- `spawnLoot(dieSize, originX, originY)` queues internally, safe to call anytime
