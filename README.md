# smallergames.com

A collection of smaller weirder incremental games, hosted on GitHub Pages.

## Structure

```
├── index.html              # Gallery landing page
├── 404.html                # Not found page
├── one/
│   └── index.html          # Dice fidget toy
├── assets/
│   ├── app.js              # Dice fidget: logic, state machine, events
│   ├── particles.js        # Dice fidget: canvas glitch effects
│   ├── loot.js             # Dice fidget: loot tier logic
│   ├── physics.js          # Dice fidget: Rapier WASM physics
│   ├── styles.css          # Dice fidget: styling and animations
│   └── fonts/              # Self-hosted Outfit font (woff2)
├── AGENTS.md               # Development guidelines for AI assistants
├── CNAME                   # Custom domain config
└── README.md
```

## Development

No build step required. Use a local server:

```bash
python3 -m http.server 8000
```

Visit `localhost:8000` for the gallery, `localhost:8000/one` for the dice fidget.

## Games

### one (dice fidget)

1. Select a die type (d4, d6, d8, d10, d12, d20, d100)
2. Click/tap or hold to build energy - the die rolls continuously
3. Fill the energy bar to "ramp" the die (+1 to max)
4. Release while ramped to resolve - beat the normal max for loot
5. Loot cubes fall with physics, stack up, and can be scattered by clicking

## Notes

### On prefers-reduced-motion

The dice fidget does not support `prefers-reduced-motion`. A warning modal appears instead.

### Fonts

Self-hosted Outfit font with `<link rel="preload">` and a `fonts-loading` class that hides content until the font is ready.
