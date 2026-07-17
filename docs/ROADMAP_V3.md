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

**Risks:** imported content is the first *untrusted* data the Workshop
would render — validation needs the same care `PluginManifest`
already shows. Versioned schemas from day one, or migrations multiply.

## Phase 8 V3.0.8 — Creative Flow (thinking without friction)

**Purpose:** refine the entire creative workflow so ideas move naturally throughout the Workshop without interrupting momentum.

**Why it matters:** The Workshop is fundamentally a creative operating system. Every transition between the Browser, Workbench, Notebook, Phone, Builders and archive should feel like part of one continuous creative process rather than separate applications competing for attention.

This phase is not about adding new tools.

It is about making existing tools disappear into the creative process.

**Systems involved:** Browser, Notebook, Pin Board, WorkbenchSystem, PhoneSystem, Builders, ProjectsStore, Builder Library.

**Opportunities it creates:** Better continuity between tools, faster iteration, fewer interruptions, and a stronger feeling that the Workshop supports thinking rather than demanding attention.

**Version 2 carry-over:** Existing workflows should also be reviewed for unnecessary friction before introducing new capabilities. Layout consistency, navigation clarity and responsive interfaces are all part of creative flow. Existing management surfaces should comfortably accommodate growing libraries without obscuring or hiding functionality.

**Risks / considerations:** Every workflow improvement should reduce friction without reducing intention. Simplicity should never come at the expense of understanding.

## Phase 9 V3.0.9 — Real Assets, Honestly Introduced

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

**Risks:** binary assets end the "everything generated in code" purity
— cross that line deliberately, in the docs as well as the repo, or
not at all.

## Phase 10 V3.1.0 — Workshop Character (a place with its own personality)

**Purpose:** strengthen the Workshop's identity until returning to it feels like returning somewhere familiar rather than launching an application.

**Why it matters:** By this stage the Workshop will already remember projects, weather, conversations, furniture placement and history. This phase focuses on allowing those systems to quietly combine into something more meaningful: character.

Character is not another feature.

It is the accumulated personality that emerges when many small systems consistently reinforce one another.

Different Workshops should naturally begin feeling different because of the choices made within them rather than through cosmetic customisation alone.

**Systems involved:** Bubble, Residents, WorldAwareness, ConversationMemory, WeatherSystem, AudioSystem, LightingSystem, ProjectsStore, Browser, environmental storytelling.

**Opportunities it creates:** The Workshop becomes increasingly recognisable as *your* Workshop through accumulated history rather than progression systems or unlocks.

**Risks / considerations:** Personality should emerge naturally from existing systems. Resist introducing artificial personalisation mechanics where genuine continuity achieves the same result more honestly.

## Phase 11 V3.1.1 — Accessibility & Comfort Pass

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

**Risks:** the 3D world itself has hard limits a pass can't erase — be
honest in the docs about what is and isn't achievable, in the
project's own tradition.

---

## Deliberately not proposed

Multiplayer, scoring/progression, procedural outdoor scenery, and a
traditional settings menu remain non-goals per `docs/ROADMAP.md` —
nothing in this review found a reason to reopen any of them. A test
harness is likewise not proposed as a phase: `CLAUDE.md` records the
standing position (introduce real unit tests only if a phase's logic
demands them, as its own deliberate decision).
