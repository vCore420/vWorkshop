# Version 3 — Draft Roadmap (a recommendation, not a plan)

Written by the v2.2.3d independent release reviewer, from the completed
Version 2 alone. This deliberately does not attempt to predict the
project's future — it identifies the directions that Version 2's own
architecture, deferrals, and half-open doors already point toward. Every
phase below traces back to something the repository itself says: an
explicitly-built-ahead foundation, a deferral with a named reason whose
condition is now (or will become) met, or a workflow the current
Workshop starts but doesn't finish. Reorder, merge, or discard freely —
the sequencing here follows dependency and risk, nothing more sacred.

The one structural recommendation that isn't a phase: Version 3 moves to
repository-first development, and its first habit should be keeping
`CLAUDE.md`, the per-domain docs, and each phase's account current *as
part of the change*, not as an afterthought. Version 2's documentation
discipline is the asset the new workflow depends on most.

---

## Version 3 Philosophy

Version 2 established the Workshop's identity.
Version 3 is about inhabiting it.
The purpose of Version 3 is not to make the Workshop dramatically larger, but to make it noticeably deeper.
Every phase should strengthen the feeling that the Workshop exists independently of its visitor.
When choosing between adding another feature or enriching an existing place, prefer depth over breadth.
The Workshop should gradually become somewhere people enjoy returning to, not because there is always something new to do, but because it quietly becomes more familiar each time they return.

---

## Phase 1 V3.0.1 — Completing Promises (the body remembers)

**Purpose:** wire in the forward-looking infrastructure Version 2
explicitly built and left waiting, before any new foundations are laid.

**Why it matters:** `TwoBoneIK.js` is real, working, tested math with no
caller; `WorkshopSkeleton.autoMapSkeleton()` is a real heuristic that no
imported Being has exercised end to end; both are named in Version 2's
own handover as promises the project made to itself. Completing them
first validates the new development workflow on well-understood ground
and retires the risk that they quietly rot into the "looks dead, isn't"
category forever.

**Systems involved:** `src/player/` (IK, skeleton, animation layers),
`src/beings/` (model import, body compilation), `src/resident/`
(a hand resting on a real surface is the resident-facing payoff).

**Opportunities it creates:** believable contact with the world — feet
on sloped terrain, hands on the workbench — raises the floor for every
future character feature; a fully-exercised import path unlocks
community-made Beings later.

**Version 2 carry-over:** This phase also closes a handful of core interaction systems that never quite reached the quality bar expected of foundational mechanics. Ladder traversal should become fully functional, crouching should restore a comfortable first-person camera without animation artefacts obscuring the view, and imported Builder objects should behave as first-class Workshop objects once placed, remaining selectable, movable and removable like native creations.

These are not new features. They complete interactions that Version 2 intentionally introduced but did not yet finish.

**Risks / considerations:** IK tuning is feel-work, easy to over-run;
scope it to two concrete contacts (foot placement on terrain, one
resident hand-rest) and stop.

## Phase 2 V3.0.2 — Living Spaces (the Workshop settles)

**Purpose:** deepen the Workshop's existing rooms until they begin to feel genuinely lived in rather than simply occupied.

**Why it matters:** Version 2 established the Workshop as a place. Version 3 should now ask what makes somewhere comfortable enough that people naturally want to remain there. The answer is rarely another system. It is usually dozens of small behaviours, environmental details and subtle routines that quietly make a space feel inhabited.

This phase is about deepening what already exists rather than expanding it.

**Systems involved:** Furniture, LightingSystem, AudioSystem, WeatherSystem, Bubble, Residents, WorkbenchSystem, Browser, ambient world behaviours.

**Opportunities it creates:** Chairs become favourite places to sit. Bubble develops preferred sleeping spots. Rooms develop different moods throughout the day. Environmental details naturally accumulate into personality without introducing unnecessary complexity.

**Version 2 carry-over:** Living Spaces also provides an opportunity to revisit environmental details whose individual imperfections subtly undermine the feeling of inhabiting a believable place. Furniture proportions, shelf spacing, decorative object placement, clipping, and material continuity should all be reviewed as part of this pass rather than through isolated fixes.

Examples include furniture alignment, decorative prop clipping, bookshelf proportions, texture continuity across architectural features, and similar environmental polish throughout the Workshop.

The goal is not visual perfection.

The goal is removing the small distractions that remind the player they are looking at constructed geometry instead of a coherent place.

This phase establishes a design pattern for every future room: places should feel comfortable before they become feature-rich.

**Risks / considerations:** Resist adding mechanics disguised as atmosphere. Every addition should exist because it strengthens the feeling of inhabiting a real place, not because it introduces another interaction.

## Phase 3 V3.0.3 — The Reading Chair (the reserved corner)

**Purpose:** deliver whatever "something calmer" the reading corner was
deliberately reserved for — the room's one honestly-labelled empty
promise.

**Why it matters:** the reservation is user-visible (the README says
it). A reading experience — the shelving archive's finished projects
readable from the chair, the Workshop's own story (`workshop://history`)
readable as a physical book, or imported text — would complete the
reading-and-listening corner as one coherent place, using the
archive/browser content that already exists rather than inventing new
content. This is "connect before adding" in its purest form.

**Systems involved:** furniture + interaction pipeline, `src/browser/`
page rendering (one implementation, a new physical door in),
ProjectsStore's archive, possibly a focus pose like the computer's.

**Opportunities:** establishes the pattern for "reading surfaces" any
future room can reuse.

**Risks:** the corner's whole identity is calm — resist making the
chair a third full workstation. One quiet capability, done well.

## Phase 4 V3.0.4 — Workshop Rituals (the rhythm of creation)

**Purpose:** strengthen the Workshop by encouraging natural creative routines instead of explicit progression systems.

**Why it matters:** Real workshops develop rituals. Turning on the radio. Opening the curtains. Sitting at the same chair. Checking yesterday's project. These moments are never required, yet they become part of the experience. Version 3 should encourage similar habits by making existing systems naturally complement one another rather than introducing objectives or rewards.

The goal is not to tell players how to begin their session.

The goal is to allow each player to quietly discover their own rhythm.

**Systems involved:** MusicSystem, LightingSystem, Browser, Phone, WorkbenchSystem, Reading Chair, ProjectsStore, environmental interactions.

**Opportunities it creates:** Sessions become memorable because they begin and end differently for different people. Existing systems become more cohesive through repeated use rather than additional complexity.

**Risks / considerations:** Avoid gamifying routine. Rituals should emerge from comfort and convenience, never from rewards, achievements or required sequences.

## Phase 5 V3.0.5 — Beyond One Building

**Purpose:** the first additional structure — proving `WORLDBUILDER.md`'s
claim that the architecture generalises to future rooms and buildings
without changing.

**Why it matters:** the world outside is deliberately empty *for the
player to build into*, and the Construction Library already contains
walls, roofs, doors, and stairs — but no player-built structure is yet a
*place* the way the Workshop is (interiors with their own lighting
mood, indoor/outdoor sound transitions, furniture that belongs to it).
This phase makes "a shed you built" feel like it exists the way the
Workshop exists.

**Systems involved:** `RoomLayoutSystem`/`WorldObjectsSystem` (interior
detection is the crux), `LightingSystem`, `AudioSystem` (the
indoors-only creak logic already asks "am I inside?" — generalise the
answer), `CameraSystem` collision.

**Opportunities:** once "interior" is a concept rather than a hardcoded
building, the door is open to purpose-built rooms in later versions —
a gallery for Builder objects, a workshop annex, whatever the project
decides places are for.

**Risks:** this is the phase most likely to need genuinely new
architecture (spatial queries, enclosure detection). Prototype the
"am I inside a player-built enclosure?" question first; everything else
hangs off it.

## Phase 6 V3.0.6 — The Workshop Remembers (continuity deepening)

**Purpose:** Extend continuity beyond persistence into memory, 
allowing the Workshop's history to quietly shape the present without 
demanding attention.
*narrative* — the Workshop noticing, gently, what has been happening.

**Why it matters:** `WorldEventLog`, `PlayerPatternMemory`,
`ConversationMemory`, and the resident's preference system already
record rich history that mostly nobody reads back. A returning player
could find honest, quiet evidence of time passed: Bubble mentioning the
storm that happened while they were away, the journal offering "it's
been a while" continuity, the workbench presence subtly dustier on a
long-abandoned project. All signal, no simulation dishonesty — every
claim backed by the logs that already exist.

**Systems involved:** `src/world/` (WorldAwareness, WorldEventLog),
`src/resident/`, `src/ai/PromptComposer.js`, WorkbenchSystem presence.

**Opportunities:** this is the phase where the "place with a memory"
identity compounds; it also gives the AI integration meaningfully
grounded material rather than generic chat.

**Version 2 carry-over:** As conversations become richer, Bubble's presentation should evolve alongside them. The dialogue interface should better support watching Bubble while interacting, allowing expressions, colour changes and animation to remain visible instead of being obscured by large centred dialogue panels.

Conversation should feel more like spending time together than reading a modal window.

**Risks:** tone. One notch too chatty and it becomes a notification
system — the thing the Workshop exists to not be. Prefer three perfect
touches over thirty.

## Phase 7 V3.0.7 — Sharing the Workshop (export without a backend)

**Purpose:** let creations travel — Blueprints, Beings, calculators,
atmosphere profiles, and plugins as shareable files with a graceful
in-Workshop import experience.

**Why it matters:** every store already has clean JSON
export/import primitives (`StorageUtils.downloadJSON/uploadJSON`, the
AI profile's portable-by-design export as the model); what's missing is
a coherent, discoverable "share this / bring this in" workflow and a
documented interchange format per asset type. This is the maximum
community value achievable with zero backend — fully inside the
project's non-goals.

**Systems involved:** `src/host/WorkshopAssetSchema.js` (already the
descriptor language), Blueprint/Being/Tools/Atmosphere stores, the
Browser's asset pages as the natural gallery surface.

**Opportunities:** a de-facto community content ecosystem via ordinary
file sharing; a validated import path is also the prerequisite for any
future opt-in sync.

**Version 2 carry-over:** Imported content should feel indistinguishable from native content throughout the Workshop. Every surface capable of creating an asset should also provide a clear and discoverable way to browse, import and manage previously created assets of that type.

Creation without retrieval is an incomplete workflow.

**Playtesting notes (post-v3.0.5):** a direct instance of this phase's
own "creation without retrieval is an incomplete workflow" — the
Phone's Beings app shows no list of a player's own saved/created Beings
to place, and the Being Creator app on the computer has the same gap.
A Being can be designed but never browsed back for placement the way a
Builder object already can.

**Risks:** imported content is the first *untrusted* data the Workshop
would render — validation needs the same care `PluginManifest`
already shows. Versioned schemas from day one, or migrations multiply.

## Phase 8 V3.0.8 — Bubble Gains Hands (Mission Control, extended)

**Purpose:** two related threads, both scoped from a dedicated set of
post-v3.0.7 notes (`Notes_Post_v3.0.7.md`) rather than Version 2
carry-over. First, close a handful of real friction points in Bubble's
own conversation surface. Second — the larger half — let a resident's
*capabilities*, not just its identity, be configured from Mission
Control: named, sandboxed Workshop functions a resident can be granted
(move to a coordinate, check the weather, flip a light), with the
ability to author new ones and share them the same way Phase 7 just
made Blueprints and Calculators shareable.

**Why it matters:** Phase 6 already grounded Bubble in what's genuinely
happening in the Workshop (`WorldEventLog`, `WorldAwareness`,
`ConversationMemory`); Phase 7 already made every Workshop creation
exportable. Neither gave a resident anything to *do* — everything Bubble
knows stays read-only, and every tool Mission Control offers configures
who a resident is, never what it can act on. This phase is the natural
join of those two: acting capability, built and shared through the
identical mechanisms this project just finished proving out.

**Systems involved:** `src/resident/` (`ResidentConversation.js`,
`ConversationMemory`, `ResidentContext`/`PromptComposer.js`), `src/ai/`
(the AI connection layer any function-calling plumbing sits on top of),
AI Mission Control's own Profiles section (`residentsPage`), the systems
a granted function would actually call into —
`WorldObjectsSystem`/`BuildModeSystem`/`BeingSpawnerSystem` (placement),
`EnvironmentSystem`/`TimeOfDaySystem` (weather/time), `LightingSystem`
(the Workshop's own lights), `MusicSystem` (playback) — and
`AssetService`/`StorageUtils` for exporting/importing custom functions,
reusing Phase 7's envelope pattern rather than inventing a second one.

**A. Bubble's conversation surface.** Real, ordinary chat-UX friction,
closed rather than left to accumulate: long messages wrap instead of
overflowing, capped at roughly four visible lines before a vertical
scrollbar appears (deliberately compact, matching Phase 6's own small
"companion" card rather than growing it back into a panel); Bubble's own
replies reveal word-by-word rather than appearing all at once, for a
more natural conversational rhythm; a failed prompt can be retried
without retyping it; the Up/Down arrow keys cycle back through a
player's own previously-sent messages in the input, the same convention
a terminal already uses; and a small, dismissible popup surfaces how
much of the active conversation's own context budget is currently used,
for anyone curious rather than caught out by it.

**B. Granting a resident real Workshop capabilities.** A new concept —
call it a **Workshop Function** — a named, sandboxed capability a
resident can be granted, toggled per-resident from Mission Control's own
Profiles section (the natural home, since that's already where a
resident's configuration lives). Named starting capabilities from the
brief: move to a specific coordinate; fetch the player's own current
coordinates; fetch nearby objects' and other Beings' coordinates; change
the weather or time of day on request; switch the Workshop's own lights
on or off; and, one tier deeper, place a Construction piece, a
Blueprint, or a Being at a location — resolved using the same
coordinate-lookup functions above, not a separate placement path. Basic
Music Player controls (play/pause/skip/volume) round out the starting
set. Beyond the built-ins: the ability to *author* a new Workshop
function from Mission Control, which then becomes just as real a
Workshop asset as anything else Phase 7 made shareable — saved,
exported, and imported through `AssetService`'s own `exportItem`
mechanism, not a parallel one.

**The one hard constraint, named explicitly and non-negotiable:** no
function may do anything outside the Workshop's own parameters — every
capability stays inside the Workshop's existing systems and this browser
tab, nothing reaching a real filesystem, a real network call, or any
other real-world effect. The same boundary `PluginManifest`'s own
capability model already draws for plugins is the standard to hold this
to, not a new, looser one.

**Bubble's own grounding, distinct from acting on the world.** Alongside
capability, Bubble should have access to "basic workshop knowledge" —
described in the brief as wanting Bubble treated as the one true source
of the world it's in, not a generic outside chatbot. This is a
`PromptComposer.js`/`ResidentContext` concern (real, current Workshop
facts folded into what Bubble reasons from), deliberately separate from
the function-calling mechanism above — knowledge is what Bubble *knows*,
functions are what Bubble can *do*, and the two shouldn't be conflated
into one mechanism.

**Opportunities:** Mission Control stops being only "configure who
Bubble is" and becomes "configure what Bubble can do" too — a genuine
expansion of its existing role rather than a new, competing surface.
Once one resident can act through named, sandboxed functions, every
future resident inherits the same mechanism for free.

**Risks:** the highest-stakes phase proposed so far, and the risk is
specific: sandboxing has to be real and enforced at the function layer
itself, not just documented intent — a malformed or malicious custom
function is the first *executed*, not merely rendered, untrusted data
the Workshop would handle, a materially bigger risk than Phase 7's
import validation. Movement and placement functions specifically need to
reuse existing collision/bounds checks rather than a parallel, less
careful path. Scope discipline matters as much as safety: ship the named
built-in capability list first; "author your own function" is powerful
enough that it may deserve its own later milestone rather than landing
in the same pass. And the tone risk Phase 6 already named carries over
unchanged — a resident that can act on everything stops feeling like the
Workshop's own resident and starts feeling like an assistant bolted on.

## Phase 9 V3.0.9 — Creative Flow (thinking without friction)

**Purpose:** refine the entire creative workflow so ideas move naturally throughout the Workshop without interrupting momentum.

**Why it matters:** The Workshop is fundamentally a creative operating system. Every transition between the Browser, Workbench, Notebook, Phone, Builders and archive should feel like part of one continuous creative process rather than separate applications competing for attention.

This phase is not about adding new tools.

It is about making existing tools disappear into the creative process.

**Systems involved:** Browser, Notebook, Pin Board, WorkbenchSystem, PhoneSystem, Builders, ProjectsStore, Builder Library.

**Opportunities it creates:** Better continuity between tools, faster iteration, fewer interruptions, and a stronger feeling that the Workshop supports thinking rather than demanding attention.

**Version 2 carry-over:** Existing workflows should also be reviewed for unnecessary friction before introducing new capabilities. Layout consistency, navigation clarity and responsive interfaces are all part of creative flow. Existing management surfaces should comfortably accommodate growing libraries without obscuring or hiding functionality.

**Playtesting notes (post-v3.0.5):** the Wardrobe's own full-screen menu
(and other similarly-structured overlay menus) reads as noticeably
rougher than the rest of the Workshop's interface — much larger than
any other panel, closer to an early prototype than something built for
the player. Worth folding into this phase's own "layout consistency,
navigation clarity" review rather than a one-off visual patch.
Alongside it: an imported model placed as a World Object can't be
individually reselected through the Builder once placed — today it's
only reachable via a drag/group-select that happens to include it
alongside an ordinary piece. Originally flagged against Phase 1's own
"imported objects should behave as first-class objects" promise;
relocated here since it's fundamentally a Builder workflow friction
point, and Phase 1 has already shipped.

**Risks / considerations:** Every workflow improvement should reduce friction without reducing intention. Simplicity should never come at the expense of understanding.

## Phase 10 V3.1.0 — Real Assets, Honestly Introduced

**Purpose:** begin the long-promised placeholder-to-real transition —
`assets/README.md`'s own plan, executed for one coherent slice
(likely audio first: recorded ambience and interaction sounds through
the existing `AudioSynth` seams).

**Why it matters:** every placeholder call site was deliberately
isolated behind factories precisely so this day would be cheap. Audio
is the highest believability-per-byte slice and the positional system
from Sound & Presence is already in place to carry it.

**Systems involved:** `AudioSynth`/`AudioSystem` (swap seams),
`assets/`, `service-worker.js` (real files change the offline story —
the honest-limits section of `docs/POLISH.md` needs updating in the
same phase).

**Opportunities:** establishes the asset-introduction workflow
(sourcing, licensing notes, caching) every later visual pass reuses.

**Playtesting notes (post-v3.0.5):** icon assets throughout the
Workshop should feel more attached to the Workshop's own identity
rather than reading as generic — a concrete target for this phase's own
placeholder-to-real pass, explicitly flagged during play as belonging
here. Alongside it: outdoor ground textures (the default grass, and
the Builder's own paintable ground textures) read as flat colour with
too little surface detail despite already responding well to colour
and lighting — originally flagged against Phase 2's own environmental
polish, relocated here since it's really the same "placeholder reads
as placeholder" problem this phase already exists to solve, and Phase 2
has already shipped.
As well Doors placed by the builder povit upon interaction from the 
center of the door and not from one side to "hinge" it
the beings, wardrobe and emotes should gain a small fewe default entries, 
3-5 of each like we see for blueprints in buildings, some basic beings 
like cat, dog, person. some basic wardobe stles, a few different shapped 
males and females with different colour pallets suited for both distitave 
genders and more generless entries, i would also like one respectful tastful 
nod to the transgender colour pallet by making one of the default female 
presets reprsent this. and a few basic animations for the emote 
wheel spicifaclly, wave, dance, clap ect 


**Risks:** binary assets end the "everything generated in code" purity
— cross that line deliberately, in the docs as well as the repo, or
not at all.

## Phase 11 V3.1.1 — Workshop Character (a place with its own personality)

**Purpose:** strengthen the Workshop's identity until returning to it feels like returning somewhere familiar rather than launching an application.

**Why it matters:** By this stage the Workshop will already remember projects, weather, conversations, furniture placement and history. This phase focuses on allowing those systems to quietly combine into something more meaningful: character.

Character is not another feature.

It is the accumulated personality that emerges when many small systems consistently reinforce one another.

Different Workshops should naturally begin feeling different because of the choices made within them rather than through cosmetic customisation alone.

However one Solid request for this phase is to place one of out small pot plants on the book shelf somewhere where it doesnt interfare with the books on the shelf

**Systems involved:** Bubble, Residents, WorldAwareness, ConversationMemory, WeatherSystem, AudioSystem, LightingSystem, ProjectsStore, Browser, environmental storytelling.

**Opportunities it creates:** The Workshop becomes increasingly recognisable as *your* Workshop through accumulated history rather than progression systems or unlocks.

**Risks / considerations:** Personality should emerge naturally from existing systems. Resist introducing artificial personalisation mechanics where genuine continuity achieves the same result more honestly.

## Phase 12 V3.1.2 — Accessibility & Comfort Pass

**Purpose:** a dedicated pass on who can actually inhabit the place:
keyboard-only reach for every panel, focus order, screen-reader labels
for the 2D surfaces, motion/comfort options beyond the existing
reduced-motion tokens, readable-text scaling verified everywhere.

**Why it matters:** the v2.2.3d review found genuinely good bones
(aria labels in music UI, `aria-live` regions, token-level
reduced-motion) but no systematic pass ever happened — coverage is
whichever files happened to care. A place that prides itself on being
welcoming should be welcoming here too, and doing it before Version 3
adds more surface is strictly cheaper than after.

**Systems involved:** every DOM surface (`css/`, `src/ui/`, computer
apps, phone apps, browser pages); `docs/DESIGN_SYSTEM.md` as the home
for the resulting standards.

**Opportunities:** the audit doubles as the design-system conformance
sweep Version 3's new surfaces will be held to.

**Playtesting notes (post-v3.0.5):** three concrete "who can actually
inhabit the place" gaps found in play. Zoom and the compass toggle have
no touch-equivalent — zoom needs a HUD button alongside Jump/Crouch,
and the compass toggle needs one in the top-left, similar to the
existing "I'm lost" button. The Esc/menu-close touch buttons are
present but read as too low-visibility to notice reliably. And
separately, the personal music library currently depends on a
Chromium-only file-system API — Firefox and Safari players can't load
their own library at all; a fallback path (even one that trades away
live-folder persistence) would bring the feature to every browser
rather than one.
Sound abient sounds seem to sometimes get left over once the workshop 
application is closed, my computer is left playing some churpping sounds 
long after the browser is closed, is this at all something that can be 
looked at on the workshops end?

**Risks:** the 3D world itself has hard limits a pass can't erase — be
honest in the docs about what is and isn't achievable, in the
project's own tradition.

## Phase 13 V3.1.3 — The Phone Becomes a Device

**Purpose:** grow the Phone from a functional menu surface into
something that actually feels like carrying a device — its own settings
depth, its own presence, apps that feel distinct from one another the
way real phone apps do.

**Why it matters:** the Phone already works well as a mechanism (see
`docs/PHONE.md`), but playtesting found its *identity* hasn't caught up
to its function: there's no way to make it feel like *your* phone (no
wallpaper, no border colour, no home-screen presets), app open/close
transitions don't read as phone-like, and a basic navigation habit — a
bottom bar returning to the home screen — is simply missing. "Real
phone apps share quality features but not themes and designs" is the
standard to hold each app to individually, not just the shell.

**Systems involved:** `PhoneSystem`, `PhoneUI.js`, the Settings app
(both its Phone-facing and PC-facing surfaces), each individual Phone
app.

**Opportunities it creates:** a natural extension of Phase 11's "your
Workshop" identity — a phone a player has actually customised is a
small, concrete way ownership shows up, without drifting into gameplay
progression. It also gives every future Phone app a bar to clear: feel
like its own app, not a reskinned shared template.

**Playtesting notes driving this phase:**

- The bottom bar should return to the phone's home screen when
  pressed — currently it doesn't.
- The Settings app should let a player change the home screen's
  wallpaper (from basic colours through richer presets) and the
  phone's own border colour; app opening/closing should transition
  with a bit more phone-like motion; and each app should read as
  distinctly itself rather than sharing one visual template.
- A 24-hour/12-hour time format toggle belongs in the time settings on
  both the PC and the Phone — the same setting, both surfaces.

**Risks / considerations:** this is cosmetic-adjacent territory the way
Phase 11 explicitly warns against — the difference worth holding onto
is that these are *player-chosen* settings (a wallpaper picked, a
format preferred), not systems inventing personality on the player's
behalf. Keep the scope to genuine device-feel (settings depth,
transitions, per-app distinctness), not a theming engine for its own
sake.

## Phase 14 V3.1.4 — Further Environmental Polish (the room, revisited)

**Purpose:** carry forward the environmental, furniture, and geometry
playtesting notes that would have belonged in Phase 2 or Phase 5 had
they been found in time — both have already shipped, so rather than
reopen finished phases, everything that doesn't have a natural home in
a later phase's own theme lands here instead.

**Why it matters:** this is honestly the same kind of work Phase 2
already named — "review as part of this pass rather than through
isolated fixes" — plus one geometry limitation Phase 5's own
`DoorBehaviour.js` already flagged as a known gap. None of it is new in
kind, only in timing.

**Systems involved:** Furniture, LightingSystem, WeatherSystem, Bubble,
WorkbenchSystem, `ConstructionLibrary.js`/`DoorBehaviour.js`,
`PlayerCharacterSystem`/`CameraSystem` (the shadow item).

**Playtesting notes driving this phase:**

- The first-person missing-head-shadow problem — already attempted
  once, see `docs/HISTORY.md`'s v3.0.3b entry — was reported again
  during this pass; worth a fresh, more careful look rather than
  assuming the earlier fix still holds.
- The room's own furniture layout needs rearranging now that every
  core piece exists — positioning them relative to each other, the
  room's lighting, and its overall feel, rather than the incremental
  placement each piece happened to arrive with.
- The workshop's own interior should feel more generally lit at
  night — not more fixtures, just more spread from the existing main
  lighting (the two desk lights are fine as they are).
- The workbench fan's base clips through the top of the workbench.
- The computer chair's wheel legs don't line up evenly from the
  stand's own centre — each leg is off by a different amount.
- Some furniture colour choices (the wardrobe, the music player's
  stand and speakers) read a little too dark — the wood grain texture
  itself is good, it just needs to pop a bit more while still
  contrasting sensibly with the room.
- The moon's position lags roughly an hour behind the sun's — its
  cycle isn't quite right.
- The desk keyboard model should shift further left, away from the
  mouse, so it isn't sitting on top of the mousepad.
- The north-facing exterior wall's texture doesn't line up across the
  shorter wall segments above/below the window — the same texture
  compresses differently at a smaller height than the full-height
  segments beside it.
- The workshop could use exterior lighting by the front door,
  spreading a bit of light outward.
- Bubble's face projection looks off, especially on the orb body —
  rarely showing more than a dot or two — and the cube body's
  flat-surface projection visibly "hunts" to face the player rather
  than reading naturally.
- A handful of small outdoor details belong right against the
  workshop's own exterior walls — a bench seat, planter boxes under
  the windows — making the workshop itself feel more lived-in from
  outside, distinct from populating the wider surrounding world (still
  a non-goal).
- The Workshop's own original front doors should hinge from the
  outside wall's edge, not the inside — opening them currently clips
  visibly through the wall's own thickness. The concrete, now-observed
  case of the limitation `DoorBehaviour.js`'s own comment already names
  (no true edge hinge, the whole compiled object swings around its own
  centre) — see `docs/WORLDBUILDER.md`'s "Future extension points" for
  the hinge-offset property this would need.

**Risks / considerations:** this is a grab-bag by nature, not a
themed phase — resist inventing a unifying narrative for it that isn't
there. Keep each item a small, isolated fix; nothing here should grow
into new architecture the way Phase 5's own enclosure detection did.

---

## Deliberately not proposed

Multiplayer, scoring/progression, procedural outdoor scenery, and a
traditional settings menu remain non-goals per `docs/ROADMAP.md` —
nothing in this review found a reason to reopen any of them. A test
harness is likewise not proposed as a phase: `CLAUDE.md` records the
standing position (introduce real unit tests only if a phase's logic
demands them, as its own deliberate decision).
