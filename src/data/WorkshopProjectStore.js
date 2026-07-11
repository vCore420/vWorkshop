import { EventBus } from "../core/EventBus.js";

/**
 * WorkshopProjectStore
 * ----------------------
 * "Please begin preparing for long-running Workshop activities...
 * future workbench projects, future construction, future automation...
 * this phase does not need to fully implement these future systems.
 * Simply prepare the architecture for them."
 *
 * A long-running activity here is nothing more than
 * `{id, name, kind, startedAt, durationSeconds}` — a real timestamp and
 * a duration, the same "elapsed real-world time" idea the rest of this
 * phase is built around, not a per-frame timer or a tick counter that
 * would freeze the moment the Workshop itself isn't running. `progress()`
 * is a pure function of `Date.now()`, so a project genuinely finishes on
 * schedule whether or not anyone had the Workshop open at that moment —
 * "activities progressing naturally over time," not merely "while the
 * game happens to be running."
 *
 * **Deliberately not wired to anything yet.** No workbench UI creates
 * one, nothing displays one; this is the storage/computation half only,
 * ready for a future phase's own "start a project" action to actually
 * call `create()`. See docs/PERSISTENCE.md's own "Future extension
 * points" for how a future Workbench/Construction/Automation phase would
 * plug into this without changing this file at all.
 */
export class WorkshopProjectStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Record<string, {id:string, name:string, kind:string, startedAt:string, durationSeconds:number, completed:boolean}>} */
    this.projects = {};
  }

  /** `kind` is a free-form string a future system defines meaning for
   *  (e.g. "workbench", "construction", "automation") — this store has
   *  no opinion on what any of them actually do once complete. */
  create(name, kind, durationSeconds) {
    const id = `project-${Date.now()}-${Math.round(Math.random() * 10000)}`;
    this.projects[id] = { id, name, kind, startedAt: new Date().toISOString(), durationSeconds, completed: false };
    this._emitChanged();
    return this.projects[id];
  }

  /** 0-1, purely a function of real elapsed time — never advanced by a
   *  per-frame tick, so it's exactly as correct after a week away as
   *  after a minute. */
  progress(id) {
    const project = this.projects[id];
    if (!project) return 0;
    const elapsedMs = Date.now() - new Date(project.startedAt).getTime();
    return Math.max(0, Math.min(1, elapsedMs / (project.durationSeconds * 1000)));
  }

  isComplete(id) {
    return this.progress(id) >= 1;
  }

  /** Marks a finished project acknowledged/collected — a future system's
   *  own concern for what "completing" a project actually produces. */
  markCompleted(id) {
    if (!this.projects[id]) return;
    this.projects[id].completed = true;
    this._emitChanged();
  }

  remove(id) {
    delete this.projects[id];
    this._emitChanged();
  }

  all() {
    return Object.values(this.projects);
  }

  _emitChanged() {
    this.events.emit("workshopProjects:changed");
    this.events.emit("persistence:saveRequested");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { projects: this.projects };
  }

  load(data) {
    if (!data) return;
    this.projects = data.projects ?? {};
    this.events.emit("workshopProjects:changed");
  }
}
