import { getIdleLocation } from "../resident/ResidentMovement.js";

/**
 * ResidentService
 * -----------------
 * "Resident Service" is one of the nine services this phase's own brief
 * names for the Host to expose. Like `AssetService.js`, this one is
 * genuinely real rather than honestly-empty — Bubble and
 * `ResidentProfileStore` already exist (see docs/RESIDENT.md,
 * docs/AI.md); what didn't exist was a Host-level way to ask "what
 * residents are prepared, and how is the currently-embodied one doing"
 * without every consumer importing `ResidentProfileStore`/
 * `ResidentState`/`ConversationMemory` individually.
 *
 * `resident://` pages (see `HostPages.js`) and `host://services`'
 * Dashboard both read this rather than reaching into
 * `ResidentProfileStore` directly — the same "the Host understands X
 * independently of whichever app happens to display X" property
 * `AssetService.js` already establishes for the Shared Asset Library.
 * `workshop://residents` (a Browser page, predates this service) still
 * reads its stores directly rather than being retrofitted onto this
 * service this phase — a reasonable seam, not an inconsistency: that
 * page is specifically a *read-only Browser view*, while this service
 * exists for the Host's own cross-cutting purposes (Dashboard status,
 * `resident://` pages, and any future service that needs to know "is
 * there a resident" without caring about the Browser at all).
 */
export class ResidentService {
  constructor({ residentProfileStore, residentState, residentBehaviour, conversationMemory } = {}) {
    this._residentProfileStore = residentProfileStore;
    this._residentState = residentState;
    this._residentBehaviour = residentBehaviour;
    this._conversationMemory = conversationMemory;
  }

  listResidents() {
    return this._residentProfileStore?.all() ?? [];
  }

  /** `null` if no resident is currently embodied at all (shouldn't
   *  happen in practice — `ResidentProfileStore` always seeds one — but
   *  a Host-level consumer shouldn't have to assume that invariant holds
   *  forever). */
  activeResidentSummary() {
    const profile = this._residentProfileStore?.getActive();
    if (!profile) return null;
    return {
      name: profile.name,
      provider: profile.provider,
      model: profile.model,
      mood: this._residentState?.mood ?? "unknown",
      activity: this._residentBehaviour?.mode === "conversing" ? "In conversation" : "Going about its day",
      location: this._residentState?.idleLocationId ? getIdleLocation(this._residentState.idleLocationId).label : "Unknown",
      thingsRemembered: this._conversationMemory?.notes.length ?? 0,
    };
  }

  getStatus() {
    const count = this.listResidents().length;
    return {
      available: count > 0,
      summary: count > 0 ? `${count} resident profile${count === 1 ? "" : "s"} prepared.` : "No resident profiles exist yet.",
    };
  }
}
