import { iconMarkup } from "../utils/ProceduralIcons.js";
import { createFocusTrap } from "../ui/focusTrap.js";

/**
 * WorkstationPanel
 * -----------------
 * Owns the actual DOM for the computer's screen: a narrow icon rail and a
 * content area showing whichever app is active. It knows nothing about
 * power-on animation, camera focus, or screen projection — ComputerSystem
 * calls `open()`/`close()` at the right moments and `updateRect()` every
 * frame with wherever the monitor's screen currently projects to.
 *
 * Apps are mounted/unmounted through the same tiny contract OverlayManager
 * uses for full-screen overlays (`mount(container, ctx) -> dispose?`), so
 * the pattern should feel familiar if you've read src/ui/overlays/*.js.
 *
 * Version 3, Phase 10 ("Real Assets, Honestly Introduced") — the rail's
 * own icon now comes from `iconMarkup(app.glyph)` when the app is a
 * recognised first-party one; anything unrecognised (a third-party
 * plugin's own literal emoji `glyph`) prints as plain text exactly as
 * before. See `ProceduralIcons.js`'s own comment for why that fallback
 * matters.
 *
 * Version 3, Phase 12 ("Accessibility & Comfort Pass") — this panel never
 * actually leaves the DOM (`close()` only clears its own content), and
 * its own base CSS state is `opacity: 0; pointer-events: none` —
 * `pointer-events: none` blocks a mouse click but does nothing at all to
 * keyboard `Tab`/Enter, so the rail buttons and "Stand up (Esc)" stayed
 * genuinely reachable and activatable by a keyboard-only person the
 * entire session, whether or not anyone had ever sat down at the
 * computer. `setInteractive()` now toggles the native `inert` attribute
 * alongside `pointer-events`, and gained a real focus trap
 * (`focusTrap.js`) — the same treatment `OverlayManager`/`PhoneUI` just
 * got, applied here for the exact same reason.
 */
export class WorkstationPanel {
  constructor(rootEl, apps, engine) {
    this.engine = engine;
    this.apps = apps;
    this.activeAppId = apps[0]?.id ?? null;
    this._mountedDispose = null;

    this.el = document.createElement("div");
    this.el.className = "workstation-panel";
    this.el.setAttribute("role", "dialog");
    this.el.setAttribute("aria-modal", "true");
    this.el.setAttribute("aria-label", "Computer");
    this.el.setAttribute("inert", ""); // matches the base (non-interactive) CSS state until open() is called
    this._focusTrap = createFocusTrap(this.el);

    this.rail = document.createElement("div");
    this.rail.className = "workstation-rail";
    this.railButtons = new Map();
    for (const app of apps) {
      const btn = document.createElement("button");
      btn.type = "button";
      const icon = iconMarkup(app.glyph);
      btn.innerHTML = `<span class="rail-glyph">${icon ?? app.glyph}</span><span>${app.label}</span>`;
      btn.addEventListener("click", () => this.setActiveApp(app.id));
      this.rail.appendChild(btn);
      this.railButtons.set(app.id, btn);
    }

    this.main = document.createElement("div");
    this.main.className = "workstation-main";

    this.header = document.createElement("div");
    this.header.className = "workstation-header";
    this.clockEl = document.createElement("span");
    this.clockEl.className = "clock";
    this.standUpHint = document.createElement("button");
    this.standUpHint.type = "button";
    this.standUpHint.className = "stand-up-hint";
    this.standUpHint.textContent = "Stand up (Esc)";
    this.standUpHint.addEventListener("click", () => engine.events.emit("interaction:exitRequested"));
    this.header.append(this.clockEl, this.standUpHint);

    this.content = document.createElement("div");
    this.content.className = "workstation-content";

    this.main.append(this.header, this.content);
    this.el.append(this.rail, this.main);
    rootEl.appendChild(this.el);

    this._unsubClock = engine.events.on("timeofday:changed", ({ hour }) => {
      const h = Math.floor(hour);
      const m = Math.floor((hour - h) * 60);
      this.clockEl.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    });
  }

  /** Opens on whichever app was active last time (default: the first app). */
  open(lastAppId) {
    this.setActiveApp(this.apps.some((a) => a.id === lastAppId) ? lastAppId : this.apps[0]?.id);
    this.setInteractive(true);
  }

  /** Stops accepting clicks *and* keyboard focus immediately — called the
   *  instant you stand up, even though the panel keeps fading out
   *  visually for a little longer (see the module comment above on why
   *  `inert` doesn't need to wait for that). */
  setInteractive(flag) {
    this.el.classList.toggle("interactive", flag);
    this.el.toggleAttribute("inert", !flag);
    if (flag) this._focusTrap.activate();
    else this._focusTrap.deactivate();
  }

  close() {
    this.setInteractive(false);
    this._mountedDispose?.();
    this._mountedDispose = null;
    this.content.innerHTML = "";
  }

  setActiveApp(appId) {
    if (appId === this.activeAppId && this._mountedDispose) return;
    this._mountedDispose?.();
    this.content.innerHTML = "";

    this.activeAppId = appId;
    for (const [id, btn] of this.railButtons) btn.classList.toggle("active", id === appId);

    const app = this.apps.find((a) => a.id === appId);
    if (!app) return;
    this._mountedDispose = app.mount(this.content, { engine: this.engine }) ?? null;
    this.engine.events.emit("computer:appChanged", { appId });
  }

  /** Called every frame while visible or transitioning — see ComputerSystem. */
  updateRect(rect, opacity) {
    this.el.style.left = `${rect.left}px`;
    this.el.style.top = `${rect.top}px`;
    this.el.style.width = `${Math.max(0, rect.width)}px`;
    this.el.style.height = `${Math.max(0, rect.height)}px`;
    this.el.style.opacity = String(opacity);
  }
}
