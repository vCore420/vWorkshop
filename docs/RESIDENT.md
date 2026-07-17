# The First Resident

"This is not an AI assistant. It is the Workshop's first resident." A
small, semi-transparent, floating bubble that simply lives in the
Workshop — present before it's spoken to, still there when Ollama is
offline, gradually familiar rather than summoned. This document covers
how it's built; `docs/ARCHITECTURE.md` covers how it fits into the rest
of the Workshop, `docs/AI.md` covers Mission Control, the configuration
this resident consumes but never duplicates.

## Design philosophy, briefly

"If I walked into the Workshop late one evening, would it feel like
someone quietly lived here already?" Three decisions carry that:

1. **It exists before it's spoken to.** There's no spawn/despawn logic
   anywhere in `ResidentController.js` — the resident is created once,
   in `init()`, exactly like a piece of furniture, and simply exists for
   the rest of the session. Walking into the Workshop means walking into
   its shared home, not summoning a chatbot.
2. **It consumes Mission Control's configuration; it never duplicates
   it.** Identity, model, behaviour tuning all come from
   `ResidentProfileStore.getActive()`, read live, every time they're
   needed. `ResidentState.js` — the one thing this phase *does* persist
   about the resident itself — is deliberately narrow: idle location and
   mood, nothing that already has a home in Mission Control.
3. **Digital, not magical.** "The resident should feel digital rather
   than magical" ruled out sparkly fairy-dust aesthetics in favour of
   real refraction (`MeshPhysicalMaterial`'s own `transmission`), a
   glass-like inner glow, and restrained, geometric particle drift —
   see "Embodiment" below.

## Architecture: eight small, separated files — plus six more across two phases

`src/resident/`, following the same "separate responsibilities" instinct
`src/ai/` already established:

- **`ResidentEntity.js`** — creates the ordinary ECS `Entity` (a
  `MeshComponent` for the bubble's own root group, an
  `InteractableComponent` for "walk up to chat"), wired the *exact* same
  way `FurnitureSystem.js` wires an `overlayId`-based piece of furniture.
  The resident needed no new interaction mechanism at all, only a new
  interactable object using the one that already existed.
- **`ResidentMovement.js`** — idle-location definitions (hand-placed
  relative to `FURNITURE_LAYOUT`'s own real coordinates, not arbitrary
  points) and the two entirely separate kinds of motion: slow travel
  between them, and continuous procedural bob/rotate/squash-stretch.
- **`ResidentBehaviour.js`** — player awareness (a single smoothed
  0-1 `awarenessBlend`, not a combinatorial state machine), the one
  real mode distinction (idle vs. conversing), and — new this phase —
  the short-term "emotion" layer; see "Mood, Emotion, Personality" below.
- **`ResidentRenderer.js`** — the actual Three.js visual: the body (now
  one of five shapes, see "Resident Embodiments"), its inner glow, its
  small drawn face, its sparkle particles.
- **`ResidentConnection.js`** — a thin adapter over
  `AIConnectionManager`, translating its status into `isAwake` and
  carrying real conversation turns through Ollama's `/api/chat`.
- **`ResidentConversation.js`** — the chat overlay, opened the same way
  every other physical object's overlay opens.
- **`ResidentState.js`** — the resident's own small persisted runtime
  state (idle location, mood).
- **`ResidentController.js`** — the one engine system tying the rest
  together every frame, itself owning as little logic as possible.

This phase's own four additions follow the identical pattern — one small
file, one job, read by `ResidentController.js`/`ResidentConversation.js`
the same way everything above already is:

- **`ResidentTraits.js`** — pure functions turning a profile's selected
  personality traits (`src/ai/TraitConfiguration.js`'s own shape) into
  concrete movement/awareness/expression modifiers, plus (AI Intelligence
  phase) `mergeModifiers()`, the shared function combining traits with
  the new Behaviour Dials below into one final modifier object.
- **`ResidentDials.js`** *(AI Intelligence phase)* — the identical idea
  for the seven continuous Behaviour Dials (`src/ai/
  BehaviourDialsConfiguration.js`'s own shape) instead of discrete traits.
- **`ResidentContext.js`** *(AI Intelligence phase)* — the shared
  context-building logic (personality line, preference line, curiosity
  notes, remembered things) both the real conversation and Mission
  Control's own Resident Sandbox call identically; see "Mission Control
  Integration" below.
- **`ResidentPreferences.js`** — Bubble's own emergent, weighted
  preferences (places, weather, time of day, activities).
- **`PlayerPatternMemory.js`** — "behaviour memory": lightweight,
  persisted patterns about where and when the *player* tends to be
  found, not about anything said in conversation.
- **`ResidentCuriosity.js`** — composes short, honest observation notes
  (something new was built, notable weather, an accumulated preference)
  for conversation context, never a notification.
- **`ConversationMemory.js`** — a bounded list of *meaningful* things
  remembered about the player, distinct from the ordinary session-only
  message history `ResidentConversation.js` already kept.
- **`ResidentWorldSignals.js`** — small, shared weather/time-of-day
  readers, factored out once a third consumer needed the same two
  questions answered (see `EnvironmentSystem.getEffectivePrecipitation()`'s
  own precedent for exactly this reasoning).

"The future AI Resident should simply consume these configurations rather
than implementing its own copies" (from Mission Control's own
phase) is honoured completely: nowhere in `src/resident/` is there a
second `temperature` field, a second `model` field, a second identity —
every one of those is read from `ResidentProfileStore.getActive()` at the
moment it's needed.

## Embodiment: digital, not magical

"Semi-transparent bubble, soft internal glow, gentle sparkle effects,
subtle internal movement, slight refraction, soft ambient lighting, tiny
floating particles." Three layers, one root group, all in
`ResidentRenderer.js`:

- **The body itself** — `MeshPhysicalMaterial` with real `transmission`
  (genuine glass-like refraction, not a faked transparency trick) and a
  touch of `clearcoat` for a subtle sheen. Its *shape* is now genuinely
  configurable — see "Resident Embodiments" below — but the material
  properties stay identical across every shape, which is what keeps a
  cube-bodied or prism-bodied resident still unmistakably the same kind
  of thing as the original floating orb.
- **An inner glow** — a smaller, fully emissive sphere (always a sphere,
  regardless of outer shape — an inner light source reads the same way
  inside a cube as inside an orb), its colour genuinely shifting with the
  resident's current mood/expression (`MOOD_COLORS`), not just its face.
- **Sparkle particles** — ten small points drifting slowly within the
  bubble's own radius on independent, desynchronised phases, breathing in
  opacity on a slow cycle rather than a fixed blink — "occasional sparkle
  pulses."

There's also a small `PointLight` inside the body — "soft ambient
lighting" of its own, so the resident genuinely casts a little warmth
onto whatever it's near rather than only ever looking lit from outside
itself.

**The face is a small canvas texture**, redrawn only when the expression
actually changes (not every frame — needless work for something that
changes maybe once a minute), applied to a thin plane that rotates to
face wherever the resident is currently "looking." Every expression
(`sleeping`, `content`, `curious`, `happy`, `thinking`) is a handful of
simple curves and dots — "the expressions should remain subtle, avoid
exaggerated cartoon animation" — including "playful teeth" for `happy`,
a couple of small pale rectangles, not a full cartoon grin. This phase
also gave "thinking" a genuinely distinct read from "curious" — both used
to share almost the same asymmetric-raised-eye silhouette, easy to
mistake for one another at this texture size; "thinking" now lifts both
eyes evenly and draws a flat, settled mouth (turned inward), while
"curious" keeps its original asymmetric, outward-looking look.

## Presence philosophy

"The resident should exist inside the Workshop at all times. It should
never feel like it only exists when spoken to." Concretely: the resident
is created in `ResidentController.init()`, the exact same lifecycle point
furniture uses, and there is no code path anywhere that removes it from
the scene during a normal session. Whatever idle location it was last at
(`ResidentState.idleLocationId`, persisted) is exactly where it's found
again next time — "returning to the Workshop should feel like returning
to someone who has continued existing rather than somebody being
recreated."

## Movement

"Slow. Comfortable. Relaxed... most of the time the resident should
simply remain where it is." `ResidentMovement.js` keeps idle travel and
procedural motion strictly separate:

- **Idle travel** — a seven-second eased glide between two of the six
  named idle locations, chosen at random on a long, randomised interval
  (90-240 seconds between moves) — "movement should be infrequent, the
  Workshop should never feel busy."
- **Procedural idle motion** — a slow bob, a gentle sway, a slight
  rotation, all continuous sine waves at deliberately low frequencies —
  never stopping, so the resident never looks frozen even at its most
  stationary. A tiny squash/stretch pulse layers on top specifically
  while "thinking" (waiting on a response during conversation).

### Idle locations

Nine spots — the original six, each a real offset from
`FURNITURE_LAYOUT`'s own coordinates in `src/data/layoutDefault.js`
(beside the computer, above the workbench, near the bookshelf, by the
music player, beside the quiet corner, and looking out the window,
facing one of the two actual window openings `WorkshopRoom.js` cuts into
the wall), plus three more added once the World Builder made an outside
worth wandering to (by the front door, and two spots further out on the
Workshop grounds — see `docs/WORLD.md`).

### A quiet habit

Phase 31C's own one small contribution, chosen after living inside the
project rather than requested: Bubble is a little more likely to wander
to the window specifically while it's raining, or during a warm
sunrise/sunset sky, than to any other idle spot at that moment —
`ResidentController._windowWatchWeights()`, a plain weight nudge on the
exact same random pick that already existed, using signals
(`EnvironmentSystem.getEffectivePrecipitation()`, and the same golden-
hour window `TimeOfDaySystem._computeState()` already uses for the sun's
own colour shift) that were already true and already meaningful, not
invented for this. Nothing is scripted or guaranteed — it's still an
ordinary weighted pick among idle locations that already existed; a
patient, observant player might eventually notice it forms a pattern of
its own, which is exactly the point. See `docs/HISTORY.md`'s own "One
contribution" section for the fuller reasoning behind choosing this,
specifically, over everything else it could have been. (Version 2
Sign-Off phase — that cross-reference used to point at "the README's
own" section; the writing moved to `docs/HISTORY.md` at some point and
this line never followed it. Corrected as part of this phase's own
documentation audit.)

**Version 2 Sign-Off phase's own contribution, the same habit, one more
thread.** The wall clock (Decorative Details phase) and its hourly
chime (Sound & Presence phase) had existed for two entire phases
without `_windowWatchWeights()` ever hearing about either — an idle
location, `besideClock`, now sits beside the clock the same way
`lookingOutWindow` sits beside a window, and gets the same kind of
gentle pull within a few minutes either side of the hour turning over.
Never guaranteed, never synchronised on purpose — but on the occasions
it does land there, a resident already looking at the clock the moment
it chimes is entirely possible now, where it simply couldn't have
happened before. See `docs/HISTORY.md`'s own retrospective for the full
reasoning behind choosing this as Version 2's own closing signature.

## Player awareness

"Looking towards the player when nearby... watching the player walk
past... following the player with its eyes." Implemented as one smoothed
value, `ResidentBehaviour.awarenessBlend` (0 = looking at its own idle
target, 1 = looking directly at the player), eased toward 1 within a
3.2m radius and fully attentive within 1.6m, eased back toward 0 outside
it. Walking past at a distance makes it rise and fall on its own with no
separate "noticed you" state to manage — the resident's face simply turns
more toward whoever's nearby, continuously, the same way a person's
attention actually drifts toward someone walking past rather than
snapping to a fixed "aware"/"unaware" switch.

## Conversation

"Walking up to the resident should allow the player to begin chatting."
Opened through `InteractableComponent` exactly like any other physical
object's overlay — no new interaction mechanism. Opening it calls
`ResidentBehaviour.startConversation()` (forcing `awarenessBlend` to 1
and pausing idle travel — "the resident should stop moving, turn towards
the player, maintain attention throughout the conversation"); closing it,
by any means `OverlayManager` already supports, calls `endConversation()`
— "after the conversation naturally return to its previous behaviour"
needed no explicit "resume" logic, since idle travel was only ever paused,
never reset.

Every message goes through `ResidentConnection.sendMessage()`, which
calls Ollama's `/api/chat` with the active profile's own model,
temperature, context size, and maximum response length — "the resident
should never duplicate these settings, it simply consumes the current
Mission Control configuration," read fresh on every single message, not
cached at conversation start. The system prompt comes from the exact same
`PromptComposer.composeSystemPrompt()` Mission Control's own Advanced
section already uses.

Message history is session-only, kept in `ResidentConversation.js`'s own
closure — "conversation history (future memory system)" is explicitly a
later phase's concern (see `docs/AI.md`'s own "Memory Configuration"
section), not something to half-build ahead of a real memory system
existing to use it.

## Offline behaviour

"If Ollama is unavailable: the resident should remain inside the
Workshop. It should never disappear." `ResidentConnection.isAwake` mirrors
`AIConnectionManager.status` directly — when it's false,
`ResidentRenderer.setAwake(false)` softens the bubble's own opacity,
emissive intensity, inner glow, and light — "glow becomes softer" — and
`ResidentBehaviour.computeExpression()` overrides everything else to
`"sleeping"` regardless of mood — closed, gently curved eyes, no mouth at
all.

Interacting with a sleeping resident opens the conversation overlay as
normal, but shows one calm sentence explaining it's waiting for its
connection instead of a chat interface — "interaction simply explains
that it is waiting for its connection," not an error dialog. Mission
Control's own polling loop keeps trying in the background the entire
time; nothing about the resident adds a second reconnection attempt of
its own. The moment `AIConnectionManager.status` flips back to
`"connected"`, `ResidentController` calls `setAwake(true)` on its very
next frame — the glow brightens, the sparkle pulse resumes its normal
pace — "no intrusive notification is necessary," and there isn't one.

## Persistence

`ResidentState.js` is ordinary JSON through the normal `PersistenceSystem`
path — idle location, mood, and current position, nothing more. Identity,
model, behaviour tuning, memory, and embodiment settings are all
`ResidentProfileStore`'s own concern already (see `docs/AI.md`);
duplicating any of them here would be exactly the "implementing its own
copies" the brief explicitly warned against. Conversation history isn't
persisted at all this phase — see "Conversation" above.

**Position persists, including mid-travel** (added in Workshop Polish).
`currentPosition` is a plain field on `ResidentState`, mutated directly by
`ResidentController` every frame rather than through an event-emitting
setter — updating it that often would defeat `PersistenceSystem`'s own
debouncing entirely; the ordinary autosave/beforeunload cycle already
captures whatever it happens to be at save time. On load,
`ResidentMovement`'s constructor accepts this as an optional starting
position: if it doesn't already match the persisted `idleLocationId`'s own
fixed point (meaning the resident was mid-journey when the Workshop was
last saved), it begins a fresh travel from there toward that same
destination, resuming rather than snapping straight to where it was
headed or restarting from scratch.

**Facing direction, expression, and connection state** (added in Beings
Creator) are the same plain-field pattern, but honestly *snapshots only*
— written every frame, never read back to drive behaviour. The
resident's actual visual orientation is already recomputed fresh each
session from its idle location's own look-at target (itself restored via
`idleLocationId`) plus continuous procedural sway, and its expression and
connection state must always reflect the live mood and whatever
`AIConnectionManager.status` genuinely is right now — a stale persisted
"connected" from last session would be actively misleading rather than
merely out of date. They exist for continuity and any future
diagnostic/debug view that wants a "what was last known" read-out without
needing to query every live system separately.

## Personality Traits (long-term identity)

"Teach residents who they are... by the end of this phase, players
should naturally describe Bubble using personality traits rather than
features." `src/ai/TraitConfiguration.js` defines six: Curious, Calm,
Cheerful, Quiet, Thoughtful, Playful — a small, fixed, named set rather
than free text, chosen in Mission Control (up to
`MAX_SELECTED_TRAITS`, currently two) alongside — not instead of — the
existing free-text "Personality" field. The difference is deliberate:
`identity.personality` is prose for the system prompt ("warm, a little
dry"); `traits.selected` is a small enum other *systems*, not just the
model, can actually branch on.

`ResidentTraits.getTraitModifiers(traitsConfig)` is the one place a
selected trait becomes something concrete — a rest-duration multiplier, an
awareness-radius multiplier, a bias on certain idle locations, a bias on
certain expressions — averaged (multipliers) or combined (biases) across
however many traits are selected, always staying close to neutral (see
its own comment: "roughly ±25-35%"). `ResidentController._onProfileChanged()`
reads this once per profile change, not every frame, and hands the
results to `ResidentMovement.setRestDurationMultiplier()` and to its own
distance adjustment before calling `ResidentBehaviour.update()` — neither
of those two files knows a single trait name.

`traitPersonalityLine(traitsConfig)` (also in `ResidentTraits.js`) is the
one line this feeds back into conversation — "Your temperament leans
curious and playful," appended to the system prompt by
`ResidentConversation.js` — so the model's own responses lean the same
way its movement already does, without either copying the other's logic.

## Behaviour Dials (AI Intelligence phase)

"Curiosity, Talkativeness, Playfulness, Energy, Independence, Reflection,
Calmness... these should influence movement, conversations and general
behaviour. Please favour subtle changes over dramatic differences."
`src/ai/BehaviourDialsConfiguration.js` defines seven continuous 0-1
dials, each neutral at 0.5 — the continuous counterpart to the discrete
traits above, deliberately complementary rather than overlapping: traits
are "which flavour" (a small, named archetype), dials are "how strongly."
A resident can be "Curious" *and* lean high on the Energy dial, each
contributing its own share to the same final modifier.

`ResidentDials.getDialModifiers(dials)` only ever reacts to a dial's
*deviation* from neutral (`d = value - 0.5`) — every effect stays small
(roughly ±30-40% at the extremes, clamped), matching "subtle... not
dramatic" as a hard constraint rather than a suggestion:

- **Curiosity** biases toward the window and the `curious` expression.
- **Playfulness** biases toward `happy`/`curious` and slightly shorter
  rests.
- **Reflection** biases toward `thinking` and the bookshelf, and lingers
  a little longer wherever it is.
- **Energy** and **Calmness** both feed rest duration (in the same
  direction — high energy and low calmness both shorten it) and,
  new fields this phase, `movementSpeedMultiplier` (Energy — a genuinely
  faster or slower travel pace, read by `ResidentMovement.js`'s own idle
  travel easing and `stepToward()`) and `motionDamping` (Calmness — how
  much the idle bob/sway/rotation amplitude settles down, distinct from
  Idle Behaviour's own discrete "Still and Attentive" damping; the two
  multiply together rather than either overriding the other).
- **Independence** reduces how insistently a favourite location pulls
  (`favouriteLocationPullMultiplier`, read by `ResidentController.
  _windowWatchWeights()`) and narrows the effective awareness radius —
  self-possessed, not aloof.
- **Talkativeness** widens the effective awareness radius slightly (a
  talkative resident notices someone nearby a little sooner) and
  contributes a short conversational-style line when it leans far enough
  from neutral to be worth saying ("You tend to be talkative, offering
  fuller answers rather than short ones.").

`ResidentContext.getPersonalityModifiers(profile)` is where a profile's
traits and dials actually combine — `ResidentTraits.mergeModifiers()`
averages every multiplier across both sources and multiplies weight/bias
objects together, so `ResidentController.js` never needs to know which
source produced which number. The same function's own `conversationStyleLine`
concatenates whatever style hints traits and dials each had to say,
appended to the system prompt alongside the traits' own personality line.

## Mood, Emotion, and Personality — three timescales

"Please distinguish between emotion, mood, and personality... these
should represent different timescales." Three separate places, on
purpose, rather than one field trying to mean all three:

- **Personality** (long-term, essentially fixed for as long as a profile
  stays configured that way) is the selected traits above — nothing here
  changes on its own.
- **Mood** (medium-term) is `ResidentState.mood` — persisted, and now
  genuinely alive: `ResidentController._maybeDriftMood()` reconsiders it
  every two-to-five minutes (`MOOD_DRIFT_MIN_SECONDS`/`MAX_SECONDS`), a
  weighted pick among `content`/`curious`/`happy` biased by the resident's
  own selected traits, by whether its accumulated favourite weather or
  time of day happens to be true right now, and — heavily — by whatever
  mood it already is, so it settles rather than flickers between
  reconsiderations. This is deliberately not a per-message mood computed
  from conversation sentiment or anything similarly elaborate — "subtle
  behaviour changes are preferable to obvious state changes."
- **Emotion** (short-term) is `ResidentBehaviour.emotion` — never
  persisted, set by `triggerEmotion(expression, seconds)` and decaying
  back to nothing on its own. The one place this is actually called is
  `ResidentConversation.js`, right as a conversation opens: a brief
  `"curious"` blip if `ResidentCuriosity` has something to say, a brief
  `"happy"` one otherwise — "small changes should carry meaning," not a
  new permanent state.

`ResidentBehaviour.computeExpression()`'s own priority order is exactly
"short-term overrides medium-term overrides long-term default":
`sleeping` (offline) > `thinking` (mid-reply) > `emotion` (if one's
currently active) > `mood` > `"content"`.

## Preferences

"Residents should begin forming preferences... favourite places,
weather, times of day, music, activities... weighted choices are
preferred [over rigid rules]." `ResidentPreferences.js` holds four plain
`{key: count}` bags (`locations`, `weather`, `timeOfDay`, `activities`),
bumped a little at a time as Bubble actually goes about its ordinary idle
life — arriving somewhere (`ResidentController.update()`, right where it
already calls `ResidentState.setIdleLocation()`), and on a slow shared
timer (`_maybeSamplePatterns()`, every `PATTERN_SAMPLE_INTERVAL` seconds)
that also notices the current weather, time of day, and whether music is
playing nearby (`MusicSystem.isPlaying`) or the window's currently worth
watching.

`favourite(dimension)` (via the shared `AffinityTracker.leadingAffinity()`
— see "A quiet familiarity, shared" below) only ever returns something
once there's genuinely enough behind it — a preference that reported
itself after one lucky sample would contradict "quiet familiarity rather
than prediction" outright. A brand-new resident also gets a small,
one-time seed toward one weather state matching its own selected traits
(`seedFromTraits()`, called once via `world:continuity`'s own
`isFirstSession`) — "a natural starting point," the same spirit
`EmbodimentConfiguration.js`'s default teal colour already carries, not a
rule that overrides what actually happens afterward.

Favourites feed back into the same `_windowWatchWeights()` idle-location
weighting traits already use (a favourite place gets a real, if modest,
boost) and into `_maybeDriftMood()` (enjoying a favourite weather or time
of day right now nudges mood toward `happy`) — "Daily Habits" (watching
the sunrise, watching rain, floating near the record player while music
plays, returning to favourite spots) is the *visible result* of this
system, not a separate routine that had to be built on top of it.

**Living World phase: a fifth bag, `relationships`.** "Residents should
become aware of one another... who they spend time near." With a single
AI resident, "one another" today means Bubble and the Workshop's own
Beings — keyed by Being instance id, bumped by the same
`_maybeSamplePatterns()` timer whenever Bubble genuinely idles within a
few metres of one (`BEING_AWARENESS_RADIUS` in `ResidentController.js`).
"Relationships should remain lightweight during this phase but provide a
strong architectural foundation for future development" is true by
construction — this is the identical `bump()`/`favourite()` mechanism
every other dimension already uses, so a second AI resident later needs
no new relationship system of its own, only its own instance of this
same class.

## Behaviour Memory

"Residents should begin remembering behavioural patterns rather than
only conversations... the player often builds near the workbench...
usually visits in the evening... frequently sits in the Quiet Corner...
the goal is quiet familiarity rather than prediction." This is
specifically about the *player*, not Bubble — `PlayerPatternMemory.js`,
a sibling of `ResidentPreferences.js` in shape (the same two-bag,
`leadingAffinity()`-gated pattern), sampled by the same slow timer.

Four named zones (`workbench`, `computerDesk`, `quietCorner`,
`musicCabinet`), positioned from `FURNITURE_LAYOUT`'s own real
coordinates the same way `ResidentMovement.IDLE_LOCATIONS` already are,
plus a coarse four-way time-of-day bucket
(`ResidentWorldSignals.currentTimeBucket()`). `leadingZone()`/
`leadingTimeBucket()` surface as conversation context via
`ResidentCuriosity.js` — "you've noticed the player often spends time
near the workbench" — never as a stat screen or a notification anywhere
in the room.

This store persists across every session a resident lives through
(unlike `ResidentPreferences`, which shares that same persistence but
with a lower sample-count bar — see `MIN_SAMPLES` in each file's own
comment for the reasoning), which is the whole point: a pattern about a
*player's* habits is meant to accumulate over the life of the Workshop,
not reset every time it's reopened.

**Living World phase: "usual working hours."** A third bag,
`workingHourCounts` — distinct from `timeOfDayCounts` above (which bumps
whenever the player is sampled, wherever they happen to be) in that this
one only bumps when the player is *also* in a working zone (the
workbench or the computer desk) at that same moment. "The player usually
visits in the evening" and "the player usually works in the evening" can
now genuinely differ — `leadingWorkingHours()` answers the second
question specifically.

### A quiet familiarity, shared

`src/utils/AffinityTracker.js` is the one small utility both
`ResidentPreferences.js` and `PlayerPatternMemory.js` are built on —
`bumpAffinity()` and `leadingAffinity()`, two functions, nothing more.
Giving Bubble's own preferences and the player's own patterns clearly
separate stores (they're about different subjects, and persist on
different schedules) while sharing the *arithmetic* between them is the
same "small, real, shared primitive" instinct
`ResidentMovement.randomIdleLocationId()`'s own optional `weights`
argument already established for Phase 31C's quiet habit.

## Curiosity

"Bubble should occasionally notice the Workshop around it... new Builder
creations, objects moved since yesterday, interesting weather, favourite
places, changes made by the player... these observations should occur
naturally within conversation rather than becoming notifications."
`ResidentCuriosity.gatherNotes()` is called exactly once, right as
`ResidentConversation.js`'s own overlay opens — never mid-conversation,
never as a standalone check — and returns a short list of plain
sentences: whether something new has been built in the Workshop since the
last conversation (a plain count comparison against `WorldObjectsStore`,
not a diff of *which* objects — "the player built something new" is
plenty, itemising each one would read as a changelog, not a housemate
noticing something), whether the current weather or time of day is worth
mentioning, an accumulated favourite place, and whatever
`PlayerPatternMemory` currently leads with.

These notes are handed to `PromptComposer.composeSystemPrompt()`'s own
`context.curiosityNotes` — context for the model, never displayed
directly and never guaranteed to actually come up. The one thing this
class persists (`lastSeenObjectCount`) exists purely so the same "new
object" note doesn't repeat forever once it's been mentioned once.

## Conversation Memory

"Continue improving conversation memory. Please focus on remembering
meaningful things rather than everything... avoid remembering
insignificant small talk indefinitely." `ResidentConversation.js`'s own
`history` array (see "Conversation" above) already keeps the full,
ordinary back-and-forth for as long as one conversation stays open — that
hasn't changed. `ConversationMemory.js` is a deliberately different,
much smaller thing sitting alongside it: a bounded list (`MAX_NOTES`,
currently 16) of short notes, each reinforced rather than duplicated if
it comes up again, oldest evicted once full.

`extractFromMessage()` runs after every user message (only when the
active profile's `memory.mode !== "disabled"` — see "Mission Control
Integration" below) and is three cheap, independent checks, each gated by
its own category toggle (AI Intelligence phase — see below): does the
message name a real project (scanned against `ProjectsStore.all()`), does
it read as a stated preference ("I love...", "my favourite X is..."), does
it read as a stated goal ("I want to...", "I'm going to..."). No second
model call, no summarisation — "this does not require advanced AI. Simple
continuity is sufficient" (`docs/PERSISTENCE.md`'s own standard for
Bubble's movement) applies just as well here.

**Categories** (AI Intelligence phase) — "allow the player to configure
what Bubble remembers." `MemoryConfiguration.MEMORY_CATEGORIES` defines
seven; `extractFromMessage()`/`watchProjects()` both check `categories`
(the active profile's own `memory.categories`) before populating anything
of a given kind at all — turning off "Player Preferences" means the
preference regex above simply never runs, not that its results are hidden
after the fact. "Conversations" is the one parent switch: it gates
whether ordinary message text is scanned at all, with Projects/
Preferences/Goals individually toggled underneath it. "Favourite
Places"/"Favourite Activities" don't gate anything in this file at all —
they gate `ResidentContext.js`'s own live `preferenceLine` instead (see
its own comment), since those are sourced from `ResidentPreferences`
rather than message text.

**Lifetimes** (AI Intelligence phase) — "configurable memory lifetimes...
temporary, medium-term, permanent." Every note is stamped with the
lifetime tier its own category defaults to (`MemoryConfiguration.
CATEGORY_LIFETIMES`) — Projects/Goals/Workshop-History default to
Permanent, Preferences to Medium-Term — and `_purgeExpired()` (called
from both `extractFromMessage()` and `mostRelevant()`) removes anything
whose tier has a real `ttlMs` and hasn't been reinforced within it. This
is a genuine, working mechanic, not just a label: "remember meaningful
experiences without becoming overwhelmed by insignificant details" is
this purge, concretely.

**Milestones** are the one category populated from the Workshop itself
rather than message text — `watchProjects()` diffs `ProjectsStore` against
its own last-known "done" set, correctly treating every project already
finished before it started listening as the honest baseline rather than a
fresh milestone the moment the Workshop next loads (the same
`_initialized`-baseline pattern `ResidentCuriosity.js` uses for its own
object count). Also gated by the "Workshop History" category, checked
fresh each time a project finishes (via a `getCategories` function passed
in at wiring time, not a static snapshot), since the active profile — and
its own toggle — can change over the life of a session.

`mostRelevant(n)` returns the most recently reinforced few (after purging
anything expired), fed into `composeSystemPrompt()`'s own
`context.memoryNotes` — "a few things you remember," never a transcript.
Also read, read-only, by Mission Control's own Resident Sandbox for
"Memory Inspection" — see docs/AI.md.

**Deliberately never registered with `PersistenceSystem`.** This is what
makes Mission Control's own "Session Only" memory mode true by
construction — nothing here ever reaches `localStorage` — rather than a
mode check scattered through save/load paths. See "Mission Control
Integration" for what this means for "Persistent" mode specifically.

## Resident Embodiments

"Begin preparing support for additional resident embodiments... avoid
introducing additional residents during this phase." Five real shapes now
exist in `ResidentRenderer._buildOuterGeometry()` — `floatingOrb` (the
original sphere, still what a fresh resident is seeded with), `cube`, a
triangular `prism` (a real three-sided `CylinderGeometry`, not a
euphemism), a faceted `lantern` (an eight-sided cylinder), and `wisp` (a
sphere permanently stretched along its own vertical axis). `custom`
stays honestly reserved, exactly as before, falling back to the same
sphere `floatingOrb` uses rather than pretending to have a shape for it
yet.

Every shape shares the exact same material (`MeshPhysicalMaterial`,
`transmission`, `clearcoat`), the exact same always-a-sphere inner glow,
the exact same face plane and sparkle particles — only the outer
silhouette actually varies, which is what keeps every embodiment
unmistakably "the same kind of thing," never a different creature
depending on which shape happened to be chosen.

`color`, `glow`, and `scale` — previously stored, never read — are now
genuinely applied: `color` tints the body's own material directly
(distinct from the mood-driven emissive glow layered on top of it),
`glow` scales the inner glow's opacity and the point light's intensity
around their original fixed values (the default, 0.5, exactly reproduces
the resident's original look), and `scale` applies once at the root-group
level, composing cleanly with the per-frame squash/stretch
`ResidentMovement.js` already applies at the mesh level. `idleBehaviour`
is read by `ResidentMovement.update()`, not the renderer — "Still and
Attentive" damps the existing bob/sway/rotation to a bare minimum
(never fully frozen — see `docs/PERSISTENCE.md`'s "never looks frozen
even at rest" standard elsewhere), "Slow Rotate" layers a genuine
continuous turn on top of the existing gentle oscillation.

`ResidentController._onProfileChanged()` is what actually pushes an
updated embodiment to the renderer — subscribed to
`ResidentProfileStore`'s own `"residents:changed"` event, so an edit made
in Mission Control while Bubble is already alive in the room takes effect
immediately, not just on next load.

## Expression System (Workshop Personality phase)

"Bubble has now become the Workshop's first true resident... the current
placeholder appearance has served its purpose but no longer matches the
quality of the Workshop." Two things changed together: the expression
*vocabulary* grew from five to eight, and — the bigger shift —
expressions stopped being something only this codebase could draw.

**Eight expressions, one canonical list.** `ExpressionTypes.js` is now
the single source of truth — id, label, and a short description of when
each is actually used — that everything else reads from rather than
keeping a second, parallel list: `ResidentBehaviour.EXPRESSIONS` (the
mood/emotion system's own plain-id array) derives from it directly. The
original five (`sleeping`, `curious`, `happy`, `thinking`, and `content`
— renamed `neutral` to match the brief's own naming) are joined by
`excited`, `sad`, and `surprised`.

**Not every new expression has an automatic trigger, and that's said
plainly rather than faked.** `excited` genuinely does — see
`ResidentDials.js`'s own comment: it only becomes a likely resting mood
when a resident's Playfulness *and* Energy dials are both tuned high
together (the two deviations are multiplied, not added, specifically so
either alone isn't enough). `sad` and `surprised` have no dial, mood, or
event wired to them yet — inventing a forced trigger to make three
"complete" would have meant a dial combination or a life event that
doesn't actually mean what it claims to. Both are fully real everywhere
else — drawable in the Expression Creator, previewable, exportable — just
honestly waiting for a future phase's own well-motivated trigger. See
"Known simplifications" below.

**The built-in look is unchanged, on purpose.** Every original
expression's own hand-tuned procedural drawing (`ResidentRenderer
._drawProceduralFace()`, renamed from the original `_drawFace()` but
otherwise byte-for-byte the same curves/dots/arcs) still exists and is
still what a resident with no custom Expression Set shows — "Default
(built-in)" in Mission Control's own Expression Set dropdown. The three
new expressions got their own procedural drawings in the identical
style (a handful of simple curves each, described in that method's own
comments) so the built-in look stays complete and consistent even
without anyone drawing anything custom.

### Expression Sets — genuinely custom, pixel by pixel

"Simple pixel drawing tools. Basic paint tools. Importing images...
saving/loading expression sets... exporting expression packs." An
Expression Set (`ExpressionSetStore.js`) is a small, named collection —
one 16×16 pixel grid per expression a person has actually drawn for it.
A set doesn't need all eight filled in: `ResidentRenderer._drawFace()`
checks the active set for the expression currently being shown, and
falls back to the built-in procedural drawing for just that one
expression if the set has nothing for it — never a blank or broken
face, and never a reason a set has to feel "incomplete" to be usable.

**The Expression Creator lives inside AI Mission Control** (a new
"Expressions" section, between Embodiment and the Resident Sandbox) —
deliberately not a new Computer app or Phone app; this is one more
resident-configuration surface among several already there, not a
separate destination. A `<canvas>`-based pixel grid (pointer-drag
painting, treated as one continuous stroke the same way `TerrainSystem
.js`'s own brush is), a small preset colour palette plus a full colour
picker, a Pencil/Eraser toggle, Clear and Reset-to-Default actions, and
a genuine "Import Image…" that downsamples any picked image to the
grid size and reads its pixels back directly — a real, working way to
turn an existing picture into pixel art, not just a placeholder button.

**Which set is active lives on the resident profile itself**
(`ResidentProfileStore.js`'s own `expressionSetId`, defaulting to the
reserved sentinel `"default"`) — the identical "a plain id, resolved
against a separate store elsewhere" shape `provider`/`model` already
use, and exactly why this is "the reference implementation for [the]
shared [resident] architecture": a future second resident's own profile
would carry its own `expressionSetId` the same way, no new mechanism
required. `ResidentController._onProfileChanged()` resolves it (falling
back to `null`/built-in for `"default"` *or* for a set id that no
longer resolves to anything real — see `ExpressionSetStore.js`'s own
comment on why a missing reference is an expected, honestly-handled
case, not an error) and hands the result to `ResidentRenderer
.setExpressionSet()`; a second listener on `ExpressionSetStore`'s own
`"expressionSets:changed"` event means editing the *contents* of the
currently-active set (drawing a new pixel expression, say) updates
Bubble live, not just switching which set is active.

### Expression Assets — Workshop Assets like any other

"Expressions should integrate with the Shared Asset Library... behave
just like every other Workshop asset." Registered as the `"expressions"`
`AssetService` kind, alongside Objects, Models, Animations, and
everything else — real search, favouriting, categories, and tags (every
expression a set has actually drawn becomes one of its own tags). The
one genuinely new piece is the **thumbnail**: `buildPixelThumbnail()`
(`WorkshopAssetSchema.js`, alongside the existing `buildSwatchThumbnail()`
it's modelled on) renders the set's own `neutral` expression — or
whichever expression it does have drawn — as a small real SVG of its
actual pixels, not an abstract colour summary. What you see in the
Asset Library is what the set actually looks like.

**Export/Import** (`ExpressionSetStore.exportSet()`/`importSet()`)
follows the identical `type`-tagged envelope shape
`ResidentProfileStore.exportProfile()`/`PersistenceSystem.exportBackup()`
already established (`"workshop-expression-pack"`), validated and
cross-recognising the other two export kinds by name rather than
failing to parse them silently, and — like a profile import — always
additive: a fresh id, never overwriting anything already present. See
`docs/PERSISTENCE.md`'s own "Import & Export" section for the complete,
shared account.

**Versioning** is honestly minimal: an export carries its own
`version: 1` and the set's own `gridSize`, so a future Workshop version
that changed the grid size (unlikely, but not impossible) could still
tell an older pack apart and choose how to handle it, rather than
silently misreading pixel data at the wrong resolution. There's no
per-expression edit history or rollback within a set — drawing over an
expression replaces it outright, the same "whole array, not a diff"
simplicity `TerrainSystem.js`'s own undo snapshots already accept for a
similarly small amount of data.

### A note on the face's own visual quality

"Better expression transitions... cleaner face rendering." Two real,
contained changes to `ResidentRenderer.js`, neither touching how any
individual expression actually looks:

- **Expression changes now cross-fade** rather than swapping instantly —
  the face mesh eases to fully transparent, the new texture (and its
  matching mood colour, glow, and light) is swapped in at the exact
  invisible midpoint, then it eases back in. 160ms total — long enough
  to read as a genuine transition, nowhere near long enough to feel like
  Bubble's face is fading in and out. Switching *sets* in Mission
  Control redraws immediately, deliberately without the cross-fade — a
  configuration change, not a felt emotional beat.
- **"Thinking" indicators** were already distinct from "curious" (an
  earlier phase's own fix, still intact) and remain the resident's own
  honest way of showing it's waiting on a real AI reply — unchanged
  this phase, mentioned here only because the brief asked after it
  directly and the honest answer is "already solid, nothing to add."

## Mission Control Integration

"Behaviour settings should now genuinely influence Bubble... Conversation
Style, Personality, Behaviour, Embodiment." A summary of what's actually
wired, since the pieces are spread across several files above:

- **Conversation Style / Personality / Behaviour** (the free-text
  identity fields) already flowed into `PromptComposer.
  composeSystemPrompt()` before this phase; unchanged.
- **Selected traits** (new this phase) flow into the same system prompt
  via `traitPersonalityLine()`, *and* into movement/awareness/idle-weight
  behaviour via `ResidentTraits.getTraitModifiers()` — see "Personality
  Traits" above.
- **Behaviour Configuration** (temperature, context size, etc.) already
  reached real conversation turns via `ResidentConnection.sendMessage()`
  before this phase; unchanged.
- **Embodiment** (type, colour, glow, scale, idle behaviour) — previously
  entirely inert — now genuinely shapes Bubble's own appearance and
  motion; see "Resident Embodiments" above.
- **Memory mode** — previously entirely inert — now genuinely gates
  `ConversationMemory`'s own extraction and prompt injection. "Disabled"
  means exactly that. "Session Only" and "Persistent" are currently
  treated identically (kept for the runtime session, never written to
  `localStorage`) — true cross-session persistence for "Persistent" is
  still honest future work, not this phase's; see
  `MemoryConfiguration.js`'s own updated description.
- **Memory size / summaries / context budget** remain exactly what they
  were — real fields, real defaults, no storage limit or summarisation
  behind any of them yet.

### AI Intelligence phase addendum

"Please ensure every major Mission Control setting now has a meaningful
effect within Bubble. Avoid placeholder configuration where possible."
Continuing the account above:

- **Provider** (new) — genuinely read; only Ollama is functional, every
  other choice honestly says so rather than pretending to connect. See
  `src/ai/ProviderRegistry.js` and docs/AI.md's own "Additional Providers"
  section.
- **Behaviour Dials** (new) — genuinely active; combined with traits by
  `ResidentContext.getPersonalityModifiers()` into movement, awareness,
  idle-location weighting, and a system-prompt style line. See "Behaviour
  Dials" above.
- **Memory categories and lifetimes** (new) — both genuinely read by
  `ConversationMemory.js`; see "Conversation Memory" above.
- **Resident Sandbox / Resident Health** (new, in `AIApp.js` itself, not
  a profile field) — the two places this phase adds for *seeing* that
  everything above is genuinely connected, sharing the exact same
  `ResidentContext.buildConversationContext()`/`composeSystemPrompt()`
  path the real conversation uses, rather than an approximation of it.
  See docs/AI.md's own "Resident Sandbox" and "Resident Health" sections.

## World Awareness (Living World 2.0 phase)

"Rather than individual systems inventing their own logic, they should
all observe the same world state... future systems should naturally
consume this same awareness architecture." Before this phase, "is it
raining," "what time bucket is it," and "is there an active project"
were each answered correctly by whichever system happened to need the
answer — `ResidentController.js`'s own `_windowWatchWeights()`/
`_maybeDriftMood()` reaching into `EnvironmentSystem`/`TimeOfDaySystem`
directly, `ResidentWorldSignals.js` already having pulled the two most
commonly repeated questions ("is it raining," "is it golden hour") into
one shared place for exactly that reason (see that file's own comment).
`src/world/WorldAwareness.js` is the more general next step — one small,
read-only class, owning no state of its own, that answers "what does the
world look like right now" as a single, consistent snapshot:

```js
const state = worldAwareness.snapshot();
// { time: {hour, bucket, isNight, isGoldenHour},
//   weather: {id, isRaining},
//   music: {isPlaying, songTitle} | null,
//   player: {position} | null,
//   room: "workshop",
//   activeProjects: [...],
//   nearbyBeings: [...],
//   residentMood: "content" | ...,
//   recentEvents: [...] }
```

**Deliberately query-based, not event-based** — `snapshot()` is called
whenever a consumer actually wants to know something
(`ResidentController.js`'s own slow pattern-sampling timer, currently the
only real consumer), not fired continuously. A future consumer wanting
to react the *instant* something changes should listen to the same
underlying events this class itself reads from (`environment:changed`,
`timeofday:changed`, and so on) — `WorldAwareness` summarises their
current state on demand, it doesn't wrap or replace them.

**Every dependency is optional, every field degrades gracefully** — a
Workshop with no `musicSystem` wired in still gets a valid snapshot back
(`music: null`, not a thrown error), the same standard every other
cross-system read in this codebase already holds itself to.

### World Event Log

"Begin introducing lightweight world events... weather changing,
sunrise, sunset, music beginning... nothing should feel scripted.
Everything should simply feel like the world continuing."
`src/world/WorldEventLog.js` — a small, bounded (40 entries — "the goal
is not infinite history, the goal is meaningful history"), persisted
list of `{type, summary, at}` entries. It's a record, not a trigger:
nothing here fires an event or drives behaviour by itself;
`WorldAwareness.snapshot().recentEvents` is the one place anything
downstream actually reads it.

Populated entirely by listening to events other systems already emit
(`main.js`'s own wiring) — never a new signal invented for this:

- **`environment:changed`** — only recorded when the weather id actually
  *differs* from the last one noted, not on every frame's own gradual
  fog/cloud easing.
- **`timeofday:changed`** — only recorded at the specific moment
  `ResidentWorldSignals.currentTimeBucket()` crosses into or out of
  `"night"` — a genuine sunrise or nightfall, not a running commentary on
  the sun's own continuous movement.
- **`music:playbackStateChanged`** — only recorded on the transition from
  not-playing to playing, with the song's own real title where available.

Each listener tracks its own "last known state" locally (a closure
variable in `main.js`, not a field on `WorldEventLog` itself) specifically
so the class stays a plain, generic record-keeper with no opinion about
*which* transitions count as noteworthy — that judgement call belongs to
whoever's actually watching a specific system, the same "this file owns
*when*, the real logic lives elsewhere" split the rest of the Workshop
already follows.

**A real, visible payoff**: `ResidentContext.buildConversationContext()`
now folds the two most recent world events into the same "Things you
might have noticed recently" line Bubble's own curiosity notes already
produce — a real weather change or a song starting is genuinely the same
*kind* of thing from Bubble's own perspective as noticing something new
built nearby, so it shares that one line rather than needing a second,
separate one.

### Resident awareness, extended

Three new small, believable behaviours, each layered directly into the
exact weighted-merge mechanism `_windowWatchWeights()` already used for
window-watching and favourite places — "everything should quietly
observe, remember and respond" made concrete by adding more real signals
into a merge function that already existed, not a new decision system on
top of it:

- **"Watching the player work"** — a plain proximity check against the
  same real workbench/computer-desk positions `PlayerPatternMemory.js`'s
  own zones already use. The player doesn't need to be doing anything in
  particular, just genuinely standing there.
- **"Remaining near ongoing projects"** — `WorldAwareness.snapshot()
  .activeProjects.length > 0` pulls gently toward the workbench, the
  same modest weight a favourite location already gets.
- **"Becoming quieter at night"** — a pull toward the Quiet Corner
  specifically at night, rather than a movement-speed change (which would
  risk fighting with the trait/dial multipliers already applied
  elsewhere).

**Atmosphere phase, layered onto the exact same mechanism**: a windy day
(the `windy` weather state specifically, not an arbitrary wind-speed
threshold) now also counts as "worth watching" from the window, alongside
rain and golden hour; and a storm specifically pulls toward the Quiet
Corner — sheltering, reusing the identical pull night already
established rather than inventing a second one. `WorldAwareness.snapshot()`
also gained a `season` field this phase (`Astronomy.getSeason()`,
read-only, computed fresh from the real calendar date) — nothing
currently reads it from `ResidentController.js`; it's there for a future
phase that wants Bubble to notice the season the same way it already
notices weather and time. See `docs/ATMOSPHERE.md`'s "Living World
Integration" section for the fuller account.

None of these are guarantees — every one is one more weighted option
among several in the same ordinary `maybePickNewLocation()` pick idle
locations already use, exactly the "subtlety, not spectacle" the phase's
own brief asks for.

## Known simplifications (by design, for this phase)

- **One resident, not several** — `ResidentController` assumes a single
  bubble; `docs/AI.md`'s own multiple-profile support already lets
  someone configure several *personalities*, but only the active one is
  ever embodied at once this phase.
- **No voice** — text only, matching "Voice" being listed as an explicit
  future capability, not this phase's own.
- **"Session Only" and "Persistent" memory modes are currently
  identical** — both keep `ConversationMemory`'s notes for the current
  runtime only; genuine cross-session persistence for "Persistent" is
  still future work, not implemented here (see `MemoryConfiguration.js`'s
  own honest description).
- **Conversation Memory's extraction is heuristic, not semantic** — three
  cheap regex/substring checks, not a model call. A message that states a
  preference or goal in an unusual phrasing simply isn't noticed; this is
  the deliberate "simple continuity is sufficient" trade-off, not an
  oversight.
- **Mood only ever picks among `neutral`/`curious`/`happy`/`excited`** —
  `sleeping`/`thinking` stay purely situational (offline, mid-reply), on
  purpose; a resting mood drifting into either would misrepresent what's
  actually happening. `excited` joined this phase with a deliberately
  small base weight — see `ResidentDials.js`'s own comment.
- **`sad` and `surprised` have no automatic behavioural trigger yet** —
  fully real everywhere else (drawable, previewable, exportable), but
  honestly waiting for a future phase's own well-motivated dial
  combination or event, rather than a forced one invented to make the
  set of eight look complete. See "Expression System" above.
- **Expression Sets have no per-pixel edit history** — drawing over an
  expression replaces it outright; there's no undo within the
  Expression Creator itself, only Clear (blank the current expression)
  and Reset to Default (remove the override entirely).
- **A profile's own `expressionSetId` doesn't travel with a profile
  export** in any resolvable sense — the id itself is included
  honestly, but the actual pixel data lives in a separate Expression
  Pack export; see `ResidentProfileStore.exportProfile()`'s own comment.
- **Preferences and behaviour memory are coarse, count-based affinities**,
  not a real model of the player or the resident — exactly as
  `docs/PERSISTENCE.md`'s own "simple continuity is sufficient" standard
  already holds Bubble's movement to.
- **Only Ollama is a functional provider** — LM Studio/OpenAI/Anthropic/
  Custom Endpoint are real, selectable options that honestly say they
  aren't functional yet rather than pretending to connect. See
  docs/AI.md's own "Additional Providers" section.
- **Memory lifetimes are fixed per category, not independently
  configurable** — "where appropriate" licenses this; the seam
  (`CATEGORY_LIFETIMES`, a plain map keyed by category id) is ready for a
  future per-category selector regardless.
- **Behaviour dials only ever produce a system-prompt style line when
  they lean far enough from neutral** — a dial sitting close to 0.5 says
  nothing at all, on purpose; a resident with every dial left at default
  should read exactly as it did before dials existed.
- **`WorldAwareness.room` is a plain constant, not a real lookup** — "the
  one room the Workshop currently has," honestly; a second room existing
  is what would turn this into a genuine query.
- **Relationships track *proximity*, not genuine interaction** — Bubble
  idling near a Being bumps the same affinity a real conversation would;
  there's no way yet to distinguish "spent time near" from "actually did
  something with."
- **World events are noticed, never acted on beyond conversation
  colour** — `WorldEventLog` is a memory, not a trigger; nothing currently
  changes behaviour *because* an event was logged, only because the
  underlying world state (weather, time, an active project) itself
  changed, which `_windowWatchWeights()` already reads independently.

## Future extension points

- **Multiple residents** — `ResidentController` constructing more than
  one `ResidentMovement`/`ResidentRenderer`/entity pair, one per active
  profile a person wants embodied at once, is the natural next step;
  nothing about the current architecture assumes exactly one. Each of
  this phase's own new files (`ResidentTraits`, `ResidentPreferences`,
  `ResidentCuriosity`) already takes a profile/instance as an argument
  rather than assuming a singleton, which is what would make this
  tractable. The Workshop Personality phase's own `expressionSetId`
  joins this list — already a plain per-profile reference, resolved
  fresh by whoever renders that profile, exactly the shape a second
  simultaneously-embodied resident would need.
- **Real triggers for `sad` and `surprised`** — both fully exist in the
  vocabulary and the Expression Creator today; what's missing is an
  honest, well-motivated *reason* for either to appear automatically
  (a dial combination, a specific world event) rather than a forced one
  invented to complete the set.
- **A shared Expression Set across multiple residents** — today a set is
  drawn with one resident in mind but nothing technically ties it to
  one; a future phase could make that intentional (a "Workshop House
  Style" pack meant to be reused) rather than merely possible by
  accident.
- **A truly custom embodiment** — `custom` currently falls back to the
  same sphere `floatingOrb` uses; a future phase giving it a genuinely
  different construction path (an imported model, perhaps reusing
  `ModelLoader.js` the way Beings already do) is the natural next step
  for the one embodiment type still honestly a placeholder.
- **Voice, relationships, tasks, autonomous behaviours** — all listed
  explicitly as future Workshop growth; none of them require a redesign
  of what's here, only new systems that read from the same
  `ResidentProfileStore`/`ResidentState`/`ResidentPreferences`/
  `PlayerPatternMemory` this and earlier phases already established.
- **True cross-session Conversation Memory** consuming
  `MemoryConfiguration.js`'s own already-real `mode` field for its
  "Persistent" value specifically — the seam is already there
  (`ConversationMemory.js`'s own notes are already structured, bounded,
  and ready to serialise); this phase's own honest choice was keeping
  them runtime-only rather than half-persisting them without a real plan
  for pruning/summarising a list that would otherwise grow forever.
- **Semantic (model-assisted) memory extraction** — replacing
  `ConversationMemory.extractFromMessage()`'s own regex heuristics with an
  actual summarisation call, once `MemoryConfiguration.memorySummaries`
  has a real implementation to attach to.
- **Real additional providers** — `ProviderRegistry.js`'s own list is
  ready; LM Studio and Custom Endpoint (typically OpenAI-compatible
  local/self-hosted APIs) are the more tractable next step, since OpenAI/
  Anthropic would additionally need real credential handling.
- **Per-category memory lifetimes** — `CATEGORY_LIFETIMES` is a plain map
  keyed by category id; a future per-category selector in Mission Control
  wouldn't need to change anything about how `ConversationMemory.js`
  itself reads it.
- **Multiple Buildings / Additional Residents** — `PlayerPatternMemory`'s
  own named zones and `ResidentPreferences`' own affinity bags are
  written against plain data, not anything Workshop-singular; a second
  building's own zones, or a second resident's own preferences, already
  participate the moment they exist, the same "written against the
  stores, not anything singular" property `docs/PERSISTENCE.md`'s own
  continuity handlers already have.
- **Workshop Beings, plugin behaviours** — `ResidentBehaviour.js`'s own
  narrow, two-mode state machine is deliberately simple; a future
  behaviour system could layer richer states on top without touching
  `ResidentMovement`/`ResidentRenderer` at all.
- **Event-driven `WorldAwareness` consumers** — today's one real consumer
  (`ResidentController.js`) only ever polls on its own slow timer; a
  future system wanting to react the instant something changes has the
  identical underlying events (`environment:changed`,
  `timeofday:changed`, `worldEvents:changed`) already available to listen
  to directly.
- **Beings reading `WorldAwareness` too** — `BeingController.js` doesn't
  consume it yet; a Being noticing the weather or an active project would
  follow the exact same pattern `ResidentController.js` already
  establishes, not a new one.
- **A real room lookup for `WorldAwareness.room`**, the moment a second
  room exists to distinguish.


