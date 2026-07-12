import { getIdleLocation } from "./ResidentMovement.js";
import { zoneLabel } from "./PlayerPatternMemory.js";
import { isRainingNow, isGoldenHourNow } from "./ResidentWorldSignals.js";

/**
 * ResidentCuriosity
 * -------------------
 * "Bubble should occasionally notice the Workshop around it... new
 * Builder creations, objects moved since yesterday, interesting weather,
 * favourite places, changes made by the player... these observations
 * should occur naturally within conversation rather than becoming
 * notifications." Concretely: `gatherNotes()` is only ever called once,
 * right as a conversation opens (`ResidentConversation.js`), and returns
 * plain sentences fed into `PromptComposer.composeSystemPrompt()`'s own
 * context — never shown directly, never a toast or a badge. Whether, or
 * how, any of it actually comes up is entirely the model's own to decide,
 * the same "context, not a script" standard `docs/RESIDENT.md` already
 * holds conversation to.
 *
 * `lastSeenObjectCount` is the one thing this class persists — just
 * enough to notice "something new exists since we last talked" without
 * re-announcing the same objects forever. It's deliberately a plain count,
 * not a diff of *which* objects — "the player built something new" is
 * plenty; itemising exactly what would read as a changelog, not a
 * housemate noticing something.
 */
export class ResidentCuriosity {
  constructor() {
    this.lastSeenObjectCount = 0;
    this._initialized = false;
  }

  /** Returns an array of short, plain-English observation strings — never
   *  more than a handful, since "a resident that notices five things at
   *  once" reads as anxious, not attentive. Updates `lastSeenObjectCount`
   *  every call, so the same new object is only ever mentioned as "new"
   *  once. */
  gatherNotes({ worldObjectsStore, environmentSystem, timeOfDaySystem, residentPreferences, playerPatternMemory }) {
    const notes = [];

    const currentCount = worldObjectsStore?.all().length ?? 0;
    if (!this._initialized) {
      // The very first time this ever runs (a brand new resident, or an
      // existing one that's simply never had a conversation yet) just
      // establishes the baseline — nothing "since we last talked" is true
      // yet, so there's nothing honest to report.
      this._initialized = true;
      this.lastSeenObjectCount = currentCount;
    } else if (currentCount > this.lastSeenObjectCount) {
      notes.push("Something new has been built in the Workshop since you last talked.");
      this.lastSeenObjectCount = currentCount;
    } else if (currentCount < this.lastSeenObjectCount) {
      // Something was removed rather than added — still worth an honest
      // baseline update, just not a "new object" note.
      this.lastSeenObjectCount = currentCount;
    }

    if (isRainingNow(environmentSystem)) {
      notes.push("It's raining outside right now.");
    } else if (isGoldenHourNow(timeOfDaySystem)) {
      notes.push("The sky outside has that warm, golden light right now.");
    }

    const favouriteLocationId = residentPreferences?.favourite("locations");
    if (favouriteLocationId) {
      const label = getIdleLocation(favouriteLocationId).label;
      notes.push(`Lately you've found yourself drawn to spending time ${label}.`);
    }

    const leadingZone = playerPatternMemory?.leadingZone();
    if (leadingZone) {
      notes.push(`You've noticed the player often spends time near ${zoneLabel(leadingZone)}.`);
    }

    const leadingTimeBucket = playerPatternMemory?.leadingTimeBucket();
    if (leadingTimeBucket) {
      notes.push(`You've noticed the player usually visits during the ${leadingTimeBucket}.`);
    }

    return notes;
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { lastSeenObjectCount: this.lastSeenObjectCount, initialized: this._initialized };
  }

  load(data) {
    if (!data) return;
    this.lastSeenObjectCount = data.lastSeenObjectCount ?? 0;
    this._initialized = data.initialized ?? false;
  }
}
