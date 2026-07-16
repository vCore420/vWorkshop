# Workshop Tools (Version 2, Phase 22 — v2.2.2)

"Software should continue becoming places instead of windows. Features
should begin becoming tools instead of applications." This phase gave
the Workshop its first real collection of practical tools — calculators
ported from a genuine external application, a shared toolbox reachable
two physical ways, real integration with projects and the Workbench, and
the foundations of a Calculator Builder for making new ones from inside
the Workshop itself.

## Overview

Three new files at the centre of everything: `src/tools/NativeCalculators.js`
(the ported calculators), `src/tools/ToolsStore.js` (custom calculators,
pins, recent runs — the persisted state), and
`src/ui/overlays/shared/toolsPanelView.js` (the one shared UI — browse,
run, build — that both physical entry points use).

**Two entry points, one toolbox.** Exactly the shape `Wardrobe.js`
already established for the Wardrobe app: `ToolStorageOverlay.js` (the
physical tool cabinet) and `ToolsApp.js` (the computer's own Tools tab)
both call the same `mountToolsPanel()`. Neither knows the other exists.
A third way in exists too: the Workbench's own clipboard panel gained an
"Open Tools" button (see "Workbench integration" below), which opens the
identical toolbox rather than a fourth implementation.

## The native calculator library

`NATIVE_CALCULATORS` in `NativeCalculators.js` — eleven calculators,
ported from a real security/screen-door manufacturer's own production
application (the attached `calculators.js`, `maxRects.js`), grouped into
the same three categories that application's own comments already used:

- **Sales** — B/O Door Calculator, Internal Door Calculator (sizing from
  daylight measurements, for a first measure).
- **Manufacturing** — Crim Mesh Size, Main Door Cutting/Making, Main
  Slider Cutting/Making, Stock Optimiser, Mesh Sheet Optimiser.
- **Installer** — Even Hole Spacing, B/O Nesting Channel Spacing, Pleated
  Screen Fixings, Ziptrak Spring Tension/Turns.

Every `calculate()` function is the *real* business logic, preserved
exactly — genuine measurements and formulas a real workshop depends on,
not samples invented for this project. What changed is everything
*around* the math. The brief was explicit: "do not recreate the original
application's interface... each calculator should feel like a Workshop
tool rather than an imported application." Concretely, that meant not
porting:

- The original's IndexedDB-backed calculator history (replaced by
  `ToolsStore.recent` — see below, a simpler, unified rolling log rather
  than a separate per-calculator IndexedDB store).
- The original's hand-built form DOM and CSS (replaced by
  `ToolsPanelView.js`'s own generic, schema-driven form renderer, styled
  to match the rest of the Workshop's screens).
- A floating "quick calculator" bubble, unrelated to any specific trade
  calculation — considered and left out; "Basic formula" (see Calculator
  Builder templates, below) already covers the same ground as a genuine
  Workshop asset instead of a fixed UI widget.
- The original's own Planner (a Kanban job board) — see "Why no Planner"
  below; this is the one deliberate, larger architectural decision this
  phase made rather than a straightforward port.

The Mesh Sheet Optimiser's own packing engine, `maxRects.js`, was copied
essentially verbatim — a generic, self-contained bin-packing algorithm
with no DOM dependency of its own, so nothing about it needed to change
to become a Workshop tool.

## Why no Planner

The source application included its own job-tracking Kanban board
(`planner.js`) — stages from cut to install, drag-between-columns,
customer/product/colour fields, a PDF attachment, and the ability to
attach a calculator's result to a specific job as a note.

The Workshop already has a project-tracking system that plays exactly
this role in its own idiom: `ProjectsStore`, with its own status stages
(planning/active/done), shown on the pinboard, the Workbench, and the
computer's Projects app. Building a second, parallel job board would
have been *duplicate functionality* — precisely what this phase's own
"Architectural Review" section asks to watch for — not a new tool
earning its place. The Planner's own most valuable idea, "attach this
calculation to a job," is generalised instead: `ProjectsStore
.addCalculation()` attaches a calculation to a Workshop *project*, the
same underlying concept translated into the system that already exists
rather than copied alongside it. The Planner's other job-tracking-
specific fields (customer name, product/colour dropdowns, PDF
attachments, job icons) don't have a Workshop-project equivalent and
weren't invented one — they were specific to running fabrication jobs
through a factory floor, not to "a creative project," and inventing a
generalisation nobody asked for would have been scope creep in the
other direction.

## Custom calculators and the formula language

A calculator built through the Calculator Builder is a different,
deliberately smaller thing than a native one: a plain data definition
(title, description, category, icon, inputs, and one or more named
outputs, each with a formula), evaluated through `ToolFormula.js` rather
than run as JavaScript.

**`ToolFormula.js` is a small, hand-rolled arithmetic parser — never
`eval()` or `new Function()`.** Numbers, named inputs, `+ - * / ^`,
parentheses, and a fixed whitelist of functions (`round`, `floor`,
`ceil`, `abs`, `sqrt`, `min`, `max`). "The goal is not to build a
programming environment" ruled out anything resembling a real
expression language (variables, branching, calling one formula from
another) — what's here is exactly enough for the six templates below to
be genuinely useful, working calculators, and nothing a formula could do
beyond arithmetic on the numbers it was given.

`validateFormula()` stands every declared input in for `1` and tries
evaluating — "Validation... Preview... Testing" without needing a real
test case filled in first. The Builder's own "Validate" button uses
this directly.

**Templates** (`CalculatorTemplates.js`) — Basic formula, Material
calculator, Area calculator, Percentage calculator, Conversion
calculator, Time calculator — each a working starting point with real
default values and formulas already filled in, matching the brief's own
named list exactly. Picking one doesn't create a special "templated"
calculator type; it fills in the Builder's own form with a real,
editable draft, indistinguishable afterward from one built from a blank
page.

**Calculators as Workshop assets.** `ToolsStore` follows the identical
shape `ObjectLibraryStore` already established for Builder-made objects:
`create`/`update`/`duplicate`/`remove`, `category`, `tags`, a `version`
field, and the same "safe versioning" defensive defaults on load. File-
based import/export and sharing were named in the brief but aren't
implemented this phase — see "Known limitations" below; no other asset
type in the Workshop (objects, poses, animations) has real file-based
import/export either, so this isn't a gap unique to calculators.

## Tool Storage, the Workbench, and Projects

**Tool Storage** (`ToolStorageOverlay.js`) is no longer a placeholder —
interacting with the cabinet opens the full toolbox: browse by category,
Pinned, or Recent; run any tool; build a new one.

**The Workbench** gained a small, deliberately quiet addition to its own
clipboard panel (`WorkbenchPanel.js`): a one-line summary of the last
couple of calculations saved to the *current* project, and an "Open
Tools" button that opens the identical toolbox the cabinet does. The
panel stays "a clipboard, not a dashboard" — it was never going to grow
a second, smaller calculator UI squeezed into that small a space.

**Projects** (`ProjectsStore.js`) gained a `calculations` array per
project and `addCalculation()`/`removeCalculation()` — "projects should
become long-term records of how work was completed, rather than only
storing finished assets." A calculation is saved deliberately, from the
toolbox's own result view (pick a project, press "Save to project"),
distinct from `ToolsStore.recent`'s own rolling log of every run: one is
a permanent project record, the other is a quick way back to whatever
you last calculated, whether or not it ever got saved anywhere.

## Architectural decisions

- **A generic form renderer, not eleven bespoke ones.** Every native
  calculator's `inputs` array uses one of five types (`text`, `number`,
  `radio`, `checkbox`, `rows`) that `ToolsPanelView.js` renders once,
  generically — adding a twelfth native calculator, or the thirtieth
  custom one, needs no new rendering code as long as it fits those five
  shapes.
- **One `runTool()` entry point** for both native (a real function call)
  and custom (formula evaluation) calculators — `ToolsPanelView.js`
  never needs to know which kind of tool it's holding.
- **Positional/spatial concerns already exist and were reused, not
  duplicated** — saving a calculation uses `ProjectsStore` directly; no
  new "attach" mechanism was invented alongside the one this phase
  extended.

## Architectural review

- **Dead code found in the source material, not carried forward.**
  `getBuildoutSideDeductions()`, defined in the original `calculators.js`,
  had no caller anywhere in that file — genuinely unused in the source
  application itself. Not ported; perpetuating dead code while porting
  everything else faithfully would have been the wrong kind of fidelity.
- **A subtly broken fallback, not carried forward either.** The original
  Stock Optimiser's own free-text parsing fallback (for typing cuts as
  plain text instead of using its row editor) contained a regex with
  doubled escape characters (`\\d` inside a literal, which matches a
  literal backslash-d, not a digit) — already broken in the source.
  Since this phase's own row editor is the only way to enter stock
  sources and cuts (no free-text fallback mode was built), this
  particular bug simply has nothing left to affect.
- **The buildout side-checkbox auto-behaviour was simplified.** The
  original UI auto-checked and disabled the four individual side
  checkboxes whenever "All 4 Sides" was ticked, and hid the whole row
  unless "BuildOut" was the selected frame type. The calculation itself
  already treats "all sides" as true regardless of the individual boxes
  (`Boolean(values.buildoutAllSides || values.buildoutLeft)`, etc.), so
  the math was never at risk — only a UI convenience was left out. See
  "Known limitations."

## Known limitations / future opportunities

- **No cross-checkbox UI behaviour for the BuildOut side selector** (see
  above) — checking individual sides works correctly either way, but the
  form doesn't auto-manage them for you the way the source application's
  own UI did.
- **No file-based import/export or sharing for custom calculators** —
  consistent with every other asset type in the Workshop today, and a
  real future extension point once any asset type gets this treatment.
- **The formula language is intentionally arithmetic-only** — no
  conditionals, no per-formula references to another formula's own
  output. A calculator whose logic genuinely needs branching (like most
  of the *native* calculators this phase ported) still needs to be a
  real, hand-written native calculator, not something the Builder can
  produce. This is the actual boundary "the goal is not to build a
  programming environment" draws, not an oversight.
- **`ToolsStore.recent` is global, not per-category or per-project** — a
  single rolling list of the last 15 runs across every tool. Fine at the
  Workshop's current scale; a much larger tool library might want this
  scoped further.
