/**
 * createRestNookOverlay
 * ----------------------
 * The sitting area doesn't do much yet on purpose — it's a comfortable,
 * quiet corner reserved for something calmer later (a local AI companion
 * to sit and talk with). This overlay stays brief rather than padding
 * itself out with fake content.
 *
 * "The reminder shown while sitting should disappear when clicked...
 * ensure the entire introductory overlay is dismissed once acknowledged.
 * Escape should remain the only method of standing back up." Clicking
 * the text fades out the *whole panel* (`panelEl` itself, not just its
 * own inner content) — an earlier version of this only faded the text,
 * leaving the overlay's own background/border panel fully visible and
 * looking like an empty, still-active overlay, which is exactly the
 * reported bug. The overlay's own open/closed state is untouched either
 * way — this is purely a visual dismissal, `pointer-events: none`
 * alongside the fade so the now-invisible panel can't still intercept
 * clicks — leaving the chair is still entirely CameraSystem's own,
 * unrelated Escape-driven mechanism. Re-sitting creates a fresh overlay
 * instance, so the reminder is there to dismiss again next time, not
 * permanently gone after the first read.
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
      };
      content.addEventListener("click", dismiss);
      hint.addEventListener("click", dismiss);

      return null;
    },
  };
}
