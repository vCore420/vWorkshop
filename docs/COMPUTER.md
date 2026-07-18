# The computer

The computer is deliberately built as **one self-contained object** inside
the workshop, not a feature bolted across several files. This document
explains how it works and why, so future work on it (or on the rest of the
room) doesn't have to re-derive these decisions.

If you only read one thing: `src/entities/furniture/ComputerDesk.js` builds
geometry and emits two events, `computer:activate` and
`computer:deactivate`. Everything else — the screen turning on, the panel
appearing, which app is open, the lights — lives in `src/computer/` and
reacts to those two events. You could delete `src/computer/` entirely and
the desk would still exist, just inert.

## Files

```
src/entities/furniture/ComputerDesk.js   geometry + the desk's own interaction config
src/utils/ScreenProjector.js             shared with the workbench — projects an object's local
                                          rectangle into a viewport rectangle (see below)
src/computer/
  ComputerSystem.js                       the Engine system — power state, lights, orchestration
  WorkstationPanel.js                     the DOM shell (icon rail + content area)
  apps/
    registry.js                           factory list, mirrors entities/furniture/registry.js
    ProjectsApp.js, JournalApp.js, BrowserApp.js, AIApp.js, MediaApp.js, SettingsApp.js
```

## The transition, mechanically

1. Player walks up to the desk, presses interact. `ComputerDesk`'s
   `onInteract` emits `computer:activate`. This is a completely ordinary use
   of `InteractableComponent` — the only thing unusual about the desk is
   that it doesn't use `overlayId` (see `docs/ARCHITECTURE.md`'s
   description of the two ways a furniture piece can wire up its
   interaction).
2. Because the desk still has a `focusPoseLocal`, `InteractionSystem` still
   eases `CameraSystem` into a seated pose and locks movement, exactly like
   any other focus-pose interaction. The computer doesn't need its own
   camera code for this.
3. `ComputerSystem.activate()` runs: opens `WorkstationPanel` (mounting the
   last-active app into hidden, non-interactive DOM) and releases the mouse
   cursor from pointer-lock so it can click around the panel.
4. Every frame, `ComputerSystem.update(dt)` advances a single `progress`
   value (0 → 1, exponentially damped — see the constant
   `TRANSITION_SMOOTHING`) and drives everything from it:
   - the screen mesh's `emissiveIntensity` (standby glow → full brightness)
   - the screen's own `PointLight` intensity
   - `#computer-vignette`'s opacity — a full-viewport `backdrop-filter`
     blur/dim that sits behind the panel and in front of the 3D canvas.
     **The canvas keeps rendering, always** — this is a soft focus effect,
     not a hidden world. That's the literal implementation of "the room
     should continue existing."
   - the workstation panel's own opacity, but only above `progress > 0.35`
     (see "Why the panel waits" below)
5. Standing up (Escape, or walking away — `InteractionSystem.exitActive()`)
   reverses all of it: `computer:deactivate` fires, `ComputerSystem`
   flips its target to 0, the camera eases back to standing, pointer lock
   re-engages, and once `progress` reaches ~0 the panel unmounts its app.

## Why the panel lives on the monitor, not the whole screen

`WorkstationPanel`'s root element is `position: fixed`, but its
`left`/`top`/`width`/`height` are computed every frame by
`ScreenProjector.projectRect()`: it takes the screen mesh's four
front-face corners in 3D (via `makeRectCorners()`), projects them through
the *actual* camera (`Vector3.project(camera)`), and returns the bounding
rectangle in CSS pixels. The panel is styled and positioned as "whatever
rectangle the monitor currently occupies on your screen" — not a modal that
happens to look monitor-ish. The workbench's clipboard panel
(`src/workbench/`) uses the exact same shared utility, at a much smaller
scale — see `docs/WORKBENCH.md`.

This is an **axis-aligned approximation**, not a true perspective-correct
quad (that would need a 3D CSS transform, or a second renderer like
`THREE.CSS3DRenderer`). It's a deliberate simplification:

### Why the panel waits (and why the approximation is fine)

The panel's opacity only starts rising once `progress > 0.35`, and by
design the camera's focus-pose easing (`CameraSystem`, ~0.6s) finishes
around the same time the power-on progress does. In practice, by the time
the panel is visible at all, the camera is already nearly head-on to the
screen — exactly where an axis-aligned bounding rectangle and a true
perspective-correct quad look almost identical. The mismatch would only be
visible early in the transition, while looking at the screen from an
oblique angle — which is precisely when the panel is still invisible.

If a future pass wants the panel visible from a sharp angle (e.g. while
still walking toward the desk), swap `src/utils/ScreenProjector.js` for a
`CSS3DRenderer`-based approach — `WorkstationPanel` and `ComputerSystem`
would only need their positioning call swapped, not their structure.

## Ownership: lights, apps, and events

- **Lights.** `ComputerSystem` creates and owns two `THREE.PointLight`s: one
  parented to the screen mesh (its intensity animates with `progress`) and
  one parented to the desk group at `deskLampSocket` (constant intensity —
  a desk lamp that's simply always on, the thing that makes the desk look
  inviting even from across the room, day or night). Neither is touched by
  `LightingSystem`, which only owns the room's general-purpose fixtures
  (ceiling pendants, the workbench lamp). This split is what makes the
  computer's atmosphere self-contained.
- **Apps.** `src/computer/apps/registry.js` mirrors
  `src/entities/furniture/registry.js`'s pattern exactly: a list of
  factories, each `(deps) => { id, label, glyph, mount(container, ctx) }`,
  plus `registerAppFactory()` for a plugin to add its own tab. See
  `docs/PLUGIN_GUIDE.md`.
- **Events.** The entire public surface between the computer and the rest
  of the workshop is: `computer:activate`, `computer:deactivate`, and
  (internal to the panel/system pair) `computer:appChanged`. Everything else
  — `ProjectsApp` reusing `ProjectsStore`, `MediaApp` reflecting
  `AudioSystem`, `SettingsApp` touching `LightingSystem`/`TimeOfDaySystem`
  — goes through the same shared stores/systems every other object in the
  room already uses. The computer doesn't duplicate state; it's a new
  *view* onto state that already existed.

## Persistence

`ComputerSystem` itself persists exactly one thing:
`{ lastAppId }` — which tab was open. That's what makes returning to the
computer feel like waking it from sleep rather than a fresh launch: you're
looking at the same app you left, and that app's own content (a project
list, journal text) was already persisted independently by
`ProjectsStore`/`NotesStore`, so there's nothing to "restore" — it was never
gone.

Deliberately not persisted: whether the computer was "on". Reloading the
page always starts with the computer off and the player standing — you
weren't literally sitting there when you reopened the browser tab.

## Craftsmanship (Version 2, Phase 16)

"The Desk should feel comfortable. Purposeful. Lived in... refine, do
not redesign." Every permanent fixture below kept its exact position
and purpose from before this phase — the same desk, the same monitor,
the same chair, at the same footprint and height, in the same spot in
the room. What changed is craftsmanship, following the Workbench
phase's own template almost exactly.

**A genuinely higher-detail wood grain on the desk's own top.**
`ComputerDesk.js` gained a `deskTopMaterial()` following the identical
pattern `Workbench.js`'s own `benchTopMaterial()` established last
phase: the same `woodGrainTexture()` optional `size`/`grainLines`/
`step` parameters, a different tuning (512px, 60 lines), cached once at
module scope. Every other wood surface in the Workshop — including the
bench's own top, on its own separate cache — is completely unaffected.

**The monitor finally reads as a monitor.** A real bezel
(`Materials.plastic()`, dark) now sits just behind the glass, larger on
every side so it reads as a frame rather than a flat glowing rectangle,
plus a small hinge block where the stand's neck meets it. The glass
itself — the actual `screenGlowMesh` `ComputerSystem.js` attaches its
light to and hardcodes a projection rectangle for — kept its exact
original size and local position throughout; the bezel sits *behind*
it as a second, independent mesh, so nothing about `ComputerSystem
._screenCorners` needed to change.

**Real material gaps filled, the same finding the Workbench phase made
about its own fixtures.** The monitor stand, the keyboard, the mouse,
and the lamp shade were all sharing `matte()`'s own numbers for
surfaces that are always moulded plastic in real life — all four are
genuinely `Materials.plastic()` now. A new rubber mousepad sits under
the mouse, which is lifted by exactly the pad's own thickness to rest
on top of it rather than inside it.

**Two real structural additions to the desk itself.** Two metal
stretcher rails, spanning the desk's long axis on each side (the exact
same "four independent legs never quite read as one solid piece of
furniture" finding the Workbench phase made about its own legs,
reoriented to this desk's own proportions rather than copied at the
bench's own numbers) — and, on the chair, a genuine five-point swivel
base with castors in place of a single flat disc, the chair's own
equivalent of the Workbench vice's crank: the one addition that makes
it read unmistakably as "an office chair" rather than "a stool on a
pole." A mechanism plate between the post and the seat, armrests, a
slightly thicker seat cushion, and a few degrees of recline on the
backrest round out the chair — every one of these sits directly above
the same floor space the old parts already occupied.

**One small, deliberately restrained environmental-storytelling
addition.** A small pen holder with two pens, in the desk's back-left
corner — specifically chosen to balance the lamp's own back-right
corner, "better visual balance" made concrete, and the desk's entire
storytelling addition this phase, the same restraint the Workbench
phase held its own single pencil to.

**Version 3, Phase 2 ("Living Spaces") — one more small addition, one
phase later.** A monitor, a lamp, and an implied computer sat on this
desk for two full versions with nothing ever visibly plugged into
anything — named directly in the Furniture & Storage phase's own
retrospective ("the music cabinet's own cabling... the next unglamorous
detail worth attention") and never picked up until now. One cable, not
several — the same restraint the pen holder above already sets — from
behind the monitor stand, along the desk's own back edge, down beside
the back-left leg to the floor. Routed specifically to clear the desk's
own stretcher rail, which shares the exact z-coordinate as the back
legs (see the leg/stretcher loops just above in `ComputerDesk.js`) —
confirmed by checking real mesh bounding boxes for overlap, not assumed
clear, after a first draft ran the cable straight through it.

**The Workshop's second interaction sound effect.** A soft chair creak
on sitting down and standing back up — `AudioSynth.playChairCreak()`, a
narrower, sweeping bandpass filter on the same noise-burst technique
`playPaperShuffle()` already established, not a recorded sample.
Routed through the same `AudioSystem.playInteractionSound()` entry
point the Workbench phase built for exactly this kind of reuse —
`kind: "chairCreak"` joins `"paperShuffle"` rather than a second
method. Keyboard and mouse sounds were considered and deliberately left
out: the player's own real, physical keyboard already makes that sound
while they type into this panel's own text fields, and a synthesised
one under it would be redundant rather than additive.

**Lighting response and interaction pose, both reviewed rather than
changed.** Every material on the desk already used
`MeshStandardMaterial`/PBR properties, which already respond correctly
to the desk lamp's own light and the day/night cycle — confirmed, not
altered, beyond the accuracy the new plastic/rubber materials already
bring. The existing sit-down focus pose was checked against every
geometry change (the raised seat, the reclined back, the new monitor
bezel) and found to already read naturally: the camera's fixed point
is aimed at the screen, which never moved, not at the chair, which
moved a few centimetres.

**One real architectural finding, resolved.** `PlaceholderFactory
.softBox()` — a helper whose own docstring promised a faked bevel "to
fake a light bevel/rounding without extra geometry cost" — turned out
to have zero callers anywhere in the Workshop, and its actual
implementation (stripping a `BoxGeometry`'s index buffer) does nothing
visible at all: a box's faces already carry separate per-face vertices
and normals, so there was never a bevel to see. Removed cleanly, the
same way `Materials.ground()` was removed last phase.

**Future craftsmanship philosophy.** With the Workbench and now the
Desk both carrying this treatment, the pattern is holding: keep
position and purpose fixed, spend the budget on how convincingly each
part is built, add at most one or two small storytelling details, and
treat a real bug found along the way as worth fixing on the spot. The
Music Cabinet, the Wardrobe, or any future object that earns "hero
prop" status is the natural next candidate — not a lesser pass than
this one or the Workbench's.

## Known simplifications (by design, for this phase)

- **Axis-aligned screen projection**, not perspective-correct — see above.
- **No real browser or AI.** `BrowserApp` and `AIApp` are honest
  placeholders (see `docs/ROADMAP.md`, Phase 4).
- **Desktop-sized assumptions, mostly.** `WorkstationPanel`'s rail/content
  layout hasn't been reflowed for a narrow viewport — see the touch-input
  item in `docs/ROADMAP.md`. One specific accessibility problem this
  caused *is* fixed, though: once there got to be enough apps (Phase 10's
  Wardrobe, this phase's growth) that the rail's button list could exceed
  a shorter screen's height, those extra apps became genuinely
  unreachable — clipped by `.workstation-panel`'s own `overflow: hidden`,
  not just visually cramped. `.workstation-rail` now scrolls vertically
  (`overflow-y: auto` plus the standard `min-height: 0` flexbox fix that
  actually lets it), so every app tab stays reachable regardless of
  screen height; the rest of the layout (rail width, content area sizing)
  is unchanged. A later, purely cosmetic pass ("Living Refinement" — see
  docs/ROADMAP.md) hid the *visible* scrollbar on both the rail and every
  app's own content area, using the standard cross-browser technique
  (`scrollbar-width: none` for Firefox, `::-webkit-scrollbar { display:
  none }` for Chrome/Safari/Edge) — scrolling itself (wheel, touchpad,
  touch) is completely unchanged, only the track is hidden.
- **One computer, one desk.** `ComputerSystem` looks up the furniture piece
  named `"computerDesk"` directly. If the workshop ever has more than one
  computer, this would need to become "one ComputerSystem instance per
  desk," which is a small change (the class holds no other global state)
  but hasn't been needed yet.
