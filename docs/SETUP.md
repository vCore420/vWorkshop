# Setup Guide

Everything needed to go from "just cloned this" to "fully running,
including a real local AI resident" — the Workshop works completely
without any of the optional sections below, but this is where to come
back to once you want them.

## Running the Workshop itself

The Workshop is plain ES modules with no build step — it just needs to
be served over HTTP (browsers block module imports from a bare `file://`
URL). Any static file server works:

```bash
git clone <this repo>
cd workshop
python3 -m http.server 8000   # or: npx serve .
```

Open the printed local URL, click **Step inside**, and you're in. That's
the entire setup for using the Workshop itself — everything from here
down is optional.

**Deploying it somewhere permanent**: push the repository and point
GitHub Pages (or any other static host) at its root — there's nothing to
build, no compilation step either way.

**Installing it as an app**: open it in a browser tab and use the
browser's own "Install app" / "Add to Home Screen" prompt. It opens in
its own window afterward and works offline after the first successful
visit (Three.js itself loads from a CDN, so that very first visit still
needs a connection).

## Optional: talking to Bubble with a real local AI

Bubble, and AI Mission Control on the computer, can talk to a real
language model running entirely on your own machine through
[Ollama](https://ollama.com) — nothing is sent anywhere else, and
nothing about this is required for the rest of the Workshop to work.

### 1. Install Ollama

Download it from [ollama.com](https://ollama.com) for your platform
(Windows, macOS, or Linux) and run the installer. No account, no sign-in
— it's a local program that runs a local server on your own machine.

### 2. Pull a model

```bash
ollama pull llama3.2
```

This downloads the model's own weights to your machine once; after
that, running it doesn't need a network connection either.

**Recommended models**, roughly smallest/fastest to largest/most
capable — pick based on how much RAM your machine has free and how
patient you want to be waiting for a reply, not a strict quality
ranking:

| Model | A reasonable choice if... |
|---|---|
| `llama3.2` (3B) | You want something that replies quickly on modest hardware, or you're just trying this out for the first time. |
| `phi3` / `gemma2` | Similar territory to `llama3.2` — worth trying if one feels more natural for how you want Bubble to talk. |
| `mistral` (7B) | You have 8GB+ RAM to spare and want noticeably more capable responses, at a real but tolerable speed cost. |
| `llama3.1` (8B) or larger | You have a reasonably capable machine (dedicated GPU, or 16GB+ RAM) and want the best local reply quality Ollama can give you. |

Any model Ollama supports will work — AI Mission Control's own "Refresh
Models" reads whatever you've pulled directly from Ollama, nothing is
hardcoded to a specific list. If a reply feels slow, that's almost
always the model itself being large for your hardware, not the Workshop
— a smaller model is the fix, not a setting anywhere in the Workshop.

### 3. Start Ollama so the Workshop can actually reach it

This is the one genuinely non-obvious step. Ollama's own default
security policy (CORS) only allows requests from a small set of origins,
and a browser tab running the Workshop isn't one of them — without
fixing this, AI Mission Control will show "disconnected" even though
Ollama is running perfectly normally. This isn't a Workshop bug; it's
Ollama correctly refusing an origin it doesn't recognise until you tell
it to allow one.

**Windows**: run the included launcher script — `start-ollama-for-workshop.ps1`,
in this repository's own root folder. Either right-click it and choose
"Run with PowerShell," or open a PowerShell window in this folder and
run:

```powershell
.\start-ollama-for-workshop.ps1
```

Leave that window open while you use the Workshop; closing it stops
Ollama. The script itself only sets `OLLAMA_ORIGINS` for that one
session (never your permanent environment) and then runs `ollama serve`
— read the comments at the top of the script for exactly what origins it
allows and why. If PowerShell refuses to run it at all ("running scripts
is disabled on this system"), that's Windows' own script-execution
policy, not a problem with the script — open PowerShell as Administrator
once and run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then
try again.

**macOS/Linux**: the equivalent one-liner, from a terminal:

```bash
OLLAMA_ORIGINS="*" ollama serve
```

Leave that terminal open the same way. If Ollama is already running as a
background service (common on macOS, since the Ollama app starts it
automatically), stop that first or it'll conflict with a manually
started `ollama serve` on the same port.

### 4. Connect

Open the Workshop, sit at the computer, open **AI Control**, and it
should show "Connected" within a few seconds. If a resident's own reply
seems to hang the first time, that's normal — Ollama loads a model's own
weights from disk into memory the first time it's used each session,
which can take a while on modest hardware; every reply after that first
one is much faster.

## How Workshop Host talks to Ollama

Two entirely independent local connections exist, easy to conflate but
worth keeping straight:

- **`AIConnectionManager.js`** talks directly to Ollama's own API
  (`http://localhost:11434` by default) for everything AI Mission
  Control and Bubble actually do — listing models, sending prompts,
  reading replies. This is the connection everything above sets up.
- **The Workshop Host Companion** (see `host-companion/README.md`) is a
  completely separate, optional local program handling a different
  concern entirely — letting the Workshop's own Browser read local
  folder listings (`host://` pages, file-related capabilities). It has
  nothing to do with Ollama and isn't required for AI Mission Control or
  Bubble to work.

Both follow the identical pattern: a calm, never-alarming background
poll (`AIConnectionManager` polling Ollama, `HostConnectionManager`
polling the Companion) that simply treats "nothing answered" as
"currently unavailable" rather than surfacing a scary error — closing
either one, or never starting it, always leaves the rest of the Workshop
working exactly as it would otherwise. See `docs/AI.md` and
`docs/HOST.md` for the full architecture of each.

## Troubleshooting

**AI Mission Control shows "disconnected" and won't connect.**
1. Is Ollama actually running? A plain `ollama serve` in a terminal
   (without `OLLAMA_ORIGINS` set) will still show as "disconnected" here
   — that's the CORS issue above, not Ollama being down. Use the
   launcher script or the `OLLAMA_ORIGINS="*"` command above instead.
2. Did you pull at least one model (`ollama pull llama3.2`)? Ollama can
   be running with zero models downloaded, which connects fine but shows
   an empty model list.
3. Check what port Ollama's actually listening on — the default is
   `11434`; if something else on your machine is already using that
   port, Ollama may have failed to start silently. Check the terminal
   window you started it from for its own error output.

**A reply from Bubble/AI Mission Control never arrives, or takes a very
long time.** Almost always the model itself loading for the first time
in that session (see "Connect" above) or being large for your hardware —
wait a minute on the very first message, and if replies stay slow after
that, try a smaller model from the table above.

**PowerShell won't run `start-ollama-for-workshop.ps1` at all.** Windows'
own script-execution policy, not the script itself — see step 3 above
for the one-time fix.

**The Workshop Host Companion won't connect from `host://services`.**
Confirm it's actually running (`node workshop-host-companion.js` from
`host-companion/`, or one of its own `start.sh`/`start.ps1` launchers)
and that the **Filesystem** permission is granted at `host://services` —
a running, reachable Companion alone isn't enough; the permission is a
separate, deliberate opt-in. See `host-companion/README.md` for the full
account, including exactly what the Companion can and can't do.

**I imported a Workshop backup and something looks wrong.** Check the
Workshop's own console for a specific message — `PersistenceSystem
.importBackup()` gives a clear reason for anything it refuses (not a
Workshop file at all, a different kind of Workshop export, or a backup
newer than the Workshop version you're running). See "Import/Export" in
`docs/PERSISTENCE.md`.

## Where to go next

- `docs/ARCHITECTURE.md` — how the whole project fits together.
- `docs/AI.md` — the full AI Mission Control / Bubble architecture.
- `docs/HOST.md` — the Workshop Host Companion and every Host service.
- `docs/HISTORY.md` — the Workshop's own development history, phase by
  phase, moved out of the README to keep that page focused on actually
  using the Workshop.
