# Beings

"This is NOT about adding hard-coded NPCs. This is about creating a
complete system for designing, saving, placing and managing Beings within
the Workshop." Every creature, resident, animal, robot, or future
character is simply another Workshop asset — created, saved, placed, and
managed the same way a Builder object or an animation clip already is.
This document covers how that system is built; `docs/RESIDENT.md` covers
the Workshop's own first resident specifically, which predates this
system and remains its own thing for now (see "Future extension points"
below for how the two relate).

## Shared Workshop Asset philosophy

"Objects are Workshop assets. Animations are Workshop assets. Player
appearances are Workshop assets. Builder creations are Workshop assets.
Now... Beings should also become Workshop assets." Concretely, that means
the exact same three-part shape every other creative surface in the
Workshop already uses:

- **A library of definitions** (`BeingLibrary.js`) — what a Being *is*,
  created and edited in the Being Creator, never automatically placed
  anywhere.
- **A store of placed instances** (`BeingInstanceStore.js`) — thin
  references to a definition plus their own position and state, the same
  `WorldObjectsStore.js` already established for Builder objects.
- **A dedicated editor application** (`BeingCreatorApp.js`) — the same
  two-pane, live-preview shape `BuilderApp.js` already established, reused
  rather than reinvented.

**Models are shared Workshop assets too, not owned by Beings.**
`ModelLibrary.js`/`ModelAssetStore.js`/`ModelLoader.js` know nothing about
what a Being is — "reused by Beings, Builder, Player, future systems" is
true today: nothing in this trio has a single Being-specific line in it.

## Architecture: ten small, separated files

`src/beings/`, following the exact "separate responsibilities" instinct
`src/ai/`, `src/resident/`, and `src/host/` already established:

- **`ModelAssetStore.js`** — raw `.glb`/`.gltf` file bytes in IndexedDB,
  mirroring `ImageAssetStore.js`'s own "real binary data doesn't belong in
  `localStorage`" split.
- **`ModelLibrary.js`** — the metadata index (name, format, and — new in
  the Being Creator phase — a cached `skeletonMap` once one's been
  auto-detected) for imported models, ordinary JSON through
  `PersistenceSystem`.
- **`ModelLoader.js`** — turns a model id into an actual, usable, cached
  `THREE.Object3D` via `GLTFLoader`. The only file that knows what a
  `GLTFLoader` is.
- **`BodyCompiler.js`** *(new in the Being Creator phase)* — turns a flat,
  parent-referencing body-parts array into a real, hierarchical
  `THREE.Object3D` plus an exact skeleton derived from explicit joint
  assignments — see "Body Construction" below.
- **`BeingBehaviours.js`** — the modular behaviour vocabulary (Movement,
  Idle, Awareness, Interaction, plus Being Type) as plain data — ids,
  labels, short descriptions. No scripting surface anywhere in it.
- **`BeingLibrary.js`** — the CRUD store for saved Being definitions,
  plus export/import.
- **`BeingInstanceStore.js`** — every placed Being anywhere in the
  (currently singular) world.
- **`BeingMovementSystem.js`** — stateless movement/idle computation
  (wander targets, patrol routes, obstacle avoidance nudges).
- **`BeingController.js`** — the one engine system that actually spawns,
  moves, and renders every placed Being each frame, tying the rest
  together.
- **`BeingSpawnerSystem.js`** — the world-space ghost-preview placement
  workflow.

"Avoid tightly coupling these systems together" is true by construction:
`BeingLibrary` has never heard of a `THREE.Object3D`; `ModelLibrary` has
never heard of a Being; `BeingMovementSystem`'s functions take plain
vectors and colliders as arguments, with no reference to `BeingController`
or any store at all; `BodyCompiler.js` has never heard of `BeingLibrary`
either — it only ever operates on a plain `bodyParts` array handed to it,
by `BeingCreatorApp.js`'s own draft or by `BeingController.js`'s own
saved definition, whichever is asking.

## Being Creator

`BeingCreatorApp.js` — "the Workshop should allow creators to build life
from nothing. Not just import it... just as the Builder creates
buildings, the Being Creator should create creatures." Reuses
`PreviewRenderer.js` completely unchanged (it was already written
generically enough that "a small, self-contained Three.js scene
previewing whatever object3D you hand it" needed nothing Being-specific
added), and the same `.builder-workspace`/`.builder-workspace-preview`/
`.builder-workspace-form` layout classes `BuilderApp.js` already
established — orbit (drag) and zoom (scroll) both come for free.

**Editing is draft-then-save**, exactly like Builder — nothing reaches
`BeingLibrary` until "Save to Library" is pressed, so trying a shape, a
colour, or a different model costs nothing. "Creating a Being should not
automatically place it into the world" is true by construction: this file
never imports or calls anything on `BeingInstanceStore` at all.

Every property the brief lists — Name, Description, Being Type, Tags,
Model, Scale, Movement Style, Idle Behaviour, Walk Speed, Turn Speed, Home
Radius, Interaction Behaviour, plus Awareness — is a real, editable field.
Movement/turn speed fields only appear once a Movement Style other than
Static is chosen, since they're meaningless for something that never
moves.

**Being Creator phase (v2.0.7): a body comes from exactly one of two
places.** `draft.bodySource` is `"primitives"` (new — see "Body
Construction" below) or `"model"` (imported, unchanged from earlier
phases) — a plain toggle at the top of the form. A fresh Being now starts
with `bodySource: "primitives"` and one sensible starting part (a
"Torso," already tagged with the `torso` rig joint) rather than an empty
form, so there's immediately something to look at and build outward from
— "the experience should feel fast, intuitive and enjoyable" made
concrete as the very first thing a new user sees.

## Body Construction

"Support creating beings entirely from primitive shapes... introduce a
true body hierarchy... the hierarchy should become the heart of the
Being Creator." `src/beings/BodyCompiler.js` is the whole mechanism — the
same role `ObjectCompiler.js` already plays for Builder objects (turn a
plain data description into a real `THREE.Object3D`, nothing more),
applied to something `ObjectCompiler.js`'s own flat, single-root `parts`
array was never built for: a genuine parent-child hierarchy and full
three-axis rotation per part.

**A body part is `{id, name, parentId, jointName, shape, position,
rotation, scale, meshOffset, color}`.** Four primitive shapes — Cube, Sphere,
Cylinder, Capsule (`THREE.CapsuleGeometry`, available since Three.js
r142; this Workshop runs r164) — each built once as a cached, unit-sized
geometry and reused across every part that needs it, exactly
`ObjectCompiler.js`'s own "geometry itself never varies" reasoning.
`parentId` is another part's own id, or `null` for a part attached
directly to the body's own root — "the hierarchy should remain flexible
rather than enforcing a humanoid structure... two arms, six legs, four
wings, multiple heads, or anything else the creator imagines" is true
because nothing about this shape assumes any particular structure at
all; it's just a tree.

**A body part *is* a rig joint, when the creator says so — not two
separate systems.** "Rig Creation... please optimise for clarity rather
than complexity" is honoured directly: rather than a second, parallel
"bones" data structure layered on top of the body hierarchy, any part can
carry an optional `jointName` — one of `WorkshopSkeleton.WORKSHOP_JOINTS`'
own ids (Head, Chest, Upper/Lower Arms and Legs, Hands, Feet — see
`docs/ANIMATION.md`'s own "Skeleton Mapping" section for the full list
and reasoning). `BodyCompiler.compileBody()` derives a complete, *exact*
`skeletonMap`/`skeletonRest` directly from whichever parts were actually
tagged — no heuristic bone-name matching is ever needed for a primitive
body, since the creator declared the mapping explicitly and correctly by
construction. At most one part per joint name — the editor's own "Rig
Joint" dropdown simply leaves out whichever joints another part has
already claimed, rather than allowing a conflict and needing to resolve
one later.

**Construction Workflow.** "Adding new parts, selecting parts, moving/
rotating/scaling, duplicating, mirroring, symmetry tools, resetting
transforms." A flat, indented hierarchy list (`orderedByHierarchy()` —
every part appears right after its own parent, however the underlying
array happens to be ordered, so re-parenting never leaves the list
looking scrambled) doubles as the selection mechanism — clicking a row
selects that part, which is also highlighted in the live preview (an
emissive material tint cloned onto its mesh, the identical technique
`BuilderApp.js`'s own part selection already uses, down to disposing the
clone on every refresh rather than mutating the shared cached material).
"Add Part" adds a new Cube parented to whichever part is currently
selected (or the root, if none is); "Mirror" duplicates an entire
selected sub-tree — not just one part — reflected across the body's own
centre line, with `jointName`/`name` swapped Left↔Right wherever that
text or joint id appears (`BodyCompiler.mirrorSubtree()`), and reattached
as a sibling of the original rather than nested inside it. "Duplicate"
copies just the one selected part (never its own `jointName`, since a
joint id can only ever belong to one part at a time). "Delete" removes a
part and everything parented beneath it, honestly, rather than leaving
orphaned children behind. Every transform field (position, rotation —
shown in degrees for readability, converted to/from the radians actually
stored, the same convention the Animation Editor already established —
scale, and mesh offset) is three sliders in a row, immediate, no
separate "apply" step.

**Version 3, Phase 10b ("Being Creator, Beyond the Prototype") — a real
pivot, separate from the mesh it carries.** Every part used to be a
single `THREE.Mesh` doing double duty as both "the joint" and "the
visible box" — a genuine, previously-undetected bug followed directly
from that: a `THREE.Object3D`'s own `scale` applies to its *children's*
local coordinates too, not just its own geometry, so a child part's
authored `position` was silently multiplied by whatever scale its
parent happened to have. Confirmed live against the default Person's
own compiled positions (Version 3, Phase 10): the head rendered 0.38m
above the torso, not the 0.53m its own data said, and the shoulders sat
at ±0.166m, not the intended ±0.32m — every multi-part hierarchy with a
non-uniformly-scaled parent was quietly distorted this way. Every part
is now two nodes: a pivot (still what `position`/`rotation`/`jointName`
describe, and still what a *child* part parents to — unaffected by any
scale, exactly like `PlayerCharacter.js`'s own shoulder/elbow/wrist
pivots) carrying one mesh, offset from that pivot by the new
`meshOffset` field. **`meshOffset` defaults to `[0, 0, 0]`** — every
part saved before this phase renders exactly where it always visually
sat, just now correctly unscaled by its parent, which is a genuine
visual *correction* for existing content, not merely an invisible
re-architecture (the default Person, unedited since Phase 10, now
renders at its originally-*intended* proportions for the first time).
The editor's own "Hang Below Pivot" button is the common case made one
click — a limb's shape sitting directly beneath its own joint, sized to
whatever the part's current Scale already is.

**Selecting a part directly from the 3D preview, collapsing hierarchy
branches, and true drag-and-drop re-parenting are all honest, deliberate
simplifications this phase — see "Known simplifications" below**; a
"Parent" dropdown (excluding the part itself and its own descendants, so
re-parenting can never create a cycle — `BodyCompiler.descendantIds()`)
covers re-parenting today, just without the drag gesture.

## Imported Models

"The Workshop should treat imported beings exactly the same as internally
created beings." True for everything *downstream* of a model — animation
playback, Asset System integration, saving — unchanged from the Advanced
Animation phase's own retargeting work (see `docs/ANIMATION.md`). What
this phase does *not* attempt is true hybrid editing — adding new
primitive body parts onto an existing imported model's own hierarchy, or
replacing one of its parts — which stays an honest future extension
point (see "Known simplifications" below) rather than a half-built
feature. An imported model and a primitive-built body are each a
complete, independent way to give a Being its own physical form today;
mixing the two within one Being is real, valuable, future work this
phase deliberately didn't rush.

## Animation Compatibility

"The Being Creator does not need to become an animation editor. However,
it should prepare beings so they're ready to move." The Being Creator's
own preview pane genuinely plays Workshop animations now — a "Preview"
button next to the Idle Animation dropdown, using the exact same
`ClipPlayer`/`AnimationRetargeting.applyPoseToMappedSkeleton()` pairing
`BeingController.js` uses for a placed Being, so a preview here is an
honest rehearsal of what actually happens once this Being is saved and
placed, not an approximation of it. This works identically for both body
sources: a primitive body's own skeleton is exact (see "Body
Construction" above); an imported model's is checked the identical way
`BeingController.js` checks it for real — `WorkshopSkeleton.
autoMapSkeleton()`, with an honest note shown instead of a play button
when nothing maps confidently enough. "Skeleton validation... rig
validation" happens automatically, every time the form re-renders — a
primitive Being with no Rig Joints assigned, or an imported one whose
skeleton doesn't map, both show a plain, specific explanation right where
the Preview button would otherwise be, rather than a button that quietly
does nothing when clicked.

## Asset System Integration

"Being Creator should now fully integrate with the Workshop Asset
System... completed beings should become Workshop Assets. The creator
should not manage files directly. It should create Workshop Assets."
`"beings"` is a real, registered `AssetService` kind (`main.js`'s own
asset-kind wiring), following the identical pattern every other kind
already does:

- **Metadata, Categories, Tags** — real, from the Being's own Name,
  Description, and Tags fields; `beingType` (Resident, Person, Animal,
  Robot, Creature, Decoration, Custom — an organisational label, unrelated
  to actual behaviour) maps onto `WorkshopAssetSchema.
  WORKSHOP_ASSET_CATEGORIES`'s own suggested vocabulary.
- **Thumbnails** — real, for a primitive-built body: `buildSwatchThumbnail()`
  built from the body's own actual part colours, the identical technique
  Objects/Blueprints already use.
- **Dependencies, genuinely real, not fabricated** — a Being depends on
  the model it's built from (if imported) and on whichever animation
  clips it's assigned, computed the same honest way Blueprints depending
  on Objects already are (see `docs/ASSETS.md`'s own "Relationships &
  Dependencies" section).
- **Validation** — a primitive Being with no body parts, no Rig Joints
  assigned, or an imported one with no model chosen, are each flagged
  with a specific, genuinely useful issue, not a generic "invalid" label.
- **Searching** — real, immediately, via the same `workshop://search`
  every other kind already feeds.
- **A real Browser detail page** — `asset://being/<id>` (`AssetPages.js`),
  following the identical shape Objects/Blueprints/Animations already
  established: a real preview (part-colour swatches for a primitive body,
  an honest note for an imported one), the full common envelope,
  dependencies and used-by, and honest actions.

**A real, unrelated bug found and fixed along the way.** Building this
kind's own dependency-checking surfaced that `AnimationLibraryStore.
get(id)` deliberately only searches *user* clips (`getClip(id)` is the
one that resolves either kind — see that file's own comment) — the
"animations" kind's own `get()` had been using the wrong one since the
Workshop Asset System phase, meaning any of the eight seeded default
clips (Walk, Wave, Jump...) silently failed `AssetService.describe()`/
`exists()` — a broken detail page, a favourited default clip quietly
vanishing from Favourites, and (the more serious consequence) a false
"missing dependency" validation warning on any Being or Blueprint that
referenced one. Fixed at the root, in both the "animations" kind's own
registration and `AssetPages.js`'s matching call.

## Model Library and Model Import

"Import models, save imported models, rename models, delete models,
preview models" — all real, all in the Being Creator's own Model section
(no separate screen needed for this phase's own scope). Import accepts
`.glb` (stored as a raw `ArrayBuffer`, parsed directly by `GLTFLoader`)
and `.gltf` (stored as plain text — only self-contained files with
embedded base64 data URIs actually work, since a `.gltf` referencing
external `.bin`/image files has nothing to resolve those paths against
once it's just bytes in IndexedDB). "Focus on creating a clean import
architecture. Additional formats can be added in future phases" — the one
place a future format (`.obj`, `.fbx`, whatever) would need new code is
`ModelLoader.js`'s own `_parse()`; nothing about `ModelLibrary` or
`ModelAssetStore` would need to change at all.

Preview happens automatically — selecting a model in the dropdown updates
the live 3D viewport immediately, the same view used for editing
everything else about the Being.

**A real bug, found and fixed in the Advanced Animation phase**:
`ModelLoader.load()` used to clone a parsed model's scene graph with a
plain `object3D.clone(true)`, not `SkeletonUtils.clone()` — documented
here, at the time, as "correct for simple, unanimated models... a
skinned, animated rig cloned this way shares its skeleton across every
clone... worth fixing before animated Beings actually needed it." That
moment arrived this phase: `BeingController.js` began genuinely
retargeting Workshop animations onto a Being's own model (see
`docs/ANIMATION.md`), which is exactly the scenario that limitation
would have broken — two Beings sharing one animated model would have
shown identical, shared, or simply wrong movement, since a `SkinnedMesh`'s
own `.skeleton.bones` reference list isn't part of the ordinary
parent/child hierarchy a plain clone correctly duplicates. Fixed at the
root: `ModelLoader.js` now uses `SkeletonUtils.clone()`, the standard
Three.js answer to exactly this, which works identically to plain clone
for a model with no skeleton at all — a safe, unconditional replacement,
not a special case reserved for "animated models only."

## Behaviour System

"Avoid scripting. Instead, combine simple behaviours into reusable Being
definitions." Four independent categories in `BeingBehaviours.js`, each a
small closed enum — Movement (Static/Wander/Patrol/Follow/Stay Near
Home), Idle (Stand/Look Around/Sit/Sleep/Float/Read), Awareness (Ignore
Player/Look At Player/Follow Player With Eyes), Interaction
(Talk/Wave/Inspect/None). A Being definition picks exactly one value from
each; the combination *is* the entire behaviour. There is no expression
language, no conditions, anywhere in how `BeingController.js`/
`BeingMovementSystem.js` read these values — they're switch statements
over a closed set of ids, not an interpreter.

**Movement** is computed by `BeingMovementSystem.js`'s own stateless
functions — a wander target is a random point within the home radius,
retried if it lands inside a known wall/furniture collider; a patrol
route is a small fixed loop of points, generated once and reused; Follow
only actually chases while the player is somewhere the Being's own home
radius would still reach, otherwise it goes back to idling rather than
"stays near the player" quietly meaning "follows anywhere at all."

**Idle** motion is continuous procedural movement even while standing
still — "movement should feel relaxed rather than robotic" applies as
much at rest as while travelling. `idleMotionOffset()` only changes the
*shape* of that motion (float bobs more; sleep barely moves at all), not
whether it happens.

**Awareness** is one smoothed 0-1 blend value, the same "no combinatorial
state machine" approach `ResidentBehaviour.js`'s own awareness already
uses — easing toward looking at the player within a radius, easing back
as they leave it.

**Interaction** doesn't open a chat interface — a Being isn't connected to
Ollama the way the Workshop's own resident is. Talking, waving, or
inspecting shows a brief, honest message via the same `hud:toast`
mechanism the rest of the Workshop already uses for short, transient
text, using the Being's own description as its "something to say."

## Collision and movement believability

"Beings should naturally avoid walls, furniture, other Beings... avoid
overcomplicating pathfinding during this phase." `avoidObstacles()` is a
simple steering nudge, not real pathfinding: wander/patrol targets are
validated against known collision boxes (`RoomLayoutSystem`'s wall
colliders, `FurnitureSystem`'s footprints) when first chosen, and the
straight-line step toward wherever a Being is currently heading gets a
small, continuous repulsion push away from anything it's presently
overlapping — including other Beings, via a simple distance check against
every other placed instance's own current position. A believable
illusion of care, not a solved navigation problem; a Being can still
occasionally end up motionless near an obstacle it can't step around,
which reads as "waiting," not as a visible bug.

## Animation Integration

"Beings should simply reference Workshop animation assets. Avoid
duplicating animation systems." A Being definition stores
`idleAnimationClipId`/`walkAnimationClipId` — plain references into the
exact same `AnimationLibraryStore` the Player Animation Editor already
edits, shown as a dropdown of that store's own real clips in the Being
Creator. There is no second animation system, no Being-specific clip
format, anywhere in `src/beings/`.

**Advanced Animation phase (v2.0.6): genuinely real playback, not only a
data reference.** The moment a Being's own model finishes loading,
`BeingController.js` maps its skeleton onto the shared Workshop
vocabulary (`WorkshopSkeleton.autoMapSkeleton()` — see
`docs/ANIMATION.md`'s own "Skeleton Mapping" section), caching the result
on `ModelLibrary` so the same model's next spawn resolves it immediately
rather than re-detecting it. If the mapping is usable, a `ClipPlayer`
(`AnimationPlayback.js`) picks `walkAnimationClipId`/`idleAnimationClipId`
based on `instance.currentState` (already tracked for movement) and
applies the result through `AnimationRetargeting.
applyPoseToMappedSkeleton()` every frame — the identical retargeting path
the Animation Editor's own model preview now uses. A Being with an
unmapped or absent model simply doesn't animate, exactly as it always
has; nothing about this required any Being's own appearance to change.
See `docs/ANIMATION.md` for the full architecture.

**Version 3, Phase 1 ("Completing Promises"): validated end to end, with
real content, not just read.** `docs/HISTORY.md`'s own Version 2 handover
named this directly: `WorkshopSkeleton.autoMapSkeleton()` was "a real,
working heuristic waiting for the first imported Being that actually
exercises it end to end" — validated only against a mock Mixamo hierarchy
during its own development phase, never against a real downloaded file
going through the real import → load → map → spawn → animate pipeline.
This phase did exactly that, with two real, externally-sourced glTF
models (Khronos's own `CesiumMan.glb` reference asset, and three.js's own
`Soldier.glb`, a genuine Mixamo export) — imported through the real
`importModelFile()` path, spawned through the real `BeingLibrary`/
`BeingInstanceStore`/`BeingController` pipeline, and driven by real
`default-idle`/`default-walk` clips. The Mixamo-exported model mapped
perfectly (14/14 joints, including the `UpLeg`/`Leg` naming quirk
`autoMapSkeleton()`'s own comment already documented handling) and
animated correctly — leg and arm rotations swung through a genuine 9°-28°
range during the walk clip, confirmed non-`NaN`, confirmed actually
varying frame to frame. The Khronos asset mapped only 5 of 14 joints and
was honestly left unanimated by `isSkeletonMapUsable()`'s own threshold —
its own naming convention (`"leg_joint_L_1"`, no recognisable "head" or
"hand" substring anywhere) simply isn't the naming this heuristic targets,
which is a real, informative result, not a failure of the validation.

**A real bug, found by this testing, not assumed away.** The Khronos
model's own skeleton sits inside a container node literally named
`"Armature"` — the standard Blender/Mixamo/glTF-exporter default label
for a rig's own root wrapper — and `"armature"` contains `"arm"` as a bare
substring, so it was matching `upperArm`'s own generic fallback pattern
before any real arm bone got a chance to (first match wins). Fixed by
excluding a small, explicit set of known non-joint container labels
(`"armature"`, `"skeleton"`, `"root"`, `"rig"`) from ever being considered
a joint candidate at all, rather than making the `"arm"` pattern itself
stricter — a word-boundary requirement would have risked breaking genuine
compound Mixamo names like `"LeftHandIndex1"`, which is exactly the
real-world naming this heuristic exists to handle. See
`WorkshopSkeleton.js`'s own comment on `NON_JOINT_CONTAINER_NAMES` for
the full account.

**Being Creator phase (v2.0.7): a second, exact way to get a rig.** A
primitive-built body (`BodyCompiler.js`) needs no heuristic detection at
all — its own skeleton is derived directly from whichever parts the
creator explicitly tagged with a `jointName`, in `BeingCreatorApp.js`'s
own Body Construction section. Both paths feed the exact same
`ClipPlayer`/`applyPoseToMappedSkeleton()` pairing above; `BeingController
._spawnRuntime()` simply picks which one applies based on `definition.
bodySource`. See "Body Construction" above for the full account.

## Being Library

"Create, Save, Edit, Duplicate, Rename, Delete, Export, Import."
`BeingLibrary.js` — all eight are real. Export produces a plain, portable
JSON file (excluding id and timestamps, which are always freshly minted
on import, exactly like duplicating) that can be shared between Workshops
or kept as a personal collection. Import normalizes every enum field
through `BeingBehaviours.js`'s own `normalize*()` functions rather than
trusting the file blindly — an export written by some future version of
the Workshop with a behaviour id this version doesn't recognise falls
back to a safe default instead of carrying an unrecognised value into
`BeingController.js`'s own switch statements. `modelId` is deliberately
never carried over on import — the model it references lives in *this*
Workshop's own `ModelLibrary`, which an imported file has no access to at
all; the imported Being simply starts with `ModelLoader`'s own honest
placeholder shape until a real model is chosen for it here.

**Version 3, Phase 10 ("Real Assets, Honestly Introduced") — three
starter Beings, seeded by default.** See `DefaultBeings.js`: Person (a
fully-rigged primitive body, every one of the 14 Workshop joints tagged,
its right side built by handing the hand-placed left side to
`BodyCompiler.mirrorSubtree()` — the same tool the Being Creator's own
"Mirror" button uses — rather than hand-duplicating it), and Cat/Dog
(primitive bodies with every `jointName` left `null` — see that file's
own comment for why a quadruped can't honestly use the biped-only
`WORKSHOP_JOINTS` vocabulary). Seeded in the constructor and reseeded on
a genuinely empty `load()`, the same rule `BlueprintStore.js` already
established for Blueprints — unlike `OutfitStore.js`'s own default
outfits, there's no Settings Danger Zone promise anywhere that
"deleting every Being" is permanent, so nothing here needs the
exception that store carries.

## Being Spawner & Manager (the Phone)

**Corrected from an earlier version of this document**, which described
`BeingSpawnerApp.js`/`BeingManagerApp.js` as computer apps — both were
removed and consolidated into `BeingsPhoneApp.js` on the Phone: "the
Computer should remain responsible for creating Beings, editing Being
Definitions. The Phone should become responsible for managing placed
Beings." One app, two sections, reusing the exact same stores the
removed computer apps already used.

"This should behave similarly to the Builder placement workflow." The
Phone-side half (`BeingsPhoneApp.js`'s own "Spawn a Being" section) is
deliberately thin — it never touches a `THREE.Object3D` or the scene,
only ever calling `beingSpawnerSystem.beginPlacement(id)` and closing the
Phone. The world-side half (`BeingSpawnerSystem.js`) is the actual
ghost-preview workflow: a translucent capsule ghost follows the cursor
via a raycast against the floor specifically (not `BuildModeSystem`'s own
full multi-surface gathering — a living creature stands on the ground,
not on top of furniture the way a Builder object might), R rotates it, a
left click confirms and creates a `BeingInstanceStore` entry, Escape
cancels. Confirming creates the record and nothing more —
`BeingController.js`'s own `instances:changed` listener is what actually
spawns the live, moving Being a moment later.

**Version 3, Phase 7 — two real bugs found by direct reproduction, not
just from a bug report.** "See a ghost preview, move the preview around
the world" quietly assumed the floor raycast always hits *something* —
it doesn't. A perfectly horizontal (or upward) look ray, entirely
ordinary the instant placement begins, can never intersect a floor plane
below eye level, so the raycast genuinely returns nothing until the
player happens to tilt the camera down far enough — and the ghost used
to fall back to the literal world origin the first time this happened,
then simply *stop updating at all* on every later frame it kept failing.
Confirming a placement there creates a perfectly real, correctly-recorded
`BeingInstanceStore` entry at that same wrong position — "the app
recognises it's been placed, but we never see it," exactly. Fixed by
reusing `BuildModeSystem`'s own already-proven answer to this,
`defaultGhostPoint()` (`GhostPreview.js` — straight ahead of the camera
at a comfortable distance), with its own Y forced back to floor level
since a Being, unlike a Builder object, can only ever stand on the floor.
Applied on *every* pointer move here, not just on entry — unlike
`BuildModeSystem`'s own broad multi-surface raycast, which rarely fails
in practice, this system's single floor-only raycast fails any time the
player simply isn't looking down, which is often enough that "freeze
until you look at the floor again" (`BuildModeSystem`'s own acceptable
behaviour, given how rarely it applies there) would have stayed a real
problem here.

**A second, independent bug, found while reproducing the first**: a
primitive body part missing (or malforming) its own `rotation` threw a
hard `TypeError` straight out of `BodyCompiler.compileBody()` — and since
that loop builds every mesh before parenting any of them, the failure
left a Being's own root group with *zero* children. Worse, `BeingController
._spawnRuntime()` had already registered the runtime *before* calling
`compileBody()`, so `_reconcile()` never retried it — a real,
already-placed instance, permanently invisible, with no error surfaced
anywhere a player would see it. Every part authored through the Being
Creator's own UI always has a well-formed `rotation` (`makeDefaultBodyPart()`'s
own default), so this wasn't reachable through ordinary use — but
`BeingLibrary.importDefinition()` never validated `bodyParts` at all,
unlike every other field it imports, which normalizes defensively rather
than trusting the file. `compileBody()` now defends the same way:
`position`/`rotation`/`scale` each fall back to a sensible default
(matching `makeDefaultBodyPart()`'s own) rather than crashing the whole
compile over one malformed part.

`BeingManagerApp.js`'s own account survives unchanged, just under its
new home: `BeingsPhoneApp.js`'s "Placed Beings" section lists every
placed instance, cross-referenced against its own definition for a name
and type, with Select (click to view its own row), Locate (shown inline
as live distance-from-player and coordinates, rather than a separate
action — always visible, not something to request), Rename (a
per-instance name override, `BeingInstanceStore`'s own `name` field — so
two placed copies of the same "Dog" definition can be told apart as
"Rex" and "Buddy"), Replace Template (`BeingController.replaceTemplate()`,
swapping which definition an already-placed instance renders as without
losing its own position/state), Move ("Move to me" — the practical
interpretation of a "move" action from the Phone, since there's no
direct 3D drag-and-drop from inside it), Remove (deletes the instance
for good), and Despawn/Respawn (`despawned`, a flag `BeingInstanceStore`
keeps rather than deleting — temporarily removing a Being from the
active world without forgetting it ever existed).

## Persistence

"Every placed Being should remember: Position, Rotation, Assigned Being
Definition, Home Position, Home Radius, Current Animation, Current
State." All seven are real fields on `BeingInstanceStore`'s own record,
ordinary JSON through `PersistenceSystem`. Position/rotation sync back
from each Being's own live runtime state only periodically (every ~2
seconds, staggered per-instance so many placed Beings don't all write
back on the same frame) rather than every single frame — meaningfully
different from `ResidentState.js`'s own equivalent only in that a
resident is one object worth syncing constantly, where dozens of Beings
syncing 60 times a second each would be wasteful for a value that only
needs to be roughly current at save time.

## Known simplifications (by design, for this phase)

- **Interaction is a toast message, not a conversation** — Beings aren't
  connected to Ollama the way the Workshop's own resident is.
- **No true pathfinding** — obstacle avoidance is a steering nudge, per
  the brief's own explicit instruction not to overcomplicate this yet.
- **One room's worth of colliders** — `BeingController._colliders()`
  reads `RoomLayoutSystem`/`FurnitureSystem` directly, which today means
  exactly the one Workshop room; "Outdoor Expansion"/"Multiple Interiors"
  will need this to become room-aware the same way
  `WorldObjectsStore.js`'s own `roomId` field already anticipates for
  Builder objects.
- **No selecting a body part directly from the 3D preview** — only from
  the hierarchy list; a click-to-select raycast into `PreviewRenderer.js`'s
  own scene is real, reasonable future work (see `docs/BROWSER.md`'s own
  precedent of the identical trade-off for the Animation Editor's own
  preview).
- **No collapsing/expanding hierarchy branches, no true drag-and-drop
  re-parenting** — a "Parent" dropdown covers re-parenting today; both
  are reasonable at the scale a single Being's own body actually reaches
  (rarely more than a few dozen parts), which is why neither felt worth
  the added complexity this phase.
- **No editing an imported model's own hierarchy** — adding, removing, or
  replacing parts on an imported `.glb`/`.gltf` stays a primitive-body-only
  capability this phase; see "Imported Models" above for the full
  reasoning.
- **Body parts have no material beyond a flat colour** — no roughness/
  metalness/texture per part, unlike `ObjectLibraryStore.js`'s own
  parts, which stay flat-colour-only for the identical "keep the field
  set uniform across every primitive type" reasoning `ObjectCompiler.js`'s
  own comment already gives.
- **No joint vocabulary for anything but a biped** —
  `WorkshopSkeleton.WORKSHOP_JOINTS` names head/torso and six left/right
  limb pairs; a quadruped's own legs and tail have nowhere honest to map
  to, so a primitive Cat or Dog (see `DefaultBeings.js`, Version 3, Phase
  10) is real, hand-posed geometry with every `jointName` left `null` —
  static art, not something any animation clip can ever drive. A future
  non-biped joint set (or a "static art, no rig at all" mode that stops
  implying every Being ought to have one) is real future work, not
  attempted here.

## Future extension points

- **Manual skeleton-map correction for imported models** — see
  `docs/ANIMATION.md`'s own "Future extension points" for the identical
  need on the Animation Editor side.
- **Click-to-select in the 3D preview**, and true drag-and-drop
  re-parenting in the hierarchy list.
- **Hybrid bodies** — primitive parts attached onto an imported model's
  own hierarchy, or replacing one of its parts; see "Imported Models"
  above for why this phase kept the two paths separate.
- **Per-part materials** beyond a flat colour.

- **Future AI Residents as a Being type.** "Future AI Residents should
  naturally become another type of Being rather than requiring a separate
  architecture." Today's resident (`docs/RESIDENT.md`) and this Being
  system are still two separate things — the resident predates it and
  isn't itself a `BeingLibrary` definition yet. The natural convergence:
  a Being's own Interaction behaviour could grow a real "AI Resident"
  option that reads from `ResidentProfileStore`/`AIConnectionManager`
  exactly the way the existing resident already does, rather than the
  resident staying its own permanently separate system.
- **Wildlife, Villages, player-created companions, Plugin Beings** — all
  explicitly anticipated; none require new architecture, only new
  `BeingBehaviours.js` values or new saved definitions using what already
  exists.
- **Additional model formats** (`.obj`, `.fbx`) — isolated entirely to
  `ModelLoader.js`'s own parsing.
- **Multiple rooms/outdoor spaces** — `BeingInstanceStore` gaining a
  `roomId` field, matching `WorldObjectsStore.js`'s own precedent exactly.
- **Real pathfinding** — a natural drop-in replacement for
  `BeingMovementSystem.js`'s own steering functions, without touching
  `BeingController.js`'s own per-frame orchestration.
