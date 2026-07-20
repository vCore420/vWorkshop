import { Engine } from "./core/Engine.js";
import { InputManager } from "./utils/InputManager.js";

import { RoomLayoutSystem } from "./systems/RoomLayoutSystem.js";
import { FurnitureSystem } from "./systems/FurnitureSystem.js";
import { ReflectionSystem } from "./systems/ReflectionSystem.js";
import { WorldEnvironmentSystem } from "./systems/WorldEnvironmentSystem.js";
import { TerrainSystem } from "./systems/TerrainSystem.js";
import { CONSTRUCTION_PIECES, getConstructionPiece, getConstructionGroup } from "./worldbuilder/ConstructionLibrary.js";
import { LightingSystem } from "./systems/LightingSystem.js";
import { TimeOfDaySystem } from "./systems/TimeOfDaySystem.js";
import { EnvironmentSystem, WEATHER_STATES } from "./systems/EnvironmentSystem.js";
import { AtmosphereProfileStore } from "./systems/AtmosphereProfileStore.js";
import { currentTimeBucket } from "./resident/ResidentWorldSignals.js";
import { AudioSystem } from "./systems/AudioSystem.js";
import { CameraSystem } from "./systems/CameraSystem.js";
import { LadderSystem } from "./systems/LadderSystem.js";
import { InteriorSystem } from "./systems/InteriorSystem.js";
import { BuildingDetectionSystem } from "./worldbuilder/BuildingDetectionSystem.js";
import { PhoneSystem } from "./phone/PhoneSystem.js";
import { buildPhoneApps } from "./phone/apps/registry.js";
import { EmoteWheelSystem } from "./systems/EmoteWheelSystem.js";
import { CompassSystem } from "./systems/CompassSystem.js";
import { InteractionSystem } from "./systems/InteractionSystem.js";
import { PersistenceSystem } from "./systems/PersistenceSystem.js";
import { WorldTimeService } from "./systems/WorldTimeService.js";
import { ComputerSystem } from "./computer/ComputerSystem.js";
import { WorkbenchSystem } from "./workbench/WorkbenchSystem.js";
import { ObjectLibraryStore } from "./worldbuilder/ObjectLibraryStore.js";
import { BlueprintStore } from "./worldbuilder/BlueprintStore.js";
import { WorkshopProjectStore } from "./data/WorkshopProjectStore.js";
import { WorldObjectsStore } from "./worldbuilder/WorldObjectsStore.js";
import { WorldObjectsSystem } from "./worldbuilder/WorldObjectsSystem.js";
import { BuildModeSystem } from "./worldbuilder/BuildModeSystem.js";

import { MusicSystem } from "./music/MusicSystem.js";
import { MusicLibraryStore } from "./music/MusicLibraryStore.js";
import { PlaylistStore } from "./music/PlaylistStore.js";
import { createMusicOverlay } from "./music/ui/MusicOverlay.js";

import { SettingsStore } from "./settings/SettingsStore.js";
import { SettingsSystem } from "./settings/SettingsSystem.js";

import { PlayerAppearanceStore } from "./player/PlayerAppearanceStore.js";
import { OutfitStore } from "./player/OutfitStore.js";
import { TextureStore } from "./player/TextureStore.js";
import { ImageLibraryStore } from "./systems/ImageLibraryStore.js";
import { ImageAssetStore } from "./systems/ImageAssetStore.js";
import { PageRegistry } from "./browser/PageRegistry.js";
import { BrowserStore } from "./browser/BrowserStore.js";
import { registerWorkshopPages } from "./browser/WorkshopPages.js";
import { registerAssetPages } from "./browser/AssetPages.js";
import { SearchIndex } from "./browser/SearchIndex.js";
import { HostManager } from "./host/HostManager.js";
import { HostConnectionManager } from "./host/HostConnectionManager.js";
import { PluginService } from "./host/PluginService.js";
import { ResidentService } from "./host/ResidentService.js";
import { DiagnosticsService } from "./host/DiagnosticsService.js";
import { buildSwatchThumbnail, buildPixelThumbnail } from "./host/WorkshopAssetSchema.js";
import { registerHostPages } from "./host/HostPages.js";
import { examplePagePlugin } from "./plugins/examples/examplePagePlugin.js";
import { calculatorPlugin } from "./plugins/examples/calculatorPlugin.js";
import { workshopToolkitPlugin } from "./plugins/examples/workshopToolkitPlugin.js";
import { PluginPermissions } from "./plugins/PluginPermissions.js";
import { PluginStorage } from "./plugins/PluginStorage.js";
import { loadWorkshopPlugin } from "./plugins/PluginLoader.js";
import { registerAppFactory } from "./computer/apps/registry.js";
import { registerPhoneAppFactory } from "./phone/apps/registry.js";
import { AIConnectionManager } from "./ai/AIConnectionManager.js";
import { ModelRegistry } from "./ai/ModelRegistry.js";
import { ResidentProfileStore } from "./ai/ResidentProfileStore.js";
import { ExpressionSetStore } from "./resident/ExpressionSetStore.js";
import { ResidentState } from "./resident/ResidentState.js";
import { ResidentBehaviour } from "./resident/ResidentBehaviour.js";
import { ResidentConnection } from "./resident/ResidentConnection.js";
import { ResidentController } from "./resident/ResidentController.js";
import { createWorkshopFunctionDispatcher } from "./ai/WorkshopFunctions.js";
import { WorldAwareness } from "./world/WorldAwareness.js";
import { WorldEventLog } from "./world/WorldEventLog.js";
import { WorkshopEventLog } from "./host/WorkshopEventLog.js";
import { createResidentConversationOverlay } from "./resident/ResidentConversation.js";
import { ResidentPreferences } from "./resident/ResidentPreferences.js";
import { PlayerPatternMemory } from "./resident/PlayerPatternMemory.js";
import { ResidentCuriosity } from "./resident/ResidentCuriosity.js";
import { ConversationMemory } from "./resident/ConversationMemory.js";
import { ModelAssetStore } from "./beings/ModelAssetStore.js";
import { ModelLibrary } from "./beings/ModelLibrary.js";
import { ModelLoader } from "./beings/ModelLoader.js";
import { BeingLibrary } from "./beings/BeingLibrary.js";
import { BeingInstanceStore } from "./beings/BeingInstanceStore.js";
import { BeingController } from "./beings/BeingController.js";
import { BeingSpawnerSystem } from "./beings/BeingSpawnerSystem.js";
import { PlayerCharacterSystem } from "./player/PlayerCharacterSystem.js";
import { PlayerAnimationSystem } from "./player/PlayerAnimationSystem.js";
import { AnimationLibraryStore } from "./player/AnimationLibraryStore.js";
import { PoseLibraryStore } from "./player/PoseLibraryStore.js";

import { ProjectsStore } from "./data/ProjectsStore.js";
import { NotesStore } from "./data/NotesStore.js";
import { ToolsStore } from "./tools/ToolsStore.js";

import { OverlayManager } from "./ui/OverlayManager.js";
import { HUD } from "./ui/HUD.js";
import { createPinboardOverlay } from "./ui/overlays/PinboardOverlay.js";
import { createNotebookOverlay } from "./ui/overlays/NotebookOverlay.js";
import { createArchiveOverlay } from "./ui/overlays/ArchiveOverlay.js";
import { createToolStorageOverlay } from "./ui/overlays/ToolStorageOverlay.js";
import { createWindowOverlay } from "./ui/overlays/WindowOverlay.js";
import { createRestNookOverlay } from "./ui/overlays/RestNookOverlay.js";
import { createWardrobeOverlay } from "./ui/overlays/WardrobeOverlay.js";

import { dustMotesPlugin } from "./plugins/examples/dustMotesPlugin.js";

/**
 * main.js
 * -------
 * This file's only job is wiring: construct the Engine, register systems in
 * the order their dependencies require (see comments below), construct the
 * plain data stores, register every overlay, and start the render loop once
 * the person clicks past the entry screen. No behaviour lives here that
 * belongs in a system — if you're tempted to add logic to this file beyond
 * "new X()" and "register Y with Z", it probably belongs in a system instead.
 */

const canvas = document.getElementById("workshop-canvas");
const engine = new Engine(canvas);
engine.input = new InputManager(canvas, document.getElementById("touch-controls"));

// --- Systems, in dependency order ---
// Room + furniture geometry must exist before Lighting attaches fixtures to
// it, before Camera/Interaction can query furniture footprints, and before
// WorldEnvironmentSystem/BuildModeSystem can reference the floor mesh and
// wall colliders RoomLayoutSystem builds.
const roomLayoutSystem = engine.addSystem(new RoomLayoutSystem());
const furnitureSystem = engine.addSystem(new FurnitureSystem());
// Reaches into FurnitureSystem's already-built pieces for a mirrorMesh
// marker (see Wardrobe.js) — must be registered after it for the same
// reason ComputerSystem/LightingSystem already need FurnitureSystem
// built first.
const reflectionSystem = engine.addSystem(new ReflectionSystem());
// WorldEnvironmentSystem (ground + sky/fog) must be registered before
// TimeOfDaySystem: TimeOfDaySystem.init() emits the first
// "timeofday:changed" synchronously, and WorldEnvironmentSystem needs to
// already be listening to paint the very first frame's sky correctly.
const worldEnvironmentSystem = engine.addSystem(new WorldEnvironmentSystem());
// "Introduce a dedicated terrain editing workflow... the surrounding
// world should feel just as thoughtfully designed as the Workshop
// itself." A real, bounded, editable heightmap patch — see
// TerrainSystem.js's own comment for why this is a separate mesh from
// WorldEnvironmentSystem's own flat, infinitely-recentring ground.
const terrainSystem = engine.addSystem(new TerrainSystem());
const lightingSystem = engine.addSystem(new LightingSystem());
const timeOfDaySystem = engine.addSystem(new TimeOfDaySystem());
const environmentSystem = engine.addSystem(new EnvironmentSystem());
const audioSystem = engine.addSystem(new AudioSystem());
const cameraSystem = engine.addSystem(new CameraSystem());

// --- Entry screen ---
// Workshop Refinement phase (Pass A) — "the interface appears largely
// inactive until loading has completed... avoid moments where the
// application appears frozen or unresponsive." Wired here, immediately,
// rather than after the long boot sequence below — the button used to
// have *no click handler attached at all* until the entire async chain
// (engine.init(), spawning every saved object, resolving player
// textures, ...) had already finished, which is exactly what "appears
// frozen" describes: a control that looks interactive and silently does
// nothing if pressed too soon. Now it responds the instant it's
// pressed, whether boot is done yet or not — see the "--- Boot ---"
// section below for the other half of this.
const entryScreen = document.getElementById("entry-screen");
const entryButton = document.getElementById("entry-button");
const entryStatus = document.getElementById("entry-status");
let _workshopReady = false;
let _entryRequested = false;

function _setEntryStatus(text) {
  if (entryStatus) entryStatus.textContent = text;
}

function _enterWorkshop() {
  audioSystem.resumeContext();
  engine.input.requestPointerLock();
  entryScreen.classList.add("hidden");
}

entryButton.addEventListener("click", () => {
  _entryRequested = true;
  if (_workshopReady) {
    _enterWorkshop();
    return;
  }
  entryButton.disabled = true;
  entryButton.textContent = "Preparing\u2026";
  _setEntryStatus("Almost ready \u2014 stepping inside the moment it's done.");
});

void roomLayoutSystem;
void furnitureSystem;

// --- Plain data stores (not Engine systems — no scene/camera concerns) ---
const projectsStore = new ProjectsStore();
const notesStore = new NotesStore();
// Workshop Tools phase — "Tool Storage... should now become one of the
// Workshop's core systems." Custom calculators, pinned tools, and recent
// runs — see docs/TOOLS.md.
const toolsStore = new ToolsStore();
const objectLibraryStore = new ObjectLibraryStore();
const blueprintStore = new BlueprintStore();
// "Begin preparing for long-running Workshop activities... this phase
// does not need to fully implement these future systems. Simply prepare
// the architecture for them." See WorkshopProjectStore.js's own comment
// — deliberately not wired to any UI yet.
const workshopProjectStore = new WorkshopProjectStore();
void workshopProjectStore;
const worldObjectsStore = new WorldObjectsStore();
// Constructed here, ahead of WorldObjectsSystem/BuildModeSystem below —
// "the Builder should treat imported models similarly to any other
// available shape" needed both of those to resolve/render imported-model
// instances, so the model stores themselves have to exist first. See
// ModelLibrary.js's own comment for why models aren't owned by
// BeingLibrary specifically, even though Beings need them too.
const modelAssetStore = new ModelAssetStore();
const modelLibrary = new ModelLibrary();
const modelLoader = new ModelLoader(modelLibrary, modelAssetStore);
const musicLibraryStore = new MusicLibraryStore();
const playlistStore = new PlaylistStore();
const browserStore = new BrowserStore();
const pageRegistry = new PageRegistry();
// "Please introduce the foundations for unified searching" — one small,
// shared index, populated alongside each system's own page registration
// (see WorkshopPages.js/AssetPages.js/HostPages.js's own searchIndex.
// addEntry() calls) rather than derived from PageRegistry itself, which
// would mean invoking every page's own provider function just to learn
// its title. See SearchIndex.js's own comment for the full reasoning.
const searchIndex = new SearchIndex();
// "The Workshop Host Companion" — a real, optional local server (see
// host-companion/README.md), polled the identical calm way
// AIConnectionManager already polls Ollama. Constructed here, alongside
// pageRegistry/hostManager, since FilesService (owned by HostManager)
// needs the real connection manager to check `.status` against.
const hostConnectionManager = new HostConnectionManager();
// "The Host should be treated as a lightweight companion service" — see
// HostManager.js's own comment. Constructed here, right alongside
// pageRegistry, since PluginRegistry (owned by HostManager) needs the
// real registry to register future plugin pages against directly.
const hostManager = new HostManager(pageRegistry, hostConnectionManager);
// "Plugin SDK" phase — both genuinely standalone stores (no dependency
// on hostManager or anything else), constructed here so they're ready
// before any plugin loads later in this file. See
// docs/PLUGIN_SDK.md's own "Permissions" and "Storage" sections.
const pluginPermissions = new PluginPermissions();
const pluginStorage = new PluginStorage();
// "The Host should understand assets independently of the Builder or
// Browser" — AssetService itself already exists the moment HostManager's
// own constructor runs (registered under "assets" immediately, alongside
// every other zero-dependency service — see HostManager.js's own
// comment). Keeping a named reference to it here, right next to
// `hostManager` itself, rather than only ever re-fetching it later via
// `hostManager.services.get("assets")`, is what keeps this a plain,
// ordinary top-level `const` any later line in this file can safely read
// — including `persistenceSystem.registerProvider("assetLibrary", ...)`
// below, which needs it *before* the asset-kind registrations further
// down even run. Registering each individual asset *kind*
// (`assetService.registerKind("objects", {...})` and so on) still
// happens much later — see the "Workshop Platform" wiring block near the
// end of this file — since populating them needs stores
// (`objectLibraryStore`, `animationLibraryStore`, and so on) that don't
// exist yet at this point in the file. Obtaining the *instance* and
// *populating* it are two genuinely separate steps, on two genuinely
// different schedules; this line only ever does the former.
const assetService = hostManager.services.get("assets");
// Workshop/Host/Asset page registration itself now happens much later in
// this file (see the "Browser Ecosystem" block near the end) — moved
// there once the new pages needed stores (residentProfileStore,
// animationLibraryStore, the engine itself, persistenceSystem...) that
// don't exist yet at this point in main.js. Registering a page is just
// handing the registry a function to call later, so nothing about
// ordering here affects when pages actually become navigable; it only
// affects how early their own dependencies need to exist.

// "This is NOT the AI itself... preparing another presence." See
// src/ai/AIConnectionManager.js's own comment for why polling starts
// immediately and unconditionally here rather than waiting on anything
// else — it never blocks the Workshop either way, connected or not.
const aiConnectionManager = new AIConnectionManager();
const modelRegistry = new ModelRegistry();
const residentProfileStore = new ResidentProfileStore();
// Workshop Personality phase — constructed here, alongside
// residentProfileStore, since both are needed together the moment
// ResidentController resolves a profile's own expressionSetId.
const expressionSetStore = new ExpressionSetStore();
aiConnectionManager.init();
// Workshop Refinement phase (Pass A) — "quietly warming models in the
// background." Whenever the active profile (or its own chosen model)
// changes, tell AIConnectionManager which model to keep warm —
// deliberately wired here rather than either file importing the other,
// since AIConnectionManager has no reason to know what a "resident
// profile" even is (see its own class comment). Called once immediately
// too, so startup warms whatever's already active rather than waiting
// for the first change event that might never come this session.
const _syncWarmModel = () => aiConnectionManager.setWarmModel(residentProfileStore.getActive()?.model ?? null);
residentProfileStore.events.on("residents:changed", _syncWarmModel);
_syncWarmModel();
hostConnectionManager.init();
// "workshop://models... live from the same connection AI Mission Control
// uses" — HostPages.js itself is registered later now (see the "Browser
// Ecosystem" block near the end of this file), alongside every other
// page registration, once modelRegistry and everything else it needs
// already exist.

// "This is not an AI assistant. It is the Workshop's first resident." —
// ResidentConnection is a thin adapter over aiConnectionManager (see its
// own comment for why it isn't a second connection manager);
// ResidentBehaviour/ResidentState are shared between ResidentController
// (the engine system driving the resident every frame) and the
// conversation overlay below, which is why both are constructed here
// rather than owned internally by either one.
const residentState = new ResidentState();
const residentBehaviour = new ResidentBehaviour();
const residentConnection = new ResidentConnection(aiConnectionManager);
// "Residents should begin forming preferences... begin remembering
// behavioural patterns rather than only conversations... occasionally
// notice the Workshop around it... focus on remembering meaningful
// things rather than everything." Four small, single-responsibility
// pieces, the same "separate responsibilities" instinct src/resident/
// already follows for everything else — see docs/RESIDENT.md.
const residentPreferences = new ResidentPreferences();
const playerPatternMemory = new PlayerPatternMemory();
const residentCuriosity = new ResidentCuriosity();
const conversationMemory = new ConversationMemory();
// "Major milestones" — the one category ConversationMemory populates from
// the Workshop itself rather than from message text; see its own
// watchProjects() comment for how it avoids treating every
// already-finished project as a fresh milestone on the very next load.
conversationMemory.watchProjects(projectsStore, () => residentProfileStore.getActive()?.memory?.categories);
// Phase 11 ("Workshop Character") — "Persistent" now genuinely persists;
// see ConversationMemory.js's own comment for why the mode check lives
// inside save() rather than at this registration site.
conversationMemory.configurePersistence(() => residentProfileStore.getActive()?.memory?.mode);
const settingsStore = new SettingsStore();
const atmosphereProfileStore = new AtmosphereProfileStore();
const appearanceStore = new PlayerAppearanceStore();
const outfitStore = new OutfitStore();
const textureStore = new TextureStore();
const imageLibraryStore = new ImageLibraryStore();
const imageAssetStore = new ImageAssetStore();

// WorldObjectsSystem has no dependency on other systems at init() time — it
// only needs engine.scene/engine.entities, which exist from construction —
// so its registration position is flexible; it's grouped here because it's
// conceptually "world contents", alongside the room and furniture.
const worldObjectsSystem = engine.addSystem(new WorldObjectsSystem({ objectLibraryStore, worldObjectsStore, modelLibrary, modelLoader }));

// Same flexibility as WorldObjectsSystem above — MusicSystem only needs
// engine.events at init() time. See src/music/MusicSystem.js.
const musicSystem = engine.addSystem(new MusicSystem({ libraryStore: musicLibraryStore, playlistStore }));

// SettingsSystem looks up LightingSystem/WorldEnvironmentSystem/
// AudioSystem/MusicSystem via engine.getSystem() at init() time — safe
// regardless of registration order (every system already exists in
// engine.systems by the time engine.init() starts, since every
// addSystem() call above already happened) — see its own comment.
const settingsSystem = engine.addSystem(new SettingsSystem({ settingsStore }));
void settingsSystem;

// Same flexibility as WorldObjectsSystem/MusicSystem above — only needs
// engine.scene/engine.events at init() time. Its finalizeInitialState()
// (below, after engine.init()) does the first rig build, once the
// appearance store has actually loaded. See src/player/PlayerCharacterSystem.js.
// Constructed as its own variable (not inline in addSystem()) so
// PlayerAnimationSystem below can be handed the reference directly —
// see that constructor's own comment on why, rather than each resolving
// the other via engine.getSystem(), which would create a genuine
// three-way circular import between this file, PlayerAnimationSystem.js,
// and CameraSystem.js.
const playerCharacterSystem = new PlayerCharacterSystem({ appearanceStore, textureStore, modelLoader });
engine.addSystem(playerCharacterSystem);
// See CameraSystem.js's own "Player Height" comment for why this is a
// setter call here rather than either system importing the other
// directly — the same circular-import avoidance PlayerAnimationSystem's
// own constructor-injected reference below already uses.
cameraSystem.setCharacterSystem(playerCharacterSystem);

const animationLibraryStore = new AnimationLibraryStore();
// "Please introduce the foundations for a shared pose library... these
// should become reusable Workshop Assets." Constructed alongside its own
// sibling clip library; registered as an Asset kind, and with
// PersistenceSystem, in this file's own later wiring blocks.
const poseLibraryStore = new PoseLibraryStore();
const playerAnimationSystem = new PlayerAnimationSystem({ characterSystem: playerCharacterSystem, libraryStore: animationLibraryStore });
engine.addSystem(playerAnimationSystem);
const ladderSystem = engine.addSystem(new LadderSystem());
void ladderSystem;
const interiorSystem = engine.addSystem(new InteriorSystem());
void interiorSystem;
// "Whenever a player constructs an enclosed building, the Workshop
// should naturally recognise it as an interior... players should never
// need to manually mark a building as an interior." See
// BuildingDetectionSystem.js's own comment for how.
const buildingDetectionSystem = engine.addSystem(new BuildingDetectionSystem({ worldObjectsStore, worldObjectsSystem, interiorSystem }));
void buildingDetectionSystem;
// Registered as a system purely so DisplaySurfaceBehaviour.js (and any
// future behaviour needing the same) can resolve it via
// engine.getSystem() the same way every other cross-system reference in
// this project works — it has no init()/update() of its own, which
// engine.init()'s own optional-chaining call already tolerates.
engine.addSystem(imageAssetStore);
const emoteWheelSystem = engine.addSystem(new EmoteWheelSystem({ animationLibraryStore }));
void emoteWheelSystem;
const compassSystem = engine.addSystem(new CompassSystem());
void compassSystem;
const residentController = engine.addSystem(
  new ResidentController({ residentState, residentBehaviour, residentConnection, residentProfileStore, expressionSetStore, residentPreferences, playerPatternMemory, musicSystem })
);
void residentController;

// "Beings should also become Workshop assets" — the same three-way split
// (index / raw bytes / loader-and-cache) src/browser and src/ai already
// use for their own binary-adjacent assets, applied to imported 3D
// models. See ModelLibrary.js's own comment for why models aren't owned
// by BeingLibrary specifically.
const beingLibrary = new BeingLibrary();
const beingInstanceStore = new BeingInstanceStore();
// BeingController (renders/moves every placed Being) and
// BeingSpawnerSystem (the ghost-preview placement workflow) both need to
// be registered — and therefore initialised — before ComputerSystem,
// since BeingManagerApp.js reads `beingController.engine` the same way
// MediaApp.js already reads `musicSystem.engine`, rather than needing its
// own dedicated engine dependency.
const beingController = engine.addSystem(new BeingController({ beingLibrary, beingInstanceStore, modelLoader, modelLibrary, animationLibraryStore }));
const beingSpawnerSystem = engine.addSystem(new BeingSpawnerSystem({ beingLibrary, beingInstanceStore }));

// "A living world is one that quietly notices... rather than individual
// systems inventing their own logic, they should all observe the same
// world state." Constructed here, once every dependency it reads from
// already exists (see WorldAwareness.js's own comment on why it owns no
// state of its own, only knows where to find it) — `worldAwareness`
// itself is handed to `residentController` a few lines below, after
// `residentController` exists, since some of these same dependencies
// (`beingInstanceStore` included) weren't ready yet at that constructor's
// own call site further up this file.
const worldEventLog = new WorldEventLog();
const worldAwareness = new WorldAwareness({
  timeOfDaySystem,
  environmentSystem,
  musicSystem,
  cameraSystem,
  projectsStore,
  beingInstanceStore,
  residentState,
  worldEventLog,
});
residentController.worldAwareness = worldAwareness;

// Version 3, Phase 8b ("Bubble Gains Hands") — the fixed, Workshop-owned
// function table every granted resident calls through (see
// WorkshopFunctions.js's own comment). Constructed once every real
// system/store it dispatches into already exists, the same "wire it up
// once dependencies are ready" placement worldAwareness above already
// follows.
const workshopFunctionDispatcher = createWorkshopFunctionDispatcher({
  engine,
  cameraSystem,
  worldObjectsStore,
  worldObjectsSystem,
  objectLibraryStore,
  blueprintStore,
  beingInstanceStore,
  beingLibrary,
  environmentSystem,
  timeOfDaySystem,
  lightingSystem,
  musicSystem,
  residentController,
});

// "Begin introducing lightweight world events... weather changing,
// sunrise, sunset, music beginning... nothing should feel scripted.
// Everything should simply feel like the world continuing." Each
// listener below only records a genuine *transition* (this weather is
// different from the last one noted, day just became night, a song just
// started), never a continuous stream of the same ongoing state — see
// WorldEventLog.js's own comment on why this stays "meaningful," not
// "infinite," history.
{
  let lastWeatherId = null;
  engine.events.on("environment:changed", (state) => {
    if (state.id && state.id !== lastWeatherId) {
      if (lastWeatherId !== null) worldEventLog.record("weatherChanged", `The weather turned ${WEATHER_STATES[state.id]?.label ?? state.id}.`);
      lastWeatherId = state.id;
    }
  });

  let lastIsNight = null;
  engine.events.on("timeofday:changed", (state) => {
    const isNight = currentTimeBucket(timeOfDaySystem) === "night";
    if (lastIsNight !== null && isNight !== lastIsNight) worldEventLog.record(isNight ? "nightfall" : "sunrise", isNight ? "Night fell over the Workshop." : "The sun rose over the Workshop.");
    lastIsNight = isNight;
    void state;
  });

  let wasMusicPlaying = false;
  engine.events.on("music:playbackStateChanged", () => {
    if (musicSystem.isPlaying && !wasMusicPlaying) {
      const title = musicSystem.currentSong?.title;
      worldEventLog.record("musicStarted", title ? `"${title}" began playing.` : "Music began playing.");
    }
    wasMusicPlaying = musicSystem.isPlaying;
  });
}

// Workshop Diagnostics phase — the technical counterpart to
// WorldEventLog above; see WorkshopEventLog.js's own comment on why
// they're two separate stores, not one merged log. Same discipline:
// every listener below only records a genuine transition it's told
// about by an event that already exists, never a new signal invented
// for this.
const workshopEventLog = new WorkshopEventLog();
{
  engine.events.on("plugin:error", ({ id, error }) => {
    workshopEventLog.record("pluginError", `Plugin "${id}" failed: ${error}`, "error");
  });
  let lastAiStatus = null;
  aiConnectionManager.events.on("connection:changed", () => {
    if (lastAiStatus !== null && aiConnectionManager.status !== lastAiStatus) {
      workshopEventLog.record("aiConnection", `AI connection ${aiConnectionManager.status}.`, aiConnectionManager.status === "disconnected" ? "warning" : "info");
    }
    lastAiStatus = aiConnectionManager.status;
  });
  let lastHostStatus = null;
  hostConnectionManager.events.on("hostConnection:changed", () => {
    if (lastHostStatus !== null && hostConnectionManager.status !== lastHostStatus) {
      workshopEventLog.record("hostConnection", `Workshop Host Companion ${hostConnectionManager.status}.`, "info");
    }
    lastHostStatus = hostConnectionManager.status;
  });
  engine.events.on("persistence:saveFailed", () => {
    workshopEventLog.record("saveFailed", "A Workshop save attempt failed.", "error");
  });
}
// "Interaction: Talk, Wave, Inspect, None." Deliberately not a chat
// interface — a Being isn't connected to Ollama the way the Workshop's
// own resident is (see docs/AI.md/docs/RESIDENT.md) — a brief, honest
// acknowledgment via the same "hud:toast" mechanism the rest of the
// Workshop already uses for short, transient messages.
engine.events.on("being:interact", ({ instanceId, definitionId }) => {
  const definition = beingLibrary.get(definitionId);
  const instance = beingInstanceStore.get(instanceId);
  const name = instance?.name || definition?.name || "This Being";
  const text = {
    talk: `${name}: "${definition?.description || "..."}"`,
    wave: `${name} waves at you.`,
    inspect: definition?.description || `${name} doesn't have a description yet.`,
  }[definition?.interactionBehaviour] ?? `${name}.`;
  engine.events.emit("hud:toast", { text });
});

// The Settings app's Danger Zone needs to reach across several stores
// that don't otherwise know about each other (this is deliberately a
// plain object of closures, not a new system — "resist adding new
// systems" — since it's four buttons calling existing store methods, not
// an ongoing responsibility). Referencing persistenceSystem/etc. here,
// before their own `const` declarations below, is safe: these functions
// are only ever *called* later, from a button click in the UI, long
// after every one of those declarations has already run — a closure
// captures the variable binding, not its value at this point in the file.
const dangerZoneActions = {
  clearCache: () => persistenceSystem.clearServiceWorkerCache(),
  resetSettings: () => settingsStore.resetToDefaults(),
  async resetPlayerData() {
    const textureIds = new Set();
    // Every body model's own appearance, not just the currently active
    // one — each is independently customisable (see
    // PlayerAppearanceStore.js), and resetToDefaults() below clears all
    // of them, so any texture referenced by whichever model *isn't*
    // active right now still needs collecting here or it's orphaned in
    // TextureStore rather than actually cleaned up.
    for (const appearance of Object.values(appearanceStore.appearanceByModel)) {
      for (const part of Object.values(appearance.parts)) if (part.textureId) textureIds.add(part.textureId);
    }
    for (const outfit of outfitStore.all()) for (const part of Object.values(outfit.appearance.parts)) if (part.textureId) textureIds.add(part.textureId);
    appearanceStore.resetToDefaults();
    outfitStore.resetToDefaults();
    for (const id of textureIds) await textureStore.remove(id);
  },
  // Workshop Reliability phase — "Factory Reset no longer resets every
  // supported Workshop system." Root cause: this list was never updated
  // as new IndexedDB-backed stores were added after it was first
  // written — `workshop-models` (ModelAssetStore.js, imported 3D models)
  // and `workshop-display-images` (ImageAssetStore.js, Display Surface
  // photos) both silently survived a "Factory Reset" ever since. Every
  // real `indexedDB.open(DB_NAME, ...)` call in the project is now
  // listed here — see each store's own `DB_NAME` constant.
  factoryReset: () => persistenceSystem.factoryReset(["workshop-player-textures", "workshop-music-handles", "workshop-models", "workshop-display-images"]),
};

// ComputerSystem needs FurnitureSystem (already registered, above) to have
// *run* init() before it can find the desk — guaranteed by registering it
// after FurnitureSystem — and needs CameraSystem's update to have already
// run each frame before it projects the screen — guaranteed by registering
// it after CameraSystem too. See src/computer/ComputerSystem.js.
const computerSystem = engine.addSystem(
  new ComputerSystem({
    projectsStore,
    notesStore,
    toolsStore,
    musicSystem,
    lightingSystem,
    timeOfDaySystem,
    environmentSystem,
    worldEventLog,
    worldAwareness,
    objectLibraryStore,
    worldObjectsStore,
    worldObjectsSystem,
    settingsStore,
    atmosphereProfileStore,
    appearanceStore,
    outfitStore,
    textureStore,
    animationLibraryStore,
    poseLibraryStore,
    imageLibraryStore,
    imageAssetStore,
    browserStore,
    pageRegistry,
    aiConnectionManager,
    modelRegistry,
    residentProfileStore,
    expressionSetStore,
    residentBehaviour,
    residentConnection,
    residentState,
    residentPreferences,
    playerPatternMemory,
    residentCuriosity,
    conversationMemory,
    cameraSystem,
    interiorSystem,
    hostManager,
    modelLibrary,
    modelAssetStore,
    modelLoader,
    beingLibrary,
    beingInstanceStore,
    beingController,
    beingSpawnerSystem,
    dangerZoneActions,
    audioSystem,
  })
);
void computerSystem;

// Same reasoning as ComputerSystem, for the same two reasons (finding the
// bench, projecting the clipboard against this frame's camera). See
// src/workbench/WorkbenchSystem.js.
const workbenchSystem = engine.addSystem(new WorkbenchSystem({ projectsStore, audioSystem }));

const interactionSystem = engine.addSystem(new InteractionSystem());

// BuildModeSystem no longer coordinates with InteractionSystem directly at
// all — Build Mode is a Phone app now, and PhoneSystem's own open-guard +
// `phone:opened`/`phone:closed` events handle the mutual exclusion for
// every app uniformly (see all three files' comments). It looks up
// CameraSystem/RoomLayoutSystem/
// WorldObjectsSystem at the moment it needs them, not at init() time, so it
// has no strict ordering requirement beyond "after the systems it looks up
// already exist in the list" (they do, above).
const buildModeSystem = engine.addSystem(new BuildModeSystem({ objectLibraryStore, worldObjectsStore, modelLibrary, modelLoader, modelAssetStore, blueprintStore, terrainSystem }));

// "Plugin SDK" phase — every SDK-style plugin (`{manifest, setup(Workshop)}`)
// loads here, through `loadWorkshopPlugin()`, before the Phone (below)
// or the Computer (`engine.init()`, later) build their own app lists —
// see `WorkshopSDK.js`'s own `registerPhoneApp()`/`registerComputerApp()`
// comments for why that ordering matters. Each plugin gets its own SDK
// instance, scoped to its own manifest id — see `docs/PLUGIN_SDK.md`.
// The two *original* example plugins (`examplePagePlugin`,
// `calculatorPlugin`, registered later via `hostManager.pluginRegistry`
// directly) are untouched — this is a new, additional way to load a
// plugin, not a replacement for the contracts they already use.
const WORKSHOP_VERSION = "2.1.5";
const pluginContext = {
  engine,
  pageRegistry,
  hostManager,
  pluginPermissions,
  pluginStorage,
  projectsStore,
  registerComputerAppFactory: registerAppFactory,
  registerPhoneAppFactory,
  workshopVersion: WORKSHOP_VERSION,
};
loadWorkshopPlugin(workshopToolkitPlugin(), pluginContext);

// "The Computer is for creating. The Phone is for using." Built after
// every system/store an app might need already exists above — the exact
// same "assemble the shared deps object once, hand it to every app
// factory" shape ComputerSystem's own construction (below) already uses.
const phoneApps = buildPhoneApps({
  buildModeSystem,
  beingLibrary,
  beingInstanceStore,
  beingSpawnerSystem,
  beingController,
  appearanceStore,
  outfitStore,
  pageRegistry,
  browserStore,
  residentProfileStore,
  residentController,
  residentConnection,
  residentBehaviour,
  environmentSystem,
  timeOfDaySystem,
  musicSystem,
  lightingSystem,
  cameraSystem,
  animationLibraryStore,
  playerAnimationSystem,
  settingsStore,
  engine,
});
const phoneSystem = engine.addSystem(new PhoneSystem(phoneApps, settingsStore));

// "Introduce a shared persistence service responsible for session
// timestamps, elapsed real-world time, world continuation helpers."
// Constructed here, immediately before PersistenceSystem, so its own
// init() is already listening for "world:continuityReady" by the time
// that fires — see WorldTimeService.js's own comment.
const worldTimeService = engine.addSystem(new WorldTimeService());
const persistenceSystem = engine.addSystem(new PersistenceSystem()); // last: loads after everyone has registered listeners
// Workshop Workflow phase — SettingsApp.js's own "Workshop Data" section
// (Export/Import Backup, moved here from HUD.js) needs persistenceSystem,
// which doesn't exist yet when ComputerSystem itself is constructed
// above — mutating its already-captured `deps` object (the same one
// `buildApps()` reads from, deferred until `engine.init()` much later)
// is the same pattern this file already uses wherever a dependency's
// own "last, by design" position would otherwise create a chicken-and-
// egg problem.
computerSystem.deps.persistenceSystem = persistenceSystem;
// Phase 11 ("Workshop Character") — same deferred-assignment pattern as
// persistenceSystem just above: computerSystem (and its AIApp Sandbox)
// is constructed before worldTimeService exists.
computerSystem.deps.worldTimeService = worldTimeService;

void interactionSystem;

persistenceSystem.registerProvider("projects", projectsStore);
persistenceSystem.registerProvider("notes", notesStore);
persistenceSystem.registerProvider("tools", toolsStore);
persistenceSystem.registerProvider("objectLibrary", objectLibraryStore);
persistenceSystem.registerProvider("blueprints", blueprintStore);
persistenceSystem.registerProvider("workshopProjects", workshopProjectStore);
persistenceSystem.registerProvider("phone", phoneSystem);
persistenceSystem.registerProvider("worldObjects", worldObjectsStore);
persistenceSystem.registerProvider("musicLibrary", musicLibraryStore);
persistenceSystem.registerProvider("playlists", playlistStore);
persistenceSystem.registerProvider("settings", settingsStore);
persistenceSystem.registerProvider("atmosphereProfiles", atmosphereProfileStore);
persistenceSystem.registerProvider("expressionSets", expressionSetStore);
persistenceSystem.registerProvider("pluginPermissions", pluginPermissions);
persistenceSystem.registerProvider("pluginStorage", pluginStorage);
persistenceSystem.registerProvider("playerAppearance", appearanceStore);
persistenceSystem.registerProvider("outfits", outfitStore);
persistenceSystem.registerProvider("imageLibrary", imageLibraryStore);
persistenceSystem.registerProvider("browser", browserStore);
persistenceSystem.registerProvider("aiConnection", aiConnectionManager);
persistenceSystem.registerProvider("aiResidents", residentProfileStore);
persistenceSystem.registerProvider("residentState", residentState);
persistenceSystem.registerProvider("residentPreferences", residentPreferences);
persistenceSystem.registerProvider("playerPatternMemory", playerPatternMemory);
persistenceSystem.registerProvider("residentCuriosity", residentCuriosity);
persistenceSystem.registerProvider("conversationMemory", conversationMemory);
persistenceSystem.registerProvider("modelLibrary", modelLibrary);
persistenceSystem.registerProvider("beingLibrary", beingLibrary);
persistenceSystem.registerProvider("beingInstances", beingInstanceStore);
persistenceSystem.registerProvider("animationLibrary", animationLibraryStore);
persistenceSystem.registerProvider("poseLibrary", poseLibraryStore);
persistenceSystem.registerProvider("plugins", engine.plugins);
persistenceSystem.registerProvider("hostPermissions", hostManager.permissions);
persistenceSystem.registerProvider("hostProjects", hostManager.services.get("projects"));
persistenceSystem.registerProvider("assetLibrary", assetService);
persistenceSystem.registerProvider("terrain", terrainSystem);
persistenceSystem.registerProvider("worldEventLog", worldEventLog);
persistenceSystem.registerProvider("workshopEventLog", workshopEventLog);

// --- Overlays: one registration per physical object that opens a panel ---
// (The computer and the workbench no longer work this way — see
// src/computer/ and src/workbench/ — but every other physical object in
// the room still does.)
const overlayManager = new OverlayManager(document.getElementById("overlay-root"), engine);
overlayManager.register("pinboard", createPinboardOverlay({ projectsStore }));
overlayManager.register("notebook", createNotebookOverlay({ notesStore }));
overlayManager.register("music", createMusicOverlay({ musicSystem, libraryStore: musicLibraryStore, playlistStore }));
overlayManager.register("archive", createArchiveOverlay({ projectsStore }));
overlayManager.register("toolStorage", createToolStorageOverlay({ toolsStore, projectsStore, audioSystem, workbenchSystem }));
overlayManager.register(
  "residentConversation",
  createResidentConversationOverlay({
    residentConnection,
    residentProfileStore,
    residentBehaviour,
    projectsStore,
    residentPreferences,
    playerPatternMemory,
    residentCuriosity,
    conversationMemory,
    worldObjectsStore,
    environmentSystem,
    timeOfDaySystem,
    worldEventLog,
    worldAwareness,
    worldTimeService,
    functionDispatcher: workshopFunctionDispatcher,
  })
);
overlayManager.register("window", createWindowOverlay({ environmentSystem, timeOfDaySystem }));
overlayManager.register("restNook", createRestNookOverlay({ projectsStore }));
overlayManager.register("wardrobe", createWardrobeOverlay({ appearanceStore, outfitStore, textureStore }));

new HUD(document.getElementById("hud-root"), engine);

// --- Example plugin (see /src/plugins/examples/dustMotesPlugin.js + docs/PLUGIN_GUIDE.md) ---
engine.plugins.register(dustMotesPlugin());

// --- Workshop Platform: completing the Workshop Host (see docs/HOST.md)
// --- three services that need stores/engine access HostManager didn't
// have at its own construction time (see HostManager.js's own comment),
// plus dynamic asset-kind registration for AssetService.
hostManager.services.register("plugins", new PluginService({ engine, pluginRegistry: hostManager.pluginRegistry, pluginPermissions }));
hostManager.services.register("pluginPermissions", pluginPermissions);
hostManager.services.register("pluginStorage", pluginStorage);
hostManager.services.register("expressionSets", expressionSetStore);
hostManager.services.register("workshopEventLog", workshopEventLog);
hostManager.services.register(
  "residents",
  new ResidentService({ residentProfileStore, residentState, residentBehaviour, conversationMemory })
);
hostManager.services.register(
  "diagnostics",
  new DiagnosticsService({ engine, persistenceSystem, aiConnectionManager, hostConnectionManager, hostManager, pageRegistry, browserStore, searchIndex, residentController, workshopEventLog, worldEventLog })
);
// "The Host should understand assets independently of the Builder or
// Browser... assets should be capable of registering themselves with the
// Host" — one registerKind() call per real backing store. Each kind now
// also hands over `toDescriptor()` (mapping its own real item into the
// shared Workshop Asset envelope — see WorkshopAssetSchema.js) and,
// where a real relationship exists, `getDependencies()`. Kinds that
// don't track anything worth calling a dependency (Animations, Models,
// Images, Music) simply omit it — AssetService.js's own default is an
// honestly empty array, not a fabricated one. `assetService` itself was
// already obtained much earlier in this file, right next to `hostManager`
// — see that declaration's own comment for why.
assetService.registerKind("objects", {
  label: "Objects",
  // "The World Builder should consume Workshop Assets rather than
  // maintaining separate object systems... landscape assets should
  // become Workshop Assets just like every other object." Construction
  // Library pieces (walls, doors — and, new this phase, every Nature/
  // Paths piece) were always a second *source* of the identical
  // definition shape `ObjectLibraryStore` items already have (see
  // ConstructionLibrary.js's own comment) — merging them into this one
  // kind is what makes that true for the Asset System specifically:
  // real search, favouriting, and a Browser detail page for a Tree or a
  // Stone Path, exactly like a player-designed object gets.
  all: () => [...objectLibraryStore.all(), ...CONSTRUCTION_PIECES],
  get: (id) => objectLibraryStore.get(Number(id)) ?? objectLibraryStore.get(id) ?? getConstructionPiece(id),
  toDescriptor: (o) => {
    if (o.isConstruction) {
      // A permanent, code-defined piece — genuinely no author beyond
      // the Workshop itself, and no creation date, since "created" isn't
      // a meaningful question for something that's always existed. Its
      // own construction *group* (already the exact categorisation the
      // Builder Phone's own library screen groups by) becomes its real
      // Asset System category, rather than the single flat
      // `category: "Construction"` every piece happens to share.
      return {
        name: o.name,
        description: o.description,
        author: "Workshop",
        categories: [getConstructionGroup(o.id)],
        tags: ["construction", ...(o.tags ?? [])],
        thumbnail: buildSwatchThumbnail((o.parts ?? []).map((p) => p.color)),
      };
    }
    return {
      name: o.name,
      description: o.description,
      categories: o.category ? [o.category] : [],
      tags: o.tags ?? [],
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      thumbnail: buildSwatchThumbnail((o.parts ?? []).map((p) => p.color)),
    };
  },
  validateItem: (o) => {
    if (o.isConstruction) return []; // permanent and hand-authored — never in an invalid state the way a player-designed object briefly could be
    const issues = [];
    if (!Number.isFinite(o.defaultScale) || o.defaultScale <= 0) issues.push("Invalid scale.");
    if (!o.parts || o.parts.length === 0) issues.push("No parts defined.");
    return issues;
  },
});
assetService.registerKind("blueprints", {
  label: "Blueprints",
  all: () => blueprintStore.all(),
  get: (id) => blueprintStore.get(id),
  toDescriptor: (b) => ({
    name: b.name,
    categories: ["Workshop"],
    createdAt: b.createdAt,
    thumbnail: buildSwatchThumbnail(b.objects.map((o) => objectLibraryStore.get(o.definitionId)?.parts?.[0]?.color).filter(Boolean)),
  }),
  // "Blueprints using Models" (the brief's own example, using this
  // Workshop's actual terms: a Blueprint is made of Object definitions)
  // — the one dependency relationship that's genuinely real and
  // computable today, straight from data every Blueprint already has.
  getDependencies: (b) => [...new Set(b.objects.map((o) => `objects:${o.definitionId}`))],
  exportItem: (b) => blueprintStore.exportBlueprint(b.id),
});
assetService.registerKind("animations", {
  label: "Animations",
  all: () => animationLibraryStore.all(),
  // A real bug, found and fixed here: AnimationLibraryStore.get(id)
  // deliberately only searches *user* clips (see its own comment) —
  // getClip(id) is the one that resolves either kind. Using the wrong
  // one here meant AssetService.describe()/exists() silently failed for
  // any of the eight seeded default clips (Walk, Wave, Jump, and so on)
  // — not just a broken detail page (see AssetPages.js's own matching
  // fix), but a false "missing dependency" validation warning on any
  // Being or Blueprint that referenced one, and a favourited default
  // clip quietly vanishing from its own Favourites list.
  get: (id) => animationLibraryStore.getClip(id),
  toDescriptor: (a) => ({
    name: a.name,
    description: a.description,
    categories: a.category ? [a.category] : [],
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }),
  validateItem: (a) => ((a.frames ?? []).length === 0 ? ["No frames defined."] : []),
});
assetService.registerKind("models", {
  label: "Models",
  all: () => modelLibrary.all(),
  get: (id) => modelLibrary.get(id),
  toDescriptor: (m) => ({ name: m.name, categories: ["Workshop"], tags: [m.format], createdAt: new Date(m.addedAt).toISOString() }),
});
// Workshop Personality phase — "expression collections should become
// Workshop Assets... metadata, categories, tags, thumbnails, import,
// export, versioning, sharing." The identical pattern every other kind
// here already follows; only the thumbnail is genuinely new — a real
// small rendering of what was actually drawn (`buildPixelThumbnail()`),
// not a placeholder. Prefers "neutral" for the thumbnail since it's the
// resting expression every set is most likely to have actually drawn
// first, falling back to whichever expression the set does have
// something for.
assetService.registerKind("expressions", {
  label: "Expression Sets",
  all: () => expressionSetStore.all(),
  get: (id) => expressionSetStore.get(id),
  toDescriptor: (set) => {
    const firstDrawn = set.expressions.neutral ? "neutral" : Object.keys(set.expressions)[0];
    const thumbnail = firstDrawn ? buildPixelThumbnail(set.expressions[firstDrawn], set.gridSize) : null;
    return {
      name: set.name,
      categories: ["Workshop"],
      tags: Object.keys(set.expressions),
      thumbnail,
      createdAt: set.createdAt,
    };
  },
  exportItem: (set) => expressionSetStore.exportSet(set.id),
});
assetService.registerKind("images", {
  label: "Images",
  all: () => imageLibraryStore.all(),
  get: (id) => imageLibraryStore.get(id),
  toDescriptor: (i) => ({ name: i.name, categories: ["Workshop"], createdAt: new Date(i.addedAt).toISOString() }),
});
assetService.registerKind("music", {
  label: "Music",
  all: () => musicLibraryStore.allSongs(),
  get: (id) => musicLibraryStore.getSong(id),
  toDescriptor: (s) => ({ name: s.title, description: [s.artist, s.album].filter(Boolean).join(" \u2014 "), categories: ["Workshop"], tags: [s.artist, s.album].filter(Boolean) }),
});
// "Pose Library... these should become reusable Workshop Assets" —
// Advanced Animation phase. A pose has no dependencies of its own to
// compute (it's a single frame, not a sequence referencing anything
// else), so this kind simply omits getDependencies() — AssetService.js's
// own default (an honestly empty array) is exactly right here.
assetService.registerKind("poses", {
  label: "Poses",
  all: () => poseLibraryStore.all(),
  get: (id) => poseLibraryStore.get(id),
  toDescriptor: (p) => ({ name: p.name, categories: p.category ? [p.category] : [], createdAt: p.createdAt, updatedAt: p.updatedAt }),
});
// "Being Creator should now fully integrate with the Workshop Asset
// System... completed beings should become Workshop Assets." A Being
// genuinely depends on the two other kinds it can reference — the model
// it's built from (if `bodySource === "model"`) and whichever animation
// clips it's assigned — computed the same real way Blueprints depending
// on Objects already is (Phase 5's own flagship example), not fabricated.
// A small, honest mapping onto WorkshopAssetSchema's own suggested
// vocabulary (WORKSHOP_ASSET_CATEGORIES) — BeingBehaviours.BEING_TYPES
// has its own, different set of ids (organisational labels, not asset
// categories), so this is a deliberate translation, not a duplication of
// either list.
const BEING_TYPE_CATEGORY = { resident: "Characters", person: "Characters", animal: "Nature", robot: "Characters", creature: "Nature", decoration: "Workshop", custom: "Characters" };
assetService.registerKind("beings", {
  label: "Beings",
  all: () => beingLibrary.all(),
  get: (id) => beingLibrary.get(id),
  toDescriptor: (b) => ({
    name: b.name,
    description: b.description,
    author: "You",
    categories: [BEING_TYPE_CATEGORY[b.beingType] ?? "Characters"],
    tags: b.tags,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    thumbnail: b.bodySource === "primitives" ? buildSwatchThumbnail(b.bodyParts.map((p) => p.color)) : null,
  }),
  getDependencies: (b) => {
    const deps = [];
    if (b.bodySource === "model" && b.modelId) deps.push(`models:${b.modelId}`);
    if (b.idleAnimationClipId) deps.push(`animations:${b.idleAnimationClipId}`);
    if (b.walkAnimationClipId) deps.push(`animations:${b.walkAnimationClipId}`);
    return deps;
  },
  validateItem: (b) => {
    const issues = [];
    if (b.bodySource === "primitives" && b.bodyParts.length === 0) issues.push("No body parts \u2014 this Being has no visible shape yet.");
    if (b.bodySource === "model" && !b.modelId) issues.push("No model chosen \u2014 this Being will appear as a placeholder shape.");
    if (b.bodySource === "primitives" && !b.bodyParts.some((p) => p.jointName)) issues.push("No Rig Joints assigned \u2014 this Being can't play Workshop animations yet.");
    return issues;
  },
  // `exportDefinition()` returns a JSON *string* (the older of this
  // Workshop's two export conventions \u2014 see BeingLibrary.js's own top
  // comment), not the plain object `AssetService.exportAsset()`'s own
  // contract expects (matching `toDescriptor`/`getDependencies`
  // /`validateItem` above); parsed back once here rather than changing a
  // working, already-wired method just for this.
  exportItem: (b) => {
    const json = beingLibrary.exportDefinition(b.id);
    return json ? JSON.parse(json) : null;
  },
});
// Version 3, Phase 7 ("Sharing the Workshop") — three real, player-
// creatable kinds of data that had never been registered with
// AssetService at all before this phase, found while wiring up the
// unified Export button: Atmosphere Profiles, custom Calculators, and
// AI Resident Profiles. Each already had (or, this phase, gained) a
// working store with real export; registering them here is what
// actually makes them Workshop Assets — discoverable in `asset://`,
// included in `workshop://search`, favouritable — not just exportable
// from their own dedicated app, the same "one shared vocabulary,
// regardless of which store actually holds the data" standard
// `docs/ASSETS.md` already sets for everything else.
assetService.registerKind("atmosphere", {
  label: "Atmosphere Profiles",
  all: () => atmosphereProfileStore.all(),
  get: (id) => atmosphereProfileStore.getProfile(id),
  toDescriptor: (p) => ({
    name: p.name,
    description: p.description,
    author: atmosphereProfileStore.isBuiltIn(p.id) ? "Workshop" : "You",
    categories: ["Atmosphere"],
    tags: [p.weather?.current].filter(Boolean),
    createdAt: p.createdAt,
  }),
  exportItem: (p) => atmosphereProfileStore.exportProfile(p.id),
});
assetService.registerKind("calculators", {
  label: "Calculators",
  all: () => toolsStore.allCustomCalculators(),
  get: (id) => toolsStore.getCustomCalculator(id),
  toDescriptor: (c) => ({
    name: c.title,
    description: c.description,
    categories: [c.category ? c.category.charAt(0).toUpperCase() + c.category.slice(1) : "Tools"],
    tags: c.tags,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }),
  validateItem: (c) => ((c.outputs ?? []).length === 0 ? ["No outputs defined."] : []),
  exportItem: (c) => toolsStore.exportCustomCalculator(c.id),
});
assetService.registerKind("residents", {
  label: "AI Resident Profiles",
  all: () => residentProfileStore.all(),
  get: (id) => residentProfileStore.get(id),
  toDescriptor: (p) => ({
    name: p.name,
    description: p.identity?.personality ?? "",
    categories: ["Characters"],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }),
  // A profile's own referenced Expression Set is a real, computable
  // dependency the moment it isn't the reserved "default" sentinel —
  // the identical reasoning Beings already apply to their own
  // modelId/animation references above.
  getDependencies: (p) => (p.expressionSetId && p.expressionSetId !== "default" ? [`expressions:${p.expressionSetId}`] : []),
  exportItem: (p) => residentProfileStore.exportProfile(p.id),
});

// --- Browser Ecosystem: Workshop pages, Host pages, Asset pages, Unified
// Search, and plugin pages (see docs/BROWSER.md) — registered here,
// after every store any of them needs already exists, not from inside
// BrowserApp.js itself, which only ever talks to pageRegistry.resolve().
registerWorkshopPages(pageRegistry, searchIndex, {
  projectsStore,
  browserStore,
  hostProjectsService: hostManager.services.get("projects"),
  residentProfileStore,
  residentState,
  residentBehaviour,
  conversationMemory,
  aiConnectionManager,
  engine,
  persistenceSystem,
  hostManager,
  pageRegistry,
  searchIndex,
});
registerHostPages(pageRegistry, searchIndex, { hostManager, modelRegistry });
registerAssetPages(pageRegistry, searchIndex, { objectLibraryStore, blueprintStore, animationLibraryStore, modelLibrary, imageLibraryStore, musicLibraryStore, worldObjectsStore, assetService, beingLibrary, getConstructionPiece });

// "Plugins should be capable of registering Browser pages... naturally
// integrate into Browser navigation without requiring hardcoded
// support." Two real, working examples — see each plugin's own file for
// why these two specifically (a reference contract demo, and a
// genuinely functional calculator) rather than the brief's other example
// names (plugin://weather, plugin://inventory), which would need either
// a fabricated live data source or a backing store with no natural owner
// yet.
hostManager.pluginRegistry.registerPlugin(examplePagePlugin());
hostManager.pluginRegistry.registerPlugin(calculatorPlugin());

// --- Boot ---
_setEntryStatus("Preparing the Workshop\u2026");
await engine.init();
// Must happen after engine.init() resolves, not inside either system's own
// init() — persistence loading happens synchronously as part of the
// engine:ready event that fires at the end of engine.init(), so only
// *after* awaiting it are ObjectLibraryStore/WorldObjectsStore/ProjectsStore/
// MusicLibraryStore/PlayerAppearanceStore guaranteed to hold whatever was
// actually saved. See the comments on WorldObjectsSystem.spawnAll() and
// WorkbenchSystem/MusicSystem/PlayerCharacterSystem's own finalizeInitialState().
_setEntryStatus("Finishing touches\u2026");
worldObjectsSystem.spawnAll();
workbenchSystem.finalizeInitialState();
await musicSystem.finalizeInitialState(); // async: checks each library root's still-live permission state
await playerCharacterSystem.finalizeInitialState(); // async: resolves any part textures before the first rig build
engine.start();

// Workshop Refinement phase (Pass A) — the other half of the entry
// screen wiring above. If the button was already pressed while this was
// still running, honour that now, immediately, rather than making
// someone who was ready and waiting press it a second time.
_workshopReady = true;
entryButton.disabled = false;
entryButton.textContent = "Step inside";
if (entryStatus) {
  entryStatus.textContent = "Ready when you are.";
  entryStatus.classList.add("ready");
}
if (_entryRequested) _enterWorkshop();

// Clicking the canvas re-acquires pointer lock (e.g. after Escape, or after
// closing an overlay) whenever nothing else is open — including the Phone,
// which needs the free cursor for its own clicks regardless of which app
// is currently open within it (see PhoneSystem). Reading Chair phase — the
// sitting area's own `allowLookAround` focus pose stays "active" the whole
// time the player is seated (that's what lets them get up again), but that
// no longer means the click-to-look-around gesture should stay blocked for
// as long as they're sitting quietly with nothing else open; see
// InteractionSystem.activeAllowsLookAround for the shared condition.
canvas.addEventListener("click", () => {
  if ((!interactionSystem.active || interactionSystem.activeAllowsLookAround) && !phoneSystem.isOpen) {
    engine.input.requestPointerLock();
  }
});
