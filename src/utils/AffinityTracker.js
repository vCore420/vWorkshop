/**
 * AffinityTracker
 * -----------------
 * "Preferences should gently influence behaviour... weighted choices are
 * preferred [over] rigid rules" and "the goal is quiet familiarity rather
 * than prediction" describe the exact same shape of data twice, for two
 * different subjects — `ResidentPreferences.js` tracks what *Bubble*
 * gravitates toward, `PlayerPatternMemory.js` tracks what the *player's*
 * own habits look like. Both are a plain `{ key: count }` object, bumped
 * a little every time something relevant happens, with a "what's leading,
 * and is it actually meaningful yet" reader — small enough that giving it
 * its own two functions, shared by both, was clearly better than each
 * store quietly reinventing the same counting logic.
 */

/** Increments `counts[key]` by `amount`, creating it at 0 first if it's
 *  new. Mutates and returns `counts` — callers keep their own plain
 *  object as the source of truth (and its own persistence shape),
 *  this just does the arithmetic. */
export function bumpAffinity(counts, key, amount = 1) {
  if (!counts || !key) return counts;
  counts[key] = (counts[key] ?? 0) + amount;
  return counts;
}

/** The leading key in `counts`, or `null` if there isn't enough data yet
 *  to call it a pattern — "quiet familiarity rather than prediction"
 *  means a single early observation should never already read as a
 *  settled favourite. `minSamples` (total across every key, not just the
 *  leader) is the honesty threshold; ties keep whichever key was seen
 *  first, which is fine — this never needs to be exact, only plausible. */
export function leadingAffinity(counts, minSamples = 8) {
  if (!counts) return null;
  const entries = Object.entries(counts);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total < minSamples) return null;
  let bestKey = null;
  let bestCount = -Infinity;
  for (const [key, count] of entries) {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  }
  return bestKey;
}
