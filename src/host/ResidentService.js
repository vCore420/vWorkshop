import { getIdleLocation } from "../resident/ResidentMovement.js";
import { BUBBLE_DEFINITION_ID } from "../beings/DefaultBeings.js";

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
 *
 * Version 4, Phase 7 ("Being ↔ Resident Convergence") — Bubble is a real
 * `BeingLibrary` instance now, not a singular `ResidentController`.
 * `activeResidentSummary()` describes her specifically (resolved via
 * `beingInstanceStore`/`beingResidentStateStore`), the same "keep
 * Bubble's own dashboard working, a genuine multi-resident view is
 * separate scope" decision every other Bubble-facing surface this phase
 * touched made too. One honest simplification: `activity` no longer
 * distinguishes "in conversation" — that lived on a `ResidentBehaviour`
 * that's now genuinely ephemeral, scoped to one open conversation
 * overlay, with nothing outside it left to read.
 */
export class ResidentService {
  constructor({ residentProfileStore, beingLibrary, beingInstanceStore, beingResidentStateStore } = {}) {
    this._residentProfileStore = residentProfileStore;
    this._beingLibrary = beingLibrary;
    this._beingInstanceStore = beingInstanceStore;
    this._beingResidentStateStore = beingResidentStateStore;
  }

  listResidents() {
    return this._residentProfileStore?.all() ?? [];
  }

  _bubbleInstance() {
    return this._beingInstanceStore?.all().find((i) => i.definitionId === BUBBLE_DEFINITION_ID) ?? null;
  }

  /** `null` if no resident is currently embodied at all (shouldn't
   *  happen in practice — Bubble is always seeded and migrated to a real
   *  Being instance — but a Host-level consumer shouldn't have to assume
   *  that invariant holds forever). Resolved via Bubble's own specific
   *  `residentProfileId`, not `residentProfileStore.getActive()` — the
   *  editor's own "active" profile for editing purposes may not be the
   *  one actually embodying her right now. */
  activeResidentSummary() {
    const instance = this._bubbleInstance();
    const definition = instance ? this._beingLibrary?.get(instance.definitionId) : null;
    const profile = definition?.residentProfileId ? this._residentProfileStore?.get(definition.residentProfileId) : null;
    if (!profile) return null;
    const bundle = instance ? this._beingResidentStateStore?.get(instance.id) : null;
    return {
      name: profile.name,
      provider: profile.provider,
      model: profile.model,
      mood: bundle?.residentState?.mood ?? "unknown",
      activity: "Going about its day",
      location: bundle?.residentState?.idleLocationId ? getIdleLocation(bundle.residentState.idleLocationId).label : "Unknown",
      thingsRemembered: bundle?.conversationMemory?.notes.length ?? 0,
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
