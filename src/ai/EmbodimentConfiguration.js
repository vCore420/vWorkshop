/**
 * EmbodimentConfiguration
 * --------------------------
 * "Please prepare future embodiment settings. These are not active
 * during this phase." Exactly like `MemoryConfiguration.js`: a shape and
 * sensible defaults, not a working feature. Nothing in the Workshop
 * currently reads `embodiment` off a resident profile to actually spawn
 * anything — that arrives with a future AI Resident phase, which will
 * consume this exact shape rather than a future version of this file
 * needing to invent it retroactively.
 *
 * `idleBehaviour` deliberately stays a plain, small enum
 * (`IDLE_BEHAVIOUR_OPTIONS`) rather than anything richer (a full
 * animation reference, say) — right sized for "prepare the architecture,"
 * not "build the thing early." A future embodiment system is free to
 * grow this into something that reuses `AnimationLibraryStore` clips
 * directly; nothing here commits to it staying this simple forever.
 */
export const EMBODIMENT_TYPES = [
  { id: "floatingOrb", label: "Floating Orb" },
  { id: "cube", label: "Cube" },
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
    scale: typeof config.scale === "number" ? Math.min(2, Math.max(0.3, config.scale)) : defaults.scale,
    idleBehaviour: IDLE_BEHAVIOUR_OPTIONS.some((o) => o.id === config.idleBehaviour) ? config.idleBehaviour : defaults.idleBehaviour,
  };
}

function clamp01(value, fallback) {
  return typeof value === "number" ? Math.min(1, Math.max(0, value)) : fallback;
}
