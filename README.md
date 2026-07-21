# The Workshop

A living 3D creative workshop, built to be a place you return to rather than
an app you launch. Runs entirely in the browser, no build step, no backend —
just static files.

## What this is

A calm, believable place to build things, not a game with a win state.
Sit down at the computer to design objects, animations, outfits, or
entire Beings; step away and carry a Workshop Phone to keep building,
managing your creations, or just talking to Bubble while you walk
around; leave, and the Workshop keeps living without you — weather
moves on, Bubble wanders, time keeps its own pace.

## Philosophy

- **One application, not many.** The Computer is for creating; the
  Phone is for using; nothing here is a separate mode bolted onto the
  side.
- **Modular by construction.** Every major system — the Builder's own
  asset library, the Phone's own app registry, Beings, plugins — is
  built so a new one can be added without touching what already exists.
- **Believable over flashy.** Small, quiet details (a resident that
  continues its own routine while you're away, dust motes catching the
  light near a window) matter more than any single showpiece feature.
- **A real place, not a save file.** Nothing should feel like you're
  reopening software — see `docs/PERSISTENCE.md` for what that actually
  means architecturally.

## Features

- A full 3D Workshop room: a computer desk, a workbench, a wardrobe and
  mirror, a quiet sitting corner, real weather and day/night cycles.
- **The Computer** — Builder (objects, buildings, Blueprints), Being
  Creator, Wardrobe, Animation Editor, AI Mission Control (a local
  Ollama-backed resident), Settings, Diagnostics, and a Browser that
  doubles as the Workshop's own universal interface — the wider internet
  alongside `workshop://`, `host://`, and `plugin://` pages for the
  Workshop itself, the Workshop Host, and anything a plugin registers.
- **The Workshop Phone** — a carried companion with its own modular app
  grid (Builder, Beings, Wardrobe, Bubble, Browser, Workshop, Emotes,
  Settings) that never freezes the player while it's open.
- **A living resident (Bubble)** with its own personality traits, moods,
  emergent preferences, and continuity — it keeps existing whether or not
  the Workshop is open, and gradually becomes recognisable as itself
  rather than a generic assistant.
- **A persistent, continuing world** — weather, time, Bubble, and
  Beings all pick up naturally from wherever they'd plausibly be after
  however long you were away, not frozen exactly as left.
- Runs entirely in the browser: no build step, no backend, installable
  as a Progressive Web App, fully responsive from desktop to phone.

## Quick start

Plain ES modules — no build step, nothing to install — but it needs to
be served over HTTP, not opened as a bare `file://` URL (browsers block
module imports from those). Any static file server works:

```bash
git clone <this repo>
cd workshop
python3 -m http.server 8000   # or: npx serve .
```

Open the printed local URL, click **Step inside**, and you're in. See
`docs/SETUP.md` for the complete setup guide, including the optional
local-AI setup.

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

## Talking to Bubble / local AI (optional)

Entirely optional — the Workshop works fully without this. Bubble, and
AI Mission Control on the computer, can talk to a real local language
model through [Ollama](https://ollama.com) running on your own machine,
nothing sent anywhere else.

**See `docs/SETUP.md` for the complete guide** — installing Ollama,
recommended models, starting it so the Workshop can actually reach it
(the one genuinely non-obvious step, and what the included
`start-ollama-for-workshop.ps1` launcher script is for), and
troubleshooting if AI Mission Control shows "disconnected."

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
| B | Take out the Workshop Phone (also the "Phone (B)" button, top-left) — it reopens to whichever app you last had open; the Builder app is Build Mode. See below |
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
| Computer desk | Sit down — the monitor powers on, the room softly fades behind it. A real creative workstation: Projects, Journal, Browser, AI, Media, Builder, Tools, Settings, Wardrobe. See below. |
| Pinboard | Full project planning board — every project, any status, pinned as cork notes |
| Workbench | Physically shows whatever project you're currently focused on — lean in for a small panel to finish it, switch to another, or start something new. See below. |
| Notebook (on the workbench) | A page of free-form notes, saved automatically — separate from whatever project is currently on the bench |
| Music cabinet | A proper vinyl listening setup — turntable, amplifier, bookshelf speakers, records stored below. Opens the real music library — see "Music" below |
| Shelving | Documentation & finished-project archive — full notes and any saved calculations, not just a title (honestly empty until there's something to archive) — the reference bookshelf at the top of the reading corner |
| Tool storage | The Workshop's toolbox — calculators and planning tools, organised by category, pinnable, with a builder for making your own |
| Reading chair | Sit for a while — a quiet arrival moment, then a small "Read" tab opens a book panel: the Workshop's own story, or the finished-project archive, both read from the chair itself. Part of the same reading-and-listening corner as the bookshelf and music cabinet |
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
it's meant to feel like it belongs to the object. Ten tabs live on it:

- **Projects** — every project you've got, planning through done (the same
  data as the pinboard and workbench, just the full picture)
- **Journal** — a dated log, not a single page: entries stay put once
  written, a "New entry" button starts today's, and a rail of past
  entries reads back through what came before. Separate from the
  physical notebook, which stays a single page you're always
  mid-sentence in
- **Browser** — the Workshop's own connection to everything: the wider
  internet, and (via `workshop://`/`host://`/`plugin://` pages) the
  Workshop itself, the Workshop Host, and any plugin that registers a
  page — see `docs/BROWSER.md`
- **AI Control** — Mission Control for Bubble, the Workshop's own
  resident: identity, personality traits and behaviour dials, memory,
  embodiment, a live Resident Health readout, and a Resident Sandbox for
  testing changes safely — see `docs/AI.md`
- **Media** — reflects the real music library, wherever you last left it
- **Builder** — design new objects for the world (see below)
- **Wardrobe** — edit your own character's proportions, colours,
  materials, and textures, with a live preview — see "Player identity" below
- **Animation Editor** — pose and choreograph custom animation clips
- **Being Creator** — design a Workshop Being (see `docs/BEINGS.md`)
- **Tools** — the Workshop's toolbox: calculators and planning tools by
  category, pinning, recent runs, saving a result to a project, and a
  Calculator Builder for making your own — see `docs/TOOLS.md`. The
  physical tool cabinet opens the exact same toolbox.
- **Settings** — the Workshop's full configuration, and Workshop Data export/import — see "Settings" below

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

**Builder**, one of the computer's apps. It's a simple in-world
modelling tool, not a Blender competitor — an even split, a large live
preview always visible on one side (drag to orbit, scroll to zoom) and
every editing control on the other. Assemble primitives — thirteen of
them, from simple boxes and cylinders through pyramids, wedges,
rounded cubes, pipes, rings, and arches, chosen for what's actually useful
to build furniture and architecture with, not for sheer variety — into an
object, position/rotate/scale/colour each one (selecting a part highlights
it directly in the preview, not just in the list), give it a name and
description, and attach behaviour (Interactable, Light Source, Seat,
Storage, Door, Computer, Decoration, Trigger, Audio Source, Music Player,
Reflective Surface)
purely through properties — no code. Save it, and it joins your permanent
object library. An imported `.glb`/`.gltf` model can be used the exact
same way as something you designed from primitives — see "Importing
models" below.

Then press **B** anywhere in the room to take out the **Workshop Phone**
and open its **Builder** app — that's **Build Mode**. (The phone reopens
to whichever app you last used, so tap Builder on its home grid if it
lands somewhere else.) Mouse-look pauses and the cursor comes free while
the phone is out, but you can keep walking — building while moving
naturally through the environment is deliberate. The phone slides up from
the lower-right corner — a small device
you've taken out, not a separate editor screen; the room keeps rendering
behind it the whole time. Tap something from its Construction Library,
Saved Objects, or Imported Models tabs and a transparent, rotatable
preview follows your pointer (or your drag, on touch) until you confirm
or cancel it. Click any placed object — or any piece of Workshop
furniture — to select it, adjust its position/rotation/scale/colour
precisely, or hit Move to pick it up and set it back down somewhere
else, through that exact same transparent-preview mechanic. Furniture
keeps tracking the Workshop's own layout unless you've actually moved
it; only what you've personally repositioned is remembered as yours. A
fifth tab, Terrain, sculpts and paints the ground itself — see "The
world" below.

Objects you design and place are permanent, save automatically, and reuse
the same interaction pipeline every hand-built piece of furniture in the
room already uses — a chair you design with a Seat behaviour works exactly
like the workbench's own chair. They're also real obstacles now — walk
into a wall you've built and you stop, the same as walking into any other
piece of furniture. See `docs/WORLDBUILDER.md` for the full architecture,
including why it was built to generalise to future rooms and buildings
without needing to change.

Alongside your own designs, a permanent **Construction Library** of
around fifty pieces — Structural (Wall, Half Wall, Floor, Ceiling, Roof,
Pillar, Beam, Stairs, Ladder...), Openings (Door, Double Door, Window,
Large Window, Archway...), Nature (Tree, Bush, Flower, Rock, Log, Grass
Patch, Garden Bed), Paths (Stone, Gravel, Dirt, Timber, Concrete),
Lighting (Garden Light, Street Light...), Workshop (Table, Bench, Shelf,
Cabinet, Storage Crate), and Utilities (Light, Switch, Sign, Fence,
Gate) — is always available in Build Mode — the alphabet everything else
gets built from. The Door piece already swings open on its own, Cabinet
and Storage Crate already hold things, Light already lights up its
surroundings, and every Nature piece genuinely sways in the wind; these
are real, working building blocks, not mockups.

### Importing models

Alongside building from primitives, the Builder Phone's own Imported
Models tab can bring in a real `.glb`/`.gltf` model and place it exactly
like anything else — the same import your character or a custom Being
can use, so a model imported once is available everywhere in the
Workshop that can use one, saved and reloaded automatically like
everything else. See `docs/WORLDBUILDER.md` for the full account.

## The world

The workshop's doors and windows lead somewhere real. Open the door, and
it opens onto an actual, continuous outdoor world — no loading, no fade,
no separate scene. Walk outside, turn around, and the workshop is
standing right there behind you, with a plain exterior shell and a roof.
Walk back in and everything is exactly where you left it, because it
never stopped existing.

The ground itself is real and editable — a genuine heightmap, sculptable
right from Build Mode's own Terrain tab (raise, lower, flatten, smooth,
terrace, and paint grass/dirt/rock/sand/gravel/mud/path), the same
ground the whole Workshop actually walks and builds on, not a separate
overlay. Beyond it, deliberately close to empty: the same sky, weather,
and time-of-day the interior already had (they're scene-wide), and
otherwise nothing you didn't put there yourself. This is meant to be a
world you build into over time using the Builder, the Construction
Library's Nature and Paths pieces, and the terrain tools — not a
landscape someone generated for you before you arrived. Build Mode
places objects on the outdoor ground exactly the same way it places them
on the workshop floor.

See `docs/WORLD.md` for the full write-up.

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
the same way everything else in the Workshop is. The Workshop is
primarily first-person — you're not meant to see yourself constantly,
only the way you naturally would in real life (looking down at your own
hands or feet) — but a full mirror (the wardrobe's own) and a
first/third-person toggle (**V**) both exist for actually seeing an
outfit, or a Builder creation, from outside yourself. A full keyframe
Animation System and Emote Wheel let you pose and trigger custom
animation clips too — see "Controls" above. Clothing and accessories
remain future work the rig was built to support without a redesign —
see `docs/PLAYER.md` for the full architecture, including a design
approach that didn't survive contact with the computer's existing panel
system and what replaced it.

## Settings

The computer's Settings app is the Workshop's one central place to
configure itself, rather than a browser menu or a hidden default:
General (room lights, and Workshop Data export/import), Atmosphere (live
weather, sky, wind, sun/moon/stars, and saved atmosphere profiles —
"the central place for controlling environmental conditions"), Graphics
(render distance, shadow quality, lighting quality, anti-aliasing, frame
rate limit), Performance (Performance/Balanced/Quality presets, "Optimise
For This Device", and a plain-language performance summary — current
performance, current preset, approximate FPS, nothing more technical than
that), Display (field of view, UI scale), Controls (mouse/touch
sensitivity, invert look), Audio (master/music/effects/ambient volume),
Diagnostics, and a Danger Zone for long-term maintenance (clear the
Workshop's cache, reset settings, reset your character, or a full
factory reset back to a fresh first-launch state — every action
confirms before doing anything, and factory reset asks twice).
Everything except the Danger Zone is opt-in — the Workshop looks exactly
as it always has until you change something, and every value you do
change persists like everything else. See `docs/PERFORMANCE.md` for the
graphics/performance write-up and `docs/REFINEMENT.md` for the Danger
Zone and the save-versioning system behind "Factory Reset."

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
`localStorage` (plus IndexedDB for the music library's folder access, your
saved texture images, and imported models — see `docs/MUSIC.md` /
`docs/PLAYER.md`), and restored exactly on your next visit. Settings' own
"Workshop Data" section (General tab) exports/imports that same save data
as a plain JSON file, for manual backup or moving to another browser
(texture images and imported models, being in IndexedDB rather than the
save file itself, don't travel with that export). AI Mission Control has
its own, separate Export/Import for a single resident profile, shareable
on its own — see `docs/AI.md`.

## Project structure

See `docs/ARCHITECTURE.md` for the full explanation. Short version:

```
index.html       entry point + PWA meta tags
manifest.json    PWA manifest
service-worker.js  offline caching (stale-while-revalidate) — see docs/POLISH.md
assets/icons/    generated app icons (see docs/POLISH.md)
src/core/        engine primitives (Engine, EventBus, ECS-lite, PluginManager)
src/systems/     one file per system (lighting, weather, camera, world environment, terrain, persistence...)
src/entities/    furniture + room-shell builders (real openings + exterior shell), all placeholder geometry
src/computer/    the computer as one self-contained object — see docs/COMPUTER.md
src/workbench/   the workbench + Project Presence system — see docs/WORKBENCH.md
src/worldbuilder/ the world creation system (Builder + Build Mode + Construction Library + terrain) — see docs/WORLDBUILDER.md, docs/WORLD.md
src/music/       the real music library + player — see docs/MUSIC.md
src/settings/    Workshop Settings (persisted data + the system that applies it) — see docs/PERFORMANCE.md
src/player/      the player character rig + appearance/outfit/texture persistence — see docs/PLAYER.md
src/ai/          AI Mission Control's own configuration (identity, traits, behaviour, memory, providers) — see docs/AI.md
src/resident/    Bubble — behaviour, movement, world awareness — see docs/RESIDENT.md
src/host/        the Workshop Host (Browser-facing local services, permissions, plugins) — see docs/HOST.md
src/data/        room layout data, project/notes stores
src/ui/          overlays (the diegetic panels) + the minimal HUD
src/utils/       placeholder factories, procedural textures/audio, input abstraction (touch + mouse + keyboard)
src/plugins/     the Plugin SDK + three working example plugins — see docs/PLUGIN_SDK.md
docs/            architecture, setup, roadmap, plugin guide, and history (read these before extending)
assets/          currently empty of artwork on purpose — see assets/README.md
```

## Extending this

Read `docs/PLUGIN_SDK.md` first — a `manifest` + `setup(Workshop)` plugin
can register a Browser page, a Phone app, a Builder asset, a Host
service, and its own isolated storage, all through one object, with real
permissions and error isolation so a broken plugin can't take the
Workshop down. `docs/PLUGIN_GUIDE.md` documents the lower-level
registries the SDK is built on, for anything already written against
them directly. `docs/ARCHITECTURE.md` explains the interaction pipeline
and event names every plugin builds on.

## Technology

Three.js (loaded from a CDN via an import map — see the comment in
`index.html` for how to vendor it locally later), plain ES modules, no
framework, no build tooling. Every visual and every sound the workshop
ships with is generated in code — see `assets/README.md` — the one
exception being the music library, which plays whatever real files you
point it at from your own device (see `docs/MUSIC.md`); nothing is bundled
with the project itself.

## Development history

This project has been built across many phases, each with its own goal
and its own honest account of what was built, what was deferred, and
what was learned. That full story — including the maintainer's own
periodic reflections — is preserved in full in **`docs/HISTORY.md`**
rather than cluttering this page (and is readable from inside the
Workshop itself, at `workshop://history` in its own Browser). Worth
reading if you're curious how the Workshop got here; not required
reading to actually use it.

**Contributing or continuing development?** Start with
`docs/HANDBOOK.md` (the engineering handbook — what the Workshop is and
the principles that built it), then `CLAUDE.md` at the repository root
(the practical entry point for repository-first development: ground
rules, conventions, and the per-phase workflow). `docs/RELEASE_REVIEW.md`
is the independent review that closed Version 2, and
`docs/ROADMAP_V3.md` is its draft of where Version 3 could naturally go.
