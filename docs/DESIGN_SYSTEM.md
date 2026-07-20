# Workshop Design System (Version 2, Phase 23b — Interface & Design Refinement, v2.2.3b)

"Pursue visual harmony, not visual uniformity." The second refinement
pass before Version 2 is considered complete — a craftsmanship pass on
the Workshop's own interface, not a feature phase. Every physical
interface (the Workbench, the Pinboard, notes) keeps its own material
identity on purpose; what this phase unifies is the shared plumbing
underneath the *digital* interfaces, and one object — the Phone —
that genuinely needed a more complete treatment than "consistent with
its neighbours."

## Design tokens (`css/tokens.css`)

Already a real, working system before this phase — a full palette,
type scale, spacing scale, motion tokens, a global touch-target
minimum, and a global keyboard-focus ring, all established in an
earlier phase and already reused across most of the Workshop's CSS.
This phase's own contribution was an audit, not a rebuild: "shared
shadows" and a couple of radius gaps turned out to be real, findable
holes in an otherwise solid system.

**Shadows had no tokens at all before this phase**, despite being
explicitly named in the brief's own "Workshop Design Language" review
list. Three separate files — `buildmode.css`, `music.css`, `phone.css`
— each hardcoded the *exact same* "floating panel, brass inset ring"
shadow value, byte for byte (with one small, almost certainly
accidental drift: `music.css`'s own copy used a 70px blur where the
other two used 60px). A small, real scale now exists —
`--shadow-soft`/`--shadow-medium`/`--shadow-panel`/`--shadow-float`/
`--shadow-tile` — and every exact-match duplicate found during the
audit now references it, consolidating that accidental drift in the
process rather than leaving three copies of "almost the same shadow"
in place. Several close-but-not-quite-identical shadow values were
deliberately left alone rather than force-rounded to the nearest
token — changing what something actually looks like wasn't this
phase's goal, only removing genuine duplication.

**`--radius-xl` (28px) and `--radius-pill` (999px)** were added
alongside the existing `sm`/`md`/`lg` scale — the Phone's own case
corner and its new home indicator pill needed real values, and
`workbench.css` already had its own hardcoded `999px` for a pill
button, now pointing at the same token. Exact-match `border-radius:
6px`/`3px` declarations in `tools.css` and `workbench.css` were swept
to `var(--radius-md)`/`var(--radius-sm)` respectively — a small number
of `4px` declarations in `workbench.css` were deliberately left as
literal values rather than rounded to the nearest existing token
(`3px`), since that would be a real, if tiny, visual change this phase
couldn't verify by eye — see "Known limitations" below.

**A genuine near-miss, caught before shipping**: an early pass
mechanically replaced every `border-radius: 8px` in `tools.css` with
`var(--radius-lg)` — which is 12px, not 8px. Caught immediately by
checking what the token actually resolved to before moving on, and
reverted to the literal `8px` value it already correctly was. Mentioned
here for the same reason this project always surfaces a caught mistake
rather than quietly fixing it and moving on.

**A real, previously-invisible bug, found by the same audit.** The
Phone's own header buttons referenced `var(--text-base)` — a token
that has never existed anywhere in `tokens.css`, or anywhere else in
the Workshop. An invalid custom property reference doesn't throw or
warn; it just quietly invalidates that one declaration, so the browser
silently fell back to the *inherited* font size from the header around
it instead of any deliberately-chosen one. Fixed to `var(--text-md)` —
a real, intentional size, a touch larger than the surrounding title
text for a clearer, more comfortable tap target. Found by a scripted
sweep of every `var(--...)` reference across every stylesheet against
what `tokens.css` actually defines, the same kind of check this
project has already run on its own JavaScript exports and imports —
turns out it's just as worth running on CSS custom properties.

## The Workshop Phone — a complete shell refinement

"Rather than feeling like a prototype or small floating panel, it
should become immediately recognisable as a modern smartphone... while
remaining faithful to the Workshop's own design language." The
existing shell (`PhoneUI.js`, `css/phone.css`) already had real,
working bones — a slide-up-from-the-hand animation, a home screen
grid, app persistence — this phase gave it the actual *anatomy* a
phone has, refining the wood-and-brass case rather than replacing it
with a generic glass one.

**A real status bar.** The Workshop's own current time (read from
`TimeOfDaySystem.currentTime`, the exact value the wall clock and
Settings' own "Current time" row already use — see the new, shared
`src/utils/TimeFormat.js`), updated live while the phone is open,
throttled to twice a second — a real device's own clock only changes
once a minute, so polling every frame for a value overwhelmingly
likely to be identical to last frame's would be wasted work for
something nobody could perceive updating that often. Two honestly
decorative glyphs (signal, battery) sit beside it — a permanently-full
mockup icon is the same harmless convention every real phone
screenshot already uses, not something worth simulating for real.

**A home indicator.** A thin pill at the very bottom of the screen — the
one visual cue that says "touchscreen" every modern phone shares,
without needing an actual gesture system behind it. Version 3, Phase 13
("The Phone Becomes a Device") made it a real second way back to the
home screen, not just the visual nod it started as — see that phase's
own account in `docs/ROADMAP.md`.

**Refined proportions and case.** Narrower and taller (290×600 rather
than 300×520 — an aspect ratio closer to an actual modern phone), a
slightly thinner bezel (6px rather than 7px) and larger corner radius
(`--radius-xl`, 28px) for a more contemporary silhouette, while keeping
the exact wood/brass material and slide-up animation the phone already
had — "its own identity while remaining clearly part of the Workshop"
meant refining this material language further, not discarding it for
something that would fit a generic phone case just as well anywhere
else.

**A real home screen, not a form.** App icons are now actual rounded-
square tiles with their own gradient background and a small lift on
hover, sitting on a soft wallpaper gradient rather than plain bordered
boxes on a flat surface — "the design should remain minimal, clear,
readable, comfortable" (the original brief this home screen was built
to) is still true; it's just no longer indistinguishable from a
generic settings list.

**Slightly denser content.** Vertical padding inside the content area
was tightened (`--space-3` to `--space-2` on the top/bottom, horizontal
untouched) — "the phone should feel spacious despite its limited
screen size" meant giving a little more room back to content, not
rescaling every shared app-content class, most of which (buttons,
list rows, textareas) were already reasonably tight.

## Responsive: the named Builder overflow bug

"Builder currently contains examples where additional options push the
interface wider than its container." Traced to a specific, real cause:
`buildPartEditor()`'s own `miscRow` (Rotation, Colour) conditionally
appends a *third* field — "Segments" — only for cylinder/sphere/cone-
type parts, and `.builder-inline-row` had no `flex-wrap` at all. Two
fields fit; a third had nowhere to go but past the container's own
edge.

Fixed with `flex-wrap: wrap` plus a real minimum basis per field
(`flex: 1 1 80px` rather than `flex: 1` alone, which happily shrinks a
field to an unusable sliver before ever actually wrapping) — "wrapping
should almost always be preferred over layouts expanding horizontally,"
concretely: two fields comfortably share a row at typical panel
widths, and a third wraps onto its own line instead of squeezing in or
spilling out. A broader sweep of other flex "row" patterns across
`computer.css`/`tools.css`/`music.css`/`overlays.css` found the rest
already either genuinely fixed-content (an input plus a send button,
unlikely to ever need more than two things) or already wrapping
(`.settings-tab-bar`, reused by Settings, AI Mission Control, and the
Tools app alike) — confirmed rather than changed.

## Digital software: what was found already consistent

"Menus should increasingly feel like they belong to the same operating
system." Reviewed rather than rebuilt from scratch this phase — the
`.settings-tab-bar` pattern (a wrapping row of pill buttons, an
`.active` state in the signature brass/teal accent) is already the
shared navigation language across Settings, AI Mission Control, and
the Tools app; `.builder-field`/`.panel-row` are already the shared
form-control shape reused across the Builder, Wardrobe, AI, Being
Creator, and the Animation Editor. This phase's own contribution here
was confirming that reuse is real (not just superficially similar
class names doing different things underneath) and closing the gaps
found during that confirmation — the shadow and radius consolidation
above — rather than inventing a wholesale new component library this
phase's own brief explicitly warned against ("do not introduce major
new systems").

## Focus management (Version 3, Phase 12 — "Accessibility & Comfort Pass")

Every modal-ish 2D surface — an `OverlayManager` panel, the Phone, the
computer's own `WorkstationPanel` — now shares one standard rather than
three independently-invented ones: `src/ui/focusTrap.js`'s
`createFocusTrap(containerEl)` returns `{ activate, deactivate }`.
`activate()` remembers whatever had focus beforehand, moves focus to the
container's own first focusable descendant, and keeps Tab/Shift+Tab
cycling within that set; `deactivate()` releases the cycling and restores
focus to whatever `activate()` remembered — the same "return exactly
where you were" a native `<dialog>` gives you for free. All three call
sites also carry `role="dialog"`/`aria-modal="true"` now.

**Two genuinely different lifecycles, one shared mechanism.** `Overlay
Manager`'s panels are ephemeral — a new DOM subtree per `open()`, removed
entirely on close — so nothing extra was needed there beyond
activate/deactivate at the right moments. The Phone and `WorkstationPanel`
are *persistent* DOM (built once, shown/hidden by CSS state) — both had
a real, standing bug this phase found and fixed alongside the trap
itself: neither one's own "closed" CSS state (`pointer-events: none` for
the computer; an off-screen `transform` for the Phone, plus a `.hidden`
class that turned out to have zero matching CSS at all — dead code
removed) actually prevented keyboard `Tab` from reaching their own
buttons. The native `inert` attribute, toggled alongside each one's own
existing open/close logic, closes that gap directly — it's not a design-
system pattern invented for its own sake, but the one thing a persistent,
sometimes-inert surface genuinely needs that an ephemeral one doesn't.

## Reduced motion, for real (same phase)

`tokens.css`'s own `prefers-reduced-motion` handling only ever zeroed
`--duration-fast`/`--duration-medium`/`--duration-slow` — real, but it
only ever reached CSS transitions that actually referenced one of those
tokens. This phase found and closed three separate gaps that left real
motion running regardless of the preference:

- **Two infinite CSS animations set their own duration directly in the
  shorthand**, never through a token, so the zeroing above never touched
  them at all: `.entry-status`'s own loading "breathe" pulse and the
  resident conversation's "thinking" dots. Both now get an explicit
  `animation: none` (settling at roughly the midpoint of their own
  animated range) under the same media query, added directly in
  `tokens.css` rather than duplicating the query in each surface's own
  file.
- **Two hardcoded transition durations never referenced a token at all**
  (`buildmode.css`'s legacy Builder Phone slide; a Browser Home tile
  hover) — one was a genuine inconsistency (the *current* Phone's
  identical slide already used `var(--duration-slow)`; the legacy one
  didn't), the other a plain, unrounded `0.15s`. Both now reference
  `--duration-fast`/`--duration-slow` directly, closing the gap for
  reduced motion as a side effect of simply being consistent.
- **Every JS-driven camera/panel tween ignored the preference
  entirely** — CSS duration tokens have no reach into `damp()`-eased
  values computed in JavaScript. `src/utils/motionPreference.js`'s
  `prefersReducedMotion()` is the one shared read (`matchMedia`, live —
  no caching or change-listener needed); five call sites now snap
  straight to target instead of easing when it's set:
  `CameraSystem._updateFocus()` (the single shared camera transition
  every "sit down" interaction — Computer, Workbench, Reading Chair —
  already routes through via `enterFocus()`/`exitFocus()`, making this
  the single highest-leverage fix of the five), its zoom and
  first/third-person blends, and `ComputerSystem`/`WorkbenchSystem`'s
  own screen/panel reveal fades. Deliberately *not* applied to core
  movement physics (walking acceleration, crouch height, landing) — see
  that file's own comment on why snapping those would make movement feel
  broken rather than more comfortable, which isn't what this preference
  is asking for.

## Label association, one counter (same phase)

Every Computer app builds its own rows out of shared helper functions —
`textRow`, `sliderRow`, `selectRow`, and the like — repeated with minor
variations across `SettingsApp.js`, `WardrobeApp.js`, `AIApp.js`,
`BuilderApp.js`, `BeingCreatorApp.js`, and `AnimationEditorApp.js`. Most
already associated their `<label>` correctly by nesting the control
*inside* it (`label.append(checkbox, text)`), which needs nothing extra.
The ones that instead built `<label>` and `<input>` as siblings
(`row.append(label, input)`) had no `for`/`id` pairing at all — a
screen reader announcing the control with no name, and a sighted mouse
user's habit of clicking a label to focus its field silently failing.

Fixing this needed exactly one shared thing: `src/utils/domIds.js`'s
`nextDomId(prefix)`, a single module-level counter handing out
`"field-1"`, `"field-2"`, … regardless of which app or which helper
calls it, so ids stay unique across every mounted Computer app rather
than each file reinventing its own counter (and risking collisions if
two apps ever mount at once). Each broken sibling pair now shares one
id generated once per row: `label.htmlFor = id; input.id = id;`.

One case didn't fit that pattern: `BeingCreatorApp.js`'s `vectorRow()`
labels a *group* of six controls (X/Y/Z, each a slider plus a paired
number input) under one heading, not a single label/single-control
pair. `for`/`id` has no way to express "these six inputs share this
name." That row instead gets `role="group"` and `aria-label` on the
wrapper, plus a per-axis `aria-label` (`"Position X"`, `"Position Y"`,
…) on each of the six controls themselves — the correct primitive for
a genuine one-to-many labeling relationship, not a workaround for the
one-to-one helper not fitting.

## The full ARIA sweep (Version 3, Phase 12, Wave 3 — same phase)

Waves 1 and 2 fixed labeling on the surfaces playtesting and a first
audit had already found. Wave 3 was the deliberately exhaustive pass —
two research agents individually audited every Phone app, the whole
`workshop://` Browser system (both the Computer and Phone chrome, and
the page content rendered inside it), and every remaining Computer app —
and it settled on a small, consistently-reused set of primitives rather
than a bespoke fix per surface:

- **Broken accessible names** — icon-only buttons (`aria-label` matching
  the existing `title`), unlabeled inputs (`aria-label`, or `nextDomId()`
  + `for`/`id` where a visible `<label>` already exists), untitled
  iframes (`iframe.title`, updated once the real page title is known).
- **Two more keyboard-trap bugs of the exact bug shape Wave 2's
  `WorkstationPanel`/`PhoneUI` fix already established** — a `<span
  onclick>` (or in one case a nested `<button>`) living *inside* another
  interactive element, invalid HTML that also means a keyboard user can
  reach the outer control but never the inner one. `BrowserApp.js`'s
  per-tab close control and `toolsPanelView.js`'s per-card pin toggle
  both got the same fix: pull the secondary control out to a real,
  independently-focusable sibling `<button>`. `createCloseButton()`
  (`src/ui/closeButton.js`) gained an optional `ariaLabel` override for
  this — its previous hardcoded `"Close"` name would have been identical,
  and ambiguous, across every tab.
- **`role="tab"`/`role="tablist"`, with real keyboard behaviour, not
  just the label.** Every custom tab bar in this codebase already
  conflates "focused" and "selected" (a click does both at once), so
  Left/Right/Home/End move *and* activate — no separate "focused but not
  yet selected" state to invent. `src/ui/tabList.js`'s
  `tabListTargetIndex(key, currentIndex, count)` is the one piece
  genuinely shared between `BrowserApp.js`'s tab strip and
  `toolsPanelView.js`'s two tab bars: the pure arrow-key-to-index
  arithmetic. Each call site still owns its own DOM, since every tab bar
  here already fully rebuilds itself on activation (the same `render()`
  pattern used throughout the project) — after simulating the click, the
  caller re-queries for the tab now occupying the target position and
  focuses it directly, rather than trying to preserve a stale element
  reference across the rebuild.
- **`role="group"` + `aria-labelledby`, for genuine one-to-many
  relationships** — a heading followed by a whole row of buttons, or (as
  Wave 2's `BeingCreatorApp.js` vectorRow already established) a set of
  radio options under one caption. Used consistently across the Phone
  apps' section headings, the Browser's tile grids (home page, asset
  library), and `toolsPanelView.js`'s radio/rows inputs.
- **`role="img"` + `aria-label` for swatches that are genuinely the only
  place a piece of information lives** — an object or Being part's own
  colour, previously conveyed only via a non-interactive `<div>`'s
  `title` attribute, which isn't reliably exposed to assistive tech on a
  non-focusable element.
- **`aria-current`/`aria-pressed`, only where the state is real and
  never stale.** The Wardrobe's active-outfit row and the Workshop app's
  weather buttons both have one persistent, discrete "current" value with
  a real change event to keep it live — both got the treatment. The
  Workshop app's Time-of-day buttons deliberately did **not**: `hour` is
  a continuously easing clock, not a discrete preset choice, so nothing
  would ever correctly stay "the current selection" the way weather does
  — see that file's own comment. Honest omission, not an oversight.
- **`aria-live="polite"`, scoped tightly.** Every region chosen updates
  on its own well-defined event (Bubble's 1-second status refresh, a
  calculator's result/validation panel, Media's now-playing strip, a
  Phone screen's own title on navigation) — never the whole panel a
  render() call happens to touch, which would turn frequent internal
  re-renders into announcement noise.
- **Disambiguating identical button names** — many list rows repeat the
  same action ("Open", "Remove", "Edit") once per row; every one of
  those got an `aria-label` folding in the row's own name (`` `Remove
  ${title}` ``) so a screen reader's own controls list doesn't read as a
  wall of identical, context-free buttons.

**Deliberately not done, and why:** rewriting the shared `metaRow()`
label/value pairs (used throughout the Browser's own page content) into
real `<dl>/<dt>/<dd>` markup, and unifying `WorkshopPages.js`'s `tile()`
with `AssetPages.js`'s near-identical `assetGrid()` into one shared
helper. Both are real, valid future improvements the audits surfaced —
but the first touches CSS across every page that currently styles
`.workshop-diagnostics-row`, and the second is a code-organisation
refactor with no accessibility difference from what Wave 3 already did
(both functions independently gained the same `role="group"` treatment),
not a labeling gap. Doing either now would have meant restructuring
working, already-correct markup for its own sake — exactly what this
project's own ground rules ask not to do.

## Known limitations / future opportunities

- **A handful of `4px` border-radius values in `workbench.css`** were
  deliberately left as literal values rather than rounded to the
  nearest token (`--radius-sm`, 3px) — a real, if tiny, visual change
  this phase couldn't verify by eye without being able to render it.
- **Phone lock screen** — considered, and deliberately left out. A real
  lock/unlock gesture would be new interaction surface for a phone that
  has no actual security concept to protect; the status bar and home
  indicator already deliver the "this looks like a real phone" read
  the brief asked for without inventing a mechanic nothing else in the
  Workshop needs.
- **Phone notifications** — no notification system exists, and building
  one (what would trigger it? what would it mean?) is a genuinely new
  feature, not a design-language refinement. Left as a named future
  opportunity rather than a fabricated visual with nothing real behind
  it.
- **A deeper, file-by-file pass across every remaining digital
  interface** (Browser, AI, Asset Library, Project Manager) for
  shadow/radius/spacing consolidation beyond the exact-match audit this
  phase performed — real, but a larger undertaking than one phase's own
  scope, and lower-risk to do incrementally than all at once.
