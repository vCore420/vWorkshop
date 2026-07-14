import { isRainingNow, isGoldenHourNow, currentTimeBucket, currentWeatherId } from "../resident/ResidentWorldSignals.js";

/**
 * WorldAwareness
 * ----------------
 * "Rather than individual systems inventing their own logic, they should
 * all observe the same world state." Before this phase, "is it raining,"
 * "what time bucket is it," and "is there an active project" were each
 * answered — correctly — by whichever system happened to need the
 * answer, reaching directly into `EnvironmentSystem`/`TimeOfDaySystem`/
 * `ProjectsStore` itself (`ResidentController.js`'s own
 * `_windowWatchWeights()`/`_maybeDriftMood()` are the clearest example —
 * see `ResidentWorldSignals.js`'s own comment on why *those* two
 * questions already got pulled into one shared place). This file is the
 * next, more general step: one small, read-only class that answers "what
 * does the world look like right now" as a single, consistent snapshot —
 * not a new source of truth (it owns no state of its own at all), just
 * the one place that already knows *where* every piece of that truth
 * lives, so a future consumer (a second resident, a Being, a plugin)
 * never needs to learn six different systems' own APIs just to ask "is
 * anyone nearby, and what's the weather like."
 *
 * **Deliberately query-based, not event-based.** `snapshot()` is called
 * whenever a consumer actually wants to know something (`ResidentController
 * .js`'s own slow pattern-sampling timer, say) — there's no
 * "world-awareness:changed" event firing every frame for data most
 * consumers only check occasionally anyway. A future consumer that
 * *does* want to react the instant something changes should listen to
 * the same underlying events this class itself reads from
 * (`environment:changed`, `timeofday:changed`, and so on) — this class
 * doesn't wrap or replace those, only summarises their current state on
 * demand.
 *
 * **Every field is optional-chained and every dependency is optional.**
 * A Workshop with no `musicSystem` wired in (a test harness, a future
 * stripped-down embed) still gets a valid snapshot back — `music: null`
 * instead of a thrown error — the same "an absent dependency degrades
 * gracefully, never crashes" standard every other cross-system read in
 * this codebase already holds itself to.
 */
export class WorldAwareness {
  constructor({
    timeOfDaySystem,
    environmentSystem,
    musicSystem,
    cameraSystem,
    projectsStore,
    beingInstanceStore,
    residentState,
    worldEventLog,
  } = {}) {
    this._timeOfDaySystem = timeOfDaySystem;
    this._environmentSystem = environmentSystem;
    this._musicSystem = musicSystem;
    this._cameraSystem = cameraSystem;
    this._projectsStore = projectsStore;
    this._beingInstanceStore = beingInstanceStore;
    this._residentState = residentState;
    this._worldEventLog = worldEventLog;
  }

  /** "Time, date, weather, current atmosphere, music, lighting, nearby
   *  residents, nearby beings, player location, current room, current
   *  project, recent interactions, recent events" — the brief's own list,
   *  answered as one plain object. Cheap enough to call often (every
   *  field is either already-computed state or a short array filter, no
   *  new work invented here), but still meant for "ask when you actually
   *  need to know," not "poll every frame." */
  snapshot() {
    const hour = this._timeOfDaySystem?.currentTime ?? 12;
    const timeBucket = currentTimeBucket(this._timeOfDaySystem);
    const weatherId = currentWeatherId(this._environmentSystem);

    return {
      time: {
        hour,
        bucket: timeBucket,
        isNight: timeBucket === "night",
        isGoldenHour: isGoldenHourNow(this._timeOfDaySystem),
      },
      weather: {
        id: weatherId,
        isRaining: isRainingNow(this._environmentSystem),
      },
      music: this._musicSystem ? { isPlaying: !!this._musicSystem.isPlaying, songTitle: this._musicSystem.currentSong?.title ?? null } : null,
      player: this._cameraSystem ? { position: this._cameraSystem.position } : null,
      room: "workshop", // the one room the Workshop currently has — see docs/WORLD.md's own account of why this stays a plain constant rather than a real lookup until a second room exists
      activeProjects: this._projectsStore?.byStatus("active") ?? [],
      nearbyBeings: this._beingInstanceStore?.all().filter((b) => !b.despawned) ?? [],
      residentMood: this._residentState?.mood ?? null,
      recentEvents: this._worldEventLog?.recent() ?? [],
    };
  }
}
