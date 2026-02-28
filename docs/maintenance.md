# Maintenance Guide

This file is the canonical policy for `/one` preservation and release checks.

## Ownership boundaries

- Home page (`/`): `src/**`, `index.html`, `src/index.css`
- Artifact (`/one`): `public/one/**` and `public/assets/**`
- Shared static files: `public/CNAME`, `public/favicon.svg`, `public/apple-touch-icon.png`, `public/404.html`

## Preservation contract for `/one`

`/one` is an archival artifact. Keep homepage iteration from changing artifact behavior.

- Do not run broad formatting/refactor passes over `public/one/**` or `public/assets/**`.
- Keep artifact file names stable, especially `public/assets/app.js` and `public/assets/styles.css`.
- If artifact changes are required, keep them explicit and review them separately from homepage work.

## Cleanup checklist

1. Keep homepage changes scoped to `src/**` when possible.
2. Run `bun run check`, `bun run build`, and `bun run verify:one`.
3. Verify `/one` resolves in dev (`/one`) and build output (`dist/one/index.html`).
4. In PR/review notes, call out whether `/one` files were touched.

## Why the verifier exists

`scripts/verify-one-artifact.mjs` catches two common regressions:

- Missing artifact files after cleanup/restructure.
- Broken references in `public/one/index.html` (and in `dist/one/index.html` once built).
