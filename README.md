# smallergames.com

A simple dice roller for tabletop gaming, hosted on GitHub Pages.

## Structure

```
├── index.html              # Page structure
├── assets/
│   ├── styles.css          # All styling
│   ├── app.js              # Dice logic and interactions
│   └── fonts/              # Self-hosted web fonts
├── AGENTS.md               # Development guidelines for AI assistants
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

This site does not support `prefers-reduced-motion`.

### Fonts

The site uses self-hosted Outfit font with `<link rel="preload">` and a `fonts-loading` class that hides content until the font is ready. This guarantees no FOUT (Flash of Unstyled Text).
