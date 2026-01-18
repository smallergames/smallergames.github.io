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

Fonts are base64-embedded in `styles.css` to prevent FOUT. Do not add external font references.

### Animation Performance

Use `transform` and `opacity` for animations—avoid animating layout properties. The existing roll animation is transform-only for 60fps performance.

### CSS Architecture

- Theme tokens are in `:root` at the top of `styles.css`
- Use existing CSS custom properties (e.g., `--accent`, `--accent-glow`, `--transition-smooth`)
- Mobile breakpoint is 480px

### JavaScript Patterns

- State variables are declared at module level with descriptive names
- Functions are named clearly (`roll()`, `cancelRoll()`, `prepareOrbitalRings()`)
- Orbital ring animations use CSS custom properties controlled by JS for seamless freezing/resuming
