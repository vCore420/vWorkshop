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

## Known simplifications (by design, for this phase)

- **Axis-aligned screen projection**, not perspective-correct — see above.
- **No real browser or AI.** `BrowserApp` and `AIApp` are honest
  placeholders (see `docs/ROADMAP.md`, Phase 4).
- **Desktop-sized assumptions.** `WorkstationPanel`'s rail/content layout
  hasn't been tuned for a narrow viewport yet — see the touch-input item in
  `docs/ROADMAP.md`'s Phase 3.
- **One computer, one desk.** `ComputerSystem` looks up the furniture piece
  named `"computerDesk"` directly. If the workshop ever has more than one
  computer, this would need to become "one ComputerSystem instance per
  desk," which is a small change (the class holds no other global state)
  but hasn't been needed yet.
