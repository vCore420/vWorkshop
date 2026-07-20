/**
 * createCloseButton
 * -------------------
 * Version 3, Phase 12 ("Accessibility & Comfort Pass") — the Esc/close
 * button was two separate, independently-authored implementations
 * (`OverlayManager.js`'s own `.overlay-close`, `PhoneUI.js`'s own
 * `.workshop-phone-close-button`) that had quietly drifted: the overlay
 * one carried a real `aria-label`, the Phone one only a `title` (a
 * weaker, less reliable accessible name). One shared function now
 * defines the *behavior contract* — a real `<button>`, always labelled
 * for assistive tech, always wired to its own click handler — so a
 * future third close button can't silently ship without one or the
 * other again. Visual styling stays per-surface (`className`), passed
 * in rather than hardcoded here: an overlay floating over the 3D scene
 * and the Phone's own header (sitting beside its matching Home button)
 * genuinely need different treatments, and forcing one visual style
 * onto both would make the Phone's header look mismatched with itself.
 *
 * Wave 3 ("full ARIA-label sweep") added the optional `ariaLabel`
 * override — a bare "Close" is ambiguous when several close buttons of
 * the same kind sit in one list (the Browser's own per-tab close button,
 * disambiguated as "Close ${tab.title}"). Every existing call site keeps
 * its plain "Close" by simply not passing one.
 */
export function createCloseButton({ className, label, onClick, ariaLabel = "Close" }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.textContent = label;
  btn.title = ariaLabel;
  btn.setAttribute("aria-label", ariaLabel);
  btn.addEventListener("click", onClick);
  return btn;
}
