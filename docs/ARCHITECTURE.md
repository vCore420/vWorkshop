# Architecture

This document explains how the workshop is put together, and — more
importantly — *why* it's put together this way. Read this before making
structural changes; it should save you from re-deriving decisions that were
made deliberately.

## Guiding idea

The workshop is a **place**, not an app with a 3D skin. Concretely, that
shaped two decisions everywhere in this codebase:

1. **Software exists as physical objects.** There is no menu bar. Every
   feature is reached by walking somewhere and pressing a key. See
   "The interaction pipeline" below — it's the single mechanism every one
   of these physical interactions is built from.
2. **Everything is data-driven and swappable.** Placeholder geometry,
   placeholder audio, and placeholder art are all generated in code rather
   than sourced as files, and every one of those call sites is isolated
   behind a small factory (`PlaceholderFactory`, `ProceduralTexture`,
   `AudioSynth`) so a future pass can swap in real assets without touching
   the systems that use them.

## Directory layout

```
index.html                 entry point, import map for Three.js (CDN)
css/                        one file per interface surface: tokens.css (design tokens) · main.css (HUD/entry) · overlays.css · computer.css · builder.css · workbench.css · buildmode.css · phone.css · music.css · tools.css · touch.css · browser-pages.css (workshop:// page styling — loaded by PageShell, not index.html)
src/
  core/                      engine primitives — no Three.js *scene content* lives here
    Engine.js                owns renderer/scene/camera, runs the update/render loop
    EventBus.js              pub/sub used by every system to stay decoupled
    Entity.js, Component.js, EntityManager.js   the ECS-lite
    PluginManager.js         registers/updates/saves third-party-style plugins
    components/              MeshComponent, InteractableComponent
  systems/                   one file per system, added to the Engine in main.js
  entities/
    furniture/               one file per furniture definition + registry.js — see docs/FURNITURE.md
    room/                    WorkshopRoom.js — floor/walls (real openings + exterior shell)/roof builder
  computer/                  the computer, as one self-contained object — see docs/COMPUTER.md
  browser/                   PageRegistry.js, BrowserStore.js, WorkshopPages.js, AssetPages.js, SearchIndex.js, PageShell.js — see docs/BROWSER.md
  host/                      HostManager.js, ServiceRegistry.js, ProgramsService.js, ProjectsService.js, FilesService.js, DocumentsService.js, DownloadsService.js, AssetService.js, WorkshopAssetSchema.js, ResidentService.js, DiagnosticsService.js, PluginService.js, PermissionsService.js, PluginRegistry.js, AutomationService.js, HardwareService.js, HostConnectionManager.js, HostPages.js — see docs/HOST.md and docs/ASSETS.md
  ai/                        AIConnectionManager.js, ModelRegistry.js, ResidentProfileStore.js, MemoryConfiguration.js, EmbodimentConfiguration.js, TraitConfiguration.js, BehaviourDialsConfiguration.js, ProviderRegistry.js, PromptComposer.js — see docs/AI.md
  resident/                  ResidentEntity.js, ResidentMovement.js, ResidentBehaviour.js, ResidentRenderer.js, ResidentConnection.js, ResidentConversation.js, ResidentState.js, ResidentController.js, ResidentTraits.js, ResidentDials.js, ResidentContext.js, ResidentPreferences.js, PlayerPatternMemory.js, ResidentCuriosity.js, ConversationMemory.js, ResidentWorldSignals.js — see docs/RESIDENT.md
  world/                     WorldAwareness.js, WorldEventLog.js — the shared World Awareness layer, consumed by ResidentController.js today — see docs/RESIDENT.md's own "World Awareness" section
  beings/                    ModelAssetStore.js, ModelLibrary.js, ModelLoader.js, BodyCompiler.js, BeingBehaviours.js, BeingLibrary.js, BeingInstanceStore.js, BeingMovementSystem.js, BeingController.js, BeingSpawnerSystem.js — see docs/BEINGS.md
  phone/                     PhoneSystem.js, PhoneUI.js, apps/ (BuilderPhoneApp.js, BeingsPhoneApp.js, WardrobePhoneApp.js, BubblePhoneApp.js, BrowserPhoneApp.js, WorkshopPhoneApp.js, EmotesPhoneApp.js, SettingsPhoneApp.js, registry.js) — see docs/PHONE.md
  workbench/                 the workbench + Project Presence system — see docs/WORKBENCH.md
  tools/                     NativeCalculators.js, ToolFormula.js, CalculatorTemplates.js, ToolsStore.js, runTool.js, maxRects.js — the Workshop's tool library — see docs/TOOLS.md
  worldbuilder/               the world creation system (Builder + Build Mode +
                              ConstructionLibrary.js, the permanent building-block
                              set) — see docs/WORLDBUILDER.md and docs/WORLD.md
  music/                     the real music library + player — see docs/MUSIC.md
  settings/                  Workshop Settings: persisted data + the system that applies it — see docs/PERFORMANCE.md
  player/                    the player character rig + appearance/outfit/texture persistence, AnimationLibraryStore.js, AnimationPlayback.js, WorkshopSkeleton.js, AnimationRetargeting.js, TwoBoneIK.js, AnimationLayers.js, PoseLibraryStore.js — see docs/PLAYER.md and docs/ANIMATION.md
  data/                      plain state: layoutDefault.js, ProjectsStore.js, NotesStore.js
  ui/                        OverlayManager.js, HUD.js, overlays/*.js (one per physical panel)
  utils/                     PlaceholderFactory, ProceduralTexture, AudioSynth, InputManager, SimpleMarkdown, math, storage, ScreenProjector, AffinityTracker
  plugins/                   PluginManifest.js, PluginPermissions.js, PluginStorage.js, WorkshopSDK.js, PluginLoader.js — the Plugin SDK, see docs/PLUGIN_SDK.md
    examples/                dustMotesPlugin.js (engine.plugins contract), examplePagePlugin.js + calculatorPlugin.js (Browser-page contract, still fully supported — see docs/PLUGIN_GUIDE.md), workshopToolkitPlugin.js (the SDK's own reference example — see docs/PLUGIN_SDK.md)
  main.js                    wiring only — construct, register, start. No behaviour here.
docs/                        this file, SETUP.md, HISTORY.md, COMPUTER.md, WORKBENCH.md, FURNITURE.md, VISUAL_IDENTITY.md, AUDIO.md, TOOLS.md, DESIGN_SYSTEM.md, WORLDBUILDER.md, WORLD.md, ATMOSPHERE.md, POLISH.md, MUSIC.md, PERFORMANCE.md, PLAYER.md, ANIMATION.md, BROWSER.md, AI.md, RESIDENT.md, HOST.md, ASSETS.md, BEINGS.md, PHONE.md, PERSISTENCE.md, RESPONSIVE.md, REFINEMENT.md, ROADMAP.md, ROADMAP_V3.md (draft Version 3 directions), PLUGIN_GUIDE.md, PLUGIN_SDK.md, DIAGNOSTICS.md, HANDBOOK.md (the engineering handbook — read first), RELEASE_REVIEW.md (the v2.2.3d independent release assessment); CLAUDE.md at the repository root is the entry point for repository-first development
assets/                      README explaining the "no shipped binary assets yet" decision
host-companion/              a real, optional, zero-dependency local server the Workshop Host can talk to — NOT part of the browser bundle; see docs/HOST.md's own "The Workshop Host Companion" section and host-companion/README.md
```

## The engine loop

`Engine` (`src/core/Engine.js`) owns the one `THREE.Scene`, one
`THREE.PerspectiveCamera`, and the renderer. Everything else is a **system**
— a plain object with `init(engine)` and `update(dt)` — added via
`engine.addSystem(...)` in `main.js`, in a deliberate order:

```
RoomLayoutSystem    → builds the room shell (including its exterior and
                       wall colliders — see docs/WORLD.md); other systems
                       read its window panes and floor/wall geometry
FurnitureSystem     → builds every registered piece of furniture; Lighting
                       attaches fixtures to it, Camera collides against it
ReflectionSystem     → reaches into FurnitureSystem's already-built pieces
                       for a mirrorMesh marker (the wardrobe's mirror) —
                       see docs/PLAYER.md's "Reflections and third person"
WorldEnvironmentSystem → the outdoor ground + sky/fog; registered before
                       TimeOfDaySystem so it catches the first
                       `timeofday:changed` emission — see docs/WORLD.md
LightingSystem      → depends on Room/Furniture existing
TimeOfDaySystem      → computes sun/sky state and emits it; no longer
                       touches window panes directly (they're real glass
                       now) — Lighting and WorldEnvironmentSystem each
                       apply the parts they own
EnvironmentSystem    → dampens light, drives ambience, streaks the glass,
                       feeds WorldEnvironmentSystem's fog/cloud/wind state
AudioSystem          → reacts to EnvironmentSystem's events
CameraSystem         → collides against RoomLayoutSystem's wall colliders
                       and FurnitureSystem's footprints — no hard room
                       rectangle any more, see docs/WORLD.md
ComputerSystem       → reads FurnitureSystem's desk geometry; projects the
                       screen using CameraSystem's *already-updated* camera
                       this frame — see docs/COMPUTER.md
WorkbenchSystem      → same two reasons as ComputerSystem, for the bench's
                       clipboard panel and presence geometry — see
                       docs/WORKBENCH.md
InteractionSystem    → reads CameraSystem's position; also listens for
                       `phone:opened`/`phone:closed` to suspend itself
                       entirely while the Phone is open (which covers
                       Build Mode too — it's a Phone app now)
WorldObjectsSystem   → no strict ordering requirement (only needs
                       engine.scene/engine.entities, present from
                       construction) — see docs/WORLDBUILDER.md
MusicSystem          → same flexibility as WorldObjectsSystem — only needs
                       engine.events at init() time. Its own
                       finalizeInitialState() (root permission checks,
                       queue restore) runs after engine.init() resolves,
                       same reasoning as WorkbenchSystem's — see
                       docs/MUSIC.md
SettingsSystem       → looks up LightingSystem/WorldEnvironmentSystem/
                       AudioSystem/MusicSystem via getSystem() at init() —
                       safe regardless of order, see docs/PERFORMANCE.md
PlayerCharacterSystem → same flexibility as WorldObjectsSystem/MusicSystem
                       — only needs engine.scene/engine.events at init().
                       Its own finalizeInitialState() (the first rig
                       build, once appearance data has actually loaded)
                       runs after engine.init() resolves, same reasoning
                       as WorkbenchSystem's/MusicSystem's — see
                       docs/PLAYER.md
BuildModeSystem      → caches CameraSystem/FurnitureSystem/WorldObjectsSystem
                       at init() (same reasoning as everything else on
                       this list); still looks up RoomLayoutSystem/
                       WorldEnvironmentSystem/InteractionSystem on demand,
                       since those are only needed for specific,
                       infrequent operations (entering, or gathering
                       placement surfaces) rather than every interaction
                       — see docs/WORLDBUILDER.md
PersistenceSystem    → registered *last*, so every other system has already
                        registered its save/load listeners by the time it
                        loads the save file
```

If you add a system that depends on another system's data existing at
`init()` time, register it afterwards — `Engine.getSystem(SomeClass)` looks
it up by class, and nothing stops you from depending on a system that ran
earlier in the list. Systems should never depend on one registered *later*.

`WorkbenchSystem` has one more wrinkle worth knowing about: it can't decide
what's actually on the bench inside its own `init()`, because a save file
(if one exists) hasn't been applied to `ProjectsStore` yet at that point —
loading happens synchronously inside the `engine:ready` event, which fires
once, *after* every system's `init()` has already run. So `main.js` calls
`workbenchSystem.finalizeInitialState()` explicitly, once, right after
`await engine.init()` resolves. `WorldObjectsSystem.spawnAll()` (see
docs/WORLDBUILDER.md) follows the identical pattern, for the identical
reason — it can't spawn placed objects until `ObjectLibraryStore`/
`WorldObjectsStore` have actually loaded. If a future system needs real
persisted data to build its *initial* visible state (as opposed to just
reacting to `persistence:load` for its own bag key, which is fine inside
`init()`), this is the pattern to copy.

Every frame (`Engine._tick`): each system's `update(dt)` runs in
registration order, then all entities update, then all plugins update, then
input's per-frame deltas are cleared, then the frame renders.

## The ECS-lite

`Entity` is an id + a `Map` of `Component`s. `Component` is a base class
with `init()`/`update(dt)`/`dispose()`. Two components matter right now:

- **`MeshComponent`** — wraps a `THREE.Object3D`, adds it to the scene on
  init, disposes its geometry/materials on removal. Anything visible has one.
- **`InteractableComponent`** — the entire "software as physical objects"
  mechanism (see below). Anything the player can walk up to and press E on
  has one.

This is deliberately not a "real" ECS (no archetypes, no query caching,
components keyed by class not string). The workshop will have on the order
of tens of entities, never thousands — simplicity wins here.

## The interaction pipeline

This is the mechanism every single "walk up and press E" feature in the
brief is built from — sitting at the desk, the pinboard, the music cabinet, the
workbench, the shelves, the notebook, the door, the light switch, the
windows. Understanding this pipeline once means you understand all of them.

1. Every interactable entity carries an `InteractableComponent` with a
   `prompt`, a `radius`, an `onInteract` callback, and optionally a
   `focusPose` (camera should ease to a specific position/orientation, e.g.
   sitting down) and `opensOverlay: true` (this interaction opens a
   full-screen panel that needs an explicit exit).
2. **`InteractionSystem`** finds the nearest enabled interactable within its
   radius every frame and tells the HUD what prompt to show. It does *not*
   know what any interaction does.
3. On the interact key: `InteractionSystem` calls `onInteract()`, applies
   `focusPose` to `CameraSystem` if present, and — if the interaction opens
   an overlay or has a focus pose — locks camera movement and remembers
   this interaction as "active".
4. `onInteract()` itself, for most furniture, just emits
   `engine.events.emit("interaction:trigger", { overlayId, context })`.
   **`OverlayManager`** is the only thing listening for that event; it looks
   up a registered overlay by id and mounts it into `#overlay-root`. A
   furniture definition can instead supply its own `onInteract`/`onExit`
   directly (see `FurnitureSystem.init`'s handling of `cfg.onInteract`) to
   bypass `OverlayManager` entirely — this is how both the computer desk and
   the workbench work: they emit their own `*:activate`/`*:deactivate`
   events instead, and their own dedicated system (not `OverlayManager`) is
   what reacts. See `docs/COMPUTER.md` and `docs/WORKBENCH.md`.
5. Exiting (Escape, or an overlay's own close button emitting
   `interaction:exitRequested`) reverses all of it: camera eases back,
   `onExit()` runs if present, `overlay:close` fires, the overlay unmounts
   (or, for the computer/workbench, their own system reverses whatever it
   was doing — powering the screen down, fading the clipboard panel out).

Notice the separation: `InteractionSystem` handles *proximity, prompts, and
camera focus*. `OverlayManager` handles *DOM and pointer-lock*. Neither
needs to know what a "notebook" or "music cabinet" is. Adding a new physical
interaction is: build geometry, attach an `InteractableComponent`, register
an overlay if it needs one. Nothing in `InteractionSystem` or
`OverlayManager` changes.

## Data flow for "everything is data-driven"

- **Room shape & furniture placement**: `src/data/layoutDefault.js`.
  `RoomLayoutSystem` and `FurnitureSystem` are just interpreters of this
  data. A future layout editor only needs to produce data in this shape.
  `FURNITURE_LAYOUT`'s own comment records the reasoning behind the
  current arrangement (the reading/listening corner grouped on the
  computer desk's side of the room, redesigned from an earlier, more
  scattered layout — see `docs/MUSIC.md` and `docs/ROADMAP.md`'s Phase 8).
  Repositioning furniture is a data-only change, but it's worth verifying
  against `FurnitureSystem._computeFootprintBox`'s actual rotated-AABB
  formula rather than eyeballing new coordinates — a footprint's world
  extent swaps which of a piece's width/depth dominates depending on its
  rotation, which is easy to get backwards by intuition alone.
- **Furniture appearance & behaviour**: `src/entities/furniture/*.js`, each
  exporting a `{ id, label, footprint, build(), interaction }` definition,
  collected in `registry.js`. `registerFurniture()` lets a plugin add a new
  piece without editing the registry file.
- **Projects, notes**: plain stores (`ProjectsStore`, `NotesStore`) with
  their own `save()`/`load()`, registered with `PersistenceSystem` as
  *providers* (see below) rather than being Engine systems themselves —
  they have no scene/camera concerns.
- **User-authored objects**: `src/worldbuilder/` takes this idea one level
  further than furniture — instead of a developer writing a definition
  file, the person using the workshop authors one at runtime in the
  computer's Builder app, and `WorldObjectsSystem` interprets it exactly
  the way `FurnitureSystem` interprets `layoutDefault.js`. See
  docs/WORLDBUILDER.md.

## Persistence

`PersistenceSystem` (`src/systems/PersistenceSystem.js`) is the only thing
that reads/writes `localStorage`. Two ways state gets included in a save:

- **Event-based** (most core systems): a system listens for
  `persistence:save` and writes onto the shared `bag` object it's handed;
  listens for `persistence:load` and reads its own key back out of the bag
  it's handed. This is how `RoomLayoutSystem`, `LightingSystem`,
  `TimeOfDaySystem`, `EnvironmentSystem`, `AudioSystem`, `CameraSystem`,
  `ComputerSystem`, `WorkbenchSystem`, and `FurnitureSystem` all persist
  state, with zero coupling to `PersistenceSystem` beyond those two event
  names. `WorkbenchSystem` persists only `{ currentProjectId }` this way —
  a project's own `kind`/`presence`/`notes` ride along for free inside the
  `projects` provider below, since they're just fields on the same project
  object the pinboard and computer already save. `FurnitureSystem`
  persists only its small `overrides` map (`{ pieceId: {position,
  rotationY} }`, written only for a piece a player has actually moved in
  Build Mode — see docs/WORLDBUILDER.md) — never a blanket save of every
  piece's transform, which an earlier version of this system did and
  which was a real bug: it treated a Workshop default (meant to improve
  freely as the Workshop itself is updated) as if it were player-owned
  data. See docs/REFINEMENT.md for the full account.
- **Explicit providers**: `persistenceSystem.registerProvider(key, storeInstance)`
  for plain stores that aren't Engine systems (`ProjectsStore`, `NotesStore`,
  `ObjectLibraryStore`, `WorldObjectsStore`, `MusicLibraryStore`,
  `PlaylistStore`, `SettingsStore`, `PlayerAppearanceStore`, `OutfitStore`,
  and `engine.plugins` itself, so every registered plugin's own
  `save()`/`load()` runs too). `MusicSystem` itself, being a real Engine
  system, saves/loads its own playback session (queue, position, volume)
  the ordinary system way — see docs/MUSIC.md. `TextureStore` (player
  textures) is the one exception, living entirely in IndexedDB — the same
  deliberate split `HandleStore` established for the music library's real
  file handles, see docs/PLAYER.md.

The save envelope (`{ version, savedAt, systems: {...}, providers: {...} }`)
is written to `localStorage` on an autosave interval, on tab-hide, and on
`beforeunload` — and can be exported/imported as a plain JSON file from the
HUD's backup buttons, which is the same envelope shape, just written to disk
instead of `localStorage`. That symmetry means "cloud sync" later is a
matter of sending/receiving this same envelope somewhere else, not a new
save format.

**Versioning and migration** (`src/systems/SaveMigrations.js`): every
envelope's `version` field is checked against `CURRENT_SAVE_VERSION` on
load, and walked forward one migration at a time until it's caught up —
see docs/REFINEMENT.md for the full reasoning and the first real migration
this introduced. A version only needs a migration entry if it changes what
existing data *means*; a version that only adds a new field or provider
doesn't need one, since every store already treats a missing field as "not
set yet" the same way it does on a genuinely first-ever launch.

## Placeholder-first assets

Nothing in this phase was downloaded, painted, or recorded:

- **Geometry** — primitives (`THREE.BoxGeometry`, `CylinderGeometry`)
  assembled in `src/entities/furniture/*.js`, all going through
  `PlaceholderFactory.js` for materials so the whole room shares one visual
  language and can be re-skinned by editing one file.
- **Textures** — generated on an off-screen `<canvas>` at runtime
  (`ProceduralTexture.js`): wood grain, paper fibre, concrete speckle, brushed
  metal, rain streaks. Zero image files, zero network dependency.
- **Audio** — generated with the Web Audio API (`AudioSynth.js`): a small
  set of ambient pads for the `audioSource` world-object behaviour, and
  filtered white noise for weather. The workshop's real music — a proper
  personal library reading actual audio files from disk — arrived later as
  an entirely separate system (`src/music/`, see `docs/MUSIC.md`) rather
  than by swapping files into this one; `AudioSynth.js` remains exactly
  what it always was, a source of simple placeholder ambience, not a stand-in
  for real recorded music.

See `assets/README.md` for the plan for when real assets do arrive.

## Known simplifications (by design, for this phase)

- **Furniture collision uses one axis-aligned bounding box per piece**, not
  a tight oriented box or the actual mesh. This is intentionally the
  simplest thing that stops you walking through the desk — see
  `FurnitureSystem._computeFootprintBox`'s comment.
- **Interaction checks are proximity-only**, with no line-of-sight or
  occlusion test — see "Known simplifications" in `docs/WORLD.md` for why
  this became more noticeable once interaction radii grew and a real
  exterior existed.

The computer, the workbench, and the world/exterior each have their own
documented simplifications — see "Known simplifications" in
`docs/COMPUTER.md`, `docs/WORKBENCH.md`, and `docs/WORLD.md` respectively,
rather than duplicating them here. (Two simplifications that used to be
listed here — windows/the door being visually inset rather than real
openings, and the door not leading anywhere — were fixed in the pass
documented by `docs/WORLD.md`; they're intentionally not repeated as
*current* limitations.)
