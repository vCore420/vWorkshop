/**
 * ProceduralIcons
 * -----------------
 * Version 3, Phase 10 ("Real Assets, Honestly Introduced") — every
 * Workshop-owned Phone/Computer app used a plain Unicode emoji as its
 * own `glyph` (`PhoneUI.js`/`WorkstationPanel.js`'s own render call
 * sites just set it as text). The icon *frame* around it already
 * carries real Workshop styling from an earlier phase; the pictogram
 * itself never did, and different platforms/fonts render the same
 * emoji differently — not really "real content" at all, just
 * whatever a browser's own emoji font happens to draw. These are small,
 * deliberately simple, hand-drawn line marks instead — one shared
 * visual language (`viewBox="0 0 24 24"`, `currentColor` stroke/fill),
 * generated as plain markup strings in code, the same "no binary
 * assets" standard every texture/sound in this project already holds
 * to (`assets/README.md`).
 *
 * **`glyph` keeps its existing name and meaning is extended, not
 * replaced.** A first-party app's own `glyph` field now names one of
 * the kinds below; `iconMarkup()` returns `null` for anything it
 * doesn't recognise, and both render call sites fall back to the
 * *original* "print `glyph` as literal text" behaviour in that case.
 * That fallback isn't dead code: `docs/PLUGIN_SDK.md`/`docs/PLUGIN_GUIDE.md`
 * both document `glyph` as "any character," and `workshopToolkitPlugin.js`
 * (a real, shipped example a plugin author might copy) deliberately
 * keeps using a literal emoji rather than one of this file's own
 * internal kind ids — an implementation detail of the Workshop's own
 * built-in apps, not part of the Plugin SDK's public contract. A
 * third-party plugin's own emoji `glyph` keeps working exactly as
 * documented, unaffected by any of this.
 */

const STROKE = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

function svg(inner, { filled = false } = {}) {
  const attrs = filled ? 'fill="currentColor" stroke="none"' : STROKE;
  return `<svg viewBox="0 0 24 24" width="1em" height="1em" ${attrs} aria-hidden="true">${inner}</svg>`;
}

const ICONS = {
  // A simple roofline over a base — the Workshop itself.
  workshop: svg(`<path d="M3 11 12 4l9 7"/><path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9"/><path d="M9 20v-6h6v6"/>`),
  // A coat hanger — hook, shoulders, bar.
  wardrobe: svg(`<circle cx="12" cy="4" r="1.3"/><path d="M12 5.3v1.8"/><path d="M3 17.5l9-6.2 9 6.2"/><path d="M4.5 20h15"/>`),
  // A gear — hub plus six radial ticks.
  settings: svg(`<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M21 12h-3M6 12H3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7 5.6 5.6"/>`),
  // A sparkle — gesture/expression.
  emotes: svg(`<path d="M12 3c.6 3.4 2.6 5.4 6 6-3.4.6-5.4 2.6-6 6-.6-3.4-2.6-5.4-6-6 3.4-.6 5.4-2.6 6-6z"/>`, { filled: true }),
  // A wrench — construction.
  builder: svg(`<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2z"/>`),
  // A speech bubble with a tail — the AI companion.
  bubble: svg(`<path d="M4 5.5h16v10H9.5L5 20v-4.5H4z"/>`),
  // A globe — meridians over a circle.
  browser: svg(`<circle cx="12" cy="12" r="8"/><path d="M4 12h16"/><path d="M12 4c3 3.2 3 12.8 0 16-3-3.2-3-12.8 0-16z"/>`),
  // A paw print — animals and other Beings.
  beings: svg(`<circle cx="12" cy="15" r="3.2"/><circle cx="7" cy="9" r="1.6"/><circle cx="12" cy="6.3" r="1.6"/><circle cx="17" cy="9" r="1.6"/>`),
  // A toolbox — a handle over a case.
  tools: svg(`<rect x="3" y="10" width="18" height="9" rx="1.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M3 14.5h18"/>`),
  // A clipboard — a tab over a ruled sheet.
  projects: svg(`<rect x="5" y="4" width="14" height="17" rx="1.5"/><rect x="9" y="2.5" width="6" height="3" rx="1"/><path d="M8 11h8M8 15h8"/>`),
  // A musical note — two heads, one beam.
  media: svg(`<path d="M9 18V5l10-2v13"/><circle cx="7" cy="18" r="2.2"/><circle cx="17" cy="16" r="2.2"/>`),
  // A ruled notebook.
  journal: svg(`<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 3v18"/><path d="M12 8h6M12 12h6M12 16h4"/>`),
  // A film frame — sprocket holes down both edges.
  animation: svg(`<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M7 5v14M17 5v14"/><path d="M3 9h4M3 15h4M17 9h4M17 15h4"/>`),
  // A second, distinct sparkle (an orbiting dot) — the AI Control app.
  ai: svg(`<path d="M11.5 3c.5 3.2 2.3 5 5.5 5.5-3.2.5-5 2.3-5.5 5.5-.5-3.2-2.3-5-5.5-5.5C9.2 8 11 6.2 11.5 3z"/><circle cx="18" cy="17.5" r="1.6"/>`, { filled: true }),
};

/** `kind` is a first-party app's own `glyph` value. Returns markup for a
 *  recognised kind, or `null` for anything else (a third-party plugin's
 *  own literal emoji, most commonly) — see this file's own header for
 *  why `null`, not a guessed icon, is the right answer there. Both
 *  render call sites (`PhoneUI.js`/`WorkstationPanel.js`) fall back to
 *  printing `glyph` as literal text on `null`, exactly the original
 *  "print whatever `glyph` was" behaviour — never a guessed icon in its
 *  place. */
export function iconMarkup(kind) {
  return ICONS[kind] ?? null;
}
