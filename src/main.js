import { Engine } from "./core/Engine.js";
import { InputManager } from "./utils/InputManager.js";

import { RoomLayoutSystem } from "./systems/RoomLayoutSystem.js";
import { FurnitureSystem } from "./systems/FurnitureSystem.js";
import { ReflectionSystem } from "./systems/ReflectionSystem.js";
import { WorldEnvironmentSystem } from "./systems/WorldEnvironmentSystem.js";
import { LightingSystem } from "./systems/LightingSystem.js";
import { TimeOfDaySystem } from "./systems/TimeOfDaySystem.js";
import { EnvironmentSystem } from "./systems/EnvironmentSystem.js";
import { AudioSystem } from "./systems/AudioSystem.js";
import { CameraSystem } from "./systems/CameraSystem.js";
import { LadderSystem } from "./systems/LadderSystem.js";
import { InteriorSystem } from "./systems/InteriorSystem.js";
import { EmoteWheelSystem } from "./systems/EmoteWheelSystem.js";
import { CompassSystem } from "./systems/CompassSystem.js";
import { InteractionSystem } from "./systems/InteractionSystem.js";
import { PersistenceSystem } from "./systems/PersistenceSystem.js";
import { ComputerSystem } from "./computer/ComputerSystem.js";
import { WorkbenchSystem } from "./workbench/WorkbenchSystem.js";
import { ObjectLibraryStore } from "./worldbuilder/ObjectLibraryStore.js";
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
import { AIConnectionManager } from "./ai/AIConnectionManager.js";
import { ModelRegistry } from "./ai/ModelRegistry.js";
import { ResidentProfileStore } from "./ai/ResidentProfileStore.js";
import { PlayerCharacterSystem } from "./player/PlayerCharacterSystem.js";
import { PlayerAnimationSystem } from "./player/PlayerAnimationSystem.js";
import { AnimationLibraryStore } from "./player/AnimationLibraryStore.js";

import { ProjectsStore } from "./data/ProjectsStore.js";
import { NotesStore } from "./data/NotesStore.js";

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
const lightingSystem = engine.addSystem(new LightingSystem());
const timeOfDaySystem = engine.addSystem(new TimeOfDaySystem());
const environmentSystem = engine.addSystem(new EnvironmentSystem());
const audioSystem = engine.addSystem(new AudioSystem());
const cameraSystem = engine.addSystem(new CameraSystem());

void roomLayoutSystem;
void furnitureSystem;

// --- Plain data stores (not Engine systems — no scene/camera concerns) ---
const projectsStore = new ProjectsStore();
const notesStore = new NotesStore();
const objectLibraryStore = new ObjectLibraryStore();
const worldObjectsStore = new WorldObjectsStore();
const musicLibraryStore = new MusicLibraryStore();
const playlistStore = new PlaylistStore();
const browserStore = new BrowserStore();
const pageRegistry = new PageRegistry();
// "Workshop systems should simply expose pages that the Browser can
// display" — see WorkshopPages.js/PageRegistry.js's own comments. Called
// here, once every store it needs already exists, not from inside
// BrowserApp.js itself, which only ever talks to pageRegistry.resolve().
registerWorkshopPages(pageRegistry, { projectsStore, browserStore });

// "This is NOT the AI itself... preparing another presence." See
// src/ai/AIConnectionManager.js's own comment for why polling starts
// immediately and unconditionally here rather than waiting on anything
// else — it never blocks the Workshop either way, connected or not.
const aiConnectionManager = new AIConnectionManager();
const modelRegistry = new ModelRegistry();
const residentProfileStore = new ResidentProfileStore();
aiConnectionManager.init();
const settingsStore = new SettingsStore();
const appearanceStore = new PlayerAppearanceStore();
const outfitStore = new OutfitStore();
const textureStore = new TextureStore();
const imageLibraryStore = new ImageLibraryStore();
const imageAssetStore = new ImageAssetStore();

// WorldObjectsSystem has no dependency on other systems at init() time — it
// only needs engine.scene/engine.entities, which exist from construction —
// so its registration position is flexible; it's grouped here because it's
// conceptually "world contents", alongside the room and furniture.
const worldObjectsSystem = engine.addSystem(new WorldObjectsSystem({ objectLibraryStore, worldObjectsStore }));

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
const playerCharacterSystem = new PlayerCharacterSystem({ appearanceStore, textureStore });
engine.addSystem(playerCharacterSystem);
// See CameraSystem.js's own "Player Height" comment for why this is a
// setter call here rather than either system importing the other
// directly — the same circular-import avoidance PlayerAnimationSystem's
// own constructor-injected reference below already uses.
cameraSystem.setCharacterSystem(playerCharacterSystem);

const animationLibraryStore = new AnimationLibraryStore();
const playerAnimationSystem = new PlayerAnimationSystem({ characterSystem: playerCharacterSystem, libraryStore: animationLibraryStore });
engine.addSystem(playerAnimationSystem);
const ladderSystem = engine.addSystem(new LadderSystem());
void ladderSystem;
const interiorSystem = engine.addSystem(new InteriorSystem());
void interiorSystem;
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
  factoryReset: () => persistenceSystem.factoryReset(["workshop-player-textures", "workshop-music-handles"]),
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
    musicSystem,
    lightingSystem,
    timeOfDaySystem,
    environmentSystem,
    objectLibraryStore,
    worldObjectsStore,
    worldObjectsSystem,
    settingsStore,
    appearanceStore,
    outfitStore,
    textureStore,
    animationLibraryStore,
    imageLibraryStore,
    imageAssetStore,
    browserStore,
    pageRegistry,
    aiConnectionManager,
    modelRegistry,
    residentProfileStore,
    dangerZoneActions,
  })
);
void computerSystem;

// Same reasoning as ComputerSystem, for the same two reasons (finding the
// bench, projecting the clipboard against this frame's camera). See
// src/workbench/WorkbenchSystem.js.
const workbenchSystem = engine.addSystem(new WorkbenchSystem({ projectsStore }));

const interactionSystem = engine.addSystem(new InteractionSystem());

// BuildModeSystem suspends InteractionSystem purely over events (see both
// files' comments) and looks up CameraSystem/RoomLayoutSystem/
// WorldObjectsSystem at the moment it needs them, not at init() time, so it
// has no strict ordering requirement beyond "after the systems it looks up
// already exist in the list" (they do, above).
const buildModeSystem = engine.addSystem(new BuildModeSystem({ objectLibraryStore, worldObjectsStore }));

const persistenceSystem = engine.addSystem(new PersistenceSystem()); // last: loads after everyone has registered listeners

void interactionSystem;

persistenceSystem.registerProvider("projects", projectsStore);
persistenceSystem.registerProvider("notes", notesStore);
persistenceSystem.registerProvider("objectLibrary", objectLibraryStore);
persistenceSystem.registerProvider("worldObjects", worldObjectsStore);
persistenceSystem.registerProvider("musicLibrary", musicLibraryStore);
persistenceSystem.registerProvider("playlists", playlistStore);
persistenceSystem.registerProvider("settings", settingsStore);
persistenceSystem.registerProvider("playerAppearance", appearanceStore);
persistenceSystem.registerProvider("outfits", outfitStore);
persistenceSystem.registerProvider("imageLibrary", imageLibraryStore);
persistenceSystem.registerProvider("browser", browserStore);
persistenceSystem.registerProvider("aiConnection", aiConnectionManager);
persistenceSystem.registerProvider("aiResidents", residentProfileStore);
persistenceSystem.registerProvider("animationLibrary", animationLibraryStore);
persistenceSystem.registerProvider("plugins", engine.plugins);

// --- Overlays: one registration per physical object that opens a panel ---
// (The computer and the workbench no longer work this way — see
// src/computer/ and src/workbench/ — but every other physical object in
// the room still does.)
const overlayManager = new OverlayManager(document.getElementById("overlay-root"), engine);
overlayManager.register("pinboard", createPinboardOverlay({ projectsStore }));
overlayManager.register("notebook", createNotebookOverlay({ notesStore }));
overlayManager.register("music", createMusicOverlay({ musicSystem, libraryStore: musicLibraryStore, playlistStore }));
overlayManager.register("archive", createArchiveOverlay({ projectsStore }));
overlayManager.register("toolStorage", createToolStorageOverlay());
overlayManager.register("window", createWindowOverlay({ environmentSystem, timeOfDaySystem }));
overlayManager.register("restNook", createRestNookOverlay());
overlayManager.register("wardrobe", createWardrobeOverlay({ appearanceStore, outfitStore, textureStore }));

new HUD(document.getElementById("hud-root"), engine);

// --- Example plugin (see /src/plugins/examples/dustMotesPlugin.js + docs/PLUGIN_GUIDE.md) ---
engine.plugins.register(dustMotesPlugin());

// --- Boot ---
await engine.init();
// Must happen after engine.init() resolves, not inside either system's own
// init() — persistence loading happens synchronously as part of the
// engine:ready event that fires at the end of engine.init(), so only
// *after* awaiting it are ObjectLibraryStore/WorldObjectsStore/ProjectsStore/
// MusicLibraryStore/PlayerAppearanceStore guaranteed to hold whatever was
// actually saved. See the comments on WorldObjectsSystem.spawnAll() and
// WorkbenchSystem/MusicSystem/PlayerCharacterSystem's own finalizeInitialState().
worldObjectsSystem.spawnAll();
workbenchSystem.finalizeInitialState();
await musicSystem.finalizeInitialState(); // async: checks each library root's still-live permission state
await playerCharacterSystem.finalizeInitialState(); // async: resolves any part textures before the first rig build
engine.start();

const entryScreen = document.getElementById("entry-screen");
const entryButton = document.getElementById("entry-button");
entryButton.addEventListener("click", () => {
  audioSystem.resumeContext();
  engine.input.requestPointerLock();
  entryScreen.classList.add("hidden");
});

// Clicking the canvas re-acquires pointer lock (e.g. after Escape, or after
// closing an overlay) whenever nothing else is open — including Build Mode,
// which needs the free cursor for its own clicks (see BuildModeSystem).
canvas.addEventListener("click", () => {
  if (!interactionSystem.active && !buildModeSystem.active) engine.input.requestPointerLock();
});
