/**
 * createRestNookOverlay
 * ----------------------
 * The sitting area doesn't do much yet on purpose — it's a comfortable,
 * quiet corner reserved for something calmer later (a local AI companion
 * to sit and talk with). This overlay stays brief rather than padding
 * itself out with fake content.
 *
 * "The reminder shown while sitting should disappear when clicked. This
 * should only dismiss the reminder. The player should still leave the
 * chair using Escape exactly as they do now." Clicking the text fades it
 * out and leaves it gone — a `dismissed` flag on the overlay's own
 * instance, not anything CameraSystem or OverlayManager know about,
 * since leaving the chair is still entirely their own, unrelated
 * Escape-driven mechanism. Re-sitting creates a fresh overlay instance
 * (see ComputerSystem.js-style focus wiring), so the reminder is there to
 * dismiss again next time, not permanently gone after the first read.
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
        content.classList.add("dismissed");
        hint.classList.add("dismissed");
      };
      content.addEventListener("click", dismiss);
      hint.addEventListener("click", dismiss);

      return null;
    },
  };
}
