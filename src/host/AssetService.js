import { EventBus } from "../core/EventBus.js";
import { normalizeAssetDescriptor } from "./WorkshopAssetSchema.js";

const RECENT_LIMIT = 12; // "Recent Assets" — enough to feel useful, small enough to stay a quick glance, not a second full listing

/**
 * AssetService
 * --------------
 * "Every creative system should naturally build upon the same shared
 * asset architecture... the Workshop should no longer care where
 * something came from. Only what it is." This is that architecture —
 * every asset kind the Workshop actually has a library for (Objects,
 * Blueprints, Animations, Models, Images, Music, and anything a future
 * kind or plugin registers) described through one common envelope
 * (`WorkshopAssetSchema.js`), searched, favourited, and cross-referenced
 * through one shared mechanism, regardless of which store actually holds
 * the real data underneath.
 *
 * **Still a wrapper, not a replacement — same principle as the Workshop
 * Platform phase, taken further.** `registerKind()` now additionally
 * accepts `toDescriptor(item)` (mapping a kind's own real item into the
 * common descriptor shape) and `getDependencies(item)` (returning the
 * asset ids — `"kind:id"` strings — this item depends on). Both are
 * optional; a kind that registers neither still works, just with a
 * minimal descriptor and no known dependencies, which is exactly the
 * honest default for a kind (Models, Images, Music) that doesn't track
 * either yet.
 *
 * **Favourites and Recent are genuinely real and persisted** — plain
 * sets of asset ids, no different in kind from `ResidentPreferences.js`'s
 * own affinity bags, just applied to assets instead of places.
 *
 * **Search reads every registered kind's own descriptors** — "the
 * player should only need to learn one search experience." This is the
 * per-item indexing `SearchIndex.js`'s own comment explicitly invited a
 * future phase to add; `main.js` feeds `AssetService.search()`'s own
 * results into the shared `SearchIndex` the same way every page already
 * does, so `workshop://search` finds an individual asset by name exactly
 * the way it already finds a page.
 */
export class AssetService {
  constructor() {
    this.events = new EventBus();
    /** @type {Map<string, {id:string, label:string, all:Function, get:Function, toDescriptor:Function, getDependencies:Function, validateItem:Function}>} */
    this._kinds = new Map();
    /** @type {Set<string>} */
    this._favourites = new Set();
    /** @type {string[]} */
    this._recent = [];
  }

  registerKind(id, { label, all, get, toDescriptor, getDependencies, validateItem }) {
    this._kinds.set(id, {
      id,
      label,
      all: all ?? (() => []),
      get: get ?? (() => null),
      toDescriptor: toDescriptor ?? (() => ({})),
      getDependencies: getDependencies ?? (() => []),
      validateItem: validateItem ?? (() => []),
    });
  }

  kinds() {
    return [...this._kinds.values()].map(({ id, label }) => ({ id, label }));
  }

  all(kindId) {
    return this._kinds.get(kindId)?.all() ?? [];
  }

  get(kindId, itemId) {
    return this._kinds.get(kindId)?.get(itemId) ?? null;
  }

  /** One row per registered kind, with a live count. */
  summary() {
    return this.kinds().map((kind) => ({ ...kind, count: this.all(kind.id).length }));
  }

  getStatus() {
    const rows = this.summary();
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    return {
      available: rows.length > 0,
      summary: rows.length
        ? `${rows.length} asset kind${rows.length === 1 ? "" : "s"} registered, ${total} asset${total === 1 ? "" : "s"} total.`
        : "No asset kinds registered yet.",
    };
  }

  // ---- Identity ("avoid relying on filenames... reference assets by identity") ----

  assetId(kindId, itemId) {
    return `${kindId}:${itemId}`;
  }

  _parseAssetId(assetId) {
    const separator = assetId?.indexOf(":") ?? -1;
    if (separator < 0) return { kindId: null, itemId: null };
    return { kindId: assetId.slice(0, separator), itemId: assetId.slice(separator + 1) };
  }

  exists(assetId) {
    const { kindId, itemId } = this._parseAssetId(assetId);
    return !!this._kinds.get(kindId)?.get(itemId);
  }

  // ---- Descriptors ("every asset should share common information") ----

  _buildDescriptor(kindId, item) {
    const kind = this._kinds.get(kindId);
    const assetId = this.assetId(kindId, item.id);
    const partial = kind.toDescriptor(item) ?? {};
    const dependencies = kind.getDependencies(item) ?? [];
    const descriptor = normalizeAssetDescriptor({ assetId, type: kindId, dependencies, ...partial });
    descriptor.validationStatus = this._validateDescriptor(descriptor, kind, item);
    descriptor.isFavourite = this._favourites.has(assetId);
    return descriptor;
  }

  /** The full descriptor for one asset, or `null` if it doesn't exist —
   *  the one method most Browser pages actually call. */
  describe(assetId) {
    const { kindId, itemId } = this._parseAssetId(assetId);
    const kind = this._kinds.get(kindId);
    const item = kind?.get(itemId);
    return item ? this._buildDescriptor(kindId, item) : null;
  }

  allDescriptors(kindId) {
    const kind = this._kinds.get(kindId);
    if (!kind) return [];
    return kind.all().map((item) => this._buildDescriptor(kindId, item));
  }

  allDescriptorsAcrossKinds() {
    return this.kinds().flatMap((kind) => this.allDescriptors(kind.id));
  }

  // ---- Search ("a unified asset searching system... the player should only need to learn one search experience") ----

  search(query) {
    const q = (query ?? "").trim().toLowerCase();
    const all = this.allDescriptorsAcrossKinds();
    if (!q) return all;
    return all.filter(
      (d) => d.name.toLowerCase().includes(q) || d.categories.some((c) => c.toLowerCase().includes(q)) || d.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  // ---- Relationships & Dependencies ----

  /** What this asset depends on — real for kinds that registered
   *  `getDependencies()` (Blueprints depending on the Objects they're
   *  made of, today), an honestly empty array for every kind that
   *  hasn't, rather than a fabricated relationship. */
  getDependencies(assetId) {
    const { kindId, itemId } = this._parseAssetId(assetId);
    const kind = this._kinds.get(kindId);
    const item = kind?.get(itemId);
    return item ? kind.getDependencies(item) ?? [] : [];
  }

  /** The reverse direction — every other asset that depends on this one.
   *  Computed by scanning every registered kind's own dependencies for a
   *  match, rather than each kind maintaining its own reverse index —
   *  simple, and fast enough at the scale a single Workshop's own asset
   *  library actually reaches. */
  getUsedBy(assetId) {
    const usedBy = [];
    for (const kind of this.kinds()) {
      const kindEntry = this._kinds.get(kind.id);
      for (const item of kindEntry.all()) {
        const deps = kindEntry.getDependencies(item) ?? [];
        if (deps.includes(assetId)) usedBy.push(this.assetId(kind.id, item.id));
      }
    }
    return usedBy;
  }

  // ---- Validation ("quietly help the player identify potential problems before assets are used") ----

  _validateDescriptor(descriptor, kind, item) {
    const issues = [];
    if (!descriptor.thumbnail) issues.push("Missing thumbnail.");
    for (const depId of descriptor.dependencies) {
      if (!this.exists(depId)) issues.push(`Missing dependency: ${depId}.`);
    }
    issues.push(...(kind.validateItem(item) ?? []));
    return { valid: issues.length === 0, issues };
  }

  /** A convenience alias — `describe(assetId).validationStatus` is
   *  exactly this, kept as its own named method since "Validation" is
   *  called out as its own capability in this phase's own brief, worth
   *  being discoverable on its own rather than only as a descriptor
   *  field. */
  validate(assetId) {
    return this.describe(assetId)?.validationStatus ?? { valid: false, issues: ["Asset not found."] };
  }

  // ---- Favourites ----

  toggleFavourite(assetId) {
    if (this._favourites.has(assetId)) this._favourites.delete(assetId);
    else this._favourites.add(assetId);
    this._emitChanged();
  }

  isFavourite(assetId) {
    return this._favourites.has(assetId);
  }

  favourites() {
    return [...this._favourites].map((id) => this.describe(id)).filter(Boolean);
  }

  // ---- Recent ----

  /** Called whenever a Browser asset detail page is actually visited
   *  (see `AssetPages.js`) — "Recent Assets" reflects what's genuinely
   *  been looked at, not everything that merely exists. */
  touch(assetId) {
    this._recent = [assetId, ...this._recent.filter((id) => id !== assetId)].slice(0, RECENT_LIMIT);
    this._emitChanged();
  }

  recent() {
    return this._recent.map((id) => this.describe(id)).filter(Boolean);
  }

  _emitChanged() {
    this.events.emit("assets:changed");
    this.events.emit("persistence:saveRequested");
  }

  // ---- Optimisation, Import, Export ("prepare clean service boundaries... architecture should be established even where complete implementations are deferred") ----

  requestOptimization(_assetId, _kind = "general") {
    throw new Error("AssetService.requestOptimization() isn't implemented yet — LOD/collision/texture/mesh optimisation all remain a future Host capability.");
  }

  requestImport(_sourcePath) {
    throw new Error("AssetService.requestImport() isn't implemented yet — the Workshop Host doesn't have a bridge to import external files yet.");
  }

  requestExport(_assetId, _destinationPath) {
    throw new Error("AssetService.requestExport() isn't implemented yet — the Workshop Host doesn't have a bridge to export files yet.");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { favourites: [...this._favourites], recent: this._recent };
  }

  load(data) {
    if (Array.isArray(data?.favourites)) this._favourites = new Set(data.favourites);
    if (Array.isArray(data?.recent)) this._recent = data.recent;
  }
}
