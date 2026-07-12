/**
 * AssetService
 * --------------
 * "Begin preparing the Host for the future Shared Asset Library... the
 * Host should understand assets independently of the Builder or
 * Browser... future systems should naturally build upon this service."
 *
 * Unlike most Host services, this one isn't honestly-empty-and-waiting —
 * it's genuinely real today, because every asset kind it knows about
 * already has a genuinely real backing store (`ObjectLibraryStore`,
 * `BlueprintStore`, `AnimationLibraryStore`, `ModelLibrary`,
 * `ImageLibraryStore`, `MusicLibraryStore`). There was nothing to fake
 * here — the Workshop already has real assets; what it didn't have was
 * one place the Host itself could ask "what asset kinds exist, and how
 * many of each" without importing every individual store by name.
 *
 * **Dynamic registration, not a hardcoded kind list.** `registerKind()`
 * is called once per kind, from `main.js`, after each backing store
 * already exists (the exact same "register once every dependency is
 * real" timing `WorkshopPages.js`/`AssetPages.js` already use for page
 * registration — see their own comments) — this class itself never
 * imports a single library store. "Avoid hardcoded systems wherever
 * possible... assets should be capable of registering themselves with
 * the Host" is true by construction: a future asset kind (Materials,
 * Textures, Audio, Particles — all explicitly named in this phase's own
 * brief but without a dedicated store of their own yet) is one
 * `registerKind()` call away from appearing everywhere this service is
 * already consulted (`asset://`, `host://services`, Workshop
 * Diagnostics), with zero changes to this file.
 *
 * `all`/`get` are plain functions the registering system already has
 * lying around (usually just `store.all.bind(store)` and
 * `store.get.bind(store)`) — this service never touches a store
 * directly, only the two functions it was handed.
 */
export class AssetService {
  constructor() {
    /** @type {Map<string, {id:string, label:string, all:Function, get:Function}>} */
    this._kinds = new Map();
  }

  registerKind(id, { label, all, get }) {
    this._kinds.set(id, { id, label, all: all ?? (() => []), get: get ?? (() => null) });
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

  /** One row per registered kind, with a live count — the exact shape
   *  `workshop://assets`/`asset://` render directly, and the same shape
   *  `host://services`' own Dashboard reads for its "Services" section
   *  via `getStatus()` below. */
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
}
