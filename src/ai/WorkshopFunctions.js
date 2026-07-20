import { WEATHER_STATES } from "../systems/EnvironmentSystem.js";
import { CONSTRUCTION_PIECES, getConstructionPiece } from "../worldbuilder/ConstructionLibrary.js";
import { clamp } from "../utils/MathUtils.js";

/**
 * WorkshopFunctions
 * -------------------
 * Version 3, Phase 8b ("Bubble Gains Hands") — the fixed, Workshop-owned
 * table the roadmap's own Risks section calls for: "a fixed, closed set
 * of built-in function implementations the Workshop itself owns
 * (parameter-validated, clamped to existing system methods/bounds), with
 * the resident only ever supplying a function *name* + *arguments* that
 * get dispatched through that fixed table — never `eval`/`Function()`-
 * style execution of resident- or player-authored code." Nothing in this
 * file, or anywhere `invoke()` leads, ever runs a string as code.
 *
 * Three exports:
 *   - `WORKSHOP_FUNCTIONS` — the schema (id, label, description,
 *     parameters) for every function, in the same shape both Mission
 *     Control's own toggle UI and Ollama's own `tools` request field
 *     need, so there's exactly one place each function is described.
 *   - `defaultFunctionsConfig()`/`normalizeFunctionsConfig()` — the same
 *     small `*Configuration.js` shape-and-defaults convention every
 *     other profile section (`TraitConfiguration.js`,
 *     `MemoryConfiguration.js`, `EmbodimentConfiguration.js`) already
 *     follows, so `ResidentProfileStore` can thread a `functions` field
 *     through `update()`/`load()`/`exportProfile()`/`importProfile()`
 *     exactly like every other section. Every function defaults to
 *     **granted** — there's no code-level notion of "Bubble" as a
 *     special resident, so "Bubble gets them all by default, but stays
 *     toggleable" is true for every profile alike, Bubble's included,
 *     never hardcoded or exempt from the same Mission Control toggle.
 *   - `createWorkshopFunctionDispatcher(deps)` — takes the real system
 *     references and returns `{definitionsFor(profile), invoke(name,
 *     args)}`. `invoke()` never throws — a bad call becomes a returned
 *     `{error}` object, fed back to the model as an ordinary tool result
 *     so it can explain honestly rather than the whole turn silently
 *     failing.
 *
 * **Coordinates are clamped, not validated against real collision** —
 * there's no existing pre-placement bounds/overlap gate anywhere in the
 * Builder to reuse (confirmed by reading `BuildModeSystem._confirmGhost()`
 * itself: collision boxes are computed *after* spawn, for player-movement
 * collision, never as a placement gate) — so a wildly out-of-range
 * hallucinated coordinate is clamped to a generous but bounded world
 * extent instead, a genuinely new, deliberately conservative safety net
 * rather than a corner being cut relative to what player-driven placement
 * already guarantees.
 */

const WORLD_BOUND_XZ = 90; // metres — comfortably inside TerrainSystem.js's own 200m ground, never exported for this purpose specifically
const WORLD_BOUND_Y_MIN = -2;
const WORLD_BOUND_Y_MAX = 30;
const DEFAULT_NEARBY_RADIUS = 8;
const MAX_NEARBY_RESULTS = 10;

export const WORKSHOP_FUNCTIONS = [
  {
    id: "moveTo",
    label: "Move to a location",
    description: "Walk to a specific position in the Workshop. Movement is along the ground only — height isn't something the resident controls.",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "X coordinate, in metres." },
        z: { type: "number", description: "Z coordinate, in metres." },
      },
      required: ["x", "z"],
    },
  },
  {
    id: "getPlayerPosition",
    label: "Get the player's position",
    description: "Look up the player's current coordinates in the Workshop.",
    parameters: { type: "object", properties: {} },
  },
  {
    id: "getNearbyObjects",
    label: "Get nearby objects",
    description: "List placed Workshop objects near the player, with their names, coordinates, and distance.",
    parameters: {
      type: "object",
      properties: { radius: { type: "number", description: "How far to search, in metres. Defaults to 8." } },
    },
  },
  {
    id: "getNearbyBeings",
    label: "Get nearby Beings",
    description: "List placed Beings near the player, with their names, coordinates, and distance.",
    parameters: {
      type: "object",
      properties: { radius: { type: "number", description: "How far to search, in metres. Defaults to 8." } },
    },
  },
  {
    id: "setWeather",
    label: "Change the weather",
    description: "Set the Workshop's current weather.",
    parameters: {
      type: "object",
      properties: { weather: { type: "string", enum: Object.keys(WEATHER_STATES), description: "One of the Workshop's known weather states." } },
      required: ["weather"],
    },
  },
  {
    id: "setTimeOfDay",
    label: "Change the time of day",
    description: "Set the Workshop's current time of day.",
    parameters: {
      type: "object",
      properties: { hour: { type: "number", description: "Hour of the day, 0-24 (24-hour clock)." } },
      required: ["hour"],
    },
  },
  {
    id: "setLights",
    label: "Turn the lights on or off",
    description: "Switch the Workshop's own interior lights on or off.",
    parameters: {
      type: "object",
      properties: { on: { type: "boolean", description: "true to turn the lights on, false to turn them off." } },
      required: ["on"],
    },
  },
  {
    id: "musicControl",
    label: "Control music playback",
    description: "Play, pause, skip, or adjust the volume of the Workshop's music player.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["play", "pause", "next", "previous", "setVolume"], description: "Which music control to use." },
        volume: { type: "number", description: "Only used with the setVolume action — a number from 0 (silent) to 1 (full volume)." },
      },
      required: ["action"],
    },
  },
  {
    id: "placeObject",
    label: "Place something in the world",
    description: "Place a Construction piece, a saved object, a Blueprint, or a Being at a location, by name.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the thing to place, e.g. \"Cube\" or \"Simple Shed\"." },
        kind: { type: "string", enum: ["object", "blueprint", "being"], description: "Narrows the search to one kind of thing, if known. Optional." },
        x: { type: "number", description: "X coordinate, in metres." },
        y: { type: "number", description: "Y coordinate (height), in metres." },
        z: { type: "number", description: "Z coordinate, in metres." },
      },
      required: ["name", "x", "y", "z"],
    },
  },
];

export function defaultFunctionsConfig() {
  const granted = {};
  for (const fn of WORKSHOP_FUNCTIONS) granted[fn.id] = true;
  return { granted };
}

/** Never trusts the file — an unrecognised or missing entry defaults to
 *  granted (matching `defaultFunctionsConfig()`), same "don't fabricate,
 *  don't crash" standard every other profile section's own normalize
 *  function already holds itself to. */
export function normalizeFunctionsConfig(data) {
  const granted = {};
  for (const fn of WORKSHOP_FUNCTIONS) {
    const value = data?.granted?.[fn.id];
    granted[fn.id] = typeof value === "boolean" ? value : true;
  }
  return { granted };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function clampCoordinate(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return clamp(n, min, max);
}

function clampPosition(args) {
  return {
    x: clampCoordinate(args?.x, -WORLD_BOUND_XZ, WORLD_BOUND_XZ),
    y: clampCoordinate(args?.y, WORLD_BOUND_Y_MIN, WORLD_BOUND_Y_MAX),
    z: clampCoordinate(args?.z, -WORLD_BOUND_XZ, WORLD_BOUND_XZ),
  };
}

/** Resolves a free-text name against every currently-known placeable
 *  thing (Construction pieces, saved Objects, Blueprints, Beings) rather
 *  than baking a static id enum into the tool schema — the library
 *  changes as the player builds, and re-sending the entire catalog on
 *  every request would bloat every single conversation turn. An exact,
 *  case-insensitive name match wins; otherwise the first partial match,
 *  so "shed" still finds "Simple Shed". */
function resolvePlaceable(name, kind, { objectLibraryStore, blueprintStore, beingLibrary }) {
  const query = String(name ?? "").trim().toLowerCase();
  if (!query) return null;
  const candidates = [];
  if (!kind || kind === "object") {
    for (const piece of CONSTRUCTION_PIECES) candidates.push({ label: piece.name, definitionId: piece.id, definitionSource: "construction", place: "object" });
    for (const def of objectLibraryStore?.all() ?? []) candidates.push({ label: def.name, definitionId: def.id, definitionSource: "library", place: "object" });
  }
  if (!kind || kind === "blueprint") {
    for (const bp of blueprintStore?.all() ?? []) candidates.push({ label: bp.name, blueprintId: bp.id, place: "blueprint" });
  }
  if (!kind || kind === "being") {
    for (const being of beingLibrary?.all() ?? []) candidates.push({ label: being.name, definitionId: being.id, place: "being" });
  }
  const exact = candidates.find((c) => c.label.toLowerCase() === query);
  if (exact) return exact;
  return candidates.find((c) => c.label.toLowerCase().includes(query)) ?? null;
}

/** The exact `store.create()` + `system.spawnInstance()` pair
 *  `BuildModeSystem._confirmGhost()` already uses for both a single
 *  Construction/library object and a whole Blueprint's own per-child
 *  loop — reused directly rather than a parallel placement path. Being
 *  placement needs no equivalent explicit spawn call:
 *  `BeingInstanceStore.create()` already emits `instances:changed`,
 *  which `BeingController` already listens for and reconciles into a
 *  live spawn on its own. */
function placeObjectAt(match, position, { worldObjectsStore, worldObjectsSystem, blueprintStore, beingInstanceStore }) {
  if (match.place === "blueprint") {
    const blueprint = blueprintStore.get(match.blueprintId);
    if (!blueprint) return { error: `The Blueprint "${match.label}" no longer exists.` };
    let pieceCount = 0;
    for (const obj of blueprint.objects) {
      const [ox, oy, oz] = obj.offset;
      const instance = worldObjectsStore.create({
        definitionId: obj.definitionId,
        definitionSource: obj.definitionSource,
        position: [position.x + ox, position.y + oy, position.z + oz],
        rotationY: obj.rotationY ?? 0,
        scale: obj.scale ?? 1,
        colorOverride: obj.colorOverride ?? null,
      });
      worldObjectsSystem?.spawnInstance(instance);
      pieceCount += 1;
    }
    return { ok: true, placedBlueprint: blueprint.name, pieceCount, at: position };
  }
  if (match.place === "being") {
    const instance = beingInstanceStore.create({ definitionId: match.definitionId, position: [position.x, position.y, position.z] });
    return { ok: true, placedBeing: match.label, at: position, instanceId: instance.id };
  }
  const instance = worldObjectsStore.create({
    definitionId: match.definitionId,
    definitionSource: match.definitionSource,
    position: [position.x, position.y, position.z],
  });
  worldObjectsSystem?.spawnInstance(instance);
  return { ok: true, placedObject: match.label, at: position, instanceId: instance.id };
}

export function createWorkshopFunctionDispatcher(deps) {
  const {
    engine = null,
    cameraSystem = null,
    worldObjectsStore = null,
    worldObjectsSystem = null,
    objectLibraryStore = null,
    blueprintStore = null,
    beingInstanceStore = null,
    beingLibrary = null,
    environmentSystem = null,
    timeOfDaySystem = null,
    lightingSystem = null,
    musicSystem = null,
    residentController = null,
  } = deps;

  function nearby(store, resolveName, radius) {
    const center = cameraSystem?.position;
    if (!center) return [];
    const r = Number.isFinite(radius) && radius > 0 ? radius : DEFAULT_NEARBY_RADIUS;
    const results = [];
    for (const instance of store) {
      const [x, y, z] = instance.position;
      const distance = Math.hypot(x - center.x, z - center.z);
      if (distance > r) continue;
      results.push({ name: resolveName(instance), x: round1(x), y: round1(y), z: round1(z), distance: round1(distance) });
    }
    results.sort((a, b) => a.distance - b.distance);
    return results.slice(0, MAX_NEARBY_RESULTS);
  }

  const invokers = {
    moveTo(args) {
      if (!residentController?.goTo) return { error: "Movement isn't available right now." };
      // y is deliberately not part of this function's own schema — the
      // resident only ever moves along the ground (see
      // ResidentController.js's own arrival-check comment on why a
      // height mismatch would otherwise leave "goto" stuck active
      // forever); clampPosition()'s own missing-value default (0) is
      // harmless here since nothing reads this y for movement.
      const position = clampPosition(args);
      residentController.goTo(position);
      return { ok: true, movingTo: { x: position.x, z: position.z } };
    },
    getPlayerPosition() {
      if (!cameraSystem?.position) return { error: "The player's position isn't available right now." };
      const { x, y, z } = cameraSystem.position;
      return { x: round1(x), y: round1(y), z: round1(z) };
    },
    getNearbyObjects(args) {
      const objects = nearby(
        worldObjectsStore?.all() ?? [],
        (instance) =>
          (instance.definitionSource === "construction" ? getConstructionPiece(instance.definitionId)?.name : objectLibraryStore?.get(instance.definitionId)?.name) ??
          "an unknown object",
        args?.radius
      );
      return { objects };
    },
    getNearbyBeings(args) {
      const beings = nearby(beingInstanceStore?.active() ?? [], (instance) => instance.name ?? beingLibrary?.get(instance.definitionId)?.name ?? "an unnamed Being", args?.radius);
      return { beings };
    },
    setWeather(args) {
      const id = String(args?.weather ?? "");
      if (!WEATHER_STATES[id]) return { error: `"${id}" isn't a weather this Workshop knows. Try one of: ${Object.keys(WEATHER_STATES).join(", ")}.` };
      environmentSystem?.setWeather(id);
      return { ok: true, weather: id };
    },
    setTimeOfDay(args) {
      const hour = Number(args?.hour);
      if (!Number.isFinite(hour)) return { error: "hour must be a number between 0 and 24." };
      timeOfDaySystem?.setTime(hour);
      return { ok: true, hour: ((hour % 24) + 24) % 24 };
    },
    setLights(args) {
      const on = !!args?.on;
      lightingSystem?.setLightsOn(on);
      return { ok: true, on };
    },
    musicControl(args) {
      if (!musicSystem) return { error: "The music player isn't available right now." };
      const action = String(args?.action ?? "");
      switch (action) {
        case "play":
          musicSystem.resume();
          return { ok: true, action };
        case "pause":
          musicSystem.pause();
          return { ok: true, action };
        case "next":
          musicSystem.next();
          return { ok: true, action };
        case "previous":
          musicSystem.previous();
          return { ok: true, action };
        case "setVolume": {
          const volume = Number(args?.volume);
          if (!Number.isFinite(volume)) return { error: "volume must be a number between 0 and 1." };
          const clamped = clamp(volume, 0, 1);
          musicSystem.setVolume(clamped);
          return { ok: true, action, volume: clamped };
        }
        default:
          return { error: `"${action}" isn't a music action this Workshop knows. Try one of: play, pause, next, previous, setVolume.` };
      }
    },
    placeObject(args) {
      const match = resolvePlaceable(args?.name, args?.kind, { objectLibraryStore, blueprintStore, beingLibrary });
      if (!match) return { error: `Nothing called "${args?.name}" was found to place.` };
      const position = clampPosition(args);
      const result = placeObjectAt(match, position, { worldObjectsStore, worldObjectsSystem, blueprintStore, beingInstanceStore });
      engine?.events?.emit("persistence:saveRequested");
      return result;
    },
  };

  return {
    /** Ollama's own `tools` request shape, filtered to whichever
     *  functions this specific profile currently has granted. Computed
     *  fresh on every call rather than cached, the same "read fresh, no
     *  duplicated copies" instinct `ResidentConnection.sendMessage()`
     *  already applies to a profile's own behaviour settings. */
    definitionsFor(profile) {
      const granted = profile?.functions?.granted ?? {};
      return WORKSHOP_FUNCTIONS.filter((fn) => granted[fn.id] !== false).map((fn) => ({
        type: "function",
        function: { name: fn.id, description: fn.description, parameters: fn.parameters },
      }));
    },
    /** Never throws — an unknown function or a bad argument becomes a
     *  returned `{error}` object, the same shape a *successful* call
     *  returns alongside `ok: true`, so the tool-calling loop always has
     *  something sensible to feed back to the model either way. */
    async invoke(name, args) {
      const fn = invokers[name];
      if (!fn) return { error: `Unknown function "${name}".` };
      try {
        const result = await fn(args ?? {});
        return result ?? { ok: true };
      } catch (err) {
        return { error: err?.message || "Something went wrong running that." };
      }
    },
  };
}
