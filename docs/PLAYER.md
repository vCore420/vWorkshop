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
- **Mirrors / reflections** — anything that needs to see the character
  from outside (a mirror, a future third-person camera) can read
  `PlayerCharacterSystem`'s live rig directly; nothing about it assumes
  first-person is the only way it's ever viewed.
- **Animation** — rotating any pivot in the hierarchy already affects
  everything below it correctly, because the hierarchy is real, not
  simulated with independently-positioned meshes.
- **Third-person cameras** — the rig doesn't hide itself from any
  particular camera; first-person "not normally seeing yourself" falls out
  of where the camera happens to sit relative to the geometry (see "Known
  limitations"), not from any explicit visibility rule that would need
  removing later.

## Known limitations

- **"Never see themselves" is physics, not a rule.** The camera sits
  almost exactly where the head mesh is, so — thanks to ordinary backface
  culling — the head effectively becomes invisible to it from the inside,
  and looking down shows the torso/legs/feet normally, the same as any
  first-person game. There's no deliberate visibility toggle hiding the
  mesh from its own camera; if a future camera ever sits somewhere that
  makes this look wrong (very extreme pitch angles, say), that's the first
  place to look.
- **Symmetric limbs only** — see "The rig" above. Editing an arm or leg
  shape affects both sides identically; there's no independent left/right
  control.
- **No embedded metadata beyond the canvas itself** — an imported image is
  resampled down to the same 64×64 working canvas every other texture
  uses; very fine detail in a large imported image won't survive that.
- **The paint tool is deliberately simple** — one brush size, flat fill,
  no layers or undo. It's a wardrobe, not an image editor.
