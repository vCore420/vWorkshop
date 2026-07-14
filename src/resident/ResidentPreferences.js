import { EventBus } from "../core/EventBus.js";
import { bumpAffinity, leadingAffinity } from "../utils/AffinityTracker.js";

const MIN_SAMPLES = 8; // "quiet familiarity rather than prediction" — a favourite only reports once there's actually a pattern behind it

// A light, one-time starting nudge per trait — "a natural starting point,"
// the same spirit `EmbodimentConfiguration.js`'s own default teal already
// carries, not a rule that overrides what actually happens afterward.
// Organic reinforcement (see `bump()` below, called from
// `ResidentController.js`) dominates the longer a resident actually lives
// in the Workshop; this only keeps a brand-new resident from feeling
// completely blank on its very first sessions.
const TRAIT_WEATHER_SEED = {
  curious: "storm",
  calm: "lightRain",
  cheerful: "clear",
  quiet: "mist",
  thoughtful: "fog",
  playful: "partlyCloudy",
};
const SEED_AMOUNT = 3;

/**
 * ResidentPreferences
 * ----------------------
 * "Residents should begin forming preferences... favourite places,
 * favourite weather, favourite times of day, favourite music, favourite
 * activities... weighted choices are preferred [over rigid rules]." Four
 * plain `{key: count}` bags (see `AffinityTracker.js`), bumped a little at
 * a time by `ResidentController.js` as the resident actually goes about
 * its ordinary idle life — arriving somewhere, idling through whatever
 * weather happens to be active, noticing the time of day, noticing music
 * playing nearby. Nothing here is configured directly; a "favourite" is
 * whatever's actually accumulated the most real time, which is what makes
 * this "quiet familiarity" rather than a settings field the player fills
 * in on Bubble's behalf.
 *
 * `favourite(dimension)` intentionally returns `null` below `MIN_SAMPLES`
 * — a preference only becomes real once there's actually enough behind
 * it to call a pattern, not from the very first sample.
 */
export class ResidentPreferences {
  constructor() {
    this.events = new EventBus();
    this.locations = {};
    this.weather = {};
    this.timeOfDay = {};
    this.activities = {};
    // "Residents should become aware of one another... who they spend
    // time near." With a single AI resident, "one another" today means
    // Bubble and the Workshop's own Beings — a plain affinity bag keyed
    // by Being instance id, bumped whenever Bubble genuinely idles near
    // one (see `ResidentController._maybeSamplePatterns()`). "Lightweight
    // during this phase... a strong architectural foundation for future
    // development" is exactly this: the identical `bump()`/`favourite()`
    // mechanism every other dimension already uses, so a second AI
    // resident later needs no new relationship system of its own, just
    // its own instance of this same class.
    this.relationships = {};
    this._seeded = false;
  }

  /** Called once, only for a genuinely new resident (see
   *  `ResidentController.js`'s own `world:continuity` handling, gated on
   *  `isFirstSession`) — a small head start, not a permanent bias; see
   *  the module comment above. Safe to call more than once regardless,
   *  since `_seeded` (persisted) makes every call after the first a
   *  no-op. */
  seedFromTraits(traitsConfig) {
    if (this._seeded) return;
    this._seeded = true;
    for (const id of traitsConfig?.selected ?? []) {
      const weatherId = TRAIT_WEATHER_SEED[id];
      if (weatherId) bumpAffinity(this.weather, weatherId, SEED_AMOUNT);
    }
  }

  bump(dimension, key, amount = 1) {
    const bag = this[dimension];
    if (!bag || !key) return;
    bumpAffinity(bag, key, amount);
  }

  /** `dimension` is `"locations"` | `"weather"` | `"timeOfDay"` |
   *  `"activities"`. Returns the leading key, or `null` if there isn't
   *  enough behind it yet — see `MIN_SAMPLES` above. */
  favourite(dimension) {
    return leadingAffinity(this[dimension], MIN_SAMPLES);
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return {
      locations: this.locations,
      weather: this.weather,
      timeOfDay: this.timeOfDay,
      activities: this.activities,
      relationships: this.relationships,
      seeded: this._seeded,
    };
  }

  load(data) {
    if (!data) return;
    this.locations = data.locations ?? {};
    this.weather = data.weather ?? {};
    this.timeOfDay = data.timeOfDay ?? {};
    this.activities = data.activities ?? {};
    this.relationships = data.relationships ?? {};
    this._seeded = data.seeded ?? false;
  }
}
