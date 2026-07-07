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

## Phase 8 — depth in the room that exists

Roughly in priority order, each independently shippable:

1. **Documentation archive** — give the shelving unit real content: a
   simple markdown-note store (mirrors `NotesStore`'s pattern), browsable
   by category, with "done" projects auto-linking in from `ProjectsStore`.
2. **Tool storage → inventory** — replace the honest placeholder with a
   real item list (name, quantity, location), still using the same
   furniture definition and overlay slot.
3. **Furniture rearrangement in Build Mode** — now that Build Mode exists
   for custom objects, extend it (or a variant of it) to the hand-built
   furniture pieces too, writing back through the same `persistence:save`
   path `FurnitureSystem` already uses for furniture transforms.
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
   tablet-width) viewports yet.
6. **Occlusion-aware interaction checks** — a raycast between the player
   and a candidate interactable, so standing just outside a wall can no
   longer trigger something on the other side of it (see `docs/WORLD.md`'s
   known simplifications).

## Phase 9 — the world becomes alive on its own

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

## Phase 10 — beyond one building

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
