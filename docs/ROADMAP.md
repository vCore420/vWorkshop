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
