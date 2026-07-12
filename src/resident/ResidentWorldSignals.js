/**
 * ResidentWorldSignals
 * ----------------------
 * A handful of small, pure readers over `EnvironmentSystem`/
 * `TimeOfDaySystem` — "a third consumer was reason enough to stop
 * duplicating it" is `EnvironmentSystem.getEffectivePrecipitation()`'s
 * own stated reasoning (see its own comment), and it applies exactly as
 * much here: `ResidentController._windowWatchWeights()` already computed
 * "is it raining, is it golden hour" for Phase 31C's own quiet habit;
 * `ResidentPreferences` (affinity tracking) and `ResidentCuriosity`
 * (conversation-time observations) both need the same two questions
 * answered this phase, so this is that shared, single place, rather than
 * a third and fourth inline copy of the same two checks.
 */

export function isRainingNow(environmentSystem) {
  if (!environmentSystem) return false;
  return environmentSystem.getEffectivePrecipitation() > 0;
}

/** The same golden-hour window `TimeOfDaySystem._computeState()` already
 *  uses for the sun's own colour shift — not a new concept, just read
 *  from a second place now. */
export function isGoldenHourNow(timeOfDaySystem) {
  if (!timeOfDaySystem) return false;
  const hour = timeOfDaySystem.currentTime;
  return (hour > 5 && hour < 8) || (hour > 16 && hour < 19);
}

/** A coarse four-way bucket for "behaviour memory"/"preferences" affinity
 *  tracking — deliberately coarser than `TimeOfDaySystem`'s own precise
 *  hour, since "the player usually visits in the evening" only needs to
 *  be roughly true, not timestamped to the minute. */
export function currentTimeBucket(timeOfDaySystem) {
  const hour = timeOfDaySystem?.currentTime ?? 12;
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export function currentWeatherId(environmentSystem) {
  return environmentSystem?.getState()?.current ?? "clear";
}
