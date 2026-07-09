# Player identity

"Think of this as building a wardrobe rather than a character editor... a
system that allows somebody to gradually become whoever they want to be
inside The Workshop." This document covers the architecture behind that:
the character rig, the Wardrobe app, and how appearance persists.

## Overall architecture

```
src/player/
  PlayerCharacter.js         pure functions: appearance data -> a real THREE rig
  PlayerAppearanceStore.js    the live, currently-worn appearance (persisted)
  OutfitStore.js              named, saved appearance snapshots (persisted)
  TextureStore.js             IndexedDB: painted/imported texture images
  PlayerCharacterSystem.js    the Engine system: owns the one live rig in the world
src/computer/apps/
  WardrobeApp.js               the computer app: editing UI + embedded live preview
```

One rig builder, two stores for "what am I wearing" (live vs. saved,
exactly the relationship `ProjectsStore`'s current project has to the
workbench), one IndexedDB exception for real image data (exactly the
relationship `HandleStore`/`TextureStore` both have to their respective
JSON-based stores), one system putting a live copy of it in the world, one
app for editing it. Every piece here mirrors a pattern already established
elsewhere in the workshop — see docs/ARCHITECTURE.md.

## The rig

"Simple geometry is preferred because it allows complete customisation...
think along the lines of Minecraft." Every body section — Head, Torso,
Upper Arm, Lower Arm, Hand, Upper Leg, Lower Leg, Foot — is a unit-sized
box, scaled per-part by that part's own width/height/depth multipliers.
Left and right limbs share one appearance entry each (an "Upper Arm"
setting affects both arms identically) — the brief's own list of editable
sections doesn't distinguish sides, and a symmetric default is both simpler
and matches how nearly every character customization system already works.

**It's a genuine parent-child joint hierarchy**, not eight independently-
positioned meshes: a shoulder pivot holds the upper arm, which holds an
elbow pivot, which holds the lower arm, which holds a wrist pivot, which
holds the hand (and the equivalent hip → knee → ankle chain for legs).
Nothing in this pass animates anything — but "prepare that future" and
"without requiring architectural redesign" meant building the rig as
something a future animation system can rotate pivots on, not as a rig
rewrite waiting to happen. See `PlayerCharacter.js`'s own comment for the
exact hierarchy.

**Proportions changing means a full rebuild**, not a patched update — a
longer upper arm moves where the elbow needs to sit, which moves where the
lower arm's own children sit, and so on down the chain. A partial update
would need the same joint-position recalculation a full rebuild already
does, for an operation that only ever happens while someone is actively
dragging a slider in the Wardrobe — never per frame. Rebuilds are
debounced (120ms) and guarded against overlapping (resolving a part's
texture from `TextureStore` is async, so a rapid sequence of edits could
otherwise start a second rebuild before the first finishes).

## Appearance, materials, textures

A part's appearance is `{ width, height, depth, color, material,
textureId }`. `material` selects a small, fixed set of presets (Matte,
Fabric, Metal, Glossy, Glass) — plain roughness/metalness pairs, not the
`PlaceholderFactory` material cache furniture uses, since a player part's
material is very often paired with its own unique texture, which breaks
the "many objects share one cached material" assumption that cache is
built around.

**Painting and importing both end up as the same thing**: a small (64×64)
canvas, saved as a PNG data URL in `TextureStore`, referenced by id from
the part's `textureId`. Importing an image draws it onto that same canvas
first (so an imported texture is then also paintable, not a separate,
locked-in asset) — painting and importing were never really two different
features, just two different starting points for the same canvas.

## Persistence

| What | Where |
|---|---|
| The live, currently-worn appearance | `PlayerAppearanceStore` (normal JSON provider) |
| Saved outfits | `OutfitStore` (normal JSON provider) |
| Actual texture image data | `TextureStore` (IndexedDB — see below) |

Texture images are real binary-ish data (base64 PNGs), exactly the kind of
thing that doesn't belong crammed into a JSON blob bound for
`localStorage`'s 5–10MB quota — the identical reasoning that put file
system handles in their own `HandleStore` rather than the main save
envelope (see docs/MUSIC.md). `PlayerAppearanceStore`/`OutfitStore` only
ever store a part's `textureId` (a string reference); resolving that to an
actual image happens on demand, asynchronously, whenever a rig is built.

**A texture is only deleted when nothing references it anymore.** Removing
a texture from a part, or deleting an outfit that used one, checks both
the live appearance and every saved outfit before actually dropping it
from `TextureStore` — a texture shared between an outfit and what you're
currently wearing (or between two outfits, after duplicating one) survives
either one being changed independently.

## The Wardrobe app, and a camera approach that didn't work

The Wardrobe is a tab on the computer, alongside Projects/Journal/Media/
Builder/Settings — not a separate object, and "does not need to be
connected to physical furniture yet" per the brief. Editing is immediate:
every slider, colour, and material choice writes straight to
`PlayerAppearanceStore` and the live preview updates from that same write,
the same "there is no separate draft state" philosophy the rest of the
workshop already uses for in-place editing.

**The live preview is a small, isolated mini-scene** — `PreviewRenderer`,
originally built for the Builder app's own live object preview, reused here
completely unchanged in its rendering logic. It gained exactly two optional
constructor parameters (`lookAtHeight`, `distance`, both defaulting to the
Builder's original hardcoded values, so Builder's own usage is entirely
unaffected) so the Wardrobe can frame a person-sized figure rather than a
typical Builder object.

That reuse wasn't the first approach tried. The brief describes "the
camera should smoothly transition to face the player's own character" —
read literally, that meant retargeting the *main world camera* to look at
a character standing somewhere near the desk, reusing the same focus-pose
mechanism the computer and workbench already use. That version got far
enough to work — `CameraSystem.enterFocus()` even briefly gained the
ability to retarget smoothly to a new pose while already focused, rather
than only entering once — before running into a real conflict: the
computer's own panel repositions itself *every frame*, by projecting the
monitor's screen corners through the *current* camera. That projection
assumes the camera is looking at the monitor, because focus mode always
has been until now. Turning the camera to face a character standing
somewhere else would have sent that projection somewhere nonsensical —
off in a screen corner, or behind the camera entirely — breaking the very
panel the Wardrobe's own controls live in.

Rather than teach the computer's panel system about a second kind of
camera target (a real, but much larger and riskier, architectural change
to code that currently works reliably), the isolated-preview approach was
both lower-risk and a better fit for "avoid introducing one-off
implementations" — it's not a one-off at all, it's the exact same solution
the Builder app already uses for an almost identical need. The
`enterFocus()` retargeting change was reverted once it had no caller left;
shipping speculative capability nothing actually uses isn't something this
codebase does elsewhere either. This is recorded here rather than quietly
dropped because it's a genuine example of a design needing to change after
running into a real constraint discovered while building it, not before.

## Architecture: ready for what comes next

- **Clothing / accessories / wearable Builder objects** — a natural
  extension is a garment "attaching" to one of the rig's existing pivots
  (the torso pivot for a shirt, a wrist pivot for a bracelet) the same way
  a hand already attaches to a wrist. The pivots already exist for this.
- **Animation** — rotating any pivot in the hierarchy already affects
  everything below it correctly, because the hierarchy is real, not
  simulated with independently-positioned meshes.

Two things this section used to list as *future* extension points —
mirrors/reflections and a third-person camera — are no longer future; see
"Reflections and third person" below for both. The prediction here held up
exactly as written: neither needed a single change to this file. The rig
never hid itself from any particular camera to begin with, and the reason
it happens to be invisible in ordinary first-person play was always just
where the camera physically sits (see "Known limitations"), not a rule
that needed removing.

What those two make newly possible:

- **Future Workshop residents** — anything with its own position/
  orientation (an NPC, say) becomes visible in a mirror or from a
  third-person camera exactly the way the player already is, with no
  special-casing needed on either side; a mirror renders whatever's
  actually in the scene, not "the player, specifically."
- **A true oriented planar reflection**, if the approximation in
  "Reflections and third person" ever needs to be more exact — the
  projective-texture-shader approach `ReflectionSystem.js`'s own comment
  describes and deliberately didn't build.
- **Reflective Builder surfaces beyond a flat plane** — `ReflectiveBehaviour.js`
  currently only looks for the largest Plane-shaped part; a curved or
  multi-part reflective surface would need its own, more involved surface
  detection, not a change to `ReflectionSystem` itself.

## Reflections and third person: the player becomes visible

"Strengthen the player's presence" turned out to mean, concretely: give
the player a way to actually *see* the character this whole system
builds, from outside it, in more than one way.

### The reflection system is generic, not a mirror special-case

`src/systems/ReflectionSystem.js` is the entire capability: one function,
`registerSurface(mesh, options)`, that anything can call to make a mesh
reflective. `Wardrobe.js`'s hand-built mirror and a Builder object's
`reflective` behaviour (`ReflectiveBehaviour.js`) both call it directly,
neither aware the other exists — "avoid hard-coded special cases" is true
because there is no special case, just one small, generic function two
independent callers happen to use. None of what follows changed that —
"Mirror Refinement" (see docs/ROADMAP.md) replaced *how the camera is
positioned*, not this contract.

**A fixed viewpoint, not a camera chasing the player.** The first version
of this system positioned the mirror's virtual camera at the reflection
of the main camera's position and orientation, recomputed every single
frame from wherever the player currently was. In actual use, that turned
out to be the wrong choice, not just an implementation detail worth
polishing:

- **What was discovered:** walking toward the mirror made the reflected
  viewpoint appear to retreat, and close enough, areas outside the
  Workshop became visible through it.
- **Why it happened:** reflecting the player's exact position every frame
  is *closer* to a physically correct reflection, but nothing bounded the
  resulting camera's frustum to the mirror's own actual size or to the
  room it sits in. As the player approached and turned to face the
  mirror, the virtual camera approached from the opposite side at the
  same rate, and its wide-open, unbounded frustum could sweep past
  whatever was nearby — including straight through the Workshop's own
  walls into the exterior world beyond them. It was also doing real,
  avoidable work for this: re-deriving a full camera transform from
  scratch, every single frame, on top of the render itself.
- **What changed:** the mirror's camera position and orientation are now
  derived once from the mirror's *own* geometry, not the player's —
  sitting just in front of its own surface (deliberately *not* behind the
  glass, which would need real physical depth a wall-mounted mirror often
  doesn't have — this one specifically, having been moved closer to a
  wall in the previous pass), looking further out into the room, and
  never moving on their own. Walking closer to the mirror now simply
  makes the player's own rig occupy more of a camera that isn't moving —
  exactly the desired behaviour — and the view can never sweep past
  whatever that fixed framing was set up to show in the first place.
  "The Workshop should always favour believable over physically perfect"
  — a real mirror doesn't have a camera in front of it either; a fixed,
  sensible viewpoint reads as a believable reflection without needing to
  be a physically exact one.

The one thing that *does* still need tracking is the mirror itself
moving — a future Builder-placed mirror repositioned in Build Mode
shouldn't leave its reflection facing where it used to be.
`_updateFixedTransform()` checks this cheaply every frame for every
surface (a plain position/normal comparison against what was last seen)
and only recomputes the camera transform when something actually changed
— nothing at all for the ordinary case of a mirror that never moves.

Rendering itself still uses `lookAt()` to build the camera's orientation
rather than reflecting basis vectors directly — a reflection inverts
handedness, and a naively-reflected orientation can invert winding order
and cull the wrong faces; `lookAt()` always produces a normal,
correctly-wound camera basis regardless of how its target point was
derived. The rendered texture is still applied to the surface's own
cloned material (never the shared, cached original — the same rule
`PlaceholderFactory.js`'s own cache requires everywhere else in this
project).

**Performance was investigated properly, not guessed at ("Mirror
Refinement" — see docs/ROADMAP.md).** The unavoidable cost is rendering
the entire scene a second time — that's inherent to any real-time
render-to-texture mirror, fixed viewpoint or not, and no amount of
camera-math cleverness removes it. What actually was addressable, once
that was understood:
- **Shadow-map rendering is now skipped for this render specifically** —
  a genuinely expensive, separate pass per shadow-casting light, and not
  something a believable-not-perfect reflection needs. Likely the single
  largest saving found.
- **Update throttling loosened slightly** (every third frame, not every
  other) — a fixed viewpoint doesn't need to track anything in real time
  the way a chasing camera used to.
- **Render resolution trimmed slightly** (320px, down from 384) — a
  mirror is seen from a few metres away, not pixel-peeped.
- **Distance culling and a view-direction check both carried over
  unchanged** from the previous pass — being near a mirror, or it being
  out of view, already meant skipping the render entirely; none of that
  needed to change.

A `dispose(ctx)` hook lives on the behaviour registry itself
(`registerBehaviour`/`registry.js`) specifically for this system: unlike
a light or a decoration, which are just scene-graph children that get
cleaned up automatically when their object is removed, a render target is
a real GPU resource that would otherwise leak on every deleted or
recoloured (which rebuilds an instance from scratch — see
`WorldObjectsSystem.updateInstanceColorOverride`) reflective object.

**Reflections had also rendered almost unreadably dark ("Living
Refinement" — see docs/ROADMAP.md), from two real, well-documented
Three.js colour-management gotchas**: a render target's texture needs its
`colorSpace` set explicitly (to `SRGBColorSpace`), or sampling it as a
`map` applies an extra, unwanted darkening decode on data that's already
correctly encoded; and the offscreen render already has this renderer's
own tone mapping baked into its pixels, so displaying that texture
through a normally tone-mapped material doubles it, darkening the result
further. Both fixed, rather than just brightening the result to
compensate.

### The physical wardrobe opens the existing app — literally the same code

`Wardrobe.js` is an ordinary `FURNITURE_REGISTRY` entry with an
`overlayId` like any other piece of furniture that opens an overlay (the
music cabinet, the archive shelving). `WardrobeOverlay.js` — the thing
that `overlayId` actually opens — calls `createWardrobeApp()`, the exact
same factory function `src/computer/apps/registry.js` calls for the
computer's own Wardrobe tab, and mounts it into an overlay panel instead
of a computer screen. There is no second wardrobe system to keep in sync;
there's one, with two doors into it.

The mirror stands beside the cabinet as part of the same furniture
definition, marked via `object3D.userData.mirrorMesh` (and
`mirrorAspect`, since furniture built with `box()` bakes its real
dimensions into the geometry rather than expressing them through
`mesh.scale` the way Builder parts do — reading `.scale` for the aspect
ratio here would always give 1:1). `ReflectionSystem.init()` reaches into
`FurnitureSystem`'s already-built pieces looking for that marker, the
same "a system reaches into furniture's own userData for something it
cares about" pattern `LightingSystem` already uses to find the workbench's
lamp socket.

**The wardrobe was completely unreachable when first added ("Living
Refinement" — see docs/ROADMAP.md).** The same root cause
docs/REFINEMENT.md's front-door fix had already diagnosed once: its
interaction anchor (the whole compiled group) sits at ground level, but
interaction distance is a real 3D distance from the camera's eye height
(1.65m) — its original radius (1.6) was already smaller than that fixed
vertical distance alone, making it unreachable from any position at all.
Now 2.0. The wardrobe and its mirror were also moved closer to the wall
in the same pass, purely a placement refinement — the mirror needed a
noticeably larger nudge than the cabinet, since its frame is far thinner
than the cabinet's own depth, and a small offset barely moves a thin
object's actual back face.

### Third person is a rendering choice, not a second player

`CameraSystem.viewMode` ("first" | "third", toggled with **V** or the
HUD's own button) sits entirely on top of the existing walk/focus modes.
`this.position`/`yaw`/`pitch` still represent where the player actually
is and which way they're actually facing — everything movement,
collision, and focus-pose easing already does is completely unaware a
third-person view exists. Only `_applyCameraTransform()` changes: it
blends (`_viewBlend`, eased over time so toggling reads as one continuous
camera move rather than a cut) between the ordinary first-person transform
and a position behind-and-above the player, aimed back at them with
`lookAt()`. The desired third-person position is run through
`_resolveCollisions()` — the exact same wall/furniture push-out the
player's own movement already uses — so the camera doesn't clip through a
wall behind the player, without a second collision system existing for it.

**A genuine, easy-to-miss bug here, found through actual use ("Living
Refinement" — see docs/ROADMAP.md): the camera looked *away* from the
player, position otherwise correct.** The cause was a real Three.js
gotcha, not a maths error in this file: `Object3D.lookAt()` internally
swaps which point is the "eye" and which is the "target" for anything
that isn't a camera or light (`this.isCamera`/`isLight`). The scratch
object used purely to compute the third-person orientation was a *plain*
`Object3D` — meaning it silently used the wrong convention, producing an
orientation exactly 180° from what a real camera needs to face that same
point. Fixed by making that scratch object an actual (never rendered)
`THREE.PerspectiveCamera` instead, so `isCamera` is true and `lookAt()`
computes the orientation a camera actually needs.

Third person only ever applies while walking, never while focused
(sitting at the computer, the wardrobe, anywhere else with a focus pose):
"the Workshop should continue being designed primarily for first-person
gameplay" is implemented as a real constraint, not just a suggestion —
`toggleViewMode()` is a no-op in focus mode, and the blend automatically
eases back to first person the moment a focus pose is entered.

## Known limitations

- **"Never see themselves" in first person is physics, not a rule.** The
  camera sits almost exactly where the head mesh is, so — thanks to
  ordinary backface culling — the head effectively becomes invisible to
  it from the inside, and looking down shows the torso/legs/feet
  normally, the same as any first-person game. There's no deliberate
  visibility toggle hiding the mesh from its own camera — confirmed by
  third person and the reflection system both existing now (see
  "Reflections and third person" above) and needing zero changes to this
  system to work: move the viewing camera outside the head, in either
  form, and the rig is just normally visible, exactly as predicted.
- **The reflection is an approximation, not a true mirror**, and the
  third-person camera's own collision reuses the player's flat wall/
  furniture push-out rather than a real 3D check — see their own sections
  above for what each trades away and why.
- **Symmetric limbs only** — see "The rig" above. Editing an arm or leg
  shape affects both sides identically; there's no independent left/right
  control.
- **No embedded metadata beyond the canvas itself** — an imported image is
  resampled down to the same 64×64 working canvas every other texture
  uses; very fine detail in a large imported image won't survive that.
- **The paint tool is deliberately simple** — one brush size, flat fill,
  no layers or undo. It's a wardrobe, not an image editor.
