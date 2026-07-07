# Polish, stability, and release readiness

This phase added no new systems on purpose — it made the five that already
existed (Workshop, Computer, Workbench, Builder, World) solid enough to use
daily, on a tablet as readily as a desktop, and to install like a native
app. Per the brief's own instruction, this document is also the transparent
record of what was found and fixed, not just what was added.

## Touch support

Everything routes through `InputManager` — `CameraSystem`,
`InteractionSystem`, and `BuildModeSystem` still only ever read
`moveVector`, `lookDelta`, `wasJustPressed()`, exactly as before. Touch
didn't require changing any of them beyond one line (see "The rotation
gate", below) — this is the seam every earlier phase deliberately built
towards.

- **Movement**: a virtual joystick, created by `InputManager` itself (not
  HUD — it's an input device, not information) and invisible until the
  first real touch happens, so desktop never sees it.
- **Look**: dragging anywhere on the canvas accumulates the same
  `lookDelta` mouse-look already used, tracked per touch `identifier` so it
  coexists with the joystick (a different element, a different finger)
  without any special-case coordination between the two.
- **Interact**: the HUD's prompt — the thing that already said "press E to
  ..." — is now a real `<button>`. Tapping it does the same thing pressing
  E does (`InputManager.triggerAction("interact")`), so there's exactly one
  element serving as both the visual hint and the touch control, not a
  second floating action button duplicating it. It's only clickable while
  actually visible (see "A CSS specificity bug", below).
- **Build Mode**: already worked — placement/selection go through ordinary
  `click` events, which touch taps generate natively. The only thing to get
  right was making sure look-dragging never suppresses that native click
  synthesis; see "Why touch-look never breaks a tap", below.

### The rotation gate

`CameraSystem` used to apply mouse-look only `if (input.pointerLocked)`.
Touch has no equivalent of pointer lock, so a straight port would have
silently never rotated the camera on touch. The fix is `InputManager`
exposing `lookActive` (`pointerLocked` OR an active touch-look drag), and
`CameraSystem` checking that instead — one changed condition, not a
duplicated code path.

### Why touch-look never breaks a tap

`InputManager`'s touch listeners are all registered `{ passive: true }` —
which makes it *impossible* for them to call `preventDefault()`, even by
accident. That's deliberate: it guarantees the browser's own touch-to-click
synthesis for a light tap is never suppressed, so `BuildModeSystem`'s
ordinary `click` listener keeps working without any bespoke tap-vs-drag
logic of its own. `#workshop-canvas { touch-action: none; }` (in
`css/touch.css`) handles the *other* half of the problem — stopping the
browser's own scroll/pinch-zoom/pull-to-refresh gestures from competing
with a look-drag — without touching click synthesis at all.

### A CSS specificity bug (caught before it shipped)

The joystick hides during any modal state (computer, workbench, Build
Mode, an overlay) by adding `.modal-hidden` to `#touch-controls`, using the
same modal-tracking `HUD` already had. The first version set
`pointer-events: none` on `#touch-controls.modal-hidden` itself — but
`#touch-joystick-base` has its own explicit `pointer-events: auto` rule,
and a child's own explicit rule isn't overridden by an ancestor's value
just because the ancestor changed (that's not how CSS inheritance works
here). The joystick would have stayed genuinely tappable while invisible,
in exactly the screen regions the small workbench/Build-Mode panels don't
cover. Fixed by targeting the joystick directly:
`#touch-controls.modal-hidden #touch-joystick-base { pointer-events: none; }`.

## A real touch bug: no way to stand up

While auditing touch coverage, both the computer's and the workbench's
"stand up" hints turned out to be **plain text**, not buttons — pressing
Escape was, until this pass, the *only* way to leave either of them. On a
device with no physical Escape key, sitting down at the computer was a
one-way trip. Both are now real buttons (`"Stand up (Esc)"`), emitting the
exact same `interaction:exitRequested` event the overlay close buttons
already used — no new exit mechanism, just extending the existing one to
two more places that needed it. Build Mode didn't have this problem: its
"Build Mode (B)" HUD button already toggles off as well as on.

## Progressive Web App

- **`manifest.json`** — name, icons, `display: "standalone"`,
  theme/background colours matching the workshop's own palette. `start_url`
  and `scope` are relative (`"./index.html"`, `"./"`), which is what makes
  this work correctly whether the workshop is served from a domain root or
  a GitHub Pages project subpath (`username.github.io/repo-name/`).
- **Icons** — generated programmatically (`assets/icons/`) in the
  workshop's own brass/wood palette: a simple house silhouette with a
  doorway cut-out. Placeholder-first, same as every texture in
  `ProceduralTexture.js` — no external artwork, nothing licensed, nothing
  to attribute.
- **`service-worker.js`** — precaches the true "shell" (index.html, the
  CSS files, `main.js`) on install, and uses stale-while-revalidate for
  everything else: cached content serves instantly, while a background
  fetch quietly refreshes the cache for next time. Deliberately does *not*
  enumerate every file in `src/` by hand — that list would need updating
  every time a file is added or removed, and would silently drift stale.
  Instead, anything not in the shell gets cached the first time it's
  actually requested.
- **Honest limitation**: this makes the workshop work offline *after* one
  successful visit with a network connection — not on a completely
  first-ever offline load. Three.js loads from a CDN via the import map in
  `index.html`, specifically to keep the project buildless and trivially
  GitHub-Pages-able (see that file's own comment); truly-offline-from-first-
  load would mean vendoring Three.js's source into the repository instead.
  That trade-off wasn't revisited this pass — it's a deliberate, documented
  choice, not an oversight.

## Visual fix: the doorway (and windows) still looked blocked

Reported as "a thin dark surface still covers the openings, even though
you can walk through them." The wall's own opening (fixed in the previous
phase) was genuinely real — the bug was one layer further in: the door and
window **frames** (the decorative casing around each opening) were each a
single solid slab, sized *slightly larger* than the opening, sitting just
behind the glass or across the doorway. The wall had a real hole; the trim
piece sitting in that hole did not. Looking through the "glass," you were
actually seeing the solid wood-coloured frame immediately behind it, not
the sky.

The fix reuses the exact mechanism that made the wall's opening real in
the first place: `buildWallWithOpenings` (originally written for the wall
itself) treats the frame as its own tiny "wall" — an outer rectangle with
one centred opening — producing genuine jambs, a header, and (for windows)
a sill, with a real gap in the middle. No new geometry code, no CSG —
just calling existing code with different numbers.

## Camera fix: no more spinning to look at something

Reported: sitting at the computer, or the sitting area, would occasionally
spin most of the way around before settling, instead of turning the short
way. The cause: focus-mode yaw was interpolated with a plain
`THREE.MathUtils.lerp(fromYaw, targetYaw, t)`. Walking around accumulates
yaw indefinitely (nothing ever wrapped it back into a small range), so by
the time a focus transition started, `fromYaw` could easily be several
radians away from `targetYaw` numerically, even though the *actual* shortest
turn was small — a plain lerp doesn't know the difference between "genuinely
needs to turn most of the way around" and "these two numbers just happen to
be far apart because one of them never got wrapped."

Fixed with `shortestAngleLerp()` (new, in `MathUtils.js`), which normalizes
the angular difference into `[-π, π]` before interpolating — always the
short way, regardless of how large either raw value has drifted. As a
related hygiene fix (not required for correctness, since
`shortestAngleLerp` handles unbounded input fine, but worth doing anyway),
`wrapAngle()` now keeps walk-mode yaw itself from growing unbounded over a
long session.

## Computer focus pose

`ComputerDesk.js`'s `focusPoseLocal` was updated to a closer, lower,
already-tested seated position (`position: [0, 1.22, 0.25]`,
`lookAt: [0, 1.05, -0.16]`) — a direct data change, not an architectural
one.

## Code health audit

Findings, applied only where they were genuine improvements (per the
brief's own "avoid large rewrites" instruction, most of the audit
confirmed the architecture holding up rather than turning up problems):

- **Dead code removed**: `CameraSystem.exitFocus()` was reassigning
  `this._focusPose` to a differently-shaped object that the returning-phase
  code path never actually reads (it only ever consults `_preFocus`/
  `_focusFrom`). Left over from an earlier implementation approach;
  removing it changes no behaviour at all.
- **Naming**: `MOUSE_SENSITIVITY` renamed to `LOOK_SENSITIVITY` in
  `CameraSystem.js`, since the same constant now governs touch-drag
  sensitivity too.
- **Verified, not changed**: a full unused-import sweep, a duplicate-CSS-
  selector sweep, and a re-check of every furniture piece's interaction
  radius against its own collision footprint (from the previous phase's
  work) all came back clean. `ProjectsStore`/`ObjectLibraryStore`/
  `WorldObjectsStore`'s defensive defaults on `load()` were re-checked
  against the camera-angle changes and need no migration (yaw is stored as
  a plain number either way; only its *interpolation* changed).
