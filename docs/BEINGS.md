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

## Architecture: nine small, separated files

`src/beings/`, following the exact "separate responsibilities" instinct
`src/ai/`, `src/resident/`, and `src/host/` already established:

- **`ModelAssetStore.js`** — raw `.glb`/`.gltf` file bytes in IndexedDB,
  mirroring `ImageAssetStore.js`'s own "real binary data doesn't belong in
  `localStorage`" split.
- **`ModelLibrary.js`** — the metadata index (name, format) for imported
  models, ordinary JSON through `PersistenceSystem`.
- **`ModelLoader.js`** — turns a model id into an actual, usable, cached
  `THREE.Object3D` via `GLTFLoader`. The only file that knows what a
  `GLTFLoader` is.
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
or any store at all.

## Being Creator

`BeingCreatorApp.js` — "the Workshop's creature creation workspace...
clean, comfortable, simple, persistent." Reuses `PreviewRenderer.js`
completely unchanged (it was already written generically enough that "a
small, self-contained Three.js scene previewing whatever object3D you
hand it" needed nothing Being-specific added), and the same
`.builder-workspace`/`.builder-workspace-preview`/`.builder-workspace-form`
layout classes `BuilderApp.js` already established — orbit (drag) and
zoom (scroll) both come for free.

**Editing is draft-then-save**, exactly like Builder — nothing reaches
`BeingLibrary` until "Save to Library" is pressed, so trying a walk speed
or a different model costs nothing. "Creating a Being should not
automatically place it into the world" is true by construction: this file
never imports or calls anything on `BeingInstanceStore` at all.

Every property the brief lists — Name, Description, Being Type, Tags,
Model, Scale, Movement Style, Idle Behaviour, Walk Speed, Turn Speed, Home
Radius, Interaction Behaviour, plus Awareness — is a real, editable field.
Movement/turn speed fields only appear once a Movement Style other than
Static is chosen, since they're meaningless for something that never
moves.

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

## Being Spawner

"This should behave similarly to the Builder placement workflow." The
computer-side half (`BeingSpawnerApp.js`) is deliberately thin — it never
touches a `THREE.Object3D` or the scene, only ever calling
`beingSpawnerSystem.beginPlacement(id)` and getting out of the way. The
world-side half (`BeingSpawnerSystem.js`) is the actual ghost-preview
workflow: a translucent capsule ghost follows the cursor via a raycast
against the floor specifically (not `BuildModeSystem`'s own full
multi-surface gathering — a living creature stands on the ground, not on
top of furniture the way a Builder object might), R rotates it, a left
click confirms and creates a `BeingInstanceStore` entry, Escape cancels.
Confirming creates the record and nothing more — `BeingController.js`'s
own `instances:changed` listener is what actually spawns the live, moving
Being a moment later.

## Being Manager

"Think of this as the Workshop's population manager." `BeingManagerApp.js`
lists every placed instance, cross-referenced against its own definition
for a name and type, with Select (click to view its own row),
Locate (shown inline as live distance-from-player and coordinates, rather
than a separate action — always visible, not something to request),
Rename (a per-instance name override, `BeingInstanceStore`'s own `name`
field — so two placed copies of the same "Dog" definition can be told
apart as "Rex" and "Buddy"), Replace Template (`BeingController.
replaceTemplate()`, swapping which definition an already-placed instance
renders as without losing its own position/state), Move ("Move to me" —
the practical interpretation of a desktop-screen "move" action, since
there's no direct 3D drag-and-drop from inside the computer), Remove
(deletes the instance for good), and Despawn/Respawn (`despawned`, a flag
BeingInstanceStore keeps rather than deleting — temporarily removing a
Being from the active world without forgetting it ever existed).

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

- **Cloned skinned/animated models share a skeleton** — see "Model
  Library and Model Import" above.
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

## Future extension points

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
