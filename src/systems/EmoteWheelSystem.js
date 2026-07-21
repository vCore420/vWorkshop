import { CameraSystem } from "./CameraSystem.js";
import { PlayerAnimationSystem } from "../player/PlayerAnimationSystem.js";

/**
 * EmoteWheelSystem
 * ------------------
 * "Please introduce a simple Emote Wheel... it should remain lightweight,
 * elegant and unobtrusive." Toggled with **Tab** (rebound from G in
 * Version 4, Phase 2 — see `update()`'s own comment on the modal-safety
 * guard that rebind needed alongside it), lists every default and
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
   *  the radial circle." Version 4, Phase 2 ("Playtesting Notes,
   *  Continued") — rebuilt as genuine pie-wedge segments, closer to
   *  FiveM's qb-radialmenu in feel, rather than circles sitting on a
   *  ring. Each wedge button fills the entire ring (`inset: 0` in CSS)
   *  and is cut down to its own slice via `clip-path: polygon(...)`,
   *  computed here with `wedgeClipPath()` — a real, independently
   *  clickable wedge-shaped hit area, not a decorative background behind
   *  a circular button. The icon+label overlay inside each wedge still
   *  uses the original `--angle` rotate/translate/counter-rotate
   *  technique (now living on a separate, `pointer-events: none` child
   *  element, `.emote-wheel-item`, so it can sit at the wedge's own
   *  mid-angle without being what actually receives the click) — that
   *  part of the original technique was already correct, and is reused,
   *  not replaced. Closing on selection already worked before this
   *  change — see close() below — untouched.
   */
  _render() {
    this.root.innerHTML = "";

    const clips = this.animationLibraryStore.all().filter((c) => c.category !== "movement");
    if (clips.length === 0) {
      const card = document.createElement("div");
      card.className = "emote-wheel-empty-card";
      const heading = document.createElement("h3");
      heading.textContent = "Gestures";
      card.appendChild(heading);
      const empty = document.createElement("p");
      empty.className = "app-subtitle";
      empty.textContent = "No gestures yet — create one in the Animation Editor.";
      card.appendChild(empty);
      this.root.appendChild(card);
      return;
    }

    const ring = document.createElement("div");
    ring.className = "emote-wheel-ring";
    ring.style.setProperty("--wheel-count", clips.length);

    const segmentAngle = 360 / clips.length;
    clips.forEach((clip, i) => {
      const centerAngle = (i / clips.length) * 360;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "emote-wheel-wedge";
      btn.style.setProperty("--angle", `${centerAngle}deg`);
      btn.style.clipPath = wedgeClipPath(centerAngle - segmentAngle / 2, centerAngle + segmentAngle / 2);
      btn.setAttribute("aria-label", clip.name);
      btn.addEventListener("click", () => {
        this._animationSystem?.play(clip.id);
        this.close();
      });

      const item = document.createElement("span");
      item.className = "emote-wheel-item";
      item.style.setProperty("--angle", `${centerAngle}deg`);
      const icon = document.createElement("span");
      icon.className = "emote-wheel-item-icon";
      icon.textContent = iconForClip(clip.name);
      icon.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = clip.name;
      item.append(icon, label);
      btn.appendChild(item);

      ring.appendChild(btn);
    });

    const hub = document.createElement("button");
    hub.type = "button";
    hub.className = "emote-wheel-hub";
    hub.textContent = "Close";
    hub.setAttribute("aria-label", "Close the Emote Wheel");
    hub.addEventListener("click", () => this.close());
    ring.appendChild(hub);

    this.root.appendChild(ring);

    const hint = document.createElement("p");
    hint.className = "emote-wheel-hint";
    hint.textContent = "Tab to close";
    this.root.appendChild(hint);
  }

  update(_dt) {
    const input = this.engine.input;
    if (!input) return;
    if (input.wasJustPressed("emoteWheel")) {
      // Version 4, Phase 2 ("Playtesting Notes, Continued") — this system
      // never checked anything about modal state before Tab replaced G as
      // the toggle key. That was apparently never a practical problem for
      // G (rarely pressed while inside the Computer/Phone/an overlay
      // panel), but Tab is *the* standard key those exact panels use
      // continuously to cycle focus between their own controls
      // (`focusTrap.js`) — an unguarded rebind would toggle this wheel on
      // every single focus-cycle keypress inside any of them. Every
      // modal in this codebase already calls `exitPointerLock()` on open
      // and `requestPointerLock()` on close (Computer, Phone, Workbench,
      // every `OverlayManager` panel) — `input.pointerLocked` is that
      // same already-computed, already-universal signal, reused here
      // rather than re-deriving a second way to ask "is a modal open"
      // per-system. `|| this.isOpen` still lets Tab close the wheel once
      // it's already open, even though opening it releases pointer lock
      // itself (see `open()` above) — without that, Tab could open the
      // wheel but never close it again.
      if (input.pointerLocked || this.isOpen) this.toggle();
    } else if (this.isOpen && input.wasJustPressed("cancel")) this.close();
  }
}

/** Builds a `clip-path: polygon(...)` string cutting a wedge, spanning
 *  `startDeg` to `endDeg` (0deg = the ring's own top/12-o'clock, positive
 *  = clockwise — the same convention `--angle` already used), out of an
 *  element that fills its whole square container (`inset: 0`). Samples
 *  the arc every ~12° rather than using just the two endpoints, so a
 *  wide wedge (few total gestures — even two, spanning 180° each) still
 *  reads as a real curved pie slice instead of a straight-edged triangle
 *  chord cutting across the circle. */
function wedgeClipPath(startDeg, endDeg) {
  const points = ["50% 50%"];
  const span = endDeg - startDeg;
  const steps = Math.max(2, Math.ceil(span / 12));
  for (let s = 0; s <= steps; s++) {
    const deg = startDeg + (span * s) / steps;
    const rad = (deg * Math.PI) / 180;
    const x = 50 + 50 * Math.sin(rad);
    const y = 50 - 50 * Math.cos(rad);
    points.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  return `polygon(${points.join(", ")})`;
}

/** This project ships no binary/image assets by design (see
 *  `assets/README.md`) — a small, honest keyword heuristic against a
 *  clip's own name, rather than a real icon library. Falls back to a
 *  plain, generic glyph for anything that doesn't match (most gestures
 *  are player-created, with player-chosen names this can't hope to cover
 *  exhaustively) — never guessing a specific icon for something it can't
 *  actually identify. Order matters where patterns could both match the
 *  same name (checked top to bottom, first match wins). */
const EMOTE_ICON_KEYWORDS = [
  [/wave/i, "👋"],
  [/bow/i, "🙇"],
  [/dance/i, "💃"],
  [/sit/i, "🪑"],
  [/point/i, "👉"],
  [/clap/i, "👏"],
  [/laugh/i, "😄"],
  [/think/i, "🤔"],
  [/wink/i, "😉"],
  [/shrug/i, "🤷"],
  [/salute/i, "🫡"],
  [/(^|\W)no(\W|$)|shake/i, "🙅"],
  [/(^|\W)yes(\W|$)|agree|nod/i, "🙆"],
  [/cheer/i, "🙌"],
  [/cry/i, "😢"],
];
const EMOTE_ICON_FALLBACK = "✨";

function iconForClip(name) {
  for (const [pattern, icon] of EMOTE_ICON_KEYWORDS) {
    if (pattern.test(name)) return icon;
  }
  return EMOTE_ICON_FALLBACK;
}
