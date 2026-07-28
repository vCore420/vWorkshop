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

5. **A second round of Vi's field notes, taken after `v4.1.0e`** and
   folded in the same way. **Phases 11 through 15, and the "Beyond
   Version 4" section, come entirely from this round** — none of them
   existed in the original review. This is worth noting for two reasons.
   First, it means the second half of Version 4 is driven by play rather
   than by code inspection, which is the right way round. Second, and
   more pointedly: several of these notes are about systems the automated
   passes above had signed off as complete. Phase 9e's head/camera
   binding was verified live and produced four follow-up complaints
   anyway; Phase 10's plaster walls were measured, defended in a comment,
   and still wrong for the room. **A codebase sweep can tell you what
   exists and whether it is self-consistent. It cannot tell you how the
   place feels to be in.** Both rounds of these notes are the only
   evidence in this document that can.

The phases below are this evidence, organised and prioritised — not a
flat wishlist. **Ordering principle for the second round:** defects
before features, and among defects, the ones affecting how the Workshop
*feels to move through* before the ones affecting how it looks. Phase 11
is first because a player's own body disagreeing with their camera is
felt continuously, in every session, by everyone.

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

## Phase 10 V4.10 — The Visual Upgrade

**Purpose:** move the Workshop's own 3D content from "a really good
prototype" to a professional finish — the room and its furniture, all 56
`ConstructionLibrary` builder pieces, and the player and Being models —
without abandoning the code-generated, zero-binary-asset approach the
project is built on.

**Status:** this phase is not from the original review that produced this
document. It was added mid-Version-4, at Vi's direct request, and the
two phases below it were renumbered to make room (what was Phase 10 is
now Phase 11, and what was Phase 11 is now Phase 12).

**Why it matters:** the request was "the basic 3d geometry is cool but it
feels like a really good prototype." An opening investigation traced that
feeling to two specific, shared causes rather than to any individual
object's design:

1. **There was not one `normalMap`, `roughnessMap`, `aoMap`, or
   `bumpMap` anywhere in `src/`** — confirmed by grep across all 266
   files, zero hits. Every material was albedo-only, and a
   `MeshStandardMaterial` with only a colour map cannot express surface
   micro-relief at all.
2. **Every edge in the Workshop was a razor-sharp 90°**, because
   `PlaceholderFactory.box()` is raw `BoxGeometry` and it is the
   workhorse behind nearly every object. Real manufactured objects
   essentially always carry a chamfer that catches a highlight along its
   length; the absence of that highlight is the strongest "untextured
   prototype" tell available.

Neither is a geometry-budget problem, which is what made a shared
foundation wave worth doing first: both are fixable in one place, for
every object at once.

**On asset generation — the question was asked explicitly and answered
deliberately:** stay code-generated, and raise the generator's ceiling,
rather than shipping real GLTF assets. Imported models are already fully
supported *for Beings* (`ModelLoader.js`, `ModelAssetStore.js`,
IndexedDB), so the capability exists; the question was only whether the
Workshop itself should ship binaries. It shouldn't, for this phase:
doing so would change a `CLAUDE.md`-level convention, grow the repo by
tens of megabytes, add a licensing/provenance obligation to every model,
and — decisively — still not fix the two causes above, which are
material and edge problems rather than shape-complexity ones. If shipped
assets are ever wanted, that deserves its own phase with its own
licensing decision, not a side effect of this one.

**Waves:**

- **10a — Foundation: materials and edges.** The shared layer only; no
  individual object redesigned. Generated normal and roughness maps
  derived from the albedo canvases already being drawn, a bevelled-box
  helper, and a boot-time texture-detail tier so the "performance"
  preset stays honest.
- **10b — The Workshop's own furniture.** The nine furniture pieces plus
  the room shell, including architectural trim (skirting, window
  reveals, door casing). Footprints and `focusPose` values held fixed.
- **10c — The Construction Library and default blueprints.** All 55
  pieces: real material assignment, selective bevelling, focused detail
  on the pieces that read worst.
- **10d — Player and Being models.** Shaped, tapered, capsule-based
  silhouettes replacing plain boxes, under a byte-identical joint
  hierarchy so the entire animation library, retargeting and IK stack
  keeps working by construction.
- **10e — Art direction, verification and close-out.** A written
  material and palette charter, verification across times of day and all
  three graphics presets, and the full docs sweep.

**Risks / considerations:** the largest is save compatibility on builder
pieces, and it is worth being precise about why. A placed object stores
only `{definitionId, position, rotation, scale, ...}` — no geometry at
all; the shape is resolved from `ConstructionLibrary.js` at load time.
So editing a piece retroactively changes every already-placed copy in
every save, and changing a piece's *dimensions* silently opens gaps or
overlaps in finished player structures whose absolute positions were
frozen at placement time. **Vi's own decision, recorded here because it
shapes 10c directly: the Workshop is still in development and Vi holds
the only save, so dimension changes are permitted and a fresh save will
be started after the 10c pass.** Without that, the rule would have been
strict envelope preservation.

## Phase 11 V4.11 — The Player's Own Body

**Status: SHIPPED as `v4.1.1`.** All six notes fixed — see
`docs/ROADMAP.md`'s own Phase 11 account for what each turned out to be.
Three were defects with specific addresses (an un-negated head pitch, an
inverted orbit vertical term, and a shadow-camera layer call that had
been a no-op since Version 3 Phase 3b); three were behavioural changes,
two of which reversed explicit Phase 9e design decisions. The
investigation leads recorded below both proved correct, which is the
reason to keep writing them down.

**Purpose:** close the gap between where the camera is looking and where
the player's body actually is. Five of Vi's post-`v4.1.0e` notes are all
the same system, and all of it is the mechanism Version 4 Phase 9e
introduced when it first bound the camera to the rig's head.

**Playtesting notes driving this phase:**

- The body should start rotating once the head reaches **35°**, not sit
  still until the head hits its limit and then get dragged.
- **Third person should follow the head, not the body** — "as done the
  compass."
- **Moving forward should snap the body to the camera's facing** and walk
  that way.
- **Camera pitch and the rig's head disagree**: looking down with the
  camera shows the head tilted *up* in the mirror.
- **First and third person feel inverted from each other** on mouse and
  touch.
- **The player's shadow has no head** — Vi's own framing: *"this is
  because we hide the player head so it doesn't get in the way of the
  camera, maybe we rework this system? or find a way to show the player's
  head in the shadow in 1st person."*

**Investigation notes — two of these already have concrete leads, found
by reading rather than guessing, and worth starting from rather than
re-deriving:**

- The head-pitch mismatch looks like a sign error with a specific
  address. `PlayerAnimationSystem.update()` applies the camera's own
  pitch to the rig with `pivots.head.rotation.x += this.cameraSystem.pitch`
  — added **raw**. But `PlayerCharacter.applyPose()` deliberately
  **negates X and Z** on every pose it applies, to compensate for
  `PlayerCharacterSystem`'s 180° root-orientation fix (see that
  function's own comment). The head correction is layered on *after*
  `applyPose()` and never gets that negation, so it is plausibly applying
  pitch in the opposite sense to every other rotation on the same rig.
  Note that `rotation.y += getHeadYawOffset()` on the line above is
  *not* negated by `applyPose()` either — and yaw is the one axis Vi has
  **not** reported as wrong, which is a meaningful corroboration rather
  than a coincidence. Verify before fixing; don't assume.
- The 35° figure is not simply a smaller `PLAYER_HEAD_YAW_MAX` (currently
  `Math.PI * 0.44`, about 79°). Today the body only moves once the clamp
  is *exceeded*, and then only by the excess. What Vi is describing is a
  body that begins easing toward the camera at 35° — a different
  behaviour, not a different constant. Expect to add an ease, and keep
  the hard clamp as a separate backstop.
- **The missing shadow head is a "previous fix may not hold" item, and
  needs treating with the same skepticism Phase 2 applied to its own.**
  The mechanism it needs already exists and looks correct on paper:
  `PlayerCharacterSystem` puts the head mesh on
  `FIRST_PERSON_HIDDEN_LAYER` via `layers.set()`, and Version 3 Phase 3b
  added `this.sun.shadow.camera.layers.enable(FIRST_PERSON_HIDDEN_LAYER)`
  in `LightingSystem.js` for exactly this symptom, with
  `ReflectionSystem` doing the same for mirrors. Since Vi can see the
  head in the mirror but not in the shadow, the reflection half is
  evidently working and the shadow half is not — so start by confirming
  whether Three.js's shadow pass actually consults
  `light.shadow.camera.layers` at r164, rather than assuming the line
  does what its name suggests. Vi's own alternative ("rework this
  system") is on the table: a layer-based hide is one approach, and a
  first-person-only material or a per-camera visibility toggle are
  others.

**Systems involved:** `src/systems/CameraSystem.js` (head yaw offset,
third-person orbit, `_applyCameraTransform()`), `src/player/
PlayerAnimationSystem.js` (the head/torso corrections), `src/utils/
InputManager.js` (`invertLook` is applied once to `lookDelta.y`, so if
the two view modes disagree the sign difference is downstream of it),
`docs/PLAYER.md`, `docs/ANIMATION.md`.

**Risks / considerations:** this is feel work, and Phase 9e's own account
is the warning — its head-yaw mechanic was tuned to feel right and still
produced four follow-up complaints. Change one thing at a time and check
each in the mirror *and* in third person, since those are the two
surfaces that expose a rig/camera disagreement. `docs/PLAYER.md`'s own
box-vocabulary note (Phase 10d) is relevant background: the rig's
geometry is settled, so this phase is purely about rotation and framing.

## Phase 12 V4.12 — Animation Orientation, End to End

**Status: SHIPPED as `v4.1.2`.** The suspected shared cause below (the
X/Z negation being wrong for Beings) was **measured and refuted** — 144
comparisons across every biped clip found zero disagreement between the
player and primitive-Being paths. The real fault was that imported models
had no orientation correction at all: `ModelLoader` never asked which way
a `.glb` faces. Fixed with a per-model `yawOffset`. The "find the
convention first" instruction below is the reason three working paths
weren't broken to fix none — see `docs/ROADMAP.md`'s Phase 12 account and
`docs/ANIMATION.md`'s "The orientation convention".

**Purpose:** root-cause the note that reads, in full: *"something
somewhere to do with the player models, being models, player imported
models and animations, a lot of imported models play animations backwards
or flipped, some player animations are recorded backwards, some spawned
imported model beings move backwards, something just seems wired up wrong
between all these systems."*

**Why it matters:** this is the most valuable kind of report this project
gets — a user noticing a *pattern* across systems that were built
separately and each verified separately. Four different symptoms, one
suspected shared cause. That is an investigation phase, not a fix phase.

**The prime suspect, and why it needs proving rather than assuming:**
the Workshop has at least three places where an orientation correction is
applied, and they were introduced at different times for different
reasons. `PlayerCharacter.applyPose()` negates X and Z to compensate for
a 180° root rotation. `AnimationRetargeting.applyPoseToMappedSkeleton()`
drives imported and primitive Being skeletons from the same clips.
`BeingController`/`BeingMovementSystem` orient a moving Being. A clip
authored against one convention and played back through another is
exactly how "backwards" and "flipped" both arise, and Phase 11's own
head-pitch lead above is plausibly the same family of bug — **but they
may equally be three unrelated faults that happen to rhyme.** Establish
which before changing anything.

**Investigation notes:** build a single test surface that plays the same
clip on all four paths at once (player rig, primitive Being, imported
`.glb` Being, and the Animation Editor's own preview) — the disagreement
should be visible side by side rather than inferred from four separate
sessions. Check clip *recording* separately from clip *playback*: Vi
reports "some player animations are recorded backwards," which if true
means the Animation Editor is capturing under a different convention than
playback uses, and would be a distinct bug from the retargeting one.

**Systems involved:** `src/player/AnimationRetargeting.js`,
`AnimationPlayback.js`, `AnimationClips.js`, `PlayerCharacter.js`
(`applyPose`), `WorkshopSkeleton.js`, `src/beings/ModelLoader.js`,
`BeingController.js`, `BeingMovementSystem.js`, `src/computer/apps/
AnimationEditorApp.js`; `docs/ANIMATION.md`, `docs/BEINGS.md`.

**Risks / considerations:** the honest risk is a "fix" that corrects one
path by adding a second compensation on top of an existing one, leaving
the codebase with two cancelling wrongs and a third path still broken.
Find the *convention* first, write it down in `docs/ANIMATION.md`, then
make every path conform to it — rather than negating axes until each
symptom individually stops.

## Phase 13 V4.13 — Constellation Lines, Off By Default

**Status: SHIPPED as `v4.1.3`.** Lines off by default, toggleable from
the Atmosphere tab's own Stars section, in a new `atmosphere` settings
category (not `graphics` — see the account). The "brighter stars" half
turned out to be partly built already, and a live measurement moved the
brightness step from opacity into sprite size after the opacity
multiplier was found to clip against its ceiling exactly on the clearest
nights. See `docs/ROADMAP.md`'s Phase 13 account.

**Purpose:** a small, self-contained quick win — the kind this project
has always paced between bigger phases (Phase 5's lighting fixtures set
the precedent). The constellation lines Phase 9a introduced should be
**off by default**, toggleable from the computer's Settings app, with the
constellation stars themselves rendered a touch brighter than ordinary
stars so the shapes are findable by eye before the lines are switched on.

**Why it matters:** named directly. It is also the more honest default —
the night sky reads as a sky, and the lines become something you turn on
to learn the shapes rather than a permanent overlay.

**Systems involved:** `src/systems/WorldEnvironmentSystem.js` (which
currently builds `constellationLines` and adds them to the scene
unconditionally — there is no toggle today, only an opacity driven by
overall star visibility), `src/settings/SettingsStore.js` (a new
graphics or display field), `src/computer/apps/SettingsApp.js`,
`docs/ATMOSPHERE.md`, `docs/PERFORMANCE.md`.

**Risks / considerations:** low. The one real decision is which Settings
tab it belongs in — this is a *preference about the sky*, not a graphics
quality tier, so it should not sit among the performance presets.

## Phase 14 V4.14 — Platform Parity

**Purpose:** two independent reports that share one shape — the Workshop
behaving differently depending on where it runs.

**Playtesting notes driving this phase:**

- **No audio at all in Firefox.** Works in Opera. This is a hard failure,
  not a degradation.
- **Heavy performance cost on an Android tablet** (Lenovo M11, Android
  15) where desktop and Apple devices run well.

**Investigation notes:**

- For Firefox: `AudioSystem.resumeContext()` is called from the entry
  screen's "Step inside" gesture, which is the correct shape — but
  `this.context.resume()` is called without awaiting its promise, and the
  context is constructed in the same method. Firefox's autoplay policy is
  stricter than Chromium's about *when* a context may be created relative
  to the gesture. Suspect that ordering first, and confirm against a real
  Firefox session rather than by reading — this is precisely the kind of
  claim that needs the browser to settle it.
- For Android: `SettingsStore.detectRecommendedPreset()` already
  auto-selects the `performance` preset for touch-primary devices, and
  `TextureQuality` follows it — so the first question is whether that
  detection is actually firing on this tablet, not whether more tuning is
  needed. `.claude/DEV_NOTES.md` records that `(pointer: coarse)` never
  matches in the sandboxed dev browser, so this specifically cannot be
  verified here and needs the real device.

**Systems involved:** `src/systems/AudioSystem.js`, `src/utils/
AudioSynth.js`, `src/music/MusicSystem.js`; `src/settings/
SettingsStore.js`, `src/utils/TextureQuality.js`, `docs/PERFORMANCE.md`,
`docs/AUDIO.md`, `docs/RESPONSIVE.md`.

**Risks / considerations:** neither item can be honestly verified in this
project's own dev environment — one needs Firefox, the other needs the
tablet. Treat "reproduced on the real target" as the entry condition for
this phase rather than something to establish at the end of it.

## Phase 15 V4.15 — The Phone, App by App

**Purpose:** give every Phone app its own identity. Named directly:
*"each phone app should feel individually unique, like normal apps on a
phone... the layout 'works' but they are too generic and all look much
too the same."*

**Scope, from the note itself:**

- Work through the apps **one by one**, redesigning how each looks and
  feels rather than restyling them as a set.
- The Settings app specifically should look like a real phone's settings
  screen.
- **Wallpaper becomes home-screen-only**, so each app can carry its own
  background.
- **Wallpapers should be importable**, not only chosen from presets.

**Why it matters:** Version 3's Phase 13 ("The Phone Becomes a Device")
and Version 4's Phase 3 ("The Phone's Settings, Made Real") both moved in
this direction and both stopped short of per-app identity. This is the
third time the same thread has been picked up, which is usually the sign
that it deserves a phase of its own rather than another increment.

**Systems involved:** `src/phone/PhoneUI.js`, `PhoneSystem.js`, every
app under `src/phone/apps/`, `css/phone.css`; `src/systems/
ImageLibraryStore.js` (the existing image-import path, which importable
wallpapers should reuse rather than duplicate — see `docs/BROWSER.md`),
`docs/PHONE.md`, `docs/DESIGN_SYSTEM.md`.

**Opportunities it creates:** importable wallpapers is the small piece
with the widest reach — the Workshop already has an image import and
library system, so this is mostly a matter of pointing an existing door
at a new room.

**Risks / considerations:** this is the phase most likely to sprawl, and
the most likely to damage something that currently works. Split it into
waves by app, ship each one, and hold `docs/DESIGN_SYSTEM.md`'s token
discipline throughout — "individually unique" must not become "eight
apps with eight private colour schemes." The tokens are what keep it one
device.

## Phase 16 V4.16 — Plugin SDK, a Real Decision

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

## Phase 17 V4.17 — Dormant Seams: Use or Retire

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

## Beyond Version 4 — Travelling Between Worlds

**This is deliberately not numbered as a phase, and that is a
recommendation rather than a filing decision.** Vi's own note frames it
as an eventual direction ("eventually the idea of..."), and its shape is
categorically different from everything above:

> *The idea of travelling to pre-built worlds — being able to change the
> world around you from your main player-built one to various pre-built
> worlds to go explore and build onto or edit, with the Workshop never
> changing and the world around it changing instead when the player
> changes the world.*

**Why it is a version headline, not a phase.** Every phase above changes
how something already in the Workshop looks or behaves. This changes what
the Workshop *is*: it introduces the idea that the building is a constant
and the world is a variable — a place you take with you. That is the same
order of idea as "the Workshop is a place, not an app," and it deserves
the same treatment: its own version, opened with an investigation, rather
than being squeezed in beside a Firefox audio fix.

**The encouraging part: the architecture has been quietly waiting for
it.** `WorldObjectsStore` has been room-scoped via `roomId` "from day
one... specifically so a second room is a matter of spawning instances
with a different id and filtering by it — not a schema change." Version 3
Phase 5 ("Beyond One Building") already separated the Workshop's own
structure from what surrounds it, and `BuildingDetectionSystem` already
understands an enclosure as distinct from the space around it. The
`roomId` seam is the closest thing this codebase has to a half-open door
onto exactly this — which is the same pattern that made Version 4's own
Being/resident convergence the right call.

**The real questions an investigation would need to answer**, none of
which should be guessed at now: what a "world" is as a persisted unit
(does it own terrain, atmosphere profile, placed objects, Beings?); how
the save envelope grows to hold several of them without the main save
becoming enormous; whether the Workshop building itself is genuinely
invariant or merely *usually* unchanged; and what travelling actually
looks and feels like from inside, given this project's standing rule that
features are places rather than menus.

**Recommendation:** open Version 5 with this as its investigation phase,
the way Version 4 opened with the Host and Being/resident threads. It is
too big to be a late-version addition and too well-prepared-for to
discard.

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
