# Performance & Settings

An engineering pass, not a feature pass: making the existing workshop
smoother — especially on tablets — without reducing visual quality or
removing anything. This document covers what was actually found (reasoned
through, not guessed at) and the Settings system built to let a person
control the trade-offs themselves.

## Philosophy

"Can I make this feel faster by making it smarter rather than making it
simpler?" — every fix below is architectural: caching something that never
needed recomputing, sharing something that never needed duplicating,
debouncing something that never needed to happen that often. Nothing here
reduces geometry detail, texture quality, or removes a feature to get
there. The one place visual quality *is* adjustable (shadows, antialiasing,
render distance) is entirely opt-in, through Settings — the workshop still
defaults to looking exactly like it did before this pass.

## Performance audit: what was actually found

### The proximity scan was redoing full-room work 60 times a second

`InteractionSystem` finds the nearest interactable every frame so the HUD
knows what to prompt. Before this pass, that meant, every single frame:
`EntityManager.all()` — which allocates a *fresh array* on every call —
followed by a `getComponent()` check and a world-position + distance
calculation for every entity in the room, interactable or not.

Two fixes, not one:

- **`EntityManager.byComponent(ComponentClass)`** — a cached query,
  invalidated only when an entity is actually created or destroyed (a
  version counter bumped by `create()`/`destroy()`), not rebuilt on every
  call. `InteractionSystem` now asks for entities with an
  `InteractableComponent` specifically, not every entity in the room.
- **The scan itself is throttled to ~12.5Hz** (`SCAN_INTERVAL` in
  `InteractionSystem.js`), not full frame rate. A prompt appearing up to
  ~80ms later than the exact frame you walked into range is imperceptible;
  the interact-key check itself still runs every frame (against whatever
  the last scan found), so pressing E never feels delayed — only the
  expensive "look at everything" part backed off.

This is the single highest-value fix in this pass: it was already
measurable work with a handful of hand-built furniture pieces, and would
have become a genuinely bad bottleneck the moment a world had any real
number of Builder-placed objects in it — exactly the thing the World
Creation system is designed to encourage.

### Per-frame allocations in the walk loop

`CameraSystem._updateWalk` runs every single frame while walking (the
workshop's default, continuous state) and was allocating a new
`THREE.Vector3`/`Vector2` for `forward`, `right`, `wish`, and the
candidate-next-position on *every call* — plus `FurnitureSystem
.getFootprints()` (also called every frame from here) was rebuilding a
fresh array from its internal Map on every call, and `InputManager
.moveVector` was allocating a fresh vector on every read.

All replaced with scratch objects — allocated once, in each `init()` (or
constructor), mutated in place every frame instead of replaced. None of
this changes behaviour at all; it only stops generating garbage for the
JS engine to collect, which matters more on a tablet's more limited memory
and weaker GC than it does on a desktop.

`FurnitureSystem`'s footprint list specifically is now built once at
`init()` and only rebuilt if a furniture transform is ever actually loaded
from a save with different values than the default (see the next
finding) — not on every single `getFootprints()` call.

### `getSystem()` linear searches, repeated every frame

`Engine.getSystem()` does a linear scan over every registered system.
Perfectly fine for a one-off lookup; `CameraSystem`, `InteractionSystem`,
and `WorldEnvironmentSystem` were each doing this scan *every frame* for a
dependency (`RoomLayoutSystem`, `FurnitureSystem`, `CameraSystem`) that
never changes after startup. Each now resolves the reference once, in its
own `init()`, and reuses it — safe because every system already exists in
`engine.systems` by the time *any* system's `init()` runs (every
`addSystem()` call in `main.js` happens before `engine.init()` is ever
called) — only a system's own internal state is order-dependent, not
whether `getSystem()` can find its object reference.

### A real, if latent, bug found while fixing the above

While caching `FurnitureSystem`'s footprint list, its `persistence:load`
handler turned out to update a piece's *visual* position/rotation on load
without ever recomputing that piece's *collision* footprint to match.
Nothing today can actually trigger this (nothing lets the player move
furniture yet), but the save/load path already round-trips a transform
that could differ from the default one — the exact seam `FurnitureSystem`'s
own doc comment describes for a future "drag furniture around" feature.
The moment that arrives, saving a dragged position and reloading would
have applied the new position visually while still colliding with where
the piece *used to be*. Fixed now, while already in the code, rather than
left as a bug waiting for that later feature to trip over.

### Unit-sized geometry was never shared

`ObjectCompiler` (the thing that turns a Builder object's `parts` into
real meshes — see docs/WORLDBUILDER.md) builds every part as a unit-sized
primitive, scaled per-instance. That means the *geometry itself* — the
actual vertex/index data — is always identical for a given part type (and,
for cylinders/cones/spheres, segment count), regardless of how many times
it's used. Materials were already shared this way (see
`PlaceholderFactory.js`'s own cache); geometry wasn't. A hundred placed
"Wall" pieces from the Construction Library used to mean a hundred separate
`BoxGeometry` instances with byte-for-byte identical data. They now share
one. This matters more every time someone actually builds something
substantial with the World Creation system — which is the point of that
system existing.

### `persistence:saveRequested` had no debouncing at all

Every store that changes calls `persistence:saveRequested`, which used to
trigger an *immediate*, synchronous full save — serialize every store,
write the whole thing to `localStorage` — on every single call. That was
fine when the events firing it were things like "created a playlist" or
"toggled a favourite" — occasional, deliberate actions. It stopped being
fine the moment this pass added sliders: dragging a volume or sensitivity
slider fires its `input` event on every pixel of movement, each one now
calling `settingsStore.update()`. Without a fix, dragging a Settings slider
would have meant dozens of full synchronous saves per second.

Fixed with a straightforward debounce (`PersistenceSystem._scheduleSave`,
400ms): rapid-fire requests collapse into one real save shortly after they
stop, rather than one save per request. `beforeunload`,
`visibilitychange` (tab hidden), and the periodic autosave all still call
`save()` directly and immediately — nothing is at risk of being lost by
the debounce, since those three unconditional paths exist independently of
it.

### Checked, and genuinely fine as-is

Not every corner of the engine needed changing — worth recording what was
actually looked at and found to be fine, rather than only what changed:

- **Per-entity/per-component `update(dt)` dispatch** — `Entity.update()`
  calls `component.update?.(dt)` for every component on every entity,
  every frame. Currently *no* component in the entire codebase implements
  `update()` at all, so this is a property-lookup-and-no-op, not real
  work. Worth knowing about if a future component needs one, not worth
  "optimizing" a near-zero-cost path today.
- **`TimeOfDaySystem`** already throttled its own expensive recomputation
  to 4Hz before this pass — a good, pre-existing example of exactly the
  throttling pattern applied to `InteractionSystem` above.
- **`WeatherSystem.update()`/`WorldEnvironmentSystem.update()`** — both
  already cheap (a handful of property reads/writes, no allocation), aside
  from the `getSystem()` calls fixed above.

## The Settings app

A new, substantial tab inside the computer's existing Settings app (not a
separate app — "the central location for configuring the Workshop", still
one object). The room lighting / clock-mode / weather controls that used
to be the *entire* Settings app now live in its "General" tab, preserved
exactly as they were.

`SettingsStore` (`src/settings/`) is plain persisted data, following the
exact same shape as `ProjectsStore` — no engine/scene concerns. It knows
nothing about what a setting *does*; it just holds values, presets, and
emits `settings:changed`. `SettingsSystem` is the one place that
translates a setting into an actual effect, and even it mostly just calls
a small setter that already lives on the system that owns the thing being
changed — `LightingSystem.setShadowQuality()`,
`WorldEnvironmentSystem.setRenderDistance()`,
`InputManager.setMouseSensitivity()`, `AudioSystem`/`MusicSystem`'s own
volume-multiplier setters. This mirrors how `TimeOfDaySystem` already
relates to `LightingSystem`/`WorldEnvironmentSystem` — one system
computes/holds state, several independent systems apply their own slice
of it.

### Graphics

- **Render Distance** — sets both `camera.far` and the outdoor fog's far
  distance together (`WorldEnvironmentSystem.setRenderDistance`), so the
  world fades into the sky at roughly the point it stops being drawn,
  rather than either popping visibly into view or fading well short of the
  actual cutoff.
- **Shadow Quality** — off/low/medium/high. Off disables the renderer's
  shadow map entirely (`renderer.shadowMap.enabled = false`); low uses
  hard-edged `BasicShadowMap`; medium/high use soft `PCFSoftShadowMap`.
  Existing shadow-receiving materials are flagged `needsUpdate` when this
  changes, since the shadow-sampling code path is baked into a compiled
  shader — simply changing the renderer's shadow map type wouldn't
  otherwise take visible effect on materials already in use.
- **Lighting Quality** — low/medium/high. Chiefly the sun's shadow map
  *resolution* (512/1024/2048 — the renderer must throw away and rebuild
  its cached shadow render target for a resolution change to actually take
  effect, not just update the `mapSize` number); "low" additionally skips
  the workbench lamp's own point light specifically (a small, honest
  reduction in per-fragment light count, not a purely cosmetic label).
  Distinct from Shadow Quality on purpose: one is "do shadows render, and
  how soft," the other is "how much light detail."
- **Anti-aliasing** — the one setting that can't be changed on a live
  renderer at all; MSAA is a WebGL context option, fixed when the context
  is created. Toggling it disposes the current renderer and builds a fresh
  one with the same configuration otherwise (shadow map, tone mapping,
  colour space, size). Safe specifically because `engine.renderer` is only
  ever referenced from within `Engine.js` — there's no stale reference
  anywhere else in the codebase to a renderer this replaces.
- **Frame Rate Limit** — uncapped/30/60/120. `requestAnimationFrame` (which
  `renderer.setAnimationLoop` uses) can't itself be throttled to an
  arbitrary rate — it always follows the display's native refresh. Instead,
  `Engine._tick()` is still called every refresh, but skips the
  update-and-render work entirely until enough real time has passed,
  accumulated across skipped calls via the same `THREE.Clock` used
  everywhere else. This is what makes a 30fps cap genuinely cheaper rather
  than rendering identical frames twice as often as necessary — a real
  battery/thermal saving on a tablet, where many displays run at 90–120Hz
  for content that doesn't need it.
- (Not its own slider, to keep the panel from growing past what was asked
  for) **shadow quality also caps the internal render-resolution
  multiplier** (`renderer.setPixelRatio`) — the single highest-impact lever
  available on a high-DPI tablet display, folded into the existing tiers
  rather than given a separate, seventh control.

### Performance

- **Preset** (Performance/Balanced/Quality) applies a bundled set of the
  graphics values above; adjusting any individual graphics value afterward
  moves the preset to "Custom" automatically, so the dropdown never lies
  about whether you're still actually on a named preset.
- **Optimise For This Device** — a one-tap heuristic
  (`SettingsStore.detectRecommendedPreset`): touch-primary devices and
  `navigator.hardwareConcurrency <= 4` suggest Performance; `>= 8` suggests
  Quality; everything else stays Balanced. Deliberately described in the
  UI as a heuristic, not a benchmark — a real benchmark (rendering sample
  frames and timing them) would take real time to run and was judged not
  worth the complexity for this pass; the honest, instant guess was the
  right scope here.
- **Performance feedback** — Current Performance (a plain-language bucket:
  Smooth/Good/Reduced/Struggling, derived from FPS, never shown as a raw
  number pretending to mean something on its own), Current Graphics
  Preset, and Approximate FPS, sourced from `Engine`'s own rolling ~1Hz
  `engine:performanceSample` event (real elapsed frames divided by real
  elapsed time — a capped frame rate correctly shows its cap, not the
  display's native refresh rate).

### Display, Controls, Audio

- **Field of View** / **UI Scale** — FOV is a direct `camera.fov` +
  `updateProjectionMatrix()`. UI Scale uses CSS `zoom` applied to each of
  the workshop's independent UI roots (HUD, overlays, the computer/
  workbench/Build Mode panels, touch controls) — they're deliberately
  separate siblings under `<body>`, not nested in one shared wrapper, so
  there's no single container to scale instead. `zoom` reflows layout
  (unlike `transform: scale`, which would need separate size compensation
  to avoid clipping); the trade-off is that it has no effect in browsers
  that don't support the property, rather than breaking anything.
- **Mouse Sensitivity** / **Touch Sensitivity** / **Invert Look** — applied
  in `InputManager`, at the exact point each input source accumulates into
  the shared `lookDelta` (mouse and touch deltas share one accumulator;
  `InputManager` is the one place that already knows which source produced
  a given frame's movement, so the per-source multiplier belongs there, not
  in `CameraSystem`). Invert Look flips the vertical (pitch) axis only, the
  conventional meaning of the term.
- **Master / Music / Effects / Ambient Volume** — layered *on top of* each
  system's own existing volume, not a replacement for it: `MusicSystem`'s
  own player volume slider and `AudioSystem`'s own existing volume/balance
  choices stay exactly as they were, multiplied by these settings the same
  way a device's system volume sits on top of an individual app's own
  volume control. Effects Volume is stored and applied nowhere yet — there
  is no discrete "effect" sound (as opposed to music or ambience) anywhere
  in the workshop today; the channel exists ready for the first one.

## Persistence

`SettingsStore` is a normal `PersistenceSystem` provider (`"settings"`),
saved and loaded exactly like `ProjectsStore` or `MusicLibraryStore` — see
docs/ARCHITECTURE.md. A loaded settings file is merged onto the current
defaults field-by-field (`deepMerge`, not a blind overwrite), so a save
from an earlier version missing a field a later version added just quietly
gets that field's default rather than breaking.

## Known limitations

- **"Optimise For This Device" is a heuristic, not a benchmark** — see
  above. It won't be right for every device, only a reasonable guess for
  most.
- **Effects Volume has nothing to control yet** — see above.
- **UI Scale depends on CSS `zoom`** — unsupported in a handful of older
  or non-Chromium-family browsers, in which case the setting simply has no
  visible effect rather than causing any layout problem.
- **The frame-rate cap measures wall-clock time, not GPU work** — a
  genuinely overloaded frame can still take longer than the cap's interval;
  the cap controls how *often* rendering is attempted, not a guarantee of
  hitting the target on especially expensive frames.
