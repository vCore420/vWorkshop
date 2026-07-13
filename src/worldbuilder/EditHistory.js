/**
 * EditHistory
 * -------------
 * "Continue improving editing history. Support undo, redo, history
 * inspection... the Builder should give players confidence to
 * experiment." A small, generic command stack — every mutating Build
 * Mode action (place, move, delete, duplicate, recolour, group, ungroup,
 * align) pushes one `{label, undo, redo}` entry rather than
 * `BuildModeSystem.js` maintaining its own bespoke "what changed" record
 * per action type. `undo`/`redo` are both plain closures that already
 * know everything they need to reverse or reapply themselves — this
 * class never inspects *what* changed, only *when* to call which
 * closure, the same "generic, reusable mechanism, not a per-feature
 * special case" instinct every other Workshop registry already follows.
 *
 * **Bounded, not infinite.** `MAX_ENTRIES` caps how far back undo can
 * reach — a long creative session doing hundreds of small edits doesn't
 * need every single one kept forever in memory; the oldest entries are
 * simply dropped once the cap is reached, silently, the same way a
 * browser's own back button eventually forgets very old history.
 *
 * **Pushing a new entry clears any redo stack past it** — the ordinary,
 * expected behaviour of undo/redo in any editor: once you've undone
 * something and then done something *different*, the old "future" you
 * undid away from is gone, not a branching timeline.
 */
const MAX_ENTRIES = 100;

export class EditHistory {
  constructor() {
    /** @type {Array<{label:string, undo:Function, redo:Function}>} */
    this._undoStack = [];
    /** @type {Array<{label:string, undo:Function, redo:Function}>} */
    this._redoStack = [];
  }

  /** Called once, immediately after an action already happened — `entry`
   *  describes how to reverse it (`undo`) and how to reapply it exactly
   *  the same way (`redo`), not how to perform it in the first place;
   *  the action itself has already run by the time this is called. */
  push(entry) {
    this._undoStack.push(entry);
    if (this._undoStack.length > MAX_ENTRIES) this._undoStack.shift();
    this._redoStack = [];
  }

  canUndo() {
    return this._undoStack.length > 0;
  }

  canRedo() {
    return this._redoStack.length > 0;
  }

  /** Returns the label of what was just undone (for a status message),
   *  or `null` if there was nothing to undo. */
  undo() {
    const entry = this._undoStack.pop();
    if (!entry) return null;
    entry.undo();
    this._redoStack.push(entry);
    return entry.label;
  }

  redo() {
    const entry = this._redoStack.pop();
    if (!entry) return null;
    entry.redo();
    this._undoStack.push(entry);
    return entry.label;
  }

  /** "History inspection" — the most recent entries first, newest at
   *  index 0, purely for a status display; nothing about undo/redo
   *  itself reads this. */
  recentLabels(count = 5) {
    return this._undoStack.slice(-count).reverse().map((e) => e.label);
  }

  clear() {
    this._undoStack = [];
    this._redoStack = [];
  }
}
