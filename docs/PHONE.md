# Workshop Phone

"The Computer is for creating. The Phone is for using." Where the
Computer (`ComputerSystem.js`, `docs/COMPUTER.md`) is a *place* the
player sits down at, the Phone is something carried everywhere —
reached for and put away in an instant, without ever stepping outside
the world.

## Architecture

`PhoneSystem.js` owns exactly three things: the open/close lifecycle,
mouse/camera handling while open, and which app is currently mounted.
`PhoneUI.js` owns the physical shell — the slide-from-hand animation
(the exact same one the old Builder Phone already established, only
generalised beyond Build Mode specifically), the header, and the home
screen grid. Neither file has any idea what a Being, an outfit, or a
construction piece is; every app is a plain `{id, label, glyph,
mount(container)}` object, the identical shape a computer app already
uses.

## Player Movement While Using the Phone

"Using the phone should NOT freeze the player... keyboard movement
should continue functioning normally... the mouse should temporarily
stop controlling the camera." `CameraSystem` gained a new, deliberately
narrower pair — `pauseLook()`/`resumeLook()` — separate from the
existing `lock()`/`unlock()`, which stops *everything* (used by an
overlay like sitting at the computer). `pauseLook()` only gates the
mouse-look block inside `_updateWalk()`; every other line in that
function (movement, running, jumping, crouching, ladders) runs
completely unaffected by it. Combined with
`InputManager.exitPointerLock()` (a real, visible, clickable cursor),
that's the whole mechanism — no new input mode, just the same two
primitives Build Mode already used, recombined without the full freeze
that never actually belonged to the Phone's own feel.

**Build Mode itself changed too.** "Continue allowing world building
while walking naturally through the environment" meant
`BuildModeSystem.js` had to stop calling `cameraSystem.lock()` on its
own — it now relies entirely on the Phone's own `pauseLook()`, so
placing an object no longer freezes the player in place the way it
used to.

## Application Persistence

"If the player closes the phone while using an application, the next
time the phone opens it should return to that same application." A
single field — `activeAppId` (`null` meaning the home screen) — is all
`PhoneSystem` persists. The phone itself always starts *closed* each
session (carried, not left lying open), but whichever app was open when
it was last closed is exactly what's mounted the next time it opens.

## Modular Phone Architecture

`phone/apps/registry.js` — the identical "list of factories, built once
with shared deps, plus a `registerAppFactory` escape hatch" shape
`src/computer/apps/registry.js` already established for the Computer.
"Applications should register themselves with the phone rather than
being hardcoded" is true in the most literal sense: `PhoneSystem.js`
never imports a single app file directly, only ever calling
`app.mount(container)` on whichever id is active. A future plugin adds
an app the same way a future computer app would — see
`docs/PLUGIN_GUIDE.md`.

An app can optionally define `onCancel()`, returning `true` if it
handled the Escape key itself (cancelling a Builder ghost, say) so the
Phone's own back-gesture (home screen, then closed) doesn't *also* fire
on the same keystroke.

## Home Screen

"Display applications as a simple grid of icons... the design should
remain minimal, clear, readable, comfortable... support future
applications without redesign." A plain CSS grid of buttons — an emoji
glyph and a label. Adding a ninth app needs no layout change at all.
Interface & Design Refinement phase — each glyph now sits on a real
rounded-square icon tile with its own gradient and a small lift on
hover, on a soft wallpaper gradient rather than a flat surface; see
this phase's own "Craftsmanship" section below for the rest of the
shell.

## The Applications

- **Builder** — `BuildModeSystem.js`/`BuilderPhoneUI.js`, entirely
  unchanged in behaviour, just no longer owning their own shell, mouse,
  or camera handling (that's the Phone's job now, uniformly). See
  `docs/WORLD.md`.
- **Beings** — spawn, move, remove, view, and quick behaviour changes
  for *placed* Beings, reusing `BeingSpawnerSystem`/`BeingInstanceStore`/
  `BeingLibrary` directly. Creating and editing Being *definitions*
  stays on the computer's own Being Creator — the separate
  Spawner/Manager tabs that used to live there were removed once this
  migrated. "Quick behaviour changes" edits the definition's own
  movement style directly (affecting every placed copy of that Being),
  rather than inventing a per-instance override nothing else in the
  Being architecture currently supports.
- **Wardrobe** — switch between saved outfits, save the current one. A
  colour swatch stands in for "a preview" here — no live 3D render for
  a small phone screen; the full editor stays on the computer.
- **Bubble** — Talk (opens the same conversation overlay as
  interacting with Bubble in the world), Stay Here, Follow Me, Return
  Home, and status/connection readouts. Stay/Follow/Return Home are new
  `ResidentController` commands (`playerCommand`, plus `stepToward()` on
  `ResidentMovement` for continuous, frame-by-frame following, separate
  from the idle-location ease-travel system that's tuned for occasional,
  slow journeys instead). Built against the resident stores generically
  enough that a future second resident would already work here.
- **Browser** — Workshop docs and bookmarks/saved pages, rendered inline
  via the exact `{title, html}` shape `PageRegistry.resolve()` already
  produces for the full computer Browser; ordinary external links (like
  GitHub) open in a real new browser tab instead. `BrowserStore` gained
  a small, shared `bookmarks` list.
- **Workshop** — weather, time, lighting, and music quick controls plus
  "I'm Lost!", every one a thin wrapper over a system that already does
  the real work. Workshop Projects is a named placeholder for a future
  phase.
- **Emotes** — triggers the exact same `EmoteWheelSystem` the direct key
  shortcut already does, then closes the phone; two access points, one
  wheel.
- **Settings** — a small, deliberately partial subset (volume, camera
  sensitivity, invert) of the full computer Settings app.

## Craftsmanship (Version 2, Phase 23b — Interface & Design Refinement)

"Rather than feeling like a prototype or small floating panel, it
should become immediately recognisable as a modern smartphone." The
shell gained the actual anatomy a phone has, without touching how apps
mount, how navigation behaves, or Application Persistence above — every
change lives in `PhoneUI.js`'s own constructor and `css/phone.css`.

**A status bar with a real clock.** `PhoneSystem._updateStatusBar()`
reads `TimeOfDaySystem.currentTime` directly — the same value the wall
clock and Settings' own "Current time" row already use, via a newly
shared `src/utils/TimeFormat.js` (previously a private copy inside
`SettingsApp.js`) — and writes it into the status bar on a throttled
half-second timer, only while the phone is actually open. Two
decorative glyphs (signal, battery) sit beside it, permanently full —
the same convention every real phone's own marketing screenshot
already uses.

**A home indicator** — a thin cosmetic pill at the very bottom of the
screen, the one visual cue that says "touchscreen" without needing an
actual gesture system behind it.

**Refined proportions and case** — 290×600 rather than 300×520 (closer
to a real modern phone's own aspect ratio), a slightly thinner bezel, a
larger corner radius (`--radius-xl`, new this phase). Still wood and
brass — "its own identity while remaining clearly part of the
Workshop" meant refining that material language further, not replacing
it with a generic glass-and-aluminium case that would fit any other
project's phone just as well.

**Real icon tiles**, not bordered boxes — see "Home Screen" above.

**Slightly denser content padding** — "the phone should feel spacious
despite its limited screen size" meant giving a little room back to
content specifically (vertical padding, most of all), not a wholesale
rescale of the shared app-content classes, which were already
reasonably tight.

See `docs/DESIGN_SYSTEM.md` for the rest of this phase's own work —
design tokens, the Builder's own named overflow bug, and what was
reviewed and found already consistent across the Workshop's digital
interfaces.

## Known simplifications (by design, for this phase)

- **Wardrobe preview is a colour swatch, not a live 3D render** — see
  above.
- **Being "quick behaviour changes" affect the whole definition**, not
  a single placed instance, since no per-instance override currently
  exists anywhere in the Being architecture.
- **Bubble's "Follow Me" is a direct step-toward, not real pathfinding**
  — matches the same "believable illusion of care, not a solved
  navigation problem" standard Beings' own movement already accepts.

## Future extension points

- **Plugin applications** — `registerPhoneAppFactory()` is the exact
  mechanism; nothing about it is Workshop-app-specific.
- **Additional residents** — Bubble's own app is already written
  generically against the resident stores, not the name "Bubble."
- **AI Conversations, Camera Tools, Workshop Projects** — each a
  natural new tile on the same home grid, no architecture change
  required.
- **Future Hardware Integration** — nothing about `PhoneUI.js`'s own
  shell assumes a mouse-and-keyboard session specifically; a touch-first
  variant of the same grid/content-area shape is a styling change, not
  a redesign.
- **A lock screen and real notifications** — both considered during the
  Interface & Design Refinement phase and deliberately left out; see
  `docs/DESIGN_SYSTEM.md`'s own "Known limitations" for why (in short:
  neither has anything real behind it yet to justify the visual).
