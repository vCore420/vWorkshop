/**
 * InputManager
 * ------------
 * CameraSystem and InteractionSystem never touch keyboard/mouse/touch events
 * directly — they ask InputManager for the current abstract state
 * (`moveVector`, `lookDelta`, `wasJustPressed`...). That state comes from
 * WASD + pointer-lock mouse-look on desktop, and from a virtual joystick +
 * drag-to-look + a tappable interact button on touch devices — both feed
 * the exact same fields, so CameraSystem/InteractionSystem/BuildModeSystem
 * needed zero changes to support touch. This is the seam earlier phases
 * were deliberately built around.
 *
 * The touch joystick DOM is created here (not in HUD), since it's an input
 * device, not information — but it stays invisible until the first real
 * touch is seen, so desktop never shows it (see `_revealTouchControlsOnce`).
 *
 * Two real bugs, previously present, are fixed here — see
 * docs/ARCHITECTURE.md's note on this file for the full account:
 *
 * 1. **Held keys never released.** A `keyup` is only ever dispatched to
 *    whichever document currently has focus. If the window loses focus
 *    while a movement key is physically held — alt-tab, clicking a
 *    browser UI element, a notification stealing focus, switching apps on
 *    a tablet — the browser page never sees that key come back up, and
 *    the key stayed "held" forever afterward. Depending on which key got
 *    stuck, this looked like movement continuing after release (the stuck
 *    key alone), or movement refusing to respond at all (a stuck "forward"
 *    silently cancelling a genuinely-held "backward", since both being
 *    held nets to zero) — two very different-looking symptoms with the
 *    same one cause. Fixed by resetting all held input the moment the
 *    window blurs or the tab is hidden (`_resetAllInput`), the standard
 *    fix for this well-known class of bug.
 * 2. **Two keys mapped to the same action could cancel each other.**
 *    `KeyW`/`ArrowUp` both mean "forward" — releasing just one of them,
 *    while the other was still held, used to clear "forward" entirely,
 *    because held state was tracked per *action*, not per physical key.
 *    Fixed by tracking raw key codes and deriving "is this action held"
 *    from whether *any* of its mapped codes are still down.
 */
import * as THREE from "three";

const KEY_TO_ACTION = {
  KeyW: "forward", ArrowUp: "forward",
  KeyS: "backward", ArrowDown: "backward",
  KeyA: "left", ArrowLeft: "left",
  KeyD: "right", ArrowRight: "right",
  KeyE: "interact",
  Space: "jump",
  ShiftLeft: "run", ShiftRight: "run",
  KeyC: "crouch",
  Escape: "cancel",
  KeyB: "phone",
  KeyZ: "zoom",
  KeyV: "toggleView",
  KeyG: "emoteWheel",
  KeyM: "compass",
};

// Reverse of KEY_TO_ACTION, built once: action -> every code that means it.
// What lets releasing just one of two synonymous keys (KeyW/ArrowUp) leave
// the action "held" as long as the other one still is.
const ACTION_TO_CODES = {};
for (const [code, action] of Object.entries(KEY_TO_ACTION)) {
  (ACTION_TO_CODES[action] ??= []).push(code);
}

const JOYSTICK_RADIUS = 42; // px the nub can travel from centre before clamping
const LOOK_DEADZONE = 1.2; // px of per-frame touch jitter to ignore, so a light tap doesn't twitch the camera
const RUN_JOYSTICK_THRESHOLD = 0.85; // joystick pushed this close to its own edge reads as "running" — see isHeld("run")

export class InputManager {
  constructor(canvas, touchRoot) {
    this.canvas = canvas;
    this._heldCodes = new Set(); // raw key codes currently down, e.g. "KeyW", "ArrowUp"
    this.lookDelta = new THREE.Vector2();
    this.pointerLocked = false;
    this._justPressed = new Set();
    this.touchMode = false;

    this._joystickTouchId = null;
    this._joystickVector = new THREE.Vector2();
    this._scratchMove = new THREE.Vector2();
    // Settings-driven multipliers, applied at the point each input source
    // accumulates into the shared `lookDelta` — see CameraSystem.js, which
    // applies one more, source-agnostic base sensitivity on top of
    // whatever's already been scaled here. Kept here (not in CameraSystem)
    // specifically because InputManager is the one place that already
    // knows which source produced a given frame's movement.
    this._mouseSensitivity = 1;
    this._touchSensitivity = 1;
    this._invertLook = false;
    this._lookTouchId = null;
    this._lookLast = { x: 0, y: 0 };
    this._touchCrouchActive = false; // toggled by the touch crouch button — see _setupTouchActionButtons()

    window.addEventListener("keydown", (e) => this._onKeyDown(e));
    window.addEventListener("keyup", (e) => this._onKeyUp(e));
    document.addEventListener("mousemove", (e) => this._onMouseMove(e));
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });

    // See this file's own top comment (bug 1). Either of these can fire
    // without the matching touchend/keyup ever arriving.
    window.addEventListener("blur", () => this._resetAllInput());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this._resetAllInput();
    });

    if (touchRoot) this._setupTouch(touchRoot);
  }

  /** Every held key, the joystick, and an in-progress look-drag, all back
   *  to neutral — see the top-of-file comment on why this needs to exist
   *  at all. Deliberately doesn't touch pointerLocked/touchMode (those
   *  reflect real, still-current browser/device state, not "was something
   *  held down", so there's nothing stale about them to clear). */
  _resetAllInput() {
    this._heldCodes.clear();
    this._justPressed.clear();
    this.lookDelta.set(0, 0);
    this._joystickTouchId = null;
    this._joystickVector.set(0, 0);
    if (this.joystickNub) this.joystickNub.style.transform = "translate(0, 0)";
    this._lookTouchId = null;
    this._touchCrouchActive = false;
    this._crouchButton?.classList.remove("active");
  }

  _onKeyDown(e) {
    // Any of the computer/workbench/library forms can have a real text
    // input or textarea focused — typing "b" or "e" there should type a
    // letter, not toggle Build Mode or re-trigger an interaction.
    // Escape is deliberately exempt from this — "the notebook should
    // close using Escape... behave consistently with every other
    // Workshop interface." A text field auto-focused on open (the
    // Notebook's own textarea, specifically) was silently swallowing
    // Escape along with every other key, since Escape never conflicts
    // with typing (it isn't a printable character) there was never a
    // real reason for it to be caught by this same suppression.
    const tag = document.activeElement?.tagName;
    if (e.code !== "Escape" && (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT")) return;

    const action = KEY_TO_ACTION[e.code];
    if (!action) return;
    if (!this._isActionHeld(action)) this._justPressed.add(action);
    this._heldCodes.add(e.code);
  }

  _onKeyUp(e) {
    this._heldCodes.delete(e.code);
  }

  _isActionHeld(action) {
    const codes = ACTION_TO_CODES[action];
    if (!codes) return false;
    for (const code of codes) {
      if (this._heldCodes.has(code)) return true;
    }
    return false;
  }

  setMouseSensitivity(v) {
    this._mouseSensitivity = v;
  }

  setTouchSensitivity(v) {
    this._touchSensitivity = v;
  }

  setInvertLook(inverted) {
    this._invertLook = inverted;
  }

  _onMouseMove(e) {
    if (!this.pointerLocked) return;
    this.lookDelta.x += (e.movementX || 0) * this._mouseSensitivity;
    this.lookDelta.y += (e.movementY || 0) * this._mouseSensitivity * (this._invertLook ? -1 : 1);
  }

  /** True while rotation input should apply — pointer-locked mouse, or an
   *  active touch-look drag. CameraSystem gates yaw/pitch updates on this
   *  rather than `pointerLocked` directly, so touch works identically. */
  get lookActive() {
    return this.pointerLocked || this._lookTouchId !== null;
  }

  requestPointerLock() {
    // Touch devices largely don't support (or need) pointer lock at all —
    // trying anyway is harmless, but skip it once we know we're on touch,
    // to avoid console noise from a rejected/unsupported request.
    if (this.touchMode) return;
    this.canvas.requestPointerLock?.();
  }

  exitPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Normalized [-1..1] x/z movement vector — from the joystick if it's
   *  currently in use, otherwise from whatever WASD keys are held. Returns
   *  a reused scratch vector (read-only by convention, not stored across
   *  frames by its one caller, CameraSystem) rather than allocating a
   *  fresh one on every call — this is read every single frame. */
  get moveVector() {
    if (this._joystickTouchId !== null) return this._scratchMove.copy(this._joystickVector);

    const x = (this._isActionHeld("right") ? 1 : 0) - (this._isActionHeld("left") ? 1 : 0);
    const z = (this._isActionHeld("forward") ? 1 : 0) - (this._isActionHeld("backward") ? 1 : 0);
    const v = this._scratchMove.set(x, z);
    if (v.lengthSq() > 1) v.normalize();
    return v;
  }

  /** Keyboard/gamepad-style "is this action currently held" for most
   *  actions — but "run" and "crouch" also have their own touch
   *  equivalents (joystick-push-intensity, and a toggle button,
   *  respectively — see _setupTouchActionButtons()), checked here so
   *  every caller (CameraSystem) only ever needs the one method
   *  regardless of input device. */
  isHeld(action) {
    if (action === "run" && this._joystickTouchId !== null) {
      return this._joystickVector.length() > RUN_JOYSTICK_THRESHOLD;
    }
    if (action === "crouch" && this._touchCrouchActive) return true;
    return this._isActionHeld(action);
  }

  wasJustPressed(action) {
    return this._justPressed.has(action);
  }

  /** Lets UI (the HUD's tappable prompt button, say) register a press
   *  without pretending to be a keyboard event. */
  triggerAction(action) {
    this._justPressed.add(action);
  }

  /** Call once per frame after systems have read input, to reset per-frame deltas. */
  endFrame() {
    this.lookDelta.set(0, 0);
    this._justPressed.clear();
  }

  // ---------------------------------------------------------------------
  // Touch
  // ---------------------------------------------------------------------

  _setupTouch(touchRoot) {
    this.touchRoot = touchRoot;

    this.joystickBase = document.createElement("div");
    this.joystickBase.id = "touch-joystick-base";
    this.joystickNub = document.createElement("div");
    this.joystickNub.id = "touch-joystick-nub";
    this.joystickBase.appendChild(this.joystickNub);
    touchRoot.appendChild(this.joystickBase);

    this._revealTouchControlsOnce();
    this._bindJoystick();
    this._bindLook();
    this._setupTouchActionButtons(touchRoot);
  }

  /** Desktop never sees the joystick — it only appears once an actual touch happens. */
  _revealTouchControlsOnce() {
    const reveal = () => {
      this.touchMode = true;
      this.touchRoot.classList.add("touch-active");
      window.removeEventListener("touchstart", reveal);
    };
    window.addEventListener("touchstart", reveal, { passive: true });
  }

  _bindJoystick() {
    const base = this.joystickBase;

    const start = (e) => {
      if (this._joystickTouchId !== null) return;
      const touch = e.changedTouches[0];
      this._joystickTouchId = touch.identifier;
      this._joystickRect = base.getBoundingClientRect();
      this._updateJoystick(touch);
    };
    const move = (e) => {
      const touch = [...e.changedTouches].find((t) => t.identifier === this._joystickTouchId);
      if (touch) this._updateJoystick(touch);
    };
    const end = (e) => {
      const touch = [...e.changedTouches].find((t) => t.identifier === this._joystickTouchId);
      if (!touch) return;
      this._joystickTouchId = null;
      this._joystickVector.set(0, 0);
      this.joystickNub.style.transform = "translate(0, 0)";
    };

    base.addEventListener("touchstart", start, { passive: true });
    base.addEventListener("touchmove", move, { passive: true });
    base.addEventListener("touchend", end, { passive: true });
    base.addEventListener("touchcancel", end, { passive: true });
  }

  _updateJoystick(touch) {
    const centerX = this._joystickRect.left + this._joystickRect.width / 2;
    const centerY = this._joystickRect.top + this._joystickRect.height / 2;
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const dist = Math.hypot(dx, dy);
    if (dist > JOYSTICK_RADIUS) {
      dx = (dx / dist) * JOYSTICK_RADIUS;
      dy = (dy / dist) * JOYSTICK_RADIUS;
    }
    this.joystickNub.style.transform = `translate(${dx}px, ${dy}px)`;
    // x = strafe (screen-right is +x, matches keyboard's "right"); y = forward
    // (screen-up, i.e. negative dy, is "forward" — pushing the stick away
    // from you to move ahead is the standard convention).
    this._joystickVector.set(dx / JOYSTICK_RADIUS, -dy / JOYSTICK_RADIUS);
  }

  _bindLook() {
    const start = (e) => {
      if (this._lookTouchId !== null) return;
      const touch = e.changedTouches[0];
      this._lookTouchId = touch.identifier;
      this._lookLast.x = touch.clientX;
      this._lookLast.y = touch.clientY;
    };
    const move = (e) => {
      const touch = [...e.changedTouches].find((t) => t.identifier === this._lookTouchId);
      if (!touch) return;
      const dx = touch.clientX - this._lookLast.x;
      const dy = touch.clientY - this._lookLast.y;
      this._lookLast.x = touch.clientX;
      this._lookLast.y = touch.clientY;
      if (Math.abs(dx) < LOOK_DEADZONE && Math.abs(dy) < LOOK_DEADZONE) return;
      this.lookDelta.x += dx * this._touchSensitivity;
      this.lookDelta.y += dy * this._touchSensitivity * (this._invertLook ? -1 : 1);
    };
    const end = (e) => {
      const touch = [...e.changedTouches].find((t) => t.identifier === this._lookTouchId);
      if (touch) this._lookTouchId = null;
    };

    // Deliberately not on the joystick base — a drag that starts there
    // controls movement, never the camera. Bound to the canvas itself, one
    // finger at a time; the joystick is tracked entirely separately (its own
    // element, its own listeners), so both can be used at once.
    this.canvas.addEventListener("touchstart", start, { passive: true });
    this.canvas.addEventListener("touchmove", move, { passive: true });
    this.canvas.addEventListener("touchend", end, { passive: true });
    this.canvas.addEventListener("touchcancel", end, { passive: true });
  }

  /** "Mobile controls should now naturally support: walking, running,
   *  jumping, crouching, ladder climbing" — three of those five need
   *  nothing new here at all: walking already comes from the joystick,
   *  running comes from how *far* the joystick is pushed (see
   *  isHeld("run") above — no separate control, just pushing further),
   *  and ladder climbing already works through the exact same forward/
   *  back joystick input that drives ordinary ground movement (see
   *  CameraSystem's own `input.moveVector.y` use for climbing). Only
   *  jump (a one-shot action, the same as the existing interact prompt's
   *  own tap-to-trigger) and crouch (a held *toggle*, since there's no
   *  natural drag gesture for it the way running already has one) need
   *  actual new buttons — kept to exactly two, positioned opposite the
   *  joystick, same glass/wood styling, same reveal-on-first-touch
   *  behaviour as everything else in this file. */
  _setupTouchActionButtons(touchRoot) {
    const jumpButton = document.createElement("button");
    jumpButton.type = "button";
    jumpButton.id = "touch-jump-button";
    jumpButton.textContent = "Jump";
    jumpButton.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.triggerAction("jump");
    }, { passive: false });
    touchRoot.appendChild(jumpButton);

    const crouchButton = document.createElement("button");
    crouchButton.type = "button";
    crouchButton.id = "touch-crouch-button";
    crouchButton.textContent = "Crouch";
    crouchButton.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this._touchCrouchActive = !this._touchCrouchActive;
      crouchButton.classList.toggle("active", this._touchCrouchActive);
    }, { passive: false });
    touchRoot.appendChild(crouchButton);
    this._crouchButton = crouchButton;
  }
}
