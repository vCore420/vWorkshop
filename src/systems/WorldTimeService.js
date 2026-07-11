/**
 * WorldTimeService
 * ------------------
 * "Please avoid every system individually calculating elapsed time.
 * Instead, introduce a shared persistence service responsible for:
 * session timestamps, elapsed real-world time, world continuation
 * helpers." This is that service — the one place "how long was the
 * player away?" gets computed, so Bubble, Beings, and the environment
 * all agree on the same answer rather than each keeping its own clock.
 *
 * **Timing, precisely**: `PersistenceSystem.js` already writes
 * `savedAt` into every save envelope — this service doesn't duplicate
 * that storage, it just reads the one that was already there. Right
 * after `_loadFromStorage()` finishes applying everyone's own saved
 * state (every system's own `persistence:load` handler has already run,
 * since `EventBus.emit()` is synchronous), `PersistenceSystem` emits
 * `"world:continuityReady"` with the raw timestamps; this service turns
 * that into the one clean, reusable `"world:continuity"` event —
 * `{elapsedMs, elapsedSeconds, cappedElapsedSeconds, isFirstSession}` —
 * every continuity-aware system (`ResidentController`, `BeingController`,
 * `EnvironmentSystem`) listens for exactly once, per session, to do its
 * own catch-up.
 *
 * **A deliberate cap, not true simulation.** "Simple continuity is
 * sufficient" — `cappedElapsedSeconds` never exceeds `MAX_CATCHUP_SECONDS`
 * (see below), so a Workshop reopened after a month doesn't try to
 * simulate weeks of wandering; it just picks something newly plausible,
 * the same way it would after a shorter, ordinary gap. `elapsedSeconds`
 * (uncapped) is still exposed for anything that only wants to know
 * "was this a long time?" without needing the exact duration.
 */

const MAX_CATCHUP_SECONDS = 60 * 60 * 6; // 6 hours — long enough to feel like "a good while," short enough that no consumer needs to simulate anything resembling real elapsed days

export class WorldTimeService {
  constructor() {
    this.sessionStartedAt = new Date();
    this.lastSavedAt = null; // Date | null — null means either a brand new Workshop, or continuity hasn't resolved yet this session
    this.isFirstSession = true;
    this.elapsedMs = 0;
    this.elapsedSeconds = 0;
    this.cappedElapsedSeconds = 0;
    this._resolved = false; // true once world:continuityReady has actually been handled — see waitForContinuity()
  }

  init(engine) {
    this.engine = engine;
    engine.events.on("world:continuityReady", ({ lastSavedAt, now }) => this._resolve(lastSavedAt, now));
  }

  _resolve(lastSavedAt, now) {
    this.isFirstSession = !lastSavedAt;
    this.lastSavedAt = lastSavedAt ? new Date(lastSavedAt) : null;
    this.elapsedMs = this.lastSavedAt ? Math.max(0, now.getTime() - this.lastSavedAt.getTime()) : 0;
    this.elapsedSeconds = this.elapsedMs / 1000;
    this.cappedElapsedSeconds = Math.min(this.elapsedSeconds, MAX_CATCHUP_SECONDS);
    this._resolved = true;

    this.engine.events.emit("world:continuity", {
      elapsedMs: this.elapsedMs,
      elapsedSeconds: this.elapsedSeconds,
      cappedElapsedSeconds: this.cappedElapsedSeconds,
      isFirstSession: this.isFirstSession,
    });
  }

  /** For a system that initializes after continuity has already resolved
   *  (or that just prefers to pull rather than listen) — same values the
   *  "world:continuity" event already carried. */
  getContinuity() {
    return {
      elapsedMs: this.elapsedMs,
      elapsedSeconds: this.elapsedSeconds,
      cappedElapsedSeconds: this.cappedElapsedSeconds,
      isFirstSession: this.isFirstSession,
    };
  }

  update(_dt) {}
}
