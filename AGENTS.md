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

Fonts are base64-embedded in `styles.css` to prevent FOUT. Do not add external font references—the `.woff2` files in `assets/fonts/` are source files only.
