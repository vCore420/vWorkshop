/**
 * ExpressionTypes
 * -----------------
 * Workshop Personality phase — "introduce a shared resident expression
 * system... future expressions should naturally be supported." The one
 * canonical list of every expression the Workshop currently knows about
 * — id, a human-readable label for the Expression Creator's own UI, and
 * a short description of when it's actually used. Everything else that
 * needs to know "what expressions exist" reads from here rather than
 * keeping its own parallel list: `ResidentBehaviour.EXPRESSIONS` (the
 * plain-id array the mood/emotion system already used before this
 * phase) now derives from it, and `ExpressionSetStore.js`/the
 * Expression Creator UI use it directly for their own labelled
 * controls.
 *
 * Adding a ninth expression later is exactly one new entry here —
 * `ResidentRenderer._drawProceduralFace()` would still need a real
 * built-in drawing added for it (there's no way to *generate* a
 * reasonable default face automatically), but every list, dropdown, and
 * validation check that reads this file already handles it.
 */
export const EXPRESSION_TYPES = [
  { id: "neutral", label: "Neutral", description: "The default resting expression — calm, unhurried, not any particular mood." },
  { id: "happy", label: "Happy", description: "A settled, genuine pleasure — the resting mood when something's gone well." },
  { id: "curious", label: "Curious", description: "Drawn to something nearby — a resting mood, or a brief reaction to something new." },
  { id: "thinking", label: "Thinking", description: "Turned inward, waiting on something — shown automatically while a real AI reply is loading." },
  { id: "sleeping", label: "Sleeping", description: "Shown automatically while the resident is offline/asleep — always overrides everything else." },
  { id: "excited", label: "Excited", description: "Bright, high-energy joy — a resting mood, more likely when a resident's own Playfulness and Energy are both tuned high." },
  { id: "sad", label: "Sad", description: "A subdued, downcast look. Available to draw and preview; no automatic behavioural trigger yet — see docs/RESIDENT.md's own \"Known simplifications.\"" },
  { id: "surprised", label: "Surprised", description: "A brief, wide-eyed reaction. Available to draw and preview; no automatic behavioural trigger yet — see docs/RESIDENT.md's own \"Known simplifications.\"" },
];

/** The Expression Creator's own pixel canvas is a square grid this many
 *  cells on a side — small enough to draw by hand in a few minutes,
 *  detailed enough to read as a face at the size a resident's own face
 *  actually renders at (`ResidentRenderer.js`'s `FACE_TEXTURE_SIZE`,
 *  128px — an 8px cell per pixel at this grid size). */
export const EXPRESSION_GRID_SIZE = 16;

/** Lookup by id — a convenience export with no external caller today
 *  (v2.2.3d review checked directly); `isValidExpression()` below is what
 *  callers have actually wanted so far. Kept as the natural companion
 *  accessor, not because anything currently imports it. */
export function getExpressionType(id) {
  return EXPRESSION_TYPES.find((e) => e.id === id) ?? null;
}

export function isValidExpression(id) {
  return EXPRESSION_TYPES.some((e) => e.id === id);
}
