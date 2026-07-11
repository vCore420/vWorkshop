/**
 * createRestNookOverlay
 * ----------------------
 * The sitting area doesn't do much yet on purpose — it's a comfortable,
 * quiet corner reserved for something calmer later (a local AI companion
 * to sit and talk with). This overlay stays brief rather than padding
 * itself out with fake content.
 *
 * "Currently dismissing the introductory message removes the text but
 * leaves part of the screen darkened. After dismissing the message, the
 * screen should immediately return to normal." Root cause: every
 * `materialClass: "panel"` overlay's own outer `.overlay` element
 * (`OverlayManager.js`'s own wrapper, not `panelEl` this file is handed)
 * carries its own full-screen dark backdrop
 * (`.overlay--panel { background: rgba(10,8,6,0.7) }`) — a separate
 * element from `panelEl` entirely. Fading `panelEl` alone (an earlier
 * fix for this same overlay) correctly hid the reminder's own visible
 * card, but never touched that outer backdrop, which stayed fully
 * opaque across the whole screen regardless. Dismissing now also fades
 * `panelEl.parentElement` — the actual `.overlay` element carrying that
 * background — back to transparent, alongside the same
 * `pointer-events: none` this overlay's own dismiss already relied on so
 * neither element can intercept clicks once invisible. The overlay's own
 * open/closed state is still untouched either way — this is purely a
 * visual dismissal; leaving the chair is still entirely CameraSystem's
 * own, unrelated Escape-driven mechanism, and re-sitting creates a fresh
 * overlay instance, so the reminder is there to dismiss again next time.
 */
export function createRestNookOverlay() {
  return {
    materialClass: "panel",
    mount(panelEl) {
      const content = document.createElement("div");
      content.className = "rest-nook-reminder";

      const heading = document.createElement("h2");
      heading.textContent = "A quiet corner";
      const body = document.createElement("p");
      body.style.lineHeight = "1.6";
      body.textContent = "Nothing needs doing here. This spot is being kept free for something quieter, later — for now, it's just somewhere comfortable to sit.";
      content.append(heading, body);
      panelEl.appendChild(content);

      const hint = document.createElement("p");
      hint.className = "rest-nook-dismiss-hint";
      hint.textContent = "Click to dismiss";
      panelEl.appendChild(hint);

      const dismiss = () => {
        panelEl.classList.add("rest-nook-panel-dismissed");
        panelEl.parentElement?.classList.add("rest-nook-backdrop-dismissed");
      };
      content.addEventListener("click", dismiss);
      hint.addEventListener("click", dismiss);

      return null;
    },
  };
}
