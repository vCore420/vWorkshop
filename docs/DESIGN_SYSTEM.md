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

**A home indicator.** A thin pill at the very bottom of the screen,
purely cosmetic — the one visual cue that says "touchscreen" every
modern phone shares, without needing an actual gesture system behind
it.

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
