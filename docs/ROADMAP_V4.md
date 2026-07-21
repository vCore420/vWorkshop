# Version 4 — Draft Roadmap (a recommendation, not a plan)

Written by Claude Sonnet 5, from the completed Version 3 codebase —
~260 files under `src/`, ~50,000 lines, 14 phases plus one "One
Contribution" entry (`docs/CONTRIBUTIONS.md`). Like `docs/ROADMAP_V3.md`
before it, this deliberately does not invent new ambitions — it reports where the
repository itself, in its own comments, docs, and unresolved seams,
already says it wants to go. Reorder, merge, or discard freely; the
sequencing here follows dependency and risk, nothing more sacred.

## How this roadmap was built

Four separate passes over the codebase, not guesswork:

1. **A dead-code and duplication sweep** across all 258 `src/` files — a
   full import-graph reachability check from `main.js`, plus greps for
   `TODO`/`FIXME`, commented-out code, and reimplemented logic. The
   result was reassuring: zero orphaned files, zero TODO markers, zero
   commented-out code blocks. The real debt was small-scale duplication
   (an `escapeHtml()` reimplemented independently in nine places, with
   two genuinely different behaviours living in the same file) — already
   fixed as part of Version 3's own close-out, not carried into this
   document. See the closing retrospective in `docs/HISTORY.md` for the
   full account of what was fixed and why it was judged safe to do
   immediately rather than deferred.
2. **A docs-mined future-work pass** — every `docs/*.md` file's own
   "Known simplifications" and "Future extension points" sections (a
   house-style pattern this project already keeps disciplined use of),
   cross-checked against `docs/ROADMAP.md`'s actual phase-by-phase
   account so nothing already resolved got reported as still open.
   Several genuinely stale doc claims were found in the process (Version
   3's own docs describing pre-Phase-7 behaviour, or a since-superseded
   limitation) and were corrected as part of the same close-out.
3. **A judgment-based read** of the areas most likely to still feel like
   a prototype — the AI/resident intelligence system, `host-companion/`,
   the asset-import pipeline, and the Plugin SDK — actually reading the
   implementation, not just the docs describing it, to separate a real
   gap from an honestly-labelled placeholder working exactly as
   intended.
4. **Vi's own post-Version-3 field notes** (`Notes.md`, root — deleted
   once folded in here, so this document is the one place they live
   now), from actually playing the finished version. Phase 2 and Phase 3
   below come directly from this list, not from anything the automated
   passes above found — the most direct, least-filtered kind of evidence
   a roadmap can have.

The phases below are this evidence, organised and prioritised — not a
flat wishlist.

---

## Version 4 Philosophy

Version 3 made the Workshop *deep* — inhabited rooms, a resident with
real continuity, a computer and phone that feel like real devices, a
Plugin SDK, a Being Creator, and the discipline of investigate-first
development this whole version was built on.

Version 4's own honest throughline, found rather than invented: the
codebase has spent two versions quietly preparing for one specific next
step — a resident that isn't a singleton — without anyone building it
yet. Multiple independent docs (`docs/RESIDENT.md`, `docs/AI.md`,
`docs/BEINGS.md`, `docs/PHONE.md`, `docs/PERSISTENCE.md`) all wrote
their own architecture "taking a profile/instance as an argument rather
than assuming a singleton," years apart, without coordinating. That is
what a real half-open door looks like.

The one thing decided *for* this version rather than found in it: the
Workshop will not ship a second default resident. One is enough, and
the player can make more. That single decision resolves a tension this
project's own documents have flagged twice already
(`docs/HANDBOOK.md`'s "believability per unit capability," and
`docs/ROADMAP_V3.md`'s own Phase 8 risk note) — expand *presence*, not
*capability*, and let it be the player's own creative act, not the
Workshop's default content.

---

## Phase 1 V4.1 — Host, Actually Reaching Your Files

**Purpose:** the Host Companion currently grants access to a directory
and stops there. This phase makes it real: explore the directory
structure, open and read a file, edit and save it back, and launch a
local application — all reachable through the Workshop's own Browser
(`host://` pages), the same way every other Host capability already
surfaces.

**Why it matters:** requested directly, and it closes a real, already
self-documented gap. `host-companion/workshop-host-companion.js` is a
genuinely solid, honestly-versioned (`0.1.0-prototype`) foundation —
real path-traversal protection (`resolveWithinWorkspace()`), real
origin-restricted CORS — but only exposes `GET /status` and `GET
/files`. `src/host/FilesService.js` is gated correctly (Companion
reachable **and** filesystem permission granted, two independent
checks) but every method beyond listing — `openFile`, `createFile`,
`renameFile`, `deleteFile` — currently throws a specific, honest "not
implemented" error. `src/host/ProgramsService.js` is the same story:
real, but entirely `isExample: true`-tagged placeholder rows today.

**Systems involved:** `host-companion/workshop-host-companion.js` (new
endpoints), `src/host/FilesService.js`, `src/host/ProgramsService.js`,
`src/host/HostConnectionManager.js`, `src/host/HostPages.js` (the
`host://` Browser pages this would surface through), `docs/HOST.md`.

**Opportunities it creates:** turns the Host from "the Workshop can see
your files" into a genuine bridge to your machine — the single largest
gap between `docs/HOST.md`'s own stated ambition and what a player can
actually do today.

**Risks / considerations:** this is the most security-sensitive work in
this roadmap. Reading a directory listing is low-risk; writing files and
launching local programs from a browser context is not. Treat this as
its own investigation-first sub-phase before writing any implementation
— reuse `workshop-host-companion.js`'s already-proven path-traversal and
origin-restriction patterns rather than inventing new ones, and consider
whether the existing binary "filesystem permission" toggle needs to
become separate read/write/execute grants before write access or program
launching should be trusted with it.

## Phase 2 V4.2 — Playtesting Notes, Continued

**Purpose:** carry forward Vi's own post-Version-3 field notes
(`Notes.md`, root) — small, concrete geometry and interaction bugs,
several of them reports that a Phase 14 fix (Version 3's own final
catch-all phase) didn't fully hold, found by actually playing the
finished version rather than through further code review.

**Why it matters:** this is the same reason Phase 14 itself existed —
"the environmental, furniture, and geometry playtesting notes that would
have belonged [earlier] had they been found in time." Several items
below are specifically reports that a Phase 14 fix didn't fully hold
(the front door hinge, the computer chair's wheel arms, the Wardrobe
layout, the Emote Wheel's own design) — valuable, honest information in
its own right, worth investigating each one fresh rather than trusting
the earlier fix's own account was complete.

**Systems involved:** `src/entities/room/WorkshopRoom.js`/
`DoorBehaviour.js` (front door), `src/entities/furniture/ComputerDesk.js`
(chair), `src/phone/PhoneSystem.js`/`SettingsPhoneApp.js` (wallpaper
application), `src/worldbuilder/ConstructionLibrary.js` (double doors),
`src/entities/room/WorkshopRoom.js` (outdoor bench),
`src/systems/EmoteWheelSystem.js`, `src/computer/apps/WardrobeApp.js`/
`css/builder.css`, the HUD compass (`css/main.css`/touch layout).

**Playtesting notes driving this phase:**

- The architectural front door still doesn't hinge correctly, even
  after Phase 14 Wave 2's own attempt: it's attached to the wall's
  inside edge, and its highest points visibly swing outward (south),
  away from the house, as it opens. It should stay attached to the
  *outside* wall edge and hinge cleanly from that point, opening and
  closing without moving away from the house at all. Worth a fresh,
  more careful look at the actual pivot geometry rather than assuming
  Wave 2's own fix holds — the same caution Phase 14 itself already
  named for the first-person shadow issue it re-investigated.
- The computer chair's wheel arms still don't line up correctly,
  despite Phase 14 Wave 1's own castor-rotation fix — worth
  re-investigating what that fix actually addressed versus what's still
  visibly wrong.
- Phone wallpapers don't actually change when picked, despite Phase 13
  Wave 1's own wallpaper-customization work — a real regression or an
  incomplete original fix, either way worth root-causing rather than
  assuming the feature already works. (The Phone's Settings screen
  getting a real redesign is its own phase — see Phase 3 below — but
  this specific "doesn't apply" bug should be fixed regardless of that
  larger phase's own timing, and that phase depends on this one being
  fixed first.)
- Double Door construction pieces still pivot both leaves together to
  one shared corner, rather than opening independently like real French
  doors — the other half of the "honest half-fix" Phase 14 Wave 2's own
  account already named as deliberately deferred (a real architecture
  change, not attempted then on purpose). Worth attempting now that it's
  been named twice.
- The outdoor bench Phase 14 Wave 5 added against the south wall is
  facing the wrong direction.
- The Emote Wheel, redesigned as a real radial layout in Phase 14 Wave
  4, is "getting better but still off in design" — worth a further pass
  with a concrete reference point this time: something closer to
  FiveM's `qb-radialmenu` in feel. Separately, and independently
  fixable: the wheel should open on Tab, not G.
- The main Wardrobe app, widened and given a real grid layout in Phase
  14 Wave 4, still overflows — its own form controls run too wide,
  causing horizontal scrolling rather than fitting the panel. Worth a
  further layout pass, and this time worth deciding upfront how it
  should behave on a narrow/mobile viewport rather than treating that as
  a separate, later concern.
- The HUD compass clips against the top button row on touch/mobile
  devices specifically — fine on desktop, needs its own repositioning
  for the smaller layout.

**Risks / considerations:** like Phase 14 before it, this is a grab-bag
by nature — resist inventing a unifying narrative. Treat every "still
wrong after a previous fix" item with real skepticism about what the
earlier fix actually addressed rather than assuming it was close; a
fresh investigation pass first, the same discipline every phase this
project has used.

## Phase 3 V4.3 — The Phone's Settings, Made Real

**Purpose:** rebuild the Phone's own Settings app around what a real
phone's settings actually look and feel like — live wallpaper previews
instead of a generic dropdown, real brightness control, a genuine
light/dark theme choice — rather than the current generic form
controls.

**Why it matters:** named directly — "I want this to look more real and
less basic drop down boxes and generic UI elements." Squarely in the
Phone's own established identity as a real device (Phase 13's own "The
Phone Becomes a Device" phase already set this precedent for the rest
of the Phone), just not yet extended to its own Settings screen
specifically.

**Systems involved:** `src/phone/apps/SettingsPhoneApp.js`,
`src/phone/PhoneSystem.js` (wallpaper/appearance application — depends
on Phase 2's own wallpaper-doesn't-apply bug being fixed first),
`css/phone.css`.

**Opportunities it creates:** a natural template for "make a settings
surface feel like a real device control panel, not a form" that any
future device-feeling surface could reuse if it ever wanted the same
treatment — though that's explicitly not required by this phase.

**Risks / considerations:** "more realistic" should mean real visual
and interaction fidelity (live previews, real controls that visibly do
something), not real hardware behaviour this project has no access to —
brightness should visibly affect the Phone's own rendered screen, not
claim to change the actual device screen. Keep the scope to the Phone's
own Settings screen; resist letting this grow into a wider
device-realism initiative without being asked.

## Phase 4 V4.4 — Verification Tooling (the project's own honesty)

**Purpose:** not a Workshop feature — an investigation into, and either
a fix or a documented, reliable workaround for, the unreliable-screenshot
problem that has quietly blocked honest visual verification of several
real claims across two versions.

**Why it matters:** this keeps resurfacing as the same root cause under
different names. `docs/PLAYER.md`'s crouched-torso-stays-hidden claim,
`docs/REFINEMENT.md`'s `CROUCH_HEIGHT_RATIO` tuning, and
`docs/VISUAL_IDENTITY.md`'s shadow-edge offset measurement are all
explicitly marked "analysis-backed only, worth a visual check once
screenshot tooling is reliable." `.claude/DEV_NOTES.md` already
documents the root cause in detail — this sandboxed browser never
reports `document.visibilityState`/`hasFocus()` as true, so Chromium
correctly (per spec) treats every tab here as backgrounded and pauses
`requestAnimationFrame`/CSS transitions/the compositor entirely, which is
also almost certainly why `computer{action:"screenshot"}` itself times
out.

**Systems involved:** none — this is dev tooling only
(`.claude/DEV_NOTES.md`, whatever renders the Browser pane preview).

**Investigation notes:** pixel-readback via `canvas.drawImage()` +
`getImageData()` already worked once, for real (shadow-bias verification,
Version 3 Phase 2) — worth generalising into a small, documented, reusable
helper rather than re-deriving it per phase. Worth also checking whether
a genuinely different preview surface (a real, focused browser window
instead of this embedded pane) sidesteps the visibility-state problem
entirely, if that's available in a future session's environment.

**Opportunities it creates:** closes out several already-accumulated
"unverified, analysis-backed only" items in one pass once the tooling
exists or the workaround is standardised; every phase after this one
gets more trustworthy verification for free.

**Risks / considerations:** this may turn out to be a genuine, permanent
constraint of the sandboxed environment, not a fixable bug. That's still
a valuable, honest thing to determine conclusively — "documented as a
standing limitation, pixel-readback is the standing workaround" is a
real outcome, not a failure to close the phase.

## Phase 5 V4.5 — Lighting Fixtures for the Construction Library

**Purpose:** build the `gardenLight`/`streetLight`/`lantern`/`floodlight`/
`campfire` pieces the Construction Library has reserved as a category
since Version 1 — still zero real pieces behind any of them.

**Why it matters:** `docs/WORLD.md`'s own account confirms this gap has
sat unaddressed across every version so far, without a real need ever
displacing it. A small, self-contained, satisfying phase — the kind of
quick win this project has always paced between its bigger phases
(Phase 10 → 10b/c/d, Phase 14's own grab-bag phase).

**Systems involved:** `src/worldbuilder/ConstructionLibrary.js`,
`src/systems/LightingSystem.js` (`registerPracticalLight()` — the same
mechanism the desk lamp and Phase 14's exterior door light already use),
`docs/WORLD.md`, `docs/WORLDBUILDER.md`.

**Opportunities it creates:** gives Builder-mode players real light
sources to place, directly extending the outdoor detail work Phase 14
Wave 5 already started (the bench, the window planters).

**Risks / considerations:** low. Keep scope to geometry plus
`LightingSystem` wiring — resist inventing a new light-behaviour system
when `registerPracticalLight()` already covers what's needed.

## Phase 6 V4.6 — Being ↔ Resident Convergence, Investigation

**Purpose:** determine concretely what it would take for a resident —
Bubble's own conversation memory, traits, preferences, curiosity,
world-awareness, expression sets — to become a real `BeingLibrary`
definition, the same underlying system a player already uses to create
their own Beings in the Being Creator, rather than two structurally
separate systems that happen to share some vocabulary.

**Why it matters:** this is the single most cross-referenced, most
independently-prepared-for unrealized direction in the entire codebase.
`docs/RESIDENT.md` lists "multiple residents" as its literal
first-ranked future extension point, stating outright that
`ResidentTraits`/`ResidentPreferences`/`ResidentCuriosity`/
`PlayerPatternMemory`/`expressionSetId` were all written "taking a
profile/instance as an argument rather than assuming a singleton" from
early on. `docs/AI.md` names the identical destination. `docs/BEINGS.md`
names the other half explicitly: "today's resident and this Being
system are still two separate things." `docs/PHONE.md` notes Bubble's
own Phone app is "already written generically against the resident
stores, not the name 'Bubble.'" Five independent documents, all
pointing the same direction, none of them coordinated with each other —
that is what a genuine, load-bearing architectural gap looks like, not
a speculative feature idea.

This is also the intended shape of the version's one explicit decision:
**no second default resident** — "one is enough, the player can make
more." Convergence is precisely what would make that true: a player
uses the Being Creator they already have to give any Being real
resident-grade presence, rather than the Workshop shipping more
built-in NPCs by default.

**Systems involved:** `src/beings/` (`BeingLibrary.js`,
`BodyCompiler.js`, `BeingController.js`, `BeingBehaviours.js`);
`src/resident/` (`ResidentTraits`, `ResidentPreferences`,
`ResidentCuriosity`, `PlayerPatternMemory`, `ExpressionTypes`,
`ConversationMemory`, `ResidentDials`, `ResidentMovement`,
`ResidentContext`); `src/ai/` (`ProviderRegistry`, `WorkshopFunctions`,
`PromptComposer`); `docs/BEINGS.md`, `docs/RESIDENT.md`, `docs/AI.md`.

**Investigation notes:** trace exactly which resident-only stores would
need to become genuinely per-instance versus which already are; confirm
Bubble's own existing behaviour can be preserved unchanged as "the
Workshop's own pre-configured example resident Being" once convergence
lands, so no existing save or player experience regresses; read every
doc's own "Future extension points" for this thread as the starting
evidence, not a fresh investigation from zero.

**Opportunities it creates:** a genuinely new creative capability for
players (a Being that can hold a real conversation), squarely on the
"expand presence, not capability" axis this project's own documents have
twice already named as the right one.

**Risks / considerations:** treat this exactly like Phase 5's own
"Beyond One Building" approach — prototype the hardest architectural
question first, before committing to an implementation phase. The real,
twice-named risk: a resident that's too *capable* stops feeling like a
resident and starts feeling like an assistant bolted on. This
investigation is explicitly about *architecture* — whether a Being can
carry resident-shaped state — not about giving any resident new AI
functions or capabilities. Keep those two questions separate.

## Phase 7 V4.7 — Being ↔ Resident Convergence, Implementation

**Purpose:** build whatever Phase 6 concludes is the right shape — most
likely, `BeingLibrary` definitions gaining an optional resident capability
(conversation, memory, expressions, world-awareness) the Being Creator
can enable, with Bubble becoming the Workshop's own shipped example of
one rather than a hardcoded special case.

**Why it matters / Systems involved:** inherits Phase 6's findings
directly — this phase shouldn't start until that one has a concrete,
concluded shape to build.

**Risks / considerations:** scope this to "make it possible," never
"make it default" — `docs/HANDBOOK.md`'s own "never guarantee delight;
make it possible" principle, and the version's own explicit decision
that one default resident is enough. Every existing player's save and
experience should be unaffected unless they deliberately create their
own resident-capable Being.

## Phase 8 V4.8 — The Rest of IK

**Purpose:** continue the animation/IK work Version 3's own Phase 1
began but explicitly didn't finish — foot placement during an actual
walk cycle (today only "Player, standing still" is wired), hand
placement/object interaction, look-at targets, and a manual
skeleton-mapping override UI.

**Why it matters:** named as a real, deliberately-deferred gap in Phase
1's own closing account, and independently re-flagged in both
`docs/ANIMATION.md`'s and `docs/BEINGS.md`'s own "Future extension
points" ever since — never revisited across all 14 phases of Version 3.
Also a natural complement to Phase 6/7's convergence work: a
player-made resident-capable Being reads as more alive with real IK
behind it.

**Systems involved:** `src/player/TwoBoneIK.js`,
`AnimationRetargeting.js`, `WorkshopSkeleton.js`, `AnimationPlayback.js`;
the Being Creator's own skeleton-mapping UI.

**Risks / considerations:** IK tuning is real feel-work — Phase 1's own
risk note already said so, and it's still true. Scope tightly to one
real gait/contact case at a time; resist trying to solve general-purpose
IK in a single phase.

## Phase 9 V4.9 — Atmosphere, Continued

**Purpose:** real falling-particle snow, a visible lightning bolt with
thunder (today a light-flash only), a real constellation catalogue, and
seasonal effects that actually change something visible or
behavioural — leveraging `Astronomy.getSeason()`, which already exists
and is currently unused for anything beyond a read-only label.

**Why it matters:** `docs/ATMOSPHERE.md`'s own "Future extension
points" names all four explicitly; `docs/WORLD.md` independently names
three of the same items. This is the most-named open thread outside the
resident/Being one.

**Systems involved:** `WorldEnvironmentSystem.js`, `EnvironmentSystem.js`,
`AudioSynth.js` (thunder), `Astronomy.js` (season, star rotation),
`docs/ATMOSPHERE.md`, `docs/WORLD.md`.

**Opportunities it creates:** each of the four items is independently
shippable — natural to split into waves, the way Phase 14 did, rather
than one monolithic phase.

**Risks / considerations:** `dustMotesPlugin.js`'s own already-learned
lesson — "avoid making the room feel smoky or busy" — applies just as
much to snow and lightning. Seasonal effects should change what already
exists (vegetation colour, day length, resident behaviour) rather than
adding wholesale new geometry.

## Phase 10 V4.10 — Plugin SDK, a Real Decision

**Purpose:** resolve a tension `src/host/PluginService.js`'s own comment
already names outright — "the Workshop has three ways a plugin can
currently exist" — either by extending the SDK to cover what it
currently doesn't (`registerBehaviour()`, workbench presence types,
custom overlays), or by honestly softening `docs/PLUGIN_SDK.md`'s own
opening claim ("without modifying the Workshop source code...") to
match what's actually true today.

**Why it matters:** `docs/PLUGIN_SDK.md`'s own text is in direct tension
with its own "Known simplifications" section, within the same document —
every plugin, SDK-style or not, is still wired in via a hand-written
import in `main.js`. This is exactly the kind of drift `CLAUDE.md`'s own
"a docstring is a promise" rule exists to prevent, and it's been sitting
unresolved rather than caught.

**Systems involved:** `src/plugins/` (`WorkshopSDK.js`,
`PluginManager.js`, `PluginPermissions.js`, `PluginStorage.js`,
`PluginLoader.js`), `docs/PLUGIN_SDK.md`, `docs/PLUGIN_GUIDE.md`.

**Opportunities it creates:** if the SDK is genuinely widened, this also
lays real groundwork for an install/uninstall flow —
`PluginStorage.forget()`/`clear()` are already sitting ready for exactly
that.

**Risks / considerations:** don't half-do it. A partially-widened SDK
that still needs `main.js` edits for some capabilities is the same
honesty problem in a different shape — decide one way or the other, then
follow all the way through.

## Phase 11 V4.11 — Dormant Seams: Use or Retire

**Purpose:** a deliberate, one-by-one pass through the "architecture
built, content or wiring deferred" pattern this roadmap's own research
found repeating across unrelated domains — `WorkshopProjectStore` (no UI
after multiple versions), unused Asset kinds (Materials, Textures,
Particles, Sounds, Behaviours — named independently in `docs/ASSETS.md`,
`docs/HOST.md`, and `docs/PLUGIN_GUIDE.md`), and Animation Events that
fire correctly but currently have no real listener anywhere.

**Why it matters:** this is exactly the kind of question
`docs/HANDBOOK.md`'s own honesty principle would want asked explicitly
rather than left implicit. Several of these have been waiting since
Version 1 or 2 without a real need ever materialising — worth a genuine
decision (build it, or retire it honestly) rather than carrying it
forward silently into a fourth or fifth version.

**Systems involved:** varies per seam —
`src/data/WorkshopProjectStore.js`, `src/host/AssetService.js` (kind
registration), wherever Animation Events are currently emitted with no
subscriber.

**Risks / considerations:** this phase can sprawl if not scoped
tightly. Treat each seam as its own small, independent decision — use it
now, retire it now, or leave it and say why explicitly in its own doc —
not as an excuse for a wider redesign.

---

## Non-goals (carried forward, plus one new decision)

Multiplayer, scoring/progression, procedural outdoor scenery, and a
traditional settings menu remain non-goals per `docs/ROADMAP.md` —
nothing found in this review changes that.

**A second default resident is a new, explicit non-goal this
version** — decided directly, not inferred: "we are not going to expand
the amount of default residents to the world, one is enough and the
player can make more." Phase 6/7's own convergence work is the
intended answer to that "more," delivered as a player capability rather
than default Workshop content.

A test harness is still not proposed as a phase, matching `CLAUDE.md`'s
own standing position. Worth naming honestly: `docs/RELEASE_REVIEW.md`'s
"turn the dead-export/token/import audits into small runnable scripts"
suggestion has now been raised and quietly declined at least twice
across two versions. That's not necessarily wrong, but it's worth a
deliberate, explicit call the next time it comes up, rather than a third
silent pass.
