# AI Mission Control

"Mission Control should no longer feel like a configuration utility.
Instead, it should become the place where Workshop residents are
understood, configured and nurtured." Mission Control is where Bubble —
the Workshop's own resident, not a hypothetical future one — is shaped:
identity, intelligence, personality, memory, embodiment, all in one
place, alongside a calm read-out of how it's actually doing right now
and a safe sandbox to try changes before they reach the room. This
document covers how it's built; `docs/ARCHITECTURE.md` covers how it
fits into the rest of the Workshop; `docs/RESIDENT.md` covers what
actually happens inside the room once a setting here takes effect.

## Design philosophy, briefly

"When making design decisions continually ask yourself: if I wanted
Bubble to become more curious, calmer, more playful or more thoughtful,
would Mission Control naturally allow me to guide that growth?" Three
decisions carry that, this phase:

1. **Every major setting reaches Bubble for real.** "Avoid placeholder
   configuration where possible." Provider, Intelligence, the new
   Behaviour dials, Memory categories and lifetimes, Embodiment — see
   "Mission Control Integration" below for the complete account of what's
   genuinely wired versus what's still honestly architecture-only.
2. **A safe place to try things first.** The new Resident Sandbox lets a
   person test a configuration change against a real model response
   without it ever touching Bubble's actual presence in the room — see
   "Resident Sandbox" below.
3. **Never alarming, never blocking, still true.** The calm-status
   philosophy from the previous phase is untouched — connection health,
   provider status, and slower hardware are all still handled the exact
   same quiet way; see "Connection" below.

## Architecture: eight small, separated responsibilities

"Please continue following the Workshop architecture. Separate
responsibilities where appropriate." Concretely, in `src/ai/`:

- **`AIConnectionManager.js`** — owns exactly one thing: whether a
  configured Ollama server is currently reachable, plus the requests that
  only make sense once it is (list models, send a test prompt). Now also
  tracks `lastLatencyMs` — a real round-trip measurement, read by
  Mission Control's own Resident Health section.
- **`ModelRegistry.js`** — a pure, refreshable cache of what models exist
  and what's known about them.
- **`ResidentProfileStore.js`** — the CRUD store for named profiles, each
  one the *entire* description of a resident (identity, provider, model,
  intelligence tuning, behaviour dials, traits, memory, embodiment) in
  one place.
- **`ProviderRegistry.js`** *(new this phase)* — "please begin preparing
  Mission Control for additional providers." A plain, static list —
  Ollama (the only one actually functional), LM Studio, OpenAI,
  Anthropic, Custom Endpoint — each honestly marked `implemented` or not,
  the same convention `src/host/`'s own services already established.
- **`MemoryConfiguration.js`** / **`EmbodimentConfiguration.js`** /
  **`TraitConfiguration.js`** / **`BehaviourDialsConfiguration.js`**
  *(the last one new this phase)* — not stores, just shape-and-defaults
  modules — the one place each settings shape is defined, imported by
  `ResidentProfileStore` for its own defaults.
- **`PromptComposer.js`** — one pure function,
  `composeSystemPrompt(profile, context)`, turning identity fields (and,
  since the previous phase, an optional runtime `context`) into the
  actual system prompt text. Both the real conversation
  (`ResidentConversation.js`) and this phase's own Resident Sandbox call
  it identically, via the shared `src/resident/ResidentContext.js`.

"The future AI Resident should simply consume these configurations rather
than implementing its own copies" remains the reason every one of these
is a plain, framework-free module with a clear, narrow contract — true
now more than ever, since a real resident (Bubble) already does exactly
that.

`AIApp.js` (the Mission Control application itself) is the one place that
knows about all of them at once, plus this phase's own new reads:
`residentBehaviour`/`residentState` (for Resident Health),
`residentConnection`/`ConversationMemory`/`ResidentCuriosity`/
`ResidentPreferences`/`PlayerPatternMemory` (for the Sandbox). It still
owns no state of its own beyond which section is expanded and its own
sandbox conversation — the same "app renders a store, doesn't duplicate
it" shape every other Workshop app already follows.

## Connection

"Continue improving the Connection section... Ollama connection,
connection health, model discovery, provider status, connection testing,
automatic reconnection, graceful handling of unavailable providers...
ensure slower hardware is handled gracefully."

**Connection health.** `AIConnectionManager` polls the configured
`baseUrl`'s `/api/tags` endpoint on a calm ten-second interval — not a
tight retry loop — folding every possible outcome into one plain `status`
string: `"connecting"` (actively checking — right after the URL changes,
say), `"connected"`, or `"disconnected"` (quietly waiting, retrying on the
next scheduled poll, automatically, with no action required). `AIApp.js`
maps these straight onto plain language: "Connecting…" / "Connected" /
"Waiting for Ollama…".

**Every failure is caught, never thrown, never logged as an error.**
There is no `console.error` anywhere in this path — Ollama not running
right now is an ordinary, entirely expected state for anyone who hasn't
started it (or doesn't use it at all), not a bug to report. A network
error, a CORS rejection, and a timeout are all indistinguishable from
"Ollama isn't running" from here, and deliberately treated identically:
there's no reliable way to tell them apart from inside a browser, so
there's no reason to show a different, more alarming message for one than
another. This is "graceful handling of unavailable providers," concretely
— the Workshop keeps existing exactly as normal regardless of which
failure actually occurred.

**A real, honest limitation worth naming**: Ollama's own default CORS
policy only allows requests from a small set of origins, and the
Workshop's own deployed origin isn't one of them out of the box. Actually
connecting requires setting `OLLAMA_ORIGINS` (covering the Workshop's own
origin) before starting Ollama — not something fixable from inside this
file, the same category of limitation `docs/BROWSER.md`'s own
`X-Frame-Options` note documents for a different reason entirely.

**Generous timeouts for a cold model load — "ensure slower hardware is
handled gracefully."** The lightweight "is Ollama even reachable" poll
(`/api/tags`) stays quick — a few seconds is more than enough for an
endpoint that doesn't load anything. Actually generating a reply
(`sendMessage()`, `sendTestPrompt()`) is different: Ollama loads a
model's own weights from disk into memory the first time it's used (or
after it's been idle long enough to be unloaded again), and for a larger
model on modest hardware that alone can take well over a minute before
generation even begins. Both real-generation calls use a three-minute
timeout — generous enough that a genuinely slow cold load isn't mistaken
for a failure. The resident conversation overlay (and this phase's own
Resident Sandbox, identically) shows a quiet, one-line reassurance ("still
working — the model may be loading for the first time") once a reply has
genuinely been taking a while, so a long wait never reads as the Workshop
having simply frozen.

**Keeping a model warm — Workshop Refinement phase (Pass A).** The
three-minute timeout above is a safety net, not the actual fix for "the
Workshop should feel patient rather than fragile" — a longer timeout
only makes a cold load more *tolerable*, it never makes one *shorter*,
and doesn't stop the same slow load from happening again the next time
the model gets unloaded from inactivity. `AIConnectionManager
.setWarmModel()` (called by `main.js` whenever the active resident
profile's own model changes) pings Ollama once immediately — warming a
newly-selected model in the background before anyone's actually waiting
on it — and keeps re-pinging on a comfortable margin inside Ollama's own
5-minute default unload window, so a model genuinely in use never gets
the chance to cool down between messages. `keepAliveEnabled` (on by
default, persisted) is a real toggle in Mission Control's own
"Connection" section, for anyone who'd rather Ollama managed its own
memory, or is running something memory-constrained enough that holding a
model warm between messages isn't welcome. Every keep-alive ping fails
exactly as quietly as the connection poll already does — it's a
background convenience, never a user-facing error.

**Latency**, tracked this phase — `AIConnectionManager.lastLatencyMs` is
a real round-trip measurement from the most recent successful connection
check, `null` before the first one or after a failure. Read by Resident
Health below as a calm, informative number, not a debugging metric — a
poll's own round trip is a perfectly honest stand-in for "how responsive
is the connection right now," without needing any dedicated ping
mechanism of its own.

**Provider status** — see "Additional Providers" immediately below;
choosing a provider other than Ollama shows an honest, calm notice rather
than a broken-looking connection attempt, and the Model section and
Connection Test do the same.

`AIConnectionManager` itself stays exactly what it always was —
Ollama-specific — rather than being generalised into a multi-provider
client prematurely; see "Additional Providers" for why.

## Additional Providers

"Please begin preparing Mission Control for additional providers...
Ollama, LM Studio, OpenAI, Anthropic, Custom endpoints. Only Ollama needs
to be fully functional during this phase. The remaining providers should
simply be supported architecturally for future expansion."
`src/ai/ProviderRegistry.js` is that architecture: a plain array, each
entry `{ id, label, implemented, defaultBaseUrl, description }`. A
profile's own `provider` field is just one of these ids, validated on
every load and update the same way `model`/`embodiment.type` already are.

Why not build real (if disabled) OpenAI/Anthropic clients now? Because a
convincing-looking "Connected" status for a provider that doesn't
actually work would be exactly the kind of misleading placeholder
`docs/HOST.md` already warns against for local-machine services — "a
convincing fake would be more misleading than an honest 'not yet.'" The
architecture this phase adds is entirely about Mission Control's own
surface knowing these providers exist and presenting them honestly, not
about actually speaking to any of them besides Ollama.

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

This section is only shown in its normal form when the active profile's
provider is Ollama — a non-Ollama provider shows the same honest "not
functional yet" notice as Connection above, rather than an eternally
empty model list.

## Resident Identity

"Rather than exposing only a single System Prompt field, please create a
more natural identity editor." Six fields — Name, Purpose, Identity,
Personality, Behaviour, Conversation Style — each a free-text area, no
required format or length. `PromptComposer.composeSystemPrompt()` weaves
whatever's filled in into plain prose (skipping any field left blank
entirely) — the **Advanced** section (collapsed by default) shows exactly
what that produces.

**Resident Traits** sits directly below this section — up to
`MAX_SELECTED_TRAITS` named long-term traits (Curious, Calm, Cheerful,
Quiet, Thoughtful, Playful), distinct from the free-text "Personality"
field above. See `src/ai/TraitConfiguration.js` and docs/RESIDENT.md's own
"Personality Traits" section.

## Intelligence

"Continue expanding resident intelligence settings... Identity, Purpose,
Personality, Behaviour, Conversation style, Temperature, Context length...
these settings should now genuinely influence Bubble's behaviour."
Renamed from "Behaviour Configuration" (the previous phase's own label)
to match the brief's own grouping — "Behaviour" now names something
distinct (see below). Temperature, Creativity, Determinism (0–1 sliders),
Context Size and Maximum Response Length remain ordinary Ollama
generation parameters, stored on `behaviourConfig` and already applied to
every real conversation turn via `ResidentConnection.sendMessage()`
(unchanged this phase). The one-off Connection Test still sends a fixed
prompt with none of them applied, since there's little to tune about a
single "Hello."

## Behaviour

"Curiosity, Talkativeness, Playfulness, Energy, Independence, Reflection,
Calmness... these should influence movement, conversations and general
behaviour. Please favour subtle changes over dramatic differences."
Seven new continuous dials (`behaviourConfig.dials`, 0–1, default 0.5 —
neutral), each shown as a slider with plain-language endpoints ("Reserved
↔ Talkative") rather than a bare number. `src/resident/ResidentDials.js`
turns a dial's *deviation* from neutral into a small modifier — never
more than roughly ±30–40% at the extremes — combined with the discrete
traits above by `ResidentContext.getPersonalityModifiers()` into the one
set of numbers `ResidentController.js` actually applies to movement,
awareness, and idle-location weighting. See docs/RESIDENT.md's own
"Behaviour Dials" section for exactly how each dial maps onto something
real, including movement pace (Energy), motion damping (Calmness), and a
short conversational-style line woven into the system prompt
(Talkativeness/Playfulness/Reflection/Calmness/Energy, when they lean far
enough from neutral to be worth saying).

Traits and dials are deliberately complementary, not overlapping: traits
are "which flavour" (a small, named archetype), dials are "how strongly"
(a continuous fine-tune) — a resident can be "Curious" *and* have a
high Energy dial, each contributing its own share to the same final
modifier.

## Memory

"The architecture for Memory Configuration already exists. Please
activate it... allow the player to configure what Bubble remembers...
conversations, projects, player preferences, favourite places, favourite
activities, Workshop history, long-term goals... configurable memory
lifetimes... temporary, medium-term, permanent." Mode (Disabled/Session
Only/Persistent) was already genuinely read as of the previous phase;
this phase activates the rest:

- **Categories** — seven toggles (`memory.categories`), each checked by
  `src/resident/ConversationMemory.js` before it populates anything of
  that kind at all. "Conversations" is the one parent switch among them —
  it gates whether ordinary message text is scanned for anything
  memorable, with Projects/Preferences/Goals individually toggled
  *underneath* it. Places/Activities gate `ResidentContext.js`'s own live
  `preferenceLine` instead (see docs/RESIDENT.md), since those are
  sourced from `ResidentPreferences`/`PlayerPatternMemory` rather than
  message text. Workshop History gates milestone extraction from
  `ProjectsStore`.
- **Lifetimes** — three real tiers (`MEMORY_LIFETIMES`), each with an
  actual `ttlMs` behind it: Temporary (~10 minutes), Medium-Term
  (~2 hours), Permanent (never expires on its own this session). Each
  category defaults to one fixed tier (`CATEGORY_LIFETIMES`) rather than
  being independently configurable — "where appropriate" licenses keeping
  this simple; Places/Activities deliberately have no tier at all, since
  they're live-computed rather than stored notes with anything to expire.
  Shown next to each category's own checkbox as an honest, informative
  label.

"Session Only" and "Persistent" remain currently identical (kept for the
runtime session, never written to `localStorage`); true cross-session
persistence for "Persistent" is still honest future work.
`memorySize`/`memorySummaries`/`contextBudget` remain exactly what they
were — real fields, real defaults, no storage limit or summarisation
behind any of them yet, still marked as not active in the Memory
section's own UI.

## Embodiment

Unchanged in shape from the previous phase, which is when this became
genuinely active — Embodiment Type (five real shapes plus a reserved
`custom`), Colour, Glow, Scale, Idle Behaviour, all read by
`ResidentRenderer.js`/`ResidentMovement.js`. See docs/RESIDENT.md's own
"Resident Embodiments" section for the full account; nothing about it
changed this phase beyond how it now composes with the new Behaviour
dials (Energy/Calmness both feed into the same movement math Idle
Behaviour already influences).

## Resident Sandbox

"Please introduce a dedicated testing environment inside Mission
Control... allow the player to interact with Bubble without interrupting
Bubble inside the Workshop... test prompts, observe responses, memory
inspection, behaviour testing, personality testing... a safe place to
experiment with resident configuration before applying changes."
Genuinely isolated from the real conversation:

- **Its own conversation history**, entirely separate from
  `ResidentConversation.js`'s own — closed and reopened freely, cleared
  with its own button, never touching what Bubble itself remembers of
  actual conversations.
- **Never calls `residentBehaviour.triggerEmotion()`/`setThinking()`** —
  a sandbox test never causes Bubble's actual presence in the room to
  react, turn, or show a thinking expression.
- **Never writes to `ConversationMemory`** — a test message is never
  scanned for a project mention, preference, or goal the way a real
  message would be. "Memory Inspection" is read-only: the Sandbox shows
  `ConversationMemory.mostRelevant()` so a person can see what's currently
  remembered, without a test message ever adding to it.
- **Never consumes a curiosity note** — `ResidentCuriosity.gatherNotes()`
  is called with `mutate: false` for the Sandbox specifically, so
  previewing "what would Bubble currently notice" never causes the real
  next conversation to miss out on a "something new was built" note it
  would otherwise have gotten.
- **The system prompt is built identically to a real conversation's** —
  same `PromptComposer.composeSystemPrompt()`, same
  `ResidentContext.buildConversationContext()` — so a test here is an
  honest preview of how a setting change actually reads, not an
  approximation of one.

Requires `residentConnection` to be available; shows a plain note if it
isn't (there's always a real one wired in the Workshop itself, but the
sandbox stays honest about the dependency regardless).

## Resident Health

"Mission Control should begin displaying useful information about
Bubble... resident status, connected model, provider, latency, current
activity, current mood, memory status, current location. Please keep
this calm and informative. Avoid making it feel like a developer
debugging tool." A plain, read-only grid, refreshed automatically every
ten seconds (matching `AIConnectionManager`'s own poll cadence) — skipped
entirely whenever a field in the form currently has focus, so it never
interrupts someone mid-sentence in the Sandbox or an identity field.
Every value is something a person would actually want to know, phrased
in plain language ("Going about its day," not "idle"; "Waiting quietly,"
not "disconnected") rather than a raw internal state name.

## Profiles

"Please introduce resident profiles. The player should be able to save
and load complete resident configurations... Identity, Personality,
Behaviour, Memory configuration, Embodiment, Conversation settings." This
already existed as of the very first Mission Control phase — Create,
Duplicate, Rename, Delete, and switching which one is active are all
`ResidentProfileStore` exposes, with no separate "Save" action anywhere,
matching how every other editing surface in the Workshop applies changes
immediately. This phase's own addition is presentational: each profile in
the list now shows a one-line, at-a-glance summary underneath its name
(selected traits, and its embodiment shape if it's not the default
Floating Orb) — "review the overall application layout and ensure it
feels cohesive, welcoming" made concrete as the smallest change that
actually helps a profile read as *someone*, not a row in a list.

Always at least one profile — a fresh Workshop seeds one named "Workshop
Resident," and `remove()` refuses to delete the last remaining one.

**Export/Import (Workshop Workflow phase)** — "AI Profile Export. AI
Profile Import. Profile sharing." Each profile row gained an "Export"
button (`ResidentProfileStore.exportProfile()`, a small self-contained
JSON file — `{type: "workshop-ai-profile", version, profile}`) and the
Profiles section gained an "Import Profile…" button
(`importProfile()`). Genuinely shareable — nothing about the exported
file references anything else in a specific Workshop's own save data, so
it means exactly as much on a different computer as this one. Import is
validated and normalised the same way loading a whole-Workshop backup
already normalises every profile inside it (see `ResidentProfileStore
.load()`), and always creates a *new* profile rather than overwriting
anything by id — sharing a profile with someone, or with your own future
self, never risks clobbering whatever's already there. See
`docs/PERSISTENCE.md`'s own "Import & Export" section for how this
relates to the separate whole-Workshop backup.

## Connection Testing

Unchanged — one button, one fixed prompt ("Hello."), one response shown
inline, no conversation history. Distinct from the new Resident Sandbox
above: this is purely "is the connection itself working," the Sandbox is
"how does this specific configuration actually behave in conversation."

## Status Card

The active profile's own name, the current connection status, and one
calm, honest follow-up line — "Embodied as Bubble... its appearance and
traits above are already reflected there" once connected, since that's
been true since the previous phase.

## Mission Control Integration

"Please ensure every major Mission Control setting now has a meaningful
effect within Bubble. Avoid placeholder configuration where possible." A
complete account, section by section:

- **Provider** — genuinely read; only Ollama is functional, every other
  choice says so honestly rather than pretending to connect.
- **Resident Identity / Intelligence** — already fully active as of
  earlier phases (system prompt + real generation parameters).
- **Resident Traits** — active as of the previous phase (movement,
  awareness, idle-location weighting, a system-prompt line).
- **Behaviour dials** *(new)* — active: movement pace, motion damping,
  awareness, idle-location weighting, and a system-prompt style line, all
  combined with traits by `ResidentContext.getPersonalityModifiers()`.
- **Memory mode** — active as of the previous phase. **Memory
  categories and lifetimes** *(new)* — both genuinely active; see
  "Memory" above.
- **Embodiment** — fully active as of the previous phase.
- **Resident Sandbox / Resident Health** *(new)* — not profile settings
  themselves, but the two places this phase adds for *seeing* that
  everything above is genuinely connected, rather than taking it on
  faith.
- **Memory size / summaries / context budget** remain the one honestly
  inert corner — real fields, real defaults, no storage limit or
  summarisation behind them yet.

## Future extension points

- **True cross-session memory**, implementing `MemoryConfiguration.js`'s
  own "Persistent" mode for real — see docs/RESIDENT.md's own
  "Conversation Memory" section for exactly what's already in place to
  build this on.
- **Real additional providers** — LM Studio and Custom Endpoint (both
  typically OpenAI-compatible local/self-hosted APIs) are the more
  tractable next step; OpenAI/Anthropic would additionally need real
  credential handling, which touches this project's own
  prohibited-actions list around entering API keys and deserves its own
  careful design pass rather than being rushed in alongside this one.
- **Per-category memory lifetimes**, rather than each category defaulting
  to one fixed tier — the seam (`CATEGORY_LIFETIMES`) is already a plain
  map keyed by category id, ready for a future per-category selector.
- **Multiple residents, resident relationships, shared memories, resident
  collaboration** — `ResidentPreferences`/`PlayerPatternMemory`/
  `ConversationMemory` are all written against a resident/profile
  instance rather than assuming a singleton (see docs/RESIDENT.md's own
  "Future extension points"), which is what would make this tractable.
- **Advanced embodiment** — a truly custom shape (an imported model,
  perhaps reusing `ModelLoader.js` the way Beings already do) for the
  `custom` embodiment type, which currently honestly falls back to the
  same sphere `floatingOrb` uses.
- **Workshop Host integration** — a locally-hosted resident could
  eventually be launched or managed through `workshop://host`'s own future
  pages (see `docs/BROWSER.md`), with Mission Control remaining the place
  its personality and behaviour are configured either way.
