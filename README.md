# smallergames.com

A simple dice roller for tabletop gaming, hosted on GitHub Pages.

## Structure

```
├── index.html              # Page structure
├── assets/
│   ├── styles.css          # All styling
│   ├── app.js              # Dice logic and interactions
│   └── fonts/
│       ├── Cinzel-Bold.woff2
│       └── Spectral-Italic.woff2
├── CNAME                   # Custom domain config
└── README.md
```

## How It Works

1. User selects a die type (d4, d6, d8, d10, d12, d20, d100)
2. Clicking the die or pressing Space/Enter triggers a roll
3. The die shape rotates during the roll animation
4. Result appears with a scale-in animation

## Development

No build step required. Open `index.html` in a browser or use a local server:

```bash
python3 -m http.server 8000
```

## Notes

### On prefers-reduced-motion

This site intentionally does not disable animations based on `prefers-reduced-motion`. The roll animation provides essential feedback that the action occurred. Many mobile users have OS-level "reduce motion" enabled to disable bouncy UI chrome (parallax, zoom transitions), not to remove all animation. Automatically stripping the roll animation would degrade the experience for these users.

### Fonts

Fonts are base64-embedded in `styles.css` to prevent FOUT (flash of unstyled text). The CSS blocks render until parsed, so fonts are ready before first paint. The `.woff2` files in `assets/fonts/` are kept as source files but not referenced at runtime.
