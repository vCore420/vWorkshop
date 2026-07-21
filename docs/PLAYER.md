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

"Animation" used to be listed here as a future extension point too — see
"Movement & Expression" below for the full system it became. The
prediction held up exactly as written here too: "rotating any pivot in
the hierarchy already affects everything below it correctly, because the
hierarchy is real" turned out to be the entire reason a full keyframe
animation system, a frame-by-frame editor, and a shared library all
needed zero changes to the rig itself — `applyPose()` just sets
`.rotation` on pivots that were already sitting there, real joints,
since Phase 10.

What Movement & Expression makes newly possible:

- **Chairs and Builder objects requesting a specific animation** —
  `PlayerAnimationSystem.play(clipId)` is already a generic entry point
  any system could call, not something built specifically for the Emote
  Wheel; a sitting animation triggered by the reading chair, say, is a
  few lines in `SeatBehaviour.js`, not a new capability.
- **Future Workshop residents using the same animation library** — since
  a clip is just rotations keyed by pivot name, and any rig sharing
  those pivot names could play it, an NPC built on the same
  `PlayerCharacter.js` rig shape would already be animatable with zero
  changes to `AnimationClips.js` or `PlayerAnimationSystem.js`.
- **A true root-motion system**, if walk/run animations ever need to
  visually move the rig's own feet rather than the whole body simply
  following the camera — everything here still treats animation as
  pose-only, layered on top of `PlayerCharacterSystem`'s existing
  camera-follows-position behaviour.

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

**The overlay panel itself was quietly broken (Version 3, Phase 9 —
"Creative Flow").** Playtesting read the physical wardrobe's own overlay
as "noticeably rougher... closer to an early prototype than something
built for the player." The first-guess fix — the panel's own declared
width (880px, well past every other furniture panel's own ~560px scale)
was simply too generous — turned out not to be the real bug: live
measurement showed the panel rendering at roughly full viewport width no
matter what was declared. Two compounding CSS mistakes, both invisible
from reading the CSS alone:

1. `WardrobeOverlay.js`'s own `mount()` added a second class onto the
   same panel element the material rule already targeted, and that
   class's own rule set `flex: 1`. Since the panel is itself a flex
   child of the outer `.overlay` (centred, not stretched), `flex: 1`'s
   implicit `flex-basis: 0%` silently overrode the declared `width`
   entirely, letting the panel grow to fill nearly the whole screen
   regardless of what width `.overlay--wardrobe .overlay-panel` asked
   for.
2. That same rule's `display: flex` never declared a `flex-direction`,
   defaulting to `row` — so the `<h2>` heading and `.builder-root` (the
   two children `WardrobeApp.js`'s own `mount()` appends directly into
   the panel) laid out side by side rather than stacked. Measured live:
   the heading rendered as a squeezed ~114px-wide column stretched to
   the panel's full height, with the split preview/form layout beside
   it, not below it.

Fixed by removing the conflicting class/rule entirely (the panel never
needed to flex-grow — every other overlay material's own panel just
takes its explicit width/height and lets `.overlay`'s own centring do
the rest) and adding the missing `flex-direction: column`. The panel
then genuinely rendered at the same 560px width every other piece of
furniture already uses, with the heading correctly stacked above the
split preview/form layout — verified live with real DOM measurements
(panel width, child positions, and a full sweep for any element
overflowing the form's own bounds), not assumed from the CSS.

**That 560px turned out to be the wrong fix for this specific app
(Version 3, Phase 14, "Further Environmental Polish").** Once the panel
correctly respected its own declared width, 560px — the generic scale
every *other* furniture overlay's own simpler content already fits —
was never actually right for Wardrobe's own richer form (body-model
tabs, part tabs, proportions, appearance, paint, outfits): "way too
small... it just needed everything inside of it to have a better layout
scheme." Widened to 880px (short of the old 1280px accident, but wide
enough to matter), and `WardrobeApp.js`'s own form gained a genuine
two-column grid (`.wardrobe-form`, scoped to this app alone so the
Builder app's own unrelated `.builder-form` usage is untouched) — the
compact, tab/slider-only sections (Body, Alternate Models, Proportions,
Appearance) now sit two to a row instead of stacking one narrow column
regardless of how much width the panel actually has; Paint and Outfits
keep the full row. Verified live by mounting the real overlay and
reading back each section's own rendered position — confirmed the
intended pairings land correctly, including one genuine layout bug this
surfaced along the way: `buildPartTabs()`'s own bare, unwrapped strip
(no `.builder-section` of its own) needed its full-span rule named
explicitly, since the grid's default auto-placement squeezed it into a
narrow column otherwise. See `css/overlays.css`'s own `.overlay--wardrobe`
comment and `css/builder.css`'s own `.wardrobe-form` comment for the
complete account.

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

## Movement & Expression

"Bring the player to life" — three things arrived together, each modular
enough to not depend on the others existing: a real movement system
(running, crouching, jumping, climbing), multiple body models, and a
complete keyframe animation system with its own creative workspace. See
docs/ROADMAP.md's Phase 17 entry for the full account of what was built.

### Movement: still one continuous state machine in CameraSystem

Running, crouching, jumping, falling, landing, and climbing all live
inside `CameraSystem._updateWalk()` and the two methods it delegates to
(`_updateGroundMovement`/`_updateLadderMovement`) — not a second
movement system, an extension of the one that already handled walking.
Vertical movement tracks a separate foot-level height (`_footY`) from the
eye-height offset added on top of it (`this.position.y = _footY +
_currentEyeHeight`): gravity and jumping operate on the former, crouching
smoothly eases the latter, and everything else in the file (focus mode,
third person, collision) still only ever reads `this.position` as one
combined number, exactly as before.

**Standing on Builder-created structures** uses
`WorldObjectsSystem.getFootprints()` specifically, not furniture's own —
furniture's footprints are a fixed 0–2.2m collision column (see
docs/WORLD.md), not the piece's actual height, which would make every
piece of furniture seem to have a flat "top" at 2.2m if used for this.
`_computeGroundHeight()` is a simple heightmap-style query, not real
physics: the base floor, plus the top surface of any nearby footprint
within a step-up tolerance of the player's own feet — close enough to
climb onto or land on, not a distant platform floating overhead that
would otherwise teleport the player up the moment they walked underneath
it. "Favour believable over physically perfect" applies here exactly as
much as it does to reflections.

**Ladders integrate through the Builder behaviour system, not a special
case** — `LadderSystem.js` is the entire capability (one function,
`registerLadder(object3D)`, the same "one small, generic thing multiple
independent callers use" shape `ReflectionSystem.registerSurface()`
already established), and `LadderBehaviour.js` is the Builder-facing side
of it. A ladder is just a `THREE.Box3` zone; standing inside one switches
`_updateWalk()` into climbing mode, where forward/back input (relative to
the player's own facing, not world space — see the note below) climbs up
or down and gravity is suspended.

**A real, if minor, bug found and fixed during this pass**: the first
version of ladder climbing used `wish.y` (the world-space Z component of
the player's intended movement, after the yaw transform) as "how much
forward input" — which only actually correlates with pressing forward
when facing exactly north or south. At any other facing, `wish.y` reads
close to zero even while holding forward, since a sideways-facing
"forward" barely moves along world Z at all — climbing would have felt
broken depending entirely on which direction the ladder happened to
face. Fixed by using `input.moveVector.y` instead — the raw,
camera-relative forward input, before the yaw transform — which is what
"pressing forward" actually means regardless of world orientation. The
same fix applies to the gentle horizontal drift while climbing, which
used to zero out world-space Z outright rather than computing a proper
strafe-only vector.

**A second, much bigger bug: a Builder-placed ladder never actually
worked at all, despite the fix above.** Found in Version 3, Phase 3b (a
small refinement pass) after a real playtest report — "I get stopped by
its collision and the player keeps trying to walk forward but not going
up the ladder," tried from every side. Root cause:
`WorldObjectsSystem` gives every placed instance a solid walk-collision
box, unconditionally — including a ladder, since nothing exempted a
`"ladder"`-behaviour object from it. `CameraSystem._resolveCollisions()`
pushed the player back out of that solid box before they could ever walk
far enough forward to actually reach `LadderSystem`'s own climbable
zone, which is only slightly bigger than the box itself. Fixed in
`WorldObjectsSystem._updateFootprint()`: an object carrying the
`"ladder"` behaviour now gets no walk-collision footprint at all — see
`docs/WORLDBUILDER.md`'s "Collision integration" section for the full
account. Verified against the real collision path, not just the
climbing mechanics in isolation — driving genuine forward-key input
through `CameraSystem.update()` frame by frame from a standing start
several metres away, from two different approach angles, both reaching
the zone and climbing normally.

This corrects an earlier, wrong claim: Version 3, Phase 1's own
"explicit playtest" reported ladders as "reviewed and found already
complete." That verification drove the player's own position directly
to test the climbing mechanics themselves (zone padding, climb speed,
gravity suspension) and never actually simulated walking in from a
distance — so it never hit this collision wall. The climbing mechanics
it tested were, and still are, genuinely correct; the approach to them
never was.

### Crouching: the camera moved, but so, deliberately, does the head

Version 3, Phase 1 ("Completing Promises") named this directly:
"crouching should restore a comfortable first-person camera without
animation artefacts obscuring the view." Two earlier fixes (Workshop
Reliability's root-tracking fix; Refinement Pass A's
`CROUCH_HEIGHT_RATIO`, replacing a flat subtraction with a genuine ratio)
were both real and both correctly resolved what they targeted, but
neither touched a deeper fact: this rig has no vertical translation at
all — `applyPose()` only ever rotates pivots, and `torsoPivot`'s own
position is fixed once at build time. So while crouching genuinely eases
the *camera's* eye height down, nothing about the *mesh* ever moves —
`PlayerCharacterSystem`'s own root-position formula (`cam.position.y -
cam.getCurrentEyeHeight()`) algebraically always resolves to `_footY`,
standing or crouched.

**Version 4, Phase 4 — a real, separate bug this same fixed-root fact
was quietly causing: the feet floated instead of the body settling
down.** Vi's own field report, playtesting: "the player model doesn't
lower when crouching... the players feet leave the ground instead of
the whole body moving down." Root-caused live, not guessed —
`CROUCH_CLIP`'s own authored hip/knee bend was pure forward kinematics
with nothing correcting it, and with the hip position fixed (per the
paragraph above), that bend folded each leg *up* rather than settling it
down: measured 0.216m of foot lift for the default body proportions.
Fixed by reusing `FootIK.js`'s already-proven `solveTwoBoneIK()`/
`applyLegIK()` machinery (previously only wired to the `"idle"` movement
state, for terrain contact) — a new `applyCrouchFootIK()` targets each
ankle back to the standing vertical span from its own hip, read live
from the rig's own segment lengths so it's correct for every body
proportion the Wardrobe can produce, not tuned for one default.
`CROUCH_CLIP`'s own authored leg angles are now inert (zeroed, with a
comment explaining why — see `AnimationClips.js`); only the torso lean
and arm pose it authors still apply.

**An honest limit, not papered over**: the standing pose already sits at
~99.99% of the leg's own maximum reach (see `FootIK.js`'s own header),
which leaves no real slack to also bend the knee forward while keeping
the ankle at exactly the same height — any target close enough to
produce a visibly bent knee necessarily reintroduces some of the same
float this fix removes. Given the actually-reported bug was 21.6cm of
float, not "the knee doesn't bend enough," this fix targets exact height
correctness (re-measured live after the fix: 0.0001m residual, matching
the two-bone solver's own built-in safety margin) over a dramatic bend —
the corrected crouch reads as the torso's already-authored forward lean
over straightened legs, not a deep knee-bent squat. A genuine bent-knee
crouch would mean the hip/torso actually translating downward in world
space, which is the deeper limitation this paragraph opened with — still
squarely `docs/ROADMAP_V4.md`'s own future "Rest of IK" phase, not
something a foot-planting fix can honestly claim to solve.

Standing has always relied on a coincidence to hide this: the
first-person camera happens to sit precisely inside the head mesh, so
ordinary backface culling hides it. Crouching breaks that coincidence —
the camera drops out of the head box into the torso box instead, and the
head it left behind floats visibly above it, fully rendered, for every
body proportion the Wardrobe can produce.

The fix doesn't move any joint. Lowering `torsoPivot` to match would have
dragged the hip/leg/foot chain down with it — un-planting the feet from a
`CROUCH_CLIP` pose that was authored assuming a fixed hip height, and
likely needing that clip re-tuned too. That's foot IK's own job (a later
Phase 1 milestone), not this one's. Instead: `PlayerCharacter.js`'s new
`FIRST_PERSON_HIDDEN_LAYER` puts the head mesh on its own Three.js render
layer; `PlayerCharacterSystem._rebuild()` tags it once per rig build
(skipped harmlessly for an imported-model rig, which has no head mesh);
`CameraSystem.update()` excludes that layer from `engine.camera` whenever
the view is effectively first-person, reusing `thirdPersonActive` (the
same value already driving the view-mode blend) rather than adding new
state — which also correctly covers focus mode, since sitting down always
eases back to first-person regardless of `viewMode`. `ReflectionSystem.js`
explicitly re-enables the layer on every mirror's own camera, since a
reflection should always show the full character. Verified directly
against the live engine — root position staying pinned to `_footY`
throughout a simulated crouch, eye height easing to exactly
`standingHeight × 0.78`, and every layer-enabled state checked mid-crouch
and across a view-mode toggle.

**Version 4, Phase 4 — the torso claim below is no longer
analysis-only.** `computer{action:"screenshot"}` still isn't available in
this environment (re-confirmed the same phase; see `.claude/DEV_NOTES.md`),
but a genuine rendered-frame pixel-readback is: the torso mesh was
temporarily swapped to an unlit, saturated debug material, rendered from
the exact first-person eye position a crouched player has (post-foot-fix,
see above) looking straight ahead, and the frame read back pixel-by-pixel
— zero matching pixels anywhere in a 1280×720 frame, confirmed against two
independent controls (a camera clearly outside the character, and the
same crouched eye position turned to look down at the legs instead) that
both correctly *did* show the debug colour, ruling out a broken test
producing a false "invisible" reading. See "Known limitations" below —
this specific claim is now visually confirmed, not just analysis-backed.

### Body models: the same rig, different starting proportions

`BodyModels.js` defines the available procedural body models (Masculine,
Feminine to start) — each with its own base dimensions and default
appearance, but every one of them produces the exact same `PART_IDS` and
pivot names `PlayerCharacter.js`'s rig always has. That's not a
limitation; it's what makes "the same animation library should work
across every supported body model" true by construction — a clip stores
rotations keyed by pivot name, and a pivot of that name exists on every
model, always, so animation playback never needs to know or care which
model is currently active.

`PlayerAppearanceStore` keeps each model's appearance independently
(`appearanceByModel[modelId]`) — switching models restores whatever was
last being customised on that one, rather than overwriting it.
`.appearance` stays a plain property throughout, via a getter/setter that
proxies to `appearanceByModel[bodyModelId]`: every existing caller
(`PlayerCharacterSystem`, `WardrobeApp.js`) kept reading/writing
`store.appearance` exactly as before, with zero changes needed on their
side; only the store itself needed to know there's more than one now.
Outfits remember which body model they were saved for
(`OutfitStore`'s own `bodyModelId` field) — loading one saved on a
different model switches models too, rather than applying mismatched
proportions to the wrong base dimensions.

Adding a third model later is one more entry in `BodyModels.js`'s own
`BODY_MODELS` object — its own base dimensions, its own default
appearance — and nothing else in the player architecture changes.

**Version 3, Phase 10 ("Real Assets, Honestly Introduced")** gave the
Wardrobe rail six starter outfits (`DefaultOutfits.js`), the same
seeded-by-default treatment `DefaultBlueprints.js` already gave the
Builder Library and `AnimationClips.js`'s new default emotes just gave
the Emote Wheel. `OutfitStore`'s constructor seeds them directly
(string ids, `"default-outfit-..."`, so they can never collide with a
player-created outfit's own auto-incrementing numeric id) — but
deliberately, unlike `BlueprintStore.load()`'s own "reseed when
genuinely empty" rule, `OutfitStore.load()` does *not* bring them back
once a save's own `outfits` key is a real (even empty) array. The
Settings app's "Reset Player Data" already promises "every saved outfit
deleted... this can't be undone"; reseeding on the next load would
quietly break that. See `OutfitStore.js`'s own comment for the full
reasoning. Every outfit's `head`/`hand` colour matches its own body
model's stock skin tone rather than inventing a new one — wearing an
outfit changes clothing, not who's wearing it — and one, the Pride
Jumpsuit, blocks the trans pride flag's three colours across
torso/arms/legs as a soft, deliberate palette choice, not literal
stripes (this rig has no per-part texture, only one flat colour each).

### The Animation System: movement requests, this system decides

**"The movement controller should simply request animations from the
Animation System... avoid tightly coupling animation logic directly into
the movement controller."** `CameraSystem` has never seen an animation
clip, a pose, or a pivot name, and never will — every frame it computes
one plain string ("idle"/"walk"/"run"/"jump"/"fall"/"land"/"crouch"/
"ladderClimb") describing what the player is *doing*, and hands it to
`PlayerAnimationSystem.setMovementState()`. What that state actually
looks like — which clip plays, how frames blend, whether an emote is
currently overriding it — is entirely `PlayerAnimationSystem`'s own
concern.

**A clip's shape** (`AnimationClips.js`'s own comment has the full
version): `{ id, name, description, category, loop, speed, frames: [
{ duration, pose: { pivotName: [x,y,z] } } ] }` — plain Euler-angle
rotations in radians, keyed by pivot name. `applyPose()`
(`PlayerCharacter.js`) is the entire playback mechanism: it sets every
pivot's rotation explicitly each call, resetting anything a pose doesn't
mention back to rest rather than leaving it at whatever it happened to
be — without that, a rotation from whichever clip played *previously*
(bent knees from Crouch, say) could silently persist into a new clip that
never mentions that pivot at all.

**Interpolation is plain linear interpolation of Euler angles**, not
quaternion slerp — a deliberate simplification that holds up fine for the
modest rotation ranges ordinary locomotion and gestures actually need, in
exchange for authoring and reasoning about poses as plain per-axis
numbers. "Favour believable over physically perfect."

**Two playback sources, one clear priority.** Movement state drives
playback by default. `PlayerAnimationSystem.play(clipId)` — the Emote
Wheel's own entry point, and "keep the player architecture modular" means
anything else can call it too (a chair, a Builder object, a future AI
Resident) — takes over as an override until either it finishes
(non-looping) or genuine movement interrupts it: walking away from a
looping emote hands control back to movement automatically, "looping
animations should continue until interrupted by player movement or
another animation" implemented as `setMovementState()` itself clearing
any active override the moment the new state represents real movement.

**The eight default animations** (`AnimationClips.js`) are seeded data,
not special-cased code — the same "the alphabet" role
`ConstructionLibrary.js` plays for the Builder. `AnimationLibraryStore`
never stores them in its own mutable list; `getClip(id)` resolves either
a default or a user clip identically, and `isDefault(id)` is what the
Animation Editor uses to show them as read-only, offering "Duplicate to
Edit" instead of letting them be changed directly — the same read-only-
defaults rule the Construction Library already follows.

**Advanced Animation phase (v2.0.6): the shared language, made literal.**
Frame advancement and pose blending were extracted out of this class's
own private methods into `AnimationPlayback.js` — pure functions any
system can call identically, which is what let Beings start playing
these same clips for real (see `docs/BEINGS.md`'s own "Animation
Integration" section) without a second animation engine. Retargeting,
skeleton mapping, two-bone IK, procedural layering, animation events, and
the Pose Library all arrived the same phase — see **`docs/ANIMATION.md`**
for the complete account; this section stays focused on the Player rig's
own original architecture, unchanged at its core.

### The Animation Editor: another creative application, not a technical tool

`AnimationEditorApp.js` follows the Builder app's exact split-workspace
layout (`.builder-workspace`/`.builder-workspace-preview`/
`.builder-workspace-form`) on purpose — "think of this less as building a
game animation editor, and more as creating another creative application
inside the Workshop." A live preview (its own small, isolated
`PreviewRenderer` scene — a second character rig built fresh for editing,
never the player's actual on-screen one, so posing it for editing never
affects what's actually happening in the Workshop right now) stays
visible at all times on the left; the timeline, frame controls, body part
selection, rotation sliders, and animation properties live on the right.

**A working copy, not live editing** — unlike the Wardrobe (where every
slider writes straight through to the live-worn appearance), the editor
works on a local, deep-copied draft of whichever clip is selected, saved
back to the library on every change but never touching a clip the
player's own on-screen character might currently be playing until that
save actually happens. Selecting a different frame immediately updates
the preview to that frame's exact pose; Play/Pause blends between frames
the same way `PlayerAnimationSystem` does, using a second, independent
playback loop scoped entirely to this editor's own preview scene.

Frame operations (add, duplicate, delete, reorder) and rotation editing
(per body part, per axis, in degrees for readability — converted to/from
the radians a pose actually stores) are all immediate, no separate "apply"
step, matching how every other editing surface in the Workshop already
works.

**"The player should be capable of previewing animations using different
compatible models" (Advanced Animation phase).** The Model dropdown
(Player, any Saved Being, any Imported Model) already existed; what
changed is what selecting one actually does. Choosing a Being or Model
now genuinely retargets the current pose/playback onto that model's own
skeleton — via the exact same `WorkshopSkeleton.autoMapSkeleton()`/
`AnimationRetargeting.applyPoseToMappedSkeleton()` path
`BeingController.js` uses for a placed Being — whenever that model's
skeleton maps confidently enough; an honest note explains why not,
otherwise. Editing itself still only ever moves the Player rig's own
named pivots regardless of which model is being previewed, since a clip
is authored once, against the shared vocabulary, not against any one
rig's own bone names. "Save Frame as Pose" (see docs/ANIMATION.md's own
"Pose Library" section) sits right next to the frame list, saving the
current frame into the new shared Pose Library.

### Import / Export: animations are portable Workshop assets

A simple, self-describing JSON wrapper — `{ format: "workshop-animation",
version: 1, clip: {...} }` — future-friendly the same way every other
export format in this project is: a format/version marker up front means
a future version of this app can always tell an old export apart from a
new one without guessing. Reuses `StorageUtils.downloadJSON`/`uploadJSON`
directly, the same browser download/file-picker mechanism every other
export in the Workshop already uses — no new file-handling machinery
needed. Importing a clip creates a brand new user clip (never overwrites
anything existing), named "<original name> (imported)" so it's obvious
where it came from.

### The Emote Wheel: plays assets, decides nothing

`EmoteWheelSystem.js` (toggled with **Tab**, rebound from G in Version 4,
Phase 2 — see below) is deliberately almost nothing: it reads every
non-movement clip in the library and calls
`PlayerAnimationSystem.play(clipId)` when one is picked. "The Emote Wheel
should simply play animation assets" is true by construction — this file
has never seen a pose, a frame, or a pivot name. It closes itself the
instant something is picked (or Escape is pressed) rather than staying
open as a persistent menu, and briefly locks movement/look while open
(the same `CameraSystem.lock()`/`unlock()` every overlay already uses) so
the mouse can click a button — given how briefly it's ever open, this
reads as a quick glance down at a gesture list, not a mode switch.

**Version 3, Phase 14 ("Further Environmental Polish")** — a genuine
radial layout now, not a wrapping row of pill buttons: each clip gets a
`--angle` custom property (`_render()`'s own JS, one line per clip, no
trigonometry needed there), and `css/main.css` places every button on
the ring with a single rotate/translate/counter-rotate compound
transform — the standard CSS-only technique for a circular layout that
keeps every label upright regardless of where on the circle it sits.
Same close-on-pick behaviour, untouched; new hover/focus state (a small
outward scale plus the same teal highlight the rest of the Workshop's
own interactive elements already use).

**Version 4, Phase 2 ("Playtesting Notes, Continued") — real pie-wedge
segments, and a rebind that needed a real safety guard alongside it.**
Playtesting called the ring-of-circles version "getting better but still
off in design," naming FiveM's `qb-radialmenu` as a concrete reference.
Rebuilt as genuine wedges: each gesture's own button now fills the whole
ring and is cut to its own slice with a JS-computed `clip-path:
polygon(...)` (`wedgeClipPath()`, sampling the arc every ~12° so even a
wide wedge — few total gestures — reads as a real curved slice, not a
straight-edged triangle) — a real, independently clickable wedge-shaped
hit area, not a circular button sitting on a decorative background.
Confirmed live: every wedge's own last boundary point matches the next
wedge's first point exactly, tiling the full circle with zero gaps or
overlaps. Icons are a small, honest keyword heuristic against a clip's
own name (wave→👋, clap→👏, bow→🙇, and so on), falling back to a plain
generic glyph for anything player-authored that doesn't match — this
project ships no binary/image assets by design, so there's no icon
library to draw from instead. The centre hub is larger, and now a real
second close affordance (clickable, alongside Tab/Escape); the bordered/
backgrounded card wrapper is gone for the ring itself, so it floats
directly over the game view, closer to "should remain lightweight,
elegant and unobtrusive" than a panel that happens to be circular.

The wheel also moved from **G** to **Tab** — but `EmoteWheelSystem.
update()` had never checked anything about modal state before this,
which was apparently never a practical problem for G (rarely pressed
while the Computer/Phone/an overlay panel was open) but would have been a
severe, constant one for Tab specifically: Tab is the standard key those
exact panels already use continuously to cycle focus between their own
controls (`focusTrap.js`). The fix reuses `input.pointerLocked` — the
same already-computed, already-universal signal every modal in this
codebase relies on (`exitPointerLock()`/`requestPointerLock()`, called by
Computer, Phone, Workbench, and every `OverlayManager` panel) — rather
than inventing a second, parallel way to ask "is a modal currently open."
Confirmed live, three ways: Tab opens the wheel during free-roam;
Tab does nothing while a modal holds focus; Tab still closes the wheel
once it's already open, even though opening it releases pointer lock
itself (the one case a plain `pointerLocked` check alone would have
missed).

**Version 3, Phase 10 ("Real Assets, Honestly Introduced")** gave the
wheel real default content — `AnimationClips.js`'s own `DEFAULT_ANIMATION_CLIPS`
now includes four hand-authored `category: "emote"` clips (Wave, Clap,
Bow, Dance), the same permanent-seeded-data pattern
`DefaultBlueprints.js` already established for the Builder Library. A
fresh Workshop's wheel previously always showed "No gestures yet" until
a player made one in the Animation Editor; it now opens with four
already there, alongside anything a player has since added.

### Architecture: four systems, no direct dependencies between them

"Body Models define the player's structure. Appearance defines colours
and textures. Outfits define clothing and wearable assets. Animations
define movement and expression. These systems should work together
without depending directly on one another." Concretely: `BodyModels.js`
has never imported `PlayerAnimationSystem.js`; `AnimationLibraryStore`
has never imported `BodyModels.js`; every one of these only ever talks to
the others through a plain, narrow interface (pivot names, a body model
id, a clip id) rather than reaching into each other's internals. A future
body model, wearable system, or animation improvement is additive —
exactly what let this entire phase arrive without a single existing file
needing a structural rewrite, only extensions to what was already there.

### Movement Follow-up: touch controls, Animation Editor stabilisation, and getting unstuck

A dedicated follow-up pass, before moving on to Navigation & Environment —
see docs/ROADMAP.md's Phase 18 entry for the full account.

**Touch controls now cover every new movement mechanic**, with exactly
two new buttons, not five. Running comes from *how far* the joystick is
pushed (`isHeld("run")` reads the joystick's own magnitude once it's
active — see InputManager.js), not a separate control; ladder climbing
already worked with zero changes at all, since it reads the same
forward/back joystick input ordinary ground movement always has
(`input.moveVector.y`). Only jump (a one-shot tap, the same pattern the
existing interact prompt already uses) and crouch (a held toggle, since
there's no natural drag gesture for it the way running already has one)
needed actual new buttons — positioned opposite the joystick, same glass/
wood styling, same reveal-on-first-touch behaviour as everything else in
`css/touch.css`. Desktop controls (Shift/C/Space) are completely
unchanged.

**Three real bugs in the Animation Editor, found and fixed, not
suppressed:**

- **"this._mountedDispose is not a function," on switching tabs or
  leaving the computer.** The Animation Editor's own `mount()` was
  declared `async`, which meant calling it returned a *Promise* rather
  than the disposer function `WorkstationPanel` expects synchronously
  (`this._mountedDispose = app.mount(...) ?? null` — a Promise is
  truthy, so `?? null` never caught it). Every other app in the Workshop
  handles its own async work (loading textures, building a preview
  rig) *inside* an ordinary, synchronous `mount()` — calling an async
  helper without awaiting it, the same "fire and forget, update the
  preview whenever it actually finishes" pattern `WardrobeApp.js`
  already established. The fix was making `mount()` match that pattern
  exactly, not adding error handling to paper over the crash. Leaving the
  computer failing the same way makes sense in hindsight too: the
  exception thrown by calling a Promise as a function interrupted
  whatever cleanup code was supposed to run immediately after it,
  including restoring normal player control — one root cause explained
  both reported symptoms.
- **The preview model disappearing during playback.** The playback
  loop's very first `tick()` call passed no timestamp at all (calling it
  directly rather than through `requestAnimationFrame`), making the
  first frame's `dt` computation `undefined - undefined` — a genuine
  `NaN`. That `NaN` then never recovers through ordinary arithmetic: it
  poisoned `playbackT`, then the blend parameter, then every interpolated
  rotation, silently, forever, until playback was stopped and restarted.
  Applying `NaN` rotations to a rig's pivots corrupts its entire
  transform hierarchy below whichever pivot receives them, which WebGL
  then simply fails to draw — not a rendering bug, a numeric one with a
  rendering symptom. Fixed by starting playback through
  `requestAnimationFrame` like every other animation loop in this
  project already does, guaranteeing `tick()`'s first call always
  receives a real timestamp.

**A quality-of-life "I'm Lost!" button** (`CameraSystem.recoverToSpawn()`,
in the HUD's own backup controls) resets every piece of position state
this system owns — not just position/yaw/pitch, but `_footY`/
`_verticalVelocity`/`_grounded` too, so the very next frame's gravity
doesn't immediately act on stale values left over from wherever the
player used to be. Cancels focus mode outright rather than trying to
ease out of it — being lost is exactly the situation where a
guaranteed-safe reset matters more than a smooth transition.

### Builder & Workshop Living Follow-up

Another dedicated bug-fixing pass — see docs/ROADMAP.md's Phase 19 entry
for the full account, and docs/WORLDBUILDER.md/docs/WORLD.md for the
Builder- and Environment-side fixes from the same phase.

**Player Height, actually fixed at the root.** "Adjusting player height
currently pushes the player into the floor" traced to `CameraSystem`
treating eye height as a fixed 1.65m constant, while
`PlayerCharacterSystem` positions the rig using its *own* computed
`eyeHeight` — which genuinely changes with a character's actual
proportions. A taller character's rig had a taller `eyeHeight` than the
camera assumed, so `root.position.y = cam.position.y - rig.eyeHeight`
placed the rig's own feet below `_footY` — pushed into the floor by
exactly the difference between the fixed assumption and reality.
`PlayerCharacterSystem.getEyeHeight()` now exposes the rig's actual
current value, and `CameraSystem._getStandingEyeHeight()` reads it fresh
every frame as the target the existing crouch-damping logic already eases
toward — "the camera height should recalculate appropriately" needed no
new easing mechanism, only a dynamic target for the one already there.
Wired through a `setCharacterSystem()` setter called from main.js, not a
direct import in either direction — `PlayerCharacterSystem` already
imports `CameraSystem` to follow its position, so the reverse import
would create a genuine circular dependency between the two files, the
same avoidance `PlayerAnimationSystem`'s own constructor-injected
reference already established.

**A related bug this fix could otherwise have introduced, and didn't**:
the Wardrobe's own proportion sliders (0.4x-2x per body part) can combine
to produce a rig eye height around 3.76m at their extremes — comfortably
above the workshop's 3m ceiling. Fixing "a taller character's feet end up
below the floor" without also bounding the eye height itself would simply
trade it for "a very tall character's camera clips through the ceiling
instead." `MAX_STANDING_EYE_HEIGHT` (2.0m) clamps the camera's own eye
height without touching the rig's actual build height at all — the
character still builds exactly as tall as requested, only the camera
following it has a ceiling of its own.

**The mirror's left-right flip, actually understood, not guessed at.**
"Still appears horizontally incorrect" — the mirror's own camera builds
its orientation with `lookAt()` (a deliberate choice from the earlier
Mirror Refinement pass, to sidestep a real winding/handedness risk a
truly reflected transform has), which always produces a normal,
unflipped camera basis. That means the raw render was "how a camera
facing the player sees them" — the same left-right sense as a video
call — not "how a real mirror shows them," which preserves the viewer's
own left-right orientation instead. The fix is a horizontal flip of the
render target's own texture (`repeat.x = -1`, `offset.x = 1`, with
`RepeatWrapping` so the flip samples correctly), applied once where the
surface is registered, rather than fighting the camera's own orientation
math — the fixed-viewpoint approach from the earlier refinement pass
stays exactly as it was.

**The Emote Wheel gained a touch button**, matching the Build Mode and
Third Person View buttons' own design philosophy exactly — the same
corner-controls row (`.hud-corner-controls` as of the Workshop Workflow
phase's own rename — see `docs/HISTORY.md`'s Phase 13b account for why),
same styling, calling `EmoteWheelSystem.toggle()`. Nothing new needed
for the reveal/hide mechanics touch already relies on; a plain HTML
button already responds to a tap the same way it responds to a click.

**The "intermittent beeping," investigated to an actual root cause.**
Traced to `AudioSynth.js`'s cricket ambience: a single, isolated
square-wave pulse through a narrow bandpass filter, repeated every
0.4-0.7 seconds through the night, is close to the same synthesis an
electronic chirp alarm uses. It was intentional — meant to be a cricket
sound — but didn't achieve its own intent; a real cricket chirps in a
rapid trill of several pulses in quick succession, not one isolated tone.
Redesigned as a short burst of 3-5 quick sub-pulses through a softer
triangle wave and a wider filter, which reads as insect texture rather
than a repeated electronic tone. It was already configurable, as it
happens — the existing Settings → Audio → Ambient Volume slider already
scales the entire nature-ambience layer (`AudioSystem._updateNatureIntensity()`),
crickets included; no separate toggle was added on top of it.

**Jumping, silently cancelling itself on every single attempt — found
and fixed (Visual Identity phase).** Reported simply as "jumping has
stopped functioning correctly," introduced sometime during the terrain
work. The actual cause lived in `_updateGroundMovement()`'s own
slope-following logic — the branch added specifically so "walking down
gentle slopes or edited terrain should not enter a falling state,"
guarded by `wasGrounded && belowGround <= STEP_TOLERANCE`.
`wasGrounded` is captured at the very top of the function, *before* the
jump-input check below it runs; on the exact frame a jump starts, that
check sets `this._grounded = false`, but `wasGrounded` — one line
earlier — still holds the pre-jump `true`. A single frame's worth of
jump rise (a few centimetres, from `JUMP_VELOCITY * dt`) is always far
smaller than `STEP_TOLERANCE` (0.6m), so this branch fired on every
jump's very first frame, without exception: foot snapped straight back
to the ground, velocity zeroed, `_grounded` forced back to `true` —
all before that frame ever rendered. The jump was cancelled by the same
code that exists to make walking downhill feel smooth, one frame after
it started, every time. The branch's own comment already described the
*intended* behaviour correctly ("a jump already in progress" should
skip it) — the fix is using `this._grounded` (the current, already-
updated value) instead of `wasGrounded` (which only catches up one
frame later) in that one condition. Ordinary walking is provably
unaffected: nothing between the `wasGrounded` capture and that
condition ever changes `this._grounded` except the jump check itself,
so the two values are identical on every frame that isn't a jump's own
first one.

## Known limitations

- **"Never see themselves" in first person is mostly physics, with one
  deliberate exception.** The camera sits almost exactly where the head
  mesh is, so — thanks to ordinary backface culling — the torso/arms/legs
  effectively become invisible to it from the inside, and looking down
  shows them normally, the same as any first-person game. The head itself
  is no longer relying on that same coincidence — see "Crouching: the
  camera moved, but so, deliberately, does the head" below for why a real
  visibility rule was needed there specifically.
- **The torso's own first-person invisibility while crouched is still
  the backface-culling coincidence, not a rule** — and, as of Version 4
  Phase 4, genuinely confirmed against a real rendered frame, not just
  computed: a pixel-readback with the torso swapped to a saturated debug
  material found zero matching pixels from the crouched first-person eye
  position, validated against two controls that correctly did show it.
  Still a coincidence relying on the camera sitting inside the mesh
  volume, not an explicit visibility rule the way the head's own
  `FIRST_PERSON_HIDDEN_LAYER` is — a body proportion extreme enough to
  put the crouched eye height outside the torso mesh's own bounds
  (unlikely for anything the Wardrobe's own sliders can currently
  produce, but not structurally impossible) would still show it. Worth
  re-checking if the Wardrobe's own proportion ranges ever widen.
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
- **Ground-height detection is a heightmap query, not real 3D collision**
  — see "Movement & Expression" above. A player can't land on the
  underside of an overhang, and very thin or steeply angled Builder
  geometry may not read as standable the way a flat platform does.
- **A ladder's climbable zone is its own bounding box** — a ladder built
  at an angle, or one that isn't roughly vertical, will still produce a
  box-shaped zone rather than one that follows its actual rungs.
- **Animation interpolation is linear per-axis Euler, not quaternion
  slerp** — see "The Animation System" above for the reasoning; it holds
  up for ordinary locomotion and gestures, but a pose with a very large
  rotation on more than one axis at once can occasionally interpolate
  through an unexpected intermediate angle, the well-known trade-off of
  Euler-angle interpolation in general.
- **The standing eye height clamp (2.0m) trades one edge case for a
  smaller one** — see "Player Height" above. A character built at the
  most extreme possible proportion-slider settings (every slider at its
  own maximum) still ends up with its feet very slightly below the floor,
  since the clamp bounds the camera's own eye height without changing how
  tall the rig itself actually builds. Deliberate: the alternative was a
  camera clipping visibly through the ceiling instead, which reads as a
  much larger problem for a much more common range of settings.
