# AI Mission Control

"This is NOT the AI itself. This phase is about preparing the Workshop for
the AI." Mission Control is where a future Workshop resident gets prepared
— identity, model, behaviour tuning, and (currently inert) memory and
embodiment settings — before any resident actually exists. This document
covers how it's built; `docs/ARCHITECTURE.md` covers how it fits into the
rest of the Workshop.

## Design philosophy, briefly

"Would this interface make me feel like I was configuring software, or
would it make me feel like I was getting to know the personality of
someone who will eventually share this space with me?" Two decisions
carry that:

1. **Identity comes before numbers.** Resident Identity — Name, Purpose,
   Identity, Personality, Behaviour, Conversation Style — sits ahead of
   Behaviour's temperature/context-size sliders in both the file and the
   rendered form, on purpose. A raw system-prompt textbox would have been
   far less work; asking who someone *is* instead is the entire point of
   this phase.
2. **Never alarming, never blocking.** "If the configured Ollama server is
   unavailable: display a calm status message, continue retrying
   automatically, never block the Workshop, never interrupt gameplay,
   never spam errors." See "Connection Manager" below for exactly how
   that's implemented, not just described.

## Architecture: six small, separated responsibilities

"Please continue following the Workshop architecture. Separate
responsibilities where appropriate." Concretely, in `src/ai/`:

- **`AIConnectionManager.js`** — owns exactly one thing: whether a
  configured Ollama server is currently reachable, plus the two requests
  that only make sense once it is (list models, send a test prompt). Has
  no idea what a "resident profile" is.
- **`ModelRegistry.js`** — a pure, refreshable cache of what models exist
  and what's known about them. Has never made a network request itself;
  `AIApp.js` is the only thing that calls
  `AIConnectionManager.checkConnection()` and hands the raw result here.
- **`ResidentProfileStore.js`** — the CRUD store for named profiles, each
  one the *entire* description of a possible future resident (identity,
  model, behaviour tuning, memory, embodiment) in one place.
- **`MemoryConfiguration.js`** / **`EmbodimentConfiguration.js`** — not
  stores, just shape-and-defaults modules (constants, a `default*Config()`
  function, a `normalize*Config()` function) — the one place each
  settings shape is defined, imported by `ResidentProfileStore` for its
  own defaults and directly reusable by whatever eventually implements
  memory or embodiment for real.
- **`PromptComposer.js`** — one pure function,
  `composeSystemPrompt(profile)`, turning identity fields into the actual
  system prompt text. Deliberately not a method on
  `ResidentProfileStore` — a future AI Resident imports and calls the
  exact same function `AIApp.js`'s own Advanced section already uses,
  rather than reimplementing the same combination logic.

"The future AI Resident should simply consume these configurations rather
than implementing its own copies" is the reason every one of these is a
plain, framework-free module with a clear, narrow contract — a future
resident system depends on `ResidentProfileStore.getActive()` and
`composeSystemPrompt()`, not on anything about how Mission Control's own
UI happens to be built.

`AIApp.js` (the Mission Control application itself) is the one place that
knows about all of them at once — it calls
`AIConnectionManager.checkConnection()` on "Refresh Models" and hands the
result to `ModelRegistry.setModels()`, but owns no state of its own beyond
which section is expanded. The same "app renders a store, doesn't
duplicate it" shape every other Workshop app (the Builder, the Browser,
the Animation Editor) already follows.

## Connection Manager

"Allow configuration of a local Ollama server... display a simple
connection status." `AIConnectionManager` polls the configured
`baseUrl`'s `/api/tags` endpoint on a calm ten-second interval — not a
tight retry loop — folding every possible outcome into one plain `status`
string: `"connecting"` (actively checking — right after the URL changes,
say), `"connected"`, or `"disconnected"` (quietly waiting, retrying on the
next scheduled poll). `AIApp.js` maps these straight onto the brief's own
wording: "Connecting…" / "Connected" / "Waiting for Ollama…".

**Every failure is caught, never thrown, never logged as an error.**
There is no `console.error` anywhere in this path — Ollama not running
right now is an ordinary, entirely expected state for anyone who hasn't
started it (or doesn't use it at all), not a bug to report. A network
error, a CORS rejection, and a timeout are all indistinguishable from
"Ollama isn't running" from here, and deliberately treated identically:
there's no reliable way to tell them apart from inside a browser, so
there's no reason to show a different, more alarming message for one than
another.

**A real, honest limitation worth naming**: Ollama's own default CORS
policy only allows requests from a small set of origins, and the
Workshop's own deployed origin isn't one of them out of the box. Actually
connecting requires setting `OLLAMA_ORIGINS` (covering the Workshop's own
origin) before starting Ollama — not something fixable from inside this
file, the same category of limitation `docs/BROWSER.md`'s own
`X-Frame-Options` note documents for a different reason entirely.

**Generous timeouts for a cold model load.** The lightweight "is Ollama
even reachable" poll (`/api/tags`) stays quick — a few seconds is more
than enough for an endpoint that doesn't load anything. Actually
generating a reply (`sendMessage()`, `sendTestPrompt()`) is different:
Ollama loads a model's own weights from disk into memory the first time
it's used (or after it's been idle long enough to be unloaded again),
and for a larger model on modest hardware that alone can take well over
a minute before generation even begins. Both real-generation calls use a
three-minute timeout — generous enough that a genuinely slow cold load
isn't mistaken for a failure, without pretending to solve the underlying
"maybe your hardware is meaningfully slower than the model you picked"
problem, which is a modelling/hardware question this file has no
business making decisions about. The resident conversation overlay
itself shows a quiet, one-line reassurance ("still working — the model
may be loading for the first time") once a reply has genuinely been
taking a while, so a long wait never reads as the Workshop having simply
frozen.

## Model Selection

"Refresh Models, Current Model, Model Information where available." A
manual button, matching the brief's own explicit UI list — pressing it
calls `AIConnectionManager.checkConnection()` and, only on an actual
success, replaces `ModelRegistry`'s known model list
(`ModelRegistry.setModels()`). A *failed* refresh deliberately leaves the
previously-known list alone rather than clearing it — losing a working
model list because of one transient hiccup during a manual refresh would
read as more alarming than this whole app's own calm philosophy allows.

`ModelRegistry` translates Ollama's own raw `/api/tags` shape (`{name,
model, size, digest, details: {family, parameter_size,
quantization_level}, modified_at}`) into the plain fields the UI actually
shows — parameter size, quantisation level, and a human-readable file
size — so a future switch to a different local-model server only needs a
different translation in this one file, nothing about `AIApp.js` itself.

## Resident Identity

"Rather than exposing only a single System Prompt field, please create a
more natural identity editor." Six fields — Name, Purpose, Identity,
Personality, Behaviour, Conversation Style — each a free-text area, no
required format or length. `PromptComposer.composeSystemPrompt()` weaves
whatever's filled in into plain prose (skipping any field left blank
entirely, rather than emitting an empty "Personality: " line) — the
**Advanced** section (collapsed by default) shows exactly what that
produces, "for experienced users," without it being the primary way
anyone edits who this resident is.

**Resident Traits** (added in the Workshop Residents phase) sits directly
below this section in `AIApp.js`, as a small, structured companion — up
to `MAX_SELECTED_TRAITS` named long-term traits (Curious, Calm, Cheerful,
Quiet, Thoughtful, Playful), distinct from the free-text "Personality"
field above. The difference is deliberate: prose here is for the model to
read; traits are a fixed enum other systems (movement, awareness,
idle-location weighting) can actually branch on. See
`src/ai/TraitConfiguration.js` and docs/RESIDENT.md's own "Personality
Traits" section for how a selection actually becomes behaviour.

## Behaviour Configuration

Temperature, Creativity, Determinism (0–1 sliders), Context Size and
Maximum Response Length (token-count sliders) — ordinary Ollama generation
parameters, stored on the profile (`behaviourConfig`). Real conversation
turns (`ResidentConnection.sendMessage()`, see docs/RESIDENT.md) apply
temperature/context size/max response length already; the one-off
Connection Test below still sends a fixed prompt with none of them
applied, since there's little to tune about a single "Hello."

## Memory Configuration: mode is real, the rest is still architecture

"These do not need to be fully implemented yet. The goal is to establish
the architecture" was true of every field here when this section was
first written. `mode` (Disabled / Session Only / Persistent) is now
genuinely read — `src/resident/ConversationMemory.js` checks it before
extracting or surfacing anything about the player, so "Disabled" really
does mean Bubble remembers nothing between messages. "Session Only" and
"Persistent" are currently treated identically (kept for the current
runtime, never written to `localStorage`); true cross-session persistence
for the latter is still honest future work. `memorySize`, `memorySummaries`,
`contextBudget` remain exactly what they were — real defaults, no storage
limit or summarisation behind any of them yet, still marked as not active
in the Memory section's own UI.

## Embodiment: genuinely active

"These are not active during this phase. Instead they simply prepare for
the next phase" — that next phase has now arrived.
`EmbodimentConfiguration.js`'s own shape is unchanged (Embodiment Type,
Colour, Glow, Scale, Idle Behaviour), but every field is now read by
`ResidentRenderer.js`/`ResidentMovement.js` to actually shape Bubble's own
appearance and motion — five real shapes (Floating Orb, Cube, Prism,
Lantern, Wisp), a genuinely tinted body, a glow that scales with the
slider, a root-level scale, and idle motion that responds to the chosen
idle behaviour. `custom` stays honestly reserved for a future phase that
isn't a simple primitive at all. See docs/RESIDENT.md's own "Resident
Embodiments" section for the full account. The default colour
(`#7fd8c4`) is still the Workshop's own existing screen-glow teal, a
natural starting point rather than an arbitrary one.

## Profiles

"This allows multiple AI personalities to be configured... Profiles
should persist between Workshop sessions." `ResidentProfileStore` is
ordinary JSON through the normal `PersistenceSystem` path — Create,
Duplicate, Rename, Delete, and switching which one is active
(`setActive`) are all it exposes; there's no separate explicit "Save"
action anywhere in Mission Control, matching how every other editing
surface in the Workshop already applies changes immediately rather than
needing a save step.

Always at least one profile — a fresh Workshop seeds one named "Workshop
Resident" (matching the Status Card's own example), and `remove()` simply
refuses to delete the last remaining one, the same "never an empty,
purposeless state" instinct behind `BrowserStore` always keeping one tab
and `AnimationLibraryStore` always keeping its own defaults available.

## Connection Testing

"The player should be able to send a small test prompt to the selected
model... this is not yet the Workshop chat interface." One button, one
fixed prompt ("Hello."), one response shown inline in Mission Control
itself — no conversation history, no follow-up turns. A successful
response shows a plain "● Working" card with the model's actual reply; a
failure shows the real error message (unlike `checkConnection()`, which
deliberately swallows every failure to stay calm on its own quiet polling
loop, a person who explicitly pressed "test" deserves to know exactly
what went wrong).

## Status Card

"The Workshop should never feel broken simply because Ollama is currently
unavailable." The active profile's own name, the current connection
status, and one calm, honest follow-up line — "Awaiting embodiment" once
connected (there genuinely isn't a physical presence yet, and saying so
plainly reads better than pretending otherwise), or a reassurance that
nothing here is blocking anything else while disconnected.

## Future Workshop Resident integration

A real AI Resident, when it arrives, reads exactly two things from this
phase's own work: `ResidentProfileStore.getActive()` for the full profile,
and `PromptComposer.composeSystemPrompt(profile)` for its system prompt.
`AIConnectionManager`/`ModelRegistry` are already the exact connection and
model-listing machinery it would need too — nothing about either changes
when a resident actually starts generating responses instead of just this
phase's own one-off test prompt.

## Known simplifications (by design, for this phase)

- **No automatic model-list refresh on first connection** — "Refresh
  Models" is a deliberate manual action, matching the brief's own explicit
  UI list; connecting doesn't silently populate the model dropdown on its
  own.
- **Behaviour Configuration values aren't sent anywhere by Connection
  Testing specifically** — it still sends a fixed prompt with none of
  `behaviourConfig`'s own settings applied (there's no reason to tune a
  one-off "Hello."). Real conversation turns, via
  `ResidentConnection.sendMessage()`, do apply them — see docs/RESIDENT.md.
- **Memory's `mode` is genuinely read; the rest still isn't** —
  `memorySize`/`memorySummaries`/`contextBudget` remain exactly what they
  always were, real fields with no storage limit or summarisation behind
  them. `mode` itself gates `ConversationMemory` (see docs/RESIDENT.md's
  own "Conversation Memory" and "Mission Control Integration" sections) —
  "Session Only" and "Persistent" are currently treated identically
  (runtime-only, never touching `localStorage`); true cross-session
  persistence for "Persistent" is still future work.
- **Embodiment is genuinely read** (as of the Workshop Residents phase) —
  see docs/RESIDENT.md's "Resident Embodiments" section for what each
  field now actually does. `custom` still falls back to the same sphere
  `floatingOrb` uses, honestly, rather than pretending to have a shape for
  it yet.

## Future extension points

- **A real AI Resident system**, reading `ResidentProfileStore`/
  `PromptComposer` exactly as described above — arrived this phase; see
  docs/RESIDENT.md.
- **Resident Traits** (`src/ai/TraitConfiguration.js`) — a small,
  structured companion to the free-text Resident Identity fields above,
  letting a person choose up to a couple of named long-term traits
  (Curious, Calm, Cheerful, Quiet, Thoughtful, Playful) that other
  systems — not just the system prompt — can actually branch on. See
  docs/RESIDENT.md's own "Personality Traits" section.
- **True cross-session memory**, implementing `MemoryConfiguration.js`'s
  own "Persistent" mode for real rather than treating it the same as
  "Session Only" — see docs/RESIDENT.md's own "Conversation Memory"
  section for exactly what's already in place to build this on.
- **Workshop Host integration** — a locally-hosted resident could
  eventually be launched or managed through `workshop://host`'s own future
  pages (see `docs/BROWSER.md`), with Mission Control remaining the place
  its personality and behaviour are configured either way.
- **Sending Behaviour Configuration's own values** through to the
  Connection Test specifically — real conversation turns already apply
  them (see docs/RESIDENT.md); the one-off test prompt still doesn't,
  since there's little reason to tune a single fixed "Hello."
