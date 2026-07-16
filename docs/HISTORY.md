# Workshop History

The Workshop's own development history — moved here from the README
(Workshop Workflow phase) so that page can stay focused on introducing
and using the Workshop, while this one keeps the full story preserved
rather than deleted. If you're trying to *use* the Workshop, you
probably want the README, `docs/SETUP.md`, or `docs/ARCHITECTURE.md`
instead — this document is for understanding *how it got here*, phase by
phase, including the maintainer's own honest reflections along the way.

## One contribution

Version 2.0's own phase asked for something different from every other
one before it — not a spec to implement, but one small thing chosen
because it genuinely felt like it belonged, after living inside this
project rather than being told to build it. This section is that answer,
written honestly rather than as another feature announcement.

**What I added:** Bubble is now a little more likely to wander to the
window specifically while it's raining, or during a warm sunrise/sunset
sky, than to any other idle spot at that same moment. Nothing new was
built to make this true — `ResidentController.js` gained one small
method, `_windowWatchWeights()`, that nudges the odds on the exact same
random idle-location pick that already existed, using two signals
(current precipitation, and the same golden-hour time window the sun's
own colour already shifts warm during) that were already true and
already meaningful elsewhere in the Workshop. See `docs/RESIDENT.md`'s
own "A quiet habit" section for the technical account.

**Why this, out of everything it could have been:** I kept returning to
one instruction in particular — "what has this place quietly been
missing all along?" — and the honest answer wasn't a missing object or a
missing screen. Every major system already exists. What's easy to build
and forget about is whether the systems that already exist ever actually
*notice each other*. Weather, time of day, and Bubble's own wandering
have coexisted since early phases without ever once acknowledging one
another. This is the smallest possible thread tying three already-built
systems together, rather than a fourth new one sitting beside them.

**How it fits the philosophy:** "The world should continue naturally
whether the player is watching or not" was this project's own central
idea by the time Persistent World (phase 29) existed — but continuing
isn't the same as *caring* about what's actually happening around you.
An independent resident that's a little more drawn to a window during
weather worth watching reads as attention, not animation. It's also
never guaranteed and never announced — the Workshop doesn't tell you
Bubble likes rain; you'd only ever notice by actually being there enough
times that it stopped looking like coincidence. That's the same standard
`docs/PERSISTENCE.md`'s own "believable, not scripted" language already
holds everything else in this project to.

**How it might influence what comes next:** the weighted-pick mechanism
this needed (`randomIdleLocationId()`'s new optional `weights` argument)
is now sitting there for any future Being, or any future resident, to
use the same way — a Being that prefers shade on a hot day, one drawn to
a fireplace in winter, anything where "usually random, occasionally
shaped by something real" is the right texture for a behaviour. I didn't
build any of those; I only made sure the next person who wants one
doesn't have to invent the mechanism from scratch.

## Reflecting, after thirty-one phases

Asked to, and without touching the roadmap — a few honest thoughts as
the thing's own maintainer, not as a summary of what was built.

**What proved most valuable, architecturally:** the shape that showed up
again and again — a plain store holding data, a system applying it to
the 3D scene, a UI reading and writing through events, never through a
direct reference back — made almost everything added after phase 10 or
so slot in without a fight. The clearest proof isn't a design document,
it's this exact phase: a genuinely new idea (weighted idle picks shaped
by weather) needed one new optional parameter on one existing function,
not a new system. When an architecture is right, small additions cost
what they should cost.

**What surprised me:** how often the right fix turned out to be smaller,
and more embarrassing, than the bug looked. A field named `hour` being
read as `currentTime`. A title string doing double duty as a visibility
check. An outer element's own background nobody remembered was separate
from the panel fading in front of it. None of these needed clever
engineering — they needed someone to actually trace the data instead of
guessing at the shape of the problem from its symptoms. I'd like to
think I got better at reaching for the trace instead of the guess as the
phases went on.

**What philosophy emerged, rather than being declared upfront:** "avoid
letting a fix look more impressive than the bug was." The natural pull,
especially under real time pressure, is to solve a one-line bug with a
satisfying rewrite. The Workshop's own calm, unhurried character only
stayed intact because most fixes here were genuinely boring — a wrong
field name, a missing null check, a duplicated computation finally
shared. Boring fixes are the ones that don't introduce a new bug while
solving the old one.

**Advice to whoever continues this, including a future version of me:**
read the file you're about to change before trusting your memory of what
it does — this project is large enough now that memory is frequently
close but wrong in a small, costly way. When a system already exists
that does almost what you need, extend it with an optional argument
before reaching for a new file; `weights = null` cost less than a
`WindowPreferenceSystem.js` would have, and did the same job. And when a
phase explicitly asks you to slow down, actually slow down — the best
idea in this whole project arrived only after sitting with "what does
this place actually need" for longer than felt efficient.

## Reflecting — Version 2, Phase 16 (The Desk)

Asked, at the end of this phase, to keep writing these down after every
one from now on — a few honest thoughts as the thing's own maintainer.

**What made the biggest difference to how it feels:** not the part I
expected going in. I assumed the monitor bezel would be the headline —
it's the most visually obvious change, screen-on-a-stick to an actual
monitor — but sitting back and looking at the whole thing, the chair's
five-point base did more work. A flat disc under a pole reads as "a
seat," full stop; the same pole on a five-point base with castors reads
as "somebody's office chair," specifically, immediately, without a
single other change needed. It's the same lesson the Workbench's own
vice crank already taught, just louder this time: an object's *category*
is often decided by one small, correct detail, not by its overall mass
or its material quality.

**What actually transformed a collection of objects into a workspace:**
the pairing of the pen holder and the lamp, more than either alone.
Neither one is doing much individually — a cup with two pens in it, a
lamp that was already there — but putting one deliberately in each back
corner is what stopped the desk from reading as "a monitor and some
accessories arranged in front of it" and started it reading as "a desk
with things on two sides of it, the way a real one ends up looking after
a few months of actual use." Symmetry (or a deliberate near-symmetry)
turned out to matter more here than any single prop's own detail level.

**A genuine surprise:** how much the bezel *didn't* need touching to get
right. I'd expected to have to adjust `ComputerSystem`'s hardcoded
screen-projection rectangle to make room for a frame, the same way the
Workbench's own clipboard fix needed real coordinate surgery. It didn't
— the glass mesh that rectangle actually describes never moved, so the
bezel could simply exist as a second, larger, mesh sitting just behind
it. The lesson isn't new (`docs/ARCHITECTURE.md` already says systems
should stay decoupled), but it's satisfying to watch it pay off in
practice: the projection code only ever cared about one mesh's own
transform, so adding a completely different-looking monitor around that
mesh cost nothing in the file that would have been riskiest to touch.

**What I'd continue with, given another week on just this desk:** the
keyboard. It's still a single flat plastic slab — genuinely fine at a
glance, the thing every other piece of desk furniture in this project
also is, but it's the one object here somebody's hands would actually
rest on for hours, and it currently gives nothing back for that. A
subtle keycap suggestion (even just a shallow grid of colour variation,
not real geometry) feels like the next honest "one surface deserves
more than `matte()`'s own numbers" finding, in the same family as this
phase's own bezel and mousepad. I'd also want to actually test whether
`softBox()`'s original intent — a real, cheap faked bevel via smoothed
corner normals rather than a stripped index buffer — is worth building
properly rather than removing outright; I chose the safer, more
honest fix this time (delete what doesn't work) over the more ambitious
one (make it actually work), and I think that was the right call under
this phase's own "refine, don't redesign" instruction, but it's real,
deferred work, not a closed question.

## Reflecting — Version 2, Phase 17 (The Workshop Interior)

**What had the greatest impact on how the space feels:** the
baseboards, by a wide margin, and it wasn't close. That's a strange
thing to report given how much more visually interesting the wall
sconces or the door hardware are — but a room without a baseboard reads
as "geometry that happens to form a box" in a way that's hard to name
until you see the fix. The line where a wall meets a floor is something
every real room has and almost nobody consciously notices; the Workshop
was quietly missing it in all four corners of the building at once, and
adding it did more for "this is a real, built place" than any single
fixture did.

**What made the Workshop feel cared-for rather than just built:** the
light switch actually switching. It's a tiny detail — a toggle that
tilts a few degrees — but a static plate that's clearly supposed to be
a switch and doesn't visibly do anything is the kind of thing that,
once you notice it, makes you start doubting everything else in the
room too. Fixing it fixed more than the switch.

**A genuine surprise:** how much more there was to find just by reading
files I assumed were finished. `Shelving.js` had been sitting with a
fully-built, genuinely nicer colour palette right next to the one
actually in use, silenced by a single `void` statement — not broken,
not wrong, just never connected to anything. I went looking for
baseboards and hinges and came back with that instead. I'm increasingly
convinced this project's own advice ("read the file you're about to
change before trusting your memory of what it does") undersells itself
slightly — it's not just about avoiding mistakes, it's that the reading
itself is where most of the real finds come from.

**Where I'd continue, given another week on just the interior:** crown
moulding, as the ceiling's own equivalent of this phase's baseboard —
I considered it and left it out specifically because one universal
trim gap felt like the honest, provable finding, and two at once starts
to blur into "we redecorated," which this phase's own brief was clear
about avoiding. I'd also want to actually build the ambient building-
creak I talked myself out of this time; I still think it needs a
better-justified trigger than "just because" before it earns a place
next to sounds that all currently have one, but "the building should
sound alive" is a real, still-open brief, not a closed one.

## Reflecting — Version 2, Phase 18 (Furniture & Storage)

**What made the Workshop feel more believable, out of everything this
phase touched:** the tool storage shadow-board, without much
competition. It's a strange thing to keep reporting phase after phase —
that the smallest, cheapest addition outperforms the more elaborate
ones — but the pattern is consistent enough now that I trust it rather
than treat it as a coincidence: a shadow-board silhouette is a handful
of painted rectangles, and it did more for "someone actually organises
this space" than the storage bins, the cork texture, and the cushion
tier combined. I think the reason is that it's the one detail here that
implies a *system* rather than an *object* — it says something about
how the tools get put away, not just what they look like.

**The smallest change with the biggest effect:** the ajar drawer. One
number — a few centimetres of Z offset on a single drawer out of three
— and the whole cabinet stops looking like a still life. I keep
learning this same lesson in a new shape every phase (the pencil on the
clipboard, the pen holder, now this), and I still underestimate it each
time going in.

**Where I'd focus next, given another week on everyday objects:** the
things nobody's touched yet because they're not really "furniture" —
the light switch got a toggle two phases ago, the front door got hinges
last phase, but small fittings like the ceiling light pull cords, the
music cabinet's own cabling, or the wardrobe's interior (visible only
through its own overlay today, never physically) are exactly the kind
of unglamorous detail this project's history keeps rewarding attention
to. I'd also want to actually resolve the drawer-sound question I
deferred this phase rather than left open — not by bending the
furniture/system split, but by asking whether a small, shared
"FurnitureSoundHook" concept is worth the one new seam it would cost,
which felt like a real design decision rather than a phase-scoped one.

## Reflecting — Version 2, Phase 19 (Decorative Details)

**What surprised me most:** how much harder restraint was than
craftsmanship. Every phase before this one had an obvious next target —
a hero prop, a room, a category of furniture — and the work was mostly
about doing it well. This phase's brief was, in effect, "add almost
nothing, and make sure what you do add earns its place," and I found
myself discarding more ideas than I kept: a coffee mug, a second framed
piece, a stack of reference books by the workbench, a rug pattern.
Every one of them would have been fine on its own. None of them passed
"would the Workshop lose a piece of its personality without this," and
I think that's the right outcome even though it made the phase feel
smaller than the ones before it.

**The tiny change with the biggest emotional impact:** the clock, and
it isn't close. Not because of how it looks — it's four painted ticks
and two thin rectangles — but because it's the first decorative object
in the entire Workshop that's actually *true*. Every other detail here
is a static, believable suggestion of a lived-in place; the clock
genuinely tells you what time it is, using data the Workshop already
had. Sitting with that distinction is what convinced me it was worth
building at all, given this phase's own explicit instruction not to add
systems — it isn't a new system, just the first *object* to actually
listen to one that already existed.

**What I hope someone would find, spending an hour just looking
around without touching anything:** that the single plant is on the
*left* window and not the right, and that this was clearly a choice,
not an oversight. That the clock is a few minutes off from their own
watch, because it's showing the Workshop's own time, not a copy of
theirs. That the framed sketch looks like someone's own hand, not a
print bought to fill a wall. None of these are things I'd point to in
a list of features. They're the kind of thing you only notice once,
and then can't stop noticing — which is exactly what this phase's own
brief asked for.

## Reflecting — Version 2, Phase 20 (Visual Identity)

**What had the biggest impact on the Workshop's visual identity:** the
shadow fix, and it isn't close, precisely because of how invisible it
is. Nobody will ever take a screenshot and think "ah, the shadow camera
frustum is being applied correctly now." But shadows are one of the
things that most separates "a lit 3D scene" from "a *place* with real
depth and time of day" — and this one had been quietly, completely
broken for who knows how many phases, hiding behind comments that
confidently described numbers that were never actually reaching the
GPU. Fixing a bug nobody could see, in a system every visible thing in
the Workshop depends on, is exactly the kind of unglamorous work this
whole phase turned out to be about.

**What I'm most pleased with:** finding both regressions by reading,
not by guessing. Neither fix involved trial and error — the shadow bug
was confirmed by grepping the entire codebase for a method call that
simply wasn't there anywhere; the jump bug was confirmed by tracing one
variable's exact lifetime across eleven lines of one function and
noticing it was read one line too early. Both root causes were provable
before a single character of code changed, which is what let me be
confident neither fix needed a compensating workaround anywhere else.
That's the standard I most want future phases held to, this one
included: a bug fix should be able to explain, in advance, exactly why
it will work — not just that it happened to.

## Reflecting — Version 2, Phase 21 (Sound & Presence)

**What stood out:** how differently this phase's own brief read three
past deferrals compared to when I originally wrote them. Each one had
been declined for a specific, honest reason at the time — no clear
cause for an ambient sound, no positional audio to make a clock tick
sound right, no clean architectural seam for a drawer. None of those
reasons turned out to be wrong. What changed is that this phase's own
brief either supplied the missing piece directly (occasional,
contextual sound is explicitly the *goal* here, not a risk to avoid) or
made building the missing piece properly in scope for the first time
(positional audio, a generic sound hook). I found that quietly
satisfying in a way I didn't expect going in — three "not yet, and
here's exactly why" notes, each closed out for a reason that traces
directly back to the original note, rather than someone simply
overriding an earlier decision.

**What I found most rewarding:** the volume fix, of all things. It's
the least interesting line I changed all phase — one number, `0.5` to
`0.3` — but finding it required actually holding seven different
sounds' envelopes in my head at once and noticing that the oldest one
didn't belong with the rest anymore. Nothing about it would ever show
up in a feature list. That's exactly the kind of maintenance this
project's own history keeps rewarding, and I'd rather report that
honestly than pad this reflection with the flashier additions.

## Changelog

<details>
<summary>Full phase-by-phase history (thirty phases so far)</summary>

This project has gone through thirty phases (with one dedicated
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
was first built (phase 23) — and, most recently, a dedicated quality
pass: fixing the player model's own facing direction at its actual root
cause, French door handle placement, a genuinely non-cosmetic Quiet
Corner overlay fix, new Atmosphere and Diagnostics tabs in Settings,
honest cross-browser error handling for music playback, and a resident
whose position now survives a reload even mid-journey (phase 24) — and,
most recently, Beings: a complete, general-purpose system for designing,
saving, placing and managing creatures, animals, robots, or any other
character as ordinary Workshop assets, with its own Being Creator (a real
GLB/GLTF model import pipeline shared across the whole Workshop), Being
Spawner, and Being Manager (phase 25) — and, most recently, a consistency
and immersion pass across the whole Workshop: a root-caused fix for an
inverted crouch animation, Bubble now requiring a direct look before
interacting (and gaining a gentle drag-to-reposition), a genuinely fixed
Notebook close behaviour, per-property manual Atmosphere overrides, and
imported models now usable as Builder shapes and optional player bodies
(phase 26) — and, most recently, World Expansion: the Builder growing
into a true World Builder, automatically recognising any enclosed
structure a player builds as a real interior (the same systems the
Workshop's own room already uses, no manual marking required), a
substantially larger construction catalogue organised into clear
categories, reusable multi-object Blueprints, and optional grid/rotation
snapping with true multi-axis rotation (phase 27) — and, most recently,
the Workshop Phone: a proper personal device carried everywhere,
replacing the old Builder Phone with a modular app framework (Builder,
Beings, Wardrobe, Bubble, Browser, Workshop, Emotes, Settings) that never
freezes the player while it's open (phase 28) — and, most recently, a
Persistent World: a shared time service so Bubble, Beings, and the
environment all answer "what should I have been doing while the player
was away?" from the same elapsed-time calculation, rather than resuming
frozen exactly as they were left (phase 29) — and, most recently, a
Universal Experience pass: the Computer and Workbench's own 3D-projected
screens gained a comfortable-size floor so no interface built on them
ever becomes unreadably small, the shared editing workspace and the
Phone both reorganise on a narrow screen, and touch targets, focus
states, and first-launch performance detection now apply consistently
across the whole Workshop (phase 30).
See `docs/ROADMAP.md` for what's next, `docs/ARCHITECTURE.md`
for how the workshop as a whole is put together, and `docs/COMPUTER.md` /
`docs/WORKBENCH.md` / `docs/WORLDBUILDER.md` / `docs/WORLD.md` /
`docs/POLISH.md` / `docs/MUSIC.md` / `docs/PERFORMANCE.md` / `docs/PLAYER.md` / `docs/REFINEMENT.md` for how those specifically work.

Phase 31A followed: a dedicated Workshop Polish pass and the final
milestone of Version 1 — a real root-caused fix for the computer clock's
own "NaN : NaN" display and a Phone Home-button visibility bug, a subtle
thinking indicator while Bubble is generating a reply, a held-key camera
zoom, the Quiet Corner's own darkened-screen bug fixed at its actual
cause (plus a genuine look-around-while-seated capability it never had),
Emotes rebuilt as a real Phone app instead of an immediate wheel-trigger,
and the dust motes proof of concept evolved into a permanent, two-window
atmospheric effect. See `docs/ROADMAP.md`'s own Phase 31A entry for the
complete account.

**Version 2, Phase 1 — Workshop Residents (v2.0.1)** — a deepening pass,
not a new system: Bubble gained long-term Personality Traits (a small,
named set alongside the existing free-text identity fields), a genuine
three-timescale Mood/Emotion/Personality distinction, emergent
Preferences and Behaviour Memory (both gated on "is there actually a
pattern here yet"), conversation-time Curiosity about what's changed in
the Workshop, a real (if deliberately modest) Conversation Memory
distinct from ordinary chat history, and five real Resident Embodiments
(Floating Orb, Cube, Prism, Lantern, Wisp) with genuinely active colour,
glow, scale, and idle-behaviour settings in place of what were previously
inert Mission Control fields. See `docs/RESIDENT.md` and `docs/AI.md` for
the full account.

**Version 2, Phase 2 — AI Intelligence (v2.0.2)** — Mission Control
deepened further: architecture for additional AI providers (LM Studio,
OpenAI, Anthropic, a Custom Endpoint — Ollama remains the only functional
one, every other choice says so honestly), seven continuous Behaviour
Dials complementing the previous phase's discrete Personality Traits,
Memory Configuration's categories and lifetimes both genuinely activated
(what Bubble remembers, and for how long), a genuinely isolated Resident
Sandbox for testing configuration changes without touching Bubble in the
room, and a calm Resident Health status display. See `docs/AI.md` and
`docs/RESIDENT.md` for the full account.

**Version 2, Phase 3 — Browser Ecosystem (v2.0.3)** — the Browser grew
into the Workshop's universal interface: a real multi-scheme
`PageRegistry` (`workshop://`, `host://`, `plugin://`, all treated
identically), six new Workshop pages including a Shared Asset Library
with genuine per-item file pages (real previews, metadata, and
cross-referenced relationships for Objects, Blueprints, and Animations),
every Host page migrated to its own `host://` scheme alongside two brand
new services (Documents, Downloads), two real working example plugins
(`plugin://example-plugin`, `plugin://calculator`) proving the
plugin-page mechanism end-to-end, the foundations of Unified Search, and
bookmarks reaching the full Browser's own toolbar. See `docs/BROWSER.md`
and `docs/HOST.md` for the full account.

**Version 2, Phase 4 — Workshop Platform (v2.0.4)** — the Workshop Host
completed its own nine-service architecture (Application, File, Project,
Plugin, Asset, Resident, Automation, Hardware, Diagnostics), four of them
— Asset, Resident, Diagnostics, Plugin — genuinely real Host-level views
over systems that already existed. A real, optional, zero-dependency
local companion server (`host-companion/`) and a matching
`HostConnectionManager` bring one genuine local-machine capability
(sandboxed, read-only folder listing) to life, gated by a real, persisted
Permissions architecture. Three new Local Protocols (`asset://`,
`resident://`, `project://`) joined `workshop://`/`host://`/`plugin://`,
each a new canonical scheme for something that already existed. See
`docs/HOST.md` and `docs/BROWSER.md` for the full account.

**Version 2, Phase 5 — Workshop Asset System (v2.0.5)** — a shared
language for everything the Workshop already creates: one common
Workshop Asset envelope (name, stable id, author, dates, version,
categories, tags, thumbnail, dependencies, validation status) computed
around Objects, Blueprints, Animations, Models, Images, and Music's own
real, unchanged internal shapes. Real, working: Favourites and Recently
Viewed (both persisted), unified search across every individual asset,
real Blueprint→Object dependencies and their reverse, real validation,
and genuine swatch thumbnails. Plugins can now register their own
Workshop Assets the same way they register pages — proven with three
small, real "sticker" assets contributed by the reference example
plugin. See `docs/ASSETS.md` for the full account.

**Version 2, Phase 6 — Advanced Animation (v2.0.6)** — movement became a
shared language: frame advancement and pose blending extracted into
reusable pure functions, a real, tested skeleton-mapping heuristic
(Mixamo's own naming quirks included) letting imported rigs join the same
animation vocabulary the Player rig always spoke, and real rest-pose-aware
retargeting. Beings genuinely play Workshop animations for the first
time. A real two-bone IK solver, procedural animation layering ("walking
while waving"), animation events, and a working shared Pose Library all
arrived alongside a genuinely retargeted Animation Editor preview. A
related, previously-theoretical `ModelLoader.js` bug (shared skeletons
across cloned models) was found and fixed once animated models actually
needed it to be correct. See `docs/ANIMATION.md` for the full account.

**Version 2, Phase 7 — Being Creator (v2.0.7)** — a complete, working
body-construction workflow: beings can now be built entirely from
primitive shapes (Cube, Sphere, Cylinder, Capsule) in a genuine
parent-child hierarchy, with rig creation kept deliberately simple —
tagging a part with a Workshop skeleton joint name directly, rather than
a second bones system. A real hierarchy editor (selection, re-parenting,
duplication, and a genuine Mirror tool reflecting an entire limb at
once), live animation preview inside the Creator itself, and full
Workshop Asset System integration (real metadata, thumbnails,
dependencies, validation, and a Browser detail page) round it out. A
real, unrelated bug in `AnimationLibraryStore` lookups — silently
breaking every default animation clip's own Asset System integration —
was found and fixed along the way. See `docs/BEINGS.md` for the full
account.

**Version 2, Phase 8 — Builder Evolution (v2.0.8)** — the Builder became
a genuinely professional creative tool: real multi-selection (shift-
click, and a true screen-space drag-select rectangle), object grouping
(select, and now move, an entire group as one unit), a generic undo/redo
system covering every mutating Build Mode action, alignment and
distribution tools, real measurement (dimensions and inter-object
distance, reusing already-computed collision data), and transform copy/
paste/reset. Blueprint capture now works from an exact multi-selection
rather than only a radius guess, and blueprints can be updated in place
for the first time. All of it layered on top of the existing single-
selection mechanics without changing them. See `docs/WORLDBUILDER.md`
for the full account.

**Version 2, Phase 9 — World Builder (v2.0.9)** — the Workshop grew real
grounds: a genuine, bounded, editable terrain heightmap (raise, lower,
flatten, smooth, terrace, all real tested algorithms, plus vertex-colour
painting for grass/dirt/rock/sand/gravel/mud/path), walkable for real via
`CameraSystem`'s own ground-height query. Seven real Nature pieces
(trees that genuinely sway in the wind) and five real Path tiles filled a
gap this phase discovered — `docs/WORLD.md` had documented these as
already existing from an earlier phase when only their category
reservations did; corrected alongside the real implementation.
Construction Library pieces (walls, doors, and the new Nature/Paths ones
alike) joined the Shared Asset Library for real. See `docs/WORLD.md`'s
own "World Builder (Version 2, Phase 9)" section for the full account.

**Version 2, Phase 10 — Living World 2.0 (v2.1.0)** — the Workshop's
systems began quietly observing one another. A shared World Awareness
layer (`WorldAwareness.js`) answers "what does the world look like right
now" — time, weather, music, player, active projects, nearby Beings,
resident mood, recent events — as one consistent snapshot any system can
query, alongside a real, bounded World Event Log recording genuine
transitions (a weather change, a sunrise, a song starting). Bubble
gained three new believable behaviours (watching the player work,
remaining near ongoing projects, becoming quieter at night), a
lightweight awareness of the Workshop's own Beings, and "usual working
hours" distinct from ordinary visiting patterns — all layered onto
existing mechanisms rather than a new decision system built on top. See
`docs/RESIDENT.md`'s own "World Awareness" section for the full account.

**Version 2, Phase 11 — Atmosphere (v2.1.1)** — teaching the Workshop
how to breathe, not adding more weather effects. A real, altitude-driven
sky gradient (night through blue hour, dawn, golden hour, and day, correct
for sunrise and sunset at any latitude), two cloud layers that pick up
the sky's own colour instead of staying flat white, and cloud cover that
now genuinely dims the stars and moon. A real indoor/outdoor audio
split — rain stays close and present through a roof, wind is heavily
buried through a wall — and four-phase nature audio (a brighter dawn
chorus, a warmer dusk insect mix, the original untouched night crickets).
Season Foundations: a real `getSeason()`, surfaced but deliberately
inert. Atmosphere Profiles: six built-in presets (Sunny Morning, Golden
Evening, Storm, Fog, Winter Morning, Summer Afternoon) plus anything
saved by hand, applied in one click from a reorganised Atmosphere tab.
Bubble now also watches a windy window and shelters from a storm, using
the exact mechanism Living World 2.0 already established. See
`docs/ATMOSPHERE.md` for the full account.

**Version 2, Phase 12 — Plugin SDK (v2.1.2)** — the Workshop becomes a
real platform, not just extensible in theory. A unified `Workshop`
facade (manifest + `setup(Workshop)`) built entirely on top of the
registries that already existed — pages, assets, Phone/Computer apps,
Host services, the Construction Library — none of which changed shape.
Real per-plugin permissions (auto-granted, genuinely revocable, since
there's no real sandbox to gate same-origin code behind), isolated
per-plugin storage, and error isolation strong enough that a throwing
plugin marks itself `"error"` rather than taking the Workshop down.
`host://plugins` is now a genuine Plugin Manager — live status,
manifest metadata, permission checkboxes, and real Enable/Disable/
Reload. One new reference plugin, `workshopToolkitPlugin.js`, touches
every capability at once (a page, a Builder asset, a Phone app with
real persisted storage, a Host service); the original two example
plugins are untouched, still demonstrating the contracts the SDK sits
on top of. See `docs/PLUGIN_SDK.md` for the full account.

**Version 2, Phase 13 — Workshop Reliability (v2.1.3a)** — no new
features; every existing one made to work the way it always should
have. Ladders finally climb (the input math was already fixed; the
Construction Library piece just never carried the behaviour that would
have used it). The fall animation no longer fires on ordinary slopes.
First-person crouching no longer clips the camera into the player's own
head. Factory Reset now clears every IndexedDB database the Workshop
actually uses, not just the original two. The biggest change: the
Workshop's terrain and its old separate flat ground are now one system —
`TerrainSystem.js` alone, grown from a 48m patch to a 200m one plus a
large non-editable skirt, with existing sculpting automatically migrated
onto the new grid. An architectural review pass found and fixed a real
one: twelve Construction Library pieces had been silently duplicated,
meaning a whole phase's worth of wind-swaying Nature assets had been
unreachable dead code since the day they were written. See
`docs/ROADMAP.md`'s own Phase 13 account for the complete list,
including the moon/sun timing bug that turned out, after real
investigation, not to be a bug at all.

**Version 2, Phase 13b — Workshop Workflow (v2.1.3b)** — the phase that
moved this very changelog here. No new systems: the README simplified
from 869 lines to under 470 (this document is where the rest went,
preserved rather than deleted), a real setup guide added
(`docs/SETUP.md`), whole-Workshop backup and a new single-profile
AI export/import brought into one consistent shape, the Export/Import
Backup controls moved from the HUD into Settings, the Builder gaining
the ability to import its own `.glb`/`.gltf` models directly instead of
detouring through the Being Creator, a live brush-size preview added to
terrain sculpting, and an architectural review pass that found a real
one: a genuinely redundant pair of README sections, several outdated
factual claims, and a stale code comment, each corrected at the source.
See `docs/ROADMAP.md`'s own Phase 13b account for the complete list.

**Version 2, Phase 13c — Workshop Personality (v2.1.3c)** — Bubble's
visual identity redesigned around a real, shared architecture rather
than a one-off touch-up. Eight expressions now, drawn from one
canonical list; a genuine pixel-art Expression Creator inside AI
Mission Control, with import/export/sharing following the identical
pattern the Workshop Workflow phase's own AI Profile export
established; Expression Sets registered as real Workshop Assets with
their own genuine pixel thumbnails; and a resident's active expression
set living as a plain per-profile reference — `expressionSetId`,
resolved the same way `provider`/`model` already are — specifically so
a future second resident needs nothing new to carry its own. Expression
changes cross-fade now instead of swapping instantly. See
`docs/ROADMAP.md`'s own Phase 13c account for the complete list,
including which of the three new expressions has a real behavioural
trigger and which are honestly still waiting for one.

**Version 2, Phase 14 — Diagnostics (v2.1.4)** — the Workshop learns to
understand itself. `workshop://diagnostics` rebuilt into a real Control
Centre: one colour-coded overall health banner, computed live from
actual subsystem state (a failed save, a plugin in error, a genuinely
broken asset reference), never manually assigned, with a plain-language
line per subsystem and every deeper technical detail tucked behind a
native, closed-by-default `<details>` element — one page for both a
casual glance and a deep investigation. A new technical Workshop Event
Log, deliberately separate from the existing world-flavoured one, gives
plugin errors and connection changes a real, searchable, exportable
home. Two genuinely silent failure modes were found and fixed along the
way: a failed Workshop save used to announce nothing at all, and a
plugin's own crash was never actually broadcast anywhere. Suggested
Fixes name the exact plugin or asset responsible rather than a generic
error; a small Dependency Awareness section explains how Workshop
systems actually rely on each other. See `docs/ROADMAP.md`'s own Phase
14 account for the complete list.

**Version 2, Phase 15 — The Workbench (v2.1.5)** — a craftsmanship pass,
not a redesign: the same vice, tray, lamp, clipboard, notebook, and fan,
at the exact same positions, built with genuinely more care. A richer
wood grain on the one surface a player actually leans over; two real
material gaps filled (`Materials.plastic()`/`rubber()`, reusable
everywhere, not one-off) and applied wherever the bench had been using
generic `matte()` for something that was always plastic or rubber; a
structural stretcher between the legs; a crank that finally makes the
vice read as a vice; one deliberately restrained pencil, resting on the
clipboard, as the phase's entire environmental-storytelling addition. A
real 7cm geometric overhang on the clipboard, quietly present since the
feature was built, found and fixed. The Workshop's first interaction
sound effect — a soft paper shuffle on leaning in and standing up — and
with it, a real dead setting (Effects Volume, present since early in
Version 2 with nothing to control) finally doing something. A follow-up
review pass found one more: `Materials.ground()`, orphaned since the
Reliability phase's terrain migration, quietly dead in the exact file
this phase's own new materials live in — removed. See
`docs/ROADMAP.md`'s own Phase 15 account for the complete list.

**Version 2, Phase 16 — The Desk (v2.1.6)** — the same craftsmanship
treatment, turned on the Workshop's other hero prop: the desk, the
monitor, and the chair, all at the exact same position and footprint.
A richer wood grain on the desk's own top, built the identical way the
Workbench's own top was; a monitor that finally has a real bezel and a
hinge instead of reading as a flat glowing rectangle; four more
`matte()` surfaces (the monitor stand, the keyboard, the mouse, the
lamp shade) that were always plastic in real life, now genuinely
`Materials.plastic()`, plus a new rubber mousepad. Two metal stretcher
rails under the desk; on the chair, a real five-point swivel base with
castors in place of a flat disc — the chair's own equivalent of the
vice's crank — an armrest pair, a mechanism plate, a thicker seat, and
a slight recline. One small, deliberately restrained addition: a pen
holder with two pens, placed to balance the lamp on the desk's other
corner. A second interaction sound effect — a soft chair creak on
sitting and standing, sharing the same entry point the paper shuffle
already uses. One more real architectural finding: `PlaceholderFactory
.softBox()`, promised in its own docstring to fake a bevel it never
actually produced, with no callers anywhere in the project — removed.
See `docs/ROADMAP.md`'s own Phase 16 account for the complete list.

**Version 2, Phase 17 — The Workshop Interior (v2.1.7)** — the same
craftsmanship treatment, scaled up from one piece of furniture to the
room shell itself: baseboards on all four walls (the single largest
gap found, sliced around the south wall's own doorway the same way the
wall itself already was), a protruding sill under each window, real
hinge plates on the front doors, a ceiling canopy plate at each pendant,
and the Workshop's first wall-mounted lights — sconces flanking the
front doors, through the exact same practical-light mechanism every
other fixture already uses. The light switch finally switches: a real
toggle nub, tilting between on and off with the actual state. A third
interaction sound — a door creak, lower and slower than the chair's
own — joins the paper shuffle and the chair creak through the same
entry point. Two real findings resolved: a screwdriver handle that was
never really matte, and a genuinely varied colour palette in the
shelving that sat completely unused while a near-identical set of wood
browns did its job instead — both arrays got a real purpose rather than
one being deleted. See `docs/ROADMAP.md`'s own Phase 17 account for the
complete list.

**Version 2, Phase 18 — Furniture & Storage (v2.1.8)** — the first
craftsmanship phase to span several objects rather than one, all
gathered into a new dedicated `docs/FURNITURE.md`. Tool storage gained
painted shadow-board silhouettes behind each hung tool — an empty hook
now reads as "the wrench is out" — plus a drawer left pulled open a few
centimetres. Shelving gained a shelf of labelled storage bins and a cap
trim, and a real dead-code finding: a genuinely varied colour palette
that sat unused behind a `void` statement while a near-identical set of
browns did its job instead. A new `Materials.cork()` (with its own
procedural texture) replaces the pinboard's flat tint, and each pinned
note now has a real push pin. The wardrobe gained a cornice and raised
door panels; the sitting area gained a cushion tier, a real table foot,
and one book. The already-redesigned music cabinet got two small
material fixes (a vinyl record and speaker cones that were never really
matte) and nothing else. See `docs/ROADMAP.md`'s own Phase 18 account
for the complete list.

**Version 2, Phase 19 — Decorative Details (v2.1.9)** — the smallest-
scoped craftsmanship phase yet, on purpose: three new additions to the
whole room, each held to "if this disappeared, would the Workshop lose
a piece of its personality?" A wall clock between the north windows —
the Workshop's first genuinely time-driven decoration, its hands
rotated by `LightingSystem` from the exact same hour value already
broadcast for the sun, no new system required. One small plant on one
window sill, deliberately not both. One small framed sketch on the
south wall, reusing the Builder's own sketch-paper material rather
than inventing a second one. A real material gap named directly in
this phase's own brief: `Materials.ceramic()`, replacing `matte()` on
every plant pot in the Workshop. A ticking clock sound was considered
and deliberately left out — it needs real positional audio to sound
right at different distances, which doesn't exist yet. See
`docs/ROADMAP.md`'s own Phase 19 account for the complete list.

**Version 2, Phase 20 — Visual Identity (v2.2.0)** — a different kind
of phase: a whole-pipeline consistency review, plus two named
regressions actually root-caused rather than patched around. Shadows
were missing from the terrain because the sun's shadow camera frustum
was being set as plain properties that `OrthographicCamera` never
applies without an explicit `updateProjectionMatrix()` call — missing
everywhere in the codebase, meaning the shadow camera had silently been
running on its tiny construction-time default (±5m) the entire time,
regardless of what several past phases' own comments claimed to expand
it to. One call fixes it. Jumping was silently cancelling itself on
every attempt: the terrain phase's own slope-following logic read a
"was grounded" flag captured *before* the jump-input check that clears
it, so every jump's first frame looked like ordinary ground contact and
got reverted before it ever rendered. One flag reference fixed it. A
broader review confirmed tone mapping, material families, reflection
tuning, and the terrain/floor material match at the doorway threshold
were all already consistent — nothing rebuilt, nothing new introduced.
See the new `docs/VISUAL_IDENTITY.md`, and fuller per-bug writeups in
`docs/WORLD.md` and `docs/PLAYER.md`.

**Version 2, Phase 21 — Sound & Presence (v2.2.1)** — three previously-
deferred audio items, each resolved once the conditions their own
deferral named were actually met. A distance-based gain scalar
(`AudioSystem._computeDistanceGain()`) gave every interaction sound real
spatial positioning, which unblocked a wall-clock chime on the hour
(deferred in Decorative Details) and, combined with a new generic
`soundOnInteract` field on `FurnitureSystem`, tool storage's own drawer
sound (deferred in Furniture & Storage). A building creak/settle sound,
self-scheduled every 3-7 real minutes and indoors only, resolves the
Workshop Interior phase's own deferral — that phase worried an
unprompted creak would have no cause a player could connect it to; this
phase's own brief asks for exactly that as the desired behaviour.
Bubble gained a first, very quiet sound on starting to think. An
architectural review found `playPaperShuffle`'s volume had never been
checked against the family that grew up around it (fixed) and that four
creak/scrape sounds were hand-copied duplicates of one graph (merged
into a shared helper, changing nothing audible). See the new
`docs/AUDIO.md` for the complete account.

</details>
