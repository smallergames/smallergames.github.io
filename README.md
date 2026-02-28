# smallergames.com

This repo has two independent surfaces:

- `/` home page: React + TypeScript + Framer Motion (source in `src/`)
- `/one` artifact: frozen static experience (source in `public/one` + `public/assets`)

`/one` has no direct links from the home page.

## Key Paths

- `src/` - home page application
- `public/one/` - artifact HTML
- `public/assets/` - artifact runtime JS/CSS/fonts
- `scripts/verify-one-artifact.mjs` - guardrail checks for `/one`

## Quick Start

```bash
bun install
bun run dev
```

## Validation

- `bun run check` - typecheck + lint
- `bun run build` - production build to `dist/`
- `bun run verify:one` - validate required `/one` files/references

## Maintenance And Deploy

- `/one` ownership boundaries, preservation rules, and cleanup workflow live in `docs/maintenance.md`.
- GitHub Pages deploy config lives in `.github/workflows/deploy.yml` and publishes `dist/`.
