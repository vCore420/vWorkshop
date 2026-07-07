import { PersistenceSystem } from "../systems/PersistenceSystem.js";

/**
 * HUD
 * ---
 * Deliberately minimal: a crosshair, a single contextual prompt near the
 * bottom of the screen, a quiet "Saved" flash, a transient toast (used by
 * custom world objects' Interactable/Storage/Computer behaviours to say
 * something without each needing its own overlay), and a small set of
 * corner buttons. There is no menu bar, no inventory grid, no settings gear
 * — those live as physical objects instead (see OverlayManager). Anything
 * added here later should meet a high bar: does this genuinely need to be
 * on screen at all times, everywhere in the room?
 *
 * The prompt is a real `<button>`, not just styled text — on touch devices
 * it doubles as the interact control (see InputManager's `triggerAction`),
 * so there's exactly one element for "here's what's nearby" and "press
 * this to do it", rather than a separate always-present action button.
 */
export class HUD {
  constructor(rootEl, engine) {
    this.root = rootEl;
    this.engine = engine;

    this.crosshair = document.createElement("div");
    this.crosshair.className = "hud-crosshair";
    this.root.appendChild(this.crosshair);

    this.prompt = document.createElement("button");
    this.prompt.type = "button";
    this.prompt.className = "hud-prompt";
    this.prompt.addEventListener("click", () => engine.input?.triggerAction("interact"));
    this.root.appendChild(this.prompt);

    this.toast = document.createElement("div");
    this.toast.className = "hud-toast";
    this.root.appendChild(this.toast);

    this.saveIndicator = document.createElement("div");
    this.saveIndicator.className = "hud-save-indicator";
    this.root.appendChild(this.saveIndicator);

    this.backupControls = document.createElement("div");
    this.backupControls.className = "hud-backup-controls";
    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.textContent = "Export backup";
    exportBtn.addEventListener("click", () => engine.getSystem(PersistenceSystem)?.exportBackup());
    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.textContent = "Import backup";
    importBtn.addEventListener("click", async () => {
      try {
        await engine.getSystem(PersistenceSystem)?.importBackup();
      } catch (err) {
        console.error(err);
        alert("Couldn't read that backup file.");
      }
    });
    const buildModeBtn = document.createElement("button");
    buildModeBtn.type = "button";
    buildModeBtn.textContent = "Build Mode (B)";
    buildModeBtn.addEventListener("click", () => engine.events.emit("buildmode:toggleRequested"));
    this.backupControls.append(exportBtn, importBtn, buildModeBtn);
    this.root.appendChild(this.backupControls);

    this.touchControls = document.getElementById("touch-controls");

    engine.events.on("hud:prompt", (state) => this._setPrompt(state));
    engine.events.on("hud:toast", ({ text }) => this._showToast(text));
    engine.events.on("interaction:trigger", () => this._setModal(true));
    engine.events.on("overlay:close", () => this._setModal(false));
    engine.events.on("computer:activate", () => this._setModal(true));
    engine.events.on("computer:deactivate", () => this._setModal(false));
    engine.events.on("workbench:activate", () => this._setModal(true));
    engine.events.on("workbench:deactivate", () => this._setModal(false));
    engine.events.on("buildmode:entered", () => this._setModal(true));
    engine.events.on("buildmode:exited", () => this._setModal(false));
    engine.events.on("persistence:saved", () => this._flashSaved());

    this._saveFadeTimer = null;
    this._toastFadeTimer = null;
  }

  _setPrompt({ visible, text }) {
    if (visible) {
      const hint = this.engine.input?.touchMode ? "" : "<kbd>E</kbd>";
      this.prompt.innerHTML = `${hint}${text}`;
      this.prompt.classList.add("visible");
    } else {
      this.prompt.classList.remove("visible");
    }
  }

  _setModal(isModal) {
    this.crosshair.classList.toggle("hidden", isModal);
    this.touchControls?.classList.toggle("modal-hidden", isModal);
    if (isModal) this.prompt.classList.remove("visible");
  }

  _showToast(text) {
    this.toast.textContent = text;
    this.toast.classList.add("visible");
    clearTimeout(this._toastFadeTimer);
    this._toastFadeTimer = setTimeout(() => this.toast.classList.remove("visible"), 3200);
  }

  _flashSaved() {
    this.saveIndicator.textContent = "Workshop saved";
    this.saveIndicator.classList.add("visible");
    clearTimeout(this._saveFadeTimer);
    this._saveFadeTimer = setTimeout(() => this.saveIndicator.classList.remove("visible"), 2200);
  }
}
