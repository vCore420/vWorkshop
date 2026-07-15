# Diagnostics (Version 2, Phase 14)

"Not a traditional developer debug menu... a Workshop Control Centre.
The Workshop should be capable of monitoring, explaining and diagnosing
its own health. The player should no longer need to rely on browser
developer tools to understand what the Workshop is doing."

`workshop://diagnostics` is that Control Centre. Everything on this page
is real, computed live from actual Workshop state — see
`DiagnosticsService.js`'s own top comment for why nothing here is ever
invented or hardcoded.

## Workshop Health

"Health should be calculated using the current state of each subsystem
rather than being manually assigned." Every subsystem section in
`DiagnosticsService.getReport()` computes its own `health` — one of
`healthy` / `warning` / `error` / `unavailable` (`HEALTH_LEVELS`) — from
a real check, never a hardcoded value:

- **Persistence** is `error` only if the *last* save attempt genuinely
  failed and hasn't succeeded since (`PersistenceSystem`'s own new
  `lastSaveFailedAt`, compared against `lastSavedAt`) — otherwise
  `healthy`.
- **AI Connection** and **Workshop Host Companion** are `healthy` when
  actually connected, `warning` while connecting, and — deliberately —
  `unavailable`, not `error`, when disconnected. Neither is required for
  the Workshop to work; a missing optional connection shouldn't read as
  broken.
- **Plugin System** is `error` if any plugin's own `PluginManager`
  status is `"error"` (see `docs/PLUGIN_SDK.md`), `healthy` otherwise.
- **Shared Asset Library** is `warning` if `AssetService.validateAll()`
  finds any genuinely broken dependency reference or same-kind/
  same-name duplicate, `healthy` otherwise.
- **Resident System** and **Workshop Host** are `healthy` whenever
  they're genuinely present and answering, `unavailable` if not.

**The overall banner is the worst of all of them — with one deliberate
exception.** `unavailable` never drags the *overall* colour down on its
own (see `_worse()`'s own comment in `DiagnosticsService.js`) — a
Workshop with Ollama simply not running should still show green
overall, since that's an expected, normal state for anyone not using
the optional local-AI feature, not a problem.

## Service Monitoring

`HostManager.getOverviewStatus()` already collects `{name, available,
summary}` from every registered Host service's own `getStatus()` — this
phase didn't need to reinvent that, only build health levels and a real
UI on top of it. Every store this project has built across every phase
that carries a `getStatus()` (Plugin Permissions, Plugin Storage,
Atmosphere Profiles, Expression Sets, the Workshop Event Log, and more)
already shows up here automatically the moment it's registered — "the
Workshop should understand the status of every major subsystem" is true
by construction, not something each new system has to opt into
specially.

`host://services` remains the plain capability directory (what exists,
is it available) — `workshop://diagnostics` is the health-aware Control
Centre built on top of the same data. Deliberately two different views
of the same real information, not two competing ones — see "Known
simplifications" below for why they weren't merged into one page.

## Performance

`Engine.js` already emitted `"engine:performanceSample"` (FPS, frame
time) once a second before this phase — genuinely live, sampled from
the real render loop, shown both in Settings' own Diagnostics tab
(right next to the Graphics/Performance controls that actually affect
it) and folded into `DiagnosticsService`'s own report. This phase added
**memory** — `performance.memory` (JS heap size), a real, Chrome-only
browser API, reported honestly where available and `null` — never a
fabricated number — everywhere else.

**CPU usage, GPU usage, and network activity have no standard, reliable
browser API to read them from at all**, and were left out entirely
rather than approximated with something misleading. "The goal is
understanding Workshop performance rather than simply displaying
numbers" — a plausible-looking fake number would actively work against
that goal, not serve it.

## AI Diagnostics

"Connected provider. Current model. Connection status. Response time.
Last successful response. Last failure." `AIConnectionManager.js`
gained `lastSuccessAt`/`lastFailureAt` (two plain timestamps, updated at
the exact same point `lastLatencyMs` already was) alongside its existing
`status`/`lastLatencyMs`. Current model/provider, queue size, and
per-conversation context size all already live on the active resident
profile and in `AIApp.js` itself — `workshop://diagnostics`' own AI
Connection section points there for that detail rather than duplicating
it, the same "one real place, not two copies" instinct the rest of this
phase holds itself to. **VRAM usage has no browser API at all** — Ollama
runs as a separate local process the browser has no visibility into;
honestly out of reach, not attempted.

## Resident Diagnostics

"Current behaviour. Current mood. Current task. Conversation state.
Navigation state. Idle state." `ResidentController.getDiagnostics()` —
one flat object gathering what already lives across
`ResidentBehaviour`/`ResidentState`/`ResidentConnection`/
`ResidentMovement`/the active profile, the identical "nothing new
computed, just gathered" shape `WorldAwareness.snapshot()` already
established. "Future residents should naturally inherit this
architecture" is true the same way `WorldAwareness` already is — a
second `ResidentController` instance would return the same shape from
the same method, nothing here assumes there's only ever one.

## Plugin Diagnostics

Already substantially real since the Plugin SDK phase — `PluginService
.listAll()` already carries manifest metadata, live status
(`active`/`disabled`/`error`), and per-plugin permissions. This phase's
own addition: **`PluginManager._safeCall()` now emits a real
`"plugin:error"` event** the moment any plugin's own code throws,
picked up by the new `WorkshopEventLog` — a plugin failure is no longer
something you'd only notice by opening `host://plugins` and happening to
look; it's a real, timestamped entry in the Workshop's own Event Log,
and the exact plugin/error is named directly in `workshop://diagnostics`'
own Suggested Fixes when it's the reason the Plugin System's own health
isn't green.

## Asset Diagnostics

"Missing references... validation failures... duplicate assets."
`AssetService.validateAll()` — every asset across every kind, in one
pass, but deliberately narrower than "every issue `validate()` would
report for anything." A missing thumbnail is real (`validate()` still
flags it for one specific asset) but isn't a *health* problem — nearly
every asset in the Workshop honestly has no thumbnail at all (see
`docs/ASSETS.md`'s own "Thumbnails" section), and counting every one of
them as a "failure" would make the Library's overall health look
alarming for something that was never broken, just unfinished-looking.
Only genuinely broken dependency references, and same-kind/same-name
duplicates, count toward health and appear in `workshop://diagnostics`'
own Asset Library section.

## Event Log

"Resident events. Plugin events. Host events. AI events. Persistence
events... a chronological history of Workshop activity... filtering,
searching, exporting." Two separate logs, not one merged store:

- **`WorldEventLog.js`** (Living World phase, unchanged) — ambient,
  world-flavoured (weather, sunrise, a song starting), feeding Bubble's
  own curiosity.
- **`WorkshopEventLog.js`** (new this phase) — technical: plugin
  errors, AI/Host connection changes, save failures. Bounded at 150
  entries, with real `filter({level, type})` and `search(query)`
  methods and a genuine `exportLog()` (the same `type`-tagged,
  `StorageUtils.downloadJSON()` shape every other export in the
  Workshop already uses — see `docs/PERSISTENCE.md`'s own "Import &
  Export" section).

Kept deliberately separate — recording technical events into
`WorldEventLog` would mean either polluting Bubble's own conversational
context with irrelevant system noise, or teaching that file to filter
itself back out again, more complexity either way than two logs with
two honestly different audiences. `workshop://diagnostics`' own "Recent
Activity" section merges both for *display* only (most-recent-first,
colour-coded by severity), never for storage — see
`WorkshopEventLog.js`'s own top comment.

## Health Reports

"Allow the Workshop to perform self-checks... produce a readable health
report." `getReport()` is already a live computation, never a cache —
but two of its sections (AI Connection, Host Companion) only update on
their own slow background poll between calls. "Run Workshop Health
Check" (`DiagnosticsService.runHealthCheck()`) actively re-checks both
*right now* (`checkConnection()` on each) before rebuilding the report,
so the button means something genuinely fresh, not just "read whatever
was already known a few seconds ago."

There's no separate "report" document format beyond the page itself —
`workshop://diagnostics`, read top to bottom, already *is* the readable
summary the brief asks for: one overall line, one line per subsystem,
suggested fixes where relevant, deeper detail behind a click. A future
phase could add a literal exportable report (see "Future extension
points"); today, reading the page is the report.

## Suggested Fixes

"Where possible, diagnostics should provide guidance rather than simply
reporting failures." Every unhealthy section in `getReport()` can carry
a `suggestion` — a specific, actionable sentence, computed alongside
that section's own health level rather than a generic lookup table
disconnected from the real state:

- AI Connection unavailable → points at `docs/SETUP.md` and the
  PowerShell launcher script by name.
- A plugin in `"error"` state → names the exact plugin and its own
  error message, and points at `host://plugins`.
- A broken asset reference → names the exact asset and suggests
  reimporting or removing whatever still points to it.
- A failed save → explains the likely cause (storage quota, private
  browsing) and suggests exporting a backup.

Every suggestion in the current report — not just the first one — is
collected into `workshop://diagnostics`' own "Suggested next steps"
panel, shown directly under the overall health banner, before anyone
has to go looking for what's wrong.

## Dependency Awareness

"Where appropriate, diagnostics should understand relationships between
Workshop systems." `DEPENDENCIES`, in `DiagnosticsService.js` — a
small, honest, hand-authored list (Browser → Workshop Host, Mission
Control → AI Providers, Residents → Mission Control, Plugins →
Registered Services, Builder → Shared Asset Library, Phone → Workshop
Host), each with a plain-language reason. Not derived automatically —
nothing in this project tracks a real import graph at runtime, and
building one would be a substantial undertaking for a benefit this
small, static list already delivers. Shown as its own collapsed
`<details>` section at the bottom of the Control Centre — genuinely
useful for understanding *why* one problem might cause another (Ollama
being down is *why* Mission Control shows no replies), not something a
casual user needs to see by default.

## User Experience: progressive disclosure

"A casual user should immediately understand whether the Workshop is
healthy. An advanced user should be capable of expanding sections."
`workshop://diagnostics` is one page, not two: a single colour-coded
banner and a one-line-per-subsystem summary at the top, always visible;
every subsystem's own deeper technical detail sits inside a native
HTML `<details>` element — closed by default, one click to open, no
JavaScript required to make that work at all. The exact same page
serves both audiences the brief describes, by construction, rather than
maintaining a "simple" and an "advanced" view that could drift apart.

## Known simplifications (by design, for this phase)

- **`host://services` and `workshop://diagnostics` stay two separate
  pages** — the first a plain capability directory (what exists),
  the second the health-aware Control Centre built on top of the exact
  same underlying data. Merging them was considered and rejected: they
  serve genuinely different moments (browsing what's available, versus
  understanding whether something's wrong), and forcing one into the
  other would make the common case — "is everything okay?" — slower to
  read for the sake of a rarer one.
- **No CPU/GPU/network monitoring** — no reliable browser API exists
  for any of the three; see "Performance" above.
- **No VRAM reporting** — Ollama is a separate local process the
  browser has no visibility into; see "AI Diagnostics" above.
- **Health Reports are the page itself, not a separate exportable
  document** — see "Health Reports" above.
- **Dependency Awareness is a static, hand-authored list**, not a real
  dependency graph — see that section above.
- **The Engine section (system class names, engine plugin count)
  dropped from the visible page** — real data, still computed in
  `getReport().engine`, just not shown; the least actionable of every
  section this phase reviewed; a raw list of class names doesn't help
  a casual *or* an advanced user "understand what the Workshop is
  doing" the way everything else on the page does.

## Future extension points

- **A literal exportable Health Report document** (a formatted summary,
  not just the raw event log export) — `getReport()` already returns
  everything a future "Export Health Report" button would need.
- **A real plugin dependency graph**, once plugins can declare
  dependencies on each other at all (see `docs/PLUGIN_SDK.md`'s own
  "Future extension points" — `manifest.dependencies` doesn't exist
  yet).
- **Historical health tracking** — the Workshop Event Log already
  records *transitions* (a connection changing state, a plugin
  erroring); a future phase could chart health over a session rather
  than only ever showing the current instant.
- **CPU/GPU monitoring**, if and when a reliable, honest browser API
  for either exists — not invented here specifically because none does
  today.
