# Codebase Conventions

## CSS / Layout

- Text should **never wrap**. All text is single-line by design. `white-space: nowrap` and truncation with `text-overflow: ellipsis` are intentional. Do not suggest multi-line alternatives like `-webkit-line-clamp` or removing `nowrap`.

## Mandatory Validation

- For every code change, run `bun run check` before finalizing.
- If `bun run check` reports formatter output, apply those exact formatting updates.
- Do not stop at partial fixes: return only after `bun run check` passes cleanly (unless the user explicitly says otherwise).
