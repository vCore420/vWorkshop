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
  in the visible 3D room.

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
  ObjectCompiler.js            parts[] -> real THREE.Group — the one place this happens
  WorldObjectsSystem.js        spawns/updates/removes instances as real, always-present entities
  BuildModeSystem.js           freezes the camera, frees the cursor, raycasts for select/place
  BuildModePanels.js           the two small HUD-docked strips Build Mode shows
  behaviours/
    registry.js                 type -> { propsSchema, apply() }
    index.js                    imports every built-in behaviour for its registration side effect
    InteractableBehaviour.js, LightSourceBehaviour.js, SeatBehaviour.js,
    StorageBehaviour.js, DoorBehaviour.js, ComputerBehaviour.js,
    DecorationBehaviour.js, TriggerBehaviour.js, AudioSourceBehaviour.js
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

### "Extrusions where appropriate"

This phase's primitives are box/cylinder/sphere/cone/plane — no arbitrary
profile-based `THREE.ExtrudeGeometry`. A cone is a cylinder with
`radiusTop: 0`; a hexagonal-prism-style "extrusion" is a cylinder with
`segments: 6`. This covers a genuinely useful range of simple shapes
without the authoring complexity of drawing a 2D profile to extrude — a
real future enhancement (see docs/ROADMAP.md), not attempted here.

## Behaviours: properties, not programming

A behaviour is registered once (`behaviours/registry.js`) as data plus two
functions: `propsSchema` (what fields the Builder should render — label,
input type, default) and `apply(ctx)` (what happens when a *placed
instance* with this behaviour spawns). `BuilderApp` never has bespoke code
for any specific behaviour — it renders whatever `propsSchema` says, for
all nine built-ins and any future one, identically.

Nearly every behaviour's `apply()` just attaches an ordinary
`InteractableComponent` — the exact same component furniture and the
computer/workbench already use, flowing through the exact same
`InteractionSystem` with no modifications. That's the strongest proof this
system is actually generic: a custom object with a Seat behaviour is
handled by the interaction pipeline no differently than the workbench's
chair.

Because an `Entity` can only hold one `InteractableComponent`, seven of the
nine behaviours (Interactable, Seat, Storage, Door, Computer, Trigger,
Audio source) are mutually exclusive with each other — checking one in the
Builder unchecks any other from that group. Light Source and Decoration
don't touch `InteractableComponent` at all, so they combine freely with
anything.

**Trigger** is the deliberately open-ended one: it emits
`worldObject:trigger` with whatever event name was typed in, and nothing in
this codebase currently listens for any specific name. That's the point —
see docs/PLUGIN_GUIDE.md for how a future system or plugin hooks into it
without this behaviour or the object carrying it needing to change.

## Why Build Mode looks like this

"I should feel like I am physically rearranging my workshop" ruled out a
separate editor screen. Three concrete decisions followed:

1. **The camera freezes, it doesn't change mode.** Entering Build Mode
   calls the same `CameraSystem.lock()` the computer and workbench already
   use — movement stops exactly where you were standing, looking exactly
   where you were looking. There's no separate "editor camera". The
   trade-off is real: you can only click on what's currently in view. Exit,
   walk somewhere else, and re-enter to edit something off-screen. That's a
   deliberate foundation-phase scope limit, not an oversight — see "Known
   simplifications" below.
2. **Two small HUD-docked strips, not a full-screen editor**
   (`BuildModePanels.js`). A library strip along the bottom, a property
   panel on the side when something's selected. The room is visible around
   and behind both at all times.
3. **Selection and placement are real raycasts** (`THREE.Raycaster`)
   against the actual geometry `WorldObjectsSystem` already spawned into
   the real scene, and the actual floor mesh `RoomLayoutSystem` already
   built. There's no parallel "editable representation" of the world to
   keep in sync with the rendered one — they're the same objects.

### Mutual exclusion with the rest of the interaction pipeline

Build Mode and the normal walk-up-and-interact pipeline never run at the
same time. `BuildModeSystem.enter()` refuses if `InteractionSystem.active`
(you're sitting at the computer, say); conversely, entering Build Mode
emits `buildmode:entered`, which `InteractionSystem` listens for to set its
own `_suspended` flag and stop scanning for nearby interactables entirely.
Neither file imports the other's internals beyond that event pair — see
the comment on both classes.

## Persistence

Two providers, registered exactly like `ProjectsStore`/`NotesStore`:
`objectLibrary` (definitions) and `worldObjects` (placed instances).
`WorldObjectsSystem.spawnAll()` — called once from `main.js`, right after
`await engine.init()`, for the same reason `WorkbenchSystem.finalizeInitialState()`
is — rebuilds every placed instance from whatever was loaded. Build Mode
itself has no session state worth persisting (nothing carries over besides
what's already in those two stores), so its own `persistence:save` entry is
intentionally empty.

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
permanent set of foundational building pieces (walls, floors, a roof, a
functional door, ...), structurally separate from the `ObjectLibraryStore`
this document describes, but built from the exact same
`WorkshopObjectDefinition` shape and rendered by the exact same
`ObjectCompiler`. Build Mode's library strip shows both sources side by
side. See `docs/WORLD.md` for the full reasoning — the short version is
that a construction piece is "a definition from a different source", not
a different kind of thing.

## Known simplifications (by design, for this phase)

- **The camera fully freezes in Build Mode** — no look-around, no
  movement. See "Why Build Mode looks like this" above.
- **No collision checking between placed objects** — Build Mode places
  objects anywhere via raycast; they can overlap.
- **No true extrusion primitive** — see "Extrusions where appropriate"
  above.
- **The property panel's colour input rebuilds the instance's geometry on
  every drag event**, not just on release — acceptable for now, a minor
  performance/smoothness rough edge rather than a correctness issue.
- **One room.** `WorldObjectsStore` is room-scoped (`roomId`) from day one
  specifically so a second room is a matter of spawning instances with a
  different id and filtering by it — not a schema change — but there is
  only one room ("workshop") to be scoped to today.
- **Custom objects don't participate in walk-collision.** Placed objects
  are visually and interactively real, but `CameraSystem`'s walk-collision
  only checks hand-built furniture footprints (see `FurnitureSystem`) — you
  can currently walk through a custom placed object outside Build Mode.
  A future pass could compute a footprint from a definition's parts the
  same way furniture already does.
