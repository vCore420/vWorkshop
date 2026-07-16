import { EventBus } from "../core/EventBus.js";

let _nextId = 1;

/**
 * PoseLibraryStore
 * ------------------
 * "Please introduce the foundations for a shared pose library... idle
 * poses, hand poses, interaction poses... these should become reusable
 * Workshop Assets." A pose is simply one frame, saved on its own — the
 * exact same `{jointName: [x,y,z]}` shape every animation clip's own
 * frame already uses (see `AnimationPlayback.js`), just without a
 * duration or a place in a sequence. The Animation Editor's own "Save
 * Current Frame as Pose" is the primary way one of these gets created;
 * nothing new needed to exist in the pose *format* itself.
 *
 * Registered as a Workshop Asset kind (`"poses"`, see `main.js`'s own
 * "Workshop Platform"/asset-kind wiring) the identical way Objects,
 * Blueprints, and Animations already are — a pose is searchable,
 * favouritable, and browsable in the Shared Asset Library exactly like
 * any other kind, with zero special-casing anywhere in `AssetService.js`
 * or `AssetPages.js`.
 */
export class PoseLibraryStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Array<object>} */
    this.poses = [];
  }

  create({ name, category = "custom", pose = {} } = {}) {
    const entry = {
      id: `pose-${_nextId++}`,
      name: name?.trim() || "Untitled pose",
      category,
      pose,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.poses.push(entry);
    this._emitChanged();
    return entry;
  }

  update(id, patch) {
    const entry = this.get(id);
    if (!entry) return null;
    Object.assign(entry, patch, { updatedAt: new Date().toISOString() });
    this._emitChanged();
    return entry;
  }

  rename(id, name) {
    const entry = this.get(id);
    if (!entry) return;
    entry.name = name?.trim() || entry.name;
    entry.updatedAt = new Date().toISOString();
    this._emitChanged();
  }

  remove(id) {
    this.poses = this.poses.filter((p) => p.id !== id);
    this._emitChanged();
  }

  get(id) {
    return this.poses.find((p) => p.id === id) ?? null;
  }

  all() {
    return [...this.poses];
  }

  _emitChanged() {
    this.events.emit("poses:changed", this.poses);
    this.events.emit("persistence:saveRequested");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { poses: this.poses };
  }

  load(data) {
    if (!data?.poses) return;
    this.poses = data.poses;
    const maxId = this.poses.reduce((m, p) => {
      const match = /^pose-(\d+)$/.exec(p.id ?? "");
      return match ? Math.max(m, parseInt(match[1], 10)) : m;
    }, 0);
    _nextId = maxId + 1;
    this.events.emit("poses:changed", this.poses);
  }
}
