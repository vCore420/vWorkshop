# The world

This phase took the workshop from "one sealed room" to "the first building
in a continuous, walkable world." It's really three connected pieces: a
bug fix that turned out to be architectural, a real exterior + outdoor
world, and a small permanent set of construction pieces that let that world
grow from inside itself.

## The doorway bug, and what it actually was

Reported as "a large dark grey object blocks the double doors from inside
the workshop." The real cause: `WorkshopRoom.js`'s north and south walls
were each built as a *single solid box spanning the entire wall* — the
door and window meshes were only ever decorative overlays layered in front
of it. There was never an actual opening. Once there was a real exterior to
walk into, that stopped being a cosmetic simplification and became a wall
directly blocking the doorway.

The fix (`buildWallWithOpenings` in `WorkshopRoom.js`) builds a wall as a
strip of box segments with a genuine gap left wherever a door or window
should be — a door reaches the floor (no sill); a window gets both a sill
below and a header above. It works for zero, one, or two openings in the
same wall by slicing left-to-right generically, with no per-wall special
casing.

## Real walls have two jobs now: visual and collision

Every wall segment carries **two materials** (`multiFaceBox` in
`PlaceholderFactory.js`) — one for the face pointing into the room, one for
the face pointing outward — because the same wall now has to look correct
from both sides. And every wall segment's local bounds
(`{u0,u1,v0,v1}`) become a **collision box** for `CameraSystem`, with one
rule: any segment whose bottom edge is at or above `COLLISION_HEIGHT_LIMIT`
(2.2m, matching `FurnitureSystem`'s own footprint-height convention) is
excluded. That's what makes a door's header or a window's header
non-solid — they're real geometry, but they're above head height, and the
2D, Y-agnostic collision system this engine already used for furniture
would otherwise treat them as floor-to-ceiling obstacles. The exact same
rule applies uniformly to every segment, not just doors/windows — it's
what makes a solid wall solid and an opening genuinely open, derived from
one piece of logic instead of two.

`CameraSystem` no longer clamps movement to a hard rectangle at all — see
`RoomLayoutSystem.getWallColliders()` and `CameraSystem._pushOutOfBox()`
(shared with furniture footprint collision, now just a bigger list of
boxes). That hard rectangle was the second thing that would have made
"walk outside" impossible even after the wall was fixed.

### Existing furniture didn't move

The wall's thickness grew (0.12m to 0.3m, for a believable exterior shell),
but every wall now **grows outward only** — its interior-facing surface
stays at exactly the position the thin phase-1/2/3 wall's did. Furniture
like the pinboard and tool storage was originally placed close against
that face; centring the thicker wall on the same line instead would have
pushed the new interior face into them. See the `WALL_GROWTH` comment in
`WorkshopRoom.js` for the exact offset math.

## A seamless world, not a second scene

"I do not want to teleport, transition, load, fade, or otherwise move
between separate scenes" — mechanically, that means there is no second
scene. `WorldEnvironmentSystem` (new) adds exactly two things to the same
`THREE.Scene` the workshop already lives in:

1. **An effectively-infinite ground plane.** One large flat, textured
   plane that silently re-centres on the camera (snapped to a grid, so the
   texture never visibly "swims") whenever the camera gets close to its
   edge — infinite-*feeling* without needing to actually be infinite. It
   sits a few centimetres below the interior floor's exact surface height,
   purely to avoid z-fighting where the floor slab meets it.
2. **Sky and fog**, driven by the exact same `timeofday:changed` event
   `LightingSystem` already listens to. Before this phase, `TimeOfDaySystem`
   tinted the window panes directly to fake a sky that wasn't really there;
   that's gone now — the windows are real transparent glass
   (`Materials.glass`), and what you see through them is the same
   `scene.background`/fog you'd see standing outside, updated in one place.
   Time of day, weather's light-dampening, and the sun/moon direction all
   already applied scene-wide; they needed no changes at all to work
   outdoors — they always did.

Walking through the open door, looking back at the building, and walking
back in all just work as a consequence of the above — there's no trigger
volume, no "you have left the workshop" event, because nothing about
crossing that threshold is special beyond geometry.

## A simple exterior shell, aligned to the interior

The workshop's exterior — thicker two-sided walls, a flat roof with a
slight overhang and a fascia trim — reuses the same wall-segment geometry
that produces the interior, so the openings are guaranteed to line up
(there's only one doorway, one pair of windows, described once). The roof
is deliberately flat rather than pitched — lower risk of misalignment than
angled panels, and entirely believable for a utilitarian workshop
building — sized from the walls' actual outer faces, not their centreline
(a distinction that mattered enough to be worth getting exactly right; see
the `roofWidth`/`fasciaEdgeX` comments in `WorkshopRoom.js`).

Exterior collision is not a separate system — it's the same
`wallColliders` list mentioned above, since a wall's box spans its full
real thickness from interior to exterior face.

## The Construction Library: "the alphabet"

`src/worldbuilder/ConstructionLibrary.js` adds a second, permanent source
of placeable definitions alongside the person's own `ObjectLibraryStore` —
16 plain foundational pieces (Cube, Plane, Wall, Corner Wall, Floor,
Ceiling, Roof, Roof Corner, Pillar, Doorway, Door, Window, Stairs, Ramp,
Fence, Beam), matching the brief's own list exactly.

The important architectural point: **a construction piece is not a
different kind of thing** — it's a `WorkshopObjectDefinition`, the exact
same shape a Builder-designed object has, just hand-authored in code
instead of designed at runtime, and not editable or deletable.
`ObjectCompiler` doesn't know or care which store a definition came from.
The only real distinction is `WorldObjectsStore`'s new `definitionSource`
field (`"library"` or `"construction"`), which `WorldObjectsSystem` uses to
resolve a placed instance's `definitionId` against the right store — and
construction pieces use **string ids** (`"wall"`, `"door"`, ...)
specifically so they can never collide with `ObjectLibraryStore`'s
auto-incrementing numeric ids even if something forgets to check the
source.

Build Mode's library strip shows both sources side by side, in two labelled
rows — "Construction" and "Your objects" — never merged into one list,
per the brief's explicit instruction to keep them separate.

### The Door piece is genuinely functional

It carries the same `door` behaviour (see docs/WORLDBUILDER.md) any
custom object can — placing one and interacting with it swings it open,
with zero new code. That's the same reuse principle the whole behaviour
system was built on in the previous phase, now proven against
hand-authored data instead of only Builder-designed data.

### One small, deliberate schema extension: tilt

Roof panels needed to tilt. The Builder's own form only ever exposes
Y-axis rotation for a part (full 3-axis rotation editing wasn't worth the
form complexity for hand-authored objects) — so `ObjectCompiler.js` now
also reads `rotationX`/`rotationZ` if a part has them, purely as a data
escape hatch the Construction Library's Roof/Roof Corner/Ramp pieces use.
Nothing about the Builder's UI changed; a person designing their own
object still only ever sees a Y-rotation slider.

## Build Mode, indoors and outdoors alike

`BuildModeSystem`'s placement raycast targets the interior floor **and**
the outdoor ground plane (`WorldEnvironmentSystem.getGroundMesh()`) in the
same call — there's no branch anywhere that asks "am I inside or outside".
Nothing in Build Mode assumes a single room; `WorldObjectsStore` was
already room-scoped (`roomId`) from the previous phase specifically so a
second building later is a matter of a different id, not a schema change.

## Interaction distance

Every existing interactable — furniture, the door, the light switch, both
windows — was individually retuned, not set to one blanket value:
small objects (notebook, pinboard, the light switch, each window) to
~2.0m; medium furniture (tool storage, the sitting area) to ~2.2m; large
furniture (the workbench, the computer desk, shelving, and — after its
later redesign into a proper listening setup, see docs/MUSIC.md and
docs/ARCHITECTURE.md — the music cabinet) and the workshop door to ~2.4m.
Every value was re-verified against each piece's own collision footprint
to confirm it's still reachable from at least one approach angle (the
same check performed when these pieces were first placed — see
`docs/ARCHITECTURE.md`'s furniture section).

(The door, both windows, and the notebook were tightened further still in
a later refinement pass — see docs/REFINEMENT.md — since none of them
need triggering from as far away as a piece of furniture does; this
section's values are what this phase itself introduced, not necessarily
what's still current everywhere.)

## Known simplifications (by design, for this phase)

- **Interaction checks are proximity-only** — there's no line-of-sight or
  occlusion test. With interaction radii now up to 2.4m and real exterior
  walls existing, it's technically possible to stand just outside a wall
  and be within range of something on the other side of it. This isn't new
  (it existed at smaller radii too) but is more noticeable now. Occlusion
  checking is a reasonable, well-scoped future addition, not attempted
  here.
- **The roof has no gable/hip end caps** — it's a single flat slab, not a
  pitched shape, specifically to avoid that problem entirely.
- **The Construction Library's Corner Wall, Roof Corner, Doorway, and
  Window pieces are simplified approximations** (a two-box L-shape, a
  smaller rotated slab, a fixed opening size) rather than parametric or
  mitred joinery.
- **One ground plane, one sky.** Multiple buildings later would still
  share this exact system — nothing here assumes a single building, only
  a single *world* (which remains true).
