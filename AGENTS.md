# Codebase Conventions

## CSS / Layout

- Text should **never wrap**. All text is single-line by design. `white-space: nowrap` and truncation with `text-overflow: ellipsis` are intentional. Do not suggest multi-line alternatives like `-webkit-line-clamp` or removing `nowrap`.
