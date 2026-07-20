/**
 * domSafety
 * ---------
 * Version 3 wrap-up cleanup — `escapeHtml()` had been independently
 * reimplemented in nine different internal files (a regex chain in most
 * of them, missing quote-escaping in all but one, and one file even had
 * two differently-behaved copies of its own), rather than reused from a
 * single place the way `TimeFormat.formatClockTime()` already models for
 * this codebase's other shared-logic helpers.
 *
 * Two of those nine used a DOM-based approach instead (building a
 * detached element and reading back its own serialized `innerHTML`) —
 * tempting, since it needs no hand-maintained character list, but
 * verified (live, this pass) to *not* actually escape `"`/`'`: browsers
 * only entity-encode quotes inside an attribute *value* string, never
 * inside ordinary element text, and `innerHTML` always serializes as the
 * latter. At least one real call site (`WorkshopPages.js`'s search page,
 * `value="${escapeHtml(initialQuery)}"`) drops the result straight into
 * an attribute value, where an unescaped `"` breaks out of it — so the
 * DOM approach was quietly wrong for exactly the case that matters most.
 * This explicit five-character regex escape is correct in both an
 * attribute-value and a plain-text context, which is the contract a
 * function named `escapeHtml` should honestly promise.
 *
 * The two reference plugins under `src/plugins/examples/` keep their own
 * small private copies deliberately — a real third-party plugin, unlike
 * these examples, has no `src/utils/` to import from at all, so those two
 * are left self-contained on purpose, matching the real constraint
 * they're demonstrating.
 */
export function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
