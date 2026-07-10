# The Workshop

A living 3D creative workshop, built to be a place you return to rather than
an app you launch. Runs entirely in the browser, no build step, no backend —
just static files.

This project has gone through twenty-three phases (with one dedicated
refinement pass in between): an architectural foundation and
one believable room (phase 1), turning the computer into a real,
self-contained creative workstation with a physical sit-down/stand-up
transition (phase 2), turning the workbench into the workshop's visual
storyteller via a Project Presence system (phase 3), giving the workshop a
way to create its own new objects at runtime via a Builder app and a
physical Build Mode (phase 4), fixing the workshop's doorway and turning it
into the first building in a real, seamless, walkable world (phase 5),
touch support, installability as a Progressive Web App, and a stability
pass across everything built so far (phase 6), a real personal music
library replacing the stereo's placeholder track (phase 7), giving that
library a proper physical home: the reading and listening corner redesigned
as one intentional area alongside the computer desk (phase 8), a
performance audit and a full Settings app, making everything feel smoother,
especially on tablets, without turning down the visual quality (phase 9), a
player identity system: a modular procedural character and a Wardrobe app
to gradually become whoever you want to be (phase 10), a maintenance pass:
two real bugs properly root-caused (a stuck-key movement bug, a
music-library WebMediaPlayer exhaustion bug), a genuine save-versioning and
migration framework, a Settings Danger Zone, and a
round of interior/lighting refinement (phase 11), the Builder Phone:
redesigning how building feels rather than adding new
Builder functionality, with Workshop furniture now movable through the
exact same mechanic as Builder objects, and Builder-placed objects now
genuinely part of the physical world through real collision (phase 12),
an even-split Builder workspace, a curated expansion
of both the primitive shape set and the Construction Library, and a real
bug fix for the front doors (phase 13), and — this phase — a full
Environment System: ten weather states instead of three, three modes
(Manual, Live Weather via a real free weather API, and a genuinely
evolving Workshop Dynamic), a real sky with moving clouds, sun, moon, and
stars, and weather that now reaches indoor lighting, outdoor atmosphere,
and ambient sound alike (phase 14), and — this phase — a generic
reflection capability (mirrors and polished surfaces, not a special
"mirror object"), a physical wardrobe and mirror that open the exact same
Wardrobe app the computer does, and a smooth first/third-person camera
toggle for viewing outfits and Builder creations (phase 15), and — this
phase — a quality pass rather than a feature one: real bugs found through
actual everyday use (a backwards third-person camera and sitting pose,
an unreachable wardrobe and notebook, dark mirror reflections, and a real
performance cause behind occasional choppiness), each root-caused and
fixed rather than patched around, plus falling rain, distinct weather
sky tints, and a hidden-but-functional scrollbar throughout the computer
(phase 16), and — this pass — mirrors that no longer chase the player
around the room: a fixed viewpoint replaced a camera that reflected the
player's own position every frame, fixing both the "reflections show
areas outside the Workshop" bug this caused and a real chunk of the
performance cost mirrors carried (phase 16.5), and — most recently — a
complete movement and expression system: running, crouching, jumping,
and real vertical collision including climbable ladders; a second,
independently-customisable body model; and a full keyframe Animation
System with its own frame-by-frame editor, a shared library of default
and player-created animations, import/export, and a lightweight Emote
Wheel to trigger them (phase 17), and — most recently — helping you
actually understand the world around you: a toggleable compass, real
solar/lunar astronomy driven by your own location, a Workshop Time
control that eases the sun and moon to wherever you set it rather than
jumping, rain that correctly recognises when you're indoors, and an
"I'm Lost!" button for exactly what it sounds like (phase 18) — and, most
recently, a round of everyday comfort fixes: placing a Builder object is
now a left-click in the world instead of a Phone button, a new Display
Surface behaviour lets any chosen part show an uploaded image, and a
handful of real bugs (a taller character sinking into the floor, the
mirror's own left-right flip, an "intermittent beeping" that turned out
to be an over-electronic cricket sound) got root-caused and fixed rather
than patched over (phase 19) — and, most recently, a real Workshop
Browser: tabs, an address bar, and persistent sessions that survive
closing and reopening the Workshop, a `workshop://` protocol serving real,
live pages (the actual documentation, your actual project list), and an
architecture — `PageRegistry` — built so a future Workshop Host can slot
in its own pages without the Browser itself ever needing to change
(phase 20) — and, most recently, AI Mission Control: a calm, honest place
to prepare a future Workshop resident's connection to a local Ollama
server, its identity (in plain words, not raw prompt text), behaviour
tuning, and multiple saved profiles, with memory and embodiment settings
already shaped for phases still to come (phase 21) — and, most recently,
the Workshop's first resident: a small, semi-transparent floating bubble
that simply lives there, gently aware of you when you're nearby, willing
to talk when you walk up to it, and quietly waiting rather than
disappearing whenever Ollama happens to be offline (phase 22) — and, most
recently, the Workshop Host: a lightweight, purely architectural
companion with no window or interface of its own, preparing the
Workshop's eventual bridge to your local machine (applications, projects,
files, plugins) entirely through ordinary Browser pages, alongside a real
fix for a Browser page-refresh bug that had been quietly there since it
was first built (phase 23).
See `docs/ROADMAP.md` for what's next, `docs/ARCHITECTURE.md`
for how the workshop as a whole is put together, and `docs/COMPUTER.md` /
`docs/WORKBENCH.md` / `docs/WORLDBUILDER.md` / `docs/WORLD.md` /
`docs/POLISH.md` / `docs/MUSIC.md` / `docs/PERFORMANCE.md` / `docs/PLAYER.md` / `docs/REFINEMENT.md` for how those specifically work.

## Running it locally

Because the code is plain ES modules, it needs to be served over HTTP (not
opened as a `file://` URL — browsers block module imports from `file://`).
Any static file server works:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open the printed local URL. Click **Step inside**, and you're in.

## Installing it

The workshop is a Progressive Web App — open it in a browser tab, and
you'll get an install prompt (or use the browser's own "Install app" /
"Add to Home Screen" menu item). Installed, it opens in its own window with
no browser chrome, and works offline after the first successful visit (see
`docs/POLISH.md` for the honest limits of that: the very first load still
needs a network connection, since Three.js loads from a CDN rather than
being bundled into the repo).

## Deploying to GitHub Pages

There's nothing to build. Push this repository and point GitHub Pages at
its root (Settings → Pages → Deploy from a branch → `/` root), or at a
`docs/`-style branch if you prefer — no compilation step is involved either
way.

## Controls

| Input | Action |
|---|---|
| Click "Step inside" | Enter the room, lock the mouse cursor |
| W A S D / arrow keys | Walk |
| Shift | Run |
| C | Crouch |
| Space | Jump |
| Mouse | Look around |
| E | Interact with whatever's prompted at the bottom of the screen |
| G | Open the Emote Wheel — trigger a gesture or animation |
| M | Toggle the Compass |
| B | Toggle Build Mode (also a button, top-left) — see below |
| V | Toggle first/third person (also a button, top-left) — mainly for viewing outfits, appreciating what you've built, and screenshots; the Workshop is still designed primarily for first person |
| Esc | Step back out of whatever's open |
| Click the canvas | Re-lock the mouse cursor (after pressing Esc, for instance) |
| "I'm Lost!" (button, top-left) | Safely returns you to the Workshop if you've wandered somewhere stuck or disorienting |

**On touch** (phones, tablets): a virtual joystick appears bottom-left the
moment you first touch the screen (never shown on desktop) — drag it to
walk, drag anywhere else on the screen to look around, and tap the prompt
at the bottom of the screen to interact with whatever it's naming. Every
button, form, and panel throughout the workshop (the computer, the
workbench, Build Mode, the Builder's part editor) is already tap-friendly.

There is no menu. Everything is a physical object — see the table below.

## What's in the room right now

| Object | What happens when you interact |
|---|---|
| Computer desk | Sit down — the monitor powers on, the room softly fades behind it. A real creative workstation: Projects, Journal, Browser, AI, Media, Builder, Settings, Wardrobe. See below. |
| Pinboard | Full project planning board — every project, any status, pinned as cork notes |
| Workbench | Physically shows whatever project you're currently focused on — lean in for a small panel to finish it, switch to another, or start something new. See below. |
| Notebook (on the workbench) | A page of free-form notes, saved automatically — separate from whatever project is currently on the bench |
| Music cabinet | A proper vinyl listening setup — turntable, amplifier, bookshelf speakers, records stored below. Opens the real music library — see "Music" below |
| Shelving | Documentation & finished-project archive (honestly empty until there's something to archive) — the reference bookshelf at the top of the reading corner |
| Tool storage | Labelled placeholder for a future inventory system |
| Reading chair | Part of the same reading-and-listening corner as the bookshelf and music cabinet — a quiet spot, deliberately reserved for something calmer later |
| Wardrobe | A physical wardrobe and full-height mirror — opens the exact same Wardrobe app the computer does, just from a second, physical entry point. Stand in front of the mirror to see yourself while you change |
| Windows | Real glass now — see the actual sky/world outside. "Look outside" opens the Environment panel: view or change the weather, wind, and mode, see the current time |
| Front doors | A proper pair of outward-opening French doors — opens/closes, and genuinely leads outside — walk through into the world and back in freely |
| Light switch (left of the front doors) | Toggles the room's practical lighting |

Everything above is either a real, working feature or an honestly-labelled
placeholder for one — nothing fakes a feature that isn't there.

## The computer

Sitting down is a real transition, not a menu opening: walk to the chair,
press interact, and the camera eases into a seated pose while the monitor
powers on with it — the room dims and softly blurs behind the screen rather
than disappearing. Standing up (Esc) reverses it exactly.

The workstation panel itself is positioned every frame to match the
monitor's actual position on your screen — it's not a full-screen overlay,
it's meant to feel like it belongs to the object. Eight tabs live on it:

- **Projects** — every project you've got, planning through done (the same
  data as the pinboard and workbench, just the full picture)
- **Journal** — a page of notes, separate from the physical notebook
- **Media** — reflects the real music library, wherever you last left it
- **Builder** — design new objects for the world (see below)
- **Wardrobe** — edit your own character's proportions, colours,
  materials, and textures, with a live preview — see "Player identity" below
- **Settings** — the Workshop's full configuration: room lights and clock mode, plus Graphics, Performance, Display, Controls, and Audio — see "Settings" below
- **Browser** and **AI** — honestly labelled placeholders for later

Whichever tab you had open is exactly where you'll land next time — see
`docs/COMPUTER.md` for how that "waking from sleep" feeling works, and how
the screen-projection technique behind the panel works.

## The workbench

The bench doesn't need to be touched to tell its story — that's the point.
Whatever project you're currently focused on leaves real, visible evidence
on it: an unfolded blueprint, an open notebook, a stack of reference books,
a half-built prototype, a scattered handful of sketches — a different,
recognisable combination depending on what kind of project it is. Glance at
it from across the room and you already know roughly what you're in the
middle of making.

Leaning in (walk up, interact) is deliberately quieter than sitting at the
computer: the camera just moves a little closer and lower, and a small
panel fades in anchored to a clipboard on the bench — a title, a few notes,
a "finish" button, a "start something new" button. No tabs, no big
interface. Finishing a project packs its presence away (with a real
shrink-down transition, not an instant swap) and it turns up in the
shelving unit's archive; starting a new one grows a new arrangement into
place, picked from a `kind` (woodworking, electronics, writing, software,
or general) that decides its starting presence.

Every piece of that presence is driven by project *metadata*, not a
hand-built scene — see `docs/WORKBENCH.md` for the Project Presence system
this is built on, and how a future project type can describe its own
physical presence without the workbench itself ever changing.

## The world creation system

The computer has a seventh app now: **Builder**. It's a simple in-world
modelling tool, not a Blender competitor — an even split, a large live
preview always visible on one side (drag to orbit, scroll to zoom) and
every editing control on the other. Assemble primitives — thirteen of
them now, from simple boxes and cylinders through pyramids, wedges,
rounded cubes, pipes, rings, and arches, chosen for what's actually useful
to build furniture and architecture with, not for sheer variety — into an
object, position/rotate/scale/colour each one (selecting a part highlights
it directly in the preview, not just in the list), give it a name and
description, and attach behaviour (Interactable, Light Source, Seat,
Storage, Door, Computer, Decoration, Trigger, Audio Source, Music Player,
Reflective Surface)
purely through properties — no code. Save it, and it joins your permanent
object library.

Then press **B** anywhere in the room to enter **Build Mode**: the camera
freezes right where you're standing, the cursor comes free, and a
**Builder Phone** slides up from the lower-right corner — a small device
you've taken out, not a separate editor screen; the room keeps rendering
behind it the whole time. Tap something from its Construction Library or
Saved Objects tabs and a transparent, rotatable preview follows your
pointer (or your drag, on touch) until you confirm or cancel it. Click any
placed object — or any piece of Workshop furniture — to select it,
adjust its position/rotation/scale/colour precisely, or hit Move to pick
it up and set it back down somewhere else, through that exact same
transparent-preview mechanic. Furniture keeps tracking the Workshop's own
layout unless you've actually moved it; only what you've personally
repositioned is remembered as yours.

Objects you design and place are permanent, save automatically, and reuse
the same interaction pipeline every hand-built piece of furniture in the
room already uses — a chair you design with a Seat behaviour works exactly
like the workbench's own chair. They're also real obstacles now — walk
into a wall you've built and you stop, the same as walking into any other
piece of furniture. See `docs/WORLDBUILDER.md` for the full architecture,
including why it was built to generalise to future rooms and buildings
without needing to change.

Alongside your own designs, a permanent **Construction Library** of 30
pieces — Structural (Wall, Half Wall, Floor, Ceiling, Roof, Pillar, Beam,
Stairs, Ladder...), Openings (Door, Double Door, Window, Large Window,
Archway...), Workshop (Table, Bench, Shelf, Cabinet, Storage Crate), and
Utilities (Light, Switch, Sign, Fence, Gate) — is always available in
Build Mode — the alphabet everything else gets built from. The Door piece
already swings open on its own, Cabinet and Storage Crate already hold
things, Light already lights up its surroundings; these are real, if
plain, building blocks, not mockups.

## The world

The workshop's doors and windows now lead somewhere real. Open the door,
and it opens onto an actual, continuous outdoor world — no loading, no
fade, no separate scene. Walk outside, turn around, and the workshop is
standing right there behind you, with a plain exterior shell and a roof.
Walk back in and everything is exactly where you left it, because it never
stopped existing.

Outside is deliberately close to empty: flat ground as far as you can see,
the same sky, weather, and time-of-day the interior already had (they were
always scene-wide, so nothing needed to change there), and nothing else —
no trees, no scenery, no other buildings. That's on purpose. This is meant
to be a world you build into over time using the Builder and the
Construction Library, not a landscape someone generated for you before you
arrived. Build Mode places objects on the outdoor ground exactly the same
way it places them on the workshop floor.

See `docs/WORLD.md` for the full write-up, including what turned out to be
an actual bug behind the old doorway (a wall with no real opening in it,
not just a cosmetic simplification) and how it was fixed.

## The reading and listening corner

The reference bookshelf, reading chair, and music cabinet share one side
of the room with the computer desk now — walk from the desk south along
the east wall and you pass the bookshelf, then the chair, then the
cabinet, arranged as one deliberate corner rather than separate objects
dropped into the room. It's meant to be somewhere you'd actually stop:
put a record on, sit for a few minutes, read something, think about
what's next — before heading back to the workbench or the desk.

## Music

Interacting with the music cabinet opens a real personal music library,
not a placeholder. Point it at a folder shaped like `Artist/Album/song.mp3`
(with an optional `cover.png` per album) and it's scanned recursively —
artists, albums, songs, and artwork, all discovered from the folder
structure itself, no metadata tagging required. Browse by Artists, Albums,
Songs, Recently Added, Recently Played, Most Played, or Favourites, search
across all of them at once, and build playlists (create, rename, reorder,
duplicate, delete). Full playback — play/pause/stop/previous/next, seek,
volume, mute, shuffle, repeat, a real queue — keeps running in the
background exactly like it would on a real device: close the panel, walk
across the room or out into the world, and the music just keeps playing.

The library remembers where you pointed it and reconnects automatically
next time your browser still trusts the folder; if it doesn't, one tap
reconnects it. This uses the File System Access API, which — as of this
writing — only Chromium-based browsers (Chrome, Edge) support; the library
manager says so plainly rather than showing a broken button anywhere else.

Nothing about this is hardcoded to the cabinet specifically — any object
built with the Builder can carry a "Music player" behaviour and open the
exact same library the exact same way. The cabinet itself — turntable,
amplifier, bookshelf speakers, records stored below — is just the physical
object that happens to open it; redesigning it entirely (which happened in
a later pass, see `docs/ARCHITECTURE.md`'s furniture notes) never touched
this system at all. See `docs/MUSIC.md` for the full architecture.

## Player identity

"Not a character creator — a system that allows somebody to gradually
become whoever they want to be." Your character is built from simple,
clean primitive shapes (think Minecraft, not a realistic human) — Head,
Torso, Upper/Lower Arm, Hand, Upper/Lower Leg, Foot — each one a real
jointed part (shoulder, elbow, wrist; hip, knee, ankle), not a fixed model.
The Wardrobe app, on the computer alongside every other app, edits every
part's width/height/depth, colour, material, and an optional texture — paint
directly onto it or import your own image — with a live preview that
updates as you go.

Save as many outfits as you like (rename, duplicate, delete, wear
instantly); whatever you're currently wearing is remembered between visits
the same way everything else in the Workshop is. The Workshop stays
strictly first-person — you're not meant to see yourself constantly, only
the way you naturally would in real life (looking down at your own hands
or feet). Clothing, accessories, mirrors, and animation are all explicitly
future work the rig was built to support without a redesign — see
`docs/PLAYER.md` for the full architecture, including a design approach
that didn't survive contact with the computer's existing panel system and
what replaced it.

## Settings

The computer's Settings app is the Workshop's one central place to
configure itself, rather than a browser menu or a hidden default: Graphics
(render distance, shadow quality, lighting quality, anti-aliasing, frame
rate limit), Performance (Performance/Balanced/Quality presets, "Optimise
For This Device", and a plain-language performance summary — current
performance, current preset, approximate FPS, nothing more technical than
that), Display (field of view, UI scale), Controls (mouse/touch
sensitivity, invert look), Audio (master/music/effects/ambient volume),
and a Danger Zone for long-term maintenance (clear the Workshop's cache,
reset settings, reset your character, or a full factory reset back to a
fresh first-launch state — every action confirms before doing anything,
and factory reset asks twice). Everything except the Danger Zone is
opt-in — the Workshop looks exactly as it always has until you change
something, and every value you do change persists like everything else.
See `docs/PERFORMANCE.md` for the graphics/performance write-up and
`docs/REFINEMENT.md` for the Danger Zone and the save-versioning system
behind "Factory Reset."

## What persists

Positions, lighting on/off, clock mode, the current environment (mode,
weather, and — for Workshop Dynamic — exactly when it last changed, so it
can keep evolving while you're away), your music
library (locations, favourites, play counts, playlists, and exactly where
playback was), every Workshop setting you've changed, your character's
appearance and every outfit you've saved, and every project (including its
physical presence on the bench) and note, every object you've designed and
every copy you've placed in the room, which computer app and which bench
project you last had active, and where you were standing — all saved
automatically (on an interval, on tab-hide, and before the page closes) to
`localStorage` (plus IndexedDB for the music library's folder access and
your saved texture images — see `docs/MUSIC.md` / `docs/PLAYER.md`), and
restored exactly on your next visit. Two small buttons in the top-left
corner export/import that same save data as a plain JSON file, for manual
backup or moving to another browser (texture images, being in IndexedDB
rather than the save file itself, don't travel with that export — moving
to another browser would bring outfits and proportions across, but
custom-painted or imported textures would need re-adding).

## Project structure

See `docs/ARCHITECTURE.md` for the full explanation. Short version:

```
index.html       entry point + PWA meta tags
manifest.json    PWA manifest
service-worker.js  offline caching (stale-while-revalidate) — see docs/POLISH.md
assets/icons/    generated app icons (see docs/POLISH.md)
src/core/        engine primitives (Engine, EventBus, ECS-lite, PluginManager)
src/systems/     one file per system (lighting, weather, camera, world environment, persistence...)
src/entities/    furniture + room-shell builders (real openings + exterior shell), all placeholder geometry
src/computer/    the computer as one self-contained object — see docs/COMPUTER.md
src/workbench/   the workbench + Project Presence system — see docs/WORKBENCH.md
src/worldbuilder/ the world creation system (Builder + Build Mode + Construction Library) — see docs/WORLDBUILDER.md, docs/WORLD.md
src/music/       the real music library + player — see docs/MUSIC.md
src/settings/    Workshop Settings (persisted data + the system that applies it) — see docs/PERFORMANCE.md
src/player/      the player character rig + appearance/outfit/texture persistence — see docs/PLAYER.md
src/data/        room layout data, project/notes stores
src/ui/          overlays (the diegetic panels) + the minimal HUD
src/utils/       placeholder factories, procedural textures/audio, input abstraction (touch + mouse + keyboard)
src/plugins/     the extension system + a working example plugin
docs/            architecture, roadmap, plugin guide (read these before extending)
assets/          currently empty of artwork on purpose — see assets/README.md
```

## Extending this

Read `docs/PLUGIN_GUIDE.md` first — most new ideas (a GitHub integration, a
local AI companion, workshop calculators, whatever comes next) should arrive
as a plugin, not as edits to core systems. `docs/ARCHITECTURE.md` explains
the interaction pipeline and event names every plugin builds on.

## Technology

Three.js (loaded from a CDN via an import map — see the comment in
`index.html` for how to vendor it locally later), plain ES modules, no
framework, no build tooling. Every visual and every sound the workshop
ships with is generated in code — see `assets/README.md` — the one
exception being the music library, which plays whatever real files you
point it at from your own device (see `docs/MUSIC.md`); nothing is bundled
with the project itself.
