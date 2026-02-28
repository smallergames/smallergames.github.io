# Maintenance Guide

## Ownership boundaries

- Home page (`/`): `src/**`, `index.html`, `src/index.css`
- Artifact (`/one`): `public/one/**` and `public/assets/**`
- Shared static files: `public/CNAME`, `public/favicon.svg`, `public/apple-touch-icon.png`, `public/404.html`

## Preservation contract for `/one`

`/one` is treated as an archival artifact. The goal is to avoid accidental breakage while iterating on the home page.

Rules:

- Do not run broad formatting/refactor passes over `public/one/**` or `public/assets/**`.
- Keep artifact file names stable, especially `public/assets/app.js` and `public/assets/styles.css`.
- If artifact changes are required, keep them explicit and review them separately from homepage work.

## Cleanup checklist

1. Keep homepage changes scoped to `src/**` when possible.
2. Run checks locally:
   - `bun run check`
   - `bun run build`
   - `bun run verify:one`
3. Verify `/one` still resolves in dev (`/one`) and build output (`dist/one/index.html`).
4. In PR/review notes, call out whether `/one` files were touched.

## Why the verifier exists

`scripts/verify-one-artifact.mjs` catches two common regressions:

- Missing artifact files after cleanup/restructure.
- Broken references in `public/one/index.html` (and in `dist/one/index.html` once built).
