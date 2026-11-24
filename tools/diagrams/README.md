# Documentation diagrams

Source for the figures on the [documentation site](../../docs/index.html). Every PNG in
`docs/images` is generated from here, so a figure is reviewed as code and regenerated rather than
edited as a binary.

## Render

```bash
node tools/diagrams/render.mjs                  # all four diagrams, English and Spanish
node tools/diagrams/render.mjs data-flow        # just one
```

Output lands in `docs/images/<id>-<lang>.png` at 1280x720.

Requirements:

- Node 18 or later, for the built-in `fetch`.
- A Chrome or Chromium binary. The script looks in the usual places; set `CHROME_PATH` if yours is
  somewhere else.
- Network access on the first run only, to populate the font cache.

## Layout

| File | Holds |
| --- | --- |
| `theme.mjs` | Stage size, palette, CSS, and the card / panel / pill / arrow primitives |
| `diagrams.mjs` | Geometry for each diagram, and the English and Spanish strings |
| `render.mjs` | Font cache, HTML assembly, and the headless screenshot |
| `assets/` | Product marks, credited in [`docs/images/ATTRIBUTION.md`](../../docs/images/ATTRIBUTION.md) |
| `.cache/` | Downloaded fonts and the generated HTML. Gitignored. |

Geometry is shared between languages and only the strings change, so the English and Spanish
versions of a figure stay pixel-comparable. Coordinates are absolute on the 1280x720 stage.

## Adding a diagram

1. Write a builder in `diagrams.mjs` that returns `{ title, subtitle, caption, body, arrows }`.
2. Add its strings under both `STRINGS.en` and `STRINGS.es`.
3. Append an entry to `DIAGRAMS` with an `id`, the `key` into `STRINGS`, and the builder.
4. Run the renderer, then reference `docs/images/<id>-en.png` and `<id>-es.png` from the two pages.

Keep new marks in `assets/` and add a row to the attribution table in the same commit.
