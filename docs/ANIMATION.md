# Advanced Animation

"Version 1 established the Workshop's animation architecture. Version 2
is about completing it. Animations should no longer belong to individual
models. They should become a shared language spoken by every moving
thing inside the Workshop." Before this phase, exactly one thing in the
Workshop played animation clips: the Player's own procedural rig. This
phase is what let a second, genuinely different kind of thing — an
imported humanoid model, driving a placed Being — join that same
conversation, without either side needing its own separate animation
engine. This document covers the shared architecture; `docs/PLAYER.md`
covers the Player rig specifically; `docs/BEINGS.md` covers the Being
side of the same integration.

## Design philosophy, briefly

"Does this make movement more reusable, more expressive and more
universal across the entire Workshop?" Three decisions carry that:

1. **The Player rig was never a special case.** Every pivot name
   `PlayerCharacter.buildCharacter()` builds (`head`, `torso`,
   `upperArmLeft`, and so on) already *is* the shared Workshop skeleton
   vocabulary this phase names explicitly (`WorkshopSkeleton.js`). There
   was no format to migrate — only a way for *other* rigs to speak the
   same one.
2. **A wrapper around what already works, not a replacement.** Frame
   advancement, pose blending, retargeting, and layering are all new,
   separate, pure-function modules that existing systems now call — none
   of them rewrite `PlayerCharacter.js`'s own rig-building or
   `AnimationLibraryStore.js`'s own clip format.
3. **Honest about where "not perfection" actually lives.** Retargeting an
   arbitrary imported rig, two-bone IK, and procedural layering are all
   genuinely real and tested in this phase — but each has an honest,
   stated boundary (see each section's own "what this doesn't do") rather
   than a claim of doing more than it does.

## Architecture: seven small, separated files

`src/player/`, following the exact "separate responsibilities" instinct
every other Workshop system already established:

- **`AnimationPlayback.js`** — frame advancement and pose blending,
  extracted out of `PlayerAnimationSystem.js`'s own private methods into
  pure functions (`advanceFrame()`, `computeBlendedPose()`) plus a small
  stateful convenience wrapper (`ClipPlayer`) for a consumer that doesn't
  need `PlayerAnimationSystem`'s own movement-state/override logic —
  `BeingController.js`, the Animation Editor's own model preview, and a
  future Animation Sandbox all use this instead of reimplementing it.
  Also where **Animation Events** live — see their own section below.
- **`WorkshopSkeleton.js`** — the canonical joint vocabulary
  (`WORKSHOP_JOINTS`) and `autoMapSkeleton()`, a real heuristic bone-name
  matcher for arbitrary imported rigs — see "Skeleton Mapping" below.
- **`AnimationRetargeting.js`** — applies a Workshop pose to a mapped
  skeleton via rest-pose delta composition — see "Retargeting" below.
- **`TwoBoneIK.js`** — a real, working analytic two-bone IK solver — see
  "Inverse Kinematics" below.
- **`AnimationLayers.js`** — procedural layering (`mergePoses()`,
  `JOINT_GROUPS`) — see "Procedural Animation Layers" below.
- **`PoseLibraryStore.js`** — the shared Pose Library — see its own
  section below.

`PlayerAnimationSystem.js` and `BeingController.js` are the two current
consumers; nothing about any of the six files above assumes which one is
calling it.

## Shared Animation Architecture

**A pose is a plain `{jointName: [x,y,z]}` object** — Euler angles in
radians, keyed by a Workshop joint name. It always was, for the Player
rig; this phase's own contribution was recognising that the *same* plain
object is all any other system needs too, and building the handful of
pure functions (`computeBlendedPose()`, `mergePoses()`,
`applyPoseToMappedSkeleton()`) that operate on it identically regardless
of who's asking.

**`ClipPlayer` is the reusable "play a clip, get a pose" primitive.**
`PlayerAnimationSystem.js` still manages its own `frameIndex`/`frameT`
directly (it has extra concerns — movement-state priority, emote
overrides — a generic player doesn't need to know about), but
`BeingController.js` just does:

```js
runtime.clipPlayer.setClip(clip);
const { pose, events } = runtime.clipPlayer.advance(dt);
```

**Every clip is retargeting-compatible by construction.** Since every
pose is already authored against the shared joint vocabulary, there is no
separate "which skeletons can play this clip" bookkeeping anywhere —
any rig with a usable skeleton map can play any clip in
`AnimationLibraryStore`, the Player rig included.

## How future Workshop systems should consume this architecture

The short version: **map a skeleton, don't build a new player.** Any
future system that wants to animate something (a machine's own moving
parts, a future creature, a door) should:

1. Give whatever it's animating names its own moving parts can be
   recognised by — either the exact Workshop joint names directly (like
   the Player rig), or names `WorkshopSkeleton.autoMapSkeleton()`'s own
   heuristics can match (see "Skeleton Mapping" below), or register its
   own explicit `{jointId: name}` map by hand if neither applies.
2. Own one `ClipPlayer` (or, if it needs Player-style movement-state
   priority, its own small wrapper around `AnimationPlayback.
   advanceFrame()`/`computeBlendedPose()`, the same way
   `PlayerAnimationSystem.js` does).
3. Apply the resulting pose with `PlayerCharacter.applyPose()` (a rig
   with genuinely zero-rotation rest pivots) or `AnimationRetargeting.
   applyPoseToMappedSkeleton()` (anything else).

Nothing about `AnimationLibraryStore`, `AnimationPlayback.js`, or the
Pose Library needs to change for a new consumer to arrive — this is
exactly "future systems should all consume this same animation
architecture" made concrete.

## Retargeting

"The Workshop should be capable of applying compatible animations across
different humanoid models... the goal is not perfection. The goal is
flexibility." `AnimationRetargeting.applyPoseToMappedSkeleton(pose,
skeletonMap, restQuaternions)` is the real mechanism:

- `PlayerCharacter.applyPose()` works because the Player rig's own
  pivots all start at identity rotation — a clip's own authored values
  can simply overwrite `.rotation` outright.
- An imported rig's own bones almost never start at identity — a bind
  pose commonly has each bone already rotated to match the model's own
  natural resting stance. Blindly copying a clip's own values would snap
  it to a different, likely broken-looking pose instead of animating it
  from its own natural one.
- The fix is the standard one: capture each bone's own rest rotation
  once, then apply a clip's own rotation as a *delta* on top of it
  (`rest.multiply(delta)`), in the bone's own local space.

**What this doesn't do**: this is a genuine approximation, not a
full-featured retargeting system. Rigs with very different limb
proportions or fundamentally different bind conventions (a T-pose versus
an A-pose, say) will still look somewhat different from how the same
clip reads on the Player rig — "the goal is not perfection" is a real,
stated boundary here, not an oversight.

## Skeleton Mapping

"Allow imported rigs to be mapped onto a common Workshop skeleton...
Head, Chest, Pelvis, Upper Arms, Lower Arms, Hands, Upper Legs, Lower
Legs, Feet... the Workshop should understand skeleton relationships
rather than relying on exact bone names." `WorkshopSkeleton.
WORKSHOP_JOINTS` names fourteen joints (the brief's own list, minus a
separate "Pelvis" entry — the Player rig's own "torso" pivot already sits
at the hip line and is what every clip's own root rotation is authored
against; a second, never-populated joint for the identical concept would
be exactly the kind of hardcoded-but-unused field this phase's own "avoid
hardcoded assumptions" warns against) — plus five more, added Version 3,
Phase 10d ("Being Creator, Beyond the Prototype, Wave 3") for a
quadruped's own legs and tail (`legFrontLeft`/`Right`,
`legBackLeft`/`Right`, `tailBase` — see `docs/BEINGS.md`'s own "Known
simplifications" for the full account). Those five are deliberately
*not* part of `autoMapSkeleton()`'s own heuristic detection below, or of
`IDENTITY_PLAYER_SKELETON_MAP` (no biped Player rig has a "front leg") —
see `WorkshopSkeleton.js`'s own `QUADRUPED_ONLY_JOINT_IDS` comment for
both reasons and the one real correctness consequence
(`isSkeletonMapUsable()`, below) that already needed a fix because of
it.

**`autoMapSkeleton(root)` is a real, tested heuristic**, not a
placeholder — it walks an arbitrary `THREE.Object3D` hierarchy and
matches bone names against common real-world naming patterns via
case-insensitive substring matching:

- Mixamo's own convention (`mixamorig:LeftForeArm`, `mixamorig:LeftUpLeg`,
  and so on — the single most common rig naming convention actually
  encountered in practice) is matched explicitly, including the specific
  quirk that Mixamo names upper legs `"UpLeg"` and lower legs plain
  `"Leg"` — a real gap found and fixed by testing against a mock Mixamo
  hierarchy during this phase's own development, not assumed correct
  without checking.
- Plain, generic conventions (`"UpperArm_L"`, `"LowerLeg_R"`, and similar)
  are also matched.
- A rig using a naming convention this doesn't recognise honestly comes
  back with fewer joints mapped (or none at all, for a genuinely
  non-humanoid rig) rather than a wrong guess.

**Version 3, Phase 1: validated against real, externally-sourced files,
not only the mock hierarchy above.** Two real glTF models — Khronos's own
`CesiumMan.glb` reference asset, and three.js's own `Soldier.glb` (a
genuine Mixamo export) — went through the actual import → load → map →
spawn → animate pipeline end to end (see `docs/BEINGS.md`'s own account
of both runs). The Mixamo-exported model mapped all 14 joints correctly,
`UpLeg`/`Leg` quirk included, and animated with real, varying rotation
under a real Workshop walk clip. The Khronos asset — a legitimate rig
using a different, non-Mixamo naming convention (`"leg_joint_L_1"`, no
recognisable "head" substring anywhere) — honestly mapped only 5 of 14
and was correctly left unanimated, exactly the "comes back with fewer
joints mapped... rather than a wrong guess" behaviour named above,
demonstrated with a real file rather than only claimed. This same testing
found one real bug: the Khronos model's own skeleton container is named
`"Armature"` (the standard Blender/Mixamo/glTF-exporter default label for
a rig's own root wrapper), and `"armature"` contains `"arm"` as a bare
substring — a false positive for `upperArm`'s own generic fallback
pattern, fixed by excluding a small set of known non-joint container
labels from candidacy at all (see `WorkshopSkeleton.js`'s own
`NON_JOINT_CONTAINER_NAMES` comment), rather than making the `"arm"`
pattern itself stricter and risking genuine compound Mixamo names like
`"LeftHandIndex1"`.

`isSkeletonMapUsable(map)` is the honest threshold — at least half of
whatever `autoMapSkeleton()` could ever actually find need to be found
before anything attempts retargeted playback at all; below that, a
model simply doesn't animate rather than animating a handful of limbs
while the rest of the rig sits frozen, which would read as broken
rather than "partially supported." Deliberately *not* half of
`WORKSHOP_JOINTS.length` directly (fourteen, still, for this specific
threshold) — see `WorkshopSkeleton.js`'s own comment for why growing
that count with joints the heuristic can never populate would have
quietly raised the bar for every ordinary imported biped model too.

**Mapping is cached, not recomputed every spawn.** `ModelLibrary.js`
gained a `skeletonMap` field — a plain `{jointId: boneName}` object, not
live bone references (bone objects are recreated fresh every time
`ModelLoader.load()` clones a model, by design — see
`docs/BEINGS.md`'s own account). The first time a model's skeleton is
auto-mapped, its bone *names* are cached there; every subsequent spawn of
the same model resolves those names against its own fresh clone
immediately, rather than re-running the heuristic matcher every time.

**What this doesn't do**: there's no manual override UI yet for fixing
one wrong entry in an otherwise-good auto-detected mapping — see "Known
simplifications" below.

**Being Creator phase (v2.0.7): a second, exact alternative that needs no
heuristic at all.** A body built entirely from Workshop primitives
(`docs/BEINGS.md`'s own "Body Construction" section) doesn't need its
skeleton *detected* — the creator assigns each part's own `jointName`
directly, and `BodyCompiler.compileBody()` derives a complete, exact
`skeletonMap`/`skeletonRest` straight from those assignments. The two
approaches suit two different situations: heuristic detection is what
makes an *imported* rig (whose bone names this Workshop had no hand in
choosing) usable without manual setup; explicit assignment is simpler and
more reliable whenever the rig is being built here in the first place.

## Imported Rig Support

"Imported humanoid models should naturally become compatible with
Workshop animations wherever practical." This is the direct, practical
payoff of Skeleton Mapping + Retargeting together: a Being using an
imported `.glb`/`.gltf` humanoid model now genuinely plays
`idleAnimationClipId`/`walkAnimationClipId` (already-existing data
references — see `docs/BEINGS.md` — that had nothing actually reading
them before this phase) the moment its own skeleton maps usably, with
zero changes needed to the model file itself, the Being definition, or
any clip in `AnimationLibraryStore`.

**A real, related bug found and fixed along the way**: making this work
for *more than one Being sharing the same model* surfaced a genuine,
previously-documented limitation in `ModelLoader.js` — see
`docs/BEINGS.md`'s own account of the `SkeletonUtils.clone()` fix. This
phase is what turned that from a theoretical concern into something that
needed to actually be correct.

## Inverse Kinematics (IK)

"Begin introducing IK support... foot placement, hand placement, object
interaction, ground adaptation, looking at targets... the architecture
should be established even where complete implementations are deferred."
`TwoBoneIK.solveTwoBoneIK(rootPos, upperLength, lowerLength, target,
poleHint)` is a real, working, tested analytic solver (the classic
law-of-cosines two-bone solution) for the single most common case a
humanoid rig needs — an arm or a leg, exactly two bones, reaching for a
point.

**A pure geometry function, not a rig-specific one** — it returns
*positions and directions* (`midPosition`, `endPosition`,
`upperDirection`, `lowerDirection`), never a rotation in some specific
rig's own local-axis convention. Any caller turns a direction into its
own local rotation using ordinary `THREE.Quaternion.
setFromUnitVectors()`, which is what makes this reusable by the Player
rig, a retargeted Being, or a future Sandbox unchanged.

**Tested against real geometric properties**, not just "it runs without
throwing": a reachable target's own computed end position matches the
target exactly (verified against the actual bone lengths); an
unreachable target (too far, or too close for the given bone lengths) is
honestly reported as `reachable: false` and gracefully clamped rather
than producing `NaN`; a degenerate pole hint (directly in line with the
target) is handled without dividing by zero.

**Ground adaptation, wired for the Player (Version 3, Phase 1 —
"Completing Promises")**: `src/player/FootIK.js`'s `applyTerrainFootIK()`
feeds `solveTwoBoneIK()` a real per-foot target — the outdoor sculpted
terrain's own height under each foot, via `TerrainSystem.getHeightAt()` —
called from `PlayerAnimationSystem.update()` right after `applyPose()`
applies the base pose each frame, while standing still (movement state
`"idle"`) and only where `TerrainSystem` has height data at all (indoors
and off the sculpted patch, this is a silent no-op). Verified against
real sculpted terrain, not just read: the correction is exact when the
target is within the leg's own reach, and honestly reach-limited — not
broken, just visibly small — when a foot needs to drop lower than an
already-near-straight standing leg can reach; see `FootIK.js`'s own
header for the full account of that asymmetry and what closing it would
actually require.

**A second, fixed-target caller (Version 4, Phase 4)**: `applyCrouchFootIK()`,
in the same file, wired to movement state `"crouch"` instead of `"idle"`
— a real playtesting report ("the feet leave the ground instead of the
whole body moving down") traced to `CROUCH_CLIP`'s own authored leg
angles being pure forward kinematics with nothing correcting them, which
floated the foot 0.216m off the ground given the rig's fixed hip height
(`docs/PLAYER.md`'s own "no vertical translation at all" account). Unlike
the terrain caller, the target here is always the same fixed point —
straight down from the hip by the standing leg's own span, read live from
the rig's own segment lengths — not a per-frame terrain sample, so this
caller needs no `TerrainSystem` at all and works identically indoors,
outdoors, or on Builder geometry. Reuses `applyLegIK()`, not a second
solver — exactly the "several doors in, one implementation" shape this
file already established for the terrain case. See `docs/PLAYER.md`'s own
account for the honest limit this specific target hits (no slack left for
a visibly bent knee while also holding exact height, given the standing
leg is already at ~99.99% of its own reach).

**A third caller, restored (Version 4, Phase 8a — "The Rest of IK")**:
`applyWalkFootIK()`, closing the gap this section itself used to name
("foot placement during a walk cycle is a genuinely different,
animation-phase-aware problem"). The obstacle was never the correction
math — `applyLegIK()` already generalises to either leg — it was knowing
*which* foot is currently planted, since correcting the swinging leg
would flatten its own intentional lift. `WALK_CLIP`'s own four authored
frames (`AnimationClips.js`) already answer that: frames 0 and 2 each
have one leg back and nearly straight (stance) and the other forward and
bent (swing), mirrored; frames 1 and 3 are brief (0.14s) passing poses
with no single clear stance leg. A small internal lookup
(`frameIndex → stance side`) reads `PlayerAnimationSystem`'s own current
`_frameIndex` — already current for the frame by the time this runs —
and applies the identical relative-height correction
`applyTerrainFootIK()` already uses, but only to that one leg; the swing
leg, and both legs during the brief transition frames, are left exactly
as the authored pose set them. Safe to hardcode the frame mapping
against: the seeded `"default-walk"` clip is read-only
(`AnimationLibraryStore.isDefault()`), so a player can't reshape it into
something this mapping would no longer describe. Verified live against
real sculpted terrain: driving the player through both stance halves of
the cycle at the identical root position, the stance foot's own ankle
height measurably tracked the local terrain difference while the swing
foot's ankle height was byte-for-byte identical to a flattened-terrain
control — proof the correction reaches only the leg it's supposed to.

**Hand placement and object interaction, closed (Version 4, Phase 8b —
"The Rest of IK")**: `TwoBoneIK.applyTwoBoneChain()`, a shared, rig-
agnostic export of the exact quaternion-conversion glue `FootIK.js`'s own
private `applyLegIK()` already established — kept as a second, separate
function rather than reaching into `FootIK.js`'s private one, so the
already-verified leg correction carries zero regression risk from this
phase's own work. Safe to reuse unchanged for an arm: `PlayerCharacter.js`
and `BodyCompiler.js` were both read directly (not assumed) before
writing this, confirming every limb segment either file builds — leg
*and* arm alike — shares the identical rest convention `applyLegIK()`
already relies on (each child pivot's own rest position, quaternion
identity, points straight down, local `-Y`, from its parent). `HandIK.js`
(`src/player/`) is the arm-specific caller: `applyHoldPose()`, a
continuous correction bending the right arm toward a fixed "carrying
something at chest height" spot every frame while an item is held; and
`applyReachPose()`, a one-shot left-arm reach toward a world position
over 0.6s, eased out and back via a sine envelope blending between the
full IK solve and whatever the base pose already had (rather than
snapping to the target and holding it). Both are called by a new system,
`HandInteractionSystem.js` (`src/systems/`) — deliberately not folded
into `PlayerAnimationSystem`, which stays completely untouched this
phase; registered after it in `main.js`'s own system list is enough to
guarantee this frame's base pose is already applied first, the identical
"correction after the base pose" contract every `FootIK.js` caller
already follows.

**Right hand holds, left hand reaches** — deliberate, not arbitrary: a
held object and a light-switch reach can genuinely overlap in time
(nothing stops carrying a book while flipping a light on), and opposite
hands mean the two poses never need to coordinate or fight over the same
arm. See `docs/WORLDBUILDER.md`'s own "Pickupable" account for the
behaviour/event side of picking something up in the first place, and this
document's "Known simplifications" below for what's honestly not
attempted this wave (looking at targets, still open).

## Procedural Animation Layers

"Rather than creating hundreds of separate animations, the Workshop
should eventually combine animations together... walking while waving...
the architecture should support layered animation rather than replacing
base animations." Real and working, not only prepared — since every pose
is already a plain object, "layer one animation over another" is
genuinely just "merge two plain objects, letting one win for a chosen
subset of keys":

```js
playerAnimationSystem.playOverlay(waveClipId, "upperBody");
// ...later...
playerAnimationSystem.stopOverlay();
```

`AnimationLayers.JOINT_GROUPS` names the splits actually needed today
(`upperBody`/`lowerBody`/`armsOnly`/`headOnly`) — a caller wanting a
different split passes its own explicit joint list instead;
`mergePoses()` itself has no opinion on what a sensible split looks like,
only how to apply one. The base layer (movement state, or an emote
override) keeps running completely unaffected; the overlay only ever
replaces the joints it's actually given, so an overlay clip that doesn't
bother animating every joint in its own group (a Wave clip that says
nothing about the head, say) doesn't blank that joint to rest.

Currently wired into `PlayerAnimationSystem.js` only — `BeingController.js`
doesn't yet layer a second clip over a Being's own idle/walk (see "Known
simplifications").

## Animation Events

"Animations should be capable of triggering Workshop behaviours...
footstep sounds, particles, interaction timing, object movement... the
Workshop should naturally allow animations to communicate with other
systems." A frame can carry an optional `events: [{type, data}]` array —
`AnimationLibraryStore.js` normalises every frame, old or new, to always
have a real (possibly empty) array, so no call site needs its own
null-check.

Whichever system is actually playing a clip emits any event it crosses on
the engine's own `EventBus`, as `"animation:event"`:

```js
engine.events.on("animation:event", ({ source, clipId, type, data }) => {
  if (type === "footstep") { /* play a sound, spawn a particle, whatever a future system wants */ }
});
```

`source` is `"player"`, `"player-overlay"`, or `"being"` — enough for a
listener to tell which layer or which kind of mover produced an event if
it cares, without this mechanism needing a heavier subscription model.
No listener exists yet for any specific event type (footstep sounds,
particles) — the mechanism is real and fires correctly; *reacting* to it
is an honest future extension point, not something faked with a stub
sound.

## Pose Library

"Please introduce the foundations for a shared pose library... idle
poses, hand poses, interaction poses... these should become reusable
Workshop Assets." `PoseLibraryStore.js` — a pose is simply one frame,
saved on its own, the identical `{jointName: [x,y,z]}` shape every clip's
own frame already uses, just without a duration or a place in a
sequence. "Save Frame as Pose" sits in the Animation Editor's own frame
list, available even while viewing a read-only default clip (extracting
"just this one pose" from Walk or Wave is exactly the kind of reuse a
shared library is for).

**A real Workshop Asset kind**, registered in `main.js`'s own asset-kind
wiring (`"poses"`) exactly like Objects, Blueprints, and Animations
already are — searchable, favouritable, browsable in the Shared Asset
Library, with zero special-casing anywhere in `AssetService.js` or
`AssetPages.js`. See `docs/ASSETS.md` for the shared architecture this
plugs into.

**What this doesn't do yet**: there's no "apply a saved pose back to the
current frame" button in the Editor yet, and no dedicated `asset://pose/`
detail page (poses fall back to the Asset Library's own honest "no
detail page for this kind yet" note — see `docs/BROWSER.md`'s own "File
Pages" section). Both are natural, modest next steps once the library
itself is being used.

## Animation Editor

"Continue refining the Animation Editor... larger preview, better
playback controls, improved timeline usability... future retargeting
tools." The split-workspace layout, working-copy editing model, and
frame/pivot controls are all unchanged this phase — see
`docs/PLAYER.md`'s own "The Animation Editor" section for that
architecture. What changed:

- **"The player should be capable of previewing animations using
  different compatible models... the preview should become independent
  of any single character."** The Model dropdown (Player, any Saved
  Being, any Imported Model) already existed; selecting a Being or Model
  now genuinely retargets the current pose/playback onto that model's own
  skeleton, via the identical path `BeingController.js` uses for a placed
  Being — not merely showing the model's own static proportions the way
  it did before this phase.
- **"Save Frame as Pose"** — see "Pose Library" above.

## Animation Sandbox

"Please consider introducing an Animation Sandbox... a safe environment
where animations can be previewed, tested and refined before use
elsewhere in the Workshop... playback, looping, speed adjustment, model
selection, lighting, camera controls." The brief's own wording — "please
consider" — is softer than every other section's own direct instruction,
and this phase's own honest answer is: the Animation Editor's existing
preview pane already *is* this, substantially — an isolated scene,
playback/loop/speed controls, and, as of this phase, genuine
model-switching (see "Animation Editor" above). A fully separate Sandbox
app, with its own lighting and camera controls independent of the
Editor's own preview, is a real, reasonable next step rather than
something this phase judged necessary to duplicate — see "Future
extension points."

## Asset System Integration

"Animations should naturally support: Metadata, Categories, Tags,
Relationships, Dependencies, Validation, Searching, Versioning, Future
optimisation." All of this arrived already, in the Workshop Asset System
phase (`docs/ASSETS.md`) — Animations were one of the first three kinds
to get real Browser detail pages. This phase's own addition is Poses
joining as a seventh registered kind (see "Pose Library" above),
following the identical pattern.

## Browser Integration

"Every Workshop Asset should eventually have its own Browser page...
preview, metadata, relationships, dependencies, compatible skeletons,
usage." An animation's own `asset://animation/<id>` page (from the
Workshop Asset System phase) already shows real metadata, frame count,
duration, loop/speed settings, and validation status. "Compatible
skeletons" specifically needed no new field to add — since every clip is
retargeting-compatible by construction (see "Shared Animation
Architecture" above), there's nothing to list; any rig with a usable
skeleton map can already play it. "Usage" (which Beings currently
reference a given clip as their own idle/walk animation) is a real,
reasonable next step this phase didn't build — see "Future extension
points."

## Known simplifications (by design, for this phase)

- **No manual skeleton-mapping override UI** — `autoMapSkeleton()`'s own
  result can't currently be hand-corrected if it gets one joint wrong; a
  person can only accept what it found or not use that model for
  retargeted playback at all.
- **IK is wired for five real gameplay cases (Player ground adaptation
  while idle, crouch foot-planting — Version 4, Phase 4 — walk-cycle foot
  placement — Version 4, Phase 8a — and holding a picked-up object /
  reaching for the light switch — Version 4, Phase 8b) and not yet the
  last one** (looking at targets, for the head/torso) — see "Inverse
  Kinematics" above.
- **The held-object pose is a fixed carry spot, not a precise hand-
  contact fit** — a picked-up object sits at a small, honest local offset
  from the wrist pivot's own origin (see `HandInteractionSystem.js`'s own
  comment), reading as "held in front of the body" rather than exactly
  gripped between the fingers; a genuinely fitted grip per object shape
  is real future work, not attempted this wave.
- **Only one Construction piece (`book`) carries the Pickupable
  behaviour** — real, and generically available to any player-authored
  Builder object too (see `docs/WORLDBUILDER.md`'s own "Pickupable"
  account), but deliberately not yet extended to a wider "item" system
  (stacking, an inventory, multiple simultaneously-held objects) — "we
  will expand this later" was Vi's own framing for this piece, not a
  promise this phase tried to keep beyond its own scope.
- **Procedural layering only exists on the Player rig** — `BeingController.js`
  doesn't yet support a second, layered clip on top of a Being's own
  idle/walk.
- **Animation Events fire correctly; nothing listens yet** — no footstep
  sound, no particle effect is wired to any event today.
- **No dedicated Animation Sandbox app** — the Animation Editor's own
  preview pane covers substantially the same ground; see "Animation
  Sandbox" above.
- **No "apply a saved pose" button, no per-pose Browser detail page** —
  see "Pose Library" above.
- **No "usage" (which Beings reference this clip) shown on an animation's
  own Browser page** — see "Browser Integration" above.

## Future extension points

- **Manual skeleton-map correction** — a small UI (a joint dropdown per
  Workshop joint, listing the model's own bone names) editing
  `ModelLibrary`'s own cached `skeletonMap` directly.
- **The last piece of "The Rest of IK"** — "looking at targets" for the
  head/torso, `docs/ROADMAP.md`'s own Phase 8c; walk-cycle foot placement
  and hand placement/object interaction both already shipped (Phase 8a,
  8b) — see "Inverse Kinematics" above. Also still open: closing the
  reach-limited downward-correction gap `FootIK.js`'s own header
  documents (retuning the idle clip's own knee bend, or a root-height
  adjustment in `CameraSystem`).
- **A wider item system** — stacking, an inventory, carrying more than
  one object — Phase 8b's own `book`/Pickupable is deliberately just a
  beginning, per Vi's own framing; see "Known simplifications" above.
- **Layered playback for Beings**, the same `AnimationLayers.mergePoses()`
  mechanism `PlayerAnimationSystem.js` already uses.
- **Real listeners for animation events** — a footstep sound system, a
  particle system, both able to subscribe to `"animation:event"` without
  either the Player or Being animation code needing to change at all.
- **A dedicated Animation Sandbox app**, if the Editor's own preview pane
  ever needs to grow independent lighting/camera controls beyond what a
  shared preview scene reasonably supports.
- **Pose Library maturity** — an "apply to current frame" control, a
  dedicated `asset://pose/<id>` Browser detail page, matching the shape
  Objects/Blueprints/Animations already have.
- **"Usage" relationships for animations** — which Beings currently
  reference a clip as their own idle/walk animation, the identical
  `AssetService.getUsedBy()` mechanism already computes for Blueprints
  depending on Objects, extended to a second kind of reference.
