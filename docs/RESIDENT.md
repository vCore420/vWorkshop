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

## Architecture: eight small, separated files

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
  0-1 `awarenessBlend`, not a combinatorial state machine) and the one
  real mode distinction, idle vs. conversing.
- **`ResidentRenderer.js`** — the actual Three.js visual: the bubble, its
  inner glow, its small drawn face, its sparkle particles.
- **`ResidentConnection.js`** — a thin adapter over
  `AIConnectionManager`, translating its status into `isAwake` and
  carrying real conversation turns through Ollama's `/api/chat`.
- **`ResidentConversation.js`** — the chat overlay, opened the same way
  every other physical object's overlay opens.
- **`ResidentState.js`** — the resident's own small persisted runtime
  state (idle location, mood).
- **`ResidentController.js`** — the one engine system tying the rest
  together every frame, itself owning as little logic as possible.

"The future AI Resident should simply consume these configurations
rather than implementing its own copies" (from Mission Control's own
phase) is honoured completely: nowhere in `src/resident/` is there a
second `temperature` field, a second `model` field, a second identity —
every one of those is read from `ResidentProfileStore.getActive()` at the
moment it's needed.

## Embodiment: digital, not magical

"Semi-transparent bubble, soft internal glow, gentle sparkle effects,
subtle internal movement, slight refraction, soft ambient lighting, tiny
floating particles." Three layers, one root group, all in
`ResidentRenderer.js`:

- **The bubble itself** — `MeshPhysicalMaterial` with real `transmission`
  (genuine glass-like refraction, not a faked transparency trick) and a
  touch of `clearcoat` for a subtle sheen.
- **An inner glow** — a smaller, fully emissive sphere, its colour
  genuinely shifting with the resident's current mood/expression
  (`MOOD_COLORS`), not just its face.
- **Sparkle particles** — ten small points drifting slowly within the
  bubble's own radius on independent, desynchronised phases, breathing in
  opacity on a slow cycle rather than a fixed blink — "occasional sparkle
  pulses."

There's also a small `PointLight` inside the bubble — "soft ambient
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
a couple of small pale rectangles, not a full cartoon grin.

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

Six spots, each a real offset from `FURNITURE_LAYOUT`'s own coordinates
in `src/data/layoutDefault.js` — beside the computer, above the
workbench, near the bookshelf, by the music player, beside the quiet
corner, and looking out the window (facing one of the two actual window
openings `WorkshopRoom.js` cuts into the wall).

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
path — idle location and mood, nothing more. Identity, model, behaviour
tuning, memory, and embodiment settings are all `ResidentProfileStore`'s
own concern already (see `docs/AI.md`); duplicating any of them here would
be exactly the "implementing its own copies" the brief explicitly warned
against. Conversation history isn't persisted at all this phase — see
"Conversation" above.

## Known simplifications (by design, for this phase)

- **One resident, not several** — `ResidentController` assumes a single
  bubble; `docs/AI.md`'s own multiple-profile support already lets
  someone configure several *personalities*, but only the active one is
  ever embodied at once this phase.
- **Embodiment type is always "Floating Orb"** — Mission Control's own
  Cube/Custom embodiment options (see `docs/AI.md`) aren't read by
  `ResidentRenderer.js` yet; every resident currently looks like the same
  bubble regardless of what's chosen there.
- **No voice** — text only, matching "Voice" being listed as an explicit
  future capability, not this phase's own.
- **Mood is set once, at "content," and never changes on its own** — the
  architecture (`ResidentState.setMood()`) is there for a future
  behaviour system to actually drive; nothing currently calls it based on
  conversation content or anything else.

## Future extension points

- **Multiple residents** — `ResidentController` constructing more than
  one `ResidentMovement`/`ResidentRenderer`/entity pair, one per active
  profile a person wants embodied at once, is the natural next step;
  nothing about the current architecture assumes exactly one.
- **Custom embodiments** — `ResidentRenderer.js` reading
  `profile.embodiment.type` to actually branch between Floating
  Orb/Cube/Custom, rather than always building the same bubble.
- **Voice, relationships, tasks, autonomous behaviours** — all listed
  explicitly as future Workshop growth; none of them require a redesign
  of what's here, only new systems that read from the same
  `ResidentProfileStore`/`ResidentState` this phase already established.
- **A real memory system** consuming `MemoryConfiguration.js`'s own
  already-defined shape (see `docs/AI.md`), feeding real conversation
  history into `ResidentConnection.sendMessage()` instead of this phase's
  own session-only array.
- **Workshop Beings, plugin behaviours** — `ResidentBehaviour.js`'s own
  narrow, two-mode state machine is deliberately simple; a future
  behaviour system could layer richer states on top without touching
  `ResidentMovement`/`ResidentRenderer` at all.
