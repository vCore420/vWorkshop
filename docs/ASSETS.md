# The Workshop Asset System

"Each of these currently manages its own content. This phase is about
giving them a shared language... the Workshop should no longer care
where something came from. Only what it is." Before this phase, Objects,
Blueprints, Animations, Models, Images, and Music were six independent
libraries, each with its own real, working shape, each reachable through
its own app or page. This phase gives all six — and anything a future
kind or plugin adds — one shared vocabulary: a Workshop Asset. This
document covers that vocabulary and the service built on top of it;
`docs/HOST.md` covers where `AssetService` sits in the Host's own
architecture; `docs/BROWSER.md` covers how an asset becomes a page.

## Design philosophy, briefly

"If another Workshop system needed this tomorrow, could it naturally use
the same asset without knowing where it came from?" Three decisions
carry that:

1. **A wrapper, not a replacement.** `ObjectLibraryStore`,
   `BlueprintStore`, `AnimationLibraryStore`, and the rest all keep their
   own real, working internal shape — nothing about the Builder, the
   Animation Editor, or the Music Player changed. A Workshop Asset
   descriptor is a normalised envelope `AssetService.js` builds *around*
   whatever a kind's own item actually is, computed on demand, never
   written back onto the original object. Six independent, already-
   working systems didn't need a shared internal data structure to gain
   a shared *language* — they needed one place that could describe any
   of them the same way.
2. **Identity, not location.** "Avoid relying on filenames... reference
   assets by identity rather than location." Every asset has a stable id
   — `"<kind>:<item id>"` — built from an id each store already
   maintained for its own reasons, never a filename or a display name
   that could change.
3. **Honest about what's genuinely computed vs. genuinely deferred.**
   Dependencies, validation, and thumbnails are all real where real data
   already exists to build them from (Blueprints really do reference
   real Objects; an Object's own parts really do have real colours) and
   honestly absent where it doesn't (Models/Images/Music don't track
   dependencies yet, because nothing about them currently has any to
   track).

## Architecture: `WorkshopAssetSchema.js` + `AssetService.js`

Two files, the same shape-module-vs-consumer split every other Workshop
configuration already follows (`MemoryConfiguration.js`,
`EmbodimentConfiguration.js`, `TraitConfiguration.js`):

- **`src/host/WorkshopAssetSchema.js`** — the shape. A plain descriptor —
  `assetId`, `type`, `name`, `description`, `author`, `createdAt`,
  `updatedAt`, `version`, `categories`, `tags`, `thumbnail`,
  `dependencies` (`validationStatus`/`isFavourite` are added by
  `AssetService.js` itself, computed rather than stored) — plus
  `normalizeAssetDescriptor()` (fills in defaults for whatever a kind's
  own `toDescriptor()` left out) and `buildSwatchThumbnail()` (see
  "Thumbnails" below). Also `WORKSHOP_ASSET_CATEGORIES`, a *suggested*
  vocabulary (Furniture, Architecture, Nature, Lighting, Characters,
  Workshop, Tools, Effects) — not enforced, since `ObjectLibraryStore`
  and `AnimationLibraryStore` already have their own real category
  values that shouldn't be silently remapped.
- **`src/host/AssetService.js`** — the consumer, and the one place every
  other system actually talks to. `registerKind(id, {label, all, get,
  toDescriptor, getDependencies, validateItem})` is how a kind joins —
  `all`/`get` already existed (Workshop Platform phase); `toDescriptor`,
  `getDependencies`, and `validateItem` are new this phase, all optional,
  each with an honest default (an empty descriptor, no dependencies, no
  extra validation issues) for a kind that doesn't implement them.

`main.js`'s own "Workshop Platform" wiring block is where every built-in
kind actually registers — six calls, each handing over real functions
from a real, already-existing store. Nothing about `AssetService.js`
itself imports a single library store; it only ever calls the functions
it was given.

## Workshop Assets

"Every asset should share common information: Name, Asset Type, Unique
Asset ID, Description, Author, Creation Date, Modification Date,
Version, Categories, Tags, Thumbnail, Dependencies, Validation Status,
Metadata." Every one of these is a real field on the descriptor
`AssetService.describe(assetId)` returns:

- **Unique Asset ID** — `"<kind>:<item id>"` (`"objects:42"`,
  `"blueprints:blueprint-a1b2"`). Namespaced by kind specifically so two
  different kinds can never collide even if their own internal ids
  happen to coincide.
- **Author** — defaults to `"You"` (this is a single-player Workshop);
  a plugin-registered kind can (and the example one does) declare a
  different author in its own `toDescriptor()`.
- **Version** — defaults to `1` for every kind today; nothing currently
  increments it on edit (see "Known simplifications").
- **Categories** — always an array, even when a kind's own native data
  only has one (an Object's own `category` string becomes a
  single-element array). See "Categories & Tags" below.
- **Thumbnail** — see its own section below; genuinely real for two
  kinds, honestly `null` for the rest.
- **Validation Status** — `{valid, issues}`, computed fresh every time a
  descriptor is built, not cached — see "Validation" below.

## Asset Library

"This is NOT a filesystem browser. It is a Workshop library... the focus
should remain on creative discovery rather than directory navigation."
`asset://` (Browser Ecosystem phase's own canonical scheme;
`workshop://assets` keeps resolving as an alias) is the library itself —
Favourites and Recently Viewed at the top (both genuinely real, see
below), then one section per registered kind, each a live grid of tiles
built straight from `AssetService`'s own descriptors. Three kinds
(Objects, Blueprints, Animations) get real per-item detail pages;
kinds without one (Models, Images, Music, and any future or
plugin-registered kind) get an honest note instead of a grid of dead
links — see `docs/BROWSER.md`'s own "File Pages" section for the
Browser-facing account.

**Favourites and Recent are both genuinely real and persisted** — plain
sets of asset ids on `AssetService` itself
(`toggleFavourite()`/`isFavourite()`/`favourites()`,
`touch()`/`recent()`), no different in kind from
`ResidentPreferences.js`'s own affinity bags, just applied to assets
instead of places. Every asset detail page has a real star button;
`AssetPages.js`'s own `assetDetailPage()` calls `touch()` every time a
page actually resolves, so "Recently Viewed" reflects what's genuinely
been looked at, not everything that merely exists.

## Metadata

Covered above under "Workshop Assets" — the one thing worth adding here:
metadata is computed **on demand**, not stored. Calling
`assetService.describe("objects:42")` twice in a row does the same real
work twice (reads the object, re-derives categories/tags/dependencies,
re-runs validation) rather than reading a cached copy that could go
stale the moment the underlying object changes. At this Workshop's own
scale (a personal creative space, not a shared library serving many
users) this costs nothing worth optimising away.

## Categories & Tags

"Categories should organise assets at a high level... Tags should
provide flexible searching across every asset type." `categories` is a
short, curated list (ideally one, sometimes a couple) — the suggested
Workshop-wide vocabulary lives in `WORKSHOP_ASSET_CATEGORIES`
(`WorkshopAssetSchema.js`), though existing kinds keep their own real
category values rather than being forcibly remapped onto it (see "Design
philosophy" above). `tags` is deliberately unrestricted — freeform
strings, however many a kind's own `toDescriptor()` wants to attach
(an Object's own real tags array; a song's own artist and album, treated
as tags; a plugin's own `"example"` tag).

"The same search system should naturally work across the entire
Workshop" — see "Unified Search" below; both categories and tags feed the
identical `search()` method regardless of which kind an asset belongs
to.

## Unified Search

"Please establish a unified asset searching system... the player should
only need to learn one search experience." `AssetService.search(query)`
scans every registered kind's own descriptors and matches against name,
categories, and tags — one method, working identically for Objects,
Blueprints, a plugin's own stickers, or anything else that ever
registers a kind.

**This is the same search a person already uses for everything else.**
`workshop://search` (`docs/BROWSER.md`'s own "Unified Search" section)
merges `AssetService`'s own live results in alongside every registered
page, computed fresh on every visit — a definition built five minutes
ago is searchable immediately, not after the next reload. Typing
"star" into the address bar and pressing Enter finds the example
plugin's own Golden Star sticker exactly the way it finds any Workshop
page.

## Relationships & Dependencies

"Assets should begin understanding how they relate to one another...
models using materials, blueprints using models, animations using
skeletons, beings using models... a model depending upon a material, a
blueprint depending upon several models, a particle using textures, an
animation targeting a skeleton."

**What's genuinely real today**: a Blueprint's own dependency on the
Objects it's made of — `getDependencies(item)` for the `blueprints` kind
returns `["objects:3", "objects:7", ...]`, read straight from the
Blueprint's own real `objects` array (each entry's own `definitionId`).
This is the one relationship in the brief's own list of examples that
was already fully computable from real, existing data, so it's fully
real rather than a placeholder.

**What's honestly not tracked yet**: Materials, Textures, Skeletons, and
Particles don't exist as their own asset kinds yet, so "a model depending
on a material" or "an animation targeting a skeleton" has nothing real to
compute from. Every other registered kind's own `getDependencies()`
simply isn't provided, and `AssetService.js`'s own default is an
honestly empty array — never a fabricated relationship.

**The reverse direction, `getUsedBy(assetId)`**, is generic and doesn't
need each kind to maintain its own reverse index — it scans every
registered kind's own dependencies for a match. Visiting any Object's own
detail page shows every Blueprint that uses it, computed the same way,
automatically, the moment a `getDependencies()` function for some new
kind starts referencing it.

**Placement is a different relationship, deliberately kept separate.**
An Object's own detail page also shows how many times it's currently
*placed* in the Workshop (`WorldObjectsStore`) — genuinely useful, but a
different kind of relationship (an asset used in the *world*, not an
asset used by *another asset*), so it's shown under its own "Placement"
heading rather than folded into Dependencies/Used By.

## Validation

"The Workshop should quietly help the player identify potential problems
before assets are used... missing dependencies, invalid scale, missing
thumbnails, missing materials, unsupported formats." Every descriptor
carries a real `validationStatus`, computed fresh (not cached) every
time:

- **Missing dependencies** — generic, works for any kind: every id in
  `descriptor.dependencies` is checked against `AssetService.exists()`;
  a Blueprint referencing a since-deleted Object definition is flagged
  here, genuinely catching a real, possible problem, not a
  hypothetical one.
- **Missing thumbnail** — true for every kind that doesn't yet generate
  one (see "Thumbnails" below) — honestly, that's most of them today.
- **Invalid scale** — Objects specifically (`validateItem`): a
  non-finite or non-positive `defaultScale` is flagged.
- **No parts / no frames defined** — Objects and Animations
  respectively, via each kind's own `validateItem`.

"Missing materials," "unsupported formats," and "future Builder/plugin
validation" stay honestly out of scope — Materials don't exist as their
own kind yet, and format validation has nothing to check against without
a real import pipeline (see "Import Pipeline" below).

## Thumbnails

"Thumbnail generation... begin preparing the Workshop for future asset
optimisation." Genuinely real for two kinds, not a placeholder image:
`buildSwatchThumbnail()` (`WorkshopAssetSchema.js`) builds a small inline
SVG data URI from a handful of real colours — an Object's own part
colours, or the first colour of each distinct piece in a Blueprint. It
renders as an ordinary `<img>` anywhere a thumbnail is wanted, the
portable form of the same real swatch data `AssetPages.js`'s own detail
pages already render directly as coloured `<div>`s.

Every other kind (Animations, Models, Images, Music, and any
plugin-registered kind that doesn't call `buildSwatchThumbnail()` itself)
has `thumbnail: null` — honestly, since there's no real visual data to
build one from without an actual rendering step, which stays a future
extension point (see "Optimisation" below).

## Optimisation

"Begin preparing the Workshop for future asset optimisation... LOD
generation, collision generation, thumbnail generation, texture
optimisation, future mesh optimisation, future compression... the
architecture should be established even where complete implementations
are deferred." `AssetService.requestOptimization(assetId, kind)` exists
and throws a clear, honest error — the real seam a future Host Companion
capability (see `docs/HOST.md`'s own "The Workshop Host Companion"
section) would fill in, once optimisation work of any kind can safely
happen outside the browser.

## Import Pipeline

"Imported content should naturally become Workshop Assets... no
distinction should be necessary once an asset has entered the Workshop
ecosystem." This is already true by construction, not something this
phase had to add: since `AssetService` only ever asks a registered
kind's own `all()`/`get()` for whatever currently exists, any future
import mechanism that adds an item to `ObjectLibraryStore` (or any other
backing store) makes that item a Workshop Asset automatically, with zero
changes to `AssetService.js` itself. `requestImport(sourcePath)` exists
as the honest, not-yet-implemented entry point for *bringing in* a file
from outside the Workshop in the first place (see `docs/HOST.md`'s own
Files/Documents sections for the filesystem side of this) —
`requestExport(assetId, destinationPath)` is its honest counterpart for
the other direction.

## Plugin Integration

"Plugins should naturally register Workshop Assets... assets installed
through plugins should appear inside the Workshop Asset Library exactly
like native assets." `src/host/PluginRegistry.js` gained a second,
optional method alongside `providePages()` — `provideAssets(assetService)`,
called once, immediately, handing a plugin the real `AssetService` to
call `registerKind()` against directly, no translation layer. See
`docs/PLUGIN_GUIDE.md`'s own "Adding your own Workshop Asset" section for
the full contract, and `src/plugins/examples/examplePagePlugin.js` for a
real, working example — three small "sticker" assets that appear in
`asset://`, `workshop://search`, and everywhere else a Workshop Asset
shows up, exactly like a native Object or Blueprint would.

## How future Workshop systems should interact with this

The short version: **register a kind, don't reinvent one.** Any future
creative system — Materials, Textures, Particles, Sounds, Behaviours, a
future Being Creator 2.0, a future AI-generated asset pipeline — should
reach for `assetService.registerKind()` the same six calls in `main.js`
already demonstrate, rather than building its own parallel notion of
"browse what exists," "search for something," or "show me a detail
page." The four functions a kind can provide
(`toDescriptor`/`getDependencies`/`validateItem`, plus the pre-existing
`all`/`get`) are the entire contract; a kind that only implements `all`/
`get` still works everywhere, just with a minimal descriptor.

## Known simplifications (by design, for this phase)

- **Only three kinds (Objects, Blueprints, Animations) have real detail
  pages** — Models, Images, Music, and any plugin-registered kind are
  fully described, searchable, and favouritable, but don't have their
  own dedicated Browser page yet.
- **Only one real dependency relationship exists** — Blueprints
  depending on Objects. Every other kind's `getDependencies()` is
  honestly unimplemented, not fabricated.
- **Version numbers never change** — every asset reports version `1`;
  nothing increments it on edit yet.
- **Thumbnails are real for two kinds, `null` for the rest** — see
  "Thumbnails" above.
- **No real import/export/optimisation** — all three throw honest,
  named errors; see their own sections above for exactly what a future
  implementation would need to fill in.
- **Materials, Textures, Particles, Sounds, Behaviours have no dedicated
  kind yet** — named explicitly in this phase's own brief as future
  asset types; each is one `registerKind()` call away the moment a real
  backing store exists for any of them.

## Future extension points

- **Per-category-configurable validation rules**, once there's a design
  for which checks matter for which kind beyond the handful implemented
  today.
- **Real thumbnails for every kind** — a genuine rendered preview for
  Models specifically would be the most valuable next one, likely
  reusing `ModelLoader.js` the same way Beings already do, once
  rendering a preview outside the main 3D scene has a real design.
- **Materials, Textures, Particles, Sounds, Behaviours** as real,
  dedicated asset kinds, the moment each has a genuine backing store —
  see "How future Workshop systems should interact with this" above.
- **A real import pipeline**, once the Workshop Host Companion (see
  `docs/HOST.md`) grows a safe way to bring an external file in — see
  "Import Pipeline" above for what's already prepared to receive it.
- **Version numbers that actually increment on edit**, once each
  backing store's own edit path is ready to bump one.
- **Dependency-aware deletion warnings** — since `getUsedBy()` already
  answers "would deleting this break something," a future phase could
  surface that warning at the actual moment of deletion (in the Builder,
  say), not only on an asset's own Browser page.
