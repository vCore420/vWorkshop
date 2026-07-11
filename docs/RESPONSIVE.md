# Universal Experience

"There should never be a Desktop Workshop and a Mobile Workshop. There
is only the Workshop." This phase is a refinement pass, not a new
feature — every fix here makes an existing interface adapt more
gracefully to wherever it's being used, rather than adding anything a
player would point to as new.

## The biggest single gap: 3D-projected panels had no size floor

The Computer's own screen and the Workbench's own clipboard are both
DOM panels positioned every frame to match a real rectangle projected
from the 3D scene (`ScreenProjector.js`) — the technique that makes
either one's UI feel like it genuinely belongs to that object rather
than floating over the browser window. That projection had no minimum
size at all: a narrow viewport, or simply the camera not being
perfectly framed yet, could project a rectangle far too small to hold a
real interface — every Computer app (Builder, Being Creator, Wardrobe,
AI Mission Control, Diagnostics, Settings, Animation Editor) would have
inherited that same problem, since they all render inside this one
panel.

`comfortableRect()` (`ScreenProjector.js`) is the shared fix — a floor
under `projectRect()`'s own output, used by both `ComputerSystem.js` and
`WorkbenchSystem.js`. Below a comfortable minimum size, or on a narrow
viewport generally, the rect is widened/heightened back out to a
comfortable size, centred on wherever the projection itself was
centred, then clamped back on-screen — the panel still reads as
belonging to the monitor/clipboard it's projected from, it just never
becomes unreadable. Desktop, where the projection is already generously
sized, sees no change at all.

## Responsive Layout System

**The shared preview/form workspace** (`builder-workspace`, used by
Builder, Being Creator, and the Animation Editor) already split into two
panels side by side on a spacious screen. Below 700px, it now stacks
vertically instead — the preview first (already first in DOM order, so
column stacking puts it on top with no other change needed), given a
firm minimum height so it stays the clear visual anchor exactly as "the
model preview should remain the primary focus" asks, the form below it,
scrollable rather than shrunk to the point of being unusable.

**The Workshop Phone** gained its own narrow-viewport treatment — below
420px, the fixed 300px corner panel becomes a full-width, bottom-anchored
sheet instead, easier to reach with a thumb on an actual small phone
screen, still sliding up the exact same way.

## Touch Improvements

**A global touch-comfort baseline** (`tokens.css`, under `(pointer:
coarse)` — the actual signal for "being tapped with a finger," not
viewport width, so a touch laptop and a mouse-driven one at the same
narrow width aren't treated the same way) raises the minimum size of
every `button`/`select`/checkbox/radio/range input across the whole
Workshop at once, rather than touching dozens of individual button
classes across every interface file one at a time. `min-height`/
`min-width` only ever grows something that falls short of a comfortable
size — nothing already tall/wide enough is affected.

## Accessibility Improvements

**A global focus-visible fallback** (`tokens.css`) gives every
interactive element a clear keyboard-focus ring unless it already
defines its own more specific one — `:focus-visible`, not `:focus`, so
it never appears on an ordinary mouse click or touch tap, only on
genuine keyboard navigation.

**Automatic performance detection on first launch.** The device-
capability heuristic (`SettingsStore.detectRecommendedPreset()` — touch-
primary or low core count suggests "performance," generous cores suggest
"quality," everything else "balanced"; an honestly-labelled guess, not a
real benchmark) already existed, but only ever ran when a player found
and clicked Settings' own "Optimise For This Device" button — meaningless
for the very first impression, on exactly the device that needs it most.
It's now applied automatically, but only once, only on a genuinely fresh
Workshop (`isFirstSession`, from `WorldTimeService` — see
`docs/PERSISTENCE.md`); an existing player's own deliberate settings
choice is never overwritten by a later session's own detection.

## Responsive Architecture

"Avoid implementing device-specific versions of interfaces. Instead,
introduce responsive components that naturally adapt." Every fix in this
phase follows that instinct directly:

- `comfortableRect()` is a shared function both 3D-projected panels call
  — not a Computer-specific fix duplicated for the Workbench.
- The touch-comfort and focus-visible rules live once, in `tokens.css`,
  applying globally by selector rather than being copied into every
  interface's own stylesheet.
- The `builder-workspace` stacking breakpoint is one media query,
  inherited by every app that already uses that shared class — a future
  fourth app built on the same class gets the same responsive behaviour
  automatically, with nothing to opt into.

## Known simplifications (by design, for this phase)

- **No new touch gestures were added** (e.g. two-finger rotate) — the
  brief's own "avoid introducing major new features" scope; the existing
  discrete rotate button already works comfortably on touch once sized
  via the global touch-comfort baseline above.
- **`comfortableRect()`'s size floor is a fixed set of numbers**
  (480×360 minimum, up to 94%/88% of viewport on narrow screens), not a
  per-app-aware calculation — a deliberately simple, shared floor rather
  than each app declaring its own preferred minimum.

## Future extension points

- **Additional Phone Apps / Plugins** — inherit the Phone's own
  responsive shell and the global touch-comfort/focus-visible baselines
  automatically; nothing about either is Workshop-app-specific.
- **Future Builder Systems** — anything built on the shared
  `builder-workspace` class already reorganises on a narrow screen with
  no further work.
- **Outdoor Expansion** — the Phone (used for building/managing Beings
  while walking around outdoors already) needed no changes here to keep
  working the same way outside as inside.
