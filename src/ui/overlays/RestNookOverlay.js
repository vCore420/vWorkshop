/**
 * createRestNookOverlay
 * ----------------------
 * The sitting area doesn't do much yet on purpose — it's a comfortable,
 * quiet corner reserved for something calmer later (a local AI companion
 * to sit and talk with). This overlay stays brief rather than padding
 * itself out with fake content.
 */
export function createRestNookOverlay() {
  return {
    materialClass: "panel",
    mount(panelEl) {
      const heading = document.createElement("h2");
      heading.textContent = "A quiet corner";
      const body = document.createElement("p");
      body.style.lineHeight = "1.6";
      body.textContent = "Nothing needs doing here. This spot is being kept free for something quieter, later — for now, it's just somewhere comfortable to sit.";
      panelEl.append(heading, body);
      return null;
    },
  };
}
