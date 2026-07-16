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
  Opens `overlayId: "archive"`, an honest, currently-empty list of
  every `status === "done"` project.
- **`ToolStorage.js`** — a pegboard and a three-drawer cabinet. No
  inventory system behind it; the interaction says so directly rather
  than faking one.
- **`Pinboard.js`** — a wall-mounted corkboard reflecting every project
  in `ProjectsStore` regardless of status, the fuller picture next to
  the Workbench's own narrower "what's currently active" view.
- **`Wardrobe.js`** — a physical entry point into the exact same
  Wardrobe app the computer already has (see its own file comment for
  why there's deliberately no second appearance system here), plus a
  full-height mirror — the first real payoff of `ReflectionSystem`'s
  generic reflection capability.
- **`SittingArea.js`** — an armchair, a rug, and a side table. Explicitly
  reserved for something quieter later (see its own comment); comfortable
  *now* regardless of what that turns out to be.
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

**What was considered and deliberately left out.** A drawer/cabinet
interaction sound (paralleling the paper shuffle, chair creak, and door
creak from the last two phases) was considered for the tool storage
cabinet specifically. Unlike those three, tool storage has no dedicated
system of its own — it opens through the generic `overlayId` pipeline,
not a self-contained `onInteract`/`onExit` pair — so adding one sound
here would mean either building a small system this phase's own brief
explicitly ruled out, or having a furniture *definition* file reach
directly into `AudioSystem`, breaking the "furniture files describe
geometry and emit events; systems own behaviour" split every other
object in this project respects. Left for a future phase that's
actually about interaction sound, rather than bent into this one.

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
- **A drawer/cabinet interaction sound**, once there's a natural system
  home for it (see "What was considered and deliberately left out"
  above).
- **Crown moulding on the shelving/wardrobe**, if a future pass wants
  the two matched more closely to the room's own baseboard trim.
