# The world creation system

This is the workshop's first *generic* system — everything before this
phase (the computer, the workbench) was one specific, hand-built object.
This phase is the opposite: an architecture for objects that don't exist
yet, designed by the person using the workshop rather than by whoever wrote
this codebase.

Two halves, matching the brief's own structure:

- **The Builder** — a computer app (`src/computer/apps/builder/`) where
  objects are designed: primitives assembled into parts, metadata, and
  data-driven behaviour.
- **Build Mode** — a room-wide mode (`src/worldbuilder/BuildModeSystem.js`)
  where designed objects get physically placed, moved, and edited directly
  in the visible 3D room, through the **Builder Phone** — see "Why Build
  Mode looks like this" below for the full account of that redesign.

Both operate on the same shared data, owned by neither: a
`WorkshopObjectDefinition` (the design) and a placed *instance* of one
(the physical copy in the room). Everything in this document follows from
keeping those two halves connected only through that shared data — never
through direct references to each other's internals.

## Files

```
src/worldbuilder/
  ObjectLibraryStore.js       persisted WorkshopObjectDefinitions (the "design" data)
  WorldObjectsStore.js         persisted placed instances (the "where" data), room-scoped
  PartTypes.js                  the curated primitive shape registry — see "Preset shapes" below
  ObjectCompiler.js            parts[] -> real THREE.Group — the one place this happens
  WorldObjectsSystem.js        spawns/updates/removes instances as real, always-present
                                entities, and caches each one's collision footprint
  BuildModeSystem.js           freezes the camera, frees the cursor, owns the one
                                ghost-preview mechanic shared by placing, and by moving
                                either a Builder object or a piece of furniture
  BuilderPhoneUI.js             the Builder Phone — see "The Builder Phone" below
  GhostPreview.js               the transparent-preview mechanic, shared identically by
                                new placement and by moving something that already exists
  ConstructionLibrary.js        the permanent Construction Library pieces — see below
  behaviours/
    registry.js                 type -> { propsSchema, apply(), dispose() }
    index.js                    imports every built-in behaviour for its registration side effect
    InteractableBehaviour.js, LightSourceBehaviour.js, SeatBehaviour.js,
    StorageBehaviour.js, DoorBehaviour.js, ComputerBehaviour.js,
    DecorationBehaviour.js, TriggerBehaviour.js, AudioSourceBehaviour.js,
    MusicPlayerBehaviour.js, ReflectiveBehaviour.js
src/computer/apps/builder/
  BuilderApp.js                 the computer app: metadata form, parts editor, behaviour form, library list
  PreviewRenderer.js             an isolated mini Three.js scene for live preview
```

## The data model

```js
// A WorkshopObjectDefinition — the design, stored in ObjectLibraryStore
{
  id, name, description, category, tags: [],
  defaultScale, defaultRotationY,
  parts: [
    { id, type: "box"|"cylinder"|"sphere"|"cone"|"plane",
      position: [x,y,z], rotationY, scale: [x,y,z], color, segments? },
  ],
  behaviours: [ { type, properties: {...} } ],
  version, createdAt, updatedAt,
}

// A placed instance — stored in WorldObjectsStore
{ id, definitionId, roomId, position: [x,y,z], rotationY, scale, colorOverride }
```

Every part is a *unit-sized* primitive (a 1x1x1 box, a sphere of radius
0.5, a plane of size 1x1) sized entirely by its own `scale` — this is why
the Builder only ever needs one set of editable fields
(position/rotation/scale/colour/segments) no matter which primitive type
is selected, rather than a different shape-specific size field per type.
`ObjectCompiler.compileDefinition()` is the only code that turns this data
into a real `THREE.Group`, and both the Builder's live preview and
`WorldObjectsSystem`'s real placed instances call it — what you see while
designing is exactly what appears in the world.

## Builder workspace

The computer's Builder app (where objects are *designed* — distinct from
the Builder Phone, which is where already-designed objects get *placed*;
see "The Builder Phone" below) is a simple, even split: a large live
preview on the left, every editing control on the right, always both
visible at once. This is `.builder-workspace`/`.builder-workspace-preview`/
`.builder-workspace-form` in `css/builder.css` — deliberately its own
layout, not the `.builder-root`/`.builder-preview`/`.builder-form` triplet
the Wardrobe app also uses for its own live preview, specifically so
widening the Builder's half of the screen could never narrow the
Wardrobe's as a side effect.

**Every change updates the live preview immediately** — this didn't need
to change, since `refreshPreview()` was already called after every edit;
what changed is what it's now large and central enough to actually judge
proportions by, rather than a narrow strip beside a much wider form.

**Orbit (drag) and zoom (scroll wheel)** are both supported now —
`PreviewRenderer.js` gained bounded scroll-to-zoom (a purely additive
change; the Wardrobe's own preview gets it for free too, from the exact
same file).

**Selecting a part now visibly highlights it in the 3D preview itself**,
not just in the parts list — `refreshPreview()` finds the mesh whose
`userData.partId` matches the selected part (the same tagging
`ObjectCompiler` already does for every part) and gives it a cloned,
emissive-boosted material, restoring/disposing that one clone on every
subsequent refresh. Cloned, not mutated in place, for the same reason
Build Mode's own ghost preview clones materials rather than editing them
directly: a part's material is shared/cached by colour (see
`PlaceholderFactory.js`), and directly tinting it would tint every other
object using that same colour too, not just the one part being edited.

### Preset shapes

Thirteen primitive types now, up from the original five — "a sensible
curated set" chosen for what's actually useful to build furniture,
architecture, and everyday objects with, not every shape that was
suggested. `src/worldbuilder/PartTypes.js` is the registry (grouped into
Basic / Angled / Rounded & Partial / Rings & Tubes, purely for the
Builder's own dropdown); `ObjectCompiler.js` is where each one is actually
built.

Every new shape still comes from base Three.js parametric geometry —
no custom hand-authored vertex data, no external geometry library:

- **Pyramid** — a cone with few enough radial segments to read as one,
  rotated so a flat face points forward instead of an edge.
- **Wedge / Ramp** — a right-triangle 2D profile (`THREE.Shape`) extruded
  sideways (`THREE.ExtrudeGeometry`) — this phase's answer to "no
  arbitrary profile-based extrusion" from the previous version of this
  document, now that one was actually needed.
- **Rounded Cube** — the same extrusion technique, with a rounded-rectangle
  profile (`Shape.absarc` for each corner) instead of a triangle.
- **Half Sphere** — `THREE.SphereGeometry`'s own `thetaLength` parameter,
  limited to a quarter of the polar angle range, rather than a separate
  geometry type.
- **Quarter Cylinder** — the equivalent trick on `THREE.CylinderGeometry`'s
  own `thetaLength`.
- **Pipe / Tube** — a genuinely hollow wall cross-section (inner radius to
  outer radius, top to bottom) revolved around Y with `THREE.LatheGeometry`
  — real inner and outer walls and capped rings, not a cylinder that only
  looks tube-like from outside.
- **Ring** / **Arch** — `THREE.TorusGeometry`, full circle and (via its own
  `arc` parameter) a half circle respectively.

A few of the shapes suggested alongside these were deliberately left out,
not overlooked:

- **Capsule** — `THREE.CapsuleGeometry` isn't available in the Three.js
  version this project loads; approximating one well needs a compound
  shape (a cylinder plus two hemisphere caps), which breaks the "one part
  is one mesh" assumption everything else here relies on. A capsule-like
  silhouette is still buildable from a Cylinder plus two Half Spheres —
  three parts instead of one, the same trade-off multi-part construction
  pieces already make.
- **Rounded Cylinder** — a cylinder is already a fully round shape; there's
  no further edge to round without it becoming a different shape (a Pipe,
  or a Rounded Cube) entirely.
- **Corner Piece** / **Bevel Piece** — geometrically identical to Quarter
  Cylinder and Wedge, just used at a smaller scale as trim. Separate types
  for the same shape would be more choices without more capability —
  exactly what "a sensible curated set" was asking to avoid.

Every field a shape needs beyond position/rotation/scale/colour (a rounded
cube's corner radius, a tube's wall thickness, a ring's tube thickness) is
a fixed proportion baked into the geometry function itself, rather than
its own editable field — keeping the part editor's field set identical for
every shape was judged more valuable than exposing one more number for
three shapes out of thirteen.

## Behaviours: properties, not programming

A behaviour is registered once (`behaviours/registry.js`) as data plus two
functions: `propsSchema` (what fields the Builder should render — label,
input type, default) and `apply(ctx)` (what happens when a *placed
instance* with this behaviour spawns) — plus, since this pass, an optional
`dispose(ctx)` for the rare behaviour that holds a real resource beyond
the scene graph (see `reflective`, below). `BuilderApp` never has bespoke
code for any specific behaviour — it renders whatever `propsSchema` says,
for all eleven built-ins and any future one, identically.

Nearly every behaviour's `apply()` just attaches an ordinary
`InteractableComponent` — the exact same component furniture and the
computer/workbench already use, flowing through the exact same
`InteractionSystem` with no modifications. That's the strongest proof this
system is actually generic: a custom object with a Seat behaviour is
handled by the interaction pipeline no differently than the workbench's
chair.

Because an `Entity` can only hold one `InteractableComponent`, eight of the
eleven behaviours (Interactable, Seat, Storage, Door, Computer, Trigger,
Audio source, Music player) are mutually exclusive with each other —
checking one in the Builder unchecks any other from that group. Light
Source, Decoration, and Reflective Surface don't touch
`InteractableComponent` at all, so they combine freely with anything —
a mirror can also glow, or be a seat, or both.

**Trigger** is the deliberately open-ended one: it emits
`worldObject:trigger` with whatever event name was typed in, and nothing in
this codebase currently listens for any specific name. That's the point —
see docs/PLUGIN_GUIDE.md for how a future system or plugin hooks into it
without this behaviour or the object carrying it needing to change.

**Reflective Surface** attaches to any object with a flat Plane part and
turns it into a real mirror — no properties to configure, since the plane
it applies to is found automatically (the largest one, by area) rather
than asking for a part id nobody would know offhand. It's the Builder-facing
half of a small, generic reflection capability any Workshop object can use;
see docs/PLAYER.md's "Reflections and third person" section for the full
story, including the physical wardrobe mirror that calls the exact same
underlying function directly.

## Why Build Mode looks like this

"I'll just move that chair" rather than "I'll open the editor" — Build
Mode is a Workshop *device* you take out, not a separate application that
takes over the screen. Two decisions run through everything below:

1. **The camera freezes, it doesn't change mode.** Entering Build Mode
   calls the same `CameraSystem.lock()` the computer and workbench already
   use — movement stops exactly where you were standing, looking exactly
   where you were looking. There's no separate "editor camera". The
   trade-off is real: you can only click on what's currently in view. Exit,
   walk somewhere else, and re-enter to edit something off-screen. That's a
   deliberate scope limit, not an oversight — see "Known simplifications"
   below.
2. **Selection and placement are real raycasts** (`THREE.Raycaster`)
   against the actual geometry `WorldObjectsSystem`/`FurnitureSystem`
   already have live in the scene, and the actual floor/ground mesh
   `RoomLayoutSystem`/`WorldEnvironmentSystem` already built. There's no
   parallel "editable representation" of the world to keep in sync with
   the rendered one — they're the same objects.

### Mutual exclusion with the rest of the interaction pipeline

Build Mode and the normal walk-up-and-interact pipeline never run at the
same time. `BuildModeSystem.enter()` refuses if `InteractionSystem.active`
(you're sitting at the computer, say); conversely, entering Build Mode
emits `buildmode:entered`, which `InteractionSystem` listens for to set its
own `_suspended` flag and stop scanning for nearby interactables entirely.
Neither file imports the other's internals beyond that event pair — see
the comment on both classes.

### The Builder Phone

The UI used to be two small HUD-docked strips (a library along the
bottom, a property panel on the side). It's now one object —
`BuilderPhoneUI.js` — that slides up from the lower-right corner when
Build Mode opens and slides back down when it closes, exactly like taking
a device out of your pocket and putting it away again. The room never
stops rendering behind it; nothing dims or pauses. One shell, three
screens swapped in and out of it rather than three separate panels:

- **Library** — tabs (Construction Library / Saved Objects) over a
  scrollable grid, the default screen whenever nothing is armed or
  selected. Tapping a card arms it for placement.
- **Ghost** — shown the moment anything is being placed or moved (see
  "Object placement" below): Rotate, a confirm button, Cancel.
- **Selection** — shown for a confirmed, non-moving selection: precise
  numeric position/rotation (and, for Builder objects specifically,
  scale/colour) fields, a Move button, and Duplicate/Delete (Builder
  objects) or Reset Position (furniture, once it's actually been moved).

This is presentation only — `ObjectLibraryStore`, `WorldObjectsStore`,
`ObjectCompiler`, and the behaviour system underneath are completely
unchanged. The Phone is simply a new, better front end for the exact same
framework; nothing about swapping it in required touching how objects are
designed or how instances are persisted.

## Object placement

Placing something new and moving something that already exists are the
*same mechanic* — "avoid creating two separate editing systems" is
implemented literally, not just in spirit. Both produce one shared piece
of state, `BuildModeSystem._ghost`, and both go through exactly the same
four functions: an entry point that creates the ghost, `_rotateGhost()`,
`_confirmGhost()`, `_cancelGhost()`.

- **A ghost is a transparent preview** — see `GhostPreview.js`. For a
  brand-new placement, that's a freshly compiled, temporary `THREE.Group`
  with cloned, dimmed materials. For moving something that already
  exists, it's literally *that object's own live mesh*, temporarily given
  the same transparent treatment in place — which is what makes "identical
  to new object placement" true rather than approximate: the exact same
  `makeTransparent()` function produces both.
- **The ghost follows the pointer, not a click.** `pointermove` on the
  canvas (covering mouse hover and touch drag identically, since Pointer
  Events unify both) continuously raycasts against the floor, the outdoor
  ground, and every already-placed object or furniture piece — a ghost
  can rest on top of a table exactly as naturally as on the floor — and
  repositions the ghost to whatever it hits. A ghost being moved excludes
  its own object from that raycast, so it never "collides" with itself
  while being dragged.
- **Rotation is a button, not a hotkey** — `_rotateGhost()`, 45° per
  press. Deliberately not a keyboard shortcut: a visible, tappable button
  works identically on desktop and touch and doesn't require knowing a
  hidden key exists.
- **Confirming or cancelling is always an explicit Phone button**, never a
  canvas click. A raw click/tap confirming placement was considered and
  rejected — it's ambiguous on touch (was that a tap to reposition, or to
  confirm?) and risks placing something by accident while just looking
  around. The canvas is purely for *positioning* the ghost; the Phone's
  own buttons are the only way anything actually happens.
- **Cancelling a new placement** disposes the ghost's temporary materials
  and removes it from the scene — carefully never disposing its
  *geometry*, which is `ObjectCompiler`'s shared, cached unit geometry
  (see below), not something this one ghost owns.
- **Confirming a new placement** creates the real `WorldObjectsStore`
  instance at the ghost's final position/rotation and spawns it through
  the normal `WorldObjectsSystem` path — a fresh, fully opaque compile,
  not a reuse of the ghost's own temporary geometry.

## Workshop editing

Furniture is now genuinely movable, through the exact same mechanic
described above — "Workshop furniture should become editable using
exactly the same placement system as Builder-created objects" is true at
the mechanism level, not just the UI level. Clicking an existing piece of
furniture selects it the same way clicking a Builder object does (both go
through `BuildModeSystem._identifyHit()`, which walks up from whatever
mesh was actually hit to find its owning entity and tells furniture and
world objects apart only by an entity tag); pressing "Move" starts a
ghost the same way arming a new definition does.

**Furniture position is genuinely different data underneath**, though,
and that difference matters: a piece of furniture is a Workshop *default*
(it lives in `src/data/layoutDefault.js` and is meant to improve freely as
the Workshop itself is updated — see docs/REFINEMENT.md for the real bug
that happened when this wasn't respected), not something with its own
independent identity the way a placed Builder object has. Moving a piece
of furniture writes to `FurnitureSystem.overrides` — a small, explicit
`{ pieceId: {position, rotationY} }` map, genuinely player-owned data,
persisted separately from (and layered on top of) the layout default. A
piece with no override always uses whatever the Workshop's current
default is; only a piece someone has actually moved diverges from it, and
even that can be undone ("Reset Position", shown only once an override
actually exists).

`BuildModeSystem._ghost.kind` (`"new"` / `"moveWorldObject"` /
`"moveFurniture"`) is the *only* place this distinction is ever visible.
Raycasting, rotating, the transparent material treatment, and the Phone's
own Rotate/Confirm/Cancel buttons are all completely unaware which kind
they're looking at.

## Collision integration

Builder-placed objects — and, by extension, anything built with the
Construction Library — now participate in `CameraSystem`'s
walk-collision exactly the way furniture already does: three flavours of
"boxes the player can't walk through" (wall segments, furniture
footprints, world-object footprints), one collision loop, not three
different systems.

Furniture's footprint is a hand-authored `{width, depth}` per definition,
because there's a small, fixed set of furniture pieces and hand-tuning
each one is cheap. Builder objects have no such thing — anyone can build
anything, so there's no fixed dimension to declare. Instead,
`WorldObjectsSystem` computes each instance's footprint with
`THREE.Box3.setFromObject()` on its actual compiled geometry, cached and
only recomputed when that instance is actually spawned, moved, or
removed — never on every frame. A box that sits entirely above
`COLLISION_HEIGHT_LIMIT` (a decorative ceiling piece, say) is skipped
from collision entirely, the same "a header above head height is real
geometry but never an obstacle" rule `WorkshopRoom.js`'s wall segments
already follow.

This means "future buildings created by the player... become real
architecture rather than decoration" is true today: a wall built from
Construction Library pieces genuinely blocks walking through it, both
inside Build Mode's own placement raycasts (so you can stack things on
top of what you've already built) and during ordinary exploration
afterward.

## Persistence

Two providers, registered exactly like `ProjectsStore`/`NotesStore`:
`objectLibrary` (definitions) and `worldObjects` (placed instances).
`WorldObjectsSystem.spawnAll()` — called once from `main.js`, right after
`await engine.init()`, for the same reason `WorkbenchSystem.finalizeInitialState()`
is — rebuilds every placed instance from whatever was loaded. Build Mode
itself has no session state worth persisting (nothing carries over besides
what's already in those two stores plus `FurnitureSystem`'s own overrides,
below), so its own `persistence:save` entry is intentionally empty.

Furniture overrides persist differently, and deliberately so — see
"Workshop editing" above: they're a small, explicit, event-based
`FurnitureSystem.overrides` map (the same `persistence:save`/
`persistence:load` event pair `CameraSystem`/`RoomLayoutSystem` already
use for their own state), not a provider, and not a blanket save of every
piece's transform the way an earlier, buggy version of this system did
(see docs/REFINEMENT.md).

### Editing a definition updates every placed copy

A placed instance only stores a `definitionId` — it never copies a
definition's parts or behaviours. Editing an object in the Builder and
saving calls `worldObjectsSystem.refreshInstancesOfDefinition(id)`, which
rebuilds every live instance referencing it. This is a deliberate
"library"/prefab-style relationship (edit once, every placed copy
updates) rather than each placement being an independent snapshot — the
brief's "version safely" is satisfied by this being simple and
predictable, not by tracking per-instance schema versions.

## A second source of definitions: the Construction Library

A later pass added `src/worldbuilder/ConstructionLibrary.js` — a small,
permanent set of foundational building pieces, structurally separate from
the `ObjectLibraryStore` this document describes, but built from the
exact same `WorkshopObjectDefinition` shape and rendered by the exact
same `ObjectCompiler`. The Builder Phone's Library screen shows both
sources side by side, as its two tabs — Construction Library and Saved
Objects. See `docs/WORLD.md` for the full reasoning — the short version
is that a construction piece is "a definition from a different source",
not a different kind of thing.

Grown from an original 16 pieces to 30, organised into four groups —
"enough to begin constructing meaningful spaces without relying entirely
on custom objects":

- **Structural** — Wall, Half Wall, Corner Wall, Floor, Ceiling, Roof,
  Roof Corner, Pillar, Beam, Stairs, Ladder, plus the original Cube and
  Plane.
- **Openings** — Doorway, Door, Double Door, Window, Large Window,
  Archway (the first construction piece built from the new Arch
  primitive — see "Preset shapes" above).
- **Workshop** — Table, Bench, Shelf, Cabinet, Storage Crate. Cabinet and
  Storage Crate both carry the Storage behaviour out of the box —
  genuinely usable the moment they're placed, not just decoration.
- **Utilities** — Light (carries Light Source), Switch (carries Trigger,
  ready to be wired to anything a future system listens for — see
  docs/PLUGIN_GUIDE.md), Sign, Fence, Gate (a fence-styled Door).

**Double Door and Gate both make the same honest simplification the
original Door already did**: `DoorBehaviour` swings the *entire* compiled
object by a fixed angle around its own origin — it has no concept of
"which part is the door leaf" or a true edge hinge (see that behaviour's
own comment). A double door built from two side-by-side panels therefore
swings open as one rigid double-wide unit, not two independently-hinged
leaves the way the workshop's own French doors do. Building genuinely
independent leaves would mean either two separate placed objects or a
real "hinge offset" property on the behaviour itself — a reasonable
future enhancement (see "Future extension points" below), not attempted
here for the sake of staying inside the existing behaviour system rather
than special-casing one construction piece.

## Known simplifications (by design, for this phase)

- **The camera fully freezes in Build Mode** — no look-around, no
  movement. See "Why Build Mode looks like this" above.
- **Placed objects can still overlap each other.** Collision now stops
  the *player* from walking through a placed object (see "Collision
  integration" above), but Build Mode itself doesn't stop you from
  placing two objects on top of each other — the ghost can rest on
  another object's surface, but nothing checks for interpenetration.
- **The property panel's colour input rebuilds the instance's geometry on
  every drag event**, not just on release — acceptable for now, a minor
  performance/smoothness rough edge rather than a correctness issue.
- **One room.** `WorldObjectsStore` is room-scoped (`roomId`) from day one
  specifically so a second room is a matter of spawning instances with a
  different id and filtering by it — not a schema change — but there is
  only one room ("workshop") to be scoped to today.

## Future extension points

- **A real hinge-offset property for Door** — would let Double Door (and
  any custom object with two door-shaped parts) swing as genuinely
  independent leaves instead of one rigid double-wide unit — see the
  Construction Library section above for the honest limitation this
  would resolve.
- **A thumbnail per shape/library item**, rendered once and cached,
  rather than a flat colour swatch in the Builder Phone's grid and the
  Builder app's own toolbar — would need its own small offscreen
  render pass per definition, deliberately not attempted here to keep
  this pass's own scope to the workspace and shape set specifically.
- **Multi-select and group operations** — `BuildModeSystem.selection` is
  currently a single `{kind, id}`; a future version could hold an array,
  with `_confirmGhost()`/`_cancelGhost()` applying to every selected
  ghost at once rather than one at a time.
- **Snapping** — to a grid, or to another object's edges — would slot
  into `_raycastGhostSurfaces()` as an additional step after the raycast
  hit point is found, before it's applied to the ghost. Nothing about the
  ghost mechanic itself assumes an unsnapped, freely-continuous position.
- **A true oriented (rather than axis-aligned) collision box** for
  Builder objects — `WorldObjectsSystem`'s footprint is currently an AABB
  from `Box3.setFromObject()`, the same approximation furniture's own
  rotated-rectangle footprint already accepts (see `FurnitureSystem
  ._computeFootprintBox`'s own comment). Fine for "don't walk through
  it"; a tighter box would only matter for something that needs precise
  edge-to-edge collision.
- **Undo/redo** — every mutation already goes through a small, consistent
  set of store methods (`create`/`update`/`remove` on `WorldObjectsStore`,
  `setOverride`/`clearOverride` on `FurnitureSystem`); a command-history
  layer could sit in front of those without BuildModeSystem itself
  changing.
- **The furniture overrides map generalising further** — right now it's
  position/rotation only. Extending it to (say) a colour override for
  furniture, the way Builder objects already have one, would follow the
  exact same "small explicit map, layered on top of the Workshop default"
  shape.
