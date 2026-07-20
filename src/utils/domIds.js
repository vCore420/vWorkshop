/**
 * domIds
 * --------
 * Version 3, Phase 12 ("Accessibility & Comfort Pass") — a real `id` is
 * the one thing an unassociated `<label>`/`<input>` sibling pair needs to
 * become a genuinely associated one (`label.htmlFor = id; input.id =
 * id;`, the accessible-name mechanism a screen reader actually uses).
 * Several form-heavy apps (Settings, Wardrobe, AI Mission Control,
 * Builder, Being Creator, the Animation Editor) each build many rows
 * from small shared helper functions, called repeatedly with different
 * labels — one shared counter, not one reinvented per file, is what
 * keeps every generated id guaranteed-unique across a whole mounted app,
 * without deriving one from label text (which could collide between two
 * rows sharing a label, or contain characters an `id` shouldn't).
 */
let counter = 0;

export function nextDomId(prefix = "field") {
  counter += 1;
  return `${prefix}-${counter}`;
}
