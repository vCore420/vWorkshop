/**
 * BehaviourDialsConfiguration
 * -----------------------------
 * "Continue activating Behaviour Configuration... Curiosity,
 * Talkativeness, Playfulness, Energy, Independence, Reflection,
 * Calmness... these should influence movement, conversations and general
 * behaviour. Please favour subtle changes over dramatic differences."
 *
 * Distinct from `TraitConfiguration.js`'s own six named, discrete traits
 * (Curious, Calm, Cheerful, Quiet, Thoughtful, Playful) added the
 * previous phase — these are continuous (0-1 sliders, default 0.5,
 * neutral), letting a person fine-tune *how much* of something rather
 * than only choosing whether a named archetype applies at all. The two
 * systems are complementary, not competing: traits are "which flavour,"
 * dials are "how strongly." `ResidentDials.getDialModifiers()` is where
 * a dial actually becomes a movement/awareness/expression modifier, the
 * same shape-module-vs-consumer split every other profile setting in
 * `src/ai/` already follows.
 *
 * Same shape-and-defaults-only pattern as `MemoryConfiguration.js`/
 * `EmbodimentConfiguration.js`/`TraitConfiguration.js` — a plain object,
 * a `default*Config()`, a `normalize*Config()`.
 */
import { clamp } from "../utils/MathUtils.js";

export const BEHAVIOUR_DIALS = [
  { id: "curiosity", label: "Curiosity", low: "Incurious", high: "Curious" },
  { id: "talkativeness", label: "Talkativeness", low: "Reserved", high: "Talkative" },
  { id: "playfulness", label: "Playfulness", low: "Serious", high: "Playful" },
  { id: "energy", label: "Energy", low: "Sedate", high: "Energetic" },
  { id: "independence", label: "Independence", low: "Attentive", high: "Independent" },
  { id: "reflection", label: "Reflection", low: "Spontaneous", high: "Reflective" },
  { id: "calmness", label: "Calmness", low: "Excitable", high: "Calm" },
];

export function defaultDialsConfig() {
  const config = {};
  for (const dial of BEHAVIOUR_DIALS) config[dial.id] = 0.5;
  return config;
}

export function normalizeDialsConfig(config) {
  const defaults = defaultDialsConfig();
  if (!config) return defaults;
  const normalized = {};
  for (const dial of BEHAVIOUR_DIALS) {
    const value = config[dial.id];
    normalized[dial.id] = typeof value === "number" && Number.isFinite(value) ? clamp(value, 0, 1) : defaults[dial.id];
  }
  return normalized;
}
