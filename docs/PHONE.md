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
applications without redesign." A plain CSS grid of buttons — an icon
and a label. Adding a ninth app needs no layout change at all.
Interface & Design Refinement phase — each icon now sits on a real
rounded-square icon tile with its own gradient and a small lift on
hover, on a soft wallpaper gradient rather than a flat surface; see
this phase's own "Craftsmanship" section below for the rest of the
shell.

**Version 3, Phase 10 ("Real Assets, Honestly Introduced")** — `glyph`
used to always mean a literal emoji character, and that's still true
for anything `ProceduralIcons.js`'s own `iconMarkup()` doesn't
recognise. Every Workshop-owned app's own `glyph` now names one of
`iconMarkup()`'s hand-drawn kinds instead (a small, coherent line-icon
language, generated in code — no binary assets, following
`assets/README.md`'s own standing rule); `showHome()` renders that
markup when recognised, falling back to plain text otherwise. A
third-party plugin's own `glyph` — still documented in
`docs/PLUGIN_SDK.md`/`docs/PLUGIN_GUIDE.md` as "any character" — keeps
working exactly as it always did, unaffected: `workshopToolkitPlugin.js`
(the shipped example) deliberately still uses a literal emoji rather
than one of this file's own internal kind ids, precisely so it keeps
demonstrating the real, stable contract a plugin author can rely on.

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
  Version 3, Phase 8b added a fourth `playerCommand` value, `"goto"` —
  not a Phone button (there's no player-facing reason to type raw
  coordinates), only ever set by `ResidentController.goTo(position)`, the
  one-time errand the `moveTo` Workshop Function uses (see docs/AI.md's
  own "Workshop Functions" section). Same shape as the other three:
  `update()` keeps stepping toward the target every frame until close
  enough to count as arrived, then clears itself back to ordinary
  autonomous wandering, exactly like Return Home already does.
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
  sensitivity, invert, time format, the phone's own wallpaper/border) of
  the full computer Settings app — see "Becoming a Device" below.

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

## Becoming a Device (Version 3, Phase 13, Wave 1 — v3.1.3a)

"Grow the Phone from a functional menu surface into something that
actually feels like carrying a device." Playtesting found the mechanism
already worked well but the *identity* hadn't caught up — this wave
closed four of the five gaps it found (the fifth, deeper per-app
visual distinctness, is its own later wave).

**The home indicator is a real control now, not just a visual cue.**
The bottom pill (see "Craftsmanship" above) is a genuine `<button>`
now, wired to the same `onGoHome()` the header's own Home button already
calls — a real second way back to the home screen, the same bottom-bar
habit a real device's own gesture nav teaches.

**Wallpaper and border colour, a player's own choice.** A new
`SettingsStore.get("phone")` category (`{ wallpaper, borderColor }`) —
four curated presets each, every one reusing an existing design token
rather than a colour picker (see `docs/DESIGN_SYSTEM.md`'s own account
of why: "not a theming engine for its own sake" is this phase's own
brief). Exposed on *both* Settings surfaces — the PC Settings app's new
Phone tab and the Phone's own Settings app directly, since real device
customisation happens on the device itself at least as often as from a
desktop. `PhoneUI.setAppearance({ wallpaper, borderColor })` is the one
place either surface's change actually lands — plain `data-wallpaper`/
`data-border` attributes on the shell, with `css/phone.css`'s own
`[data-wallpaper]`/`[data-border]` rules doing the real work, so
`PhoneUI` still has no idea what a "preset" even means, the same
"doesn't know what a Being, an outfit is" standard the rest of this
file already holds it to.

**A 12-hour/24-hour format toggle, the same setting on both surfaces.**
`SettingsStore.get("display").timeFormat` (`"24h"` default, or `"12h"`)
— `src/utils/TimeFormat.js`'s own `formatClockTime(hour, format)` reads
it wherever a clock is drawn: the PC Settings app's own Atmosphere/Date &
Time section (Current time, Set Time, Sunrise/Sunset, Moonrise/Moonset),
the Phone's own Settings app, and `PhoneSystem`'s status-bar clock. A
genuine rounding bug (a fractional hour just under the next minute could
render as `":60"`) was caught and fixed in the same pass, not treated as
out of scope just because the format toggle was the actual assignment.

**App screens now arrive with a bit of motion**, not an instant
`innerHTML` swap — see `css/phone.css`'s own `workshop-phone-screen-in`
keyframes and its comment on why this is an `animation`, not a
`transition` (a one-shot "arrive like this," not an in-place state
change), plus a real note on a genuine dev-tooling limitation found
while verifying it (`.claude/DEV_NOTES.md`).

**Deferred to its own wave**, deliberately: "each app should read as
distinctly itself rather than sharing one visual template" — a real,
sizeable interpretation choice on its own, not a fix that fits alongside
four smaller, more mechanical ones. See "Each App, Distinctly Itself"
below for that wave's own account.

## Each App, Distinctly Itself (Version 3, Phase 13, Wave 2 — v3.1.3b)

"Each app should read as distinctly itself rather than sharing one
visual template" — the deferred fifth gap from Wave 1, given its own
wave since it's a real, per-app design choice rather than a mechanical
fix. Every app below still builds on the shared vocabulary
(`.workshop-phone-section`, buttons, rows) established earlier in this
file; what changed is each app's own small, content-grounded departure
from it — never a departure invented for its own sake (see
`docs/DESIGN_SYSTEM.md`'s "not a theming engine" caution, quoted above
for wallpaper presets and just as true here).

- **Bubble** — a companion, not a list. A real presence dot
  (`data-presence`: `awake`/`conversing`/`connecting`/`sleeping`, driven
  by the same `residentConnection`/`residentBehaviour` state the rest of
  the app already reads) sits beside the heading, and the Talk button is
  shaped like an actual speech bubble instead of the generic full-width
  rectangle every other app's primary action already is.
- **Wardrobe** — a closet, so outfits are a grid of garment cards, not a
  scrolling list of rows. The swatch is each outfit's own real
  `appearance.parts.torso.color` now, not the fixed placeholder colour
  the Phase 12 ARIA audit had already flagged as "not really a preview"
  — a genuine fix riding along with the visual pass, not a separate one.
- **Workshop** — a portable control panel, so weather and time are
  icon-forward tiles (11 new marks in `ProceduralIcons.js`: weather × 4,
  time-of-day × 3, a light bulb, music × 3, a compass) and lighting/
  music/"I'm Lost!" are icon-prefixed buttons, like a real device's own
  control centre rather than plain text buttons. Building this surfaced
  a real, standing gap: `aria-pressed` was already being set correctly
  on every toggle here, but nothing anywhere gave it a visible look — a
  listener had no way to *see* which weather or lighting state was
  actually current. Fixed once, for every button in the app that sets
  it, rather than patched per-button.
- **Beings** — "Spawn a Being" is a tap-to-place roster grid (the shared
  paw-print icon, since no per-Being icon exists), sized with
  `auto-fill` rather than a fixed column count since a Being library can
  hold anywhere from one entry to many. "Placed Beings" stays a list —
  each instance carries real per-instance controls (movement select,
  move/despawn/remove) a tile has no room for, so a list is the honest
  shape for that content, not a limitation left unaddressed.
- **Browser** — real browser chrome: a favicon-style globe mark on every
  link and bookmark row, a pill-shaped address bar for adding one, and
  an actual toolbar (a new `chevronLeft` back control plus the resolved
  page's own title) over an opened page, replacing a plain "← Back" text
  button.
- **Emotes** — the same tap-to-trigger tile pattern as Beings' own
  roster (the shared sparkle icon, since no per-gesture icon exists),
  swapped in for the plain list `EmoteWheelSystem.js`'s own radial menu
  still uses unchanged — two equally valid, independently-styled ways to
  reach the same gestures, not a shared component either had to
  compromise on.
- **Settings** — deliberately the plainest app of the whole wave. Its
  content is a panel of values to adjust, not a collection, a companion,
  or a device to browse, so every slider, checkbox, and toggle row stays
  exactly as it was; the only touch is the same small gear mark next to
  its own heading every other app's identity-defining mark now gets.

## Known simplifications (by design, for this phase)

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
