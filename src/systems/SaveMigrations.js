import { DEFAULT_BEINGS, BUBBLE_DEFINITION_ID } from "../beings/DefaultBeings.js";

/**
 * SaveMigrations
 * ----------------
 * "The Workshop itself should continue evolving between versions while
 * preserving everything the player has personally created." This is the
 * long-term mechanism for that: each numbered entry migrates a save
 * envelope from its own version to the *next* one up (the `1` entry takes
 * a v1-shaped envelope and returns a v2-shaped one). `migrateEnvelope()`
 * applies every migration in order, one version at a time, until the
 * envelope is caught up to `CURRENT_SAVE_VERSION` — so a save can be
 * several versions old and still migrate through each intermediate step
 * correctly, not just jump straight to the latest shape.
 *
 * A version doesn't need an entry here unless it actually changed what a
 * save *means* — a field renamed, removed, restructured, or (as below)
 * moved from "saved and restored" to "always the Workshop's current
 * default." Versions that only added a brand new provider/field don't
 * need a migration at all: a fresh field is simply absent from an old
 * save, and every store already handles that (`data?.field ?? default`)
 * the same way it handles a first-ever launch.
 *
 * Add a new entry here — keyed by the version it migrates *from* — every
 * time a change to the Workshop would otherwise leave old saves stuck
 * with a stale or now-meaningless shape.
 */

export const CURRENT_SAVE_VERSION = 7;

const MIGRATIONS = {
  // v1 -> v2: furniture position/rotation used to be saved and blindly
  // restored on every load, even though nothing in the Workshop actually
  // let a player customise it — meaning a genuine Workshop layout change
  // (the reading corner's redesign; this version's door/light-switch/
  // chair changes) never reached anyone's existing save, since the old,
  // frozen position from whenever they first saved always overwrote the
  // new default. Furniture placement now always comes from the Workshop's
  // own current layout (src/data/layoutDefault.js) — see
  // FurnitureSystem.js's own comment on why it no longer registers
  // persistence handlers at all. This migration just clears the old,
  // now-unused frozen positions out of existing saves so they don't sit
  // around doing nothing.
  1: (envelope) => {
    if (envelope.systems?.furniture) {
      delete envelope.systems.furniture;
    }
    return envelope;
  },
  // v2 -> v3: WeatherSystem's three states (clear/cloudy/rain), saved as
  // `{current, autoCycle}`, became EnvironmentSystem's ten states and
  // three modes, saved as an entirely different shape — see
  // docs/WORLD.md's Environment System section. Rather than just
  // discarding whatever a player had last chosen, this maps their old
  // pick onto its closest new equivalent and carries it forward as an
  // explicit Manual choice — someone who'd deliberately picked a weather
  // state before shouldn't silently be switched into Workshop Dynamic
  // without ever having asked for that.
  2: (envelope) => {
    const oldWeather = envelope.systems?.weather;
    if (oldWeather) {
      const mapped = { clear: "clear", cloudy: "overcast", rain: "lightRain" }[oldWeather.current] ?? "clear";
      envelope.systems.environment = {
        mode: "manual",
        current: mapped,
        manualState: mapped,
        enteredAt: Date.now(),
        windDirectionRad: 0,
      };
      delete envelope.systems.weather;
    }
    return envelope;
  },
  // v3 -> v4: "One contribution" (docs/CONTRIBUTIONS.md) — the computer's
  // Journal app moved off NotesStore's single-overwriting text blob onto
  // JournalStore's own dated, multi-entry list (see JournalStore.js's own
  // top comment for why). Whatever a player had already written under the
  // old "computer-journal" notebook key shouldn't just vanish the moment
  // this ships — it becomes that player's first real Journal entry,
  // dated to whenever it was last actually written rather than to right
  // now. The old NotesStore data itself is left untouched (the physical
  // workbench notebook still reads other keys from that exact same
  // store), so this is purely additive.
  3: (envelope) => {
    const legacyText = envelope.providers?.notes?.notebooks?.["computer-journal"];
    if (legacyText?.text?.trim()) {
      envelope.providers = envelope.providers ?? {};
      const when = legacyText.updatedAt ?? new Date().toISOString();
      envelope.providers.journal = {
        entries: [{ id: `migrated-${when}`, createdAt: when, updatedAt: when, text: legacyText.text }],
      };
    }
    return envelope;
  },
  // v4 -> v5: Version 4, Phase 1 ("Host, Actually Reaching Your Files") —
  // PermissionsService's single `filesystem` grant split into
  // `filesystem-read` and `filesystem-write` (see PermissionsService.js's
  // own comment on why: reading and writing became genuinely different
  // capabilities with genuinely different risk, not just one bridge to
  // gate). A player who'd already granted the old blanket `filesystem`
  // keeps exactly the behaviour they had — listing/reading keeps working,
  // nothing regresses — by becoming `filesystem-read: true`. It does
  // *not* also become `filesystem-write: true`: writing is a strictly
  // more powerful, newly-real capability nobody actually consented to
  // yet, and "granted" stays an explicit opt-in here the same way it's
  // been since this service's very first version.
  4: (envelope) => {
    const grants = envelope.providers?.hostPermissions?.grants;
    if (grants && typeof grants.filesystem === "boolean") {
      grants["filesystem-read"] = grants.filesystem;
      delete grants.filesystem;
    }
    return envelope;
  },
  // v5 -> v6: Version 4, Phase 7 ("Being ↔ Resident Convergence") —
  // Bubble stopped being a singular ResidentController and became a real
  // BeingLibrary definition/instance, like every other Being. Three
  // things this migration has to get right so a real player's actual
  // relationship with her survives intact, not resets:
  //   1. Her own seeded definition (DefaultBeings.js's own
  //      BUBBLE_DEFINITION_ID) needs to actually exist in this save's own
  //      beingLibrary — BeingLibrary.load()'s own "respect saved data
  //      as-is" rule means a save that already has ANY Being data
  //      (Person/Cat/Dog, or a player's own creations) never re-seeds new
  //      starter entries, so her definition would otherwise simply be
  //      missing. A save with no Being data at all needs nothing here —
  //      BeingLibrary's own re-seed path already adds her.
  //   2. A real placed instance of her needs to exist in beingInstances —
  //      main.js's own boot-time reconciliation only creates one if
  //      she's genuinely never existed at all; this migration positions
  //      her at exactly where she actually was, not a fresh default spot.
  //   3. Her five old flat singleton providers (residentState/
  //      residentPreferences/playerPatternMemory/residentCuriosity/
  //      conversationMemory) move into the new beingResidentState
  //      provider's own per-instance-keyed map, under her new instance's
  //      own id — real conversation history, mood, and preferences,
  //      never reset to blank.
  5: (envelope) => {
    envelope.providers = envelope.providers ?? {};
    const oldResidentState = envelope.providers.residentState ?? null;
    const oldResidentPreferences = envelope.providers.residentPreferences ?? null;
    const oldPlayerPatternMemory = envelope.providers.playerPatternMemory ?? null;
    const oldResidentCuriosity = envelope.providers.residentCuriosity ?? null;
    const oldConversationMemory = envelope.providers.conversationMemory ?? null;

    envelope.providers.beingLibrary = envelope.providers.beingLibrary ?? {};
    envelope.providers.beingLibrary.beings = envelope.providers.beingLibrary.beings ?? {};
    const hadNoBeingsAtAll = Object.keys(envelope.providers.beingLibrary.beings).length === 0;
    if (!hadNoBeingsAtAll && !envelope.providers.beingLibrary.beings[BUBBLE_DEFINITION_ID]) {
      const seed = DEFAULT_BEINGS.find((b) => b.id === BUBBLE_DEFINITION_ID);
      if (seed) envelope.providers.beingLibrary.beings[BUBBLE_DEFINITION_ID] = structuredClone(seed);
    }
    // Resolved directly here, from the raw envelope, rather than left for
    // main.js's own boot-time reconciliation — that step runs *after*
    // every provider (including this one) has already loaded, which is
    // too late for the resident-capability check just below to see it.
    // Not overwritten if some earlier pass already resolved it.
    const bubbleDefinition = envelope.providers.beingLibrary.beings[BUBBLE_DEFINITION_ID];
    if (bubbleDefinition && !bubbleDefinition.residentProfileId) {
      bubbleDefinition.residentProfileId = envelope.providers.aiResidents?.activeProfileId ?? null;
    }

    // A save that never actually had a resident session (shouldn't
    // happen — ResidentProfileStore always seeds one — but this
    // migration doesn't assume it) needs neither an instance nor a
    // resident-state bundle created for her.
    if (oldResidentState || oldConversationMemory || oldResidentPreferences || oldPlayerPatternMemory || oldResidentCuriosity) {
      envelope.providers.beingInstances = envelope.providers.beingInstances ?? {};
      envelope.providers.beingInstances.instances = envelope.providers.beingInstances.instances ?? [];
      let bubbleInstance = envelope.providers.beingInstances.instances.find((i) => i.definitionId === BUBBLE_DEFINITION_ID);
      if (!bubbleInstance) {
        const pos = oldResidentState?.currentPosition;
        const position = pos ? [pos.x, pos.y, pos.z] : [0, 0, 0];
        const nextId = envelope.providers.beingInstances.nextId ?? envelope.providers.beingInstances.instances.length + 1;
        bubbleInstance = {
          id: nextId,
          definitionId: BUBBLE_DEFINITION_ID,
          name: null,
          position,
          rotationY: oldResidentState?.facingDirection ?? 0,
          homePosition: position,
          homeRadius: 2.5,
          currentAnimationClipId: null,
          currentState: "idle",
          despawned: false,
          createdAt: new Date().toISOString(),
        };
        envelope.providers.beingInstances.instances.push(bubbleInstance);
        envelope.providers.beingInstances.nextId = nextId + 1;
      }

      envelope.providers.beingResidentState = envelope.providers.beingResidentState ?? {};
      envelope.providers.beingResidentState[bubbleInstance.id] = {
        residentState: oldResidentState ?? undefined,
        residentPreferences: oldResidentPreferences ?? undefined,
        playerPatternMemory: oldPlayerPatternMemory ?? undefined,
        residentCuriosity: oldResidentCuriosity ?? undefined,
        conversationMemory: oldConversationMemory ?? undefined,
      };
    }

    delete envelope.providers.residentState;
    delete envelope.providers.residentPreferences;
    delete envelope.providers.playerPatternMemory;
    delete envelope.providers.residentCuriosity;
    delete envelope.providers.conversationMemory;
    return envelope;
  },
  // v6 -> v7: Version 4, Phase 7b ("Restoring Bubble's Own Embodiment") —
  // the v5->v6 migration above only ever adds Bubble's seed definition
  // when she's entirely missing from a save; a save that already had her
  // (every save that lived through Phase 7 itself) kept her old, now-
  // deleted primitives shape forever, since BeingLibrary.load() never
  // overwrites an existing definition with fresh seed data on its own.
  // This finds exactly that case — a persisted Bubble definition still on
  // the old `bodySource: "primitives"` — and brings only the fields that
  // describe *how she's drawn* up to the new `"residentEmbodiment"`
  // shape, leaving everything a player might actually have set for her
  // (name, residentProfileId, movementStyle, awarenessMode, and so on)
  // completely untouched.
  6: (envelope) => {
    const bubbleDefinition = envelope.providers?.beingLibrary?.beings?.[BUBBLE_DEFINITION_ID];
    if (bubbleDefinition && bubbleDefinition.bodySource !== "residentEmbodiment") {
      bubbleDefinition.bodySource = "residentEmbodiment";
      bubbleDefinition.bodyParts = [];
      bubbleDefinition.idleAnimationClipId = null;
      bubbleDefinition.walkAnimationClipId = null;
    }
    return envelope;
  },
};

/**
 * Returns a new envelope, migrated up to CURRENT_SAVE_VERSION. Safe to
 * call on an already-current envelope (a no-op past the while loop).
 */
export function migrateEnvelope(envelope) {
  const startingVersion = envelope.version ?? 1;
  let version = startingVersion;
  let migrated = envelope;
  while (version < CURRENT_SAVE_VERSION) {
    const migration = MIGRATIONS[version];
    if (!migration) break; // nothing registered for this step — stop rather than guess at a shape
    migrated = migration(migrated);
    version++;
  }
  migrated.version = version;
  if (version !== startingVersion) {
    console.info(`[Workshop] Save migrated from v${startingVersion} to v${version}.`);
  }
  return migrated;
}
