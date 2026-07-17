# The Workshop Engineering Handbook

Written at the close of Version 2 by the independent release reviewer,
for whoever begins Version 3 — with the explicit hope that if you read
only one document before contributing, this one leaves you understanding
not just how the Workshop works, but what it is trying to become.

## What the Workshop is

The Workshop is a place, not an app. That sentence appears throughout
this repository, and it is load-bearing everywhere it appears. It means:

- **Software becomes places instead of windows.** There is no menu bar.
  Every feature is a physical object you walk to. The computer is a desk
  you sit at; the toolbox is a cabinet you open; the settings live on
  the monitor of the computer, because that's where settings would live.
- **Features become tools instead of applications.** A calculator is a
  thing in a drawer, not a modal. Music comes from a cabinet with a
  turntable. The test for a new feature is never "is it useful" alone —
  it's "what object is it, and where does it belong in the room?"
- **Projects become journeys instead of files.** A project leaves
  physical evidence on the workbench while you're in the middle of it,
  and packs itself away to the shelf when it's done. State is
  continuity: the Workshop keeps living while you're away and picks up
  where it plausibly would be, never frozen where you left it.

Everything else in this handbook is downstream of those three sentences.

## The philosophy behind the architecture

**One system per concern, and no premature abstraction.** Every file in
`src/systems/` does one thing. The ECS is deliberately "ECS-lite" —
tens of entities, never thousands, so simplicity beat generality and
was documented as beating it. When the Workshop needs a capability, it
builds the simplest honest version and *writes down what was
simplified* ("Known simplifications" sections exist in most docs).
Abstraction arrives when the second real use case does, not before.

**One implementation, several doors in.** The single most-validated
pattern in the project's history. The Wardrobe is one app with two
physical entry points. The toolbox is one implementation behind a
cabinet, a computer app, and a workbench panel. The resident's
awareness is one weighted-choice mechanism that a dozen signals feed.
Before you build anything new, ask whether something existing can grow
a door instead.

**Honesty as an engineering practice.** This is the Workshop's real
signature, more than any pattern: placeholders label themselves;
deferrals name their reasons; release notes say "this was already fine"
when it was; docstrings quote the brief that motivated them. The reason
is practical, not sentimental — it is the only way a later reader can
trust any individual claim. A project that reports "no change needed"
convincingly is a project whose bug reports are worth believing.

**The event bus is the nervous system.** Systems publish; anything that
cares subscribes; nobody imports anybody's internals. This is what has
let thirty-plus phases add systems without rewriting old ones. Guard it.

## What makes the Workshop different from ordinary software

Ordinary software optimises for capability per unit effort. The
Workshop optimises for *believability* per unit capability. A wall
clock whose hands genuinely follow the Workshop's own sun, a resident
who might happen to be looking at that clock when it chimes, dust motes
near a window — these are not features in any roadmap sense, and they
are the point. When a change makes the Workshop more capable but less
believable as a place, the change is wrong, however impressive.

The second difference: the Workshop remembers itself. Its full history
— every phase's account, every reflection, every mistake root-caused in
public — is preserved in `docs/HISTORY.md` and, as of v2.2.3d, readable
from inside the Workshop at `workshop://history`. Treat that record as
part of the product. Add to it honestly every phase.

## Mistakes future engineers should avoid

Each of these has actually happened here at least once; the accounts
are in `docs/HISTORY.md` and `docs/REFINEMENT.md`.

1. **Letting a docstring outlive its truth.** The recurring failure
   shape of this entire codebase: a comment describing an integration
   that was true when written and quietly stopped being true.
   `softBox()`, `Materials.ground()`, `schemeOf()`,
   `computeFootprint()`, and v2.2.3d's Build Mode suspension docs all
   share it. When you change a mechanism, grep for every description of
   the old one before you finish — and expect a periodic audit to check
   the claims you were sure about anyway.
2. **Fixing the symptom as reported.** The moon's mirrored phase, the
   "too aggressive" AI timeout, the "broken" ladders — every one had a
   real fix one layer below the report. Reproduce, then trace down.
3. **Setting a Three.js camera property and assuming it applied.**
   The terrain-shadow regression ran silently for many phases because
   frustum properties were set without `updateProjectionMatrix()`.
   More generally: verify visually, not by reading your own patch.
4. **Saving defaults as if they were player data.** FurnitureSystem
   once persisted every piece's transform, freezing Workshop
   improvements into old saves. Persist only what the player actually
   changed.
5. **Deleting "unused" code without reading it — or keeping dead code
   because it might matter.** `solveTwoBoneIK()` looks dead and is
   deliberate forward-looking infrastructure; `schemeOf()` looked
   identical and was genuinely dead. The distinction lives in the
   file's own comment. If you write speculative infrastructure, label
   it as such; if you find unlabelled speculation, label or remove it.
6. **Manufacturing findings to look thorough.** When a review brief
   lists ten concerns, the honest outcome is often that six were
   already fine. Say so.
7. **Racing your own teardown.** Factory Reset was silently undone by
   the `beforeunload` autosave for two phases. Any destructive path
   that ends in a reload must suppress every automatic writer first.

## Principles that should always guide future development

- Refine before expanding; connect before adding.
- Prefer the change that strengthens cohesion over the one that adds
  complexity.
- Every phase ends with its honest account: built, deferred (with
  reasons), reviewed-and-found-fine, and a versioned release.
- Keep the repository the source of truth. If knowledge exists only in
  a conversation, it doesn't exist; write it into a doc or a comment
  before the phase closes.
- Never guarantee delight; make it possible. (The resident is never
  *scripted* to watch the clock chime — it's merely able to happen.
  That restraint is a design principle, not a limitation.)
- And the last line of Version 2's own handover, which deserves to stay
  the last word here too: the Workshop was never trying to be
  impressive. It was trying to be a place someone would actually want
  to spend time in. Whatever Version 3 becomes, that is the one thing
  worth protecting on purpose.
