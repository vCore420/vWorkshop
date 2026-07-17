# Version 2 — Independent Release Review (v2.2.3d)

An outside review, performed at the close of Version 2 by a reviewer who
built none of it. The brief: determine whether Version 2 truly feels
complete, prepare the repository for Version 3's repository-first
workflow, leave one contribution, and answer honestly whether this would
ship. Method: full documentation read, architecture walkthrough,
targeted code reading across every `src/` domain, and scripted sweeps
re-run independently rather than trusting the sign-off phase's own
claims — dead-export cross-reference (419 exports), design-token
reference sweep, event-name emit/listen cross-reference, relative-import
resolution, `node --check` across all 245 modules, and doc-index
verification.

## Overall impression

This is the most internally honest codebase I have reviewed. The
architecture is genuinely what its documentation says it is — I checked
the claims that were checkable, and they held with the specific
exceptions below. The "place, not app" philosophy is not marketing
language sitting above the code; it is visibly the decision procedure
that produced the code, from the interaction pipeline down to which
sounds were deferred and why. Version 2 finishes as what its brief
asked for: a polished, complete foundation.

## Findings

**Found and fixed (one real drift family, one precache gap):**

1. **Build Mode's Phone migration left five stale descriptions of its
   old contract.** `InteractionSystem.js`, `BuildModeSystem.js`,
   `main.js`, `docs/ARCHITECTURE.md`, and `docs/WORLDBUILDER.md` all
   still described suspension via `buildmode:entered`/`buildmode:exited`
   and an `enter()`-side guard — mechanisms that moved into
   `PhoneSystem` (`phone:opened`/`phone:closed`, and `open()`'s own
   refusal) when Build Mode became a Phone app. The scripted
   event-name sweep surfaced it: those two events are emitted and
   nothing anywhere listens. *Behaviour was correct throughout* — the
   documentation described a mechanism that no longer existed. All five
   locations corrected; the events kept and honestly labelled as
   currently-unheard public signals. The README's controls table and
   Build Mode section carried the user-facing version of the same drift
   ("B — Toggle Build Mode", "the camera freezes") and were corrected to
   match the HUD's own "Phone (B)" button and the deliberate
   walk-while-building behaviour. This is exactly the "a docstring is a
   promise" shape the project's own retrospective names — worth noting
   that the drift survived a dedicated sign-off audit, which validates
   that retrospective's call for *periodic* re-checking.
2. **`service-worker.js`'s shell precache had drifted** — `phone.css`
   and `tools.css` are linked in `index.html` but were never added to
   `SHELL_URLS` when their phases introduced them. Low severity
   (runtime caching covers them after first load); fixed, and
   `CLAUDE.md` now records the "new stylesheet → both files" rule.
3. **Two smaller staleness items**: `docs/ARCHITECTURE.md`'s `css/`
   listing named four of twelve files; `SimpleMarkdown.js`'s docstring
   listed three callers for two phases after `plugin-sdk` became a
   fourth. Both fixed.
4. **Two undocumented convenience exports** (`ALL_PART_TYPES`,
   `getExpressionType`) had no external caller and no comment making
   the dead-vs-deliberate distinction legible. Kept, with one-line
   comments stating their status plainly, per the project's own
   philosophy. Not removed — removal would be churn for two harmless
   one-liners.

**Reviewed and found already fine (stated per the house rule):** the
persistence architecture's central claim (only `StorageUtils`/
`PersistenceSystem` touch `localStorage` — verified; the other files
matching the grep only use the download/upload helpers); the Factory
Reset race fix (suppress-first ordering is correct); every relative
import resolves; every `var(--…)` reference resolves to a defined token
(the one apparent exception, `--health-color`, is a correctly-scoped
local custom property); zero TODO/FIXME markers; console usage is
clean (two deliberate logs, the rest warn/error); interval timers are
paired with their disposers; `EventBus` isolates listener errors;
`ToolFormula` is genuinely safe (no `eval`, whitelisted functions,
variable values only ever read as numbers — two pedantic notes for a
future doc: `^` associates left rather than the conventional right, and
`-2^2` evaluates as `(-2)^2`; neither matters for the calculators it
serves, but if the Calculator Builder ever documents its formula
language formally, document these as its defined behaviour).

## Greatest strengths

The documentation-to-code fidelity, and the honesty culture that
maintains it — deferrals with named reasons, "already fine" findings
reported as findings, placeholders that label themselves. The
interaction pipeline: one mechanism, learned once, explaining every
physical feature in the room. The persistence design (event-based
systems + registered providers + one envelope + real migrations) —
"cloud sync is a transport problem, not a format problem" is earned.
The restraint: thirteen primitives chosen for usefulness, three
decorations in a decoration phase, a job-tracking board *not* ported
because the project system already played that role.

## Greatest weaknesses

Verification depends almost entirely on discipline: no automated tests,
no CI, no linting — the scripted sweeps exist but are re-invented per
audit rather than kept as runnable artifacts. Discipline has manifestly
been sufficient, but Version 3's workflow change is exactly the moment
such things slip; my strongest recommendation below addresses it.
Accessibility is good-boned but unsystematic (now Phase V3.7 in the
draft roadmap). And the sheer size of `docs/` is becoming its own
navigation problem — thirty-four files reward the dedicated reader and
intimidate the new one, which `CLAUDE.md`'s reading map now mitigates.

## What surprised me / exceeded expectations

Surprised: that a five-location doc drift survived a dedicated
final-audit phase — and, on reflection, that this is the strongest
possible argument for the project's own "check anyway" principle rather
than against the audit, since the drift was only findable by a sweep
(emit/listen cross-reference) that phase didn't happen to run.
Exceeded expectations: `docs/HISTORY.md`'s reflections are genuinely
valuable engineering writing, not ceremony; the Factory Reset
race-condition account is a model root-cause writeup; and the
`_windowWatchWeights()` story — infrastructure so cheap to extend that
extending it always beat building beside it — is the best single
validation of the architecture in the repository.

## Recommendations before Version 3

1. **Keep the audits as artifacts.** The dead-export, token, event-name,
   and import sweeps should live as small scripts (a `tools-dev/` or
   similar, clearly outside the served app) so every future phase can
   run them in seconds instead of re-deriving them. This is the cheapest
   possible insurance for the workflow transition.
2. **Adopt `CLAUDE.md`'s pre-finish checklist as the phase gate** —
   especially the "grep for every old name you changed" step, which
   would have caught this review's main finding at its source.
3. Treat `docs/ROADMAP_V3.md` as input to planning, not as the plan.

## The One Contribution — `workshop://history`

The Workshop's defining trait, after two versions, is that it remembers
— your projects, your resident, your weather, exactly where you were
standing. The one thing it had no memory of was itself. The full,
honest story of how this place came to be — every phase, every
root-caused mistake, both versions' closing reflections — sat in
`docs/HISTORY.md`, invisible from inside the place it describes.

So the contribution is small on purpose: **the Workshop's own story,
readable from within it.** One page registration through the exact
`docFilePage()` door every other documentation page already uses, one
search entry, one home tile — and a three-tag `<details>`/`<summary>`
whitelist added to `SimpleMarkdown`, the single construct `HISTORY.md`
uses that nothing else ever needed. No new system, no new pattern;
"one implementation, several doors in," practiced rather than praised.

Why I believe it belongs: a place with a memory should include itself
in that memory. It strengthens the identity (environmental storytelling
in the most literal sense), it costs almost nothing, and it quietly
serves the Version 3 transition — the same honest history future
engineers are told to rely on is now a first-class, findable part of
the product, which is the repository-as-source-of-truth principle made
visible to the person standing in the room.

## The release question

**"If this project arrived at your studio today as Version 2.0, would
you approve it for release?" — Yes.**

Because the things that block releases are absent: I found no
functional defect, no dishonest surface, no architectural debt
mispresented as intent. The two genuine findings were documentation
describing a superseded mechanism around correct behaviour, and an
incomplete precache list with a working runtime fallback — both fixed
within this review, neither user-facing in effect. And because the
things that make a release *trustworthy* are unusually present: the
save format is versioned and migrated, destructive paths are guarded,
failures are surfaced honestly (the save-failed event, the offline
fallback pages, the "honest limits" documentation), and the project
demonstrably knows what it is — every reviewed decision, including the
ones I arrived skeptical about (no tests, no bundler, placeholder
assets), turned out to be documented, reasoned, and consistent with the
philosophy rather than an accident someone rationalised later. Version
2 is what it set out to be: a polished, complete foundation. Ship it,
and begin Version 3 on it with confidence.

— the independent reviewer, v2.2.3d
