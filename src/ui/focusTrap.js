/**
 * focusTrap
 * -----------
 * Version 3, Phase 12 ("Accessibility & Comfort Pass") — "systems should
 * have the opportunity to continue naturally" applied to keyboard focus:
 * before this, opening any of the Workshop's three modal-ish 2D surfaces
 * (an `OverlayManager` panel, the Phone, the computer's own
 * `WorkstationPanel`) never moved focus in, never kept Tab inside it, and
 * never gave it back on close — a keyboard-only person could Tab straight
 * through to whatever was behind it, or lose their place entirely once it
 * closed. One small, shared helper rather than three independently
 * reinvented ones, matching this project's own "one implementation,
 * several doors in" habit.
 *
 * `createFocusTrap(containerEl)` returns `{ activate, deactivate }`:
 *   - `activate()` remembers whichever element currently has focus (to
 *     restore later), moves focus to the first focusable descendant of
 *     `containerEl` (or the container itself, given a `tabindex="-1"` for
 *     exactly this case, if it has none), and keeps Tab/Shift+Tab cycling
 *     within that same set for as long as the trap stays active.
 *   - `deactivate()` releases the Tab-cycling and restores focus to
 *     whatever `activate()` remembered, if it's still around to receive
 *     it — the same "return exactly where you were" behaviour closing a
 *     native `<dialog>` already gives you for free.
 *
 * Safe to call `activate()`/`deactivate()` more than once in a row; a
 * caller with its own multi-step close sequence (see `WorkstationPanel`'s
 * `setInteractive()` vs `close()`) doesn't need to track this itself.
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function createFocusTrap(containerEl) {
  let active = false;
  let previouslyFocused = null;
  let onKeyDown = null;

  function focusableElements() {
    return [...containerEl.querySelectorAll(FOCUSABLE_SELECTOR)].filter((el) => el.offsetParent !== null);
  }

  function activate() {
    if (active) return;
    active = true;
    previouslyFocused = document.activeElement;

    if (!containerEl.hasAttribute("tabindex")) containerEl.tabIndex = -1;
    const first = focusableElements()[0] ?? containerEl;
    first.focus?.({ preventScroll: true });

    onKeyDown = (e) => {
      if (e.key !== "Tab") return;
      const items = focusableElements();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    containerEl.addEventListener("keydown", onKeyDown);
  }

  function deactivate() {
    if (!active) return;
    active = false;
    containerEl.removeEventListener("keydown", onKeyDown);
    onKeyDown = null;
    if (previouslyFocused?.isConnected && typeof previouslyFocused.focus === "function") {
      previouslyFocused.focus({ preventScroll: true });
    }
    previouslyFocused = null;
  }

  return { activate, deactivate };
}
