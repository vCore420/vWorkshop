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

## Phase 12 — depth in the room that exists

Roughly in priority order, each independently shippable:

1. **Documentation archive** — give the shelving unit real content: a
   simple markdown-note store (mirrors `NotesStore`'s pattern), browsable
   by category, with "done" projects auto-linking in from `ProjectsStore`.
2. **Tool storage → inventory** — replace the honest placeholder with a
   real item list (name, quantity, location), still using the same
   furniture definition and overlay slot.
3. **Furniture rearrangement in Build Mode** — now that Build Mode exists
   for custom objects, extend it (or a variant of it) to the hand-built
   furniture pieces too. This is the feature `FurnitureSystem`'s own
   comment already has a seam waiting for: a small, explicit *overrides*
   map, persisted separately from (and layered on top of) the Workshop's
   own current layout defaults — see docs/REFINEMENT.md for why that's
   the right shape, not a return to saving every piece's transform
   unconditionally the way an earlier version briefly, incorrectly, did.
4. **Real ID3/embedded metadata for the music library** — see "Future
   extension points" in `docs/MUSIC.md`. `AudioSynth`'s generative pads
   remain in use for weather ambience and the `audioSource` behaviour
   specifically (a simpler, single-track use case the real library was
   never meant to replace) — see `docs/MUSIC.md` for why those two stayed
   separate on purpose.
5. **Small-phone-width layout pass** — touch *input* is fully implemented
   (Phase 6), tuned for "reasonably large screens" per the brief; the
   workstation/workbench/Build Mode/music panels' *sizing* hasn't had a
   dedicated pass for genuinely narrow (phone-width, as opposed to
   tablet-width) viewports yet — distinct from Phase 9's UI Scale setting,
   which scales everything uniformly rather than reflowing it.
6. **Occlusion-aware interaction checks** — a raycast between the player
   and a candidate interactable, so standing just outside a wall can no
   longer trigger something on the other side of it (see `docs/WORLD.md`'s
   known simplifications).
7. **A real performance benchmark**, if the heuristic in "Optimise For
   This Device" (Phase 9) ever proves unsatisfying — rendering a few
   sample frames and timing them, rather than inferring from device
   capability alone.
8. **A mirror** — the first real payoff of Phase 10's "should normally
   never see themselves except in... mirrors": a reflective surface
   showing the live player rig from outside, likely a render-to-texture
   second camera rather than anything stencil/portal-based, given the
   room's modest size.
9. **Clothing and wearable Builder objects** — attaching to the rig's
   existing pivots (see `docs/PLAYER.md`'s "ready for what comes next").

## Phase 13 — the world becomes alive on its own

1. **Weather that changes itself** — `WeatherSystem.autoCycle` already
   exists as a flag with no behaviour behind it yet; give it a slow,
   believable transition schedule.
2. **Seasonal changes** — a plugin (see `PLUGIN_GUIDE.md`) reading the real
   calendar date and adjusting window tint / a handful of decorative
   details.
3. **Real falling-rain particles outdoors** — now that a real exterior
   exists (Phase 5), `WeatherSystem`'s rain could extend beyond streaks on
   the glass to actual particles falling over the outdoor world.
4. **The computer's placeholders, for real** — a browser view (likely an
   `<iframe>` where targets allow it), a local AI companion (see
   `docs/PLUGIN_GUIDE.md`), and real recorded/streamed media.
5. **A finished project's physical send-off** — an actual short animation
   of a completed piece moving from the bench toward the shelving unit,
   building on the "packs away" transition already in place.
6. **`worldObject:trigger` gets a listener** — the Trigger behaviour
   (Phase 4) already emits a generic named event; the first system or
   plugin that actually listens for one is what proves the hook out.

## Phase 14 — beyond one building

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
