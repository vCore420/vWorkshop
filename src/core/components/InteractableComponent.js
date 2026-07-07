import { Component } from "../Component.js";

/**
 * InteractableComponent
 * ----------------------
 * The heart of "software as physical objects". Any entity that should
 * respond to the player being nearby and pressing the interact key gets
 * one of these. The InteractionSystem is the only thing that reads this
 * component — furniture, notebooks, future plugin objects all use the same
 * contract, so a plugin can make something interactable without touching
 * InteractionSystem at all.
 *
 * @typedef {Object} InteractableOptions
 * @property {string} prompt - text shown in the HUD, e.g. "Sit at the desk"
 * @property {number} [radius=1.4] - proximity radius in metres
 * @property {(ctx: {engine: import('../Engine').Engine}) => void} onInteract
 * @property {(ctx: {engine: import('../Engine').Engine}) => void} [onExit]
 * @property {{position: [number,number,number], lookAt: [number,number,number]}} [focusPose]
 *   Optional camera pose to smoothly move to while this interaction is open
 *   (e.g. sitting at the desk). If omitted, the camera stays put (e.g. the
 *   pinboard, which you just stand in front of).
 * @property {boolean} [opensOverlay=false] - true if onInteract opens a
 *   full-screen overlay that needs an explicit exit (Escape or its close
 *   button). Instant toggles like a light switch leave this false.
 */
export class InteractableComponent extends Component {
  /** @param {InteractableOptions} options */
  constructor(options) {
    super();
    this.prompt = options.prompt;
    this.radius = options.radius ?? 1.4;
    this.onInteract = options.onInteract;
    this.onExit = options.onExit ?? null;
    this.focusPose = options.focusPose ?? null;
    this.opensOverlay = options.opensOverlay ?? false;
    this.enabled = options.enabled ?? true;
  }

  worldPosition(out) {
    this.entity.object3D?.getWorldPosition(out);
    return out;
  }
}
