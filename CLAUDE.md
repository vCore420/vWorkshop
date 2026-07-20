# CLAUDE.md — Working on the Workshop

This file is the entry point for repository-first development (Version 3
onward, primarily via Claude Code). It exists so that an engineer — human
or AI — who has *only this repository and no prior conversations* can
become productive without re-deriving decisions that were made
deliberately. Everything here is a pointer or a rule, not a duplicate:
the real explanations live in `docs/`, and this file tells you which one
to read before touching what.

## What this is (one paragraph)

The Workshop is a creative operating system where software becomes
places instead of windows, features become tools instead of
applications, and projects become journeys instead of files. It is a
zero-build, no-backend Three.js browser application: plain ES modules,
no framework, no bundler, deployable by pushing static files. It is not
a game, and there is no win state. Read `docs/HANDBOOK.md` before your
first change — it is short, and it is the philosophy everything else
enforces. 
Its purpose is not to maximise interaction.
Its purpose is to become somewhere worth returning to.

## Ground rules (non-negotiable)

1. **No build step, no backend, no framework.** Anything that requires
   `npm install` to *run* (as opposed to optional tooling) breaks the
   project's deployment story. Three.js loads from a CDN via the import
   map in `index.html`.
2. **Read the file before trusting your memory of it.** The codebase is
   ~50,000 hand-written lines across ~260 files under `src/` alone (a
   Version 3 close-out audit measured this directly rather than trusting
   the previous figure, which had already drifted). Every previous
   version's closing retrospective (in `docs/HISTORY.md`) names this as
   the single most important habit, and all of them were right —
   including about this exact number quietly going stale.
3. **One implementation, several doors in.** Before building a second
   version of anything — a second form renderer, a second settings
   surface, a second way to browse a list — check whether an existing
   implementation can grow a new entry point instead. The Wardrobe, the
   Tools toolbox, and `workshop://` doc pages are the proof this is
   almost always cheaper and always more consistent.
4. **Honest limitations over dishonest completeness.** Every placeholder
   says it's a placeholder. Every deferred feature says why it was
   deferred, in the code comment or the phase account. Never ship a
   button that pretends.
5. **Root cause, not the symptom as reported.** The project's history is
   full of bugs whose real cause was one layer away from where the
   symptom pointed. Trace one level further down before fixing.
6. **Say what's already fine.** If a brief names ten concerns and six
   turn out to need no change, report that plainly. It is what makes the
   other four credible.
7. **A docstring is a promise.** When you change a mechanism, sweep for
   every comment and doc that describes the old one — `grep` for the old
   event names, method names, and file names before you're done. The
   drift pattern that survived into v2.2.3d (Build Mode's Phone
   migration leaving five stale descriptions of its old contract) is the
   canonical example of what this rule prevents.
8. **Connect before adding.**
   Whenever possible, extend an existing pathway before creating a new
   one. A new door into an existing room is usually better than another
   room that solves the same problem.

## Where things live

`docs/ARCHITECTURE.md` is the structural map — directory layout, the
engine loop and system registration order (order matters; read that
section before adding a system), the ECS-lite, the interaction pipeline,
and the persistence model. Do not add a system, an interactable, or a
persisted store without reading the matching section first.

Per-domain docs are one-per-concern and named for it: `COMPUTER`,
`WORKBENCH`, `WORLDBUILDER`, `WORLD`, `MUSIC`, `PLAYER`, `ANIMATION`,
`AI`, `RESIDENT`, `HOST`, `ASSETS`, `BEINGS`, `PHONE`, `BROWSER`,
`TOOLS`, `ATMOSPHERE`, `AUDIO`, `DIAGNOSTICS`, `PERSISTENCE`,
`PERFORMANCE`, `RESPONSIVE`, `DESIGN_SYSTEM`, `VISUAL_IDENTITY`,
`FURNITURE`, `POLISH`, `REFINEMENT`, `PLUGIN_SDK`, `PLUGIN_GUIDE`,
`SETUP`. The rule: **before editing a folder under `src/`, read the doc
its files point to in their own headers.** Nearly every file's opening
comment names its doc.

`docs/HISTORY.md` is the full phase-by-phase story, including both
versions' closing reflections and the Version 2 → 3 handover notes.
`docs/ROADMAP.md` is the per-phase account of everything built so far;
`docs/ROADMAP_V3.md` is the independent reviewer's draft of where
Version 3 could naturally go (a recommendation, not a commitment).
`docs/ROADMAP_V4.md` is the equivalent draft for Version 4, written from
a full Version 3 codebase sweep (dead code, duplication, docs-mined
future work, a judgment pass on what still feels unfinished) rather than
invented fresh — same status: a recommendation, not a commitment.
`docs/RELEASE_REVIEW.md` is the v2.2.3d independent release assessment.
`docs/CONTRIBUTIONS.md` is a standing record, not a phase account: each
model that has worked on this codebase has been offered the chance to add
one deliberate, judgment-driven contribution of their own choosing and
log it there. Read it for a sense of what past sessions believed the
Workshop was missing, and add your own entry if you're ever offered the
same opportunity.

## Conventions

- **Systems** are plain objects/classes with `init(engine)` and
  `update(dt)`, registered in `src/main.js` in a deliberate order.
  `main.js` is wiring only — construct, register, start; no behaviour.
- **Communication is the EventBus** (`engine.events`). Systems never
  call each other directly except via `engine.getSystem(Class)` lookups
  documented in `ARCHITECTURE.md`. Event names are `noun:verb`
  lowercase (`persistence:saved`, `phone:opened`). If you emit a new
  event, document who listens — and if nothing does yet, say so in the
  emitting file's comment (see `BuildModeSystem.enter()` for the
  honest-unheard-signal pattern).
- **Persistence**: systems save via `persistence:save`/`persistence:load`
  events; plain stores register as providers. `StorageUtils` is the only
  thing that touches `localStorage`; IndexedDB is reserved for the four
  documented binary/handle stores. Bump `CURRENT_SAVE_VERSION` and add a
  migration *only* if a change alters what existing data means — new
  fields don't need one.
- **Naming**: files are `PascalCase.js` for classes/systems,
  `camelCase.js` for function-collection modules; furniture and Phone
  apps register through their folder's `registry.js`. "App" is the
  established term for computer/phone applications — reviewed twice and
  deliberately kept; don't churn it.
- **Comments explain *why*, and cite their phase.** The house style
  quotes the phase brief that motivated a change and names the doc that
  tells the fuller story. Keep doing this — it is why the codebase is
  legible at all.
- **CSS**: one file per interface surface in `css/`; design tokens live
  in `css/tokens.css` and nothing hardcodes a value a token already
  defines (`docs/DESIGN_SYSTEM.md`). If you add a stylesheet to
  `index.html`, add it to `service-worker.js`'s `SHELL_URLS` too — that
  list drifted once already.
- **No binary assets** except the PWA icons — geometry, textures, and
  sounds are generated in code through `PlaceholderFactory`,
  `ProceduralTexture`, and `AudioSynth` (`assets/README.md` explains the
  plan for when that changes).

## Workflow (how phases work)

Development proceeds in **phases**: a brief, an implementation pass, and
a release. Every phase ends with all of:

1. A version bump in `package.json` (`2.X.Y` with letter suffixes for
   sub-phases, e.g. `2.2.3d`).
2. A phase account appended to `docs/ROADMAP.md` and a changelog entry
   in `docs/HISTORY.md`'s collapsed changelog.
3. Updates to every doc the change touches — including this one, if a
   convention changed.
4. A work summary that names: what was built, what was deferred *and
   why* (deferrals always carry a named reason), and an honest
   reflection on impact — including anything reviewed and found already
   fine.
5. A versioned zip release of the repository.

**Testing philosophy**: there is no test runner, deliberately — the
project predates one and a harness would compromise zero-build
simplicity for coverage the playtest loop already provides. The
verification bar instead is: `node --check` every touched file, a
scripted sweep when a claim is checkable (dead exports, token
references, import resolution — see `docs/REFINEMENT.md`'s audits for
the precedents), and a real playtest of the touched workflow in a
browser (`python3 -m http.server 8000`). If Version 3 introduces logic
complex enough to want real unit tests (the formula evaluator and save
migrations are the standing candidates), that decision should be its own
phase, not a side effect. **Read `.claude/DEV_NOTES.md` before a browser
playtest, not after one goes sideways** — it names real dev-environment
gotchas (Service Worker/ES-module staleness, screenshot reliability, how
to drive the live engine and mount app UI directly for verification) that
have already cost real time to diagnose once; it is kept up to date for
exactly this reason.

## Before you finish any change

- `node --check` every `.js` file you touched.
- `grep` for every event name, method, or file you renamed or rerouted —
  in `src/`, `docs/`, and `README.md` — and fix every stale description.
- If you added/removed a doc, update `docs/ARCHITECTURE.md`'s docs index.
- If you changed what saved data means, write the migration.
- Ask: does this strengthen the Workshop's identity as a *place*, or is
  it a feature bolted onto the side? If the honest answer is the second,
  stop and reread `docs/HANDBOOK.md`.
