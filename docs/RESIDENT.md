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

## Architecture: eight small, separated files — plus four more this phase

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
  concrete movement/awareness/expression modifiers.
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
its own, which is exactly the point. See the README's own "One
contribution" section for the fuller reasoning behind choosing this,
specifically, over everything else it could have been.

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
Integration" below) and is three cheap, independent checks: does the
message name a real project (scanned against `ProjectsStore.all()`), does
it read as a stated preference ("I love...", "my favourite X is..."), does
it read as a stated goal ("I want to...", "I'm going to..."). No second
model call, no summarisation — "this does not require advanced AI. Simple
continuity is sufficient" (`docs/PERSISTENCE.md`'s own standard for
Bubble's movement) applies just as well here.

**Milestones** are the one category populated from the Workshop itself
rather than message text — `watchProjects()` diffs `ProjectsStore` against
its own last-known "done" set, correctly treating every project already
finished before it started listening as the honest baseline rather than a
fresh milestone the moment the Workshop next loads (the same
`_initialized`-baseline pattern `ResidentCuriosity.js` uses for its own
object count).

`mostRelevant(n)` returns the most recently reinforced few, fed into
`composeSystemPrompt()`'s own `context.memoryNotes` — "a few things you
remember," never a transcript.

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
- **Mood only ever picks among `content`/`curious`/`happy`** —
  `sleeping`/`thinking` stay purely situational (offline, mid-reply), on
  purpose; a resting mood drifting into either would misrepresent what's
  actually happening.
- **Preferences and behaviour memory are coarse, count-based affinities**,
  not a real model of the player or the resident — exactly as
  `docs/PERSISTENCE.md`'s own "simple continuity is sufficient" standard
  already holds Bubble's movement to.

## Future extension points

- **Multiple residents** — `ResidentController` constructing more than
  one `ResidentMovement`/`ResidentRenderer`/entity pair, one per active
  profile a person wants embodied at once, is the natural next step;
  nothing about the current architecture assumes exactly one. Each of
  this phase's own new files (`ResidentTraits`, `ResidentPreferences`,
  `ResidentCuriosity`) already takes a profile/instance as an argument
  rather than assuming a singleton, which is what would make this
  tractable.
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


