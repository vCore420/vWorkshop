/**
 * createIconButton
 * -----------------
 * Version 3 wrap-up cleanup — the exact drift `closeButton.js`'s own top
 * comment already named and fixed for the Esc/close button (Phase 12) had
 * quietly happened again: `BuilderApp.js` and `BeingCreatorApp.js` each
 * independently wrote their own `iconButton()`, both setting only `title`
 * (a weak, unreliable accessible name) with no `aria-label`, and
 * `PlaybackBar.js` wrote a third, separately-shaped one. This is one
 * shared function, always setting both `title` (the visual hover tooltip)
 * and `aria-label` (the real accessible name), matching `closeButton.js`'s
 * own precedent exactly. `className` stays per-surface, same reasoning as
 * `closeButton.js`: an inline part-list icon and a music transport button
 * genuinely want different visual treatments.
 *
 * `onClick` is optional — `PlaybackBar.js` creates its five buttons before
 * it has anything to wire them to, then attaches each listener separately
 * once the rest of its own state exists; forcing a handler at creation
 * time would have meant a bigger, unrelated rewrite of that file just to
 * satisfy this one's own signature. `stopPropagation` stays a real,
 * explicit per-call choice too — `BuilderApp.js`'s own icon buttons sit
 * inside a clickable part row and genuinely need it; `BeingCreatorApp.js`'s
 * don't, and the difference was worth preserving rather than silently
 * picking one for both.
 */
export function createIconButton({ className, glyph, label, onClick, stopPropagation = false }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.textContent = glyph;
  btn.title = label;
  btn.setAttribute("aria-label", label);
  if (onClick) {
    btn.addEventListener("click", stopPropagation ? (e) => { e.stopPropagation(); onClick(e); } : onClick);
  }
  return btn;
}
