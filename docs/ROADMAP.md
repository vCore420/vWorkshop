# Roadmap

This is a living document. It reflects what's actually been delivered, and
a reasonable next sequence — not a promise or a deadline.

## Phase 1 — the foundation

**Goal:** an excellent architecture, a believable single room, and enough
working end-to-end features that the interaction pipeline, persistence, and
plugin system all prove themselves — not a feature-complete workshop.

Delivered:
- Engine/system/entity architecture (see `docs/ARCHITECTURE.md`)
- One room: workbench, computer desk, shelving, tool storage, pinboard,
  sitting area, stereo, two windows, a workshop door — all placeholder
  geometry, all either functional or honestly labelled as reserved
- Full interaction pipeline: proximity prompts, focus-mode camera easing,
  diegetic overlays, no traditional menu anywhere
- Working features: full project planning (pinboard), a physical notebook,
  generative music player, a physical light switch and door, weather
  selection + light dampening through a window, time-of-day lighting that
  follows the real clock
- Full persistence: positions, lighting, time mode, weather, music state,
  notes, and projects all survive a reload, plus manual JSON export/import
- A documented plugin system with one working example (ambient dust motes)

## Phase 2 — the computer becomes the heart of the workshop

**Goal:** turn one object — the computer — into a real, self-contained
creative workstation, and make the transition into and out of it feel
physical rather than like opening an app. See `docs/COMPUTER.md` for the
full write-up.

Delivered:
- A real sit-down/stand-up transition: camera eases into a seated pose,
  the monitor powers on continuously with it, the room softly dims/blurs
  behind a monitor-anchored panel instead of being replaced by one
- The workstation panel is positioned every frame to match the monitor's
  actual projected screen position (`ScreenProjector.js`) — never a
  full-viewport overlay
- Six app slots (Projects, Journal, Browser, AI, Media, Settings), each
  either genuinely working (Projects and Journal reuse existing stores;
  Media reflects the stereo; Settings replaces the old preferences) or an
  honest, clearly-labelled placeholder (Browser, AI)
- The computer owns its own atmosphere: a screen light and a desk lamp,
  independent of the room's general-purpose lighting
- "Waking from sleep": which app was open persists, and every app's own
  content was already persisted independently — there's no reset-to-default
  on reload
- The computer is now provably one self-contained object: `src/computer/`
  talks to the rest of the workshop through exactly two events
  (`computer:activate` / `computer:deactivate`) and reads furniture geometry
  that `ComputerDesk.js` exposes on purpose for it to use

Explicitly *not* attempted yet, on purpose: a real browser, a real AI
companion, real recorded media, or a perspective-correct (as opposed to
axis-aligned) screen projection — see "Known simplifications" in
`docs/COMPUTER.md`.

## Phase 3 — the workbench becomes the creative heart

**Goal:** make one object tell the story of whatever's currently being
made, readable at a glance from across the room, without opening anything —
and build the architecture so any future project can describe its own
physical presence without the workbench itself changing. See
`docs/WORKBENCH.md` for the full write-up.

Delivered:
- A modular **Project Presence system**: projects carry `kind` and
  `presence` metadata (`ProjectsStore.js`); a registry
  (`src/workbench/presence/registry.js`) maps presence item types to
  placeholder-geometry builders; a small slot system
  (`src/workbench/slots.js`) lays resolved items out on the bench surface.
  Nine presence types exist today and a tenth requires no change to the
  workbench itself — just a new builder file and one registry line.
- Four starter `kind` templates (woodworking, electronics, writing,
  software) plus a sparse general fallback, each producing a visibly
  different bench without any of it being a hardcoded scene.
- A believable "lean in" transition, not a launch: the camera eases closer
  and lower over the bench, and a small panel fades in anchored to a
  clipboard prop's real projected position, not a full-screen takeover.
- Switching, finishing, or starting a project scales presence items away
  and grows new ones in, rather than swapping geometry instantly.
- Finishing a project reuses phase 1's existing archive overlay as its
  "history", rather than building a new archival visual.
- Full persistence: `{ currentProjectId }` plus whichever project's own
  `kind`/`presence`/`notes` was already durable data.

Explicitly *not* attempted yet, on purpose: moving furniture, a real
bin-packing layout, and any visual "the finished piece physically travels
to the shelf" animation — see "Known simplifications" in `docs/WORKBENCH.md`.

## Phase 4 — the world creation system

**Goal:** the workshop's first genuinely *generic* system — a way to design
new objects and physically place them in the room, built so a future room,
building, or landscape can reuse the exact same architecture without
changes. See `docs/WORLDBUILDER.md` for the full write-up.

Delivered:
- **The Builder**, a new computer app: assemble unit-sized primitives
  (box/cylinder/sphere/cone/plane) into parts with position/rotation/
  scale/colour, with a live orbit-draggable preview rendered in an isolated
  mini Three.js scene; author name/description/category/tags/defaults; and
  attach behaviour, purely through properties, never code.
- A **behaviour registry** with nine built-ins (Interactable, Light Source,
  Seat, Storage, Door, Computer, Decoration, Trigger, Audio Source), each
  just a property schema plus an `apply()` that — almost always — attaches
  an ordinary `InteractableComponent`, flowing through the exact same
  `InteractionSystem` every hand-built piece of furniture already uses,
  unmodified. A tenth behaviour is one file and one registration call.
- A persistent, shared **object library** (`ObjectLibraryStore`) — objects
  are designed once and referenced by every placed copy, so editing a
  design updates every instance of it already in the room.
- **Build Mode**: press B (or a HUD button) anywhere in the room to freeze
  the camera exactly where you're standing, free the cursor, and
  click-select/place/move/duplicate/delete objects via real raycasts
  against the actual room geometry — two small HUD-docked strips, never a
  full-screen editor.
- Placed instances (`WorldObjectsStore`) are room-scoped from day one
  (`roomId`) even though there's only one room today, specifically so
  "additional rooms" later needs no schema change.

Explicitly *not* attempted yet, on purpose: true profile-based extrusion,
collision between placed objects (or with the player outside Build Mode),
look-around/movement while in Build Mode, and multiple rooms themselves —
see "Known simplifications" in `docs/WORLDBUILDER.md`.

## Phase 5 — the workshop becomes the first building in a world

**Goal:** fix the doorway (a real bug, not cosmetic), and turn "one sealed
room" into "the first building in a continuous, walkable world" — with no
teleport, load, or scene change of any kind. See `docs/WORLD.md` for the
full write-up.

Delivered:
- **The doorway fix**: the north/south walls were each a single solid box
  with no real opening — the door/windows were only ever decorative
  overlays in front of it. Walls are now built from real segments with
  genuine gaps, and collision is derived from those same segments (a
  header above head height is automatically excluded, the same rule
  everywhere, not a per-wall special case).
- **A seamless outdoor world**: one effectively-infinite, self-recentring
  ground plane, plus a real sky/fog driven by the same `timeofday:changed`
  event lighting already used — replacing the old trick of tinting the
  window panes to fake a sky that wasn't really there.
- **A simple exterior shell**: two-sided walls (different material facing
  in vs out), a flat roof with an overhang, built from the exact same
  wall-segment geometry as the interior, so openings are guaranteed to
  line up. Existing furniture didn't need to move — the wall grew outward
  only, keeping its interior face exactly where phase 1–3 left it.
- **The Construction Library**: 16 permanent foundational pieces (Wall,
  Floor, Roof, Door, Window, Stairs, ...), structurally separate from the
  person's own object library but built from the identical
  `WorkshopObjectDefinition` shape — "a different source, not a different
  kind of thing." The Door piece reuses the same `door` behaviour any
  custom object can have.
- **Build Mode works outdoors** — placement raycasts against the interior
  floor and the outdoor ground plane in the same call, with no branch
  anywhere asking "am I inside or outside".
- **Every interaction distance individually retuned** (small ~2.0m, medium
  ~2.2m, large ~2.4m), each re-verified against its own collision footprint
  rather than assuming one blanket value would work everywhere.

Explicitly *not* attempted yet, on purpose: line-of-sight/occlusion checks
for interactions, a pitched (vs flat) roof, real falling-rain particles
outdoors, and more than one building — see "Known simplifications" in
`docs/WORLD.md`.

## Phase 6 — polish, touch, and installability

**Goal:** no new systems — make the five that already existed solid enough
for daily use, on a tablet as readily as a desktop, and installable like a
native app. See `docs/POLISH.md` for the full write-up, including a
transparent account of every bug found along the way.

Delivered:
- **Touch support** throughout: a virtual joystick and drag-to-look (both
  in `InputManager`, invisible on desktop), a tappable interact prompt,
  and confirmation that Build Mode's click-based placement/selection and
  the Builder's already-`PointerEvent`-based preview both just worked.
- **A real, previously-invisible touch bug fixed**: the computer's and the
  workbench's "stand up" hints were plain text, not buttons — Escape was
  the *only* way to leave either of them, which is a dead end with no
  physical keyboard. Both are real buttons now.
- **Installable as a PWA** — `manifest.json`, a generated icon set in the
  workshop's own palette, and a service worker giving genuine offline
  support after the first visit (honestly documented limit: not on a
  completely first-ever offline load, since Three.js loads from a CDN).
- **Two real bugs fixed, not just hidden**: door/window frames that were
  solid slabs slightly larger than their openings (visually plugging a
  wall opening that was otherwise genuinely real), and focus-mode camera
  yaw interpolation that could spin most of the way around a turn instead
  of taking the short path, because nothing ever wrapped accumulated yaw
  back into a small range.
- **A code health audit** — one piece of confirmed dead code removed
  (`CameraSystem.exitFocus()` was writing to a field nothing ever reads), a
  sensitivity constant renamed now that it governs two input modalities,
  and a full unused-import/duplicate-CSS sweep that came back clean.

## Phase 7 — a real music library

**Goal:** replace the stereo's generative placeholder with a genuine
personal music library — scanning real folders, real playback, playlists,
favourites, search — built as a reusable system any object can open, not
code tied to the stereo. See `docs/MUSIC.md` for the full write-up.

Delivered:
- **Real folder scanning** via the File System Access API — `Artist/Album/
  song.mp3` with an optional `cover.png`, recursively discovered, with
  deterministic path-shaped ids that make rescanning idempotent and keep
  favourites/play-counts/playlists stable across a rescan.
- **A permanent playback engine** (`MusicSystem`), independent of any UI —
  closing the music panel never pauses anything, and playback continues
  walking around the room or out into the world, exactly like the brief
  asked for.
- **Full player**: play/pause/stop/previous/next/seek/volume/mute/repeat/
  shuffle/queue, plus Artists/Albums/Songs/Recently Added/Recently Played/
  Most Played/Favourites/Playlists browsing and live search.
- **Reusable, not stereo-specific**: the stereo's interaction is just
  `overlayId: "music"` — the same generic mechanism every piece of
  furniture already uses. A new `musicPlayer` behaviour gives any future
  Builder-designed object the identical capability with zero new code.
- **A real fix found while wiring this up**: the Builder's "these
  behaviours are mutually exclusive" rule used to be a hardcoded list that
  every new interactable-owning behaviour needed remembering to update —
  including a future plugin's own. It's derived from the registry now,
  automatically.
- **A calm interface** reusing the workshop's own overlay material system
  (warm paper, dark wood, brass) rather than resembling a desktop media
  player, sized roomier than a pinboard specifically because browsing a
  real library needs the space.

Explicitly *not* attempted yet, on purpose: ID3/embedded metadata (titles
and art still come from the folder structure itself), and library scanning
on non-Chromium browsers — see "Known limitations" in `docs/MUSIC.md`.

## Phase 8 — the reading and listening corner

**Goal:** not a systems pass — an interior-design pass. Give the music
system a proper physical home instead of a placeholder stereo, and turn
the surrounding furniture into one deliberate corner rather than several
separate objects. See `docs/ARCHITECTURE.md`'s furniture layout notes for
the full reasoning (this pass was about arrangement and geometry, not new
architecture, so it doesn't have its own dedicated doc).

Delivered:
- **The music cabinet** replaces the placeholder stereo: a low wooden
  cabinet with a turntable and amplifier on top, records stored in an open
  shelf below, and a pair of bookshelf speakers on simple stands either
  side — leaning into vinyl rather than a modern media centre, on purpose.
  Its interaction (`overlayId: "music"`, radius, prompt text) is the only
  part that changed; the real library it opens (`docs/MUSIC.md`) wasn't
  touched at all, which is exactly what "the furniture is just the
  physical object through which the system is accessed" means in practice.
- **The whole quiet corner relocated** to the computer desk's side of the
  room, reordered top-to-bottom as the brief asked: computer desk,
  reference bookshelf, reading chair, music cabinet — grouped closely
  enough to read as one corner rather than spread the length of the wall.
- **Every new position checked against the real footprint math**
  (`FurnitureSystem._computeFootprintBox`'s actual rotated-AABB formula,
  not eyeballed) to confirm no two pieces overlap and each stays
  comfortably reachable at its interaction radius — the same verification
  standard the Phase 5 interaction-distance pass used.

## Phase 9 — performance, responsiveness, and configuration

**Goal:** an engineering pass, not a feature pass — make the existing
workshop feel smoother across desktop and tablet, and give a person a real
Settings app instead of hidden defaults, without reducing visual quality or
removing anything. See `docs/PERFORMANCE.md` for the full write-up.

Delivered:
- **A real performance audit**, not guesswork: the proximity-scan system
  was redoing a full-room, allocation-heavy scan 60 times a second
  (fixed with a cached, invalidation-aware entity query plus throttling
  to ~12.5Hz); the walk loop was allocating fresh vectors every frame
  (fixed with reusable scratch objects); three systems were repeating an
  `Engine.getSystem()` linear search every frame for a dependency that
  never changes (fixed by resolving once); the World Creation system's
  unit-primitive geometry was never actually shared across placed
  instances the way materials already were (fixed); and a settings slider
  drag would have triggered dozens of full synchronous saves per second
  without a debounce that didn't exist yet (fixed).
- **A genuine bug found along the way**: `FurnitureSystem`'s
  `persistence:load` path updated a piece's visual transform without
  recomputing its collision footprint to match — unreachable today (nothing
  moves furniture yet) but exactly the bug a future "drag furniture"
  feature would have hit immediately.
- **A full Settings app** (inside the computer, alongside the existing
  General tab, not a separate object): Graphics (render distance, shadow
  quality, lighting quality, anti-aliasing, frame rate limit), Performance
  (presets, "Optimise For This Device", plain-language performance
  feedback), Display (field of view, UI scale), Controls (mouse/touch
  sensitivity, invert look), and Audio (master/music/effects/ambient
  volume, layered on top of each system's own existing volume rather than
  replacing it).
- **Everything persists** through the exact same `PersistenceSystem`
  path every other store already uses.

Explicitly *not* attempted yet, on purpose: a real performance benchmark
(the device-optimisation button is an honest heuristic, not a benchmark),
and a discrete sound-effects channel for Effects Volume to actually
control — see "Known limitations" in `docs/PERFORMANCE.md`.

## Phase 10 — the player becomes an identity

**Goal:** not a character creator — "a system that allows somebody to
gradually become whoever they want to be." A modular, procedural player
character (clean primitive geometry, Minecraft-ish, deliberately not
realistic) and a Wardrobe app to edit it: proportions per body section,
colour/material/texture per section, and named outfits that persist
between sessions. See `docs/PLAYER.md` for the full write-up.

Delivered:
- **A real jointed rig** — eight body sections (Head, Torso, Upper/Lower
  Arm, Hand, Upper/Lower Leg, Foot), each a unit-sized box scaled by its
  own width/height/depth, connected through genuine parent-child pivots
  (shoulder → elbow → wrist, hip → knee → ankle) rather than independently
  positioned meshes — built specifically so a future animation system can
  rotate joints that already exist, not rewrite the rig.
- **The Wardrobe app**, on the computer alongside every other app: live
  editing (every change applies immediately, the same in-place philosophy
  the rest of the workshop already uses), colour/material/texture per
  part, and a paint-directly-or-import-an-image texture tool, both ending
  up as the same small saved canvas.
- **Outfits**: save/rename/duplicate/delete/wear, each a full snapshot of
  proportions + appearance, on top of a live "currently worn" appearance
  that's always what's actually persisted and rendered.
- **A real IndexedDB split for texture images**, the same reasoning
  `HandleStore` already established for the music library's file handles
  — real image data doesn't belong in a JSON blob bound for
  `localStorage`'s quota. Textures are only actually deleted once nothing
  live or saved still references them.
- **A design course-correction worth recording**: the brief's "camera
  should smoothly transition to face the character" was first built as a
  literal main-camera retarget, and ran into a real conflict with how the
  computer's screen-projected panel positions itself every frame. Reused
  the Builder app's existing isolated preview-scene pattern instead — see
  docs/PLAYER.md's own account of why.

Explicitly *not* attempted yet, on purpose: independent left/right limb
editing (arms and legs are symmetric), and anything involving clothing,
accessories, mirrors, or animation — see "Architecture: ready for what
comes next" in `docs/PLAYER.md` for how the rig was specifically built to
support all of them later without a rewrite.

## Phase 11 — Workshop Refinement

**Goal:** a maintenance pass, not a feature pass — "will this make the
Workshop easier to live in and easier to continue developing over the
next several years?" See `docs/REFINEMENT.md` for the full write-up.

Delivered:
- **Two real bugs, properly root-caused rather than patched around.**
  Movement occasionally locking up or continuing past a key release
  traced to the well-known "held key never releases if the window loses
  focus" class of bug (`keyup` only ever reaches a focused document), plus
  a related bug where two keys mapped to the same action (`KeyW`/
  `ArrowUp`) could cancel each other. Chrome's "too many WebMediaPlayers"
  error traced to duration resolution creating one temporary `Audio()`
  element per song shown in a list, unbounded — fixed with a small,
  reusable, properly-released pool instead.
- **A genuine save-versioning and migration framework**
  (`src/systems/SaveMigrations.js`), replacing a single hard-coded version
  number with a real registry future updates can keep adding to. Its first
  real migration fixes the actual reported bug: furniture position was
  being saved and blindly restored as if it were player data, meaning a
  genuine Workshop layout improvement never reached an existing save.
  Furniture placement is a Workshop default now, not something that
  round-trips through the save file at all.
- **A Danger Zone tab in Settings** — Clear Workshop Cache, Reset Workshop
  Settings, Reset Player Data, and Factory Reset Workshop, each behind a
  clear confirmation (Factory Reset asks twice) — the long-term
  maintenance home the brief asked for, built as four functions calling
  existing store methods rather than a new system of its own.
- **Real outward-opening French doors**, replacing the placeholder slab
  that used to slide straight up; the light switch moved to the correct
  side of them; the reading chair rotated to face the corner it's meant to
  be part of; the door/windows/notebook's interaction radius tightened
  further than the standard tiers; the ambient lighting floor raised so
  corners away from a direct light source read as dim rather than
  near-black, without touching how much brighter a lamp or a sunlit window
  reads by comparison.

## Phase 12 — the Builder Phone

**Goal:** "I'll just move that chair" rather than "I'll open the editor" —
not new Builder functionality, a redesign of how building *feels*. See
`docs/WORLDBUILDER.md` for the full write-up.

Delivered:
- **The Builder Phone** replaces the old two-strip floating UI entirely —
  a single device that slides up from the lower-right corner when Build
  Mode opens and back down when it closes, with the room visible and
  rendering behind it the whole time. Three screens (Library, Ghost,
  Selection) share one shell rather than being three separate panels.
- **One placement mechanic, not two** — placing something new from the
  library and moving something that already exists produce the exact same
  transparent, pointer-following, rotatable "ghost" (`GhostPreview.js`),
  confirmed or cancelled through the exact same two functions either way.
- **Workshop furniture is genuinely movable now**, through that identical
  mechanic — the seam the previous pass's `FurnitureSystem` comment
  specifically left waiting for. A small, explicit `overrides` map keeps
  a moved piece's new position as real player data while every
  un-moved piece keeps tracking the Workshop's own current default, so a
  future Workshop layout change still reaches everything nobody has
  personally repositioned.
- **Collision for Builder-placed objects** — `WorldObjectsSystem` now
  computes and caches a real collision footprint per instance
  (`THREE.Box3.setFromObject()`, since a Builder object can be any shape
  at all), feeding into `CameraSystem`'s existing walk-collision loop
  alongside walls and furniture. A wall built from Construction Library
  pieces is now real architecture, not decoration you can walk through.

Explicitly *not* attempted yet, on purpose: multi-select, snapping, and
undo/redo — see "Future extension points" in `docs/WORLDBUILDER.md` for
why the current architecture is already shaped to support each of them
without a rewrite.

## Phase 13 — the Builder workspace and shape library

**Goal:** refine the existing Builder workflow rather than redesign it —
an even split (large live preview, all editing controls), a curated
expansion of both the primitive shape set and the Construction Library,
and a real bug fix (the French doors from Phase 11 had stopped opening
entirely). See `docs/WORLDBUILDER.md` for the full write-up.

Delivered:
- **An even split workspace** for the computer's Builder app — a large,
  always-visible live preview on one side, every editing control on the
  other, using its own layout classes so widening it couldn't narrow the
  Wardrobe app's own (unrelated) preview as a side effect.
- **Orbit and zoom** for the shared `PreviewRenderer` (scroll-to-zoom,
  bounded to a sensible range) — the Wardrobe's own character preview
  gained this for free, from the same file.
- **Selecting a part now highlights it directly in the 3D preview**, not
  just in the parts list — a cloned, emissive-tinted material, never a
  direct mutation of the shared, cached material other objects of that
  colour also use.
- **Eight new preset shapes** (Pyramid, Wedge/Ramp, Rounded Cube, Half
  Sphere, Quarter Cylinder, Pipe/Tube, Ring, Arch) on top of the original
  five, all built from base Three.js parametric geometry — no custom
  vertex authoring, no external geometry library. A few suggested shapes
  (Capsule, Rounded Cylinder, Corner Piece, Bevel Piece) were deliberately
  left out as redundant or infeasible without additions this project
  doesn't load — see "Preset shapes" in `docs/WORLDBUILDER.md`.
- **The Construction Library grew from 16 to 30 pieces**, organised into
  Structural / Openings / Workshop / Utilities. Cabinet and Storage Crate
  carry the Storage behaviour out of the box; Light carries Light Source;
  Switch carries Trigger, ready to be wired to anything a future system
  listens for.
- **A real bug fixed, root cause and all**: the front French doors
  (Phase 11) had become completely unreachable. Their interaction anchor
  sits at ground level, but interaction distance is measured in real 3D
  from the camera's eye height (1.65m) — a radius reduced to 1.6m in the
  same pass that redesigned the doors meant the *vertical* distance alone
  already exceeded it, from any position at all. Restored to a radius
  that correctly accounts for that fixed vertical offset.

Explicitly *not* attempted, on purpose: per-part-leaf door hinging (Double
Door still swings as one rigid unit, the same honest simplification the
original Door already made) and rendered thumbnails for the shape/library
grids (both flat colour swatches for now) — see "Future extension points"
in `docs/WORLDBUILDER.md`.

## Phase 14 — the Environment System

**Goal:** "think beyond simply adding weather effects" — not a weather
feature, an environment that makes stepping outside feel quietly
different, day to day. See `docs/WORLD.md`'s "The Environment System"
section for the full write-up.

Delivered:
- **`WeatherSystem` grew into `EnvironmentSystem`** — three states became
  ten (Clear, Partly Cloudy, Overcast, Drizzle, Light Rain, Heavy Rain,
  Fog, Mist, Windy, Storm), each with its own light dampening, fog
  density, cloud coverage, and precipitation intensity.
- **Three modes**: Manual (pick a state directly), Live Weather (real
  conditions from Open-Meteo — no API key needed, a plain HTTPS GET
  callable straight from the browser — via the browser's own
  geolocation), and Workshop Dynamic, a real weighted Markov process
  (`TRANSITIONS`) rather than a random pick, each state held for a
  randomised real-world duration before the next is even considered.
  Live Weather's every failure mode (permission denied, offline, an
  unreachable API) falls back to Workshop Dynamic gracefully, with a
  human-readable reason kept for the panel to show.
- **"Conditions should persist between visits" is genuinely true**, not
  just a saved label: Workshop Dynamic persists *when* the current state
  was entered, and replays elapsed real time forward through the
  transition graph on load (bounded to six steps) — the weather has
  actually moved on while you were away.
- **The window is now the Environment panel** — mode tabs, the current
  condition and wind, and either the weather grid (Manual) or a status/
  retry control (Live Weather), evolved from the original flat row of
  three buttons rather than replaced.
- **A real sky**: moving sprite clouds driven by actual wind direction/
  speed, sun and moon glow-sprites, a star field that fades in and out
  with dusk/dawn, and a moon phase computed from the real calendar date —
  all positioned relative to the camera (not the world origin) so nothing
  is ever clipped by a short Render Distance setting or left behind by
  building far from the origin.
- **Weather now reaches indoor lighting and outdoor atmosphere both** —
  fog density genuinely responds to Fog/Mist, not just Render Distance;
  a storm gets an occasional lightning flash (`LightingSystem`, filling in
  a seam its own code had explicitly left for this); rain visibly drifts
  with wind direction instead of only falling straight down.
- **A second, independent ambience layer** — birds by day, crickets by
  night, generated the same way the workshop's ambient music already is
  (Web Audio synthesis, no audio files), quieted (not silenced) under
  heavy precipitation, layered on top of the existing wind/rain/storm
  ambience rather than replacing it.
- **A real save-migration** (`SaveMigrations.js` v2→v3) carries a
  player's last manually-chosen weather forward as an explicit Manual
  choice on the new system, rather than discarding it or silently
  defaulting them into Workshop Dynamic.

Explicitly *not* attempted, on purpose: real falling-rain/snow particles
outdoors (the window's streak-based rain remains an honest stand-in for a
room with placeholder-style glass), a visible lightning bolt or thunder
sound (light-only for now), and any snow-specific visual (mapped onto the
closest rain-family state instead) — see "Future extension points" in
`docs/WORLD.md`.

## Phase 15 — reflections, identity, and everyday presence

**Goal:** "not about adding graphics for the sake of graphics... make the
Workshop feel more personal and lived in." See `docs/PLAYER.md`'s
"Reflections and third person" section for the full write-up.

Delivered:
- **A generic reflection capability, not a special mirror object** —
  `ReflectionSystem.registerSurface(mesh, options)` is the entire thing;
  a hand-built furniture mirror and a Builder behaviour
  (`ReflectiveBehaviour.js`) both call it directly, neither aware the
  other exists. Rendered via a second camera placed with `lookAt()` at
  the reflection of the main camera, chosen specifically over a true
  per-pixel planar reflection (which needs a projective shader and
  oblique clipping) for maintainability, at the honest cost of exactness
  from extreme viewing angles.
- **A physical Wardrobe** — an ordinary furniture piece whose overlay
  mounts the exact same `createWardrobeApp()` the computer's own Wardrobe
  tab already uses. No second wardrobe system exists; there's one, with
  two doors into it.
- **A full-height mirror as part of the same furniture piece**, the first
  real payoff of Phase 10's "should normally never see themselves except
  in mirrors" — marked via a `mirrorMesh` userData marker `ReflectionSystem`
  discovers the same way `LightingSystem` already finds the workbench's
  lamp socket.
- **A smooth first/third-person toggle** (**V**, or a HUD button) that
  needed zero changes to movement, collision, or focus-pose easing —
  `CameraSystem.viewMode` only changes how the final camera transform is
  derived from the player's own unchanged logical position, blended over
  time so switching reads as one continuous move. Third person reuses the
  player's own wall/furniture collision for its camera offset rather than
  a second collision system, and is disabled entirely while focused
  (sitting at the computer, the wardrobe, anywhere else), matching "the
  Workshop should continue being designed primarily for first-person
  gameplay."
- **A `dispose(ctx)` hook added to the behaviour registry itself** —
  needed because a reflective surface's render target is a real GPU
  resource, unlike every other behaviour's scene-graph-only children,
  which get cleaned up automatically. A small, genuinely reusable
  addition to the framework, not a one-off fix.
- **The computer's app rail is now vertically scrollable** — once there
  were enough apps (Wardrobe, Builder) to exceed a shorter screen's
  height, the extras became genuinely unreachable, clipped rather than
  just cramped. One CSS fix (`overflow-y: auto` plus the standard
  `min-height: 0` flexbox correction), everything else about the
  computer's layout untouched.

Explicitly *not* attempted, on purpose: a true per-pixel planar
reflection, reflective surfaces on anything other than a flat plane, and
any reflow of the computer's layout beyond the one scrolling fix — see
"Future extension points" in `docs/PLAYER.md` and the known
simplification in `docs/COMPUTER.md`.

## Phase 16 — Living Refinement

**Goal:** not a feature pass — "everything below has been discovered
simply by spending time using the Workshop naturally." Every item here is
a genuine bug or rough edge, found through actual use rather than
inspection, with its true root cause tracked down rather than patched
around. See docs/PLAYER.md, docs/WORLD.md, docs/COMPUTER.md, and
docs/PERFORMANCE.md for the fuller write-ups this summarises.

**The third-person camera looked away from the player.** Position was
right; orientation was backwards. The cause was a genuine, easy-to-miss
Three.js gotcha: `Object3D.lookAt()` silently swaps which point is the
"eye" and which is the "target" for anything that isn't a camera or
light — a *plain* `Object3D`, used purely as a lookAt-math scratch helper
(exactly what `CameraSystem.js` was doing), ends up with an orientation
exactly 180° from what a real camera would compute facing that same
point. Fixed by making the scratch object an actual (never rendered)
`THREE.PerspectiveCamera`, so `isCamera` is true and `lookAt()` uses the
correct convention.

**The sitting chair made the player appear to sit backwards.** A
different bug with a similar symptom: the reading chair's own focus pose
had always pointed its `lookAt` back toward the chair's own backrest
(local z=-1.2) instead of away from it (the way actually sitting down
means facing outward, into the room). Corrected the one number; the
chair's position, and the maths that turns a focus pose into a camera
orientation, were never the problem.

**The physical wardrobe couldn't be interacted with, and the notebook
stopped working independently of the workbench.** Both traced to the same
underlying issue REFINEMENT.md's own front-door fix already diagnosed
once: an interaction anchor sitting at ground level, compared against the
camera's eye height (1.65m) as a full 3D distance. The wardrobe's radius
(1.6) was already smaller than that fixed vertical distance alone,
making it unreachable from anywhere. The notebook's case was subtler and
worth understanding properly rather than just widening its radius too:
its group origin had always been at y=0 (ground level) while every part
inside it was individually offset up to y≈0.9 to actually sit on the
workbench — meaning its interaction anchor was never where the notebook
visually was at all. That's what looked like "the notebook and workbench
volumes overlap": the notebook's own check could never succeed, so the
correctly-anchored workbench was the only thing ever responding nearby.
Fixed at the root — the notebook's own group origin now sits at y=0.9,
matching where it actually is, with its parts repositioned relative to
that corrected origin rather than just enlarging its radius to paper over
a wrongly-placed anchor.

**Mirror reflections rendered but were almost unreadably dark.** Two
genuine, well-documented Three.js colour-management gotchas, investigated
rather than just brightened: a render target's texture needs its
`colorSpace` set explicitly to `SRGBColorSpace`, or sampling it as a
material `map` applies an extra, unwanted darkening decode on data that's
already correctly encoded; and the offscreen render already has this
renderer's own tone mapping baked into its pixels, so displaying that
texture through a normally tone-mapped material doubles it, darkening the
result again. Fixed both — the mirror's own material now also sets
`toneMapped = false`, since its "colour" is already a fully rendered
image, not a raw albedo waiting to be tone-mapped for the first time.

**"Occasional choppiness"** turned out to have a genuine, findable cause
once actually investigated rather than guessed at: being merely *near* a
mirror paid the full cost of rendering the entire scene a second time,
every other frame, regardless of whether the player was actually looking
anywhere near it. A plain dot-product check against the camera's own
forward direction (deliberately simpler than a full six-plane frustum
test, easier to reason about, and only needing to be roughly right) now
skips that render whenever the mirror is behind the camera or well
outside its field of view. A small desk fan was added to the workbench
specifically as an ongoing diagnostic, not decoration — a real stutter or
dropped frame shows up immediately as a stumble in its otherwise
perfectly steady spin, in a way camera movement alone can't distinguish
from choppy input handling.

**The Environment System's weather conditions felt too similar to each
other.** Three genuine gaps, not one: rain had no visible presence beyond
a subtle streak on window glass (fixed with real falling rain particles —
camera-relative, correctly occluded indoors by ordinary depth testing,
so they don't need to know whether the player is inside or out); most
conditions only ever varied fog density and cloud coverage numerically
without a distinct look (fixed with a per-weather sky tint, blended on
top of the existing time-of-day colour — fog reads flat and grey, mist
reads light and cool, storm reads dark and cold, where they used to all
just be "the same grey sky, a bit hazier"); and every fix above (rain,
tint) automatically extends to storm too, rather than needing its own
special case, since both are driven by the same `precipitation`/weather
id values storm already had.

**Smaller fixes**, all found while working through the above:
- **Visible scrollbars removed** from the computer's own app rail and
  every app's content area — scrolling itself is completely unchanged
  (wheel, touchpad, and touch all still work exactly as before); only the
  visible track is hidden, via the standard cross-browser technique
  (`scrollbar-width: none` for Firefox, `::-webkit-scrollbar { display:
  none }` for Chrome/Safari/Edge).
- **The light switch moved to the other side of the front doors** — a
  doorway genuinely splits a wall into two separate segments either side
  of it, which is what "the opposite wall" meant here — and nudged
  fractionally closer to the actual wall surface.
- **The wardrobe and its mirror moved closer to the wall** — the whole
  ensemble shifted toward it, with the mirror specifically nudged further
  still, since its frame is far thinner than the cabinet's own depth and
  a small offset barely moved its actual back face.

## Phase 16.5 — Mirror Refinement

**Goal:** "not a feature pass... a refinement pass focused entirely on
making mirrors feel more natural while improving performance." See
docs/PLAYER.md's "Reflections and third person" section for the full
write-up, and docs/PERFORMANCE.md for the performance half.

**What was discovered:** walking toward a mirror made its reflected
viewpoint appear to retreat, and close enough, areas outside the Workshop
became visible through it — "the mirror camera currently appears to
follow or respond to the player's camera," exactly as reported.

**Why it happened:** the original implementation positioned the mirror's
virtual camera at the reflection of the main camera's position and
orientation, recomputed every frame from wherever the player currently
was — genuinely closer to a physically correct reflection, but nothing
bounded the resulting camera's frustum to the mirror's own actual size or
to the room it sits in. As the player approached, the virtual camera
approached from the opposite side at the same rate, and its wide-open
frustum could sweep past whatever was nearby, including straight through
the Workshop's own walls.

**Why the new approach is an improvement — architecturally, not just
behaviourally:** the mirror's camera position and orientation are now
derived once from the mirror's *own* geometry — sitting just in front of
its own surface (deliberately not behind the glass, which would need real
depth a wall-mounted mirror often doesn't have) and never moving on their
own, rather than being re-derived from the player every single frame.
This is both the fix for the reported behaviour (walking closer now
simply makes the reflection occupy more of a camera that isn't moving,
and the view can never sweep past its own fixed framing) and a genuine
simplification: no per-frame camera-reflection trigonometry at all,
replaced by a cheap "has the mirror's own mesh moved" check that only
recomputes anything when a Builder-placed mirror actually gets
repositioned. "The Workshop should always favour believable over
physically perfect" was the deciding factor in choosing this over a more
exact (and more expensive, and apparently more prone to exactly this bug)
alternative.

**Performance was investigated, not guessed at.** The unavoidable cost —
rendering the entire scene a second time — is inherent to any real-time
render-to-texture mirror and didn't go away. What did: shadow-map
rendering (a genuinely expensive, separate pass per shadow-casting light)
is now skipped for the mirror's own render specifically, likely the
largest single saving; the update interval loosened slightly now that a
fixed viewpoint doesn't need to track anything in real time; and the
render resolution trimmed slightly, since a mirror is seen from a few
metres away, not pixel-peeped. Distance culling and the view-direction
check from the previous pass carried over unchanged.

**Future compatibility**: nothing about this required any mirror to
become a special case. `registerSurface(mesh, options)` is unchanged as a
contract; a future Builder-placed mirror gets the identical fixed-
viewpoint treatment, the identical move-tracking, and the identical
performance characteristics as the physical wardrobe mirror, automatically.

## Phase 17 — Movement & Expression

**Goal:** "truly bring the player to life... think of this less as
building a game animation editor, and more as creating another creative
application inside the Workshop." See docs/PLAYER.md's "Movement &
Expression" section for the full write-up.

Delivered:
- **A real movement system** — running, crouching, and jumping joined
  walking, all still one continuous state machine inside `CameraSystem`
  rather than a second movement system. Real vertical movement: gravity,
  a jump arc, and a simple heightmap-style ground query that lets the
  player stand on top of (and land on) Builder-created structures —
  `WorldObjectsSystem`'s own real per-object footprints specifically, not
  furniture's fixed collision column.
- **Climbable ladders, through the Builder behaviour system** —
  `LadderSystem.registerLadder()` is the entire capability, called
  directly by both `LadderBehaviour.js` (Builder objects) and any future
  hand-built ladder, neither aware the other exists — the same
  "reflective"/`ReflectionSystem` split established for mirrors.
- **A second, independently-customisable body model** — `BodyModels.js`
  defines Masculine and Feminine, sharing the exact same pivot structure
  (what makes animations work identically across both), with
  `PlayerAppearanceStore` keeping each model's own appearance separately
  so switching between them restores rather than overwrites.
- **A complete keyframe Animation System** — `PlayerAnimationSystem`
  owns the entire mapping from a plain movement-state string
  (`CameraSystem`'s only contribution) to which clip actually plays, how
  it blends between frames, and whether an explicitly-requested emote is
  currently overriding movement-driven playback.
- **The Animation Editor**, a new computer app matching the Builder's own
  split-workspace design: a live, isolated preview always visible on one
  side, frame-by-frame editing (add/duplicate/delete/reorder frames,
  per-joint rotation sliders, play/pause/loop preview) on the other. Works
  on a local draft, saved back to the library on every change rather than
  live-editing whatever the player's own character might currently be
  playing.
- **A shared Animation Library** — default animations (`AnimationClips.js`,
  the same permanent "alphabet" role `ConstructionLibrary.js` plays for
  the Builder), player-created ones, and imported ones, all resolved
  identically through one `getClip(id)`.
- **Import/Export** — a simple, self-describing JSON format
  (`{format, version, clip}`), reusing the exact same
  `StorageUtils.downloadJSON`/`uploadJSON` every other export in the
  Workshop already uses.
- **The Emote Wheel** — lightweight on purpose: lists every non-movement
  clip, plays whichever one is picked, closes itself immediately. "The
  Emote Wheel should simply play animation assets" is true by
  construction; this file has never seen a pose or a pivot name.

**A real bug, found and fixed during this pass**: ladder climbing
initially used the world-space transformed movement vector to decide
"how much forward input," which only actually correlated with pressing
forward when facing exactly north or south — at any other facing it read
as close to zero, since a sideways-facing "forward" barely moves along
world Z at all. Fixed by using the raw, camera-relative forward input
instead (`input.moveVector.y`, before the yaw transform), which is what
"pressing forward" means regardless of which way the ladder faces. The
same fix applied to the horizontal drift while climbing, which had been
arbitrarily zeroing world-space Z rather than computing a proper
strafe-only vector.

**Explicitly *not* attempted, on purpose**: touch-specific UI for
running/crouching/jumping (the existing joystick/drag-look/tap-interact
touch controls cover walking and looking exactly as before); true 3D
collision for standing surfaces (a heightmap query, not real physics);
quaternion-based animation interpolation (plain per-axis Euler lerp,
the same "believable, not physically perfect" trade the reflection
system already made) — see "Known limitations" in docs/PLAYER.md.

## Phase 18 — World Navigation & Environment

**Goal:** "help the player naturally understand where they are, what time
it is and how the world around them behaves... not simply a weather
pass." See docs/WORLD.md's Astronomy/Interior weather/Workshop Time/
Compass sections and docs/PLAYER.md's "Movement Follow-up" section for
the full write-up.

**Movement Follow-up** (completed first, before the new navigation work):
- **Touch controls now cover every new movement mechanic with exactly
  two new buttons.** Running comes from how far the joystick is pushed,
  not a separate control; ladder climbing needed nothing new at all,
  since it already reads the same forward/back joystick input ground
  movement always has. Only jump and crouch needed real buttons.
- **Three real Animation Editor bugs, found and fixed.** "this.
  _mountedDispose is not a function" (on switching tabs, and on leaving
  the computer) traced to `mount()` being declared `async` — returning a
  Promise instead of the disposer function `WorkstationPanel` expects
  synchronously, exactly the same "fire and forget an async helper
  rather than awaiting it inside mount() itself" pattern every other app
  already follows, just not followed here. The preview model
  disappearing during playback traced to `tick()`'s very first call
  passing no timestamp at all, making the first `dt` a genuine `NaN` that
  then silently poisoned every subsequent frame's pose — fixed by
  starting playback through `requestAnimationFrame` like every other
  animation loop in the project already does.
- **An "I'm Lost!" button** — a pure quality-of-life escape hatch,
  resetting every piece of position state `CameraSystem` owns, not just
  position/yaw/pitch.

**Navigation & Environment:**
- **A toggleable Compass** (**M**) — a single translating strip of
  direction labels, reading its heading from the exact same
  `directionToAzimuth()` function the sun and moon use, so the compass
  and the sky always agree about where north is.
- **Real solar-position astronomy** (`src/utils/Astronomy.js`) — a
  standard approximate formula driven by the player's own geolocation
  when available, replacing the old fixed, direction-agnostic arc. The
  moon's position is derived from the same formula, offset by its actual
  current phase, rather than always sitting opposite the sun regardless
  of phase. Stars turn slowly with the hour, approximating the real
  sky's own apparent rotation. Occasional, genuinely subtle shooting
  stars on clear, dark nights.
- **Workshop Time**, extending the existing Settings app rather than
  adding a new one — `TimeOfDaySystem.setTime()` eases toward the
  requested hour along whichever direction around the clock is shorter,
  never jumping.
- **Interior weather, fixed architecturally.** Rain particles spawn in a
  box centred on the camera; standing inside an enclosed room put some of
  them inside that same room too, genuinely co-located with the player
  rather than occluded by anything. `InteriorSystem.registerVolume()` is
  the fix — one generic function, the same shape
  `ReflectionSystem`/`LadderSystem` already established, called directly
  by the Workshop's own room and available to any future Builder-created
  building through `InteriorBehaviour.js`.

**Explicitly *not* attempted, on purpose**: a full real-star constellation
catalogue (stars turn with the hour, but aren't mapped to actual named
stars); the equation of time and longitude-within-timezone solar
correction (local clock time is treated as solar time directly); tracking
movement for Builder-created interior volumes the way ladders/mirrors
already are (a static box, reasonable for something building-sized) — see
"Known simplifications" and "Future extension points" in docs/WORLD.md.

## Phase 19 — Builder & Workshop Living

**Goal:** "make both building and living inside the Workshop feel more
natural... would these improvements quietly make [a long afternoon
inside] feel smoother and more natural?" Not feature-heavy by design —
see docs/WORLDBUILDER.md's "Object placement"/"Behaviours" sections and
docs/PLAYER.md's "Builder & Workshop Living Follow-up" section for the
full write-up of each fix.

**Builder:**
- **Placement confirms with a left-click in the world**, not a Phone
  button — the Phone's "Place" button is gone entirely.
  `BuildModeSystem._handlePointerDown()` treats a ghost-active click as
  confirmation for the left mouse button specifically, reversing an
  earlier, explicit decision (worth being honest about, not quietly
  rewriting — see docs/WORLDBUILDER.md). That decision was about touch
  ambiguity; this fix is specifically about desktop mouse ergonomics
  (moving the mouse to a button and back on every single placement), and
  leaves touch's own drag-to-position gesture untouched.
- **Display Surface**, a new behaviour: any chosen part ("partRef", a new
  propsSchema field type — a dropdown of the object's own parts) can show
  an uploaded image ("imageRef" — a dropdown of the player's own image
  library plus an inline upload button). `ImageLibraryStore.js`/
  `ImageAssetStore.js` mirror the Music Library's own index-vs-bytes
  split. Applied as an ordinary texture on the target part's own cloned
  material — a future video/canvas/slideshow display only ever needs to
  change what feeds `material.map`.
- **A real, pre-existing bug found and fixed incidentally**: the
  `propsSchema` "select" field type's callback treated the value it
  received as a label and searched for it by label match — but
  `selectField()` actually passes the raw option *value* to that
  callback. Selecting a different audio track in `AudioSourceBehaviour`
  never actually updated which track was chosen. Found while adding the
  new "partRef"/"imageRef" field types to the same function.

**Workshop Living:**
- **Player Height, fixed at the root.** `CameraSystem` treated eye
  height as a fixed 1.65m constant while the rig's own actual height
  varied with proportions — "adjusting player height... pushes the
  player into the floor" was that mismatch. Now reads the rig's real
  current eye height every frame as the target the existing crouch-
  damping already eases toward, clamped to a sensible maximum so fixing
  "too short" didn't just trade it for "camera clips through the
  ceiling" at extreme proportion settings.
- **The mirror's horizontal flip, root-caused.** The mirror's own camera
  builds its orientation with `lookAt()` (deliberately, from the earlier
  Mirror Refinement pass), which always produces a normal, unflipped
  camera basis — the raw render was "how a camera facing the player sees
  them," not "how a real mirror shows them." Fixed with a horizontal
  texture flip where the surface is registered, not by fighting the
  camera math.
- **The "intermittent beeping," root-caused rather than muted.** A
  single isolated square-wave pulse through a narrow bandpass filter,
  repeated every 0.4-0.7s at night, is close to the same synthesis as an
  electronic chirp alarm — intentional (meant to be a cricket sound) but
  not achieving its own intent. Redesigned as a short trill of quick
  sub-pulses through a softer waveform. Already configurable via the
  existing Ambient Volume setting.
- **The computer's own blur reduced** (5px → 2px) — enough to still pull
  focus toward the monitor without the room behind it feeling indistinct
  for as long as someone sits at the desk.
- **The keyboard, mouse, and monitor stand were sinking slightly into
  the desk** — `box()`/`cylinder()` geometry is centred at its own local
  origin, so the desk top's own half-thickness was never accounted for
  when positioning things "on top" of it.
- **The Quiet Corner's reminder now dismisses on click**, fading out and
  staying gone — without touching how leaving the chair itself works
  (still Escape, still entirely `CameraSystem`'s own unrelated
  mechanism).

**Touch:** the Emote Wheel gained a button in the HUD's existing
Build Mode/Third Person View row — same styling, same "just an ordinary
tappable button" mechanics, nothing new needed for touch specifically.

## Phase 20 — Digital Workspace

**Goal:** "allow the Workshop to naturally connect to the rest of the
player's digital world... not about recreating Chrome... a browser that
feels like it belongs inside the Workshop." See docs/BROWSER.md for the
full architecture write-up.

Delivered:
- **A real Browser app** — tabs, address bar, back/forward/refresh/home,
  new/close tab, all persisted between sessions (`BrowserStore.js`).
- **`PageRegistry`** — the entire "the Browser doesn't know about
  Workshop systems, systems expose pages to it" mechanism, one path ->
  provider mapping, the same registration shape
  `behaviours/registry.js`/`apps/registry.js` already established.
- **A real `workshop://` protocol** — Home, Docs, Builder, Animation,
  Projects, and Settings pages, all real, working pages rather than
  stubs. Docs pages `fetch()` and render this repository's own actual
  `README.md`/`docs/WORLDBUILDER.md`/`docs/PLAYER.md` with a new small
  markdown renderer (`SimpleMarkdown.js`) — genuinely current
  documentation, not a frozen copy. `workshop://projects` reads
  `ProjectsStore` live, on every visit.
- **One persistent iframe per tab**, reconciled against the store rather
  than torn down and rebuilt — switching tabs never loses a page's live
  state, and an unchanged URL never triggers a spurious reload.
- **`workshop://host`, explicitly a placeholder** — "the Workshop Host is
  NOT being implemented during this phase... prepare the architecture so
  it can slot in naturally later." A real, honest page describing what's
  coming, not a stub pretending to be a feature; the moment a real Host
  exists, registering its own pages with the same `PageRegistry` is the
  entire integration.

**A real, load-bearing bug caught before it shipped**: the first version
of `workshop://docs`'s own `fetch()` calls, and `PageShell.js`'s own
stylesheet link, used root-relative paths (`/README.md`, `/css/...`).
GitHub Pages project sites are commonly deployed to a subpath rather than
a domain root, and a root-relative path silently resolves to the wrong
place on exactly that common deployment shape — `index.html`'s own
stylesheet links already use relative (`./css/...`) paths for this exact
reason, which is what caught the inconsistency. Fixed to match.

**An honest limitation, documented rather than hidden**: most real
websites (GitHub included) block being embedded via `X-Frame-Options`,
enforced by the visitor's own browser based on headers the remote server
sends — nothing achievable from inside this Browser changes that, and
there's no reliable way to even detect it happening. Every tab has a
permanent "open in a new browser tab" escape hatch instead of a
sometimes-appearing error message.

## Phase 21 — AI Mission Control

**Goal:** "This is NOT the AI itself... preparing another presence that
will eventually live inside the Workshop." See docs/AI.md for the full
architecture write-up.

Delivered, six small, separated responsibilities (`src/ai/`):
- **`AIConnectionManager.js`** — a calm, ten-second polling loop against a
  configured Ollama server, folding every possible failure (network,
  CORS, timeout — indistinguishable from a browser, and deliberately
  treated identically) into one plain status, never thrown, never
  logged as an error. "Never block the Workshop. Never interrupt
  gameplay. Never spam errors" implemented literally, not just followed
  in spirit.
- **`ModelRegistry.js`** — a pure, refreshable cache, translating
  Ollama's own raw `/api/tags` shape into what the UI actually displays.
  Manual "Refresh Models" only replaces the known list on an actual
  success, leaving a working list alone through a transient failure.
- **`ResidentProfileStore.js`** — Create/Duplicate/Rename/Delete
  profiles, each the entire description of one possible future resident,
  always at least one ("Workshop Resident," matching the Status Card's
  own example), persisted between sessions.
- **`MemoryConfiguration.js`/`EmbodimentConfiguration.js`** — shape and
  defaults, not implementations. "The goal is to establish the
  architecture" — real fields with real defaults, honestly badged
  "not active yet" in the UI, not commented-out placeholders.
- **`PromptComposer.js`** — one pure function turning identity fields into
  the actual system prompt, importable identically by Mission Control's
  own Advanced section and a future real AI Resident.

**A real identity editor, not a system-prompt textbox.** Name, Purpose,
Identity, Personality, Behaviour, Conversation Style — six plain free-text
fields, ahead of the numeric Behaviour tuning both in the file and the
rendered form. "The player should feel like they are defining who this
resident is rather than editing raw prompt text" — the Advanced section
still shows the generated prompt, collapsed by default, for whoever wants
to see it.

**Connection Testing** sends one fixed prompt ("Hello.") to the selected
model and shows the real response or the real error inline — "purely for
testing, not yet the Workshop chat interface."

**A UI bug caught before it shipped**: the Memory/Embodiment section
badges were first written reusing `.workshop-page-badge`, a class that
only exists inside `browser-pages.css` — loaded by the Browser's own
`srcdoc` iframe content, not the main computer UI Mission Control actually
renders into. Caught by checking which stylesheet the class was actually
defined in before assuming it would apply; fixed with a dedicated
`.ai-future-badge` styled directly in `computer.css`.

## Phase 22 — The First Resident

**Goal:** "This is not an AI assistant. It is the Workshop's first
resident... a presence, someone (or something) that simply belongs
there." See docs/RESIDENT.md for the full architecture write-up.

Delivered, eight small, separated files (`src/resident/`):
- **A small, semi-transparent floating bubble** — real refraction
  (`MeshPhysicalMaterial` transmission, not faked transparency), an
  emissive inner glow whose colour genuinely shifts with mood, ten
  slowly-drifting sparkle particles, a small point light of its own.
  "Digital rather than magical" — no fairy-dust, no sparkle trails.
- **A subtle, canvas-drawn face** — five simple expressions (sleeping,
  content, curious, happy, thinking), redrawn only when the expression
  actually changes rather than every frame, deliberately restrained —
  "playful teeth" is two small rectangles, not a cartoon grin.
- **Movement that stays almost entirely still** — a seven-second eased
  glide between six real, furniture-anchored idle locations, chosen at
  random on a 90-240 second interval; continuous, low-frequency
  procedural bob/sway/rotation underneath so it never looks frozen even
  at rest.
- **Player awareness as one smoothed value**, not a combinatorial state
  machine — `ResidentBehaviour.awarenessBlend` eases toward the player
  within a 3.2m radius and back down as they leave it, "watching the
  player walk past" falling naturally out of that rise and fall.
- **Real conversation**, opened by walking up and interacting exactly
  like any other physical object — no new interaction mechanism needed.
  Every message reads the active Mission Control profile's model,
  temperature, context size, and system prompt fresh, never cached,
  never duplicated.
- **Honest offline behaviour** — softer glow, a sleepy expression, one
  calm sentence on interaction ("waiting for its connection"), and a
  quiet wake-up (brighter glow, resumed sparkle pace) the moment
  `AIConnectionManager` reconnects — no intrusive notification, since
  none was asked for.
- **Narrow, genuinely non-duplicating persistence** — `ResidentState.js`
  remembers only idle location and mood; identity, model, and behaviour
  tuning stay exactly where Mission Control already put them.

## Phase 23 — Workshop Host

**Goal:** "This is NOT about creating another application. This is about
creating the Workshop's bridge to the local machine." See docs/HOST.md
for the full architecture write-up.

**Browser Refinement, first.** A real, reported bug — "after navigating
to a page, the Browser often does not visually update until the player
switches to another tab and then returns" — traced to `BrowserApp.js`
reusing the same `<iframe>` element across navigations within a tab,
mutating its `src`/`srcdoc` in place. A well-known class of browser
rendering quirk: an iframe's own rendered layer isn't always reliably
invalidated when its content changes while the element itself never
moves, resizes, or toggles visibility — switching tabs only ever "fixed"
it as a side effect of forcing a genuine relayout. Fixed at the
architectural root: a fresh iframe element for every navigation, not an
extra forced redraw layered on top of the old behaviour. Nothing about
keeping frames alive *between* tab switches was lost — a URL change
already resets scroll position regardless, so there was nothing worth
preserving across it in the first place.

**The Workshop Host**, delivered as eight small, separated files
(`src/host/`) with no user-facing surface of its own — no computer app,
no rail icon, no window:
- **`ServiceRegistry.js`/`HostManager.js`** — the same registration-
  pattern shape `PageRegistry.js` already established, applied to
  services instead of pages. A new service registers itself and appears
  in the Dashboard automatically, with zero changes required elsewhere.
- **`ProgramsService.js`/`ProjectsService.js`/`FilesService.js`/
  `AutomationService.js`/`HardwareService.js`** — honestly unimplemented,
  each with a real `getStatus()` explaining exactly that, and every
  future-facing method throwing a clear, named error rather than
  silently doing nothing.
- **`PluginRegistry.js`** — distinct from the existing `PluginManager.js`
  (general plugin lifecycle); this is specifically "which `workshop://`
  pages a plugin contributes," and already works end to end even though
  nothing calls it yet.
- **The Host Dashboard** (`workshop://host`) and its sibling pages
  (`HostPages.js`) — `workshop://models` is a real, working page reading
  `ModelRegistry` live, not a placeholder; `workshop://projects` shows
  the Workshop's own real projects and the Host's own future local
  projects side by side, rather than a naming collision or a regression
  of a page that already worked.

**Ollama's migration path is prepared, not taken.** `AIConnectionManager`
still talks to Ollama directly — the actual preparation is that it always
already lived in one small, isolated class, making "swap what's inside
`checkConnection()`/`sendTestPrompt()` for a Host service call" a
contained future change rather than a rewrite.

## Phase 24 — Workshop Polish

**Goal:** "This is not a feature expansion phase. This is a quality
pass... make the existing systems feel comfortable, consistent and
believable."

**A real root-cause bug, solved properly.** "The player model is
currently facing the wrong direction" traced to a genuine 180° mismatch:
an unrotated rig's own local +Z (the plain "front" a symmetric,
face-free box rig naturally has) rotated, under a bare `rotation.y =
yaw`, toward the exact opposite of this project's established forward
convention. Fixing the root rotation alone would have just traded one bug
for another — flipping the whole rig also flips every animation's own
forward-swing alignment with movement, introducing a moonwalk effect
where none existed. The complete fix negates each pose's own X/Z
components in `applyPose()` to compensate, keeping every clip looking
exactly as it always did, now correctly oriented — not a hand-edit of
every frame's numbers across every clip.

**Another real root cause, this time in the Browser.** French door
handles were on the wrong (exterior-facing) side — traced to a Z-offset
sign that didn't account for which side `exteriorFacesPositiveZ` actually
put the interior on for that wall.

**Small, mechanical fixes across many systems** — light switch position,
desk lamp now wired into the same practical-light switch the workbench
lamp already uses (`LightingSystem.registerPracticalLight()`, a new
one-call hook other systems can reuse), mirror viewing distance, computer
seating height/distance, jump height (raised again), smoother ladder
entry, shadow radius/bias for softer, more consistent edges.

**A real, non-cosmetic UI bug fix.** The Quiet Corner's dismiss-the-
reminder interaction was only fading its own inner text, leaving the
overlay's own background panel fully visible and looking like an empty,
still-active overlay — the actual reported symptom. Fixed by fading the
panel element itself, not just its content.

**Settings' new Atmosphere tab** — "the central place for understanding
and controlling the Workshop's environmental simulation" — consolidates
the clock/weather controls that used to live in General with a full, live
read-out (weather, location, date/time, sunrise/sunset, moon phase and
rise/set, star visibility, wind, temperature) reading straight from
TimeOfDaySystem/EnvironmentSystem/Astronomy.js, never a separate copy.
Sunrise/sunset and moonrise/moonset are new: a simple day-long scan for
where `solarPosition()`'s own altitude crosses the horizon, reusing the
exact formula the 3D scene itself already relies on rather than a second
model that could disagree with it.

**Settings' new Diagnostics tab** — "not intended to be a developer
console... a lightweight status page" — FPS/frame time, weather,
time/date, player position, current interior, shadow quality, resident
status, Workshop Platform (Host) status, Ollama connection, every row
reading live from whichever system already owns that fact.

**Music's cross-browser difference, actually root-caused.** The folder
picker already had proper File System Access API feature detection with
a clear, honest "not supported in this browser" message — that part was
already fine. The real gap: the main playback `<audio>` element had *no*
error listener at all (unlike the duration-probe pool), so a track that
failed to decode in a particular browser's own more limited codec support
left `isPlaying` stuck true with nothing audible and no explanation.
Fixed with a real error handler and an honest message in the player UI.

**Builder's interaction prompt field** gets a `<datalist>` of the
Workshop's own real, already-used prompts ("Open," "Sit down," "Talk,"
and so on) as suggestions — free text stays fully available (a custom
object's own prompt is often genuinely custom), but "choosing from
supported interaction behaviours" no longer means guessing at phrasing
from a blank field.

**The resident's own position now genuinely persists**, including
mid-travel. `ResidentState.currentPosition` — a plain field, mutated
directly every frame rather than through an event-emitting setter (doing
that 60 times a second would defeat `PersistenceSystem`'s own debouncing
entirely) — lets `ResidentMovement`'s constructor resume a fresh journey
from exactly where the resident actually was, toward the same destination
it was already heading to, rather than snapping to the destination's own
fixed point on reload.

## Phase 25 — Beings Creator

**Goal:** "This is NOT about adding hard-coded NPCs. This is about
creating a complete system for designing, saving, placing and managing
Beings within the Workshop." See docs/BEINGS.md for the full architecture
write-up.

**Nine small, separated files** (`src/beings/`), following the same
"separate responsibilities" instinct `src/ai/`/`src/resident/`/
`src/host/` already established — `ModelAssetStore`/`ModelLibrary`/
`ModelLoader` (a real GLTFLoader import pipeline, cached and shared —
"reused by Beings, Builder, Player, future systems" is true today, not
just planned, since nothing in that trio has a single Being-specific line
in it), `BeingBehaviours` (a closed, data-only vocabulary — no scripting
surface anywhere), `BeingLibrary` (definitions, with real export/import),
`BeingInstanceStore` (placed instances, the same thin-record shape
`WorldObjectsStore.js` already established for Builder objects),
`BeingMovementSystem` (stateless wander/patrol/avoidance computation),
`BeingController` (the one system that actually spawns, moves, and
renders every placed Being each frame), `BeingSpawnerSystem` (a
floor-only ghost-preview placement workflow, simpler than
`BuildModeSystem`'s own multi-surface version since a living creature
only ever stands on the ground).

**Three new computer apps**, all reusing established shapes rather than
inventing new ones: **Being Creator** (`BeingCreatorApp.js`) reuses
`PreviewRenderer.js` and Builder's own two-pane workspace layout
completely unchanged, plus Builder's own draft-then-save editing model;
**Being Spawner** hands off to the world-space ghost workflow the same
way the Builder Phone hands off to Build Mode; **Being Manager** is "the
Workshop's population manager" — Select/Locate/Rename/Replace
Template/Move/Remove/Despawn/Respawn, every action a plain store call.

**Believable movement without overcomplicating pathfinding**, per the
brief's own explicit instruction — wander/patrol targets are validated
against real wall/furniture colliders when chosen, and a continuous small
repulsion nudge (including from other placed Beings) steers a Being away
from anything it's currently overlapping. A believable illusion of care,
not a solved navigation problem.

**Interaction stays honest about what it is** — Talk/Wave/Inspect surface
a brief message through the same `hud:toast` mechanism the rest of the
Workshop already uses, not a chat interface; a Being isn't connected to
Ollama the way the Workshop's own resident is, and pretending otherwise
would be more misleading than a plain acknowledgment.

**Resident refinement, continued from Workshop Polish.** Size and
idle-location spacing were already addressed in Phase 24; this phase adds
the three remaining persistence fields the brief asks for again — facing
direction, expression, and connection state — implemented honestly as
last-known *snapshots* rather than values that drive behaviour on load,
since the resident's actual orientation is already recomputed fresh each
session and its expression/connection state must always reflect the
live, current truth rather than a stale save from last time.

**A known, documented limitation, not silently shipped**: `ModelLoader`
clones parsed models with a plain `object3D.clone(true)`, correct for
simple unanimated models but sharing a skeleton across clones of a
skinned/animated rig. Named plainly in docs/BEINGS.md rather than
discovered later as a mystery bug.

## Phase 26 — Living Refinement

**Goal:** "Not a feature expansion phase... a quality pass focused on
improving interaction, usability, consistency and overall immersion."

**Another root-cause animation fix, this time a direct consequence of
Phase 24's own.** "The crouch animation appears inverted and pushes the
player downward into the floor" traced back to `applyPose()`'s own global
X/Z negation (introduced in Phase 24 to fix the player's facing
direction) — correct for WALK/RUN's alternating gait, which stays a
valid-looking cycle either way, but wrong for CROUCH/JUMP/FALL/LAND's own
symmetric, non-alternating poses, which flip the wrong direction under
the same global negation. Fixed by renegating those four clips' own
authored values to compensate.

**Bubble**: interaction now requires the reticle be directly over it
(`InteractableComponent`'s new general-purpose `requiresLookAt` flag, not
a resident-specific special case), radius reduced; a genuine drag-to-
reposition mechanic, deliberately routed through raw mouse-button events
rather than the shared "interact" action, since `InteractionSystem`'s own
pipeline fires immediately on key-down with no way to distinguish a quick
press from the start of a hold; slightly larger again; new outdoor idle
locations near and beyond the front door, with wall/window clipping
during travel explicitly embraced rather than avoided — "because Bubble
is a digital entity... this should feel intentional."

**A real, root-caused consistency bug.** The Notebook's own Escape key
wasn't closing it — traced to `InputManager`'s own text-input key
suppression (correctly meant to stop "b"/"e" from toggling Build Mode
while typing) also swallowing Escape, which never actually conflicts
with typing at all. One exemption fixes the Notebook and the resident's
own conversation overlay together, not a Notebook-specific patch.

**Camera**: default vertical invert flipped (the setting already existed
and was already fully wired through `InputManager`'s own
`lookDelta`, just off by default); Settings' own Controls tab relabelled
and grouped as "Camera" to match the brief's own terms.

**Atmosphere**: independent manual overrides for Clouds, Rain, Fog, and
Wind, layered on top of whichever weather preset is active rather than
requiring a preset to match every desired combination; a Moon Phase
override for the one property genuinely tied to the calendar date rather
than time of day. Sun position and Star visibility already follow the
existing Time override — noted plainly rather than duplicating controls
that would do nothing new.

**Animation Editor**: a real Model Selector (Player / Saved Beings /
Imported Models, all through `ModelLoader.js`) with an honest limit
clearly stated — only the Player rig has the named pivots this pose
system understands, so a Being/model previews at its own correct
proportions without pretending to animate through parts it doesn't have.
The split preview/playback layout became a single large preview with the
playback bar as a bottom overlay, freeing the space a separate stacked
row used to take.

**Model Integration**, reusing the same "synchronous placeholder, async
swap" pattern `BeingController.js` already established for exactly this
async-vs-sync mismatch: imported models are now selectable Builder shapes
(a third source alongside Construction/Saved, both for fresh placement
and for instances restored on reload) and optional player bodies via the
Wardrobe (rendering correctly, honestly not animating, since an arbitrary
mesh has none of the rig's own named pivots).

**Builder**: mouse wheel now rotates a ghost in fine, continuous steps
during placement/adjustment, alongside the existing coarse rotate button.

**Mirror, Wardrobe, Computer, Lighting**: mirror camera moved back again
(0.25 → 0.6); Wardrobe interaction radius nudged out slightly; the
computer's own seated eye height raised again (1.27 → 1.32); shadow
camera frustum expanded (±9 → ±13, far 28 → 34) to reach further into
the world, including Bubble's own new outdoor idle spots.

## Phase 27 — World Expansion

**Goal:** "This is NOT simply an outdoor expansion. This is about evolving
the Builder into a true World Builder... the original Workshop should
simply become the first building within a player-created world." See
docs/WORLD.md's own new "World Builder" section for the full write-up.

**Interior Recognition — the most important goal of this phase.**
`BuildingDetectionSystem.js` automatically recognises enclosed player-built
spaces, geometrically rather than by hardcoded piece type: any placed
World Object whose own real bounding box (the exact same boxes collision
already uses) is wall-shaped counts as an enclosure piece. A debounced,
coarse 2D flood-fill over a bounded area finds enclosed regions and
registers each with `InteriorSystem.registerVolume()` — the *exact* call
`RoomLayoutSystem.js` already makes for the Workshop's own room, so a
player-built room gets interior lighting, weather protection, and
ambience through the same systems, no special case required. Players
never mark anything as an interior; the world simply recognises it.

**Builder Library grew substantially** — Foundation and Railing complete
the Buildings list; Nature, Paths, and Lighting arrived as entirely new
categories (every lighting piece reusing the existing `lightSource`
behaviour); Mailbox rounded out Utilities. With the catalogue now well
past its original size, the library screen groups pieces by category
with section headings rather than one long grid.

**Blueprints**: reusable multi-object Builder creations
(`BlueprintStore.js`). Placing one creates genuinely independent,
individually-editable World Object instances, never a single combined
thing — "players should still be able to modify them after placement" is
true by construction. Capture is honestly scoped to a radius around the
current selection rather than a full multi-select interface, a real
simplification named plainly rather than hidden.

**Snapping (optional, off by default) and multi-axis rotation** — grid
and rotation snap toggle from the ghost screen; Shift/Ctrl+wheel add
pitch/roll tilt to the existing yaw-only wheel rotation, with
`WorldObjectsStore` gaining optional `rotationX`/`rotationZ` fields to
actually persist it, not just preview it on the ghost.

## Phase 28 — Workshop Phone

**Goal:** "The Computer is for creating. The Phone is for using." See
docs/PHONE.md for the full write-up.

**A genuinely modular app framework**, not a redesign of the old Builder
Phone — `PhoneSystem.js`/`PhoneUI.js` own the open/close lifecycle,
mouse/camera handling, and home screen uniformly, reusing the exact
proven slide-from-hand shell animation the old Builder Phone already
established. Every app is the same plain `{id, label, glyph,
mount(container)}` shape a computer app already uses, registered through
`phone/apps/registry.js` — the identical factory-list pattern
`src/computer/apps/registry.js` already established.

**"Using the phone should NOT freeze the player"** needed a genuinely new
primitive: `CameraSystem.pauseLook()`/`resumeLook()`, deliberately
narrower than the existing `lock()`/`unlock()` — gating only the
mouse-look block inside `_updateWalk()`, leaving movement, running,
jumping, crouching, and ladders completely untouched. Build Mode itself
changed to match: it no longer calls `lock()` on its own, so placing an
object no longer freezes the player either, matching "continue allowing
world building while walking naturally through the environment."

**Eight apps**: Builder (migrated, not rebuilt — `BuildModeSystem.js`/
`BuilderPhoneUI.js` kept all their own behaviour, only losing the shell/
mouse/camera ownership the Phone now handles centrally), Beings (spawn/
move/remove/view/quick behaviour changes for *placed* Beings; creating
definitions stays on the computer, whose own separate Spawner/Manager
tabs were removed once this migrated), Wardrobe (outfit switching, a
colour swatch standing in for "preview" rather than a full 3D render),
Bubble (Talk/Stay Here/Follow Me/Return Home — three genuinely new
`ResidentController` commands, plus a `stepToward()` continuous-follow
method on `ResidentMovement`, separate from the idle-location system's
own occasional-slow-journey ease), Browser (Workshop docs/bookmarks
inline via the same `PageRegistry` the full browser already uses),
Workshop (weather/time/lighting/music quick controls plus "I'm Lost!"),
Emotes (triggers the existing wheel, doesn't duplicate it), and Settings
(a small, deliberate subset of the full computer Settings).

**Application Persistence**: a single `activeAppId` field — reopening the
phone always returns to whatever app was open when it last closed,
never resetting to the home screen just because the phone itself did.

## Phase 29 — Persistent World

**Goal:** "Teach the Workshop that life does not stop simply because
the player looks away... nothing should appear to have been waiting for
the player." See docs/PERSISTENCE.md for the full write-up.

**A genuinely shared time service**, not each system computing its own
elapsed time. `WorldTimeService.js` reads the `savedAt` timestamp
`PersistenceSystem.js` already wrote into every save envelope (nothing
new stored for this), and — the instant every system's own
`persistence:load` handler has already run, guaranteed by
`EventBus.emit()`'s synchronous dispatch — turns it into one clean event,
`"world:continuity"`, carrying `{elapsedMs, elapsedSeconds,
cappedElapsedSeconds, isFirstSession}`. Capped at six hours: "simple
continuity is sufficient" means a month-long absence produces the same
"something plausible changed" result as a shorter one would, not an
attempt at true long-term simulation.

**Bubble and Beings both answer "what should I have been doing?" with a
single, honest decision, not a real simulation** — the player never saw
any of the intermediate hops a full simulation would produce, so
modelling them has no payoff. Below a believable minimum (Bubble's own
`MIN_REST_SECONDS`, already a real constant its ordinary wandering uses),
nothing changes at all, preserving "nothing should feel scripted" for
short gaps. Past it, each picks one new, plausible position and arrives
there directly — no travel animation plays, since whatever journey led
there happened while nobody was watching.

**Weather continuity already existed** — `EnvironmentSystem`'s own
`_catchUpDynamic()` predates this phase and already correctly steps
through weather transitions based on real elapsed time. Time
continuity had a genuine gap: `"realtime"` mode needs nothing (it reads
the actual clock every frame), but `"simulated"` mode stored a fixed
value that would have resumed frozen after any gap; it now advances
using the same capped elapsed time everything else uses.

**Workshop Projects — architecture only**, per the brief's own explicit
scope. `WorkshopProjectStore.js` computes progress as a pure function of
`Date.now()` and a stored duration — genuinely finishing on schedule
whether or not the Workshop was open at that moment — but isn't wired to
any UI yet; that's a future Workbench/Construction/Automation phase's
own work.

## Phase 30 — Universal Experience

**Goal:** "There should never be a Desktop Workshop and a Mobile
Workshop. There is only the Workshop." A refinement pass, no major new
features. See docs/RESPONSIVE.md for the full write-up.

**The single highest-leverage fix**: the Computer's own screen and the
Workbench's own clipboard are both DOM panels positioned every frame to
match a rectangle projected from the 3D scene — and that projection had
no minimum size at all. `comfortableRect()` (`ScreenProjector.js`) is a
shared floor under it, used by both — below a comfortable size, or on a
narrow viewport, the rect widens back out, centred on wherever the
projection itself was centred. Every Computer app (Builder, Being
Creator, Wardrobe, AI Mission Control, Diagnostics, Settings, Animation
Editor) inherited this fix simultaneously, since they all render inside
that one panel.

**The shared `builder-workspace` split** (Builder, Being Creator,
Animation Editor) now stacks vertically below 700px — preview first,
given a firm minimum height so it stays "the primary focus," form below
it, scrollable. The Workshop Phone gained its own narrow-viewport
treatment, becoming a full-width, bottom-anchored sheet below 420px
rather than a fixed 300px corner panel — easier to reach with a thumb.

**Global, not per-file, for touch and accessibility.** A `(pointer:
coarse)` baseline in `tokens.css` raises the minimum size of every
button/select/checkbox/radio/range across the whole Workshop at once,
rather than touching dozens of individual button classes one at a time;
a `:focus-visible` fallback does the same for keyboard focus rings.

**Automatic performance detection, but only where it's safe.** The
device-capability heuristic already existed but only ran when a player
found and clicked a Settings button — meaningless for a first
impression. It now applies automatically, exactly once, only on a
genuinely fresh Workshop (`isFirstSession`, from the previous phase's
own `WorldTimeService`), never overwriting an existing player's own
deliberate choice.

## Phase 31A — Workshop Polish (final Version 1 pass)

**Goal:** "Before moving into Version 2.0, the Workshop deserves one
final polish pass... make Version 2.0 feel calm, comfortable and
consistent." A refinement pass, not a feature pass.

**A real, concrete bug fixed at its actual root cause**: the Computer's
own clock read "NaN : NaN" because `TimeOfDaySystem`'s own state object
returns the current hour under the key `hour`, not `currentTime` —
`WorkstationPanel.js` had been destructuring a field that never existed
on the payload at all. A second, equally real bug: the Phone's own Home
button was hidden on the *Workshop app's own screen*, because an earlier
version decided visibility by comparing the title string against
`"Workshop"` — which happened to also be that app's own label. Fixed
with an explicit `isHome` flag instead of a string comparison.

**Bubble gained a subtle thinking indicator** — three staggered, pulsing
dots in the conversation overlay itself, appended while
`residentConnection.sendMessage()` is in flight and removed the instant
the real reply arrives, communicating "thinking," not "frozen."

**A held-key camera zoom** (Z) — `CameraSystem.pauseLook()`'s own
`damp()`-based easing pattern, reused for a smooth FOV lerp
(62°→38°→62°) rather than a snap, gated to `mode === "walk"` so it does
nothing meaningful while already sitting down looking at a screen.

**The Quiet Corner's own real bug, finally traced to its actual cause**:
dismissing the introductory message only ever faded `panelEl` itself —
but every `materialClass: "panel"` overlay's own *outer* element carries
its own separate full-screen dark backdrop, untouched by that fade,
which is what stayed visible. Fixed by fading both. Along the way, a
second, more substantial gap: sitting anywhere used the same fully-fixed
camera the Computer/Workbench use, with no way to look around at all —
`allowLookAround`, a new opt-in field on a focus pose, hands yaw/pitch
back to ordinary mouse input once seated while position stays locked
forever after, and only the Quiet Corner's own pose opts into it.

**Emotes became a real Phone app**, not an immediate wheel-trigger — a
plain list, reading the exact same `animationLibraryStore` and
triggering through the exact same `playerAnimationSystem.play(id)` the
radial wheel's own grid already used. The direct key shortcut still
opens the wheel exactly as before; this is a second way to reach the
same gestures, not a replacement.

**The dust motes "proof of concept" evolved into a permanent, more
polished effect** — two clusters (one per actual window) instead of one
vaguely "between" them, and a gentle, continuous inward pull rather than
a mechanical instant-reversal bounce at each cluster's own edge.

**Documentation tidied**: the README's front matter is now a genuinely
short description/philosophy/features/quick-start, with the full
phase-by-phase history moved into a collapsible changelog section
further down. A PowerShell launcher
(`start-ollama-for-workshop.ps1`) was added to the repo root, with
matching "when and why" instructions in the README.

## Phase 31B — Technical Refinement (engineering pass before 2.0)

**Goal:** "Imagine you have inherited this project as a long-term
maintainer... leave the project cleaner, more maintainable and easier
to expand." A code-quality and architecture review, not a feature pass.

**A genuine, investigated rendering issue, not just browser noise.** The
recurring "generateMipmap... lazy initialization" warning traced to
every `THREE.CanvasTexture`/`THREE.Texture` in the Workshop (the
resident's own face, player clothing, procedural wood/paper/fabric
textures, display-surface images) being created with Three.js's own
default mipmap-requiring filters, never explicitly configured either
way — the browser only actually builds that mipmap chain the first time
each texture is drawn, not when it's created, which is exactly what
"lazy initialization" describes. None of these textures are ever viewed
at the wide range of distances/angles mipmapping exists to help with;
`configureFlatTexture()` (`TextureUtils.js`), one new shared helper,
disables it across all fifteen instances at once rather than resizing
every canvas to a power of two or leaving the warning as accepted noise.

**AI connectivity, actually root-caused rather than just given a bigger
number.** "Current behaviour sometimes disconnects before slower systems
have finished loading a model" — traced to both real-generation calls
(`sendMessage()`, `sendTestPrompt()`) sharing a 30-60 second timeout,
while Ollama itself can spend well over a minute loading a larger
model's own weights from disk on modest hardware before generating
anything at all. Both now use a three-minute timeout; the lightweight
"is Ollama even reachable" poll (`/api/tags`, which loads nothing) stays
exactly as quick as it already was. The resident conversation overlay
also gained a quiet, one-line reassurance once a reply has genuinely
been taking a while, so a long wait never reads as the Workshop having
simply frozen.

**A clean architecture, largely confirmed rather than needing rework.**
A full unused-import/dead-file sweep found the codebase already
following its own established conventions consistently — no stray
`console.log`s, no orphaned files (the only false positives were
side-effect imports my own detection script's regex couldn't see),
shared math utilities (`clamp`/`lerp`/`damp`) already centralised in one
place rather than duplicated. This pass's own real contribution was the
texture-mipmap fix and the AI timeout fix above — both genuine,
previously-undiagnosed issues — rather than a wholesale restructuring of
architecture that was already sound.

## Phase 31C — The Workshop 2.0

**Goal:** not a spec — "you have one opportunity to contribute something
of your own... because after living inside this project you genuinely
believe it belongs."

**One small contribution**: Bubble is now a little more likely to wander
to the window while it's raining, or during a warm sunrise/sunset sky,
than to any other idle spot at that moment. No new system — one small
method (`ResidentController._windowWatchWeights()`) nudging the odds on
the exact same random idle-location pick that already existed, using two
signals (`EnvironmentSystem.getEffectivePrecipitation()`, and the same
golden-hour window `TimeOfDaySystem` already uses for the sun's own
colour shift) that were already true and already meaningful elsewhere.
`randomIdleLocationId()`'s new optional `weights` argument is the one
genuinely reusable piece of this — available to any future Being or
resident wanting the same "usually random, occasionally shaped by
something real" texture, without needing to invent the mechanism again.

The full reasoning — what was added, why this over everything else it
could have been, how it fits the Workshop's own philosophy, and a
maintainer's honest reflection on thirty-one phases — lives in the
README's own "One contribution" and "Reflecting, after thirty-one
phases" sections, not repeated here.

## Phase 31 — depth in the room that exists

Roughly in priority order, each independently shippable:

1. **Documentation archive** — give the shelving unit real content: a
   simple markdown-note store (mirrors `NotesStore`'s pattern), browsable
   by category, with "done" projects auto-linking in from `ProjectsStore`.
2. **Tool storage → inventory** — replace the honest placeholder with a
   real item list (name, quantity, location), still using the same
   furniture definition and overlay slot.
3. **Real ID3/embedded metadata for the music library** — see "Future
   extension points" in `docs/MUSIC.md`. `AudioSynth`'s generative pads
   remain in use for weather ambience and the `audioSource` behaviour
   specifically (a simpler, single-track use case the real library was
   never meant to replace) — see `docs/MUSIC.md` for why those two stayed
   separate on purpose.
4. **Small-phone-width layout pass** — touch *input* is fully implemented
   (Phase 6), tuned for "reasonably large screens" per the brief; the
   workstation/workbench/Build Mode/music panels' *sizing* hasn't had a
   dedicated pass for genuinely narrow (phone-width, as opposed to
   tablet-width) viewports yet — distinct from Phase 9's UI Scale setting,
   which scales everything uniformly rather than reflowing it, and from
   Phase 15's rail-scrolling fix, which solved reachability specifically,
   not narrow-screen layout generally.
5. **Occlusion-aware interaction checks** — a raycast between the player
   and a candidate interactable, so standing just outside a wall can no
   longer trigger something on the other side of it (see `docs/WORLD.md`'s
   known simplifications).
6. **A real performance benchmark**, if the heuristic in "Optimise For
   This Device" (Phase 9) ever proves unsatisfying — rendering a few
   sample frames and timing them, rather than inferring from device
   capability alone.
7. **Clothing and wearable Builder objects** — attaching to the rig's
   existing pivots (see `docs/PLAYER.md`'s "ready for what comes next").
8. **Multi-select, snapping, and undo/redo for Build Mode** — see "Future
   extension points" in `docs/WORLDBUILDER.md`.
9. **A true oriented planar reflection**, and reflective surfaces beyond a
   flat plane — see "Future extension points" in `docs/PLAYER.md`.

## Phase 32 — the world becomes alive on its own

1. **Seasonal changes** — a plugin (see `PLUGIN_GUIDE.md`) reading the real
   calendar date and adjusting window tint / a handful of decorative
   details. `EnvironmentSystem`'s moon-phase calculation (Phase 14) is the
   existing precedent for "a real-calendar-driven detail computed
   independently of weather."
2. **Real falling-rain/snow particles outdoors** — now that a real
   exterior exists (Phase 5) and weather genuinely varies (Phase 14), the
   window's honest streaks-on-glass could extend to actual particles
   falling over the outdoor world. See "Future extension points" in
   `docs/WORLD.md`.
3. **The computer's placeholders, for real** — a browser view (likely an
   `<iframe>` where targets allow it), a local AI companion (see
   `docs/PLUGIN_GUIDE.md`), and real recorded/streamed media.
4. **A finished project's physical send-off** — an actual short animation
   of a completed piece moving from the bench toward the shelving unit,
   building on the "packs away" transition already in place.
5. **`worldObject:trigger` gets a listener** — the Trigger behaviour
   (Phase 4) already emits a generic named event; the first system or
   plugin that actually listens for one is what proves the hook out. The
   Construction Library's own Switch piece (Phase 13) is one ready-made
   source of that event, waiting for something to listen.

## Phase 33 — beyond one building

- **Additional buildings** — `RoomLayoutSystem` was written with this in
  mind (see its class comment), and `WorldObjectsStore` was made
  room-scoped in Phase 4 for the same reason: evolving from "builds one
  room" to "holds a small set of rooms/buildings and an active one" is the
  shape of this feature. `WorldEnvironmentSystem`'s ground/sky already work
  the same way regardless of how many buildings sit on that ground — a
  second building shares them, it doesn't need its own copy.
- **Personal collections** — display-case-style furniture + a store plugin,
  once there's a reason to want one — or, now, just a custom Builder
  object with a Decoration behaviour and a Storage one nearby.

## Version 2 — Phase 1 — Workshop Residents (v2.0.1)

**Goal:** not a new system — "Version 2 is different. It is no longer
about introducing major systems. It is about deepening them... teach
residents who they are." A deepening pass on the one resident that
already exists, not a spec for a new one. See docs/RESIDENT.md for the
full write-up; docs/AI.md for what this activated in Mission Control
specifically.

**Personality Traits**, a new small, structured layer alongside the
existing free-text Resident Identity fields — up to two named long-term
traits (Curious, Calm, Cheerful, Quiet, Thoughtful, Playful,
`src/ai/TraitConfiguration.js`), turned into concrete movement/awareness/
idle-location/expression modifiers by `ResidentTraits.getTraitModifiers()`
— averaged across whatever's selected, always subtle (roughly ±25-35%),
never a different creature depending on what's chosen.

**Mood, Emotion, and Personality, genuinely distinguished by timescale**
— personality is the traits above (fixed); mood
(`ResidentController._maybeDriftMood()`) now actually drifts every few
minutes, a weighted pick biased by traits and accumulated preferences,
strongly biased toward staying whatever it already was; emotion
(`ResidentBehaviour.triggerEmotion()`) is a brief, never-persisted overlay
triggered once, at conversation start.

**Preferences and Behaviour Memory**, two parallel affinity stores
sharing one small utility (`src/utils/AffinityTracker.js`) — Bubble's own
emergent favourite places/weather/time-of-day/activities
(`ResidentPreferences.js`), and the player's own observed patterns of
where and when they tend to be found (`PlayerPatternMemory.js`), both
gated on a minimum sample count so a "favourite" only ever reports once
there's an actual pattern behind it — "quiet familiarity rather than
prediction."

**Curiosity**, surfaced only as conversation context, never a
notification — `ResidentCuriosity.gatherNotes()`, called once per
conversation open, checking whether something new has been built, whether
the current weather or time of day is worth mentioning, and whatever
preferences/patterns have accumulated.

**Conversation Memory, genuinely improved** — a bounded, reinforced list
of *meaningful* things (project mentions, stated preferences, stated
goals, finished-project milestones), distinct from the ordinary
session-only message history, gated on Mission Control's own Memory
`mode` (now genuinely read, rather than inert) and deliberately kept
runtime-only rather than half-persisting a list with no real pruning plan
yet.

**Resident Embodiments, no longer inert** — five real shapes (Floating
Orb, Cube, Prism, Lantern, Wisp), a genuinely tinted body, a glow that
scales with its own slider, a configurable scale, and idle motion that
responds to the chosen idle behaviour — all sharing identical material,
inner glow, face, and sparkle logic, so switching shape never changes
what kind of thing a resident visibly is.

**Appearance clarity**: "thinking" and "curious" used to share almost the
same asymmetric-raised-eye face at this texture size, easy to mistake for
one another — "thinking" now lifts both eyes evenly with a flat, settled
mouth (turned inward), distinct from "curious"'s original asymmetric,
outward-looking look.

## Version 2 — Phase 2 — AI Intelligence (v2.0.2)

**Goal:** "Version 1 established the architecture for local AI... this
phase is about bringing those foundations to life... this is NOT about
making AI more powerful. It is about making residents feel more
personal." Mission Control itself is the surface this phase deepens —
see docs/AI.md for the full write-up; docs/RESIDENT.md for what each
setting actually does inside the room.

**Additional Providers**, architecturally — Ollama remains the only
functional one; LM Studio, OpenAI, Anthropic, and a Custom Endpoint are
now real, selectable options in Mission Control's own Provider section,
each honestly marked as reserved for a future phase rather than
pretending to connect (`src/ai/ProviderRegistry.js`).

**Behaviour Dials**, seven continuous 0-1 sliders (Curiosity,
Talkativeness, Playfulness, Energy, Independence, Reflection, Calmness),
distinct from and complementary to the previous phase's own discrete
Personality Traits — combined by `ResidentContext.
getPersonalityModifiers()` into the one modifier set
`ResidentController.js` applies to movement pace, motion damping,
awareness, idle-location weighting, and a short conversational-style
line, always staying subtle (roughly ±30-40% at the extremes).

**Memory, genuinely configurable** — seven categories (what Bubble
remembers: conversations, projects, preferences, favourite places,
favourite activities, Workshop history, long-term goals) and three real
lifetime tiers (temporary, medium-term, permanent, each with an actual
expiry behind it), both now read by `ConversationMemory.js` rather than
being architecture alone.

**Resident Sandbox**, a genuinely isolated testing environment inside
Mission Control — its own conversation history, its own read-only memory
inspection, never touching `ResidentBehaviour`/`ConversationMemory`'s own
real state, built from the exact same `ResidentContext.
buildConversationContext()`/`PromptComposer.composeSystemPrompt()` path
the real conversation uses, so a test here is an honest preview rather
than an approximation.

**Resident Health**, a calm, plain-language status grid — resident
status, connected model, provider, real round-trip latency, current
activity, current mood, memory status, current location — refreshed
automatically but never while a field in the form has focus.

**Mission Control's own information architecture reorganised** to match
the brief's own grouping — "Behaviour" (the previous phase's generation
parameters — temperature, context size) renamed to "Intelligence,"
freeing "Behaviour" to name the new dials above; profile list rows gained
a one-line at-a-glance summary (selected traits, non-default embodiment).

## Version 2 — Phase 3 — Browser Ecosystem (v2.0.3)

**Goal:** "This phase is NOT about making a better web browser. It is
about transforming the Browser into the Workshop's universal interface...
by the end of this phase the Browser should begin feeling like the
Workshop's operating system rather than simply another application." See
docs/BROWSER.md for the full write-up; docs/HOST.md for the Host side of
the same relationship.

**A real multi-scheme `PageRegistry`** — `workshop://`, `host://`, and
`plugin://` are now genuinely equal internal schemes (`INTERNAL_SCHEMES`,
`isInternalUrl()`), replacing what used to be a single hardcoded
`workshop://` check duplicated across three places in `BrowserApp.js`.
`registerDynamic()` is new alongside it, for pages that can't be
enumerated ahead of time — an individual asset's own detail page, one
per definition, rather than one registration per item.

**New Workshop pages** — `workshop://residents` (every resident profile,
plus a live snapshot of the currently-embodied one), `workshop://assets`
(a Shared Asset Library overview with live counts, see "File Pages"
below), `workshop://diagnostics` (a calm Workshop-wide health check —
engine systems, persistence, AI connection, Host, Browser ecosystem
size), `workshop://mission-control` (a read-only bridge to Mission
Control's own live state), `workshop://bookmarks`, and
`workshop://search` — `workshop://documentation` is the new canonical
name for what was `workshop://docs` (kept working as an alias).

**File Pages** — `workshop://asset/<category>/<id>`, real per-item
detail pages for Objects, Blueprints, and Animations (registered as one
dynamic resolver each, not one registration per item), each with a
genuine preview (part-colour swatches, built from the definition's own
real data), real metadata, real cross-referenced relationships (how many
times an object is currently placed; what pieces a blueprint is made of),
and honest actions.

**Host Pages migrated to a real `host://` scheme** — `host://services`
(renamed from `workshop://host`), `host://applications`, `host://
projects`, `host://documents` and `host://downloads` (two brand new
Host services), `host://files`, `host://models`, `host://plugins`,
`host://automation`, `host://hardware` — every old `workshop://` Host URL
kept working as an alias. "Sensible placeholder data" (this phase's own
brief) and "an honestly empty list, never a fabricated one" (earlier Host
phases' own standard) both survive intact: real state stays genuinely
empty, a new `previewItems()` returns clearly "Example"-badged
illustrative rows, never mixed silently into real results.

**Plugin Pages, genuinely exercised** — `plugin://example-plugin` (a
reference implementation) and `plugin://calculator` (a real, working
four-function calculator, entirely self-contained in its own page) are
the first two plugins to ever call `PluginRegistry.registerPlugin()`,
proving the mechanism end-to-end rather than leaving it proven only on
paper.

**Unified Search, foundations** — `SearchIndex.js`, a small flat index
contributed to alongside each page registration; `workshop://search`
filters it client-side as the person types; the address bar itself now
routes anything that doesn't look like a URL straight to a search,
rather than guessing at `https://`.

**Browser Navigation** — a one-click bookmark star reached the full
Browser's own toolbar (previously only the Phone's Browser app had
bookmarks), backed by the same shared `BrowserStore.bookmarks` list.

## Version 2 — Phase 4 — Workshop Platform (v2.0.4)

**Goal:** "Version 1 introduced the Workshop Host as a proof of concept.
Version 2 is about completing it... the Host should become the
Workshop's operating system. The Browser remains where the player
interacts with the Workshop. The Host becomes the engine quietly working
beneath it." See docs/HOST.md for the full write-up; docs/BROWSER.md for
the three new protocols.

**Nine named services, all now real** — Application (`ProgramsService`,
now also registered as `"applications"`), File, Project, Automation,
Hardware (all expanded), plus four genuinely new: **Asset Service**
(a real, live view over every existing asset library — Objects,
Blueprints, Animations, Models, Images, Music — registered dynamically,
not hardcoded), **Resident Service** and **Diagnostics Service** (real
Host-level views over the resident system and Workshop-wide health,
formalising what a Browser page already computed ad hoc), and **Plugin
Service** (a unified directory across both of the Workshop's plugin
contracts).

**A real Workshop Host Companion** — "some capabilities requested during
this phase cannot reasonably exist inside a browser environment alone...
please feel free to think beyond JavaScript running in the browser."
`host-companion/workshop-host-companion.js`: a genuine, zero-dependency,
optional local Node.js server, deliberately scoped to two safe,
read-only endpoints (a status check and a sandboxed, metadata-only
directory listing) rather than anything that could meaningfully harm
someone if a stray request ever reached it. `HostConnectionManager.js`
polls it the identical calm way `AIConnectionManager` polls Ollama;
`FilesService.listFiles()` is genuinely real once it's running.

**A real permissions architecture** — five categories, all off by
default, persisted; Filesystem is the one category with real teeth
today, gating `FilesService`'s own Companion-backed capability even when
the Companion is reachable. `host://permissions` is genuinely
interactive.

**Real, if narrow, additions elsewhere** — pinned local projects
(`ProjectsService`, genuinely persisted, independent of any filesystem
bridge), Automation's own task descriptors (real data, nothing executes
them yet — "avoid implementing large automation systems" honoured
directly), Hardware's own named device categories.

**Three new Local Protocols** — `asset://`, `resident://`, `project://`,
each the new canonical scheme for something that already existed under
`workshop://` (all kept resolving as aliases) — `BrowserApp.js` needed
zero changes for any of them.

## Version 2 — Phase 5 — Workshop Asset System (v2.0.5)

**Goal:** "Each of these currently manages its own content. This phase is
about giving them a shared language... the Workshop should no longer
care where something came from. Only what it is." See docs/ASSETS.md for
the full write-up; docs/HOST.md and docs/BROWSER.md for how it fits
alongside the Host and the Browser.

**A shared Workshop Asset envelope** (`WorkshopAssetSchema.js`) — name,
type, a stable id (`"<kind>:<item id>"`, never a filename), description,
author, dates, version, categories, tags, thumbnail, dependencies,
validation status — computed on demand around every existing library's
own real, unchanged internal shape, not a replacement for any of them.

**`AssetService.js` substantially expanded** — `registerKind()` now
accepts `toDescriptor`/`getDependencies`/`validateItem`, each optional
with an honest default. Real, working: Favourites and Recently Viewed
(both persisted), unified search across every individual asset (feeding
`workshop://search` live), real Blueprint→Object dependencies and their
reverse (used-by), real validation (missing dependencies, invalid scale,
missing thumbnails, and more), and genuine swatch-built thumbnails for
Objects and Blueprints. Honestly deferred: Materials/Textures/Particles/
Sounds/Behaviours as dedicated kinds, real import/export, real
optimisation (LOD, collision, mesh, compression) — each a named,
throwing placeholder, not a fabrication.

**Plugins can now register Workshop Assets**, not only pages —
`PluginRegistry`'s own second method, `provideAssets(assetService)`,
proven end-to-end by extending the reference example plugin with three
small, genuinely real "sticker" assets that appear everywhere a native
asset would (the Shared Asset Library, Unified Search) with zero changes
to `AssetService.js`, `AssetPages.js`, or `PageRegistry.js`.

**A real inconsistency caught and fixed along the way**: `workshop://
diagnostics` had never actually been refactored onto `DiagnosticsService`
despite the previous phase's own documentation claiming it was — fixed
this phase, so the Browser page and the Host Dashboard now share one real
report rather than two copies quietly able to drift apart.

## Version 2 — Phase 6 — Advanced Animation (v2.0.6)

**Goal:** "Version 1 established the Workshop's animation architecture.
Version 2 is about completing it... animation becomes a Workshop Asset...
a shared language spoken by every moving thing inside the Workshop." See
docs/ANIMATION.md for the full write-up; docs/PLAYER.md and
docs/BEINGS.md for how the Player and Beings each consume it.

**Frame advancement and pose blending extracted into `AnimationPlayback.js`**
— pure functions, verified behaviourally identical to
`PlayerAnimationSystem.js`'s own previous private implementation before
anything was wired to depend on them, plus a small `ClipPlayer`
convenience class for any new consumer.

**Skeleton Mapping and Retargeting, both genuinely real.**
`WorkshopSkeleton.autoMapSkeleton()` is a tested heuristic bone-name
matcher (Mixamo's own real naming quirks included, found and fixed by
testing against a mock rig during development) that maps an arbitrary
imported skeleton onto the shared fourteen-joint Workshop vocabulary;
`AnimationRetargeting.applyPoseToMappedSkeleton()` applies a clip's own
pose as a rest-pose delta, not a naive overwrite.

**Beings genuinely play Workshop animations for the first time** —
`idleAnimationClipId`/`walkAnimationClipId` existed as data references
since an earlier phase with nothing reading them; `BeingController.js`
now does, through the retargeting path above, the moment a Being's own
model maps usably.

**A real, related bug found and fixed**: making retargeted playback work
correctly for multiple Beings sharing one animated model surfaced a
previously-documented `ModelLoader.js` limitation (plain `.clone(true)`
sharing a skinned mesh's own skeleton across clones) that had been purely
theoretical until this phase actually needed animated models to work.
Fixed with `SkeletonUtils.clone()`, the standard Three.js answer.

**A real, tested two-bone IK solver** (`TwoBoneIK.js`, law of cosines) —
verified against actual geometric properties (reachable targets land
exactly on the target; unreachable ones clamp gracefully with no `NaN`) —
architecture and real math, not yet wired to any specific gameplay
system, exactly as the brief's own "architecture established, complete
implementation deferred" asked for.

**Procedural animation layers, real and working** on the Player rig —
`playOverlay(clipId, jointGroup)`/`stopOverlay()`, blending a second clip
over a chosen joint subset on top of whatever's already playing.

**Animation Events** — a frame can carry `{type, data}` events, fired on
the engine's own `EventBus` as `"animation:event"` by whichever system is
playing the clip; a real, working mechanism with no listener wired to it
yet.

**A real, working shared Pose Library** — `PoseLibraryStore.js`,
registered as a seventh Workshop Asset kind, with a genuine "Save Frame as
Pose" button now living in the Animation Editor.

**The Animation Editor's own model preview became genuinely retargeted**
— selecting a Saved Being or Imported Model now actually plays the
current pose/clip on that model's own real skeleton, not only its static
proportions.

## Version 2 — Phase 7 — Being Creator (v2.0.7)

**Goal:** "The Workshop should allow creators to build life from
nothing. Not just import it... just as the Builder creates buildings,
the Being Creator should create creatures... this phase is intended to
take the Being Creator to a genuinely usable state." See docs/BEINGS.md
for the full write-up.

**A complete, working body-construction workflow, not only architecture**
— `BodyCompiler.js`: four primitive shapes (Cube, Sphere, Cylinder,
Capsule), a genuine parent-child hierarchy (not the flat, single-root
shape `ObjectCompiler.js`'s own Builder parts already use), full
three-axis rotation per part. A fresh Being starts with one sensible part
already in place rather than an empty form.

**Rig Creation, deliberately simple**: "please optimise for clarity
rather than complexity." Rather than a second, parallel bones system, any
body part can be tagged with a Workshop skeleton joint name directly —
`BodyCompiler.compileBody()` derives an *exact* skeleton straight from
those tags, no heuristic detection needed at all, complementary to (not a
replacement for) the Advanced Animation phase's own `autoMapSkeleton()`
for imported rigs.

**A real hierarchy editor** — an indented, always-in-tree-order part
list doubling as selection (with the identical live-preview highlight
`BuilderApp.js`'s own part selection already uses), Add/Duplicate/
Delete/re-parent (via a cycle-safe "Parent" dropdown), and a genuinely
useful Mirror tool — reflects an entire selected sub-tree, not just one
part, swapping Left↔Right in names and joint assignments, reattached as
a sibling of the original.

**Beings genuinely play Workshop animations inside the Creator itself**
— a real Preview button next to the Idle Animation picker, using the
identical `ClipPlayer`/retargeting pairing `BeingController.js` uses for
a placed Being, working for both primitive and imported bodies (the
latter now gets the identical `autoMapSkeleton()` check the Creator's own
preview previously skipped).

**Full Asset System integration** — `"beings"` is a real, registered
kind: real metadata/categories/tags, real swatch thumbnails for
primitive bodies, real dependencies (on a Being's own model and/or
animation clips — computed the honest way, not fabricated), real
validation (no body parts, no rig joints, or no model chosen, each
flagged specifically), real search, and a real `asset://being/<id>`
Browser detail page.

**A real, unrelated bug found and fixed**: building this phase's own
dependency-checking surfaced that `AnimationLibraryStore.get(id)` (user
clips only) had been used where `getClip(id)` (resolves defaults too)
was needed, since the Workshop Asset System phase — silently breaking
`AssetService.describe()`/`exists()` for any of the eight seeded default
animation clips. Fixed at the root, in both the "animations" kind's own
registration and the matching Browser detail page.

**Honest, deliberate scope boundaries** — no click-to-select in the 3D
preview, no drag-and-drop re-parenting, and no hybrid editing of an
imported model's own hierarchy; all documented plainly as real future
extension points rather than silently absent.

## Version 2 — Phase 8 — Builder Evolution (v2.0.8)

**Goal:** "This phase is NOT about introducing entirely new building
systems. It is about refining the Builder into a professional creative
tool... small workflow improvements are often more valuable than large
new features... prioritise completing and refining existing workflows
over introducing unnecessary new systems." See docs/WORLDBUILDER.md for
the full write-up.

**Real multi-selection, layered on top of single-selection without
changing it** — `BuildModeSystem.selection` stays the ordinary primary
item every existing method already assumed; `additionalSelection` is the
one new field. Shift-click, and a genuine screen-space drag-select
rectangle (`THREE.Vector3.project()`, Builder objects only — furniture
stays click-only on purpose), both converge on the same mechanism, plus
Select All / Invert Selection.

**Real object grouping** — a `groupId`/`groupName` pair shared across
members, no separate registry; selecting any one member selects the
whole group automatically. A whole multi-selection or group can be moved
together for the first time (translation-only, by design — see "Known
simplifications").

**A real, generic undo/redo system** — `EditHistory.js`, a bounded
command stack; every mutating Build Mode action (place, move — single,
multiple, or furniture — duplicate, delete, group, ungroup, align,
distribute, copy/paste/reset transform) gets its own entry. Ctrl+Z/
Ctrl+Y work anywhere Build Mode is open.

**Alignment, distribution, and measurement** — `AlignmentTools.js`, pure
functions over plain position arrays; real bounding-box dimensions and
inter-object distance reusing `WorldObjectsSystem`'s own already-computed
collision boxes rather than a second calculation.

**Blueprint Workflow, genuinely improved** — exact multi-select capture
(no more radius-guessing, though that option stays available for a
single click) and a real "Update" — re-capturing a blueprint's own object
list in place, same id, the first time an already-shared Blueprint can be
brought up to date rather than only ever saved anew.

**Two stale "future extension point" bullets from earlier phases were
found and corrected** while writing this phase's own documentation —
"multi-select" and "undo/redo" had both been listed as *not yet built* in
docs/WORLDBUILDER.md even after this phase built them; fixed alongside
everything else.

## Version 2 — Phase 9 — World Builder (v2.0.9)

**Goal:** "The Builder creates structures. The World Builder creates
places... the surrounding world should feel just as thoughtfully
designed as the Workshop itself." See docs/WORLD.md's own "World Builder
(Version 2, Phase 9)" section for the full write-up.

**A real, bounded, editable terrain heightmap** (`TerrainSystem.js`) — a
48m patch layered above the existing infinite flat ground, not a
replacement for it. Raise/Lower/Flatten/Smooth/Terrace, all genuine,
tested algorithms with soft falloff; vertex-colour painting (grass,
dirt, rock, sand, gravel, mud, path) blended by real linear
interpolation. Walking on it is real — `CameraSystem` now queries a
bilinearly-interpolated terrain height as its base ground height.

**A real, previously-undiscovered documentation/implementation gap,
found and corrected**: `docs/WORLD.md` had claimed Nature, Paths, and
Lighting Construction Library pieces already existed from an earlier
Version 1 phase; they didn't — only their category reservations
(`CONSTRUCTION_GROUPS`) and colour constants did. This phase filled in
seven real Nature pieces and five real Path pieces for good, corrected
the historical record, and honestly left Lighting fixtures still
reserved-but-unpopulated rather than claiming them too.

**Trees genuinely sway in the wind** — a small, cheap, real effect
(`ObjectCompiler.js`'s new `swaysInWind` part flag,
`WorldObjectsSystem.js`'s own update loop) reading the exact same wind
values `WorldEnvironmentSystem`'s clouds already drift by — "begin
preparing the World Builder for future Atmosphere systems" made
concrete now, not only a prepared hook.

**Construction Library pieces joined the Asset System for real** — every
wall, door, and new Nature/Paths piece is now searchable, favouritable,
and has a genuine Browser detail page, merged into the existing
`"objects"` kind alongside player-designed objects.

**Honest, deliberate scope boundaries**: no Building Plots, no dedicated
water-feature tool, no curved-spline paths (tile-based instead, the same
"alphabet pieces" philosophy every other Construction piece already
follows) — all named explicitly as real future extension points rather
than silently absent.

## Version 2 — Phase 10 — Living World 2.0 (v2.1.0)

**Goal:** "A living world is not one that constantly performs. A living
world is one that quietly notices... the goal is subtlety, not
spectacle." See docs/RESIDENT.md's own "World Awareness" section for the
full write-up.

**A shared World Awareness layer** (`WorldAwareness.js`) — one small,
read-only, query-based class answering "what does the world look like
right now" (time, weather, music, player, room, active projects, nearby
Beings, resident mood, recent events) as a single consistent snapshot,
owning no state of its own — every field already lived somewhere real;
this is the first place anything can ask for all of it at once.

**A real World Event Log** (`WorldEventLog.js`) — a small, bounded (40
entries), persisted record of genuine transitions (a weather change, a
sunrise or nightfall, a song starting), populated entirely by listening
to events the Workshop already emits. A real, visible payoff: the two
most recent events now fold into Bubble's own "things you might have
noticed recently" conversation line, alongside its existing curiosity
notes.

**Three new believable resident behaviours**, each layered directly into
the existing weighted location-merge mechanism, not a new decision system
on top of it: watching the player work (a plain proximity check),
remaining near ongoing projects (`activeProjects` pulling toward the
workbench), and becoming quieter at night (a Quiet Corner pull, not a
movement-speed change).

**Lightweight relationships** — a fifth `ResidentPreferences` affinity
bag tracking which Beings Bubble has genuinely spent time near, using the
identical `bump()`/`favourite()` mechanism every other preference
dimension already uses.

**Player habits, extended** — `PlayerPatternMemory` gained a third bag,
distinguishing "usual visiting hours" from genuine "usual working hours"
(only bumped when the player is in a working zone specifically).

## Version 2 — Phase 11 — Atmosphere (v2.1.1)

**Goal:** "The Workshop now understands the world around it. Now it
needs to understand atmosphere... this phase is NOT about simply adding
more weather effects. It is about teaching the Workshop how to breathe."
See `docs/ATMOSPHERE.md` for the full write-up.

**A richer, real-astronomy sky** — `TimeOfDaySystem`'s own sky colour
moved from a flat two-stop blend to `SKY_GRADIENT`, an eight-stop table
keyed by the sun's real altitude (`MathUtils.sampleColorGradient()`, a
small generalisation of the existing `lerpColorHex`) — night, blue hour,
civil twilight, dawn/dusk, golden hour, and day, correct for sunrise
*and* sunset, at any latitude or season, from one ordered list.

**Two cloud layers, better lit.** `WorldEnvironmentSystem._buildClouds()`
now builds a low, denser field and a second, higher, sparser, faster-
drifting one from a shared helper; every cloud's own material colour now
tints toward the sky's current hue and the weather's own tint
(`_updateCloudTint()`) instead of staying flat white regardless of
conditions. Cloud cover now also dims stars and the moon together
(`_applyCelestialVisibility()`), and a small, standalone "morning mist"
contribution (`_dawnMistStrength()`) layers into the fog calculation
around sunrise, independent of any weather state.

**A real indoor/outdoor audio split.** `AudioSystem` gained a Location
layer — two shared lowpass filters, checked against `InteriorSystem
.isInside()` on a slow throttle, with a per-ambience-type indoor gain
multiplier (rain stays close and present; wind is heavily buried; storm
sits between) rather than one flat muffle for everything. The wind/storm
ambience's own filter cutoff now also breathes with live `windSpeed`
between throttled checks — "wind through trees," pulled directly from
`EnvironmentSystem` since its own gust wobble updates every frame but
doesn't re-emit an event for it.

**Four-phase nature audio.** `AudioSynth.createNatureAmbience()` grew
from a flat day/night pair into dawn (a denser, brighter bird chorus),
day (unchanged), dusk (a new, warmer, lower insect trill mixed with the
occasional dimmer bird call), and night (the original cricket trill,
deliberately untouched) — all four sharing exactly two parameterised
synthesis functions rather than four independent ones.

**Season Foundations, real but deliberately inert.**
`Astronomy.getSeason(dayOfYear, latitude)` — a pure function, no new
state, no migration — is the entire foundation this phase asks for,
surfaced in `WorldAwareness.snapshot().season` and a read-only Atmosphere
tab row (plus a quiet mention in the window's own summary line). Nothing
currently changes because of the season; that's honestly next phase's
problem.

**Atmosphere Profiles, a real save/apply workflow.**
`AtmosphereProfileStore.js` follows the identical "permanent built-in
set in code, user profiles in the mutable store" shape
`AnimationLibraryStore.js` already established — six built-ins (Sunny
Morning, Golden Evening, Storm, Fog, Winter Morning, Summer Afternoon)
plus anything a person saves themselves, all applied through the exact
same `setWeather()`/`setManualOverride()`/`setTime()` calls the
Atmosphere tab's other controls already use. The tab itself leads with
Profiles now — a creative starting point ahead of the detailed live
read-out already there.

**Living World, extended once more onto the same mechanism.** A windy
day now also counts as "worth watching" from the window
(`ResidentController._windowWatchWeights()`), and a storm specifically
pulls toward the Quiet Corner — sheltering, reusing the identical pull
night already established. See `docs/RESIDENT.md`'s own "Resident
awareness, extended" section.

## Version 2 — Phase 12 — Plugin SDK (v2.1.2)

**Goal:** "The Workshop is now a mature platform. It is time to allow
other creators to build on top of it... by the end of this phase a
developer should be capable of extending the Workshop without modifying
the Workshop itself." See `docs/PLUGIN_SDK.md` for the full write-up.

**A unified `Workshop` facade, built on top of what already existed, not
a replacement for it.** `WorkshopSDK.js` wraps `PageRegistry`,
`AssetService`, the Phone/Computer app registries, `ServiceRegistry`,
and the Construction Library — none of which changed shape. A plugin now
needs one `{manifest, setup(Workshop)}` shape and one loader call
(`loadWorkshopPlugin()`) instead of learning each registry individually;
the two original plugin contracts (`engine.plugins`,
`hostManager.pluginRegistry`) remain fully supported, completely
unchanged, for anything already written against them.

**A real manifest and validation.** `PluginManifest.js` — required
`id`/`name`/`version`, an optional `permissions` array checked against a
real capability vocabulary, and a simple semver-lite
`minWorkshopVersion` check that warns rather than blocks. A plugin with
an invalid manifest is refused with a specific, actionable error before
its own code ever runs.

**Real per-plugin permissions.** `PluginPermissions.js` — a plugin's
declared capabilities are auto-granted (there's no real sandbox to gate
same-origin code behind; a blocking install prompt would be theatre),
but genuinely revocable from `host://plugins`, and every `Workshop.*`
method checks `isGranted()` before doing anything. `Workshop.storage` is
the one capability never gated — isolated per plugin by construction,
nothing shared for a grant to protect it from.

**The Workshop remains stable even when a plugin fails.** Every call
into a plugin's own code now funnels through `PluginManager._safeCall()`
— a thrown error is caught, logged clearly, and marks that one plugin
`"error"`, rather than taking down `engine.init()` or the frame loop.
Real Enable/Disable/Reload joined the original `init`/`dispose` pair,
with the SDK's own automatic disposal (pages, asset kinds, event
listeners) making a reload genuinely clean for anything registered
through it.

**A real, interactive Plugin Manager.** `host://plugins` now shows live
status (active/disabled/error, with the actual error), manifest
metadata, and per-plugin permission checkboxes, alongside genuine
Enable/Disable/Reload buttons — the identical `postMessage` pattern
`host://permissions`' own checkboxes already established.

**One polished reference example**, `workshopToolkitPlugin.js` —
registers a Browser page, a Builder asset (a genuinely placeable
signpost), a Phone app (with a real `Workshop.storage`-backed personal
note), and a Host service, plus an optional `Workshop.lifecycle()` pair,
all through the manifest + `setup(Workshop)` shape. The two original
example plugins are untouched, still demonstrating the contracts the SDK
is built on top of directly.

**Two small, honest lifecycle additions to registries that needed them**
— `AssetService.unregisterKind()` and
`ConstructionLibrary.registerConstructionPiece()`/
`unregisterConstructionPiece()` — both new, both small, both required
for a plugin's own assets and Builder pieces to genuinely disappear on
disable rather than lingering as dangling entries.

**Honest, deliberate scope boundaries** — Phone/Computer app
registrations can't be cleanly undone (both registries build their app
list once, at startup); no dynamic install/uninstall flow; no plugin
dependency resolution; `registerBehaviour()` isn't wrapped by the SDK
yet; Resident/Automation/Hardware capabilities remain architecture-only,
matching their Host-level equivalents' own honest status. All named
explicitly in `docs/PLUGIN_SDK.md`'s own "Known simplifications" rather
than silently absent.

## Version 2 — Phase 13 — Workshop Reliability (v2.1.3a)

**Goal:** "A polished Workshop is not measured by how many features it
has. It is measured by how confidently those features work... prefer
fixing existing systems over introducing replacements." No new features
this phase — every entry below is a genuine bug traced to a real root
cause, or an honest "investigated, found correct" finding, never a
guess.

**Ladders, actually fixed this time.** An earlier phase correctly fixed
the climbing input-direction math — but the Construction Library's own
"Ladder" piece never carried the `ladder` *behaviour* at all, so
`LadderSystem.registerLadder()` was never called for one. The math was
never wrong; it simply had nothing to run against.

**The fall animation no longer fires on ordinary slopes.**
`CameraSystem`'s own ground-check only ever integrated gravity into the
foot position — it never accounted for the ground height itself
*descending* as the player moved horizontally across a downhill slope,
so any slope at all could read as "the ground fell away" for a frame.
Reuses the existing `STEP_TOLERANCE` budget (already governing how big a
ledge can be stepped *up* onto) for how big a drop still counts as
walking, not falling.

**First-person crouching no longer clips the camera into the player's
own head.** `PlayerCharacterSystem`'s rig-root tracking subtracted the
character's *standing* eye height even while crouched, sinking the rig's
own root below the real foot position by the crouch amount — the same
"feet pushed below the floor" class of bug this project had already
fixed once, for the spawn/load case specifically. Now uses the camera's
live, crouch-aware eye height instead.

**The moon/sun timing was investigated, not "fixed"** — traced by hand
and verified numerically (altitude and rise/set hour, across a full
lunar cycle and several latitudes): the existing phase-based offset
formula is correct. The one time it genuinely does produce a moon
tracking close to the sun is right around an actual real-world new moon,
which is correct behaviour, not a bug. No code changed; the verification
itself is now a comment future maintainers can trust instead of
re-investigating.

**Factory Reset now genuinely resets everything.** Two IndexedDB
databases (`workshop-models`, imported 3D models; `workshop-display-images`,
Display Surface photos) had been silently surviving every "Factory
Reset" since their own systems were added — the reset's own database
list was never updated alongside them.

**Builder reliability**: the Parts dropdown's light-on-transparent
styling went unreadable the moment Firefox opened it with its own native
(light) popup background — fixed with explicit `<option>` colours, and
the identical latent bug fixed in the two other places it existed. The
Builder Phone's own horizontal scrollbar traced to `<input
type="range">`'s un-shrinkable default width inside narrow flex rows —
`min-width: 0` is the standard fix, applied everywhere the pattern
existed, plus `overflow-x: hidden` as defense in depth.

**The workbench's mystery cylinder** — the tool tray's own handles,
overlapping both each other and the standalone Notebook prop's exact
footprint. Repaired (shortened, repositioned), not removed — "tools live
here" is a real, still-wanted detail.

**Terrain: one system, one ground, at last.** The biggest single change
this phase — `WorldEnvironmentSystem`'s separate flat, infinitely-
recentring ground is gone entirely. `TerrainSystem.js` is now the
Workshop's one and only ground: the editable patch grew from 48m to
200m (resolution eased from 1m to 2m to keep the vertex count
reasonable), a large non-editable "skirt" (a `THREE.Shape` with a
same-sized hole cut out, zero overlap, zero z-fighting) fills everything
beyond it, and the mismatched height offset between the old patch and
the old ground is gone — the only offset left is the small, legitimate
one keeping the outdoor ground from z-fighting the interior floor.
Object placement (`BuildModeSystem._gatherSurfaces()`) now raycasts the
real terrain instead of the old flat ground, so a ghost placed over a
sculpted hill finally lands on it. Existing saves migrate automatically
— a save's old 49×49 heightmap is bilinearly resampled onto the new
101×101 grid at the exact real-world positions it always occupied.

**Architectural review: a real dead-code bug found and fixed.** Twelve
Construction Library piece ids (every Nature and Paths piece) had been
defined *twice* in the same array — an older, plainer, non-wind-swaying
set that was never removed when a richer, wind-animated set replaced it.
`getConstructionPiece()`'s `.find()` always resolved to the older set,
meaning the wind-sway work from the World Builder phase had been
completely unreachable, silently, ever since. The older set is now
gone; every Tree, Bush, Flower, and Path tile placed from the
Construction Library finally uses the intended, richer version.

## Version 2 — Phase 13b — Workshop Workflow (v2.1.3b)

**Goal:** "Good software is not measured by how many features it
contains. It is measured by how naturally those features fit together...
players should spend their time creating rather than searching for
settings or remembering where features are located." Documentation,
import/export, one completed Builder capability, terrain usability, and
consistency — no new systems, no redesigned architecture.

**The README, genuinely simplified.** 869 lines down to under 470 — the
full phase-by-phase changelog, the "One contribution" essay, and the
"Reflecting, after thirty-one phases" reflection all moved to a new
`docs/HISTORY.md`, preserved in full rather than deleted. A real,
previously-undocumented duplication (near-identical "Quick start" and
"Running it locally" sections) merged into one. Several genuinely
outdated claims corrected — a Construction Library piece count last
accurate at 30 pieces (now around fifty, with three groups — Nature,
Paths, Lighting — added since and never mentioned), "no trees, no
scenery" outside (the World Builder phase's real terrain and Nature
pieces existed for phases already), "mirrors and animation are all
explicitly future work" (both existed too), and the HUD's own
Export/Import buttons still being described in their old location.

**A complete Workshop setup guide**, `docs/SETUP.md` — installing
Ollama, a real recommended-models table, what the PowerShell launcher
script actually does and why it's needed (Ollama's own CORS policy, not
a Workshop limitation), how the entirely separate Workshop Host
Companion relates to it, and a genuine troubleshooting section for the
handful of ways a local AI connection actually fails in practice.

**Import/export, made consistent throughout.** Both the whole-Workshop
backup and a new single-AI-profile export/import (`ResidentProfileStore
.exportProfile()`/`importProfile()`, entirely new this phase — "AI
Profile Export. AI Profile Import. Profile sharing") now share one
shape: a `type` field so each importer recognises the *other* kind of
export by name instead of failing to parse it, validation before
touching anything, a version-compatibility warning for a backup newer
than the running Workshop understands, and profile import normalising
through the exact same functions a save's own restore path already
trusts. See `docs/PERSISTENCE.md`'s own "Import & Export" section.

**Settings reorganisation.** The Workshop-wide Export/Import Backup
controls moved from two permanent buttons on the main HUD into Settings'
own new "Workshop Data" section (General tab) — ordinary data
management, not something that needs to be always on screen. The HUD's
remaining corner buttons (mode toggles, not data controls) were renamed
`.hud-corner-controls`, accurately, from the now-inaccurate
`.hud-backup-controls`.

**The Builder can import its own models now.** The one remaining
capability named for this phase: `BuildModeSystem.importModel()`, the
identical `.glb`/`.gltf` handling the Being Creator's own Model section
already used, reached from a new "Import Model" button directly in the
Builder Phone's own Imported Models tab — no more detour through a
different app for a capability that was always meant to be shared
Workshop-wide. See `docs/WORLDBUILDER.md`'s own "A third source:
Imported Models" section.

**Terrain, more approachable — usability, not architecture.** A live
brush preview ring now follows the cursor the moment a terrain tool is
armed, sized to the real brush radius and tinted to the active paint
material, well before a stroke actually begins — there was previously no
way to see where a brush would land or how large an area it covered
until committing to a drag.

**Architectural review: real findings, fixed within scope.** A stale
"49×49 vertices... under 5,000 numbers" comment (already 101×101 since
the Reliability phase) corrected; the HUD's own container renamed for
accuracy; a genuinely redundant pair of README sections merged; several
outdated documentation claims (see above) corrected at the source rather
than left to compound further.

## Version 2 — Phase 13c — Workshop Personality (v2.1.3c)

**Goal:** "Bubble has now become the Workshop's first true resident. It
deserves a visual identity that reflects that role... by the end of this
phase, Bubble should no longer feel like the Workshop's first AI... it
should feel like the Workshop's first resident."

**Eight expressions, one canonical source.** `ExpressionTypes.js` —
id, label, description — is now what `ResidentBehaviour.EXPRESSIONS`
derives from, rather than a second, parallel list. The original five
(`content` renamed `neutral`, matching the brief's own naming) are
joined by `excited` (a real trigger: `ResidentDials.js`'s own
Playfulness × Energy bump), and `sad`/`surprised` (available
everywhere — drawable, previewable, exportable — but honestly left
without a forced, unmotivated automatic trigger).

**A genuine Expression Creator**, inside AI Mission Control's own
Expressions section: a `<canvas>` pixel grid, pointer-drag painting
treated as one continuous stroke, a colour picker plus preset swatches,
Pencil/Eraser, Clear, Reset to Default, and a real "Import Image…" that
downsamples any picked image into pixel art. `ExpressionSetStore.js`
holds what gets drawn — a named collection, one 16×16 grid per
expression actually drawn, needing none of the eight to be complete
(anything left blank quietly falls back to the original built-in
procedural drawing for just that one expression).

**Expression Sets are real Workshop Assets** — registered as the
`"expressions"` `AssetService` kind, with a genuinely new kind of
thumbnail (`buildPixelThumbnail()`, rendering a set's own actual
drawn pixels as small SVG rectangles, not an abstract colour swatch)
and export/import following the identical `type`-tagged, validated,
always-additive shape the Workshop Workflow phase's own AI Profile
export already established — see `docs/PERSISTENCE.md`'s own "Import &
Export" section, now covering all three kinds together.

**The reference implementation for shared resident architecture.**
`ResidentProfileStore.js` gained `expressionSetId` — a plain per-profile
reference, resolved by `ResidentController._onProfileChanged()` the
identical way `provider`/`model` already are, falling back cleanly to
the built-in look for `"default"` or for a reference that no longer
resolves to anything real. A future second resident's own profile needs
nothing new to carry its own expression set the same way.

**A real, contained rendering improvement.** Expression changes now
cross-fade (160ms, the face mesh easing to invisible, swapping texture
and mood colour together at the exact midpoint, easing back in) instead
of swapping instantly — "expressions should transition smoothly and
feel subtle rather than exaggerated," true for the first time at the
rendering level, not just in how each expression is individually drawn.

**Architectural review**: fixed a stale "mood only ever picks among
content/curious/happy" documentation claim (now neutral/curious/happy/
excited); corrected asset-kind counts in `docs/ASSETS.md` that would
have gone stale again next phase, rephrased to describe the pattern
rather than a brittle exact count.

## Version 2 — Phase 14 — Diagnostics (v2.1.4)

**Goal:** "Not a traditional developer debug menu... a Workshop Control
Centre. By the end of this phase the Workshop should be capable of
monitoring, explaining and diagnosing its own health. The player should
no longer need to rely on browser developer tools to understand what
the Workshop is doing." See `docs/DIAGNOSTICS.md` for the full account.

**Real, computed Workshop Health**, not manually assigned. Every
subsystem in `DiagnosticsService.getReport()` now derives its own
health level (`healthy`/`warning`/`error`/`unavailable`) from an actual
check against real state — a failed save, a plugin in an error state, a
genuinely broken asset reference, a disconnected optional AI/Host
connection. The overall banner is the worst of all of them, with one
deliberate exception: `unavailable` (an optional feature simply not in
use) never drags the overall colour down on its own.

**Two real gaps found and fixed while building this.** A failed
`PersistenceSystem.save()` used to be entirely silent — now tracked
(`lastSaveFailedAt`) and announced (`"persistence:saveFailed"`).
`PluginManager._safeCall()` used to record a plugin's own failure only
in a private status map — now also emits a real `"plugin:error"` event,
the first genuinely new signal this phase's own Workshop Event Log
listens for.

**A new technical Workshop Event Log** (`WorkshopEventLog.js`), the
deliberate technical counterpart to the existing world-flavoured
`WorldEventLog.js`, not a merge of the two — plugin errors, connection
changes, save failures, with real filtering, searching, and export.
Kept separate specifically so Bubble's own curiosity never has to
filter technical noise back out of its own context.

**Expanded diagnostics across the board** — `AIConnectionManager.js`
gained `lastSuccessAt`/`lastFailureAt`; `ResidentController
.getDiagnostics()` gathers behaviour/mood/conversation/navigation state
into one flat object, the identical shape `WorldAwareness.snapshot()`
already established, ready for a future second resident; `AssetService
.validateAll()` finds genuinely broken references and duplicates across
the whole Library in one pass, deliberately not counting the ordinary
"no thumbnail" gap nearly every asset already has as a health problem.

**`workshop://diagnostics` rebuilt as the real Control Centre** — one
colour-coded overall banner, a plain-language line per subsystem, and
every deeper technical detail behind a native `<details>` element,
closed by default. "A casual user should immediately understand whether
the Workshop is healthy. An advanced user should be capable of
expanding sections" is true by construction, one page, not two. A real
"Run Workshop Health Check" button actively re-checks AI/Host
connections before rebuilding the report; Suggested Fixes name the
exact plugin, asset, or cause rather than a generic failure message; a
small, honest, hand-authored Dependency Awareness section explains how
systems rely on each other.

**Settings' own Diagnostics tab simplified**, not duplicated — what's
left is specifically what's useful *while adjusting Settings itself*
(live FPS/frame time/memory, next to the Graphics/Performance controls
that affect them) plus one health line and a pointer to the real
Control Centre, replacing what used to be a second, independently
computed copy of Environment/Player/Resident/Connection status.

## Version 2 — Phase 15 — The Workbench (v2.1.5)

**Goal:** "The Workbench is the heart of the Workshop... it should
become the Workshop's hero prop... refine, do not redesign." No new
systems, no repositioned fixtures — every improvement is craftsmanship
on the exact same object, at the exact same footprint and height. See
`docs/WORKBENCH.md`'s own "Craftsmanship" section for the full account.

**A genuinely richer wood grain, on exactly the one surface that
deserves it.** `woodGrainTexture()` gained optional `size`/`grainLines`/
`step` parameters, defaulting to the original values — every other wood
object in the Workshop is completely unaffected — so the bench's own
top (the one surface a player leans directly over) could get a
512px/70-line texture instead of `Materials.wood()`'s own shared
256px/40-line default, without risking the visible tiling seam a higher
`.repeat` value on the existing texture would have introduced.

**Two real material gaps filled in `PlaceholderFactory.js` itself** —
`Materials.plastic()` and `Materials.rubber()`, reusable by any future
furniture, not one-off. Applied wherever the bench already had something
that was always plastic or rubber in real life but had been sharing
`matte()`'s own numbers regardless: the fan's base/housing/blades, the
clipboard's own board, and the standalone Notebook's elastic closure
band (whose cloth cover became genuine `fabric()` at the same time).

**Real structural additions**: a stretcher rail between the legs (sized
to actually reach and overlap them, not float with a gap), and a small
crank on the vice — the one addition that makes it read unmistakably as
"a vice" rather than "two metal boxes," without touching its footprint.

**One small, deliberately restrained storytelling detail** — a single
pencil resting on the clipboard, not a scatter of stationery that would
read as staged clutter rather than a genuine momentary pause.

**A real geometric bug found and fixed**: the clipboard assembly's own
front edge sat 7cm past the bench's actual edge, quietly overhanging
thin air since the feature was built. Pulled back as one unit, with
`WorkbenchSystem`'s own panel projection needing no changes at all,
since it only ever reads the clipboard mesh's live world transform.

**The Workshop's first interaction sound effect**, and a real dead
setting fixed along the way. `AudioSystem.playInteractionSound()` — one
small, reusable entry point for any future one-shot sound, not a
Workbench-specific one-off — plays a soft paper shuffle
(`AudioSynth.playPaperShuffle()`) on leaning in and standing up, at two
different pitches. Settings' own "Effects Volume" slider had existed
since early in Version 2 with nothing in the entire Workshop for it to
control; it now genuinely does.

**Lighting response and interaction pose both reviewed, not changed** —
every bench material already used correct PBR properties that already
respond properly to the day/night cycle and the lamp's own real light;
the existing lean-in camera pose was found to already read naturally
against the corrected clipboard position, if anything slightly better
aligned than before. Confirming something is already right is as
legitimate an outcome of a craftsmanship pass as changing something.

**A second dead-code finding, verified and fixed on a follow-up review
pass.** `Materials.ground()` and its own `groundTexture()` — the flat
ground `WorldEnvironmentSystem.js` drew before the Workshop Reliability
phase's terrain migration — had no callers left at all, silently
orphaned in `PlaceholderFactory.js` (the exact file this phase's own
new `plastic()`/`rubber()` materials live in) since that earlier phase.
Removed cleanly.

## Version 2 — Phase 16 — The Desk (v2.1.6)

**Goal:** "This phase shifts focus to the Workshop's command centre...
sitting down at the Desk should feel like sitting down at a real
creative workspace." A second craftsmanship pass, following the
Workbench's own template: no new systems, no repositioned fixtures —
every improvement is how convincingly the exact same desk, monitor,
and chair are built. See `docs/COMPUTER.md`'s own "Craftsmanship"
section for the full account.

**A genuinely richer wood grain on the desk's own top**, via a
`deskTopMaterial()` built the identical way the Workbench phase's own
`benchTopMaterial()` was — the same optional `size`/`grainLines`/`step`
parameters on `woodGrainTexture()`, a different tuning, cached once at
module scope. Every other wood surface in the Workshop is unaffected.

**The monitor finally reads as a monitor.** A real bezel sits just
behind the glass — larger on every side so it reads as a frame, not a
flat glowing rectangle — plus a small hinge block at the neck. The
glass itself (`screenGlowMesh`, the mesh `ComputerSystem.js` actually
lights and projects a hardcoded rectangle from) kept its exact original
size and position; the bezel is a second mesh behind it, so nothing
about that projection needed to change.

**Four more real material gaps filled** — the monitor stand, the
keyboard, the mouse, and the lamp shade were all sharing `matte()`'s
own numbers for surfaces that are always moulded plastic in real life;
all four are genuinely `Materials.plastic()` now, and a new rubber
mousepad sits under the mouse.

**Two real structural additions.** Two metal stretcher rails under the
desk, spanning its long axis on each side — the identical "four
independent legs never quite read as one piece of furniture" finding
the Workbench phase made about its own legs. On the chair: a genuine
five-point swivel base with castors, replacing a single flat disc —
the chair's own equivalent of the Workbench vice's crank, the one
addition that makes it read unmistakably as "an office chair." A
mechanism plate, armrests, a thicker seat, and a few degrees of
backrest recline round the chair out.

**One small, deliberately restrained storytelling addition** — a pen
holder with two pens in the desk's back-left corner, placed
specifically to balance the lamp's own back-right corner. The desk's
entire environmental-storytelling budget this phase, held to the same
restraint the Workbench's own single pencil set.

**The Workshop's second interaction sound effect.** A soft chair creak
on sitting down and standing up (`AudioSynth.playChairCreak()`, a
narrower sweeping-bandpass variant of the same noise-burst technique
`playPaperShuffle()` already established), routed through the same
`AudioSystem.playInteractionSound()` entry point via a second `kind`
rather than a second method. Keyboard/mouse sounds were considered and
deliberately left out — the player's own real keyboard already makes
that sound while typing into the panel's text fields.

**Lighting response and interaction pose, both reviewed, not
changed** — every desk material already used correct PBR properties
that already respond to the lamp and the day/night cycle; the existing
sit-down focus pose was checked against every geometry change (a taller
seat, a reclined back, a deeper monitor) and found to already read
naturally, since it's aimed at the screen, which never moved.

**A real architectural finding, resolved.** `PlaceholderFactory
.softBox()` promised a faked bevel in its own docstring but had zero
callers anywhere in the project, and its actual implementation
(stripping a box's index buffer) has no visible effect at all on a
geometry whose faces already carry separate per-face normals — removed
cleanly, the same way `Materials.ground()` was removed last phase.

## Version 2 — Phase 17 — The Workshop Interior (v2.1.7)

**Goal:** "It is time to refine the Workshop itself... by the end of
this phase, the Workshop should feel like a real building that has
existed for years and continues to be cared for every day." The
Workbench and Desk phases' own template, scaled from one piece of
furniture up to the room shell: no new systems, no repositioned walls
or fixtures. See `docs/WORLD.md`'s own "Craftsmanship" section for the
full account.

**Baseboards on all four walls** — the single largest gap this phase
found, resolved by reusing `buildWallWithOpenings()`'s own
opening-slicing rather than a second, hand-tuned gap: the south wall's
baseboard is given the identical door opening the wall itself was built
with, so it can never drift out of sync with the real doorway.

**A protruding interior sill under each window**, real hinge plates on
the front doors, and a ceiling canopy plate where each pendant's cord
meets the ceiling — three small hardware/trim details in the same
family as the Desk phase's monitor hinge and the Workbench's vice
crank: the kind of detail that makes an object read as genuinely built,
not modelled.

**The Workshop's first wall-mounted lights** — sconces flanking the
front doors, built exactly like the existing ceiling sockets and
attached through the identical `LightingSystem.registerPracticalLight`
mechanism every other practical fixture already uses. No new lighting
system; one more pair of fixtures through the one that already existed.

**The light switch now switches** — a real toggle nub, physically
tilting between on and off, driven by the same `lightsOn` state
everything else already reacts to; the plate itself is genuinely
`Materials.plastic()` now rather than sharing `matte()`'s numbers.

**The Workshop's third interaction sound effect** — a soft creak on
opening and closing the front doors, lower and slower than the Desk
phase's chair creak, routed through the same `playInteractionSound()`
entry point via a third `kind`.

**Two real findings, resolved.** `ToolStorage.js`'s screwdriver handle
was sharing `matte()`'s numbers for something that's always plastic or
rubber in real life. And in `Shelving.js`: a genuinely varied colour
palette (`placeholderColors`) sat completely unused behind a `void`
statement while a near-identical set of wood browns did double duty as
the book/box colours instead — rather than deleting the orphaned array,
each one got a real, distinct purpose: the varied palette now colours
the books and boxes, and the wood-tone array now varies each shelf
board's own tint.

**Environmental audio reviewed, not expanded** — room ambience, rain
response, and indoor/outdoor muffling were already substantially built
out in the Atmosphere phase and confirmed still correct. An ambient
"building creak" independent of any interaction was considered and
deliberately deferred: every existing interaction sound in the Workshop
has a clear cause a player can connect it to, and this would be the
first without one.

## Version 2 — Phase 18 — Furniture & Storage (v2.1.8)

**Goal:** "Every piece of furniture and storage within the Workshop
should feel practical, intentional and genuinely useful." The fourth
craftsmanship phase, and the first to span several objects rather than
one — Shelving, Tool Storage, the Pinboard, the Wardrobe, the Sitting
Area, and a material-only review of the already-redesigned Music
Cabinet. See the new `docs/FURNITURE.md` — a dedicated doc for general
furniture that never had one before this phase — for the full account.

**Tool storage's shadow-board silhouettes** — the phase's single most
on-theme addition: each of the three pegboard tools now hangs in front
of a painted silhouette patch, so an empty hook would read as "the
wrench is out" rather than just an empty hook. The middle drawer sits
pulled open a few centimetres, as if just used.

**Shelving gained a run of labelled storage bins** on the shelf at the
easiest reach height, plus a cap trim in the same family as the
Interior phase's own baseboards. A real dead-code finding along the
way: `itemColors` — a genuinely varied palette — sat completely unused
behind a `void` statement while a near-identical set of wood browns did
its job instead; both arrays got a real, distinct purpose rather than
one being deleted.

**A new material**: `Materials.cork()` and its own `corkTexture()`,
built the same way `concreteTexture()` already is, replace the
pinboard's flat matte tint. Each pinned note now has a real push pin
holding it up.

**The wardrobe gained a cornice and real raised door panels** — the
same "this reads as real, built furniture" standard the cornice trim
and door panels apply consistently across this phase's objects.

**The sitting area gained a cushion tier, a proper table foot, and one
book** — "environmental storytelling," held to the same one-detail
restraint the Workbench's pencil and the Desk's pen holder already set.

**The music cabinet, reviewed rather than rebuilt** — already given its
own dedicated redesign in an earlier phase; this pass found two real
material gaps (a vinyl record and speaker cone surrounds that were
`matte()` instead of `plastic()`/`rubber()`) and left everything else
alone.

**A drawer/cabinet interaction sound was considered and deliberately
left out** — tool storage has no dedicated system of its own the way
the computer, workbench, and front doors do, so adding one here would
have meant either a new system (explicitly out of scope) or a
furniture file reaching directly into `AudioSystem`, breaking the
"furniture describes geometry; systems own behaviour" split every other
object in the project respects.

## Version 2 — Phase 19 — Decorative Details (v2.1.9)

**Goal:** "If this object disappeared tomorrow, would the Workshop lose
a tiny piece of its personality? If the answer is no, reconsider why it
exists." The smallest-scoped craftsmanship phase yet, by design — three
new additions total across the whole room, each chosen specifically to
pass that test rather than an attempt to decorate every surface the
brief's own examples named. See `docs/WORLD.md`'s own "Craftsmanship
(Version 2, Phase 19)" section for the full account.

**A wall clock — the Workshop's first genuinely time-driven
decoration.** Mounted between the two north windows, its hour and
minute hands are real pivot groups rotated by a new
`LightingSystem._updateClockHands()`, driven by the exact same `hour`
value `TimeOfDaySystem` already broadcasts for the sun. No new system,
no new event — one more consumer of a value that already existed.

**One small plant on one window sill** (not both — a matching pair
reads as decorated, not lived-in) and **one small framed sketch** on
the south wall, reusing `Materials.sketchPaper()` rather than a second
way to suggest hand-drawn paper.

**A real material gap, named directly in this phase's own brief:**
`Materials.ceramic()` joins the Workshop's growing material set —
every plant pot in the Workshop (the new one, and the music cabinet's
existing one) was sharing `matte()`'s numbers for a surface that's
almost always glazed ceramic in real life.

**An architectural-review pass, confirmed rather than changed** — every
material factory and texture function was checked for real callers;
nothing new turned up. The Builder's own `DecorationBehaviour.js` was
reviewed and found already exactly as honest as it should be.

**A ticking clock sound was considered and deliberately left out** —
a continuous ambient sound needs real 3D positional audio to be
believable at different distances, which nothing in `AudioSystem`
currently provides; every existing ambience is global (weather,
nature) rather than tied to one object's own position. Left for
whichever future phase actually introduces positional audio, rather
than shipped as an always-on sound with no way to make it sound right.

## Version 2 — Phase 20 — Visual Identity (v2.2.0)

**Goal:** "Every screenshot should immediately look like The Workshop...
the objective is not photorealism, the objective is recognisability."
A different kind of phase — a whole-pipeline consistency review plus
two named regressions to actually root-cause, rather than one object or
room. See the new `docs/VISUAL_IDENTITY.md` for the full account, with
fuller per-bug writeups in `docs/WORLD.md` and `docs/PLAYER.md`.

**Shadows, restored to the terrain.** The real cause: `LightingSystem
.init()` sets the sun's shadow camera frustum (`near`/`far`/`left`/
`right`/`top`/`bottom`) as plain properties, but `OrthographicCamera`
never recomputes its own `projectionMatrix` from those unless
`updateProjectionMatrix()` is called explicitly — and nothing in the
codebase ever called it. The shadow camera had been silently running on
its construction-time default frustum (±5m) this entire time; every
"expand shadow coverage" pass in this system's own history changed a
property that nothing ever read. A ±5m frustum pinned to the origin
happened to roughly cover the Workshop's old, small, recentring ground —
once the terrain became one real 200m mesh that doesn't recentre, the
same stale frustum left nearly all of it permanently unshadowed. One
call fixes it, for every future change to those properties too.

**Jumping, fixed at its actual cause.** The terrain phase's own
slope-following logic (`wasGrounded && belowGround <= STEP_TOLERANCE`,
added so walking downhill doesn't trigger a false "falling" state) read
a flag captured *before* the jump-input check that sets it — so on
every jump's first frame, that stale flag still said "grounded," and
the branch silently snapped the player straight back down, zeroed the
jump velocity it had just been given, and cancelled the jump before it
ever rendered a frame. Fixed by reading the current, already-updated
value instead of the stale one; slope-walking behaviour is provably
unaffected, since nothing else changes that value between the two
points in the function.

**A visual-consistency review, confirmed rather than rebuilt** — tone
mapping/exposure/colour space (already `ACESFilmicToneMapping`, applied
uniformly since every render call, including the mirror's own, shares
one renderer instance), every material family's roughness/metalness
banding, the terrain and interior floor's already-matching roughness at
the doorway threshold, and reflection tuning were all checked against
the brief's own list. No new rendering complexity was introduced
anywhere this phase — both fixes are a single corrected line each, plus
documentation.

## Version 2 — Phase 21 — Sound & Presence (v2.2.1)

**Goal:** "The objective is not simply to add more audio. The objective
is to give the Workshop presence... closing your eyes should still
tell you you're inside the Workshop." Three previously-deferred audio
items — each deferred for a specific, named reason — finally had the
right conditions to be resolved properly. See the new `docs/AUDIO.md`
for the complete account.

**Positional audio, the foundation the other three items needed.**
`AudioSystem._computeDistanceGain()` scales an interaction sound's gain
by real distance from an optional world position, reusing the exact
camera-position reference this file already reads for indoor/outdoor
detection. Every existing interaction sound (the clipboard, the chair,
the front doors) now passes its own object's real position, not just
the new ones this phase adds.

**Three deferred items, resolved.** A building creak/settle sound
(deferred in the Workshop Interior phase for lacking a clear cause a
player could connect it to — this phase's own brief names exactly that
behaviour as the *desired* one, which is what makes implementing it now
correct rather than a reversal), a wall-clock chime on the hour
(deferred in Decorative Details for lacking positional audio), and tool
storage's drawer sound (deferred in Furniture & Storage for lacking a
clean architectural seam — resolved via a new generic `soundOnInteract`
field on `FurnitureSystem`, so a future piece gets this for free too).

**Residents gained their first sound.** Bubble had none at all — a
single, very quiet cue on `isThinking` turning true, the smallest sound
in the Workshop's library by design.

**Architectural review, two real findings.** `playPaperShuffle`'s peak
gain (0.5) was noticeably louder than every sound built in later phases
(0.18-0.32) and nobody had gone back to check it — brought down to 0.3.
Four separate hand-copied noise/sweep/envelope implementations
(`chairCreak`, `doorCreak`, `buildingCreak`, `drawerSlide`) were
refactored into one shared `playFilteredNoiseBurst()` helper, every
numeric value preserved exactly.

**Windows and the phone, reviewed and deliberately left silent** —
neither involves any physical motion a sound could represent, and this
phase's own "every sound should earn its place" standard argues against
adding one anyway.

## Version 2 — Phase 22 — Workshop Tools (v2.2.2)

**Goal:** "Features should begin becoming tools instead of applications."
The Workshop's first real tool collection — eleven calculators ported
from a genuine external application, a shared toolbox reachable from the
tool cabinet, the computer, and the Workbench, real project integration,
and the foundations of a Calculator Builder. See the new `docs/TOOLS.md`
for the full account — this phase introduced genuinely new capability,
not a craftsmanship refinement of something that already existed.

**Eleven native calculators**, ported with their real business logic
preserved exactly (`src/tools/NativeCalculators.js`, `maxRects.js`),
grouped into Sales/Manufacturing/Installer — the same categories the
source application's own comments already used. "Do not recreate the
original application's interface" meant leaving behind its IndexedDB
history store, its hand-built form DOM, and its floating quick-calculator
bubble, replaced by one generic, schema-driven form renderer
(`ToolsPanelView.js`) styled to match the rest of the Workshop.

**One shared toolbox, three entry points** — the tool cabinet
(`ToolStorageOverlay.js`), the computer's new Tools app (`ToolsApp.js`),
and a small "Open Tools" button on the Workbench's own clipboard panel —
all calling the identical `mountToolsPanel()`, the same "one
implementation, several physical doors into it" shape `Wardrobe.js`
already established.

**Real project integration.** `ProjectsStore` gained a `calculations`
array and `addCalculation()` — "projects should become long-term records
of how work was completed." Distinct from `ToolsStore.recent`'s own
rolling history of every run (for "quickly reopening previous
calculations") the same way the source application distinguished an
ephemeral history from a deliberate "attach to the job" action.

**The Calculator Builder's foundations** — a hand-rolled arithmetic
formula language (`ToolFormula.js`, never `eval()`/`new Function()`),
six real templates (Basic formula, Material, Area, Percentage,
Conversion, Time), and custom calculators stored the same way
`ObjectLibraryStore` already stores Builder-made objects — the one
precedent for "a Workshop asset," reused rather than reinvented.

**A deliberate architectural decision: no ported Planner.** The source
application's own Kanban job board would have duplicated
`ProjectsStore`'s existing role in the Workshop's own idiom — exactly
the "duplicate functionality" this phase's own Architectural Review
section asks to watch for. Its most valuable idea (attach a calculation
to a job) is generalised onto projects instead; see `docs/TOOLS.md`'s
own "Why no Planner" for the full reasoning.

**A real finding in the source material, not carried forward.**
`getBuildoutSideDeductions()`, defined in the original `calculators.js`,
had no caller anywhere in that file — dead code in the source itself,
left out of the port rather than faithfully perpetuated.

## Version 2 — Phase 23a — Workshop Refinement, Pass A (v2.2.3a)

**Goal:** "This is the first refinement pass before Version 2 is
considered complete... think like a craftsman rather than a feature
developer." Six real, separately-investigated issues from a named
"Known Issues" list, each root-caused rather than patched around. See
`docs/REFINEMENT.md`'s own "Refinement Pass A" section for the complete
account.

**Factory Reset (and Backup Import, though nobody had reported that one
yet) had a genuine race condition**, not a partial implementation:
`beforeunload`'s own autosave fired during the `window.location.reload()`
both actions trigger themselves, silently re-writing the old in-memory
state back over the just-cleared (or just-imported) `localStorage` a
moment before the reload took effect. A single `_suppressSave` guard,
set before either method does anything else, closes it for both.

**The moon was tracing the mirror-image of its own real cycle** — an
addition that needed to be a subtraction, verified numerically (a
first-quarter moon peaked at 6am instead of the correct 6pm). A previous
investigation had concluded the formula was correct, having tested
specifically the two phase values (0 and 0.5) where the sign error is
mathematically invisible.

**The crouch camera constant never did what its own comment claimed** —
"proportional to the character," while the code subtracted a fixed
0.5m from any standing height. Replaced with a genuine ratio
(`CROUCH_HEIGHT_RATIO`, 0.78), fixing the "camera too far into the
model" complaint for every body proportion at once.

**Ladders had a real detection bug**: the climbable zone was the
ladder's own raw ~8cm-deep visual geometry, with none of the generosity
every other interaction zone in the Workshop already holds itself to.
Padded out to a genuinely walkable zone. The underlying "ladders don't
function" bug was already fixed in an earlier phase; this pass also
documents the intended interaction plainly (walk in, hold forward/back,
no key prompt) for anyone still unsure whether past reports were bugs,
design ambiguity, or user error.

**AI keep-alive**: the timeout was never the actual problem — it was
already a generous 180 seconds. `AIConnectionManager` now warms the
active profile's model proactively and keeps it warm on a recurring
ping inside Ollama's own unload window, with a real, persisted,
user-facing toggle in Mission Control. AI profile export/import was
reviewed and found already complete, capturing every meaningful field
while deliberately excluding anything that would make a shared profile
less than fully portable, or an import destructive.

**The startup experience could look completely frozen** — the entry
button had no click handler at all until the entire boot sequence
finished. Now wired immediately, with instant visual feedback and a
gentle status line, entering automatically the moment boot completes if
pressed early. Starting the render loop itself earlier (for an
atmospheric background behind the loading screen) was considered and
deliberately left for a future pass that can actually verify it renders
cleanly.

## Version 2 — Phase 23b — Interface & Design Refinement (v2.2.3b)

**Goal:** "Pursue visual harmony, not visual uniformity." The second
refinement pass — a craftsmanship pass on the Workshop's own interface.
Physical interfaces (Workbench, Pinboard, notes) deliberately keep
their own material identity; this phase unified the shared plumbing
underneath the digital interfaces, and gave the Phone the complete
treatment its own brief specifically named. See the new
`docs/DESIGN_SYSTEM.md` for the full account, and `docs/PHONE.md`'s own
new "Craftsmanship" section for the phone specifically.

**A real gap in the design tokens, found and closed.** Despite an
already-solid token system (palette, type scale, spacing, motion),
shadows had no shared tokens at all — three separate files hardcoded
the *exact same* shadow value byte for byte, one with an accidental
60px/70px drift from the other two. A small, real shadow scale now
exists, plus `--radius-xl`/`--radius-pill` for two genuine gaps the
Phone's own redesign needed, with several exact-match hardcoded values
elsewhere swept to reference the shared tokens instead. A scripted
sweep of every `var(--...)` reference against what `tokens.css`
actually defines also turned up a real, previously-invisible bug: the
Phone's own header buttons referenced a token (`--text-base`) that had
never existed anywhere, silently falling back to inherited sizing
rather than any deliberately-chosen one.

**The Workshop Phone got the complete shell refinement its own brief
named** — a real status bar (the Workshop's own current time, not a
fabricated one), a home indicator, refined proportions and case, real
icon tiles instead of bordered boxes, slightly denser content padding
— while staying wood and brass rather than becoming a generic glass
case, "its own identity while remaining clearly part of the Workshop."

**The named Builder overflow bug, root-caused.** "Additional options
push the interface wider than its container" traced to a specific
cause: a row that conditionally grows from two fields to three (a
"Segments" field, only for cylinder/sphere/cone parts) with no
`flex-wrap` to catch it. Fixed with wrapping plus a real minimum basis
per field, and a broader sweep confirmed similar "row" patterns
elsewhere were already either fixed-content or already wrapping.

**Digital interfaces, reviewed and confirmed largely consistent
already** — shared tab-bar and form-control patterns are already
genuinely reused across Settings, AI Mission Control, the Tools app,
the Builder, Wardrobe, and the Animation Editor, not just superficially
similar-looking. This phase closed the real gaps found during that
review rather than rebuilding a system that was already mostly working.

## Version 2 — Phase 23c — Final Review & Version 2 Sign-Off (v2.2.3c)

**Goal:** the final engineering phase of Version 2 — "review the
Workshop as though you inherited it from another engineering team."
A complete codebase audit, not a targeted fix list. See
`docs/REFINEMENT.md`'s own "Version 2 Sign-Off" section for the full
technical account, and `docs/HISTORY.md`'s own retrospective and
handover notes for the rest.

**A scripted dead-code audit** — every exported name in `src/` checked
against every other file for an actual reference, 437 exports checked,
24 flagged, each verified by hand rather than trusted blindly. Three
genuinely dead exports removed (`PageRegistry.schemeOf()`,
`DiagnosticsService.HEALTH_LEVELS`, `PlaceholderFactory
.computeFootprint()`), each with the same tell earlier phases' own
dead-code finds already established: a docstring claiming an
integration that checking directly showed never existed. Two flagged
exports (`solveTwoBoneIK()`, `IDENTITY_PLAYER_SKELETON_MAP`) turned out
to be deliberate, explicitly-documented forward-looking infrastructure
and were left alone on purpose — not everything unused is a mistake.

**Documentation staleness, found and fixed** — `assets/README.md`
claiming zero binary assets when four PWA icons already existed, and a
cross-reference in `docs/RESIDENT.md` still pointing at "the README's
own" section for writing that had moved to `docs/HISTORY.md` phases
ago. `docs/ARCHITECTURE.md`'s own docs index was checked directly
against the `docs/` folder — accurate.

**Naming, reviewed and deliberately preserved** — "App" terminology is
genuinely consistent across roughly fifteen files; a rename would be
real churn for a subjective preference, exactly what this phase's own
brief warned against choosing over stability.

**The One Contribution** — a wall clock and its hourly chime
(Decorative Details, Sound & Presence) had coexisted with Bubble's own
wandering for two entire phases without ever acknowledging each other.
A new idle location, `besideClock`, and a gentle pull toward it within
a few minutes of the hour turning over — reusing the exact
`weights`-based mechanism the *end of Version 1's own* One Contribution
left behind specifically for a future signal like this one. Never
guaranteed; on the occasions it lines up, a resident already looking at
the clock the moment it chimes is newly *possible*, where it simply
couldn't have happened before.

## Version 2 — Phase 23d — Independent Release Review (v2.2.3d)

**Goal:** one final review before Version 2 is considered complete —
performed from an explicitly independent perspective ("you are reviewing
another engineer's work"), with fresh sweeps rather than trust in the
sign-off phase's own claims. Full account in `docs/RELEASE_REVIEW.md`;
Version 3 preparation in `CLAUDE.md`, `docs/HANDBOOK.md`, and the draft
`docs/ROADMAP_V3.md`.

**The main finding** — a five-location documentation drift around Build
Mode's migration into the Phone (stale suspension-contract descriptions
in `InteractionSystem.js`, `BuildModeSystem.js`, `main.js`,
`docs/ARCHITECTURE.md`, `docs/WORLDBUILDER.md`, plus the README's
user-facing echo of it), surfaced by an event emit/listen
cross-reference no earlier audit had run. Behaviour was correct the
whole time; the descriptions weren't. All corrected, and the still-
emitted `buildmode:*` events are now honestly labelled as
currently-unheard public signals. Also fixed: the service worker's
drifted shell precache, a stale `css/` listing in the architecture doc,
and a stale caller list in `SimpleMarkdown.js`.

**Reviewed and found already fine** — the persistence architecture's
exclusivity claim, the Factory Reset ordering, every relative import,
every design-token reference, the formula evaluator's safety, and more
— each stated plainly in the review document per the house rule.

**The One Contribution** — `workshop://history`: the Workshop's own
development story readable from inside the Workshop, one `docFilePage()`
registration plus a three-tag `<details>` whitelist in SimpleMarkdown.
A place with a memory now includes itself in it.

**The release verdict** — yes. See `docs/RELEASE_REVIEW.md` for the
full reasoning.

## Version 3 — Phase 1 — Completing Promises (v3.0.1)

**Goal:** wire in the forward-looking infrastructure Version 2 explicitly
built and left waiting, before any new Version 3 foundations are laid —
"believable contact with the world," and closing out a handful of core
interaction systems named as never quite reaching the quality bar of a
finished mechanic. See `docs/ROADMAP_V3.md`'s own Phase 1 entry for the
original brief.

**Crouch, the camera/mesh mismatch fixed at its actual root cause.**
Two earlier fixes (Workshop Reliability's root-tracking fix, Refinement
Pass A's `CROUCH_HEIGHT_RATIO`) were both real and both correctly
resolved what they targeted, but neither touched a deeper fact: the rig
has no vertical translation at all — `applyPose()` only ever rotates
pivots. Crouching genuinely eased the camera's own eye height down, but
never moved the mesh, so standing's own coincidental "camera sits inside
the head, backface-culled" trick broke the moment crouching pushed the
camera into the torso instead, leaving the head floating visibly above
it. Fixed without moving any joint (which would have unplanted the feet
from a fixed-hip-height `CROUCH_CLIP`): `FIRST_PERSON_HIDDEN_LAYER`, a
dedicated Three.js render layer, excludes the head mesh from the
first-person camera specifically, toggled by the same `thirdPersonActive`
value `CameraSystem` already computes every frame; mirrors explicitly
re-enable it so reflections keep showing the full character. See
`docs/PLAYER.md`'s own "Crouching" account for the complete technical
story, including the one claim left honestly unverified (whether the
torso stays coincidentally hidden too, at every crouch depth).

**Ladders, reviewed and found already complete.** Version 2's own
changelog named two real, separately-fixed bugs (the Construction Library
piece never carrying the climbing behaviour; an ~8cm hit zone with none
of the generosity every other interaction zone holds itself to).
`docs/ROADMAP_V3.md` still listed ladder traversal as unfinished; a full
investigation, followed by an explicit playtest — a real ladder spawned
through the actual Builder behaviour pipeline, driven frame-by-frame
against the live engine rather than eyeballed — confirmed zone padding,
climb speed, gravity suspension, smooth rung-catching, and exit-by-
walking-away all work exactly as the existing code and docs already
claimed. No code changed. Reported as complete rather than manufacturing
a fix for something that wasn't broken.

**Correction (Version 3, Phase 3b):** this was wrong. The playtest above
verified the climbing mechanics themselves by driving the player's own
position directly — it never actually simulated walking up to a ladder
from a distance, so it never hit the real bug: `WorldObjectsSystem` gave
every Builder-placed ladder a solid walk-collision box like any other
object, which stopped the player before they could ever reach the
climbable zone at all. See Phase 3b's own account below.

**Imported Builder objects, three real gaps closed.** A footprint-timing
race (`WorldObjectsSystem._buildObject3D()` swaps in an imported model's
real geometry asynchronously, but the collision footprint was measured
against the small placeholder capsule immediately beforehand, and never
recomputed once the real model arrived) now recomputes once the swap
actually happens. The colour-override control — shown for imported
models but silently doing nothing, since `colorOverride` is only ever
consumed by the primitive-object compile path — no longer appears for a
selection it can't affect, rather than misleading. The Builder's own
`importModel()` and the Being Creator's own inline import handler, two
independent copies of the same five-step file-import logic, are now one
shared `importModelFile()` in `ModelLibrary.js`. See
`docs/WORLDBUILDER.md`'s own account for the full technical detail.

**Two-Bone IK, wired to a real gameplay case for the first time.**
`TwoBoneIK.solveTwoBoneIK()` had been real, working, tested math with no
caller since the Advanced Animation phase. `src/player/FootIK.js` now
feeds it a real per-foot target — the outdoor sculpted terrain's own
height under each foot, relative to the terrain under the character's
own overall reference point — deliberately scoped to standing still only
(walking is a genuinely different, animation-phase-aware problem, left
for later) and only where `TerrainSystem` actually has height data.
Testing against real sculpted terrain surfaced an honest asymmetry: the
correction is exact when a foot needs to rise, and honestly reach-limited
— not broken, just visibly small — when a foot needs to drop, because the
default idle clip's own authored stance is already at ~99.99% of the
leg's own maximum reach. Named plainly rather than hidden; closing it
fully means retuning the idle clip's own knee bend or a root-height
adjustment in `CameraSystem`, both bigger, separate changes. The resident
hand-rest half of the original brief was deliberately dropped rather than
built toward — Bubble has no rig to target at all, and the brief's own
example was treated as illustrative, not prescriptive, rather than
becoming a reason to give Bubble a body it has no other design reason to
need yet.

**`WorkshopSkeleton.autoMapSkeleton()`, validated end to end with real
files, not only the mock hierarchy it was built against.** Two real,
externally-sourced glTF models — Khronos's own `CesiumMan.glb` reference
asset and three.js's own `Soldier.glb` (a genuine Mixamo export) — went
through the actual import → load → map → spawn → animate pipeline. The
Mixamo-exported model mapped all 14 Workshop joints correctly (`UpLeg`/
`Leg` quirk included) and animated with real, varying rotation under a
real Workshop walk clip; the Khronos asset honestly mapped only 5 of 14
under its own different, legitimate naming convention and was correctly
left unanimated. This testing found one real bug: the Khronos model's
own skeleton container is named `"Armature"` — the standard Blender/
Mixamo/glTF-exporter default label for a rig's own root wrapper — and
`"armature"` contains `"arm"` as a bare substring, misidentifying it as
the character's own upper arm ahead of any real arm bone. Fixed by
excluding a small set of known non-joint container labels from candidacy
entirely, rather than tightening the `"arm"` pattern itself and risking
genuine compound Mixamo names like `"LeftHandIndex1"`. Both test models
are kept in `.claude/test-assets/` (with their own README recording
provenance and licence) for reuse in future testing, rather than
discarded after this one use. See `docs/BEINGS.md`'s and
`docs/ANIMATION.md`'s own "Version 3, Phase 1" accounts for the complete
story.

## Version 3 — Phase 2 — Living Spaces (v3.0.2)

**Goal:** deepen the Workshop's existing rooms until they feel genuinely
lived in rather than simply occupied — refinement, not new systems. See
`docs/ROADMAP_V3.md`'s own Phase 2 entry for the original brief.

**A complete environmental review came first**, room by room and
furniture piece by piece, treating `docs/PRESENCE.md`'s own lens (does
a fix make the Workshop feel more like it exists independently, or more
like something arranged for a visitor) as the standard for every finding.
Several areas — the room shell's baseboards/sconces/clock alignment,
tool storage, the pinboard, the wardrobe, `AtmosphereProfileStore`'s six
built-in profiles, `LightingSystem`'s practical-light tuning — were
checked in comparable depth and found genuinely fine, reported as such
rather than manufacturing findings to look thorough.

**Storage now reads as genuinely stocked, not sparse.** Shelving's own
book-packing loop always started its cursor at the same fixed left
offset, so every shelf's placeholders only ever spanned the first
35-40% of its own width, regardless of shelf index — the shelf's own
usable width now gets filled properly, with the same restrained item
count as before (a placement bug, not a "too few items" one). The music
cabinet's stored vinyl records neither rested on their own shelf nor
cleared the shelf above (a Y-position that was never actually checked
against either boundary) — now rests flush on the real surface below it.
The turntable's own record label was embedded in the vinyl record
rather than resting on it, from a broken incremental Y-offset chain —
now derived directly from the record's own already-correct position
instead of a second, independently hand-computed value.

**The sitting area's side table now has real collision**, closing a gap
`SittingArea.js`'s own footprint comment had honestly labelled but not
actually solved ("small enough to allow minor overlap" — checking the
real numbers found the table sat entirely outside the old footprint, not
overlapping it at all). `FurnitureSystem._computeFootprintBox()` gained
an optional `offset` field — a local-space point a footprint can centre
on instead of the piece's own placement position, for exactly this
"two objects with no shared natural centre" case — defaulting to `[0,0]`
so every other footprint keeps behaving exactly as it always has. The
sitting area's own footprint now tightly covers the real combined bounds
of chair and table, confirmed against the actual built mesh geometry
(13 real meshes, the rug deliberately excluded, since it stays walkable).

**One small, restrained decorative addition**: a cable, not several,
running from behind the computer desk's own monitor stand, along the
desk's back edge, down beside the back-left leg to the floor — the same
"one small detail, not a scatter" standard the pen holder and pencil
already set, closing a gap the Furniture & Storage phase's own
retrospective named and never picked up. A real clipping bug in the
first draft (the cable's own path ran straight through the desk's
stretcher rail, which shares the same z-coordinate as the back legs) was
found and fixed — via real mesh bounding-box overlap checks, not
assumed clear — before it shipped.

**One material-continuity gap closed**: the roof fascia's own dark wood
tone was a distinct, unexplained near-duplicate of the shared trim colour
the door frame, baseboard, and sketch frame all deliberately match —
unified rather than left as an unexplained near-miss.

**Shadow bias, re-verified rather than left an open question
indefinitely.** `docs/VISUAL_IDENTITY.md`'s own "Known limitations" had
flagged since the Visual Identity phase that `bias`/`normalBias` were
only ever tuned against the shadow-frustum bug's stale ±5 extent, never
the real ±13 one now in effect, and that judging it properly needed a
rendered frame. This environment's own screenshot tooling proved
unreliable, so verification used a documented substitute: real rendered
frames read back pixel-by-pixel from the actual WebGL canvas. Tested at
a deliberately extreme ~3.4° grazing sun angle across ten scanlines of
open terrain: zero shadow acne. A real occluder showed one clean, sharp
shadow edge with no banding. The existing values hold up at the current
frustum — no change made, because none was found to be needed. See
`docs/VISUAL_IDENTITY.md`'s own updated account for the complete method.

**Explicitly not attempted, on purpose:** foot-IK during an actual walk
cycle (still idle-only); a manual skeleton-mapping override UI (still
undocumented as absent, unaffected by this phase's own `autoMapSkeleton`
fix); the imported-Builder-object "no behaviours possible" gap the
Phase 1 investigation named — a bigger scope question about whether
imported models should be able to carry Seat/Light/Door-style behaviours
at all, not a small fix; and a pixel-precise measurement of shadow-edge
offset distance, which this pass's own testing method wasn't precise
enough to produce — worth a real screenshot if a visible complaint ever
actually surfaces, not before.

## Version 3 — Phase 3 — The Reading Chair (v3.0.3)

**Goal:** deliver whatever "something calmer" the reading corner was
deliberately reserved for — using content that already exists
(`docs/HISTORY.md`, the finished-project archive) rather than inventing
new content, and resisting the temptation to make the chair a third full
workstation. See `docs/ROADMAP_V3.md`'s own Phase 3 entry for the
original brief.

**Two stacked bugs were kept the sitting area's own `allowLookAround`
focus pose from ever doing what it asked for**, both found by chasing a
playtest report ("I can't click the screen to look around again") rather
than trusted as already working. `FurnitureSystem._resolveFocusPose()`
only ever returned `{position, lookAt}`, silently dropping every other
field a `focusPoseLocal` declared — `SittingArea.js`'s own
`allowLookAround: true` never actually reached the runtime focus pose
`CameraSystem` checks. Fixed by spreading `local` first and only
overwriting the two fields that genuinely need world-space conversion, so
every field passes through honestly now, not just the two anticipated
ones. Even with that fixed, `main.js`'s own canvas click handler and
`PhoneSystem.open()`'s own guard both refused to act while *any*
interaction was active — a check written for the computer/workbench's
fully fixed camera that never distinguished a relaxed, look-around-
permitting pose from theirs. `InteractionSystem` now exposes
`activeAllowsLookAround` as the one shared place that distinction lives,
used by both call sites instead of two independently-maintained copies of
the same condition — see `docs/ARCHITECTURE.md`'s interaction-pipeline
section. The Phone can now be checked while seated in the reading chair
(a genuinely relaxed pose), while still correctly staying closed for
fixed-focus interactions like the computer desk, confirmed for both cases
directly against the live engine rather than assumed from the code alone.

**The sitting area gained its first real behaviour**, using the "narrow"
mechanism the phase's own planning settled on — a button inside the
chair's own reading panel that swaps its content, not a second
interactable or any change to `InteractionSystem`'s own suspension logic.
The calm arrival reminder is untouched; once it's dismissed, a small
"Read" tab (a sibling of the reminder's own panel element, so it survives
the reminder's fade-out) reveals a small menu offering "The Workshop's
Story" — the exact same `docs/HISTORY.md` content `workshop://history`
shows, fetched and rendered with `WorkshopPages.js`'s own `fetchText()`
and `SimpleMarkdown.js`'s `renderMarkdown()` directly, deliberately
skipping `PageShell.wrapPage()`'s iframe-document wrapping since this is
a real in-page DOM panel — and "The Archive," reusing
`ArchiveOverlay.js`'s own `buildArchiveContent()` verbatim rather than a
second, independently-maintained rendering, so the chair and the
shelving unit genuinely show the same archive.

**The Archive itself was enriched**, in both places at once since they
now share one implementation: a finished project's full `notes` and
every saved `calculations` entry (`toolTitle` plus the date it was run)
are shown, not just its title and finished date. Built with `textContent`
throughout rather than the previous overlay's `innerHTML` string — notes
is free text, and there's no reason to parse it as HTML.

**Two more real Shelving bugs, found while investigating the reading
corner.** The top shelf's own book/box placeholders clipped through the
cap trim above it — confirmed against the actual built mesh bounding
boxes, not eyeballed: every shelf except the top one got a full 0.6m of
shelf-to-shelf spacing as headroom, but the frame's overall height had
only ever been sized to just clear the top shelf's own boards, leaving it
just 0.135m of clearance to the cap versus ~0.57m everywhere else — even
the shortest item already overshot it. Fixed by decoupling the frame's
height from shelf spacing (which stays exactly `0.6`, unchanged) and
sizing it instead so the top shelf gets that same ~0.57m clearance to the
cap that every other shelf gets to the shelf above it (`height = 2.535`,
up from `2.1`). Separately, the book-packing fix from the Living Spaces
phase filled each shelf's own usable width correctly but with one
perfectly even, mechanically-computed gap between every item, reading as
assembled-by-formula rather than shelved by hand over time — items now
bunch into a few natural-looking clusters instead, via randomised
(squared-random) rather than uniform gap weights, with the same total
item count and the same overall width coverage as before.

**Explicitly deferred, on purpose:** no new AI chat surface for this
pass — the reading corner stays "somewhere quiet to sit," not a second
place to talk to Bubble; the roadmap's own "resident to sit and talk
with" idea for this corner remains a future phase's decision, not this
one's.

## Version 3 — Phase 3b — Refinement pass (v3.0.3b)

**Goal:** a short, user-reported bug list, not a new phase — three
small, independent fixes, each investigated to a real root cause before
touching any code, each verified against the live engine rather than
assumed correct.

**Player shadow had no head.** The crouch fix (Phase 1) moved the head
mesh onto its own render layer (`FIRST_PERSON_HIDDEN_LAYER`) so the
first-person camera could reliably exclude it — every other camera that
should still see the full character has to explicitly re-enable that
layer, and `ReflectionSystem`'s mirror camera already did. The sun's own
shadow camera never got the same treatment, so the head — genuinely
`castShadow = true`, like every other body part — was invisible to
shadow rendering specifically. Fixed with the same one-line pattern
`ReflectionSystem` already established, in `LightingSystem.js`. Verified
directly against the exact boolean Three.js's own shadow pass uses
(`headMesh.layers.test(shadowCamera.layers)`), confirmed `false` before
the fix and `true` after it.

**Ladders had never actually worked**, despite Phase 1 reporting them
complete. Root cause: `WorldObjectsSystem` gave every placed object,
including a Builder-placed ladder, a solid walk-collision box —
`CameraSystem`'s own collision resolution stopped the player at that
box's edge before they could ever walk far enough to reach
`LadderSystem`'s own climbable zone, which is only slightly larger than
the box itself. No key ever mattered, from any approach direction,
because the climbing code never ran at all. Fixed by exempting any
object carrying the `"ladder"` behaviour from `WorldObjectsSystem`'s own
collision footprint entirely — a ladder is now climbable everywhere
within its own zone, not just the sliver of it a player could actually
reach. Two honest tradeoffs named rather than hidden: a ladder can no
longer be stood on top of like a platform (never a real use case for
one), and a player could technically walk through the rails at a steep
angle without climbing. Verified by driving genuine forward-key input
(real `KeyboardEvent`s, not a position teleport) through
`CameraSystem.update()` frame by frame, from a standing start several
metres away, from two different approach angles — both reached the zone
and climbed normally — while confirming an ordinary Construction Library
cube still blocks movement exactly as before. This also corrects Phase
1's own claim that ladders were "reviewed and found already complete";
that playtest verified the climbing mechanics directly but never
simulated a real walk-up from a distance, so it never hit this bug — see
the correction added to Phase 1's own account above.

**The Builder Phone's own tab row (Construction Library / Saved Objects
/ Imported Models / Blueprints / Terrain) overflowed off the right edge
of the 300px-wide panel instead of wrapping.** `.builder-phone-tabs` was
a plain flex row with no `flex-wrap`, and its buttons' own default
`min-width: auto` meant they couldn't shrink below their label's own
intrinsic width — the same class of bug `.panel-row input[type="range"]`
was fixed for in an earlier phase. Fixed with `flex-wrap: wrap` plus a
`calc(50% - 2px)` flex-basis targeting two buttons per row. Verified
against the real 300px panel: five buttons now wrap into a clean
2-2-1 layout with no overflow, tab-switching still works, and no text is
clipped.

## Version 3 — Phase 3c — Service worker caching fix (v3.0.3c)

**Goal:** "loading a new version of the workshop needs a load, then a
refresh, then another load to actually see it" — a real, user-reported
production bug, not a dev-environment quirk (though it was that too,
throughout Phase 3b's own verification work — see that phase's account
above and `.claude/DEV_NOTES.md`, new this phase, for the workaround
habits it forced).

**Root cause: the original service worker used one single
stale-while-revalidate strategy for every request, including the
Workshop's own files.** Stale-while-revalidate is a genuinely correct,
deliberate choice for content that rarely changes — but for `index.html`,
everything under `css/` and `src/`, the exact files that change on
*every single deploy*, always serving whatever's cached first (however
old) and only refreshing the cache in the background for *next* time
means the load immediately after a fresh deploy still shows the
*previous* version, correctly, by that strategy's own design. A second
reload was needed just to see what the background refresh had already
fetched.

**Fixed in two layers, both necessary — confirmed by testing each in
isolation, not assumed.** First: same-origin requests (the Workshop's own
files) now use network-first — always try the network, fall back to the
Cache API only if that genuinely fails. Cross-origin requests (the
Three.js CDN) keep the original stale-while-revalidate, the right
tradeoff for a pinned vendor URL that never actually changes once
fetched. Testing that alone against a real simulated deploy (editing a
cached file, then reloading exactly once) still showed the *old*
content — a second, deeper cache layer was intervening: Python's
`http.server` (this project's own dev server) sends no `Cache-Control`
header, which licenses the browser's own default HTTP cache — a layer
below the Service Worker's Cache API entirely — to silently answer even
a "network-first" `fetch()` call without a real network round-trip.
Every same-origin fetch the service worker makes now explicitly requests
`{ cache: "no-store" }` (`"reload"` for the one-time install-time
precache), which is what actually closed the gap: the identical test
(edit a file, reload once) then showed fresh content immediately, every
time. `CACHE_NAME` was also bumped (`v2` → `v3`) as ordinary hygiene
alongside a real strategy change, not the fix itself.

**New this phase: `.claude/DEV_NOTES.md`**, durable engineering notes
(not part of the Workshop itself, same category as `test-assets/` and
`launch.json`) recording the caching pitfall above and the dev-session
verification habits it forced throughout Phase 3b — a fresh port per
`preview_start` session, unregistering stale service workers when
reusing one, and the established pattern for driving the live engine
directly (`window.__debugEngine`, real dispatched `KeyboardEvent`s,
pixel-readback) for behaviour that's awkward to verify by screenshot
alone in this environment. Written so a future session doesn't need to
rediscover any of this the hard way.

## Version 3 — Phase 4 — Workshop Rituals (v3.0.4)

**Goal:** strengthen the Workshop by connecting systems that already
remember their own state into small, optional rituals — never a new
progression system, never anything required. See `docs/ROADMAP_V3.md`'s
own Phase 4 entry for the original brief ("turning on the radio, opening
the curtains, sitting at the same chair, checking yesterday's project").

**Investigation first found the Workshop already remembers far more than
the brief's own framing suggested was missing.** Time genuinely passes
while the player is away (`TimeOfDaySystem.mode` defaults to
`"realtime"`); weather, the light switch, the front door, the player's
exact position, the computer's last-open app, and the Workbench's own
current project (`WorkbenchSystem.currentProjectId`) all already persist
exactly as left. Nothing stops music playing across any other activity —
confirmed directly, not assumed. What was actually missing wasn't
memory — it was connective tissue between systems that already remember,
and a scope boundary worth naming precisely: `PlayerPatternMemory` and
`WorldEventLog` (Phase 6's own territory), new resident behaviour
(Phase 10's), and Notebook/Pinboard/Builder-library friction (Phase 8's)
were all deliberately left alone here. The entry sequence itself
(`main.js`'s `_enterWorkshop()`) was deliberately left untouched too —
its current instantness reads as correct restraint, not a gap; forcing
an acknowledgement there risks exactly what the brief warns against
("the goal is not to tell players how to begin their session").

**Three small, connected touches, each reusing state that already
existed rather than inventing new tracking.** The reading chair now
remembers what you were reading — `FurnitureSystem` gained a new small,
generic per-piece memory (`getInteractionState()`/`setInteractionState()`,
the same "one small, generic capability, multiple callers" shape
`ReflectionSystem`/`LadderSystem` already established), and
`RestNookOverlay.js` is its first caller: opening the reading panel
offers whichever of Story/Archive was last actually read, first, instead
of always resetting to the neutral menu. The music cabinet now offers to
pick back up — `MusicSystem`'s own `wasPlaying` flag had been captured
into every save and never once read back since the system existed;
`wasPlayingLastSession` is its first real reader, surfaced as a small,
one-click "Picking up where you left off" invitation in the playback bar
that retires the instant any real playback action happens, including the
edge case (found during verification, then fixed) where the invitation
would otherwise sit there forever if the song's own root had become
unreachable between sessions. The Browser's own home page now quietly
mentions the current project — one line added to the existing "Workshop
Projects" tile, reusing `WorkbenchSystem.currentProjectId` and
`ProjectsStore` directly, answering "checking yesterday's project" from
a screen already opened for other reasons rather than a new dashboard.

**Verified live, not just by code review.** The reading chair's memory
was confirmed across a real simulated return (sit, read Story, stand up,
sit again — jumps straight back to Story). The music resume hint was
confirmed to appear, correctly reflect the restored song, and clear on
click — including the root-unreachable edge case once found and fixed.
The Browser home page's project line was confirmed rendering inside the
real computer Browser app, not just as computed HTML.

## Version 3 — Phase 5 — Beyond One Building (v3.0.5, v3.0.5b)

**Goal:** the first additional structure feels like a *place*, not
decoration — proving `docs/WORLDBUILDER.md`'s claim that the architecture
generalises to player-built rooms without changing. See
`docs/ROADMAP_V3.md`'s own Phase 5 entry for the original brief.

**Investigation first found the crux of the brief already built.**
`BuildingDetectionSystem.js` — a real, complete flood-fill enclosure
detector (any placed object tall enough and low-based enough counts as
wall-like; a coarse 2D grid floods in from its own outer edge; whatever's
never reached registers with `InteriorSystem.registerVolume()`, the same
call `RoomLayoutSystem` makes for the Workshop's own room) already
existed from Version 2's "World Expansion" phase, something
`docs/ROADMAP_V3.md`'s own planning hadn't fully accounted for. The real
remaining work wasn't building detection — it was making what a player
actually builds with today's Construction Library hold up against it.

**Two bugs, reported directly rather than found by investigation.**
"Ground tiles like paths and the foundation and floor all had too much
collision" turned out to already be fully fixed, confirmed by live
testing rather than assumed — a side effect of an earlier
vertical-column collision correction to `CameraSystem._pushOutOfBox()`,
no new work needed here. "Blocks like doors that have an interaction seem
to have their interaction point set too low" was real: an interactable's
world position was always its entity's own origin, correct for furniture
(already centred sensibly) but wrong for anything ground-anchored like a
door or switch, where the origin sits at floor level and the camera's
eye-height distance check made the prompt feel like it needed to be
almost stood on top of. Fixed with `InteractableComponent.interactionHeightOffset`
(default 0 — every existing interactable, furniture included, confirmed
unaffected) — `WorldObjectsSystem` computes it centrally from each
instance's own overall height (`min(height × 0.5, 1.0)`), so no
individual behaviour needs to set it itself.

**A third bug, found while fixing the second.** Multi-part Construction
pieces — a `doorway`'s two posts and a header, with a real gap between —
were getting exactly *one* combined collision box covering their whole
extent, meaning the gap a player is supposed to walk through was
solid. `WorldObjectsSystem._updateFootprint()` now keeps that overall box
for what genuinely needs it (dimension measurement, Build Mode's own
stacking-snap) but separately builds one real box per compiled child part
(`collisionBoxes`, keyed by the same `userData.partId` tagging
`ObjectCompiler` already applies) for what walk-collision and
enclosure-detection actually consume. An imported model, with no part
tagging of its own, keeps the old single-box behaviour unchanged — the
split only applies to what this codebase itself compiled from parts. See
`docs/WORLDBUILDER.md`'s "Collision integration" section for the full
account, including a fourth bug this one exposed during verification: a
door's cached collision box stayed frozen at "closed" even after
swinging open, fixed with a new `refreshFootprint()` that recomputes
collision from an object3D's current transform without persisting the
transient open/closed state as if it were a placement edit
(`DoorBehaviour.js` calls it after every swing).

**Three default interior blueprints**, seeded by `BlueprintStore`'s own
constructor so every session — including a brand-new one that never
reaches `load()` at all — sees them: Simple Shed (8 pieces), Sunlit Room
(20 pieces), Two-Room Cottage (34 pieces, two rooms sharing an interior
doorway), all built from existing Construction Library pieces, "so the
player can see that, by default, good things can be made with the
default building blocks." A genuine finding surfaced while first
verifying Sunlit Room: the `window` piece couldn't seal a boundary for
`BuildingDetectionSystem`, by its own honest design (its sill and header
never independently overlapped the wall-like height band the flood-fill
checks for) — a room built with one in its outer ring registered as not
enclosed *anywhere* inside it, not just near the window. Reported rather
than hidden, and then genuinely fixed rather than routed around: two new
Construction Library pieces, `windowPane`/`largeWindowPane`, pair with
`window`/`largeWindow` exactly the way `door` pairs with `doorway` — a
thin box sized to independently satisfy the same generic wall-like check
on its own, no special-casing added to `BuildingDetectionSystem` itself,
and (as a genuine bonus) real collision where a window's own "glass" used
to have none at all. Sunlit Room now uses a real, sealed window; every
exterior opening across all three blueprints is sealed, each the same
shape — an opening frame paired with whatever piece actually closes it.
See `docs/WORLD.md`'s "Interior Recognition" section and
`docs/WORLDBUILDER.md`'s "Collision integration" and "Default starter
blueprints" sections for the full account.

**Verified live throughout, not by code review alone**: the doorway gap
walkable while its posts and header still block; a door's interaction
height, and its collision correctly following it open and shut; all
three blueprints placed through the real Build Mode placement pipeline
and confirmed enclosed (or, for the cottage, both rooms registering as
one connected interior through their shared doorway) after
`BuildingDetectionSystem`'s own debounce; furniture and residents
confirmed to carry a zero interaction-height offset, completely
unaffected by any of this.

## Version 3 — Phase 6 — The Workshop Remembers (v3.0.6)

**Goal:** extend continuity beyond persistence into memory — the
Workshop noticing, gently, what has been happening — without becoming a
notification system. See `docs/ROADMAP_V3.md`'s own Phase 6 entry for
the original brief.

**Investigation first found most of the brief already built.** Version
2's own Living World work — `WorldEventLog`, `WorldAwareness`,
`ResidentPreferences`, `PlayerPatternMemory`, `ConversationMemory`,
`ResidentCuriosity` — is real, working, and already wired together;
`ResidentContext.buildConversationContext()` already folds the two most
recent world events into Bubble's own conversation context, meaning
"Bubble mentioning the storm that happened while they were away," the
brief's own headline example, already worked before this phase touched
anything. Presented with three real remaining gaps, the user dropped the
first (a player-facing "time away" surface) as unnecessary — the wall
clock, the computer, the phone, and the sky outside already let a player
tell time naturally — and approved the other two.

**Workbench dust.** `ProjectsStore` already stamped every project with
`updatedAt` on every edit; nothing read it for anything visual.
`WorkbenchSystem._isStale(project)`/`_applyDust()` now desaturate a
project's own presence items once it's sat genuinely untouched past two
weeks, on the next rebuild — cloning each mesh's own material first
(every presence builder shares `PlaceholderFactory`'s colour-keyed
cache; mutating it in place would have dulled every other object in the
room using that same cached colour, not just this one project),
recomputed fresh every rebuild rather than stored as a flag, so working
on a project again simply means the next rebuild shows no dust, with
nothing to explicitly clear. Verified live: a project's own `updatedAt`
set 20 days in the past visibly desaturated on rebuild, the shared
cache's own original colour confirmed still in use elsewhere in the
room, and the effect reverting cleanly once the timestamp was fresh
again.

**Bubble's conversation panel, genuinely redesigned.** A real, still-
outstanding Version 2 carry-over, confirmed rather than assumed: every
existing overlay material (`screen`, `paper`, `cork`, `panel`,
`wardrobe`) is a full-screen, 70%+-opacity backdrop with a large centred
panel — exactly covering Bubble, since talking to Bubble has no camera
focus pose and the player is already looking straight at it, roughly
screen-centre, the moment a conversation opens. A sixth overlay
material, `companion` — no backdrop, a small frosted-glass card docked
to the bottom-right corner — leaves the room, and Bubble, exactly as
visible as before the conversation opened. Verified live: the overlay's
own computed background is fully transparent, the panel sits in the
screen's bottom-right quadrant at a compact 380px wide, and the existing
message/input UI (and the "waiting for connection" offline state) both
render correctly inside it, unchanged.

## Version 3 — Phase 6b — Being Placement, Actually Visible (v3.0.6b)

**Goal:** a real, user-reported bug fix, found while beginning Phase 7's
own investigation rather than part of Phase 7's own planned work — closed
out on its own rather than folded silently into a later phase.

**The report:** placing a Being showed no ghost preview, and clicking to
place it left "the app recognising it's been put into the world, but we
never see it." Reproduced directly rather than assumed: creating a real
Being and calling the real placement pipeline confirmed both symptoms,
and traced to two independent bugs.

**Bug one — the ghost's own floor raycast has no fallback.** A perfectly
horizontal or upward look ray, entirely ordinary the instant placement
begins, can never intersect a floor plane below eye level — the ghost
used to snap to the literal world origin the first time this happened,
then simply stop updating on every later frame the raycast kept failing.
`BuildModeSystem.js` solved this exact problem already
(`defaultGhostPoint()` in `GhostPreview.js`, straight ahead of the camera
at a comfortable distance); `BeingSpawnerSystem.js` now reuses it
directly, with the fallback's own Y forced to floor level, applied on
every pointer move rather than just on entry — this system's single
floor-only raycast fails far more often than `BuildModeSystem`'s own
broad multi-surface one, so "freeze until you look at the floor" would
have stayed a real problem here even after the initial-position fix
alone.

**Bug two — a malformed body part crashed the entire spawn, silently.**
`BodyCompiler.compileBody()` threw a hard `TypeError` on a part missing
its own `rotation`, and since the loop builds every mesh before parenting
any of them, that left a Being's own root group with zero children — a
real, correctly-recorded `BeingInstanceStore` entry with nothing to show
for it, and no retry, since `BeingController` had already registered the
runtime before the crash. Not reachable through the Being Creator's own
UI (every part it creates already has a well-formed `rotation`), but
`BeingLibrary.importDefinition()` never validated `bodyParts` at all,
unlike every other field it imports — exactly the "imported content is
the first untrusted data the Workshop would render" risk Phase 7's own
brief names. `compileBody()` now defends `position`/`rotation`/`scale`
each independently, falling back to the same defaults the Creator's own
`makeDefaultBodyPart()` already uses, rather than crashing the whole
compile over one bad field.

**Verified live, both together**: a camera at a distinctive, deliberately
non-default position confirmed the ghost's own fallback point is
genuinely camera-relative, not a coincidental match to the old hardcoded
origin; a Being placed with the exact malformed part that used to crash
now compiles with a real child and no console error; a well-formed part
placed immediately after confirmed no regression in position, rotation,
or scale. See `docs/BEINGS.md`'s own "Being Spawner & Manager" section
for the complete account — which also corrected a real, unrelated doc
drift found in the same file: `BeingSpawnerApp.js`/`BeingManagerApp.js`
no longer exist, consolidated into `BeingsPhoneApp.js` on the Phone
several phases ago, a move this document had never caught up to.

## Version 3 — Phase 7 — Sharing the Workshop (v3.0.7)

**Goal:** let creations travel — "every store already has clean JSON
export/import primitives... what's missing is a coherent, discoverable
'share this / bring this in' workflow." See `docs/ROADMAP_V3.md`'s own
Phase 7 entry for the original brief.

**Investigation first found the pattern, not the gap.**
`ResidentProfileStore.exportProfile()`/`importProfile()` and
`ExpressionSetStore.exportSet()`/`importSet()` already established the
exact envelope shape (`{type: "workshop-<kind>", version, exportedAt,
<kind>: {...}}`) every new export needed to follow; `StorageUtils
.downloadJSON()`/`uploadJSON()` were already the shared browser-download/
file-picker primitives, named explicitly in the brief itself. Three
genuine gaps remained, confirmed by direct code read rather than
assumed: `BlueprintStore.js`, `ToolsStore.js` (custom calculators), and
`AtmosphereProfileStore.js` had zero export/import methods between
them.

**Three new store-level export/import pairs**, each following the
established envelope shape and each defensively normalising on import
rather than trusting the file (`BlueprintStore.importBlueprint()`,
`ToolsStore.importCustomCalculator()`, `AtmosphereProfileStore
.importProfile()`) — see `docs/WORLDBUILDER.md`'s "Sharing a Blueprint"
and `docs/PERSISTENCE.md`'s "Import & Export" for the full account of
each. Wired into their native panels: the Builder Phone's Blueprints tab
(a new card layout — a single `<button>` per card couldn't hold a second
nested Export button, so cards became a `<div>` wrapping two sibling
buttons — plus a new Import row), the Tools panel's Calculator Builder,
and Settings' Atmosphere Profiles section.

**A unified `AssetService` export mechanism**, so any of these — plus
the pre-existing Being and Expression Set exports — is also reachable
from that asset's own Browser page, not only its native panel:
`registerKind()` gained a fifth optional callback, `exportItem(item)`;
`AssetService.canExport(assetId)`/`exportAsset(assetId)` are the generic
wrapper that calls it and hands the result to `StorageUtils
.downloadJSON()`. See `docs/ASSETS.md`'s own "Export" section.

**Two things this surfaced that weren't previously true, worth stating
plainly:**

- **Atmosphere Profiles, Calculators, and AI Resident Profiles were not
  registered as `AssetService` kinds at all before this phase** —
  confirmed by their absence from `main.js`'s own `registerKind()` calls,
  a real, pre-existing gap rather than something this phase introduced.
  Making their Export button reachable from the Browser required
  registering all three as genuine new kinds (full `toDescriptor`, not a
  narrower export-only mode), the correct minimal-new-surface-area
  choice rather than inventing a second, smaller registration contract
  alongside the existing one.
- **Only four kinds had a real Browser detail page** (Objects,
  Blueprints, Animations, Beings); a kind without one shows a plain
  summary note on the Asset Library's own overview page, not a clickable
  link — meaning the four newly-export-enabled kinds (Expression Sets,
  Atmosphere Profiles, Calculators, AI Resident Profiles) would have been
  exportable in principle but practically unreachable. Resolved with one
  new, shared **generic detail page** (`genericAssetDetailPage()`) rather
  than four bespoke ones — badge, title, description, Favourite and
  Export buttons, the same `commonAssetSections()` every bespoke page
  already uses.

**Verified live, all six kinds, store through to Browser page**: each
store's own export/import round-tripped correctly (including rejecting
a malformed envelope with a specific error, and defensively normalising
a well-formed-but-incomplete one rather than crashing); `AssetService
.canExport()`/`exportAsset()` confirmed true and working for exactly the
intended six kinds and false for Objects/Animations (which have no
`exportItem`); `pageRegistry.resolve()` confirmed every one of the eight
now-reachable kinds' detail pages render with a working Export button,
and the Asset Library overview page links to all eight; the Builder
Phone's own Blueprint cards and Import row, and the Tools panel's own
Calculator Import/Export buttons, were mounted and driven directly
against real store data, confirming the DOM restructuring (the new
`<div>`-wrapped card) renders and behaves correctly with no nested-button
issue.

## Version 3 — Phase 8a — Bubble Gains Hands, Conversation Surface (v3.0.8a)

**Goal:** the first of two milestones under Phase 8 ("Bubble Gains
Hands") — five small, real pieces of friction in Bubble's own
conversation overlay, closed before the phase's much larger second half
(granting residents sandboxed Workshop Functions, deliberately
milestoned separately). See `docs/ROADMAP_V3.md`'s own Phase 8 entry for
the original two-part brief.

**Investigation first found the AI stack more limited than the brief
assumed, in ways that shaped scope.** Only Ollama is real (OpenAI/
Anthropic remain honestly inert, per `docs/AI.md`); every request is
`stream: false` — there is no streaming anywhere in the stack to build
on. "Bubble's replies should display word for word" was built as a
purely client-side reveal of an already-complete string rather than real
token streaming — the same visible effect, none of the risk of adding
real streaming parsing to a call site nothing else depends on yet.

**Five changes, all in `ResidentConversation.js`/`ResidentConnection.js`/
`css/overlays.css`, none touching what's actually sent to Ollama:** a
long message now caps at four visible lines with its own scrollbar
(`.resident-message`'s own `max-height`, expressed in `em` so it tracks
the element's own font-size rather than a hardcoded pixel guess); a
reply reveals word-by-word via a new `revealReply()` loop that mutates
one history entry in place; a failed send gets a real, distinct error
row with a Retry button instead of a fake apology bubble mixed into the
conversation, and Retry never re-pushes a duplicate player message; the
input's Up/Down arrows cycle through the session's own sent messages,
restoring an in-progress draft once arrowed back past the most recent
one; and a small "ⓘ" toggle surfaces Ollama's own `prompt_eval_count`/
`eval_count` for the last turn against the profile's own context size —
previously read off every response and silently discarded — worded
honestly as "last turn only," since Ollama doesn't report a running
conversation total.

`ResidentConnection.sendMessage()` now returns `{content,
promptEvalCount, evalCount}` instead of a bare string — its one other
caller, Mission Control's own Resident Sandbox test chat (`AIApp.js`),
was updated to destructure `content` and is otherwise unaffected; two
stale "unchanged this phase" comments referring to this exact method,
left over from an earlier phase, were corrected in the same pass rather
than left to mislead the next reader.

**Verified live** by mounting `createResidentConversationOverlay()`
directly against a detached container with a scriptable fake
`residentConnection` (no real Ollama server in this environment) —
confirmed the word-by-word reveal completes correctly and re-enables
Send only once finished; the usage popup shows the exact expected
wording and numbers; Up/Down recalls sent messages and restores an
in-progress draft; a genuinely failing `sendMessage()` produces the
distinct error row with no fake bubble, and clicking Retry resends the
identical text without duplicating the player's own message; and
disposing the overlay mid-reveal (closing the conversation while Bubble
is still "typing") stops the reveal cleanly with no console errors,
confirming the `disposed`/`revealToken` guard actually works. The
`.resident-message` computed `max-height` measured exactly 84px — 1.5em
× 4 at this card's 14px font-size, i.e. genuinely four lines, not an
approximation.

## Version 3 — Phase 8b — Bubble Gains Hands, Workshop Functions (v3.0.8b)

**Goal:** the second, larger half of Phase 8 — granting residents
sandboxed Workshop Functions from Mission Control, all-granted-by-
default and individually toggleable per profile, Bubble's own included.
See `docs/ROADMAP_V3.md`'s own Phase 8 entry and `docs/AI.md`'s new
"Workshop Functions" section for the full account.

**A fixed, Workshop-owned function table** (`WorkshopFunctions.js`) —
nine functions (move, read player/nearby-object/nearby-Being
coordinates, weather, time, lights, music, and a name-resolved
place-anything function) dispatched through a table the Workshop itself
owns; a resident only ever supplies a name and arguments, never code.
Threaded through `ResidentProfileStore` the identical nested-merge/
export/import pattern every other profile section already uses — a
`functions` field travels through Phase 7's export/import for free.
Real Ollama tool-calling added to `ResidentConnection.sendMessage()`
(a new optional fourth `dispatcher` argument): builds the `tools`
request from whichever functions a profile has granted, and runs a
capped, multi-round call/result/reply loop only when Ollama's own
response actually contains `tool_calls` — an ordinary conversation turn
is byte-for-byte unchanged. Mission Control gained a new "Workshop
Functions" toggle section, and the conversation overlay gained a small,
honest "Bubble used: Turn the lights on or off" transparency line
whenever a function actually fires.

**Also completed in this pass, from the original brief's own third
strand**: `WorldAwareness.snapshot()` (built in Phase 6, never actually
read into a conversation until now) is wired into
`ResidentContext.buildConversationContext()`/`PromptComposer
.composeSystemPrompt()` as a short, selective line of real Workshop
knowledge — current time, weather, whether music is playing, active
project count — deliberately kept separate from the function-calling
mechanism: knowledge is what a resident *knows*, a function is what it
*does*.

**A deliberate scope decision, caught mid-implementation**: the Resident
Sandbox does *not* get a dispatcher, even though it was tempting to wire
in for symmetry. Its own doc already promises "nothing typed below
reaches the real conversation or its memory" — a Workshop Function is a
real, permanent effect, so granting it there would have quietly broken
that isolation the moment a function actually fired. The Sandbox does
get the read-only knowledge grounding, since that has no side effects.

**A real bug, caught only by driving actual per-frame movement rather
than trusting the first frame's own state** — `ResidentController`'s
`moveTo` arrival check originally compared full 3D distance, but
`ResidentMovement.stepToward()` deliberately moves along the ground
plane only. Whenever a target's own Y didn't closely match the
resident's natural resting height, the distance could never cross the
arrival threshold, leaving "goto" mode stuck forever. Fixed by comparing
horizontal distance only, and by simplifying `moveTo`'s own schema to
drop `y` entirely — a resident's height was never something either the
function or the model should have controlled.

**Verified live, extensively**: every function's `invoke()` tested
directly against real Workshop systems (weather/time/lights/music
state genuinely changed; a Construction piece, a Blueprint, and a placed
Being all spawned live, independently confirmed via
`getNearbyObjects`/`getNearbyBeings`; out-of-range coordinates correctly
clamped; unknown function/weather ids returned honest errors rather than
throwing); the profile's own `functions` field confirmed nested-merging,
exporting, and importing correctly; the Mission Control toggle section
mounted and clicked directly, confirmed updating the real profile; the
conversation overlay's transparency line confirmed rendering the correct
wording for both a successful and a failed function call; the
tool-calling loop's own protocol handling verified with a scripted fake
`fetch` (a real multi-round call/result/reply exchange, and the round
cap stopping a mock that never stops requesting functions at exactly
`MAX_TOOL_ROUNDS`). Finally, tested against the user's own real, locally
running Ollama server with `ornith:9b` (a model whose reported
capabilities include `tools`): asked in plain conversation to "turn the
lights on," the resident genuinely chose to call `setLights` — the
Workshop's own lights turned on for real, confirmed independently via
`lightingSystem.lightsOn` before the assistant's own reply was even
read back — the first fully real, unscripted confirmation that a local
model can and will use a granted Workshop Function correctly through
this exact pipeline.

## Version 3 — Phase 9 — Creative Flow (v3.0.9)

**Goal:** "refine the entire creative workflow so ideas move naturally
throughout the Workshop without interrupting momentum... not about
adding new tools... making existing tools disappear into the creative
process." See `docs/ROADMAP_V3.md`'s own Phase 9 entry for the original
brief, including its two named playtesting notes.

**Investigation split two ways**: a precise root-cause pass on the
brief's own flagged reselection bug, and a broader survey of Browser,
Notebook, Pin Board, Phone navigation, the Builder Library, and every
overlay's own structural pattern, against "existing management surfaces
should comfortably accommodate growing libraries without obscuring or
hiding functionality." The survey confirmed Phone navigation and
Browser navigation are both already consistent and needed no changes —
worth saying plainly, per this project's own "say what's already fine"
habit — and found four genuine, on-brief items.

**Imported-model reselection, finally fixed.** `_resolveWorldObjectDefinition()`
was missing the `"importedModel"` branch the already-correct, more
general `_resolveDefinition()` had — clicking a placed imported model
resolved a `null` definition, which `_showSingleSelection()` treats as
an invalid selection, silently bouncing back to the library screen.
Drag/group-select never called this method at all, which is exactly why
a group-select containing the model "worked." Fixed by making the
narrower resolver delegate to the correct one instead of maintaining a
second, incomplete copy — closing the last real gap in Phase 1's own
"imported objects should behave as first-class objects" promise. The
identical gap in `_startMoveSelected()` was fixed in the same pass.

**Pin Board decluttered.** The cork board showed every project
regardless of status, so a finished project stayed pinned forever,
duplicating the Archive (which already exists specifically for finished
work) — real clutter in a long-running Workshop. `done` projects now
leave the board the moment they're marked done, never deleted, simply no
longer pinned; `ProjectsStore.js`'s own doc comment, which claimed
status-grouping that was never actually implemented, was corrected to
match.

**Builder Phone search filter.** The Construction tab already solved
"the catalog outgrew a flat grid" with category grouping; Saved
Objects/Imported Models/Blueprints never got an equivalent, and Saved
Objects specifically has no natural ceiling in a long save. A live
text-search filter now covers all three — grouping wasn't an option that
worked uniformly (only Saved Objects have a category field) — following
the exact "re-render only the results, never the input" pattern the
Browser's own Unified Search page already established, so typing never
drops focus mid-search the way a full screen rebuild would.

**Wardrobe's overlay, genuinely fixed rather than just resized.** The
first-guess fix (shrink the declared 880px width to the standard 560px)
turned out not to be the real bug at all — live measurement showed the
panel rendering at nearly full viewport width regardless of what was
declared. The actual cause was two compounding CSS mistakes only visible
once measured: a stray `flex: 1` on a second class applied to the same
panel element silently overrode its own declared width entirely, and a
missing `flex-direction: column` laid the heading and the split
preview/form content out side by side instead of stacked. Both fixed at
the root; see `css/overlays.css`'s own `.overlay--wardrobe` comment for
the complete account.

**Verified live throughout, including one caught-in-the-act correction**:
initial reselection testing via a naive `ModelLibrary.add()` call
returned just an id string, not an object — a test-script bug, not a
real one, caught by re-checking the store's own method signature before
trusting a `null` result. Every fix was then verified against the real
mechanism it touches — a real imported-model instance selected through
the actual `BuildModeSystem`, confirming both the resolved definition
and the rendered selection screen; a Pin Board mounted against real
`ProjectsStore` data, confirming both the initial filter and live
removal on status change; the Builder Phone search filter mounted and
typed into directly, confirming the same input DOM node persists across
keystrokes (no focus loss) and that Construction's own grouping was
untouched; and the Wardrobe overlay mounted against the exact DOM
structure `OverlayManager` builds, with real `getBoundingClientRect()`
measurements — width, child stacking order, and a full sweep for any
element overflowing the form's own bounds — rather than assumed correct
from reading the CSS.

## Version 3 — Phase 10 — Real Assets, Honestly Introduced (v3.1.0)

**Goal:** move the Workshop past its "prototype" feel in a handful of
specific, honestly-scoped places, without abandoning the zero-binary-
asset discipline that's held since Version 1. See `docs/ROADMAP_V3.md`'s
own Phase 10 entry for the original seven-milestone brief. The user's
own guidance, given at approval time, shaped the final scope directly:
"I do really like that we are keeping this project very asset free...
we should only do this if it is absolutely necessary and the Workshop
would genuinely benefit from it... only basic things at most, like
small sounds, textures or small models." Milestones 1–6 (all
procedural, zero binary assets) were built; Milestone 7 (real recorded
audio) was deliberately **not** started — see its own note at the end
of this account.

**Milestone 1 — Door hinge, a real edge pivot.** `DoorBehaviour.js`'s
own comment had named this gap since Phase 5: swinging rotated the
whole compiled object around its own origin, not a true hinge edge — a
limitation Phase 14's own brief (`docs/ROADMAP_V3.md`) named again,
independently, as the same thing observed from the player's side.
Solved once here rather than twice: a new `hingeOffset` property
repositions the object on every toggle so a point offset from its own
origin — the true hinge edge — stays fixed in world space, instead of
the object spinning in place around its centre. `hingeOffset: 0` (the
default) reproduces the old behaviour exactly, so every door placed
before this existed is unaffected. Verified directly against the real
registered `"door"` behaviour with real Three.js vectors: the hinge
point measured zero drift under rotation for both a positive and a
negative offset, and the zero-offset case matched the old rotate-in-
place output bit-for-bit.

**Milestone 2 — Default Emotes.** The Emote Wheel (`EmoteWheelSystem.js`)
lists every clip whose `category !== "movement"` — genuinely empty on a
fresh Workshop until now, since nothing had ever seeded one. Four new
hand-authored clips (Wave, Clap, Bow, Dance) join `AnimationClips.js`'s
own `DEFAULT_ANIMATION_CLIPS`, the same permanent-seeded-data pattern
`DefaultBlueprints.js` already established — zero new plumbing needed,
since `AnimationLibraryStore.all()` already spreads that array
directly. Verified by playing all four through the real
`PlayerAnimationSystem` for their full duration (no errors, no NaN
rotation on any pivot) and by opening the real Emote Wheel UI and
confirming all four appear as clickable buttons.

**Milestone 3 — Default Outfits.** Six starter outfits
(`DefaultOutfits.js`) for the Wardrobe rail: Work Overalls, Pinstripe
Vest (masculine), Rose Blouse, Sundress (feminine), Pride Jumpsuit,
Field Jacket (both gender-neutral in styling) — the Pride Jumpsuit
blocks the trans pride flag's three colours across torso/arms/legs as a
soft, deliberate palette choice, per the user's own request. Seeded
directly in `OutfitStore`'s constructor with stable string ids, the
same timing `BlueprintStore.js` already uses. **Deliberately does not
reseed on an empty `load()`**, unlike `BlueprintStore`'s own rule — the
Settings app's Danger Zone already promises "every saved outfit
deleted... this can't be undone," and silently bringing the defaults
back on the next reload would break that promise; `load()`'s existing
logic already gets this right without any special-casing, once
defaults exist to seed in the first place. Verified end to end: the
real `WardrobeApp` UI, mounted against a detached container, lists all
six; clicking "Wear" on the Pride Jumpsuit correctly changed the live
`PlayerAppearanceStore`'s torso colour and set `currentOutfitId`; and
`buildCharacter()` produced a valid, NaN-free 14-mesh rig for all six.

**Milestone 4 — Default Beings.** Three starter Beings
(`DefaultBeings.js`), all built from primitive body parts, none
imported: Person (fully rigged — all 14 `WorkshopSkeleton.WORKSHOP_JOINTS`
tagged, its right side generated from the hand-placed left side via
`BodyCompiler.mirrorSubtree()`, the same tool the Being Creator's own
"Mirror" button uses), and Cat/Dog (deliberately unrigged — the shared
Workshop joint vocabulary only names biped joints, so a quadruped's own
legs and tail have nowhere honest to map to; see the new "Known
simplifications" entry in `docs/BEINGS.md` this milestone added).
Seeded in `BeingLibrary`'s constructor and reseeded on a genuinely
empty `load()` — the same rule `BlueprintStore.js` uses, appropriate
here since (unlike Outfits) there's no Danger Zone promise anywhere
that deleting every Being is permanent. Verified live end to end,
including the deepest check this phase did: all three spawned through
the real `BeingController`, ran 120 real update ticks (2 simulated
seconds, movement and Person's retargeted idle/walk animation both
live), zero errors, zero NaN anywhere in any runtime's transform.

**Milestone 5 — Ground texture detail layer.** `TerrainSystem.js`'s
ground was pure flat vertex-colour painting across seven materials
(grass/dirt/rock/sand/gravel/mud/path) — no generator for this existed
anywhere in `ProceduralTexture.js` at all, a bigger gap than "add detail
to an existing one." A new `terrainDetailTexture()` (following
`concreteTexture()`/`corkTexture()`'s exact speckle technique)
generates one shared, deliberately neutral fine-speckle texture, set as
`map` alongside the terrain material's existing `vertexColors: true` —
`MeshStandardMaterial` multiplies the two together automatically, so
this is still no shader work, just one `map` on an already-existing
material. Applied to both the editable 200m patch and the surrounding
non-editable skirt, at matching real-world tile density, so the join
between them stays seamless. Still genuinely not per-material splat
texturing (grass doesn't look like grass blades) — `docs/WORLD.md`'s
own "Terrain painting" paragraph was updated to describe this honestly.
Verified by sampling the actual generated canvas pixels through the
live material (confirmed real variance around the intended near-white
base, on both meshes, at the intended repeat density) rather than
trusting the code alone.

**Milestone 6 — Procedural icon set.** Every Workshop-owned Phone/
Computer app used a plain Unicode emoji as its own `glyph` — the icon
*frame* had real Workshop styling from an earlier phase, the pictogram
inside it never did. `ProceduralIcons.js` draws fourteen small, hand-
authored line-icon marks (`viewBox="0 0 24 24"`, `currentColor`,
generated as markup strings — no binary assets); nineteen first-party
app registrations across both Phone and Computer now name one of those
kinds instead of an emoji. **The Plugin SDK's own documented contract
— `glyph` as "any character" — is deliberately unaffected**:
`iconMarkup()` returns `null` for anything it doesn't recognise, and
both render call sites (`PhoneUI.js`/`WorkstationPanel.js`) fall back to
the exact original "print `glyph` as text" behaviour in that case. The
shipped example plugin (`workshopToolkitPlugin.js`) deliberately keeps
its own literal emoji rather than adopting one of this file's internal
kind ids, so it keeps demonstrating the real, stable contract a plugin
author can actually rely on. Verified live and conclusively: the real
mounted Phone home screen showed real drawn icons for 8 of its 9 apps,
and the 9th — the real, active Toolkit example plugin — correctly fell
back to its own emoji; the real Computer rail showed real drawn icons
for all 11 of its apps; zero console errors throughout.

**A caching detour worth naming.** Verifying Milestones 3–6 repeatedly
hit a module-graph staleness this session's own established `navigate(url,
{force: true})` fix did not resolve, even combined with a Service-Worker
unregister and cache clear, even in a brand-new tab. The reliable fix
was a fresh port per verification round (`.claude/launch.json`,
matching `DEV_NOTES.md`'s own existing "fresh origin sidesteps every
caching layer" guidance) — that note has been extended with the
specific new finding for the next session that hits it.

**Milestone 7 — real audio assets — was not started.** The user's own
words, quoted above, set a real bar: only if the Workshop would
*genuinely* benefit from moving past "prototype," and only small,
basic assets even then. `AudioSynth.js` remains 100% synthetic
(oscillators, filtered noise) with zero audio files, exactly as before
this phase — a deliberate deferral, not an oversight, pending an actual
case that clears that bar.

## Version 3 — Phase 10b — Being Creator, Beyond the Prototype, Wave 1 (v3.1.0b)

**Goal:** the user, after Phase 10 shipped, named the Being Creator
directly as still feeling like a prototype — "making it hard to set up
clean looking rigged beings" — and asked for it to become "a more
advanced model creator/editor." Investigation (a full read of
`BeingCreatorApp.js`, `BodyCompiler.js`, and `PreviewRenderer.js`, plus a
comparison against `BuilderApp.js`) turned up real, specific causes, not
just a vague feeling — see below. The resulting plan split into three
waves, each its own pass: **Wave 1 (this account) — core architecture**;
Wave 2 — authoring UX (click-to-select, joint markers, numeric fields,
hierarchy collapse, drag-and-drop re-parenting, per-part materials);
Wave 3 — non-biped rigging. The user chose the deeper option on both of
the two genuine forks this investigation surfaced: a real pivot/mesh
split over a lighter authoring-only helper, and including non-biped
rigging rather than deferring it again.

**A real, previously-undetected bug, found while investigating.**
`BodyCompiler.compileBody()` used to build one `THREE.Mesh` per body
part, doing double duty as both "the joint" and "the visible box," with
every *child* part parented to that same mesh. `THREE.Object3D`'s own
`scale` applies to its children's local coordinates, not just its own
geometry — so a child part's authored `position` was being silently
multiplied by whatever scale its own parent happened to have. Confirmed
live, before touching any code: the default Person's own compiled head
sat 0.38m above the torso, not the 0.53m its own data said, and the
shoulders sat at ±0.166m, not the intended ±0.32m — a torso scaled to
`[0.52, 0.72, 0.32]` pulling every child in toward the origin by that
same fraction. This wasn't a hypothetical concern raised to justify the
rewrite; it's the concrete, measured reason "clean looking rigged
beings" was genuinely hard, on top of being architecturally different
from `PlayerCharacter.js`'s own correct pivot-based rig.

**The fix: every part is now two nodes, not one.** A pivot (a
`THREE.Group` — still what `position`/`rotation`/`jointName` describe,
still what any *child* part parents to, unaffected by any scale, exactly
like `PlayerCharacter.js`'s own shoulder/elbow/wrist pivots) carrying one
mesh, offset from that pivot by a new, optional `meshOffset` field.
`meshOffset` defaults to `[0, 0, 0]` — every part saved before this
phase (including every one of Phase 10's own default Beings) renders
exactly where it always visually sat, just now correctly unscaled by
its parent's own scale, which is a genuine visual *correction* for
existing content, not merely an invisible re-architecture: the default
Person, completely unedited since Phase 10, now renders at its
originally-intended proportions for the first time, verified against
the exact numbers it was originally authored with. `mirrorSubtree()`
and `makeDefaultBodyPart()` both updated to carry the new field
correctly (mirrored the same way `position` already is, X negated).

**The editor's own payoff: "Hang Below Pivot."** A single button in the
part editor sets `meshOffset` to `[0, -scale.y/2, 0]` — a limb's shape
hanging directly beneath its own joint, computed fresh from whatever the
part's current Scale already is, rather than the hand-computed
segment-midpoint arithmetic authoring a clean-looking rig used to
require (the exact math this session's own default Person needed by
hand, now automated). The manual `meshOffset` slider row stays available
underneath for anything the one-click case doesn't cover.

**Verified live and thoroughly, at every level.** The measured bug
(before any fix) and its correction (after) were both confirmed against
real compiled mesh world-positions, not code inspection alone. All
three of Phase 10's own default Beings recompile with zero errors and
zero NaN geometry. The full `BeingController` spawn → 120 real update
ticks → despawn cycle was re-run in full (movement and Person's
retargeted idle/walk animation both live), confirming `skeletonMap` now
correctly holds pivot `Group` nodes for all 14 joints rather than mesh
nodes, with `AnimationRetargeting.applyPoseToMappedSkeleton()` unaffected
either way (it only ever sets `.quaternion`, never anything mesh-
specific). The real Being Creator UI itself was mounted and driven
directly: loading the real "Person" definition, selecting a part in the
3D preview's selection-highlight path (which specifically traverses for
`isMesh`, now one level deeper than before), and clicking "Hang Below
Pivot" on a freshly added part — confirmed the button computes the
right value, the form re-renders with it, and the part selection
survives the re-render.

## Non-goals (revisit only if the philosophy changes)

- Turning this into a multiplayer or social space
- A scoring/progression system of any kind — this is explicitly not a game
- A traditional settings menu — preferences belong on physical objects
  (the computer's Settings app is the one deliberate exception, and even
  that lives *inside* the computer object, on the monitor's own panel, not
  floating over the scene)
- Procedurally generating scenery (trees, terrain, décor) outdoors — the
  empty world is deliberate; see `docs/WORLD.md`. Anything that would
  quietly remove a choice from someone building here later stays out.
