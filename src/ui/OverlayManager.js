import { createCloseButton } from "./closeButton.js";
import { createFocusTrap } from "./focusTrap.js";

/**
 * OverlayManager
 * --------------
 * Bridges InteractionSystem's "something was interacted with" events to
 * actual DOM content. Each overlay is registered once with a `materialClass`
 * (screen / paper / cork / panel — see css/overlays.css) and a `mount`
 * function that receives the panel element and populates it however it
 * likes (plain DOM, no framework — this stays simple on purpose).
 *
 * Adding a new overlay later (e.g. a plugin's own panel) is exactly:
 *
 *   overlayManager.register("my-plugin-panel", {
 *     materialClass: "panel",
 *     mount(panelEl, context, engine) { ...; return () => {/* cleanup *\/}; }
 *   });
 *
 * and having some interactable's onInteract emit
 * `engine.events.emit("interaction:trigger", { overlayId: "my-plugin-panel" })`.
 *
 * Version 3, Phase 12 ("Accessibility & Comfort Pass") — every overlay now
 * gets `role="dialog"`/`aria-modal="true"` and a real focus trap
 * (`focusTrap.js`): focus moves in on open, Tab stays inside, and it
 * returns to whatever was focused before opening once closed. `aria-label`
 * falls back to the overlay's own id (e.g. "pinboard") — a plain but
 * genuine accessible name; giving each overlay a nicer one tied to its own
 * heading is exactly the kind of per-surface polish this phase's broader
 * label sweep (see the same phase's later waves) is for, not a special
 * case here.
 */
export class OverlayManager {
  constructor(rootEl, engine) {
    this.root = rootEl;
    this.engine = engine;
    this.registry = new Map();
    this.current = null; // { overlayId, el, dispose }

    engine.events.on("interaction:trigger", ({ overlayId, context }) => this.open(overlayId, context));
    engine.events.on("overlay:close", () => this._closeCurrent());
  }

  register(overlayId, { materialClass, mount }) {
    this.registry.set(overlayId, { materialClass, mount });
  }

  open(overlayId, context) {
    const def = this.registry.get(overlayId);
    if (!def) {
      console.warn(`[OverlayManager] no overlay registered for "${overlayId}"`);
      return;
    }
    this._closeCurrent();

    const overlayEl = document.createElement("div");
    overlayEl.className = `overlay overlay--${def.materialClass}`;
    overlayEl.setAttribute("role", "dialog");
    overlayEl.setAttribute("aria-modal", "true");
    overlayEl.setAttribute("aria-label", overlayId);

    const panelEl = document.createElement("div");
    panelEl.className = "overlay-panel";
    overlayEl.appendChild(panelEl);

    const closeBtn = createCloseButton({
      className: "overlay-close",
      label: "Esc \u2715",
      onClick: () => this.engine.events.emit("interaction:exitRequested"),
    });
    overlayEl.appendChild(closeBtn);

    this.root.appendChild(overlayEl);
    const dispose = def.mount(panelEl, context ?? {}, this.engine) ?? null;

    requestAnimationFrame(() => overlayEl.classList.add("open"));

    const focusTrap = createFocusTrap(overlayEl);
    focusTrap.activate();

    this.current = { overlayId, el: overlayEl, dispose, focusTrap };
    this.engine.input?.exitPointerLock();
  }

  _closeCurrent() {
    if (!this.current) return;
    const { el, dispose, focusTrap } = this.current;
    focusTrap.deactivate();
    dispose?.();
    el.classList.remove("open");
    setTimeout(() => el.remove(), 300);
    this.current = null;
  }
}
