import { CameraSystem } from "./CameraSystem.js";
import { PlayerAnimationSystem } from "../player/PlayerAnimationSystem.js";

/**
 * EmoteWheelSystem
 * ------------------
 * "Please introduce a simple Emote Wheel... it should remain lightweight,
 * elegant and unobtrusive." Toggled with **G**, lists every default and
 * player-created animation, and does exactly one thing when you pick one:
 * calls `PlayerAnimationSystem.play(clipId)`. That's the entire
 * "Animation Architecture" contract in practice — "the Emote Wheel should
 * simply play animation assets" — this file has never seen a pose, a
 * frame, or a pivot name, and never needs to.
 *
 * Closes itself the instant something is picked (or Escape is pressed),
 * rather than staying open as a persistent menu — "immediately trigger,"
 * and "never dominate the player's view," both read as "get in, pick
 * something, get back to the Workshop" rather than a lingering panel.
 * Movement/look briefly locks while it's open (the same
 * `CameraSystem.lock()`/`unlock()` every other overlay already uses) so
 * the mouse can click a button instead of fighting pointer-lock look —
 * given how briefly it's ever open, this reads as a quick glance down at
 * a gesture list, not a mode switch.
 */
export class EmoteWheelSystem {
  constructor({ animationLibraryStore }) {
    this.animationLibraryStore = animationLibraryStore;
    this.isOpen = false;
  }

  init(engine) {
    this.engine = engine;
    this._cameraSystem = engine.getSystem(CameraSystem);
    this._animationSystem = engine.getSystem(PlayerAnimationSystem);
    this._buildDom();
    this.animationLibraryStore.events.on("library:changed", () => {
      if (this.isOpen) this._render();
    });
  }

  _buildDom() {
    this.root = document.getElementById("emote-wheel-root");
    this.root.className = "emote-wheel hidden";
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this._cameraSystem?.lock();
    this.engine.input?.exitPointerLock?.();
    this._render();
    this.root.classList.remove("hidden");
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this._cameraSystem?.unlock();
    this.root.classList.add("hidden");
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  /** Version 3, Phase 14 ("Further Environmental Polish") — "we could
   *  design a radial wheel with options for each emote in a section of
   *  the radial circle." Each button's own position on the ring is a
   *  single CSS custom property (`--angle`, degrees) set here in JS —
   *  the actual circular placement (a rotate/translate/counter-rotate
   *  compound transform, keeping every button's own label upright
   *  despite sitting at an angle) lives entirely in `css/main.css`, the
   *  standard technique for a CSS-only radial layout that needs no
   *  per-button trigonometry here at all. Closing on selection already
   *  worked before this change — see close() below — untouched.
   */
  _render() {
    this.root.innerHTML = "";
    const card = document.createElement("div");
    card.className = "emote-wheel-card";

    const clips = this.animationLibraryStore.all().filter((c) => c.category !== "movement");
    if (clips.length === 0) {
      const heading = document.createElement("h3");
      heading.textContent = "Gestures";
      card.appendChild(heading);
      const empty = document.createElement("p");
      empty.className = "app-subtitle";
      empty.textContent = "No gestures yet — create one in the Animation Editor.";
      card.appendChild(empty);
    } else {
      const ring = document.createElement("div");
      ring.className = "emote-wheel-ring";
      ring.style.setProperty("--wheel-count", clips.length);

      const hub = document.createElement("div");
      hub.className = "emote-wheel-hub";
      hub.textContent = "Gestures";
      ring.appendChild(hub);

      clips.forEach((clip, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = clip.name;
        btn.style.setProperty("--angle", `${(i / clips.length) * 360}deg`);
        btn.addEventListener("click", () => {
          this._animationSystem?.play(clip.id);
          this.close();
        });
        ring.appendChild(btn);
      });
      card.appendChild(ring);
    }

    const hint = document.createElement("p");
    hint.className = "emote-wheel-hint";
    hint.textContent = "G to close";
    card.appendChild(hint);

    this.root.appendChild(card);
  }

  update(_dt) {
    const input = this.engine.input;
    if (!input) return;
    if (input.wasJustPressed("emoteWheel")) this.toggle();
    else if (this.isOpen && input.wasJustPressed("cancel")) this.close();
  }
}
