# smallergames.com

This repo contains two independent surfaces:

- `/` home page: React + TypeScript + Framer Motion (source in `src/`)
- `/one` artifact: frozen static experience (source in `public/one` + `public/assets`)

`/one` has no direct links from the home page and should remain stable while the rest of the site evolves.

## Project layout

- `src/` - home page application
- `public/one/` - artifact entrypoint HTML
- `public/assets/` - artifact runtime JS/CSS/fonts
- `public/404.html` - static 404 page
- `scripts/verify-one-artifact.mjs` - guardrail checks for `/one`

## Commands

```bash
bun install
bun run dev
bun run check
bun run build
bun run verify:one
```

Command details:

- `bun run dev` - run local Vite dev server
- `bun run check` - typecheck + lint
- `bun run build` - production build to `dist/`
- `bun run verify:one` - verify required `/one` files/references in `public/` (and in `dist/` if present)

## `/one` maintenance policy

Treat `/one` as a preserved artifact.

- Avoid formatting or refactoring files under `public/one/**` and `public/assets/**` unless there is an explicit artifact fix.
- Homepage work should happen in `src/**`.
- Run `bun run verify:one` before merge when touching build/deploy config.

See `docs/maintenance.md` for ownership boundaries and cleanup workflow.

## Deploy

GitHub Pages deployment is defined in `.github/workflows/deploy.yml` and publishes the generated `dist/` directory.
