import { PhoneUI } from "./PhoneUI.js";
import { InteractionSystem } from "../systems/InteractionSystem.js";
import { CameraSystem } from "../systems/CameraSystem.js";
import { TimeOfDaySystem } from "../systems/TimeOfDaySystem.js";
import { formatClockTime } from "../utils/TimeFormat.js";

/**
 * PhoneSystem
 * -------------
 * "The Computer is for creating. The Phone is for using." Where the
 * Computer (`ComputerSystem.js`) is a *place* the player sits down at —
 * full focus-mode, camera locked, an actual desk in the room — the Phone
 * is something carried everywhere, opened and closed in an instant
 * without ever stepping outside the world.
 *
 * "Using the phone should NOT freeze the player... keyboard movement
 * should continue functioning normally... the mouse should temporarily
 * stop controlling the camera." Concretely: `CameraSystem.pauseLook()`,
 * not `lock()` — a deliberately narrower pair (see that file's own
 * comment) that only pauses mouse-look, leaving walk/run/jump/crouch
 * completely untouched. Combined with `InputManager.exitPointerLock()`
 * (a real, visible, clickable cursor), that's the whole of "the mouse
 * becomes available for interacting with the phone interface" — no
 * special input mode to build, just the same two primitives Build Mode
 * already used, recombined without the full-freeze `lock()` that never
 * belonged to the Phone's own feel in the first place.
 *
 * **Modular by construction, not by convention** — see `apps/registry.js`,
 * the exact same "list of factories, built once with shared deps" shape
 * `src/computer/apps/registry.js` already established. "Applications
 * should register themselves with the phone rather than being hardcoded"
 * is true here in the most literal sense: this file has never heard of
 * a Being, an outfit, or a construction piece — it only ever calls
 * `app.mount(container)` on whichever app id is currently active.
 *
 * **Application Persistence** — "if the player closes the phone while
 * using an application, the next time the phone opens it should return
 * to that same application... the phone should behave like a real
 * device." `activeAppId` (`null` meaning the home screen) is the one
 * thing this system persists; reopening the phone re-mounts whichever
 * app that was, never resetting to the home grid just because the phone
 * itself closed.
 */
export class PhoneSystem {
  constructor(apps, settingsStore) {
    this.apps = apps; // [{id, label, glyph, mount(container)}], built once by apps/registry.js
    this._settingsStore = settingsStore; // read directly for the status bar's own time-format preference — see TimeFormat.js's own comment
    this.isOpen = false;
    this.activeAppId = null; // null = home screen
    this._mountedDispose = null;
    // Interface & Design Refinement phase — the status bar's own clock;
    // see _updateStatusBar()'s own comment for why this is throttled
    // rather than read every frame.
    this._statusBarTimer = 0;
  }

  init(engine) {
    this.engine = engine;
    this._cameraSystem = engine.getSystem(CameraSystem);
    this._timeOfDaySystem = engine.getSystem(TimeOfDaySystem);

    const root = document.getElementById("workshop-phone-root");
    this.ui = new PhoneUI(root, {
      onClose: () => this.close(),
      onGoHome: () => this.goHome(),
      onSelectApp: (id) => this.openApp(id),
    });

    // Version 3, Phase 13 — applied once at startup and kept live on every
    // `settings:changed`, not just when the Phone Settings/PC Settings
    // controls themselves change it (either surface writes to the same
    // `SettingsStore`, so one shared listener covers both).
    this._applyAppearance();
    if (this._settingsStore) this._settingsStore.events.on("settings:changed", () => this._applyAppearance());

    this._onKeyDown = (e) => {
      if (e.code !== "Escape" || !this.isOpen) return;
      // The active app gets first refusal on Escape — "cancel a ghost,"
      // say, shouldn't also back all the way out to the home screen in
      // the same keystroke. Only once the app itself has nothing left to
      // cancel (or doesn't define onCancel at all) does backing up one
      // level — home screen first, then closed, like a real device's own
      // back gesture — happen here.
      const app = this.apps.find((a) => a.id === this.activeAppId);
      if (app?.onCancel?.()) return;
      if (this.activeAppId !== null) this.goHome();
      else this.close();
    };
    window.addEventListener("keydown", this._onKeyDown);
    // Used by apps (Emotes, specifically) that need to close the phone as
    // part of their own action, without needing a direct reference back
    // to this system — see EmotesPhoneApp.js's own comment.
    engine.events.on("phone:closeRequested", () => this.close());
    // Touch/HUD fallback access, alongside the "phone" key itself.
    engine.events.on("phone:toggleRequested", () => this.toggle());
  }

  update(dt) {
    if (this.engine.input?.wasJustPressed("phone")) this.toggle();
    if (!this.isOpen) return;
    // Interface & Design Refinement phase — "status bar." A real device's
    // own clock only actually changes once a minute; polling every single
    // frame for a value that's overwhelmingly likely to be identical to
    // last frame's would be wasted work for something nobody can even
    // perceive updating that often. Every half-second is already far more
    // often than the displayed minute could possibly change, and is cheap
    // enough not to matter either way.
    this._statusBarTimer -= dt;
    if (this._statusBarTimer <= 0) {
      this._statusBarTimer = 0.5;
      this._updateStatusBar();
    }
  }

  _updateStatusBar() {
    const hour = this._timeOfDaySystem?.currentTime;
    if (typeof hour === "number") this.ui.setStatusTime(formatClockTime(hour, this._settingsStore?.get("display").timeFormat));
  }

  _applyAppearance() {
    const phone = this._settingsStore?.get("phone");
    if (phone) this.ui.setAppearance(phone);
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    if (this.isOpen) return;
    // Can't reach into your pocket while sitting at the computer or mid-
    // conversation with Bubble — both already want the mouse for their
    // own overlay. Reading Chair phase — the sitting area is the one
    // exception: its `allowLookAround` focus pose is a genuinely relaxed
    // pose, not a hands-occupied one, so checking Phone while seated there
    // is allowed. See InteractionSystem.activeAllowsLookAround.
    const interactionSystem = this.engine.getSystem(InteractionSystem);
    if (interactionSystem?.active && !interactionSystem.activeAllowsLookAround) return;

    this.isOpen = true;
    this._cameraSystem?.pauseLook();
    this.engine.input?.exitPointerLock();
    this.ui.show();
    this._updateStatusBar();
    this._renderCurrentScreen();
    this.engine.events.emit("phone:opened");
  }

  close() {
    if (!this.isOpen) return;
    this._unmountCurrentApp();
    this.isOpen = false;
    this._cameraSystem?.resumeLook();
    this.engine.input?.requestPointerLock();
    this.ui.hide();
    this.engine.events.emit("phone:closed");
  }

  goHome() {
    this._unmountCurrentApp();
    this.activeAppId = null;
    this._renderCurrentScreen();
    this.engine.events.emit("persistence:saveRequested");
  }

  openApp(id) {
    const app = this.apps.find((a) => a.id === id);
    if (!app) return;
    this._unmountCurrentApp();
    this.activeAppId = id;
    this._renderCurrentScreen();
    this.engine.events.emit("persistence:saveRequested");
  }

  _renderCurrentScreen() {
    if (this.activeAppId === null) {
      this.ui.showHome(this.apps);
      return;
    }
    const app = this.apps.find((a) => a.id === this.activeAppId);
    if (!app) {
      this.activeAppId = null;
      this.ui.showHome(this.apps);
      return;
    }
    const container = this.ui.prepareAppContainer(app.label);
    this._mountedDispose = app.mount(container) ?? null;
  }

  _unmountCurrentApp() {
    this._mountedDispose?.();
    this._mountedDispose = null;
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { activeAppId: this.activeAppId };
  }

  load(data) {
    // Deliberately doesn't re-render here — the phone itself always
    // starts closed each session ("carried," not left lying open), so
    // there's nothing to mount until the player actually opens it, at
    // which point _renderCurrentScreen() reads this restored id.
    this.activeAppId = data?.activeAppId ?? null;
  }

  dispose() {
    window.removeEventListener("keydown", this._onKeyDown);
  }
}
