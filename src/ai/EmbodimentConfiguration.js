/**
 * EmbodimentConfiguration
 * --------------------------
 * "These are not active during this phase. Instead they simply prepare
 * for the next phase" was true when this file was first written; that
 * next phase is this one. `ResidentRenderer.js` now actually reads every
 * field here — type, colour, glow, scale, idle behaviour — see
 * docs/RESIDENT.md's "Resident Embodiments" section for how each one
 * maps onto something visible. This file itself doesn't change shape for
 * that; it was already right, which is the point of separating "the shape
 * a setting takes" from "the system that finally consumes it."
 *
 * "Begin preparing support for additional resident embodiments... avoid
 * introducing additional residents during this phase" — five real forms
 * now exist (`floatingOrb` remains the one the Workshop actually seeds
 * new residents with), plus `custom` staying reserved exactly as before
 * for whatever a future phase invents that isn't a simple primitive at
 * all.
 *
 * `idleBehaviour` deliberately stays a plain, small enum
 * (`IDLE_BEHAVIOUR_OPTIONS`) rather than anything richer (a full
 * animation reference, say) — `ResidentMovement.js` reads it to scale how
 * much its own idle bob/sway/rotation actually moves, not to select a
 * full animation clip. A future embodiment system is free to grow this
 * into something that reuses `AnimationLibraryStore` clips directly;
 * nothing here commits to it staying this simple forever.
 */
import { clamp } from "../utils/MathUtils.js";

export const EMBODIMENT_TYPES = [
  { id: "floatingOrb", label: "Floating Orb" },
  { id: "cube", label: "Cube" },
  { id: "prism", label: "Prism" },
  { id: "lantern", label: "Lantern" },
  { id: "wisp", label: "Wisp" },
  { id: "custom", label: "Custom (future)" },
];

export const IDLE_BEHAVIOUR_OPTIONS = [
  { id: "gentleFloat", label: "Gentle float" },
  { id: "stillAndAttentive", label: "Still and attentive" },
  { id: "slowRotate", label: "Slow rotate" },
];

export function defaultEmbodimentConfig() {
  return {
    type: "floatingOrb",
    color: "#7fd8c4", // the Workshop's own screen-glow teal, a natural default rather than an arbitrary one
    glow: 0.5,
    scale: 1,
    idleBehaviour: "gentleFloat",
  };
}

export function normalizeEmbodimentConfig(config) {
  const defaults = defaultEmbodimentConfig();
  if (!config) return defaults;
  return {
    type: EMBODIMENT_TYPES.some((t) => t.id === config.type) ? config.type : defaults.type,
    color: typeof config.color === "string" ? config.color : defaults.color,
    glow: clamp01(config.glow, defaults.glow),
    scale: typeof config.scale === "number" ? clamp(config.scale, 0.3, 2) : defaults.scale,
    idleBehaviour: IDLE_BEHAVIOUR_OPTIONS.some((o) => o.id === config.idleBehaviour) ? config.idleBehaviour : defaults.idleBehaviour,
  };
}

function clamp01(value, fallback) {
  return typeof value === "number" ? clamp(value, 0, 1) : fallback;
}
