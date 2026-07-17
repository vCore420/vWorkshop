/**
 * TimeFormat
 * ----------
 * Interface & Design Refinement phase — "consolidate duplicated interface
 * styling into reusable Workshop design components." The same instinct
 * applies to small shared logic, not just CSS: `formatClockTime()` was a
 * private function inside `SettingsApp.js`, duplicated here rather than
 * imported, the moment the Phone's own new status bar needed the exact
 * same "0-24 float hour to a real clock string" conversion.
 */

/** `hour` is `TimeOfDaySystem.currentTime` — a 0-24 float. Returns a
 *  24-hour "HH:MM" string, the same format a real device's own status
 *  bar clock and Settings' "Current time" row already both want. */
export function formatClockTime(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.round((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
