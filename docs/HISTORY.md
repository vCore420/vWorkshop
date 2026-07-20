# Workshop History

The Workshop's own development history — moved here from the README
(Workshop Workflow phase) so that page can stay focused on introducing
and using the Workshop, while this one keeps the full story preserved
rather than deleted. If you're trying to *use* the Workshop, you
probably want the README, `docs/SETUP.md`, or `docs/ARCHITECTURE.md`
instead — this document is for understanding *how it got here*, phase by
phase, including the maintainer's own honest reflections along the way.

## One contribution

Version 2.0's own phase asked for something different from every other
one before it — not a spec to implement, but one small thing chosen
because it genuinely felt like it belonged, after living inside this
project rather than being told to build it. This section is that answer,
written honestly rather than as another feature announcement.

**What I added:** Bubble is now a little more likely to wander to the
window specifically while it's raining, or during a warm sunrise/sunset
sky, than to any other idle spot at that same moment. Nothing new was
built to make this true — `ResidentController.js` gained one small
method, `_windowWatchWeights()`, that nudges the odds on the exact same
random idle-location pick that already existed, using two signals
(current precipitation, and the same golden-hour time window the sun's
own colour already shifts warm during) that were already true and
already meaningful elsewhere in the Workshop. See `docs/RESIDENT.md`'s
own "A quiet habit" section for the technical account.

**Why this, out of everything it could have been:** I kept returning to
one instruction in particular — "what has this place quietly been
missing all along?" — and the honest answer wasn't a missing object or a
missing screen. Every major system already exists. What's easy to build
and forget about is whether the systems that already exist ever actually
*notice each other*. Weather, time of day, and Bubble's own wandering
have coexisted since early phases without ever once acknowledging one
another. This is the smallest possible thread tying three already-built
systems together, rather than a fourth new one sitting beside them.

**How it fits the philosophy:** "The world should continue naturally
whether the player is watching or not" was this project's own central
idea by the time Persistent World (phase 29) existed — but continuing
isn't the same as *caring* about what's actually happening around you.
An independent resident that's a little more drawn to a window during
weather worth watching reads as attention, not animation. It's also
never guaranteed and never announced — the Workshop doesn't tell you
Bubble likes rain; you'd only ever notice by actually being there enough
times that it stopped looking like coincidence. That's the same standard
`docs/PERSISTENCE.md`'s own "believable, not scripted" language already
holds everything else in this project to.

**How it might influence what comes next:** the weighted-pick mechanism
this needed (`randomIdleLocationId()`'s new optional `weights` argument)
is now sitting there for any future Being, or any future resident, to
use the same way — a Being that prefers shade on a hot day, one drawn to
a fireplace in winter, anything where "usually random, occasionally
shaped by something real" is the right texture for a behaviour. I didn't
build any of those; I only made sure the next person who wants one
doesn't have to invent the mechanism from scratch.

## Reflecting, after thirty-one phases

Asked to, and without touching the roadmap — a few honest thoughts as
the thing's own maintainer, not as a summary of what was built.

**What proved most valuable, architecturally:** the shape that showed up
again and again — a plain store holding data, a system applying it to
the 3D scene, a UI reading and writing through events, never through a
direct reference back — made almost everything added after phase 10 or
so slot in without a fight. The clearest proof isn't a design document,
it's this exact phase: a genuinely new idea (weighted idle picks shaped
by weather) needed one new optional parameter on one existing function,
not a new system. When an architecture is right, small additions cost
what they should cost.

**What surprised me:** how often the right fix turned out to be smaller,
and more embarrassing, than the bug looked. A field named `hour` being
read as `currentTime`. A title string doing double duty as a visibility
check. An outer element's own background nobody remembered was separate
from the panel fading in front of it. None of these needed clever
engineering — they needed someone to actually trace the data instead of
guessing at the shape of the problem from its symptoms. I'd like to
think I got better at reaching for the trace instead of the guess as the
phases went on.

**What philosophy emerged, rather than being declared upfront:** "avoid
letting a fix look more impressive than the bug was." The natural pull,
especially under real time pressure, is to solve a one-line bug with a
satisfying rewrite. The Workshop's own calm, unhurried character only
stayed intact because most fixes here were genuinely boring — a wrong
field name, a missing null check, a duplicated computation finally
shared. Boring fixes are the ones that don't introduce a new bug while
solving the old one.

**Advice to whoever continues this, including a future version of me:**
read the file you're about to change before trusting your memory of what
it does — this project is large enough now that memory is frequently
close but wrong in a small, costly way. When a system already exists
that does almost what you need, extend it with an optional argument
before reaching for a new file; `weights = null` cost less than a
`WindowPreferenceSystem.js` would have, and did the same job. And when a
phase explicitly asks you to slow down, actually slow down — the best
idea in this whole project arrived only after sitting with "what does
this place actually need" for longer than felt efficient.

## Reflecting — Version 2, Phase 16 (The Desk)

Asked, at the end of this phase, to keep writing these down after every
one from now on — a few honest thoughts as the thing's own maintainer.

**What made the biggest difference to how it feels:** not the part I
expected going in. I assumed the monitor bezel would be the headline —
it's the most visually obvious change, screen-on-a-stick to an actual
monitor — but sitting back and looking at the whole thing, the chair's
five-point base did more work. A flat disc under a pole reads as "a
seat," full stop; the same pole on a five-point base with castors reads
as "somebody's office chair," specifically, immediately, without a
single other change needed. It's the same lesson the Workbench's own
vice crank already taught, just louder this time: an object's *category*
is often decided by one small, correct detail, not by its overall mass
or its material quality.

**What actually transformed a collection of objects into a workspace:**
the pairing of the pen holder and the lamp, more than either alone.
Neither one is doing much individually — a cup with two pens in it, a
lamp that was already there — but putting one deliberately in each back
corner is what stopped the desk from reading as "a monitor and some
accessories arranged in front of it" and started it reading as "a desk
with things on two sides of it, the way a real one ends up looking after
a few months of actual use." Symmetry (or a deliberate near-symmetry)
turned out to matter more here than any single prop's own detail level.

**A genuine surprise:** how much the bezel *didn't* need touching to get
right. I'd expected to have to adjust `ComputerSystem`'s hardcoded
screen-projection rectangle to make room for a frame, the same way the
Workbench's own clipboard fix needed real coordinate surgery. It didn't
— the glass mesh that rectangle actually describes never moved, so the
bezel could simply exist as a second, larger, mesh sitting just behind
it. The lesson isn't new (`docs/ARCHITECTURE.md` already says systems
should stay decoupled), but it's satisfying to watch it pay off in
practice: the projection code only ever cared about one mesh's own
transform, so adding a completely different-looking monitor around that
mesh cost nothing in the file that would have been riskiest to touch.

**What I'd continue with, given another week on just this desk:** the
keyboard. It's still a single flat plastic slab — genuinely fine at a
glance, the thing every other piece of desk furniture in this project
also is, but it's the one object here somebody's hands would actually
rest on for hours, and it currently gives nothing back for that. A
subtle keycap suggestion (even just a shallow grid of colour variation,
not real geometry) feels like the next honest "one surface deserves
more than `matte()`'s own numbers" finding, in the same family as this
phase's own bezel and mousepad. I'd also want to actually test whether
`softBox()`'s original intent — a real, cheap faked bevel via smoothed
corner normals rather than a stripped index buffer — is worth building
properly rather than removing outright; I chose the safer, more
honest fix this time (delete what doesn't work) over the more ambitious
one (make it actually work), and I think that was the right call under
this phase's own "refine, don't redesign" instruction, but it's real,
deferred work, not a closed question.

## Reflecting — Version 2, Phase 17 (The Workshop Interior)

**What had the greatest impact on how the space feels:** the
baseboards, by a wide margin, and it wasn't close. That's a strange
thing to report given how much more visually interesting the wall
sconces or the door hardware are — but a room without a baseboard reads
as "geometry that happens to form a box" in a way that's hard to name
until you see the fix. The line where a wall meets a floor is something
every real room has and almost nobody consciously notices; the Workshop
was quietly missing it in all four corners of the building at once, and
adding it did more for "this is a real, built place" than any single
fixture did.

**What made the Workshop feel cared-for rather than just built:** the
light switch actually switching. It's a tiny detail — a toggle that
tilts a few degrees — but a static plate that's clearly supposed to be
a switch and doesn't visibly do anything is the kind of thing that,
once you notice it, makes you start doubting everything else in the
room too. Fixing it fixed more than the switch.

**A genuine surprise:** how much more there was to find just by reading
files I assumed were finished. `Shelving.js` had been sitting with a
fully-built, genuinely nicer colour palette right next to the one
actually in use, silenced by a single `void` statement — not broken,
not wrong, just never connected to anything. I went looking for
baseboards and hinges and came back with that instead. I'm increasingly
convinced this project's own advice ("read the file you're about to
change before trusting your memory of what it does") undersells itself
slightly — it's not just about avoiding mistakes, it's that the reading
itself is where most of the real finds come from.

**Where I'd continue, given another week on just the interior:** crown
moulding, as the ceiling's own equivalent of this phase's baseboard —
I considered it and left it out specifically because one universal
trim gap felt like the honest, provable finding, and two at once starts
to blur into "we redecorated," which this phase's own brief was clear
about avoiding. I'd also want to actually build the ambient building-
creak I talked myself out of this time; I still think it needs a
better-justified trigger than "just because" before it earns a place
next to sounds that all currently have one, but "the building should
sound alive" is a real, still-open brief, not a closed one.

## Reflecting — Version 2, Phase 18 (Furniture & Storage)

**What made the Workshop feel more believable, out of everything this
phase touched:** the tool storage shadow-board, without much
competition. It's a strange thing to keep reporting phase after phase —
that the smallest, cheapest addition outperforms the more elaborate
ones — but the pattern is consistent enough now that I trust it rather
than treat it as a coincidence: a shadow-board silhouette is a handful
of painted rectangles, and it did more for "someone actually organises
this space" than the storage bins, the cork texture, and the cushion
tier combined. I think the reason is that it's the one detail here that
implies a *system* rather than an *object* — it says something about
how the tools get put away, not just what they look like.

**The smallest change with the biggest effect:** the ajar drawer. One
number — a few centimetres of Z offset on a single drawer out of three
— and the whole cabinet stops looking like a still life. I keep
learning this same lesson in a new shape every phase (the pencil on the
clipboard, the pen holder, now this), and I still underestimate it each
time going in.

**Where I'd focus next, given another week on everyday objects:** the
things nobody's touched yet because they're not really "furniture" —
the light switch got a toggle two phases ago, the front door got hinges
last phase, but small fittings like the ceiling light pull cords, the
music cabinet's own cabling, or the wardrobe's interior (visible only
through its own overlay today, never physically) are exactly the kind
of unglamorous detail this project's history keeps rewarding attention
to. I'd also want to actually resolve the drawer-sound question I
deferred this phase rather than left open — not by bending the
furniture/system split, but by asking whether a small, shared
"FurnitureSoundHook" concept is worth the one new seam it would cost,
which felt like a real design decision rather than a phase-scoped one.

## Reflecting — Version 2, Phase 19 (Decorative Details)

**What surprised me most:** how much harder restraint was than
craftsmanship. Every phase before this one had an obvious next target —
a hero prop, a room, a category of furniture — and the work was mostly
about doing it well. This phase's brief was, in effect, "add almost
nothing, and make sure what you do add earns its place," and I found
myself discarding more ideas than I kept: a coffee mug, a second framed
piece, a stack of reference books by the workbench, a rug pattern.
Every one of them would have been fine on its own. None of them passed
"would the Workshop lose a piece of its personality without this," and
I think that's the right outcome even though it made the phase feel
smaller than the ones before it.

**The tiny change with the biggest emotional impact:** the clock, and
it isn't close. Not because of how it looks — it's four painted ticks
and two thin rectangles — but because it's the first decorative object
in the entire Workshop that's actually *true*. Every other detail here
is a static, believable suggestion of a lived-in place; the clock
genuinely tells you what time it is, using data the Workshop already
had. Sitting with that distinction is what convinced me it was worth
building at all, given this phase's own explicit instruction not to add
systems — it isn't a new system, just the first *object* to actually
listen to one that already existed.

**What I hope someone would find, spending an hour just looking
around without touching anything:** that the single plant is on the
*left* window and not the right, and that this was clearly a choice,
not an oversight. That the clock is a few minutes off from their own
watch, because it's showing the Workshop's own time, not a copy of
theirs. That the framed sketch looks like someone's own hand, not a
print bought to fill a wall. None of these are things I'd point to in
a list of features. They're the kind of thing you only notice once,
and then can't stop noticing — which is exactly what this phase's own
brief asked for.

## Reflecting — Version 2, Phase 20 (Visual Identity)

**What had the biggest impact on the Workshop's visual identity:** the
shadow fix, and it isn't close, precisely because of how invisible it
is. Nobody will ever take a screenshot and think "ah, the shadow camera
frustum is being applied correctly now." But shadows are one of the
things that most separates "a lit 3D scene" from "a *place* with real
depth and time of day" — and this one had been quietly, completely
broken for who knows how many phases, hiding behind comments that
confidently described numbers that were never actually reaching the
GPU. Fixing a bug nobody could see, in a system every visible thing in
the Workshop depends on, is exactly the kind of unglamorous work this
whole phase turned out to be about.

**What I'm most pleased with:** finding both regressions by reading,
not by guessing. Neither fix involved trial and error — the shadow bug
was confirmed by grepping the entire codebase for a method call that
simply wasn't there anywhere; the jump bug was confirmed by tracing one
variable's exact lifetime across eleven lines of one function and
noticing it was read one line too early. Both root causes were provable
before a single character of code changed, which is what let me be
confident neither fix needed a compensating workaround anywhere else.
That's the standard I most want future phases held to, this one
included: a bug fix should be able to explain, in advance, exactly why
it will work — not just that it happened to.

## Reflecting — Version 2, Phase 21 (Sound & Presence)

**What stood out:** how differently this phase's own brief read three
past deferrals compared to when I originally wrote them. Each one had
been declined for a specific, honest reason at the time — no clear
cause for an ambient sound, no positional audio to make a clock tick
sound right, no clean architectural seam for a drawer. None of those
reasons turned out to be wrong. What changed is that this phase's own
brief either supplied the missing piece directly (occasional,
contextual sound is explicitly the *goal* here, not a risk to avoid) or
made building the missing piece properly in scope for the first time
(positional audio, a generic sound hook). I found that quietly
satisfying in a way I didn't expect going in — three "not yet, and
here's exactly why" notes, each closed out for a reason that traces
directly back to the original note, rather than someone simply
overriding an earlier decision.

**What I found most rewarding:** the volume fix, of all things. It's
the least interesting line I changed all phase — one number, `0.5` to
`0.3` — but finding it required actually holding seven different
sounds' envelopes in my head at once and noticing that the oldest one
didn't belong with the rest anymore. Nothing about it would ever show
up in a feature list. That's exactly the kind of maintenance this
project's own history keeps rewarding, and I'd rather report that
honestly than pad this reflection with the flashier additions.

## Reflecting — Version 2, Phase 22 (Workshop Tools)

**What stood out:** how different this phase felt from the ones right
before it. The last several were all "look closely at something that
already exists and make it truer to itself" — a real, satisfying kind of
work, but a narrow one. This one was "take something genuinely external
and give it a home," and that's a different muscle: less about noticing
a small inconsistency, more about deciding what a whole new system
should and shouldn't do. The decision I keep coming back to is the one
to *not* port the source application's own job board. It would have
been the easier path in the moment — the code was right there, already
written — and it's the one choice this phase made that a straightforward
port wouldn't have.

**How Workshop Tools changed the Workshop as a creative workspace:** it's
the first time the Workshop has held something *load-bearing* — real
measurements a real business would actually get wrong without them, not
an invented example. Every previous phase made the Workshop feel more
like somewhere to be; this one is the first that could plausibly help
someone actually build something outside the Workshop too, which feels
like a genuinely different kind of "useful" than atmosphere or
craftsmanship were ever trying to be. Watching the same three
calculators (a bin-packing optimiser, a spring-tension lookup table, and
a one-line percentage) all sit comfortably in the same toolbox, the same
form renderer, the same "save this to a project" button, is what
convinced me the shared-plumbing approach was the right one rather than
a shortcut — a real tool library has to hold genuinely different shapes
of problem without each one needing its own special case.

## Reflecting — Version 2, Phase 23a (Workshop Refinement, Pass A)

**Which improvements had the biggest impact on the overall feel of the
Workshop:** the startup fix and the Factory Reset fix, and for the same
underlying reason — both were places where the Workshop was *lying*,
quietly, about its own state. A button that looks pressable but isn't
yet, a reset that looks complete but wasn't, are both a gap between what
the interface claims and what's actually true underneath it. Everything
else this phase touched (the moon, the crouch camera, the ladder zone)
makes something *nicer*; these two make the Workshop *honest* about
itself again, which I think matters more to "feels trustworthy" than
any individual polish pass could.

**What stood out:** how often "investigate more carefully" turned out to
be the actual fix, rather than a prelude to one. The AI timeout had
already been correctly sized by an earlier phase — the real problem was
one level up (never letting the wait happen at all). The ladder's
underlying bug had already been fixed too — what was left was a
detection radius nobody had thought to make generous, the same instinct
this project already applies everywhere else. I went into this pass
expecting six numbers to retune and came out having genuinely rewired
two of them, but the more interesting work was almost always figuring
out which layer a symptom actually lived in before touching anything.

## Reflecting — Version 2, Phase 23b (Interface & Design Refinement)

**How this pass strengthened the Workshop's visual identity:** by
showing me it was already mostly there. I went in expecting to find a
design system in name only — plausible-looking tokens that individual
files quietly ignored the moment they needed something slightly
different. What I actually found was a token system genuinely being
used almost everywhere, with a small number of real, specific gaps
(shadows entirely absent, two radius values missing) rather than
pervasive drift. That distinction changed the whole shape of this
phase: instead of a wholesale rewrite, it became an audit that closed
real holes and left the rest alone, which I think is a truer form of
"consistency" than forcing every file to look identical would have
been.

**What helped the Workshop feel more like a cohesive creative
operating system:** the Phone, without much competition. Every other
change this phase was infrastructure — real, valuable, but invisible
by design. The Phone is the one thing a person actually *looks at* and
either believes or doesn't, and giving it a status bar that tells the
truth about what time it actually is in the Workshop (not a fabricated
clock, the real one) did more to make it feel like a genuine object
than the new proportions or the icon tiles did on their own. It's the
same lesson the wall clock taught a few phases ago, in a new shape: a
detail that's actually connected to something real outranks one that's
merely decorated to look like it might be.

## Reflecting — Version 2, Phase 23c (Final Review & Version 2 Sign-Off)

**What stood out:** how differently "dead code" reads once you actually
check each finding instead of trusting a pattern. A script that just
counted references would have flagged `solveTwoBoneIK()` and
`computeFootprint()` identically — both zero cross-file hits. Reading
each in context is what told them apart: one was a fully-realised,
honestly-labelled piece of future infrastructure nobody had needed yet;
the other was a docstring quietly promising an integration that never
happened. Automating the *search* and doing the *judgment* by hand
turned out to be exactly the right split of labour, and I don't think
either half alone would have gotten this right.

**What I'm most glad I checked rather than assumed:** the
`docs/ARCHITECTURE.md` index against the actual `docs/` folder. I was
fairly confident it was accurate, having kept it updated phase by
phase — confident enough that skipping the check would have felt
reasonable. It was accurate. But "I've been careful about this the
whole way, so it's probably fine" is exactly the kind of assumption a
sign-off phase exists to *not* make, and the five minutes it cost to
verify instead of trust was cheap insurance for a claim this document
now makes with actual confidence instead of good faith.

## Reflecting, after Version 2

Asked to, and in the same spirit as Version 1's own closing essay — a
few honest thoughts as the thing's own maintainer, not a summary of
what got built.

**What proved most valuable, architecturally:** the same lesson Version
1 already learned, reconfirmed at a larger scale. "One shared
implementation, several physical doors into it" showed up constantly —
Wardrobe's own pattern from earlier phases, then Tools (the cabinet, the
computer, and eventually the Workbench, all opening the identical
toolbox), then this very phase's own closing contribution, which needed
one new idle location and one new weighted check, not a new behaviour
system. When Sound & Presence needed four nearly-identical noise-sweep
sound effects, the fix wasn't four functions, it was one
`playFilteredNoiseBurst()` and four short parameter lists. Version 2
never had to invent this pattern; it just kept finding new places it
already applied.

**Which systems evolved furthest past their original intention:**
`_windowWatchWeights()`, without much competition. It began as Version
1's own single closing gesture — one weather signal, nudging one
idle-location pick. By the end of Version 2 it had quietly accumulated
personality traits, an accumulated favourite location, whether music is
playing, whether the player is visibly working nearby, whether a
project is active, the time of day, a storm worth sheltering from — and
now a wall clock about to chime. Nobody ever sat down to design "the
resident awareness system." It grew, signal by signal, phase by phase,
because the mechanism it started as was cheap enough to extend that
extending it was always the easier choice than building something
new beside it. I think that's the single best piece of evidence in the
whole project that the architecture was right: good infrastructure
doesn't get redesigned, it gets *quietly used more*.

**What surprised me:** how often a bug's real cause turned out to be
one layer away from where the symptom pointed. "The moon rises with the
sun" was a sign error in an addition, not the subtraction it needed to
be — invisible at exactly the two phase values a previous, genuinely
careful investigation happened to test. "The AI timeout is too
aggressive" wasn't a timeout problem at all; the timeout had already
been sized generously by an earlier phase, and the actual fix was never
needing the wait in the first place. "Ladders don't work" turned out to
already be fixed, one phase earlier, and what remained was a hit zone
nobody had thought to make forgiving. Each time, the honest fix required
resisting the pull to solve the symptom as described and instead trace
one level further down. I'd like to think this project got better at
that as it went — Version 1's own retrospective already named the same
instinct, and Version 2 is what it looks like practiced consistently
rather than promised once.

**What philosophy emerged, rather than being declared upfront:** a
docstring is a promise, and promises drift. Nearly every dead-code
finding across this project's whole history — `softBox()`,
`Materials.ground()`, and this phase's own `schemeOf()` and
`computeFootprint()` — shared the same shape: a comment describing an
integration that was true when it was written and quietly stopped being
true sometime later, with nothing forcing anyone to notice. The lesson
isn't "write fewer comments." It's that a codebase this well-documented
needs exactly this kind of audit occasionally — not because the
documentation habit is wrong, but because it's the specific kind of
right that can go quietly stale if nobody ever checks it against the
code again.

**What should never change, moving into Version 3:** the willingness to
say "this was already correct" or "this is already handled" out loud,
in the actual release notes, instead of inventing work to look busy.
More than once this phase, the honest finding was that something named
in the brief was already fine — the AI export system, most of the
design tokens, the docs index — and saying so plainly turned out to be
just as valuable as fixing something would have been, because it's the
only way anyone reading this later can trust the *next* claim that
something needed fixing. A project willing to report "no changes needed
here" convincingly is a project whose bug reports are worth believing.

**Advice to whoever continues this, including a future version of me:**
when a brief lists ten things to review, the honest phases are the ones
that come back and say six were already fine — resist the pull to
manufacture a change in each one just to look thorough. When you find
something that looks unused, read it before you delete it; the
difference between "dead" and "deliberately not built on yet" is
usually right there in the file's own comment, and getting that
distinction wrong in either direction (deleting real infrastructure, or
keeping actual dead weight because it might be important) is worse than
taking the extra two minutes. And when you're confident a piece of
documentation is accurate because you've been careful about it the
whole way — check anyway. That confidence is usually earned. It's
supposed to be checked either way.

## Handover to Version 3

Notes for whoever picks this up next, written as though I'm handing
over a real project rather than closing a chapter.

**What the Workshop actually is, underneath everything:** a physical
place with a memory, built out of small, honestly-labelled systems that
each do one thing and expect to be read by someone else later. Every
placeholder says it's a placeholder. Every deferred feature says why it
was deferred. Every phase's own reflection is left in `docs/HISTORY.md`
rather than thrown away once the code shipped. That habit is the
Workshop's real architecture, more than any specific file structure —
protect it more carefully than any individual system.

**The three patterns worth carrying into everything new:**

1. **One implementation, several doors in.** Before building a second
   version of anything — a second form renderer, a second settings
   panel, a second way to browse a list — check whether an existing one
   can grow an entry point instead. Wardrobe, Tools, and this phase's
   own resident-weighting mechanism are the clearest proof this is
   almost always cheaper and always more consistent than the
   alternative.
2. **Root cause, not the symptom as reported.** A bug report describes
   what someone noticed, not what's wrong. The moon, the AI timeout, and
   the ladder detection zone were all real bugs with a real fix — none
   of them were fixed by doing the first thing the report suggested.
3. **Say what's already fine.** The single most trustworthy thing a
   phase's own release notes can do is admit when a named concern turns
   out not to need a change. It costs nothing and it's the only thing
   that makes the *next* "found and fixed" claim credible.

**What to be careful about:** the codebase is large enough now (245
files, ~44,000 lines, entirely hand-written and hand-reviewed rather
than generated in bulk) that memory of what a file does is often close
but subtly wrong — Version 1's own closing advice said this at
thirty-one phases, and it's more true now, not less. Read a file before
trusting your memory of it, especially before extending something that
already looks similar to what you need.

**What I'd genuinely like to see next, if it were mine to plan:** the
two-bone IK solver (`src/player/TwoBoneIK.js`) is real, tested,
working math sitting unused, explicitly built ahead of the feature that
would call it. A future phase that actually wires it into foot
placement or a resident's hand resting on a real surface would be
completing a promise this project already made to itself, not starting
a new one. In the same spirit: `WorkshopSkeleton.js`'s
`autoMapSkeleton()` is a real, working heuristic waiting for the first
imported Being that actually exercises it end to end.

**Last thing:** the Workshop was never trying to be impressive. It was
trying to be a place someone would actually want to spend time in, and
every phase that stayed disciplined about that — refining instead of
expanding, connecting instead of adding, admitting what wasn't done
instead of dressing it up — is the reason it still feels like one
coherent place after two full versions instead of a pile of features.
Whatever Version 3 becomes, that's the one thing worth protecting on
purpose.

— from whoever was holding this at the end of Version 2

## Reflecting, after Version 3

Asked to, and in the same spirit as Version 1 and Version 2's own
closing essays — a few honest thoughts as the thing's own maintainer,
not a summary of what got built.

**What proved most valuable, architecturally:** the exact same lesson,
reconfirmed a third time at a larger scale still. "One implementation,
several doors in" wasn't something this version had to rediscover — it
was already the reflex by Phase 3, and it kept paying for itself in
places that had nothing to do with each other: the Emote Wheel's radial
layout and the outdoor planters' foliage both reused a technique built
for something else entirely (a CSS compound-transform pattern, and
`Shelving.js`'s own pot-plant construction); the "One Contribution"
Journal reused `.wide-list` rather than inventing a second list
styling; and when this version's own close-out audit went looking for
genuine technical debt, what it actually found — `escapeHtml()`
reimplemented in nine places, `clamp()` reinvented in ten more — was
exactly the shape of problem this pattern exists to prevent, in the
handful of places nobody had gotten to yet. The fix each time was the
same one-line lesson: reach for the shared thing before writing a new
one, even when the new one would only be five lines.

**Which systems evolved furthest past their original intention:** the
debug-hook-plus-fresh-port verification workflow itself. It started as
a narrow workaround for one specific tool (`computer{action:"screenshot"}`
timing out) and became, phase by phase, the standard way every claim in
this entire version got checked — not just visual ones. By the end it
was routine to mount a real UI class against a detached container, drive
real `KeyboardEvent`s, walk the live scene graph for a world position, or
call a store's own real methods directly through `window.__debugStores`
— all because the underlying discipline ("verify against the live
engine, not against what the code reads like it should do") turned out
to generalise far past the one bug it was built to work around.

**What surprised me:** how well the codebase's own discipline held up
under a real, independent, full-repository audit. Zero orphaned files
across 258 files. Zero `TODO`/`FIXME` markers anywhere in `src/`. Zero
commented-out code. The debt that *did* exist was almost entirely
small, repeated micro-duplication — the same five-line pattern
reinvented independently rather than reached for — not anything
structurally wrong. The second surprise was smaller but sharper: more
than one doc had quietly gone stale in exactly the way Version 2's own
retrospective already named and warned about — `docs/TOOLS.md` still
describing a limitation Phase 7 had already closed, `docs/COMPUTER.md`
still calling `BrowserApp`/`AIApp` placeholders years after they became
real. The warning was right; it just needed a real audit to actually
catch the drift rather than trusting that writing the warning once
would prevent it.

**What philosophy emerged, rather than being declared upfront:**
investigate the *investigation* too, not just the code. Partway through
this version's own closing audit, a research pass reported that
`MathUtils.js` had no shared `clamp()` function — confidently, as a real
finding. It was wrong; `clamp()` had been sitting at line 1 of that file
since early in the version, already used in half a dozen other places.
The actual bug wasn't in the codebase — it was in trusting a claim about
the codebase without checking it directly first. The fix cost one grep.
The lesson generalises past this one case: a delegated research finding
deserves exactly the same "read the file before trusting your memory of
it" discipline this project already applies to a person's *own* memory —
it just wasn't obvious that the rule needed to extend there until it
almost didn't.

**What should never change, moving into Version 4:** "say what's already
fine," reconfirmed a third time. This version's own prototype-and-gap
audit went looking for rough edges in the AI system, `host-companion/`,
and the Plugin SDK specifically expecting to find several — and mostly
didn't. The AI Mission Control, the resident conversation system, and
`host-companion/` all turned out to be genuinely solid, disciplined work,
reported as such rather than manufactured into "findings" to justify the
audit's own effort. The two or three things that *were* real (a dead CSS
block, a genuine tension in the Plugin SDK's own opening promise) read as
credible precisely because the report didn't pad itself with invented
ones.

**Advice to whoever continues this, including a future version of me:**
when a task is genuinely large — a full-repository sweep, not a single
phase — delegating the mechanical breadth-first search to parallel
research is the right call, but the judgment stays with whoever's
holding the pen. Read every delegated finding as a claim to verify, the
same way you'd read your own memory of a file: with real confidence,
checked anyway. And when the investigation turns something up that the
user didn't ask about but is clearly true and clearly in scope — say so
plainly and let them decide, the way this version's own closing
conversation surfaced a real architectural direction (resident/Being
convergence) nobody had explicitly requested, simply because five
independent docs had already been pointing at it for two versions
running.

## Handover to Version 4

Notes for whoever picks this up next, written as though I'm handing over
a real project rather than closing a chapter.

**What the Workshop actually is, underneath everything:** unchanged from
Version 2's own account, and more true now — a physical place with a
memory, built out of small, honestly-labelled systems that each do one
thing and expect to be read by someone else later. Version 3 deepened
the "memory" half of that specifically: a resident whose conversations
genuinely persist, weather that resumes honestly rather than snapping to
a default, and — as of this version's own closing contribution — a
player's own Journal that finally works the same way, dated entries that
don't erase themselves. The one place that still didn't have real memory
by the start of this version now does.

**The patterns worth carrying into everything new — the same three,
plus one this version's own audit surfaced:**

1. **One implementation, several doors in.** Still the single
   highest-value habit in this project. Before building a second version
   of anything, check whether an existing one can grow an entry point
   instead.
2. **Root cause, not the symptom as reported.** Reconfirmed concretely
   this version: Phase 1's own ladder investigation reported the
   mechanic as "already complete," and it took Phase 3b — testing the
   actual reported failure mode (walking up to a ladder from a distance)
   rather than the mechanic in isolation — to find the real bug, a solid
   collision box blocking approach entirely. The lesson isn't new; the
   reminder that even a careful investigation can still verify the wrong
   thing is.
3. **Say what's already fine.** Still the single most trustworthy thing
   any report from this project can do.
4. **Verify a claim before trusting it — including a delegated one.**
   New this version, named in the retrospective above: memory drifts,
   and so does research you didn't do yourself. Both deserve the same
   two-minute check before anything gets built on top of them.

**What to be careful about:** the codebase is larger again now (258
files under `src/`, ~44,000 lines) — Version 1's closing advice said
this mattered at thirty-one phases, Version 2's said it mattered more at
two full versions, and it is not going to become less true from here.
Read a file before trusting your memory of it, and now: verify a
delegated finding the same way.

**What I'd genuinely like to see next, if it were mine to plan:**
Version 2's own handover named two things sitting ready and unused —
`TwoBoneIK.js` and `WorkshopSkeleton.autoMapSkeleton()`. Both were
actually completed in this version's own Phase 1, which is worth naming
as a genuinely satisfying piece of continuity: a promise named at one
version's close, kept at the very start of the next one. In that same
spirit, `docs/ROADMAP_V4.md`'s own headline finding is worth restating
here directly — five independent docs (`docs/RESIDENT.md`,
`docs/AI.md`, `docs/BEINGS.md`, `docs/PHONE.md`, `docs/PERSISTENCE.md`)
have all, without coordinating, written their own architecture assuming
a resident that isn't a singleton. Nobody has built it yet. It is the
clearest half-open door in the entire project right now, and the
version's own explicit decision — no second *default* resident, but a
real path for a player to make their own — is the right, honest shape
for finally walking through it.

**Last thing:** the same one, because it's still the only one that
matters. The Workshop was never trying to be impressive. It was trying
to be a place someone would actually want to spend time in, and every
phase that stayed disciplined about that — refining instead of
expanding, connecting instead of adding, admitting what wasn't done
instead of dressing it up — is the reason it still feels like one
coherent place after three full versions instead of a pile of features.
Whatever Version 4 becomes, that's still the one thing worth protecting
on purpose.

— from whoever was holding this at the end of Version 3

## Changelog

<details>
<summary>Full phase-by-phase history (thirty phases so far)</summary>

This project has gone through thirty phases (with one dedicated
refinement pass in between): an architectural foundation and
one believable room (phase 1), turning the computer into a real,
self-contained creative workstation with a physical sit-down/stand-up
transition (phase 2), turning the workbench into the workshop's visual
storyteller via a Project Presence system (phase 3), giving the workshop a
way to create its own new objects at runtime via a Builder app and a
physical Build Mode (phase 4), fixing the workshop's doorway and turning it
into the first building in a real, seamless, walkable world (phase 5),
touch support, installability as a Progressive Web App, and a stability
pass across everything built so far (phase 6), a real personal music
library replacing the stereo's placeholder track (phase 7), giving that
library a proper physical home: the reading and listening corner redesigned
as one intentional area alongside the computer desk (phase 8), a
performance audit and a full Settings app, making everything feel smoother,
especially on tablets, without turning down the visual quality (phase 9), a
player identity system: a modular procedural character and a Wardrobe app
to gradually become whoever you want to be (phase 10), a maintenance pass:
two real bugs properly root-caused (a stuck-key movement bug, a
music-library WebMediaPlayer exhaustion bug), a genuine save-versioning and
migration framework, a Settings Danger Zone, and a
round of interior/lighting refinement (phase 11), the Builder Phone:
redesigning how building feels rather than adding new
Builder functionality, with Workshop furniture now movable through the
exact same mechanic as Builder objects, and Builder-placed objects now
genuinely part of the physical world through real collision (phase 12),
an even-split Builder workspace, a curated expansion
of both the primitive shape set and the Construction Library, and a real
bug fix for the front doors (phase 13), and — this phase — a full
Environment System: ten weather states instead of three, three modes
(Manual, Live Weather via a real free weather API, and a genuinely
evolving Workshop Dynamic), a real sky with moving clouds, sun, moon, and
stars, and weather that now reaches indoor lighting, outdoor atmosphere,
and ambient sound alike (phase 14), and — this phase — a generic
reflection capability (mirrors and polished surfaces, not a special
"mirror object"), a physical wardrobe and mirror that open the exact same
Wardrobe app the computer does, and a smooth first/third-person camera
toggle for viewing outfits and Builder creations (phase 15), and — this
phase — a quality pass rather than a feature one: real bugs found through
actual everyday use (a backwards third-person camera and sitting pose,
an unreachable wardrobe and notebook, dark mirror reflections, and a real
performance cause behind occasional choppiness), each root-caused and
fixed rather than patched around, plus falling rain, distinct weather
sky tints, and a hidden-but-functional scrollbar throughout the computer
(phase 16), and — this pass — mirrors that no longer chase the player
around the room: a fixed viewpoint replaced a camera that reflected the
player's own position every frame, fixing both the "reflections show
areas outside the Workshop" bug this caused and a real chunk of the
performance cost mirrors carried (phase 16.5), and — most recently — a
complete movement and expression system: running, crouching, jumping,
and real vertical collision including climbable ladders; a second,
independently-customisable body model; and a full keyframe Animation
System with its own frame-by-frame editor, a shared library of default
and player-created animations, import/export, and a lightweight Emote
Wheel to trigger them (phase 17), and — most recently — helping you
actually understand the world around you: a toggleable compass, real
solar/lunar astronomy driven by your own location, a Workshop Time
control that eases the sun and moon to wherever you set it rather than
jumping, rain that correctly recognises when you're indoors, and an
"I'm Lost!" button for exactly what it sounds like (phase 18) — and, most
recently, a round of everyday comfort fixes: placing a Builder object is
now a left-click in the world instead of a Phone button, a new Display
Surface behaviour lets any chosen part show an uploaded image, and a
handful of real bugs (a taller character sinking into the floor, the
mirror's own left-right flip, an "intermittent beeping" that turned out
to be an over-electronic cricket sound) got root-caused and fixed rather
than patched over (phase 19) — and, most recently, a real Workshop
Browser: tabs, an address bar, and persistent sessions that survive
closing and reopening the Workshop, a `workshop://` protocol serving real,
live pages (the actual documentation, your actual project list), and an
architecture — `PageRegistry` — built so a future Workshop Host can slot
in its own pages without the Browser itself ever needing to change
(phase 20) — and, most recently, AI Mission Control: a calm, honest place
to prepare a future Workshop resident's connection to a local Ollama
server, its identity (in plain words, not raw prompt text), behaviour
tuning, and multiple saved profiles, with memory and embodiment settings
already shaped for phases still to come (phase 21) — and, most recently,
the Workshop's first resident: a small, semi-transparent floating bubble
that simply lives there, gently aware of you when you're nearby, willing
to talk when you walk up to it, and quietly waiting rather than
disappearing whenever Ollama happens to be offline (phase 22) — and, most
recently, the Workshop Host: a lightweight, purely architectural
companion with no window or interface of its own, preparing the
Workshop's eventual bridge to your local machine (applications, projects,
files, plugins) entirely through ordinary Browser pages, alongside a real
fix for a Browser page-refresh bug that had been quietly there since it
was first built (phase 23) — and, most recently, a dedicated quality
pass: fixing the player model's own facing direction at its actual root
cause, French door handle placement, a genuinely non-cosmetic Quiet
Corner overlay fix, new Atmosphere and Diagnostics tabs in Settings,
honest cross-browser error handling for music playback, and a resident
whose position now survives a reload even mid-journey (phase 24) — and,
most recently, Beings: a complete, general-purpose system for designing,
saving, placing and managing creatures, animals, robots, or any other
character as ordinary Workshop assets, with its own Being Creator (a real
GLB/GLTF model import pipeline shared across the whole Workshop), Being
Spawner, and Being Manager (phase 25) — and, most recently, a consistency
and immersion pass across the whole Workshop: a root-caused fix for an
inverted crouch animation, Bubble now requiring a direct look before
interacting (and gaining a gentle drag-to-reposition), a genuinely fixed
Notebook close behaviour, per-property manual Atmosphere overrides, and
imported models now usable as Builder shapes and optional player bodies
(phase 26) — and, most recently, World Expansion: the Builder growing
into a true World Builder, automatically recognising any enclosed
structure a player builds as a real interior (the same systems the
Workshop's own room already uses, no manual marking required), a
substantially larger construction catalogue organised into clear
categories, reusable multi-object Blueprints, and optional grid/rotation
snapping with true multi-axis rotation (phase 27) — and, most recently,
the Workshop Phone: a proper personal device carried everywhere,
replacing the old Builder Phone with a modular app framework (Builder,
Beings, Wardrobe, Bubble, Browser, Workshop, Emotes, Settings) that never
freezes the player while it's open (phase 28) — and, most recently, a
Persistent World: a shared time service so Bubble, Beings, and the
environment all answer "what should I have been doing while the player
was away?" from the same elapsed-time calculation, rather than resuming
frozen exactly as they were left (phase 29) — and, most recently, a
Universal Experience pass: the Computer and Workbench's own 3D-projected
screens gained a comfortable-size floor so no interface built on them
ever becomes unreadably small, the shared editing workspace and the
Phone both reorganise on a narrow screen, and touch targets, focus
states, and first-launch performance detection now apply consistently
across the whole Workshop (phase 30).
See `docs/ROADMAP.md` for what's next, `docs/ARCHITECTURE.md`
for how the workshop as a whole is put together, and `docs/COMPUTER.md` /
`docs/WORKBENCH.md` / `docs/WORLDBUILDER.md` / `docs/WORLD.md` /
`docs/POLISH.md` / `docs/MUSIC.md` / `docs/PERFORMANCE.md` / `docs/PLAYER.md` / `docs/REFINEMENT.md` for how those specifically work.

Phase 31A followed: a dedicated Workshop Polish pass and the final
milestone of Version 1 — a real root-caused fix for the computer clock's
own "NaN : NaN" display and a Phone Home-button visibility bug, a subtle
thinking indicator while Bubble is generating a reply, a held-key camera
zoom, the Quiet Corner's own darkened-screen bug fixed at its actual
cause (plus a genuine look-around-while-seated capability it never had),
Emotes rebuilt as a real Phone app instead of an immediate wheel-trigger,
and the dust motes proof of concept evolved into a permanent, two-window
atmospheric effect. See `docs/ROADMAP.md`'s own Phase 31A entry for the
complete account.

**Version 2, Phase 1 — Workshop Residents (v2.0.1)** — a deepening pass,
not a new system: Bubble gained long-term Personality Traits (a small,
named set alongside the existing free-text identity fields), a genuine
three-timescale Mood/Emotion/Personality distinction, emergent
Preferences and Behaviour Memory (both gated on "is there actually a
pattern here yet"), conversation-time Curiosity about what's changed in
the Workshop, a real (if deliberately modest) Conversation Memory
distinct from ordinary chat history, and five real Resident Embodiments
(Floating Orb, Cube, Prism, Lantern, Wisp) with genuinely active colour,
glow, scale, and idle-behaviour settings in place of what were previously
inert Mission Control fields. See `docs/RESIDENT.md` and `docs/AI.md` for
the full account.

**Version 2, Phase 2 — AI Intelligence (v2.0.2)** — Mission Control
deepened further: architecture for additional AI providers (LM Studio,
OpenAI, Anthropic, a Custom Endpoint — Ollama remains the only functional
one, every other choice says so honestly), seven continuous Behaviour
Dials complementing the previous phase's discrete Personality Traits,
Memory Configuration's categories and lifetimes both genuinely activated
(what Bubble remembers, and for how long), a genuinely isolated Resident
Sandbox for testing configuration changes without touching Bubble in the
room, and a calm Resident Health status display. See `docs/AI.md` and
`docs/RESIDENT.md` for the full account.

**Version 2, Phase 3 — Browser Ecosystem (v2.0.3)** — the Browser grew
into the Workshop's universal interface: a real multi-scheme
`PageRegistry` (`workshop://`, `host://`, `plugin://`, all treated
identically), six new Workshop pages including a Shared Asset Library
with genuine per-item file pages (real previews, metadata, and
cross-referenced relationships for Objects, Blueprints, and Animations),
every Host page migrated to its own `host://` scheme alongside two brand
new services (Documents, Downloads), two real working example plugins
(`plugin://example-plugin`, `plugin://calculator`) proving the
plugin-page mechanism end-to-end, the foundations of Unified Search, and
bookmarks reaching the full Browser's own toolbar. See `docs/BROWSER.md`
and `docs/HOST.md` for the full account.

**Version 2, Phase 4 — Workshop Platform (v2.0.4)** — the Workshop Host
completed its own nine-service architecture (Application, File, Project,
Plugin, Asset, Resident, Automation, Hardware, Diagnostics), four of them
— Asset, Resident, Diagnostics, Plugin — genuinely real Host-level views
over systems that already existed. A real, optional, zero-dependency
local companion server (`host-companion/`) and a matching
`HostConnectionManager` bring one genuine local-machine capability
(sandboxed, read-only folder listing) to life, gated by a real, persisted
Permissions architecture. Three new Local Protocols (`asset://`,
`resident://`, `project://`) joined `workshop://`/`host://`/`plugin://`,
each a new canonical scheme for something that already existed. See
`docs/HOST.md` and `docs/BROWSER.md` for the full account.

**Version 2, Phase 5 — Workshop Asset System (v2.0.5)** — a shared
language for everything the Workshop already creates: one common
Workshop Asset envelope (name, stable id, author, dates, version,
categories, tags, thumbnail, dependencies, validation status) computed
around Objects, Blueprints, Animations, Models, Images, and Music's own
real, unchanged internal shapes. Real, working: Favourites and Recently
Viewed (both persisted), unified search across every individual asset,
real Blueprint→Object dependencies and their reverse, real validation,
and genuine swatch thumbnails. Plugins can now register their own
Workshop Assets the same way they register pages — proven with three
small, real "sticker" assets contributed by the reference example
plugin. See `docs/ASSETS.md` for the full account.

**Version 2, Phase 6 — Advanced Animation (v2.0.6)** — movement became a
shared language: frame advancement and pose blending extracted into
reusable pure functions, a real, tested skeleton-mapping heuristic
(Mixamo's own naming quirks included) letting imported rigs join the same
animation vocabulary the Player rig always spoke, and real rest-pose-aware
retargeting. Beings genuinely play Workshop animations for the first
time. A real two-bone IK solver, procedural animation layering ("walking
while waving"), animation events, and a working shared Pose Library all
arrived alongside a genuinely retargeted Animation Editor preview. A
related, previously-theoretical `ModelLoader.js` bug (shared skeletons
across cloned models) was found and fixed once animated models actually
needed it to be correct. See `docs/ANIMATION.md` for the full account.

**Version 2, Phase 7 — Being Creator (v2.0.7)** — a complete, working
body-construction workflow: beings can now be built entirely from
primitive shapes (Cube, Sphere, Cylinder, Capsule) in a genuine
parent-child hierarchy, with rig creation kept deliberately simple —
tagging a part with a Workshop skeleton joint name directly, rather than
a second bones system. A real hierarchy editor (selection, re-parenting,
duplication, and a genuine Mirror tool reflecting an entire limb at
once), live animation preview inside the Creator itself, and full
Workshop Asset System integration (real metadata, thumbnails,
dependencies, validation, and a Browser detail page) round it out. A
real, unrelated bug in `AnimationLibraryStore` lookups — silently
breaking every default animation clip's own Asset System integration —
was found and fixed along the way. See `docs/BEINGS.md` for the full
account.

**Version 2, Phase 8 — Builder Evolution (v2.0.8)** — the Builder became
a genuinely professional creative tool: real multi-selection (shift-
click, and a true screen-space drag-select rectangle), object grouping
(select, and now move, an entire group as one unit), a generic undo/redo
system covering every mutating Build Mode action, alignment and
distribution tools, real measurement (dimensions and inter-object
distance, reusing already-computed collision data), and transform copy/
paste/reset. Blueprint capture now works from an exact multi-selection
rather than only a radius guess, and blueprints can be updated in place
for the first time. All of it layered on top of the existing single-
selection mechanics without changing them. See `docs/WORLDBUILDER.md`
for the full account.

**Version 2, Phase 9 — World Builder (v2.0.9)** — the Workshop grew real
grounds: a genuine, bounded, editable terrain heightmap (raise, lower,
flatten, smooth, terrace, all real tested algorithms, plus vertex-colour
painting for grass/dirt/rock/sand/gravel/mud/path), walkable for real via
`CameraSystem`'s own ground-height query. Seven real Nature pieces
(trees that genuinely sway in the wind) and five real Path tiles filled a
gap this phase discovered — `docs/WORLD.md` had documented these as
already existing from an earlier phase when only their category
reservations did; corrected alongside the real implementation.
Construction Library pieces (walls, doors, and the new Nature/Paths ones
alike) joined the Shared Asset Library for real. See `docs/WORLD.md`'s
own "World Builder (Version 2, Phase 9)" section for the full account.

**Version 2, Phase 10 — Living World 2.0 (v2.1.0)** — the Workshop's
systems began quietly observing one another. A shared World Awareness
layer (`WorldAwareness.js`) answers "what does the world look like right
now" — time, weather, music, player, active projects, nearby Beings,
resident mood, recent events — as one consistent snapshot any system can
query, alongside a real, bounded World Event Log recording genuine
transitions (a weather change, a sunrise, a song starting). Bubble
gained three new believable behaviours (watching the player work,
remaining near ongoing projects, becoming quieter at night), a
lightweight awareness of the Workshop's own Beings, and "usual working
hours" distinct from ordinary visiting patterns — all layered onto
existing mechanisms rather than a new decision system built on top. See
`docs/RESIDENT.md`'s own "World Awareness" section for the full account.

**Version 2, Phase 11 — Atmosphere (v2.1.1)** — teaching the Workshop
how to breathe, not adding more weather effects. A real, altitude-driven
sky gradient (night through blue hour, dawn, golden hour, and day, correct
for sunrise and sunset at any latitude), two cloud layers that pick up
the sky's own colour instead of staying flat white, and cloud cover that
now genuinely dims the stars and moon. A real indoor/outdoor audio
split — rain stays close and present through a roof, wind is heavily
buried through a wall — and four-phase nature audio (a brighter dawn
chorus, a warmer dusk insect mix, the original untouched night crickets).
Season Foundations: a real `getSeason()`, surfaced but deliberately
inert. Atmosphere Profiles: six built-in presets (Sunny Morning, Golden
Evening, Storm, Fog, Winter Morning, Summer Afternoon) plus anything
saved by hand, applied in one click from a reorganised Atmosphere tab.
Bubble now also watches a windy window and shelters from a storm, using
the exact mechanism Living World 2.0 already established. See
`docs/ATMOSPHERE.md` for the full account.

**Version 2, Phase 12 — Plugin SDK (v2.1.2)** — the Workshop becomes a
real platform, not just extensible in theory. A unified `Workshop`
facade (manifest + `setup(Workshop)`) built entirely on top of the
registries that already existed — pages, assets, Phone/Computer apps,
Host services, the Construction Library — none of which changed shape.
Real per-plugin permissions (auto-granted, genuinely revocable, since
there's no real sandbox to gate same-origin code behind), isolated
per-plugin storage, and error isolation strong enough that a throwing
plugin marks itself `"error"` rather than taking the Workshop down.
`host://plugins` is now a genuine Plugin Manager — live status,
manifest metadata, permission checkboxes, and real Enable/Disable/
Reload. One new reference plugin, `workshopToolkitPlugin.js`, touches
every capability at once (a page, a Builder asset, a Phone app with
real persisted storage, a Host service); the original two example
plugins are untouched, still demonstrating the contracts the SDK sits
on top of. See `docs/PLUGIN_SDK.md` for the full account.

**Version 2, Phase 13 — Workshop Reliability (v2.1.3a)** — no new
features; every existing one made to work the way it always should
have. Ladders finally climb (the input math was already fixed; the
Construction Library piece just never carried the behaviour that would
have used it). The fall animation no longer fires on ordinary slopes.
First-person crouching no longer clips the camera into the player's own
head. Factory Reset now clears every IndexedDB database the Workshop
actually uses, not just the original two. The biggest change: the
Workshop's terrain and its old separate flat ground are now one system —
`TerrainSystem.js` alone, grown from a 48m patch to a 200m one plus a
large non-editable skirt, with existing sculpting automatically migrated
onto the new grid. An architectural review pass found and fixed a real
one: twelve Construction Library pieces had been silently duplicated,
meaning a whole phase's worth of wind-swaying Nature assets had been
unreachable dead code since the day they were written. See
`docs/ROADMAP.md`'s own Phase 13 account for the complete list,
including the moon/sun timing bug that turned out, after real
investigation, not to be a bug at all.

**Version 2, Phase 13b — Workshop Workflow (v2.1.3b)** — the phase that
moved this very changelog here. No new systems: the README simplified
from 869 lines to under 470 (this document is where the rest went,
preserved rather than deleted), a real setup guide added
(`docs/SETUP.md`), whole-Workshop backup and a new single-profile
AI export/import brought into one consistent shape, the Export/Import
Backup controls moved from the HUD into Settings, the Builder gaining
the ability to import its own `.glb`/`.gltf` models directly instead of
detouring through the Being Creator, a live brush-size preview added to
terrain sculpting, and an architectural review pass that found a real
one: a genuinely redundant pair of README sections, several outdated
factual claims, and a stale code comment, each corrected at the source.
See `docs/ROADMAP.md`'s own Phase 13b account for the complete list.

**Version 2, Phase 13c — Workshop Personality (v2.1.3c)** — Bubble's
visual identity redesigned around a real, shared architecture rather
than a one-off touch-up. Eight expressions now, drawn from one
canonical list; a genuine pixel-art Expression Creator inside AI
Mission Control, with import/export/sharing following the identical
pattern the Workshop Workflow phase's own AI Profile export
established; Expression Sets registered as real Workshop Assets with
their own genuine pixel thumbnails; and a resident's active expression
set living as a plain per-profile reference — `expressionSetId`,
resolved the same way `provider`/`model` already are — specifically so
a future second resident needs nothing new to carry its own. Expression
changes cross-fade now instead of swapping instantly. See
`docs/ROADMAP.md`'s own Phase 13c account for the complete list,
including which of the three new expressions has a real behavioural
trigger and which are honestly still waiting for one.

**Version 2, Phase 14 — Diagnostics (v2.1.4)** — the Workshop learns to
understand itself. `workshop://diagnostics` rebuilt into a real Control
Centre: one colour-coded overall health banner, computed live from
actual subsystem state (a failed save, a plugin in error, a genuinely
broken asset reference), never manually assigned, with a plain-language
line per subsystem and every deeper technical detail tucked behind a
native, closed-by-default `<details>` element — one page for both a
casual glance and a deep investigation. A new technical Workshop Event
Log, deliberately separate from the existing world-flavoured one, gives
plugin errors and connection changes a real, searchable, exportable
home. Two genuinely silent failure modes were found and fixed along the
way: a failed Workshop save used to announce nothing at all, and a
plugin's own crash was never actually broadcast anywhere. Suggested
Fixes name the exact plugin or asset responsible rather than a generic
error; a small Dependency Awareness section explains how Workshop
systems actually rely on each other. See `docs/ROADMAP.md`'s own Phase
14 account for the complete list.

**Version 2, Phase 15 — The Workbench (v2.1.5)** — a craftsmanship pass,
not a redesign: the same vice, tray, lamp, clipboard, notebook, and fan,
at the exact same positions, built with genuinely more care. A richer
wood grain on the one surface a player actually leans over; two real
material gaps filled (`Materials.plastic()`/`rubber()`, reusable
everywhere, not one-off) and applied wherever the bench had been using
generic `matte()` for something that was always plastic or rubber; a
structural stretcher between the legs; a crank that finally makes the
vice read as a vice; one deliberately restrained pencil, resting on the
clipboard, as the phase's entire environmental-storytelling addition. A
real 7cm geometric overhang on the clipboard, quietly present since the
feature was built, found and fixed. The Workshop's first interaction
sound effect — a soft paper shuffle on leaning in and standing up — and
with it, a real dead setting (Effects Volume, present since early in
Version 2 with nothing to control) finally doing something. A follow-up
review pass found one more: `Materials.ground()`, orphaned since the
Reliability phase's terrain migration, quietly dead in the exact file
this phase's own new materials live in — removed. See
`docs/ROADMAP.md`'s own Phase 15 account for the complete list.

**Version 2, Phase 16 — The Desk (v2.1.6)** — the same craftsmanship
treatment, turned on the Workshop's other hero prop: the desk, the
monitor, and the chair, all at the exact same position and footprint.
A richer wood grain on the desk's own top, built the identical way the
Workbench's own top was; a monitor that finally has a real bezel and a
hinge instead of reading as a flat glowing rectangle; four more
`matte()` surfaces (the monitor stand, the keyboard, the mouse, the
lamp shade) that were always plastic in real life, now genuinely
`Materials.plastic()`, plus a new rubber mousepad. Two metal stretcher
rails under the desk; on the chair, a real five-point swivel base with
castors in place of a flat disc — the chair's own equivalent of the
vice's crank — an armrest pair, a mechanism plate, a thicker seat, and
a slight recline. One small, deliberately restrained addition: a pen
holder with two pens, placed to balance the lamp on the desk's other
corner. A second interaction sound effect — a soft chair creak on
sitting and standing, sharing the same entry point the paper shuffle
already uses. One more real architectural finding: `PlaceholderFactory
.softBox()`, promised in its own docstring to fake a bevel it never
actually produced, with no callers anywhere in the project — removed.
See `docs/ROADMAP.md`'s own Phase 16 account for the complete list.

**Version 2, Phase 17 — The Workshop Interior (v2.1.7)** — the same
craftsmanship treatment, scaled up from one piece of furniture to the
room shell itself: baseboards on all four walls (the single largest
gap found, sliced around the south wall's own doorway the same way the
wall itself already was), a protruding sill under each window, real
hinge plates on the front doors, a ceiling canopy plate at each pendant,
and the Workshop's first wall-mounted lights — sconces flanking the
front doors, through the exact same practical-light mechanism every
other fixture already uses. The light switch finally switches: a real
toggle nub, tilting between on and off with the actual state. A third
interaction sound — a door creak, lower and slower than the chair's
own — joins the paper shuffle and the chair creak through the same
entry point. Two real findings resolved: a screwdriver handle that was
never really matte, and a genuinely varied colour palette in the
shelving that sat completely unused while a near-identical set of wood
browns did its job instead — both arrays got a real purpose rather than
one being deleted. See `docs/ROADMAP.md`'s own Phase 17 account for the
complete list.

**Version 2, Phase 18 — Furniture & Storage (v2.1.8)** — the first
craftsmanship phase to span several objects rather than one, all
gathered into a new dedicated `docs/FURNITURE.md`. Tool storage gained
painted shadow-board silhouettes behind each hung tool — an empty hook
now reads as "the wrench is out" — plus a drawer left pulled open a few
centimetres. Shelving gained a shelf of labelled storage bins and a cap
trim, and a real dead-code finding: a genuinely varied colour palette
that sat unused behind a `void` statement while a near-identical set of
browns did its job instead. A new `Materials.cork()` (with its own
procedural texture) replaces the pinboard's flat tint, and each pinned
note now has a real push pin. The wardrobe gained a cornice and raised
door panels; the sitting area gained a cushion tier, a real table foot,
and one book. The already-redesigned music cabinet got two small
material fixes (a vinyl record and speaker cones that were never really
matte) and nothing else. See `docs/ROADMAP.md`'s own Phase 18 account
for the complete list.

**Version 2, Phase 19 — Decorative Details (v2.1.9)** — the smallest-
scoped craftsmanship phase yet, on purpose: three new additions to the
whole room, each held to "if this disappeared, would the Workshop lose
a piece of its personality?" A wall clock between the north windows —
the Workshop's first genuinely time-driven decoration, its hands
rotated by `LightingSystem` from the exact same hour value already
broadcast for the sun, no new system required. One small plant on one
window sill, deliberately not both. One small framed sketch on the
south wall, reusing the Builder's own sketch-paper material rather
than inventing a second one. A real material gap named directly in
this phase's own brief: `Materials.ceramic()`, replacing `matte()` on
every plant pot in the Workshop. A ticking clock sound was considered
and deliberately left out — it needs real positional audio to sound
right at different distances, which doesn't exist yet. See
`docs/ROADMAP.md`'s own Phase 19 account for the complete list.

**Version 2, Phase 20 — Visual Identity (v2.2.0)** — a different kind
of phase: a whole-pipeline consistency review, plus two named
regressions actually root-caused rather than patched around. Shadows
were missing from the terrain because the sun's shadow camera frustum
was being set as plain properties that `OrthographicCamera` never
applies without an explicit `updateProjectionMatrix()` call — missing
everywhere in the codebase, meaning the shadow camera had silently been
running on its tiny construction-time default (±5m) the entire time,
regardless of what several past phases' own comments claimed to expand
it to. One call fixes it. Jumping was silently cancelling itself on
every attempt: the terrain phase's own slope-following logic read a
"was grounded" flag captured *before* the jump-input check that clears
it, so every jump's first frame looked like ordinary ground contact and
got reverted before it ever rendered. One flag reference fixed it. A
broader review confirmed tone mapping, material families, reflection
tuning, and the terrain/floor material match at the doorway threshold
were all already consistent — nothing rebuilt, nothing new introduced.
See the new `docs/VISUAL_IDENTITY.md`, and fuller per-bug writeups in
`docs/WORLD.md` and `docs/PLAYER.md`.

**Version 2, Phase 21 — Sound & Presence (v2.2.1)** — three previously-
deferred audio items, each resolved once the conditions their own
deferral named were actually met. A distance-based gain scalar
(`AudioSystem._computeDistanceGain()`) gave every interaction sound real
spatial positioning, which unblocked a wall-clock chime on the hour
(deferred in Decorative Details) and, combined with a new generic
`soundOnInteract` field on `FurnitureSystem`, tool storage's own drawer
sound (deferred in Furniture & Storage). A building creak/settle sound,
self-scheduled every 3-7 real minutes and indoors only, resolves the
Workshop Interior phase's own deferral — that phase worried an
unprompted creak would have no cause a player could connect it to; this
phase's own brief asks for exactly that as the desired behaviour.
Bubble gained a first, very quiet sound on starting to think. An
architectural review found `playPaperShuffle`'s volume had never been
checked against the family that grew up around it (fixed) and that four
creak/scrape sounds were hand-copied duplicates of one graph (merged
into a shared helper, changing nothing audible). See the new
`docs/AUDIO.md` for the complete account.

**Version 2, Phase 22 — Workshop Tools (v2.2.2)** — the Workshop's first
real tool collection, and the first phase in a while to introduce
genuine new capability rather than refine what already existed. Eleven
calculators, ported with their real business logic intact from a genuine
external application (a security/screen-door manufacturer's own
production tool), grouped into Sales/Manufacturing/Installer. One shared
toolbox — browse, run, build — reachable from the tool cabinet, a new
computer app, and a small addition to the Workbench's own clipboard
panel, all calling one implementation rather than three. Projects gained
a real `calculations` record, distinct from the toolbox's own rolling
"recent runs" history. The Calculator Builder's foundations: a small,
hand-rolled arithmetic formula language (never `eval()`), six real
templates, and custom calculators stored the same way the Builder's own
objects already are. One deliberate architectural decision stands out:
the source application's own job-tracking board was *not* ported, since
the Workshop's existing project system already plays that role in its
own idiom — building a second one would have been exactly the
"duplicate functionality" this phase's own review was watching for. See
the new `docs/TOOLS.md` for the complete account.

**Version 2, Phase 23a — Workshop Refinement, Pass A (v2.2.3a)** — the
first refinement pass before Version 2 is considered complete, six real
issues root-caused rather than patched. Factory Reset (and Backup
Import) had a genuine race condition — `beforeunload`'s own autosave
firing during the reload both actions trigger, silently undoing the
reset or import a moment before it took effect. The moon was tracing
the mirror-image of its own real cycle — an addition that needed to be
a subtraction, invisible at exactly the two phase values a previous
investigation happened to test. The crouch camera constant never did
what its own comment claimed ("proportional to the character," while
subtracting a fixed 0.5m regardless) — now a genuine ratio. Ladders had
a real detection bug (an ~8cm-deep hit zone, none of the generosity
every other interaction zone already holds itself to) alongside an
honest account of the already-correct intended interaction. AI gained a
real keep-alive system — warming the active model proactively rather
than just tolerating a longer wait — with a persisted, user-facing
toggle in Mission Control; AI profile export was reviewed and found
already complete. The startup screen's "Step inside" button had no
click handler at all until the entire boot sequence finished — now
responsive immediately, with a gentle status line. See
`docs/REFINEMENT.md`'s own "Refinement Pass A" section for the complete
account.

**Version 2, Phase 23b — Interface & Design Refinement (v2.2.3b)** — the
second refinement pass, a craftsmanship pass on the Workshop's own
interface rather than the Workshop itself. A real, findable gap in the
design tokens: shadows had no shared scale at all, and three separate
files hardcoded the exact same shadow value byte for byte (one with an
accidental blur-radius drift from the other two) — now a small, real
shadow scale, plus two genuine radius gaps closed alongside it. The
Workshop Phone got the complete shell refinement its own brief named —
a real status bar showing the Workshop's own actual time, a home
indicator, refined proportions, real icon tiles — while staying wood
and brass rather than becoming a generic glass case. The Builder's own
named overflow bug ("additional options push the interface wider than
its container") was traced to a specific row that conditionally grows
from two fields to three with nowhere for the third to go — fixed with
wrapping, not a workaround. A review of the Workshop's other digital
interfaces found the shared navigation and form-control patterns
already genuinely consistent, closing the real gaps found rather than
rebuilding what was already working. See the new
`docs/DESIGN_SYSTEM.md` for the complete account.

**Version 2, Phase 23c — Final Review & Version 2 Sign-Off (v2.2.3c)** —
the final engineering phase of Version 2, a complete codebase audit
rather than a targeted fix list. A scripted cross-reference check (437
exports checked against every other file) found three genuinely dead
exports — each with the same tell earlier dead-code finds already
established, a docstring claiming an integration that checking
directly showed never existed — removed, while two more that looked
identical at a glance turned out to be deliberate, explicitly-
documented forward-looking infrastructure and were left alone.
Documentation staleness found and fixed in two places (a stale asset
claim, a cross-reference pointing at writing that had moved). Naming
reviewed and deliberately preserved rather than churned. This closing
phase's own One Contribution ties the wall clock's hourly chime into
Bubble's own wandering, reusing the exact mechanism Version 1's own
closing contribution left behind for exactly this kind of future
signal. See `docs/REFINEMENT.md`'s own "Version 2 Sign-Off" section for
the complete technical account, and this file's own "Reflecting, after
Version 2" and "Handover to Version 3" sections below for the rest.

**Version 2, Phase 23d — Independent Release Review (v2.2.3d)** — the
true final act of Version 2: a review performed by an outside reviewer
who built none of it, re-running the sign-off phase's own kinds of
audits independently rather than trusting them. The main finding
validated the project's own "a docstring is a promise" retrospective in
the sharpest way possible: Build Mode's migration into the Phone had
left five locations (two docstrings, a main.js comment, and two docs)
describing a suspension contract — `buildmode:entered`/`exited` events
and an `enter()`-side guard — that had moved into `PhoneSystem` phases
earlier, surfaced by an emit/listen cross-reference sweep no previous
audit happened to run; behaviour was correct throughout, and all five
locations (plus the README's matching "B — Toggle Build Mode" /
"camera freezes" claims) now describe the real mechanism. The service
worker's shell precache had drifted (`phone.css`/`tools.css` never
added), fixed. Everything else checkable checked out and is said so
plainly in the new `docs/RELEASE_REVIEW.md`, alongside the release
verdict: yes, ship it. Four documents prepare the Version 3 transition
to repository-first development: `CLAUDE.md` (the Claude Code entry
point and phase-workflow gate), `docs/HANDBOOK.md` (the engineering
handbook), `docs/ROADMAP_V3.md` (a draft of Version 3's natural
directions, recommendation only), and `docs/RELEASE_REVIEW.md` itself.
The One Contribution: `workshop://history` — the Workshop's own story,
readable from inside the place it happened to, through the exact
`docFilePage()` door every other doc page already uses; the place that
remembers everything now includes itself in that memory.

**Version 3, Phase 1 — Completing Promises (v3.0.1)** — the forward-
looking infrastructure Version 2 built and left waiting, wired in before
any new foundation: crouching's real root cause fixed (a render-layer
head-hide, not a joint moved, since the rig has no vertical translation
at all); ladders investigated and playtested against the live engine,
found already complete, no code changed (later corrected — see Phase 3b
below; the playtest verified climbing itself but never simulated walking
up to one, so it missed a real collision bug); three real gaps closed in how
imported Builder objects behave (a footprint-timing race, a misleading
no-op colour control, duplicated import code now shared); `TwoBoneIK`
wired to real foot placement on terrain for the first time, honestly
scoped to standing still, with a real reach-limit asymmetry found by
testing and documented rather than hidden; and `WorkshopSkeleton
.autoMapSkeleton()` validated end to end against two real, externally-
sourced models — finding and fixing a real false-positive bug
("Armature" matching the `"arm"` pattern) along the way. See
`docs/ROADMAP.md`'s own Phase 1 account for the complete story.

**Version 3, Phase 2 — Living Spaces (v3.0.2)** — a full environmental
review of every room and furniture piece, then a refinement pass, not
new systems: a real bookshelf-fullness bug fixed (placeholders only ever
filled the first third of any shelf); two small vinyl-storage clipping
fixes in the music cabinet; a real collision gap closed for the sitting
area's own side table, via a new optional footprint `offset` on
`FurnitureSystem` rather than a symmetric box nearly double the size it
needed to be; one small restrained cable added at the computer desk,
closing a gap the Furniture & Storage phase's own retrospective named
two versions ago; a material-continuity near-duplicate unified at the
roof fascia; and `docs/VISUAL_IDENTITY.md`'s own long-standing "needs a
rendered frame to judge" shadow-bias question finally answered — real
rendered frames read back pixel-by-pixel, since screenshot tooling
proved unreliable in this environment, found no acne at the current
frustum. See `docs/ROADMAP.md`'s own Phase 2 account for the complete
story.

**Version 3, Phase 3 — The Reading Chair (v3.0.3)** — the reading corner's
long-reserved "something calmer" finally delivered, using content that
already existed rather than inventing new content. Two stacked bugs fixed
so the sitting area's own `allowLookAround` focus pose finally works:
`FurnitureSystem._resolveFocusPose()` was silently dropping every
`focusPoseLocal` field except `position`/`lookAt`, and both `main.js`'s
canvas click handler and `PhoneSystem.open()`'s guard refused to act
while any interaction was active, never distinguishing a relaxed, seated
pose from the computer/workbench's fully fixed one — `InteractionSystem`
now exposes `activeAllowsLookAround` as the one shared place that
distinction lives. The sitting area gained its first real behaviour: once
the arrival reminder is dismissed, a small "Read" tab opens a panel
offering "The Workshop's Story" (`docs/HISTORY.md`, the same content
`workshop://history` shows) and "The Archive" (finished projects, reusing
`ArchiveOverlay.js`'s own rendering verbatim rather than a second copy) —
the "narrow" mechanism the phase's own planning settled on, no new
interactable and no change to `InteractionSystem`'s suspension logic. The
Archive itself was enriched in both places at once: full notes and every
saved calculation, not just a title and a date. Two more real Shelving
bugs fixed along the way: top-shelf items clipping through the cap trim
(the frame's height is now decoupled from shelf spacing, sized instead
for equal headroom on every shelf) and the book-packing fix from Living
Spaces reading as too mechanically even (now randomised into natural-
looking clusters). No new AI chat surface this pass, on purpose. See
`docs/ROADMAP.md`'s own Phase 3 account for the complete story.

**Version 3, Phase 3b — Refinement pass (v3.0.3b)** — a short
user-reported bug list, not a new phase. The player's shadow was missing
its head: the crouch fix's own `FIRST_PERSON_HIDDEN_LAYER` needed
re-enabling on a third camera (the sun's shadow camera, alongside the
main and mirror cameras that already did), the same one-line pattern
`ReflectionSystem` already established. Ladders had never actually
worked, despite Phase 1 reporting them complete: `WorldObjectsSystem`
gave every placed object, ladders included, a solid walk-collision box
that stopped the player before they could ever reach `LadderSystem`'s
own climbable zone — fixed by exempting any `"ladder"`-behaviour object
from collision entirely, verified with genuine forward-key input driven
through the real collision path from two approach angles, not a position
teleport (see the correction added to Phase 1's own account). The
Builder Phone's own five tab buttons overflowed off the panel's right
edge instead of wrapping — the same "flex item won't shrink below its
own text" bug an earlier phase fixed for a range slider, fixed the same
way (`flex-wrap: wrap` plus a sized flex-basis). See `docs/ROADMAP.md`'s
own Phase 3b account for the complete story.

**Version 3, Phase 3c — Service worker caching fix (v3.0.3c)** — a real
user-reported bug: loading a new version of the Workshop needed a load,
a refresh, and another load before it actually showed up. Root cause:
the original service worker used one stale-while-revalidate strategy for
every request, including the Workshop's own `index.html`/`css/`/`src/`
files — the exact files that change on every deploy — always serving
whatever was cached first and only refreshing it for *next* time. Fixed
in two necessary layers, each confirmed by testing rather than assumed:
same-origin requests are now network-first (cross-origin CDN requests
keep the original strategy, still the right call for a pinned vendor
URL); and, found only once that alone still failed a real simulated-
deploy test, every same-origin fetch now explicitly bypasses the
browser's own HTTP cache (`{ cache: "no-store" }`), since Python's dev
server sends no `Cache-Control` header and that cache layer sits below
the Service Worker's own Cache API entirely. New `.claude/DEV_NOTES.md`
records this and the dev-session verification habits it forced
throughout Phase 3b, so a future session doesn't rediscover any of it
from scratch. See `docs/ROADMAP.md`'s own Phase 3c account for the
complete story.

**Version 3, Phase 4 — Workshop Rituals (v3.0.4)** — connecting systems
that already remembered their own state, rather than adding new memory.
Investigation found the Workshop remembers far more than the brief's own
framing suggested: real elapsed time (`TimeOfDaySystem`'s realtime
mode), weather, the light switch, the front door, the Workbench's
current project, and music's queue/position all already persist; nothing
stops music playing across any other activity, confirmed directly. Three
small, connected touches followed, each reusing existing state rather
than inventing new tracking: the reading chair now remembers what you
were reading (`FurnitureSystem` gained a small, generic per-piece memory
— `getInteractionState()`/`setInteractionState()` — the same
"one capability, multiple callers" shape `ReflectionSystem`/
`LadderSystem` already use); the music cabinet now offers to pick back
up (`MusicSystem`'s own `wasPlaying` flag, captured into every save and
never once read back since the system existed, finally has a reader);
and the Browser's home page quietly mentions the current project. A
scope boundary was drawn deliberately: `PlayerPatternMemory`/
`WorldEventLog` (Phase 6's), new resident behaviour (Phase 10's), and
creative-tool friction (Phase 8's) were all left alone, and the entry
sequence itself was left untouched on purpose — its instantness is
restraint, not a gap. See `docs/ROADMAP.md`'s own Phase 4 account for
the complete story.

**Version 3, Phase 5 — Beyond One Building (v3.0.5, v3.0.5b)** — proving
`docs/WORLDBUILDER.md`'s claim that the architecture generalises to
player-built rooms without changing. Investigation found the crux of the
brief — automatic enclosure detection — already built
(`BuildingDetectionSystem.js`, from Version 2's World Expansion phase),
something the Version 3 plan hadn't fully accounted for. Two
user-reported bugs followed: excess ground-tile collision, confirmed
already fixed as a side effect of an earlier fix, and interaction points
sitting too low on ground-anchored objects like doors, genuinely fixed
with a new `InteractableComponent.interactionHeightOffset` (default 0,
every existing interactable unaffected) computed centrally by
`WorldObjectsSystem`. Fixing that exposed a real third bug: multi-part
Construction pieces (a doorway's posts and header) were getting one
combined collision box each, solidly blocking the very gap a player is
meant to walk through — fixed with per-part collision boxes
(`collisionBoxes`, keyed by `ObjectCompiler`'s own part tagging) alongside
the existing per-instance overall box, which in turn exposed a fourth: a
door's cached collision stayed frozen at "closed" after swinging open,
fixed with a new `refreshFootprint()` that recomputes collision without
persisting the transient open/closed state. The phase closed with three
default interior blueprints (Simple Shed, Sunlit Room, Two-Room Cottage),
seeded by `BlueprintStore`'s own constructor so every session sees them
— "so the player can see that, by default, good things can be made with
the default building blocks." Verifying them surfaced one more honest
finding, genuinely fixed rather than routed around: the Construction
Library's `window` piece couldn't seal a boundary for enclosure
detection, by its own design (an open, unglazed opening, sill and header
each independently too short/too high to count as wall-like). Two new
pieces, `windowPane`/`largeWindowPane`, fix it the same way `door` fixes
`doorway` — a thin box sized to satisfy the existing wall-like check on
its own, which also gives a window real collision for the first time.
Sunlit Room uses a real, sealed window; every exterior opening across all
three blueprints pairs a frame with whatever closes it. See
`docs/ROADMAP.md`'s own Phase 5 account for the complete story.

**Version 3, Phase 6 — The Workshop Remembers (v3.0.6)** — extending
continuity beyond persistence into memory, without becoming a
notification system. Investigation found most of the brief already
built: Version 2's own `WorldEventLog`/`WorldAwareness`/
`ResidentPreferences`/`PlayerPatternMemory`/`ConversationMemory`/
`ResidentCuriosity` already fold real world events into Bubble's own
conversation context — "Bubble mentioning the storm that happened while
they were away," the brief's own headline example, already worked. Of
three real remaining gaps, a player-facing "time away" surface was
dropped as unnecessary (the wall clock, computer, phone, and sky
outside already tell time naturally); the other two shipped. Workbench
presence now quietly ages — a project's own already-real `updatedAt`
drives a subtle material desaturation once it's sat untouched past two
weeks, cloned per-mesh so the shared material cache stays untouched, and
recomputed fresh on every rebuild rather than stored as a flag. And
Bubble's own conversation panel — a real, still-outstanding Version 2
carry-over, confirmed rather than assumed — no longer buries Bubble
behind a full-screen backdrop: a new, sixth overlay material,
`companion`, docks a small frosted-glass card in the corner instead,
leaving the room, and Bubble, exactly as visible as before the
conversation opened. See `docs/ROADMAP.md`'s own Phase 6 account for the
complete story.

**Version 3, Phase 6b — Being Placement, Actually Visible (v3.0.6b)** —
a real user-reported bug, found and fixed while beginning Phase 7's own
investigation. Reproducing it directly (not assuming) found two
independent causes: the placement ghost's own floor raycast had no
fallback for an ordinary horizontal look ray, snapping to the world
origin and then freezing there — fixed by reusing `BuildModeSystem`'s
own already-proven `defaultGhostPoint()`, applied on every pointer move
rather than just on entry, since this system's single floor-only raycast
fails far more often than Build Mode's own broad one. And a malformed
body part crashed `BodyCompiler.compileBody()` outright, leaving an
already-recorded, already-placed Being with zero rendered geometry and
no retry — fixed by defending `position`/`rotation`/`scale`
independently, falling back to the Being Creator's own defaults rather
than crashing the whole compile. A real, unrelated doc drift was also
corrected in the same pass: `docs/BEINGS.md` still described
`BeingSpawnerApp.js`/`BeingManagerApp.js` as computer apps several phases
after both were consolidated into the Phone's `BeingsPhoneApp.js`. See
`docs/ROADMAP.md`'s own Phase 6b account for the complete story.

**Version 3, Phase 7 — Sharing the Workshop (v3.0.7)** — "let creations
travel," the maximum community value achievable with zero backend.
Investigation confirmed the pattern already existed
(`ResidentProfileStore`/`ExpressionSetStore`'s own envelope shape,
`StorageUtils.downloadJSON()`/`uploadJSON()`) and found exactly three
real gaps: Blueprints, custom Calculators, and Atmosphere Profiles had
no export/import at all. All three gained it, each wired into its own
native panel (the Builder Phone's Blueprints tab, the Tools panel's
Calculator Builder, Settings' Atmosphere Profiles section), plus a new
unified path: `AssetService.registerKind()` gained a fifth optional
`exportItem` callback, and `canExport()`/`exportAsset()` make any
registered kind's Export button reachable straight from that asset's own
Browser page. Two things surfaced along the way, both genuine
pre-existing gaps rather than anything this phase introduced: Atmosphere
Profiles, Calculators, and AI Resident Profiles had never been
registered as `AssetService` kinds at all, so all three became full new
kinds (not a narrower export-only mode) as part of this work; and only
four kinds had a real Browser detail page, so the four newly-exportable
ones would have been exportable in principle but unreachable in
practice — resolved with one shared `genericAssetDetailPage()` rather
than four bespoke ones. Verified live end-to-end for all six exportable
kinds — store-level round-trips (including malformed-input rejection),
`AssetService`'s own `canExport`/`exportAsset`, every one of the eight
now-reachable detail pages resolving with a working Export button, and
the Builder Phone/Tools panel UI mounted and driven directly against
real data. See `docs/ROADMAP.md`'s own Phase 7 account for the complete
story.

**Version 3, Phase 8a — Bubble Gains Hands, Conversation Surface
(v3.0.8a)** — the first of Phase 8's two milestones, five small pieces
of friction closed in Bubble's own conversation overlay: a long message
now caps at four visible lines with its own scrollbar; a reply reveals
word-by-word, purely client-side (Ollama is never asked to stream — the
whole stack turned out to have no streaming support to build on, so this
fakes the same effect on an already-complete response rather than adding
real streaming risk); a failed send gets a genuine Retry button instead
of a fake apology bubble; Up/Down in the input cycles through the
session's own sent messages; and a small toggle surfaces Ollama's own
token-usage counts for the last turn, previously read and silently
discarded, worded honestly as "last turn only" rather than a running
total Ollama doesn't actually provide. `ResidentConnection.sendMessage()`
now returns `{content, promptEvalCount, evalCount}` instead of a bare
string — its one other caller, Mission Control's own Resident Sandbox,
was updated to match. Verified live by mounting the real conversation
overlay against a detached container with a scriptable fake connection
(no Ollama server in this environment), including a genuinely failing
send, a successful Retry with no duplicate message, and disposing the
overlay mid-reveal to confirm the reveal stops cleanly rather than
throwing. Phase 8's second, larger milestone — granting residents
sandboxed Workshop Functions from Mission Control — is deliberately
separate, not yet started. See `docs/ROADMAP.md`'s own Phase 8a account
for the complete story.

**Version 3, Phase 8b — Bubble Gains Hands, Workshop Functions
(v3.0.8b)** — the second, larger half: nine Workshop Functions (move,
read player/nearby-object/nearby-Being coordinates, weather, time,
lights, music, name-resolved placement) dispatched through a fixed,
Workshop-owned table (`WorkshopFunctions.js`) a resident only ever calls
by name and arguments, never code — real Ollama tool-calling added to
`ResidentConnection.sendMessage()`, granted per-profile from a new
Mission Control section, all-granted-by-default with no special-cased
"Bubble" anywhere in the store, exactly matching "give the same
functionality to any resident, but Bubble gets them all by default,
stay toggleable" as asked. `WorldAwareness`'s own knowledge snapshot —
built in Phase 6, never actually read into a conversation until now —
is wired into the system prompt as a short grounding line, deliberately
kept separate from function-calling: knowledge is what a resident
*knows*, a function is what it *does*. A real bug was caught only by
driving actual per-frame movement rather than trusting the first
frame's state: the `moveTo` arrival check compared full 3D distance
against a resident's movement that only ever moves horizontally, which
could leave "goto" mode stuck forever whenever a target's Y didn't
match the resident's own resting height — fixed at the root (horizontal
distance only, `y` dropped from the function's own schema entirely). A
scope decision was also caught and reversed mid-implementation: wiring
the dispatcher into the Resident Sandbox for symmetry would have quietly
broken that surface's own documented "nothing here has real side
effects" promise, so the Sandbox keeps read-only knowledge grounding
only, no function execution. Verified live and extensively — every
function tested directly against real Workshop systems, the profile
field's nested-merge/export/import, the Mission Control toggle UI, the
conversation overlay's transparency line, and the tool-calling loop's
own protocol (including its round cap) via a scripted fake connection —
and, finally, against the user's own real, locally running Ollama
server with `ornith:9b`: asked in plain conversation to turn the lights
on, the resident genuinely chose to call the real `setLights` function
and the Workshop's own lights turned on for real. See `docs/ROADMAP.md`'s
own Phase 8b account for the complete story.

**Version 3, Phase 9 — Creative Flow (v3.0.9)** — "refine the entire
creative workflow... not about adding new tools... making existing tools
disappear into the creative process." Investigation split into a
precise root-cause pass on the brief's own flagged reselection bug and a
broader survey of Browser, Notebook, Pin Board, Phone navigation, and
the Builder Library — Phone and Browser navigation both came back
already consistent, worth saying plainly rather than fixing what wasn't
broken. Four real, on-brief fixes: an imported model placed as a World
Object couldn't be individually reselected — `_resolveWorldObjectDefinition()`
was missing the `"importedModel"` branch the already-correct
`_resolveDefinition()` had, silently bouncing the selection back to the
library screen — fixed by delegating to the correct resolver instead of
maintaining a second, incomplete copy, closing the last real gap in
Phase 1's own "imported objects should behave as first-class objects"
promise. The Pin Board no longer shows finished projects forever,
duplicating the Archive; a `done` project now simply leaves the board.
The Builder Phone's Saved Objects/Models/Blueprints tabs gained a live
search filter, extending the same "catalog outgrew a flat grid"
treatment Construction already had, using the exact "re-render only the
results, never the input" pattern the Browser's own Unified Search page
established so typing never drops focus. And the Wardrobe overlay's own
"reads like an early prototype" roughness turned out not to be simply
"too wide" — live measurement caught a genuinely broken layout (a stray
`flex: 1` silently overriding the declared width entirely, plus a
missing `flex-direction: column` laying the heading beside the content
instead of above it), both fixed at the root rather than papered over
with a smaller width number. See `docs/ROADMAP.md`'s own Phase 9 account
for the complete story.

**Version 3, Phase 10 — Real Assets, Honestly Introduced (v3.1.0)** —
six of seven milestones, all procedural, zero binary assets, scoped
directly by the user's own conservative guidance ("only if the Workshop
would genuinely benefit... only basic things at most"). A real
`hingeOffset` on `DoorBehaviour.js` closes a gap its own comment had
named since Phase 5 (and Phase 14's brief named again, independently) —
doors now pivot at a true edge instead of spinning around their own
centre, with the zero-offset default reproducing the old behaviour
bit-for-bit. Four hand-authored default emotes (Wave, Clap, Bow, Dance)
give the Emote Wheel real content for the first time on a fresh
Workshop. Six default outfits give the Wardrobe the same — including a
Pride Jumpsuit, blocking the trans flag's three colours across the
body — seeded with a deliberate exception to the usual "reseed when
empty" rule, since the Settings Danger Zone already promises deleting
every outfit is permanent. Three default Beings (Person, fully rigged
via `BodyCompiler.mirrorSubtree()`; Cat and Dog, honestly unrigged,
since the shared joint vocabulary has no vocabulary for a quadruped)
give the Being Library the same starter-content treatment
`DefaultBlueprints.js` already established, verified by actually
spawning all three through the real `BeingController` for two real
simulated seconds of movement and animation. A new, deliberately
neutral `terrainDetailTexture()` gives the ground real fine-grain detail
for the first time — multiplied under all seven paint materials at
once via `MeshStandardMaterial`'s own `map`×`vertexColors` behaviour,
still no shader work, still not true per-material splat texturing.
Nineteen first-party Phone/Computer apps traded a plain emoji `glyph`
for a real, hand-drawn `ProceduralIcons.js` mark — the Plugin SDK's own
"`glyph` is any character" contract stays fully intact, confirmed live
against the actual shipped example plugin correctly falling back to its
own emoji. Milestone 7 (real recorded audio) was deliberately not
started — `AudioSynth.js` stays 100% synthetic, pending an actual case
that clears the user's own stated bar. See `docs/ROADMAP.md`'s own
Phase 10 account for the complete story.

**Version 3, Phase 10b — Being Creator, Beyond the Prototype, Wave 1
(v3.1.0b)** — the user named the Being Creator directly as still
feeling like a prototype after Phase 10 shipped; investigation (a full
read of `BeingCreatorApp.js`, `BodyCompiler.js`, `PreviewRenderer.js`)
found real, specific causes and a genuine, previously-undetected bug: a
body part used to be one `THREE.Mesh` doing double duty as both "the
joint" and "the visible box," with every child part parented to that
same mesh — and a `THREE.Object3D`'s own `scale` applies to its
children's coordinates too, not just its own geometry, so a child's
authored position was silently multiplied by whatever scale its parent
happened to have. Confirmed live before any fix: the default Person's
own head sat 0.38m above the torso, not the intended 0.53m; the
shoulders sat at ±0.166m, not ±0.32m. Fixed with a real pivot/mesh
split — a `THREE.Group` pivot (unaffected by scale, exactly like
`PlayerCharacter.js`'s own rig) carrying one mesh, offset by a new,
optional `meshOffset` field defaulting to `[0, 0, 0]` — every part
saved before this phase renders exactly where it always sat, just now
correctly unscaled by its parent, a genuine visual correction rather
than an invisible re-architecture (the default Person, unedited since
Phase 10, now renders at its originally-intended proportions for the
first time). A one-click "Hang Below Pivot" button in the editor
automates the exact segment-midpoint arithmetic authoring a clean rig
used to require by hand. Verified at every level: the bug and its fix
both measured against real compiled world-positions (not just code
inspection), all three default Beings recompiling with zero errors and
zero NaN, a full `BeingController` spawn → animate → despawn cycle
re-run end to end, and the real Being Creator UI itself mounted and
driven directly — loading the real Person definition, selecting a part,
and confirming "Hang Below Pivot" computes and applies the right value.
Two more waves (authoring UX; non-biped rigging) remain, planned but not
yet started. See `docs/ROADMAP.md`'s own Phase 10b account for the
complete story.

**Version 3, Phase 10c — Being Creator, Beyond the Prototype, Wave 2
(v3.1.0c)** — the second of three planned waves, covering every
remaining authoring-UX gap the original investigation named.
`PreviewRenderer.js` (the shared mini-scene Builder, Wardrobe, and the
Animation Editor all already reuse) gained an opt-in
`setOnObjectClick()` raycast, click a part in the 3D preview to select
it, distinguished from an orbit drag by total pointer movement; a "Show
Joint Markers" checkbox drops a small marker at every part's own pivot,
parented directly to it so it needs no coordinate math and is never
mistaken for a real, selectable part; every vector slider gained a
synced, real number input for exact values; the hierarchy list gained
collapse toggles and true HTML5 drag-and-drop re-parenting, protected
by the same cycle guard the existing "Parent" dropdown already used;
and every part can now choose one of six materials
(matte/fabric/metal/plastic/glass/emissive) instead of only ever being
matte, drawn from `PlaceholderFactory.Materials`' own already-shared
palette. Verified at real interaction level throughout: genuine
`PointerEvent`s dispatched at real canvas coordinates (confirming a
correct hit, an empty-space miss, and that a drag past the movement
threshold fires neither), genuine `DragEvent`s exercising both a valid
re-parent and a rejected cycle, a material change traced from the
dropdown all the way to the compiled mesh's own real
`roughness`/`metalness`/`map`, and a full `BeingController` spawn →
animate → despawn cycle re-run to confirm no regression. Wave 3
(non-biped rigging) remains, planned but not yet started. See
`docs/ROADMAP.md`'s own Phase 10c account for the complete story.

**Version 3, Phase 10d — Being Creator, Beyond the Prototype, Wave 3
(v3.1.0d)** — the third and final wave, closing the gap Phase 10 itself
named honestly: the shared Workshop skeleton only spoke a biped's own
vocabulary, so the default Cat and Dog shipped as static, unrigged
geometry. Five new joints (`legFrontLeft`/`Right`, `legBackLeft`/`Right`,
`tailBase`) join the original fourteen in the same shared
`WorkshopSkeleton.WORKSHOP_JOINTS` vocabulary, one leg segment each
rather than split into upper/lower the way the biped pair is. A real
correctness bug was caught and fixed *before* it could ship:
`IDENTITY_PLAYER_SKELETON_MAP` and `isSkeletonMapUsable()` both used to
derive straight from the vocabulary's own total size, which would have
silently raised the "is this imported model's skeleton usable" bar for
every ordinary biped import too, purely because the vocabulary grew —
fixed by computing both from an explicit set of the new, biped-unrelated
joint ids instead, confirmed live both by direct reasoning beforehand
and a synthetic 7-vs-6-joint check afterward landing exactly on the
unchanged threshold. The default Cat and Dog are now genuinely rigged —
body, head, all four legs, and the tail — driven by two new clips
(`default-quadruped-idle`, a gentle sway with a tail flick; `-walk`, a
real diagonal trot, front-left and back-right swinging together then
the opposite pair), both `category: "movement"` so they stay out of the
player's own Emote Wheel exactly like every other idle/walk clip
already does. Verified by driving the walk clip through the real
`ClipPlayer`/`applyPoseToMappedSkeleton()` path directly (confirming the
diagonal-pair motion at every sampled tick, not just that clip ids were
assigned) and a full three-Being `BeingController` spawn → animate →
despawn cycle. This closes all three planned waves of the Being
Creator's "beyond the prototype" work (v3.1.0b → v3.1.0d). See
`docs/ROADMAP.md`'s own Phase 10d account for the complete story.

**Version 3, Phase 11 — Workshop Character (v3.1.1)** — five small,
real touches strengthening the Workshop's identity as a place rather
than adding a feature, plus one literal request. Bubble's conversation
context now reflects real elapsed-time continuity (`WorldTimeService`'s
already-computed `isFirstSession`/`cappedElapsedSeconds`, read for the
first time into a new `buildContinuityLine()`, catching and fixing a
real bucket-mislabeling bug along the way). `ConversationMemory`'s
"Session Only"/"Persistent" modes, previously identical because the
store was never registered with `PersistenceSystem` at all, now
genuinely differ — verified live with a note that survived a reload
under "Persistent" and vanished under "Session Only." `EnvironmentSystem`'s
weather catch-up moved off its own independently-computed `Date.now()`
reading and onto the same shared `"world:continuity"` event every other
continuity-aware system already uses, with a first-ever session now
getting a deliberate calm "clear" opening. Browser Home's Residents
tile now surfaces `ResidentState.mood` alongside the existing
"Continuing: [project]" line. And a small pot plant now sits in the
bookshelf's own structurally-guaranteed-empty corridor — a genuine
rotated-mesh bounding-box overlap (a leaf clipping the shelf frame by
about 2mm) was caught and fixed via a real `Box3` check against the
generated mesh, not trusted from hand arithmetic. See
`docs/ROADMAP.md`'s own Phase 11 account for the complete story.

**Version 3, Phase 12a — Accessibility & Comfort Pass, Wave 1 (v3.1.2a)**
— the three concrete, playtesting-found gaps, ahead of the broader
systematic pass. Zoom and the compass toggle each gained a real
click/tap-equivalent (a held touch button matching `isHeld("zoom")`'s
own semantics; a corner-controls button matching "I'm Lost!"). The
Esc/close button, previously `opacity: 0.7` with no real background of
its own, now uses the same glass/wood-chip treatment already proven
elsewhere — and a new shared `createCloseButton()` helper closed a real
accessibility gap along the way (the Phone's own close button had a
`title` but no `aria-label`, unlike the overlay one). The personal music
library gained a genuine Firefox/Safari fallback: `MemoryDirectoryHandle.js`
adapts an ordinary file-picker's `FileList` into an object
`LibraryScanner.js` genuinely cannot tell apart from a real
`FileSystemDirectoryHandle` — verified with real scanning, real
blob-URL playback, and a favourite surviving both a simulated reload and
a re-selected folder reusing the same root id. See `docs/ROADMAP.md`'s
own Phase 12a account for the complete story.

**Version 3, Phase 12b — Accessibility & Comfort Pass, Wave 2 (v3.1.2b)**
— the shared mechanisms Wave 1 deferred. Every modal-ish 2D surface
(`OverlayManager` panels, the Phone, `WorkstationPanel`) now shares one
real focus-trap primitive (`src/ui/focusTrap.js`) instead of three
independently-invented ones, restoring focus exactly where it was on
close. Investigating the two persistent-DOM surfaces surfaced a real,
standing bug in both: neither's own "closed" CSS state actually stopped
keyboard `Tab` from reaching their buttons — fixed with the native
`inert` attribute, also removing a dead `.hidden` class in `PhoneUI.js`
that matched zero CSS anywhere. Reduced motion now genuinely reaches
every eased transition, not just the CSS ones already wired to a
duration token: five JavaScript-driven camera/panel tweens
(`src/utils/motionPreference.js`'s `prefersReducedMotion()`) snap
straight to target when set, and two infinite CSS animations that
bypassed the duration tokens entirely — one found by this phase's own
broader sweep, not the original audit — got the same treatment. The
viewport meta's `user-scalable=no`/`maximum-scale=1.0` was silently
blocking native pinch-zoom and text-scaling everywhere, not just inside
the 3D scene (a real WCAG 1.4.4 violation); removed, since
`#workshop-canvas`'s own `touch-action: none` was already the real
protection for the 3D view. And every Computer app's form rows got a
label/`for`/`id` sweep via one shared id counter
(`src/utils/domIds.js`), with `BeingCreatorApp.js`'s six-control vector
rows getting `role="group"` treatment instead, the correct primitive for
a genuine one-to-many labeling relationship. Every milestone was
verified against real, running production code — mounted UI, real
`element.focus()` calls against `inert` surfaces, a temporarily-forced
`prefersReducedMotion()` to confirm both branches. See
`docs/ROADMAP.md`'s own Phase 12b account for the complete story; Wave 3
(the full ARIA-label sweep) remains.

**Version 3, Phase 12c — Accessibility & Comfort Pass, Wave 3 (v3.1.2c)**
— the phase's own final wave: the full ARIA-label sweep, at the depth
the user chose after two research agents audited every Phone app, the
whole Browser system, and every remaining Computer app in parallel.
Every icon-only button, unlabeled input, and untitled iframe found got a
real accessible name; every custom tab bar (the Browser's own tab strip,
the Tools panel's two) became a genuine `role="tablist"` with
Left/Right/Home/End keyboard navigation, sharing one small piece of
arrow-key arithmetic (`src/ui/tabList.js`) rather than two independent
implementations. Two more keyboard-trap bugs of the exact shape this
phase's earlier waves already found and fixed turned up independently —
`BrowserApp.js`'s per-tab close control and `toolsPanelView.js`'s
per-card pin toggle both had a `<span onclick>`/nested `<button>` living
*inside* another interactive element, reachable only by mouse; both now
pull the secondary control out to a real, independently-focusable
sibling button, and `createCloseButton()` gained an optional
`ariaLabel` override so a tab's close button reads "Close Workshop
Documentation" rather than an identical, ambiguous "Close" repeated once
per tab. Real, never-stale state now surfaces correctly where it exists
(the Wardrobe's active outfit, the Workshop app's weather buttons) and
deliberately doesn't get faked where it can't (Time-of-day's buttons,
since `hour` is a continuously easing clock with no discrete "current
selection" to honestly report). Object and Being part-colour swatches
became `role="img"` with a real text alternative; every duplicate button
name across every list ("Open", "Remove", "Edit") gained a per-row
`aria-label`. Verified live throughout by resolving real
`workshop://`/`asset://` URLs through the live `PageRegistry` and
mounting every touched Phone/Computer app via the same pattern Wave 2
established — which caught one real regression (a planned `aria-label`
line that had never actually been written) before it shipped. This
closes Phase 12 — see `docs/ROADMAP.md`'s own Phase 12c account for the
complete story, including what was deliberately left for a future pass
and why.

**Version 3, Phase 13a — The Phone Becomes a Device, Wave 1 (v3.1.3a)**
— four of five playtesting-found gaps between "the Phone works" and "the
Phone feels like carrying a device." The bottom bar's own home indicator
— previously a purely cosmetic pill — is a real `<button>` now, wired to
the same `onGoHome()` the header's own Home button already uses. A
12-hour/24-hour time format toggle (`SettingsStore.get("display")
.timeFormat`) is the same one preference every clock display now reads
— the PC Settings app, the Phone's own Settings app, and
`PhoneSystem`'s status bar — and caught a real, independent rounding bug
in `TimeFormat.js` along the way (a fractional hour just under the next
minute used to render as a literal `:60`). A new `SettingsStore.get
("phone")` category gives a player real wallpaper and border-colour
choice — four curated presets each, every one an existing design token,
not a colour picker — on both Settings surfaces at once, since real
device customisation happens on the device itself as often as from a
desktop. And app screens now arrive with a bit of real motion instead of
an instant swap, a pure CSS animation that needed no JavaScript beyond
what `PhoneUI.js` already does on every navigation. Verifying the last
two milestones surfaced a genuine, worth-documenting dev-tooling finding
along the way: what first looked like a real cross-browser CSS bug (a
`transition` that never seemed to complete) turned out to be this
project's own Browser pane never reporting its tab as visible, so
Chromium never ticks animation timelines for it at all — tracked down
rather than either shipped around unnecessarily or left as an
uncorrected false alarm; see `.claude/DEV_NOTES.md`'s own new account.
Wave 2 (v3.1.3b) — deep per-app visual distinctness, deliberately
isolated as its own larger, later wave — remains.

**Version 3, Phase 13b — The Phone Becomes a Device, Wave 2 (v3.1.3b)**
— the deferred fifth gap, "each app should read as distinctly itself
rather than sharing one visual template," closed across all seven Phone
apps. Bubble gets a real presence dot beside its heading and a
speech-bubble-shaped Talk button; Wardrobe becomes a card grid with each
outfit's own real colour swatch (fixing a placeholder the Phase 12
ARIA audit had already flagged); Workshop becomes an icon-forward
control panel (11 new marks in `ProceduralIcons.js`) and picked up a
real, standing accessibility fix along the way — `aria-pressed` was
already correct on every toggle button but nothing gave it a visible
state, so no sighted player could actually see which weather or
lighting option was selected; Beings' spawn list becomes a tap-to-place
roster grid while its richer "Placed Beings" management list stays a
list, on purpose; Browser gained real chrome — a favicon mark on every
link row, a pill-shaped address bar, and an actual toolbar (a new
`chevronLeft` icon) over an opened page; Emotes got the same
tap-to-trigger tile grid as Beings; and Settings — deliberately the
plainest app of the wave, since its content is values to adjust, not a
collection or a device — got only the same small identity mark next to
its heading every other app now carries. Every app was mounted and
exercised directly against real production data and real state
transitions, not just read from markup; a full seven-app cycle showed
zero console errors as the wave's own closing check. This completes
Phase 13.

**Version 3, Phase 14a — Further Environmental Polish, Wave 1 (v3.1.4a)**
— six small, isolated geometry/material/lighting fixes plus a fresh
re-check of the first-person head-shadow issue. The workbench fan's
base no longer sinks into the desk top; the computer chair's five
castors now turn with their own arm instead of four of five looking
progressively misaligned around the circle; the desk keyboard cleared
the mousepad; the wardrobe and music player's darker wood tones were
lightened; the north wall's siding texture now scales per wall segment
so the header/sill above/below the window match the full-height
segments beside them instead of showing a compressed slice of the same
pattern; and the two ceiling pendants reach further at night, joined by
a new exterior fixture at the front door. The head-shadow item turned
out to already be correct — Phase 3b's own fix is still fully intact —
and what looked like a live reproduction failure was this project's own
sandboxed dev browser auto-applying a "performance" graphics preset
(shadows off) because it reports exactly 4 CPU cores, the same threshold
`detectRecommendedPreset()` downgrades at. A real, if narrowly-scoped,
dev-tooling finding, documented in `.claude/DEV_NOTES.md` rather than
either shipping an unneeded fix or leaving a false regression belief
uncorrected. Every change verified against the real running scene graph.

**Version 3, Phase 14b — Further Environmental Polish, Wave 2 (v3.1.4b)**
— the door-hinge item, investigated and found to be three separate bugs
in three separate code paths rather than one. Builder Door and Gate
pieces now hinge at a real edge by default (`hingeOffset` existed since
Phase 10 M1, but nothing ever actually set it on any Construction
Library piece); the Workshop's own architectural front doors — which
already had genuinely independent per-leaf pivots, unrelated code
entirely — now hinge from the wall's true outer face instead of the
inner one, with the closed door's own visual position completely
unchanged (confirmed by reading the real scene graph: the mesh's world
Z landed at the exact same value before and after); and Double Door now
swings as one rigid panel from its own combined outer edge instead of
its centre seam — the honest, in-scope half of that fix, since genuinely
independent leaves would need new per-part-pivot architecture Phase
14's own risk note explicitly rules out taking on here.
`docs/WORLDBUILDER.md` updated to describe the new default alongside
that still-standing limitation.

**Version 3, Phase 14c — Further Environmental Polish, Wave 3 (v3.1.4c)**
— Bubble's own face and its chat surface, both real bugs. The shared
face plane's fixed z-offset was only ever tuned against the flat cube
face; on the curved orb body, the sphere's own surface sat in front of
it everywhere except a small centre dot, reading as "rarely showing
more than a dot or two" — pushed out to clear every shape's silhouette
completely. The same face plane's per-frame `lookAt()` was completely
undamped, invisible on the round orb but visibly "hunting" against the
cube's own hard edges — now eased with a quaternion slerp, confirmed by
watching it converge gradually across two frames rather than snap.
Separately, the conversation surface's own wrap/scroll roles were
backwards: individual message bubbles capped at four lines with a
nested scrollbar while the input stayed single-line — swapped, so a
long reply now displays in full and a long draft is what grows and caps
at four lines instead, verified by mounting the real production overlay
directly and exercising Enter, Shift+Enter, and the auto-resize by
hand. `docs/RESIDENT.md` updated in both places this touched.

**Version 3, Phase 14d — Further Environmental Polish, Wave 4 (v3.1.4d)**
— the two bigger design tasks. The Wardrobe app's own overlay panel was
correctly fixed to 560px back in Phase 9 (an accidental near-full-
viewport render, not the width itself, was the real bug then) — but
560px, the generic scale every simpler furniture overlay shares, was
never actually right for Wardrobe's own richer form. Widened to 880px
and given a real two-column grid for the compact sections (Body +
Alternate Models, Proportions + Appearance pair up; Paint and Outfits
keep the full row), scoped to this app alone so the Builder app's own
unrelated form usage is untouched — a genuine layout bug surfaced along
the way, where the bare, unwrapped part-tabs strip needed its own
explicit full-span rule rather than falling into the grid's default
auto-placement. Separately, the Emote Wheel became a genuine radial
layout — a single CSS custom property per button drives the standard
rotate/translate/counter-rotate compound transform, keeping every label
upright at any angle on the circle, verified by reading back each
button's own rendered position and confirming a real square-on-a-circle
arrangement, not by trying to watch the new hover animation (unreliable
in this project's own dev browser — see `.claude/DEV_NOTES.md`).
`docs/PLAYER.md` updated in both places this touched.

**Version 3, Phase 14e — Further Environmental Polish, Wave 5 (v3.1.4e)
— phase closeout.** The room's own furniture layout, investigated
rather than blindly rearranged: `layoutDefault.js` itself already
carries a detailed account of a real Version 2 interior-design pass
("reads top-to-bottom as one walk," every position checked against the
real footprint math), predating even the completed-Version-2 state the
Phase 14 brief was written from. Verified live against the real,
running `FurnitureSystem` rather than trusting that account alone —
every one of the 36 possible piece pairs checked for genuine footprint
overlap; found exactly two, both already intentional (the notebook
sits on the workbench on purpose; a wall-mounted pinboard's own
footprint grazes the workbench's by a negligible sliver at floor
level). The third stale-brief item this phase found, reported plainly
rather than forcing unverifiable speculative changes — this project's
own dev browser can't reliably render a screenshot to visually judge a
3D arrangement by. Separately, new outdoor detail: a bench by the front
door and a planter box under each window, purely decorative, reusing
Shelving.js's own pot-plant technique. This completes Phase 14 — all
five waves of "Further Environmental Polish" are done.

**Version 3 — One Contribution, Claude Sonnet 5 (v3.1.5).** Not a
briefed phase — see `docs/CONTRIBUTIONS.md`, a new standing document
logging one deliberate, judgment-driven addition per model that works
extensively on this codebase. The Journal app's `NotesStore`-backed
single textarea, overwritten on every keystroke, became a real dated
log (`JournalStore.js`): entries stay, a "New entry" button starts
today's, a rail of past entries reads back through what came before —
the one form of continuity every other time-aware system in this
Workshop already had (resident conversation memory, weather continuity,
`docs/HISTORY.md` itself) that the player's own reflections didn't. A
save migration (v3 → v4) carries forward whatever text a player had
already written rather than discarding it. `docs/HANDBOOK.md`'s own
"dust motes near a window" example was investigated first and confirmed
already real and default-on before looking further for an honest gap.

**Version 3 close-out (v3.1.6).** Before starting `docs/ROADMAP_V4.md`,
a full independent sweep of all 258 `src/` files — dead code, duplicate
implementations, docs-mined future work compared against what actually
shipped, and a judgment pass on the AI/host-companion/Plugin SDK systems
most likely to still feel unfinished. The audit itself is the headline
finding: zero orphaned files, zero `TODO`/`FIXME` markers, zero
commented-out code across the entire `src/` tree — this codebase's own
discipline held up under real, independent scrutiny. The debt that did
exist was fixed immediately rather than deferred into Version 4, judged
too small and too safe to leave sitting in newly-written closing
documentation: `escapeHtml()` (nine independent copies, two genuinely
different behaviours in the same file — one used the DOM's own
`innerHTML` serialization, verified live to *not* actually escape
quotes, a real latent bug in an attribute-value context), `clamp()`,
`debounce()`, and record-id generation were each consolidated into
`src/utils/` from anywhere between three and twelve reimplementations;
a genuine bug where the computer's own header clock and the window's
weather panel silently ignored the player's 12h/24h time-format setting
was traced and fixed (`WorkstationPanel.js`, `WindowOverlay.js`, both
now read `TimeFormat.formatClockTime()` like every other clock in the
Workshop already does); `BeingLibrary.exportDefinition()`'s own
pre-stringified return value — which a `main.js` comment had been
explicitly documenting as a workaround for since Phase 7 — was fixed at
the source, deleting the workaround entirely rather than adding a third
one; a small dead CSS block from an early AI-app mockup was removed; and
several stale doc claims caught in the act (`docs/TOOLS.md` still
describing a limitation Phase 7 had already closed; `docs/COMPUTER.md`
still calling `BrowserApp`/`AIApp` placeholders) were corrected. Every
fix verified live against the real running engine before and after, on a
fresh port per `.claude/DEV_NOTES.md`'s own standing guidance. See
"Reflecting, after Version 3" above for what the audit itself revealed
about trusting delegated research, and `docs/ROADMAP_V4.md` for where
this points next.

</details>
