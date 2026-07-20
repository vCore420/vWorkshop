/**
 * TimeFormat
 * ----------
 * Interface & Design Refinement phase — "consolidate duplicated interface
 * styling into reusable Workshop design components." The same instinct
 * applies to small shared logic, not just CSS: `formatClockTime()` was a
 * private function inside `SettingsApp.js`, duplicated here rather than
 * imported, the moment the Phone's own new status bar needed the exact
 * same "0-24 float hour to a real clock string" conversion.
 *
 * Version 3, Phase 13 ("The Phone Becomes a Device") — "a 24-hour/12-hour
 * time format toggle belongs in the time settings on both the PC and the
 * Phone, the same setting, both surfaces." `format` reads directly from
 * `SettingsStore.get("display").timeFormat` at every call site (PC
 * Settings' own Date & Time section, Phone Settings, PhoneSystem's status
 * bar) — one preference, applied consistently everywhere a clock is
 * drawn, not three independent copies of the choice.
 */

/** `hour` is `TimeOfDaySystem.currentTime` — a 0-24 float. `format`
 *  is `"24h"` (default, "HH:MM") or `"12h"` ("H:MM AM/PM"). */
export function formatClockTime(hour, format = "24h") {
  let h = Math.floor(hour) % 24;
  let m = Math.round((hour - Math.floor(hour)) * 60);
  // A fractional part just under the next minute (e.g. 5.999h) rounds up
  // to a literal 60 — rolled into the next minute/hour here rather than
  // ever displaying ":60".
  if (m === 60) {
    m = 0;
    h = (h + 1) % 24;
  }
  if (format === "12h") {
    const period = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
