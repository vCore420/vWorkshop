# The workbench

Like the computer, the workbench is **one self-contained object**. Unlike
the computer, most of what it does has nothing to do with an interface at
all — the important part is visible from across the room, before anyone
interacts with anything.

If you only read one thing: a project carries a `kind` and a `presence` —
plain metadata (see `ProjectsStore.js`) — and `src/workbench/` is the only
code that turns that metadata into physical objects on the bench. Nothing
about a "blueprint" or a "prototype" is hardcoded into the bench itself;
`WorkbenchSystem` just asks a registry to build whatever the current
project's `presence` array describes.

## Files

```
src/entities/furniture/Workbench.js      geometry (vice, tray, lamp, clipboard) + interaction config
src/data/ProjectsStore.js                 projects now carry kind + presence metadata
src/workbench/
  WorkbenchSystem.js                      the Engine system — current project, transitions, panel
  WorkbenchPanel.js                        the small clipboard-sized DOM panel
  slots.js                                 named positions on the bench surface + slot assignment
  kindTemplates.js                         kind -> default presence recipe, for new projects
  presence/
    registry.js                            type -> builder map, mirrors entities/furniture/registry.js
    builders/
      BlueprintPresence.js, NotebookPresence.js, MeasuringToolsPresence.js,
      ReferenceBooksPresence.js, MaterialSamplePresence.js, SketchPresence.js,
      PrototypePresence.js, ProjectBoxPresence.js, PaperworkPresence.js
```

## The core idea: presence is metadata, not a scene

A project looks like this (see `ProjectsStore.js`):

```js
{
  id, title, status, notes, updatedAt,
  kind: "woodworking",       // picks a default presence the first time it needs one
  presence: [                 // the actual physical description, once resolved
    { type: "blueprint", variant: "unfolded" },
    { type: "materialSample", variant: "wood" },
    { type: "measuringTools" },
    { type: "sketch" },
  ],
}
```

`presence` is resolved once — `WorkbenchSystem._resolvePresenceArray()` — and
then written back onto the project itself via `projectsStore.update()`, so
it becomes real, persisted, editable-in-the-future metadata rather than a
value re-derived from `kind` every time. A project can skip `kind`
templates entirely and hand-author its own `presence` array from the start;
the bench doesn't know or care which happened.

Turning that array into actual geometry is two decoupled steps:

1. **`presence/registry.js`** maps each item's `type` string to a builder —
   `(item) => { object3D, size }`. Nine builders exist today, matching the
   brief's own list (rolled/unfolded blueprints, notebooks, measuring
   tools, reference books, material samples, sketches, prototypes, project
   boxes, paperwork). A tenth is a new file in `presence/builders/` plus one
   line in the registry (or a plugin calling `registerPresenceType()` —
   see `docs/PLUGIN_GUIDE.md`). **Nothing about `WorkbenchSystem` or
   `slots.js` needs to change** for a new presence type to exist.
2. **`slots.js`** assigns each built item to one of six named positions on
   the bench surface, matched by size (`small`/`medium`/`large`) with
   graceful fallback if a category is full. Slots are hand-placed to avoid
   the bench's permanent fixtures (vice, tray, lamp, clipboard) and the
   standalone notebook prop nearby — see the comment at the top of
   `slots.js` for the actual coordinates and why.

## Why the bench doesn't "launch" anything

Walking up and pressing interact does two independent things, and neither
of them is "open an app":

- `CameraSystem` eases into a closer, lower focus pose — leaning over your
  work, not sitting down (contrast with the computer, which is a full
  seated pose). This reuses the exact same generic mechanism the computer
  and every focus-pose furniture piece already use; nothing new was added
  to `CameraSystem` or `InteractionSystem` for this.
- A small panel fades in, anchored to the clipboard prop's actual projected
  position (`ScreenProjector.js` — see below). It holds exactly one
  project's title, notes, a kind tag, and two buttons: finish, or start
  something new. If more than one project happens to be active, a compact
  switch list appears; otherwise it doesn't.

There is deliberately no icon rail, no tabs, no vignette dimming the room.
Leaning over the bench should feel like glancing at your own notes, not
entering a mode — the room stays exactly as present as it always is.

### The panel, mechanically

`src/utils/ScreenProjector.js` (shared with the computer — see
`docs/COMPUTER.md`) was generalized to support two kinds of anchor
rectangle: face-on (a monitor you look at) and top-down
(`makeTopDownRectCorners` — a clipboard lying flat that you look down at).
The workbench panel uses the top-down variant, sized to the clipboard's own
small dimensions, so it never has room to become "another application
window" even if someone tried to add more to it later.

## The presence *is* the interface, most of the time

This is the part that matters more than the panel: `WorkbenchSystem`
rebuilds the bench's physical arrangement — via `presenceAnchor`, an empty
group `Workbench.js` exposes for exactly this — every time the current
project changes, and that arrangement is visible and lit like any other
object in the room, all the time, whether or not anyone is standing nearby.
Glancing at the bench from across the room *is* the interaction the brief
asked for; interacting with it is just how you go a level deeper.

### Transitions ("packing away" and "growing in")

Switching projects — by finishing one, starting a new one, or picking a
different active project from the panel's switch list — never swaps
geometry instantly. `_rebuildPresence()`:

1. Scales every current presence item down to ~0 over `OUT_DURATION`
   (0.32s), removing each as its own shrink finishes.
2. After a short delay, builds the new project's items at zero scale and
   grows them in over `IN_DURATION` (0.45s).

These are pure `THREE.Object3D` scale tweens, not material opacity fades —
deliberately. Presence builders reuse `PlaceholderFactory`'s cached
materials (the same `Materials.wood("#...")` instance backs *every* wood
surface in the whole room with that colour), so animating a material's
opacity directly would fade unrelated objects across the workshop too.
Scale has no such side effect, which is why every transition in this module
is scale-based.

### Dust (Version 3, Phase 6)

"As time goes on, the things on the workbench move/change" — the
Workshop's own continuity brief (`docs/ROADMAP_V3.md`'s Phase 6),
answered without any new persisted state: `ProjectsStore` was already
stamping `updatedAt` on every edit. `WorkbenchSystem._isStale(project)`
compares that against `Date.now()`; once a project has genuinely sat
untouched past `DUST_THRESHOLD_DAYS` (14), `_applyDust()` desaturates
and flattens every presence item's own materials the next time
`_rebuildPresence()` runs — a project worked on last week still looks
exactly as it always did, only one truly neglected shows it.

**Cloned, never mutated in place.** Every presence builder reuses
`PlaceholderFactory`'s shared, colour-keyed material cache (see
"Transitions" above) — tinting one of those directly would dull every
other object in the room using that same cached instance, not just this
one project's own presence. `_applyDust()` clones each mesh's own
material first, exactly the same reasoning the Builder's own part
-highlighting and Build Mode's own ghost preview already follow for the
identical shared-cache hazard.

**Recomputed fresh, never sticky.** There's no "dusty" flag stored
anywhere — `_isStale()` re-reads `updatedAt` every time presence is
rebuilt (a project switch, or the next session), so returning to a
project and genuinely working on it again means the *next* rebuild
simply doesn't apply dust, with nothing to explicitly clear. Staleness
is captured *before* `_resolvePresenceArray()` runs specifically because
resolving a brand-new project's presence template for the first time
writes back to the store (bumping `updatedAt` itself) — checking after
would erase the very signal this exists to show, right as a
long-neglected project first becomes current again.

## "Finished work leaves behind history, not nothing"

Marking a project finished (`finishCurrentProject()`) sets its status to
`"done"` in `ProjectsStore` — the exact same store the pinboard and the
computer's Projects app already read — and packs its presence away from the
bench. It does not need its own "archive" visual: the shelving unit's
existing archive overlay (phase 1, untouched in this pass) already lists
every `status === "done"` project. A finished project's story doesn't
disappear; it just moves from "on the bench" to "in the archive", using
infrastructure that already existed.

## Persistence, and "waking from sleep" for a physical object

`WorkbenchSystem` persists exactly one thing itself: `{ currentProjectId }`.
Everything else — a project's title, notes, `kind`, and resolved
`presence` array — already flows through `ProjectsStore`'s existing
persistence. Reopening the workshop rebuilds the bench (instantly, no
transition — see `finalizeInitialState()`) from whichever project was
current, with its presence exactly as it was: nothing about "the bench
remembers where you left it" needed new persistence machinery, because the
metadata driving the bench's appearance was already durable data.

### Why `finalizeInitialState()` is a separate step

`WorkbenchSystem.init()` cannot safely decide "what's on the bench right
now" — at that point in the boot sequence, a save file may not have been
applied to `ProjectsStore` yet (loading happens synchronously inside the
`engine:ready` event, which fires *after* every system's `init()` has
already run). `main.js` calls `workbenchSystem.finalizeInitialState()`
explicitly, once, right after `await engine.init()` resolves — by which
point loading (if there was anything to load) has already finished. See
the comment on that call in `main.js` and on the method itself.

That method also seeds a single starter project ("Getting this workshop
running") the very first time the workshop has no projects at all, so the
bench never looks accidentally empty on a first visit — it looks lived-in
immediately, the same way the rest of phase 1's room avoided empty
placeholders wherever a believable default was cheap to provide.

## Craftsmanship (Version 2, Phase 15)

"The Workbench is the heart of the Workshop... it should become the
Workshop's hero prop... refine, do not redesign." Every permanent
fixture kept its exact position and purpose from before this phase —
this section is entirely about *how* those same fixtures are built, not
what they are or where they sit.

**A genuinely higher-detail wood grain, on exactly one surface.**
`Materials.wood()`'s own shared, cached texture (256px canvas, 40 grain
lines) is tuned to look right on everything from a chair leg to a wall
panel — reasonable for most wood in the Workshop, but the bench's own
top is the one surface a player leans directly over and looks straight
down at for as long as they're at the bench at all. `woodGrainTexture()`
gained optional `size`/`grainLines`/`step` parameters (defaulting to the
original values — every other wood object in the Workshop is
byte-for-byte unaffected) so `Workbench.js` could ask for a genuinely
richer one (512px, 70 lines) for its own top specifically, cached once
at module scope rather than sharing `Materials.wood()`'s own cache keyed
only by colour. Deliberately *not* achieved by increasing the texture's
own `.repeat` — the grain lines' sine wave doesn't complete a whole
number of cycles across the canvas, so tiling it at anything other than
1× tends to show a visible seam at the wrap; more baked-in detail avoids
that risk entirely rather than fighting it.

**Two real material gaps filled**, not just applied here — `Materials
.plastic()` and `Materials.rubber()` join `wood()`/`metal()`/`fabric()`/
`matte()` in `PlaceholderFactory.js` itself, reusable by any future
furniture, not a one-off. Genuinely different surface behaviour from
`matte()`, not just a new name: plastic reads smoother and a touch
glossy (lower roughness, no metalness); rubber reads soft and completely
non-reflective (roughness pushed close to 1). Applied wherever the
Workbench already had something that was always plastic or rubber in
real life but had been sharing `matte()`'s own numbers regardless — the
fan's base/housing/blades (plastic), the clipboard's own board
(plastic), and the standalone Notebook's own elastic closure band
(rubber; its cloth cover became genuine `fabric()` at the same time).

**A stretcher between the legs.** Four independent posts with nothing
low down connecting them never quite read as one solid, load-bearing
piece of furniture — a real workbench built to take real force almost
always has one. Two rails, spanning the long axis on each side, sized to
genuinely reach and overlap the legs rather than floating with a gap
between them.

**A crank on the vice.** Two abstract metal boxes read as "a vice" only
abstractly; a small T-shaped crank on the screw side is the one addition
that makes it unmistakable, without changing its footprint, position, or
the rest of its geometry at all.

**One small, deliberately restrained sign of daily use.** A single
pencil, resting across the clipboard — not a cup of them, not a scatter
of other stationery, which would read as staged clutter rather than a
genuine, momentary pause in someone's work. "Without introducing
unnecessary clutter" was taken as seriously as "the story of someone who
creates things every day" was.

**A real, if small, geometric bug found and fixed.** The clipboard
assembly (board, clip, page) sat at a Z position that put its own front
edge 7cm past the bench's actual front edge — quietly overhanging thin
air the entire time. Pulled back as one unit (every part keeping its
exact relative offset to the others, so `WorkbenchSystem`'s own panel
projection — which only ever reads `clipboardMesh`'s current world
transform fresh each frame, never a remembered position — needed no
changes at all) to sit fully on the surface.

**The Workshop's first interaction sound effect.** A soft, brief paper
shuffle (`AudioSynth.playPaperShuffle()` — filtered noise through a
bandpass filter and a fast decay, not a sample that doesn't exist) plays
on leaning in and on standing back up, at two slightly different
pitches so the same sound reads as two distinct moments rather than one
repeated one. Routed through `AudioSystem.playInteractionSound()` — one
small, reusable entry point (`kind`, not a dedicated method per sound)
so a future door or drawer reaches for the same method rather than
building its own audio graph. **A real dead setting fixed along the
way**: Settings' own "Effects Volume" slider had existed since early in
Version 2 with nothing in the entire Workshop for it to actually
control — every door, drawer, and switch stayed silent. It now
genuinely scales this sound, and any future one.

**Lighting response, verified rather than changed.** Every material on
the bench already used `MeshStandardMaterial`/PBR properties, which
already respond correctly to the Workshop's own lighting — the lamp's
real `PointLight`, the sun/moon's changing colour and angle across the
day/night cycle, indoor artificial light. Reviewed specifically for this
phase and found already correct by construction; nothing needed
changing here beyond the general roughness/metalness accuracy the new
plastic/rubber materials already bring.

**Interaction pose left alone.** The existing lean-in camera position
and look-at point were reviewed against the clipboard's own corrected
position and found to already read naturally — if anything, slightly
better aligned than before, since the clipboard moved closer to the
existing look-at point rather than further from it. No change was the
right call here; "existing functionality should continue working
naturally" is exactly what happened.

**A second dead-code finding, in the same file the new materials live
in.** `Materials.ground()` and its own `groundTexture()` — the flat,
speckled ground `WorldEnvironmentSystem.js` used to draw before the
Workshop Reliability phase's terrain migration replaced it with
`TerrainSystem.js`'s own single ground mesh — had no callers left at
all, silently orphaned since that phase. Found while reviewing
`PlaceholderFactory.js` for this one (every furniture builder's shared
home, including `Workbench.js`'s own new `plastic()`/`rubber()`), and
removed cleanly rather than left to linger a second time.

**Future craftsmanship philosophy.** This phase's own restraint is
itself the template for whichever object gets this treatment next: keep
position and purpose fixed, spend the entire budget on how convincingly
each one is built, add at most one or two small storytelling details per
pass (never a scattershot of them), and treat "I found a real geometric
or material bug while I was in here anyway" as worth fixing on the spot
rather than filing away for later. A hero prop earns this kind of
attention by being where a player's eyes actually go first; the Computer
and any future object that becomes equally central deserves the exact
same pass eventually, not a lesser one.



- **One project on the bench at a time.** Multiple projects can be
  `"active"` at once (tracked in `ProjectsStore`), but only one physically
  occupies the bench — this was a deliberate reading of "the workbench
  should represent my current creative focus", singular. The panel's
  switch list is the seam for moving between them.
- **Six fixed slots, size-categorized.** Not a general bin-packing layout —
  a project with more presence items than fit gets the overflow quietly
  dropped (with a console warning), rather than the bench becoming
  overcrowded. Six was chosen to comfortably fit the existing kind
  templates without crowding the vice/tray/lamp/clipboard.
- **No slot collision detection against the standalone notebook prop.**
  `slots.js`'s coordinates were chosen by hand to clear it (see its
  comment for the reasoning), not verified against real rendered geometry.
- **Presence items don't cast/receive shadows specially** — they inherit
  whatever `PlaceholderFactory.box()`/`cylinder()` set by default, same as
  every other placeholder mesh in the room.
- **The dust threshold is a fixed constant, not configurable** —
  `DUST_THRESHOLD_DAYS` (14) applies uniformly to every project and every
  presence type; there's no per-project or per-kind override.
