# Furniture & Storage

Every general-purpose piece of furniture in the room lives in
`src/entities/furniture/` — one file per piece, collected by
`registry.js` the same way every other pluggable list in this project
works (`registerFurniture()` lets a plugin add a new piece without
editing the registry file itself; see `docs/ARCHITECTURE.md`). The
Workbench and the Computer desk each earned their own dedicated
craftsmanship pass and their own doc (`docs/WORKBENCH.md`,
`docs/COMPUTER.md`); everything else that furnishes the room — the
shelving, the tool storage, the pinboard, the wardrobe, the sitting
area, the music cabinet, and the standalone notebook prop — never had a
single place describing it, beyond a few lines each in the README. This
document is that place.

If you only read one thing: every piece here is built the same way
every other furniture definition in the project is — geometry from
`PlaceholderFactory.js`'s `box()`/`cylinder()`/`sphere()` helpers and
`Materials.*` factories, an `interaction` block wired through
`FurnitureSystem` (see `docs/ARCHITECTURE.md`'s "interaction pipeline"),
and either a generic `overlayId` (most of what's here) or a
self-contained `onInteract`/`onExit` pair (only the computer and
workbench need that; see those objects' own docs for why).

## The pieces

- **`Shelving.js`** — "documentation and project archives." A wooden
  frame, four shelves, and a scattering of book/box placeholders.
  Opens `overlayId: "archive"`, showing every finished project's title,
  notes, and saved calculations (`ArchiveOverlay.js`'s own
  `buildArchiveContent()`), with an honest empty state when there's
  nothing to archive yet.
- **`ToolStorage.js`** — a pegboard and a three-drawer cabinet. No
  inventory system behind it; the interaction says so directly rather
  than faking one.
- **`Pinboard.js`** — a wall-mounted corkboard reflecting every project
  in `ProjectsStore` that isn't finished yet (planning and active alike),
  the fuller picture next to the Workbench's own narrower "what's
  currently active" view. Version 3, Phase 9 ("Creative Flow") stopped
  showing `"done"` projects here — a long-running Workshop's cork board
  would otherwise accumulate months of finished notes alongside
  genuinely active planning, duplicating the Archive (`ArchiveOverlay.js`),
  which already exists specifically to hold finished work. See
  `PinboardOverlay.js`'s own comment for the full reasoning.
- **`Wardrobe.js`** — a physical entry point into the exact same
  Wardrobe app the computer already has (see its own file comment for
  why there's deliberately no second appearance system here), plus a
  full-height mirror — the first real payoff of `ReflectionSystem`'s
  generic reflection capability.
- **`SittingArea.js`** — an armchair, a rug, and a side table. Version 3,
  Phase 3 ("The Reading Chair") gave it its first real quiet-corner
  behaviour: sitting down still shows the same calm arrival reminder, and
  once it's dismissed a small "Read" tab offers "The Workshop's Story"
  (the same `docs/HISTORY.md` content `workshop://history` shows) and
  "The Archive" (the same finished-project content `Shelving.js`'s own
  overlay shows) — both swapped into the same reading panel rather than a
  second interactable. See `RestNookOverlay.js` and this document's own
  "Version 3, Phase 3" account below. Version 3, Phase 4 ("Workshop
  Rituals") gave it a second, smaller behaviour: opening the reading
  panel fresh now offers whichever of Story/Archive was last actually
  read, rather than always resetting to the neutral menu — see this
  document's own "Version 3, Phase 4" account below.
- **`MusicCabinet.js`** — already given its own full redesign pass in an
  earlier phase (replacing the original stand-in stereo); this phase
  only reviewed it for material accuracy.
- **`Notebook.js`** — a small standalone prop on the workbench, already
  corrected (Workbench phase) for a real interaction-anchor bug and
  already using `fabric()`/`rubber()` rather than a generic `matte()`.

## Craftsmanship (Version 2, Phase 18) — Furniture & Storage

"Every object should communicate purpose... the Workshop should feel
organised because somebody works here, not because somebody decorated
it." The fourth craftsmanship phase in a row (after the Workbench, the
Desk, and the Workshop Interior), and the first to span several objects
at once rather than one — the same discipline applied at a smaller
scale per piece: keep position and purpose fixed, spend the budget on
material accuracy and one or two real storytelling details, and resolve
any genuine dead code or inconsistency found along the way.

**Tool storage: shadow-board silhouettes.** The single most on-theme
addition this phase — a real pegboard's whole reason for existing is
that a glance tells you whether something's missing. Each of the three
tools now hangs in front of a painted silhouette patch roughly matching
its own bounding shape, so an empty hook would read as "the wrench is
out" rather than just an empty hook. The middle drawer also sits pulled
open by a few centimetres, as if just used — "environmental
storytelling... frequently opened drawers" made literal, and the phase's
single restrained detail on that object.

**Shelving: a shelf's worth of real storage, a cap, and a genuine
dead-code fix.** One shelf (at the easiest reach height — not the top,
which is a stretch, or the bottom, which is a crouch) now holds a run
of matching, labelled plastic storage bins instead of loose books —
"logical grouping" made literal. A plain overhanging cap trim joins the
Workshop Interior phase's own baseboards as the same "this was actually
built" cue, applied here instead of the room shell. Along the way:
`shelfColors` (four near-identical wood browns) turned out to already
be doing double duty as the book/box item palette, while a second,
genuinely varied array — `itemColors`, clearly meant for exactly that —
sat completely unused behind a `void` statement. Rather than deleting
the orphaned array (there was nothing actually wrong with it, unlike
`softBox()` two phases ago), each array got a real, distinct purpose:
the varied palette now colours the books and boxes, and the wood-tone
array now varies each shelf board's own tint.

**Pinboard: a real cork material.** `Materials.cork()` and its own
`corkTexture()` join `PlaceholderFactory.js`'s existing set — built the
same way `concreteTexture()` already is (randomly placed, randomly
sized, faint arcs), tuned for cork's own warmer, blotchier mottling
rather than concrete's fine speckle. Each pinned note is now actually
held up by a small push pin rather than floating against the board on
its own.

**Wardrobe: a cornice and real door panels.** The same cornice-cap
family Shelving.js gained this phase, plus two raised door panels
either side of the existing seam line — a flat slab with just a groove
in it reads as "a box," not "a wardrobe with doors."

**Sitting area: a cushion tier, a real table foot, and one book.** The
seat gained a separate, slightly smaller cushion on top of its own
frame — the same "an upholstered base plus a real cushion reads as
padded" idea the Desk phase's office chair already established — and
the side table's bare pedestal leg gained a proper foot wider than the
leg itself. One closed book, resting near the table's own edge, is the
object's entire environmental-storytelling addition — "a reading corner
someone actually uses," made with a single prop rather than a still
life.

**Music cabinet: two small material fixes, nothing else.** Already
given its own full redesign in an earlier phase; this pass only found
two real gaps — the vinyl record on the turntable was `matte()` (real
vinyl is glossy) and each speaker's cone surround was too, where a
speaker's own surround is genuinely rubber. Both fixed; everything else
about the object was left exactly as it was.

**Music cabinet, again (Decorative Details phase) — one more small
fix.** `Materials.ceramic()`, added that phase for the Workshop's plant
pots generally, replaced the cabinet's own plant pot's `matte()` call
too — see `docs/WORLD.md`'s own "Craftsmanship (Version 2, Phase 19)"
section for the full account of that phase's work, most of which lives
in the room shell rather than here.

**Version 3, Phase 2 ("Living Spaces") — three real bugs, found by a
full environmental review rather than assumed away.** Shelving's own
book-packing loop always started its cursor at the same fixed left
offset and used a fixed gap between items, so the "logical grouping"
storage bins above got the shelf's full width but the ordinary book/box
shelves never did — every one of them only ever filled the first
35-40% of its own width, regardless of shelf index, leaving the rest
visibly bare. The same items now spread across the shelf's real usable
width, keeping the exact same restrained item count — a placement bug,
not a "needs more clutter" one. The music cabinet's stored vinyl records
were positioned at the storage compartment's own vertical *centre*, plus
an unexplained nudge, never actually checked against either the shelf
below or the shelf above — they floated ~3.75cm above the surface they
were meant to rest on while simultaneously grazing the shelf above.
Now rest flush on the real surface. The turntable's own record label
was positioned from a second, independently hand-computed offset that
quietly drifted from the vinyl record's own — mostly embedded in the
record rather than resting on it — now derived directly from the
record's own already-correct position instead. And the sitting area's
side table, footprint-comment notwithstanding ("small enough to allow
minor overlap"), turned out to have no collision at all — checking the
real numbers found it sitting entirely outside the declared footprint,
not merely overlapping it. `FurnitureSystem._computeFootprintBox()`
gained an optional `offset` field for exactly this "two objects with no
shared natural centre" case (see `docs/ARCHITECTURE.md`'s own footprint
account); the sitting area's own footprint now tightly covers the real
combined bounds of chair and table, confirmed against the actual built
mesh geometry rather than trusted by construction.

**Version 3, Phase 3 ("The Reading Chair") — two more real Shelving
fixes, found while investigating the reading corner.** The top shelf's
own items clipped through the cap trim above it — confirmed by the
actual numbers, not just eyeballed: every shelf except the top one
enjoyed a full `shelfSpacing` (0.6m) of headroom before the next
shelf's own board; the top shelf only ever had 0.135m before the cap,
since the frame's overall `height` was sized to just clear the top
shelf's own boards with the cap sitting directly above, not to
preserve the same headroom pattern every other shelf gets. Even the
*shortest* possible item on the top shelf (0.18m tall) already
overshot the cap's own bottom face; the tallest (0.24m) poked through
the cap entirely, book and cap genuinely occupying the same space.
Fixed by decoupling the frame's overall height from shelf spacing
(`shelfSpacing`, still exactly `0.6` between every shelf, unchanged)
and sizing it instead so the top shelf gets the same ~0.57m clearance
(spacing minus a shelf board's own thickness) to the cap that every
other shelf already gets to the shelf above it — `height = 2.535` (up
from `2.1`, roughly 43.5cm/20% taller overall; still comfortably under
the room's own 3m ceiling), confirmed against the real built mesh
bounding boxes rather than trusted by the arithmetic alone. Separately:
the book-packing fix two phases ago correctly filled each shelf's own
usable width, but did it with one perfectly even, mechanically-computed
gap between every item — which reads as assembled-by-formula rather
than shelved by hand over time. Now fixed the same way: the same total
item count and the same overall usable-width coverage, but the leftover
gap space is distributed with randomised (squared-random, skewing
toward small gaps with occasional larger breaks) rather than uniform
weights per gap, so items bunch into a few natural-looking clusters
instead of a comb.

**Version 3, Phase 11 ("Workshop Character") — a small pot plant on the
top shelf.** The book cluster on every non-bin shelf always spans
exactly the shelf's own `usableWidth` (±0.45 from centre — deterministic
regardless of the randomised gap distribution above, since the
randomness only redistributes the leftover space *within* that fixed
span, never the span itself), and the frame posts' own inner face sits
at ±0.53 — leaving a real, fixed, always-empty 0.08m corridor at each
end of every book shelf. The plant (a small ceramic pot plus five
radially-arranged leaf spheres, the same shape `MusicCabinet.js`'s own
cabinet-top plant already used, scaled down to actually fit this
corridor) sits in the top shelf's right-hand one. Getting the fit
genuinely right needed one real correction beyond the arithmetic above:
a leaf's own rotation (the same tilt the reference pattern already
applies, so the leaves don't all point identically straight up) grows
its axis-aligned bounding box beyond its unrotated radius — an initial
sizing that looked correct by hand computation still clipped the frame
post by about 2mm once checked against the real generated mesh's own
`Box3`, not the geometry parameters alone. Shrunk further and
reconfirmed with a real overlap check (`Box3.intersectsBox()` against
every other mesh on the shelf) rather than trusted by arithmetic a
second time.

**Version 3, Phase 3 ("The Reading Chair") — the sitting area's own
quiet-corner bugs, and a shared reading panel.** Two real, stacked bugs
kept the sitting area from ever doing what its own `allowLookAround:
true` focus pose asked for: `FurnitureSystem._resolveFocusPose()` only
ever returned `{position, lookAt}`, silently dropping every other field
a `focusPoseLocal` declared, so the runtime focus pose `CameraSystem`
actually received never carried `allowLookAround` at all; and even with
that fixed, both `main.js`'s own canvas click handler (re-acquiring
pointer lock) and `PhoneSystem.open()`'s own guard refused to act while
*any* interaction was active, a check written for the computer/
workbench's fully fixed camera that never distinguished a relaxed,
look-around-permitting one from theirs. `InteractionSystem` now exposes
`activeAllowsLookAround` as the one shared place that distinction
lives; see `docs/ARCHITECTURE.md`'s interaction-pipeline section for the
fuller mechanism. On top of that fix, the sitting area gained its first
real behaviour: once the arrival reminder is dismissed, a small "Read"
tab reveals a reading panel offering "The Workshop's Story" (reusing
`WorkshopPages.js`'s own `fetchText()` and `SimpleMarkdown.js`'s
`renderMarkdown()` directly, skipping `PageShell.wrapPage()`'s
iframe-document wrapping since this is a real in-page DOM panel) and
"The Archive" (reusing `ArchiveOverlay.js`'s own `buildArchiveContent()`
verbatim, so the chair and the shelf show the exact same archive). This
is the "narrow" mechanism the phase's own planning settled on — a
button inside the chair's own reading panel, no change to
`InteractionSystem`'s suspension logic and no second interactable.
`ArchiveOverlay.js` itself was enriched at the same time: a finished
project's full `notes` and every saved `calculations` entry are now
shown, not just its title and finished date.

**Version 3, Phase 4 ("Workshop Rituals") — a new small, generic
capability, and the reading chair's first use of it.** "Sitting at the
same chair" becoming a genuine habit needed somewhere to remember *how*
a piece was last used, not just where it's placed — `FurnitureSystem`
gained `getInteractionState(pieceId)`/`setInteractionState(pieceId,
patch)`, a plain per-piece bag persisted alongside its existing
`overrides`, the same "one small, generic capability, multiple
independent callers" shape `ReflectionSystem.registerSurface()` and
`LadderSystem.registerLadder()` already established. `RestNookOverlay.js`
is the first caller: opening the reading panel now checks
`getInteractionState("sittingArea")` and offers whichever of
Story/Archive was last actually read, first, instead of always resetting
to the neutral menu — genuinely picking up the same book, not just
resuming a generic screen. Backing out to the menu with "Back" doesn't
clear this; the memory is what was last *read*, not what screen happened
to be open. Any future piece needing similarly small "remember how I was
last used" memory has somewhere to put it without inventing a new store.

**What was considered and deliberately left out (resolved, Sound &
Presence phase).** A drawer/cabinet interaction sound (paralleling the
paper shuffle, chair creak, and door creak from the last two phases)
was considered for the tool storage cabinet specifically, and left out
here for exactly the reason described above — no dedicated system to
own it without either building a small system this phase's own brief
ruled out, or a furniture file reaching directly into `AudioSystem`.
The Sound & Presence phase resolved this generically rather than
bending this phase's own scope: `FurnitureSystem` — the one system that
already wires up every furniture piece's interaction — gained an
optional `soundOnInteract` field, so the system that already owns this
behaviour is what plays the sound, not the furniture file. See
`docs/AUDIO.md` for the full account.

## Known simplifications (by design, for this phase)

- **Tool shadows are flat painted patches**, not real cut-foam geometry
  or a shape genuinely matching each tool's silhouette — a rectangular
  bounding approximation, the same "believable, not photoreal" standard
  every placeholder here already holds itself to.
- **Only one shelf holds bins; the rest stay loose books** — a single,
  clearly-organised shelf reads as "this person does have a system," a
  fully bin-lined unit would read as sterile storage, not an archive.
- **No inventory, no drawer contents, no way to actually open a
  drawer or door** — every object here remains a placeholder for a
  future capability where one doesn't already exist (see each piece's
  own file comment), consistent with `docs/HOST.md`'s and
  `docs/WORLDBUILDER.md`'s own honest-placeholder standard elsewhere in
  the project.

## Future extension points

- **A real inventory/storage system** — should one ever get built, tool
  storage's cabinet and shelving's new bins are both already sitting
  exactly where such a system's own physical presence would live.
- **Crown moulding on the shelving/wardrobe**, if a future pass wants
  the two matched more closely to the room's own baseboard trim.
