# smallergames.com

A dice fidget toy with physics-based loot mechanics, hosted on GitHub Pages.

## Structure

```
├── index.html              # Single-page app markup
├── assets/
│   ├── app.js              # Main application logic, state machine, events
│   ├── particles.js        # Canvas glitch effects (pixel bursts, scanlines)
│   ├── loot.js             # Loot tier logic and drop spawning
│   ├── physics.js          # Rapier WASM physics for loot cubes
│   ├── styles.css          # Styling and animations
│   └── fonts/              # Self-hosted Outfit font (woff2)
├── AGENTS.md               # Development guidelines for AI assistants
├── CNAME                   # Custom domain config
└── README.md
```

## How It Works

1. Select a die type (d4, d6, d8, d10, d12, d20, d100)
2. Click/tap or hold to build energy - the die rolls continuously
3. Fill the energy bar to "ramp" the die (+1 to max)
4. Release while ramped to resolve - beat the normal max for loot
5. Loot cubes fall with physics, stack up, and can be scattered by clicking

## Development

No build step required. Open `index.html` in a browser or use a local server:

```bash
python3 -m http.server 8000
```

## Notes

### On prefers-reduced-motion

This site does not support `prefers-reduced-motion`.

### Fonts

The site uses self-hosted Outfit font with `<link rel="preload">` and a `fonts-loading` class that hides content until the font is ready. This guarantees no FOUT (Flash of Unstyled Text).
