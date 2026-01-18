# Agents Guide

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

**Do NOT add `prefers-reduced-motion` handling to this site.**

The roll animation provides essential feedback that the action occurred. Many mobile users have OS-level "reduce motion" enabled to disable bouncy UI chrome (parallax, zoom transitions), not to remove all animation. Stripping the roll animation would degrade the experience for these users.

### Fonts

The site uses `font-display: block` with `local()` sources for JetBrains Mono. If the user doesn't have the font installed, it falls back to SF Mono, Fira Code, Consolas, or system monospace.

### Animation Performance

Use `transform` and `opacity` for animations—avoid animating layout properties. The existing roll animation is transform-only for 60fps performance.

### CSS Architecture

- Theme tokens are in `:root` at the top of `styles.css`
- Use existing CSS custom properties (e.g., `--accent`, `--accent-glow`, `--transition-smooth`)
- Mobile breakpoint is 480px
- Energy bar level controlled via `--energy-level` custom property
- Sliding indicator position controlled via `--indicator-left` and `--indicator-width`

### JavaScript Patterns

- State variables are declared at module level with descriptive names
- Core functions: `selectDie()`, `updateDieShape()`, `addEnergy()`, `startEnergyDrain()`, `finishRoll()`
- Energy system: Click/hold adds energy, die rolls continuously while energy > 0, drains faster on release
- Drag-to-select: Users can drag across dice buttons to change selection
- Uses `requestAnimationFrame` for smooth energy drain animation
