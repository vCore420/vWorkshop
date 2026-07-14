import { EventBus } from "../core/EventBus.js";

const MAX_ENTRIES = 40; // "the goal is not infinite history. The goal is meaningful history." Enough to feel like a real memory of the last while, small enough to never need summarising or pruning logic of its own.

/**
 * WorldEventLog
 * ---------------
 * "Begin introducing lightweight world events... weather changing,
 * sunrise, sunset, music beginning, projects continuing, residents
 * moving... nothing should feel scripted. Everything should simply feel
 * like the world continuing." A small, bounded, persisted list of
 * `{type, summary, at}` entries — real moments the Workshop already
 * generates on its own (a weather change, a sunrise, a song starting),
 * simply *noticed and kept* rather than vanishing the instant they
 * happen. This is a record, not a trigger — nothing here fires an
 * event or drives any behaviour by itself; `WorldAwareness.snapshot()`'s
 * own `recentEvents` is how anything downstream actually reads it.
 *
 * **Populated entirely by listening to events other systems already
 * emit** (`main.js`'s own wiring — see docs/WORLD.md's own "World
 * Events" section) — this class never invents a new signal, only keeps
 * a running memory of ones that already exist:
 * `environment:changed` (a genuine weather change, not every frame's
 * own gradual fog/cloud easing), `timeofday:changed` (the specific
 * moment day crosses into night or back), `music:playbackStateChanged`
 * (a song actually starting), and a couple of others — see `main.js`'s
 * own subscriptions for the complete list.
 */
export class WorldEventLog {
  constructor() {
    this.events = new EventBus();
    /** @type {Array<{type:string, summary:string, at:string}>} */
    this.entries = [];
  }

  /** `type` is a short, stable id (`"weatherChanged"`, `"sunrise"`,
   *  `"musicStarted"`, ...) — deliberately not enumerated as a fixed
   *  list anywhere, the same "a plain string tag, not a rigid enum"
   *  choice `ProjectsStore.js`'s own `kind` field already makes,
   *  since new event types are exactly the kind of thing a future
   *  system should be free to add without editing this file. `summary`
   *  is the one plain-language sentence anything downstream (a
   *  resident's own curiosity notes, a future Mission Control log)
   *  would actually want to show; this class itself never generates
   *  one, only stores whichever it's handed. */
  record(type, summary) {
    this.entries.push({ type, summary, at: new Date().toISOString() });
    if (this.entries.length > MAX_ENTRIES) this.entries.shift();
    this.events.emit("worldEvents:changed", this.entries);
    this.events.emit("persistence:saveRequested");
  }

  /** Most recent first — the order anything summarising "what's been
   *  happening" would actually want to read them in. */
  recent(count = MAX_ENTRIES) {
    return this.entries.slice(-count).reverse();
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { entries: this.entries };
  }

  load(data) {
    if (Array.isArray(data?.entries)) this.entries = data.entries.slice(-MAX_ENTRIES);
  }
}
