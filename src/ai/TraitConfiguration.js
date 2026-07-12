/**
 * TraitConfiguration
 * --------------------
 * "Please introduce the concept of Resident Identity. Identity should
 * become a long-term characteristic rather than a temporary state." This
 * is the shape that carries it: a small, fixed set of personality traits
 * a person can choose for a resident, stored on the profile exactly like
 * `memory`/`embodiment` already are — real defaults, a `normalize*()`
 * function tolerating old/missing data, nothing invented at call sites.
 *
 * Deliberately a short, named enum rather than free-text — `identity.
 * personality` (see `ResidentProfileStore.js`'s existing `DEFAULT_IDENTITY`)
 * already covers "describe this resident's personality in your own words"
 * for the system prompt; this is the *behavioural* counterpart, a small
 * set of concrete labels other systems (movement, awareness, idle-location
 * weighting) can actually branch on. Free text is expressive but nothing
 * can safely pattern-match against it; a fixed enum is what "influence
 * many existing systems without replacing them" needs to be built on.
 *
 * `ResidentTraits.js` (src/resident/) is where a selected trait actually
 * *becomes* a movement/awareness/expression modifier — this file only
 * defines what a trait *is*, the same "shape module vs. the system that
 * consumes it" split `MemoryConfiguration.js`/`EmbodimentConfiguration.js`
 * already established.
 */
export const PERSONALITY_TRAITS = [
  { id: "curious", label: "Curious", description: "Notices things, drawn to novelty and change." },
  { id: "calm", label: "Calm", description: "Settled, unhurried, slow to react." },
  { id: "cheerful", label: "Cheerful", description: "Warm, quick to brighten, easy to please." },
  { id: "quiet", label: "Quiet", description: "Reserved, comfortable with stillness and distance." },
  { id: "thoughtful", label: "Thoughtful", description: "Considered, a little more inward, drawn to reflection." },
  { id: "playful", label: "Playful", description: "Light, a little mischievous, quick to move." },
];

// "Should players describe traits with numeric selections, or should the
// game engine assign compatible traits automatically?" — this stays a
// deliberate, direct choice: up to two traits, made in Mission Control,
// nothing inferred or randomised on the person's behalf. Two (not one)
// leaves room for a resident to be, say, "curious and calm" rather than
// forcing a single flattening label — still small enough that every
// combination stays legible rather than becoming a personality quiz.
export const MAX_SELECTED_TRAITS = 2;

export function defaultTraitConfig() {
  return { selected: [], primary: null };
}

export function normalizeTraitConfig(config) {
  const defaults = defaultTraitConfig();
  if (!config) return defaults;
  const validIds = new Set(PERSONALITY_TRAITS.map((t) => t.id));
  const selected = Array.isArray(config.selected)
    ? [...new Set(config.selected)].filter((id) => validIds.has(id)).slice(0, MAX_SELECTED_TRAITS)
    : defaults.selected;
  // `primary` only ever means something when it's also selected — a stale
  // primary left over from a trait that was since deselected quietly falls
  // back to the first remaining selection instead, rather than pointing at
  // nothing.
  const primary = selected.includes(config.primary) ? config.primary : selected[0] ?? null;
  return { selected, primary };
}

export function traitLabel(id) {
  return PERSONALITY_TRAITS.find((t) => t.id === id)?.label ?? id;
}
