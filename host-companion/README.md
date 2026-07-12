# Workshop Host Companion

A small, optional, local program that runs on your own computer alongside
the Workshop — separate from the Workshop itself, not required for the
Workshop to work, and not started automatically by anything.

## Why this exists

The Workshop runs entirely as JavaScript inside a browser tab. A browser
tab cannot read your files, list your folders, or launch programs on
your computer — not because the Workshop chooses not to, but because no
web page anywhere can, by design, for your own safety. `docs/HOST.md`
calls this "the Workshop Host": an architecture for a local companion
that *can* do those things safely, which the Workshop's own Browser talks
to the same way it talks to a local Ollama server.

This is the first real, working piece of that companion — deliberately
small. It proves the idea end-to-end (a real local server, a real
Workshop-side connection manager polling it, real data flowing into a
real Host service) without building more surface area than can be
explained and trusted in one sitting.

## How to start it

You need [Node.js](https://nodejs.org) installed — nothing else. No
`npm install` step; this file only uses Node's own built-in modules.

```
node workshop-host-companion.js [workspace-folder]
```

`workspace-folder` is optional and defaults to whatever folder you ran
the command from. It's the **one folder** this Companion will ever list
the contents of — see "What this actually does" below.

Two tiny launcher scripts are included if you'd rather double-click than
type a command — `start.sh` (macOS/Linux) and `start.ps1` (Windows
PowerShell). Both just run the line above with no folder argument.

Once it's running, you'll see:

```
Workshop Host Companion 0.1.0-prototype
Listening on http://localhost:7777
Workspace root: /path/you/chose
Press Ctrl+C to stop.
```

Leave that window open while you use the Workshop. Closing it (or
pressing Ctrl+C) stops the Companion — the Workshop notices within about
ten seconds and quietly goes back to treating everything Host-related as
unavailable, exactly as it did before you started this at all.

## How the Workshop finds it

`src/host/HostConnectionManager.js` polls `http://localhost:7777/status`
every ten seconds — the identical calm, never-blocking, never-alarming
pattern `src/ai/AIConnectionManager.js` already uses for Ollama (see
`docs/AI.md`). If nothing answers, the Workshop simply keeps treating
every Host capability as "not yet available," precisely as it always
has. If the Companion *is* running, `src/host/FilesService.js` starts
using it for real — but only once the **Filesystem** permission is
granted in `host://services` (see `docs/HOST.md`'s own "Permissions"
section); a reachable Companion alone is not enough.

## What this actually does — and, deliberately, does not

Two endpoints exist:

- **`GET /status`** — `{ running, version, platform, workspaceRoot }`.
  Reveals nothing about your files.
- **`GET /files?path=...`** — lists the *names, sizes, and modified
  times* of whatever's inside `path` (relative to the workspace folder
  you chose at startup). Never file *contents*. Never a path outside
  that one folder — this is checked and rejected, not just discouraged
  (see the source's own `resolveWithinWorkspace()`).

That's all. **Opening a file, launching a program, creating, renaming,
copying, moving, or deleting anything** all remain honestly unimplemented
— in the Workshop's own `FilesService.js`/`ProgramsService.js` *and* in
this Companion itself — even once it's running and reachable. This
isn't an oversight or a "phase two" placeholder; it's a considered
decision, explained next.

## A note on origins and security — please read this before running it

Any web page's JavaScript is allowed by every browser to send requests to
`http://localhost` — that's exactly what lets *the Workshop* reach this
Companion at all, wherever the Workshop itself happens to be hosted. It
also means, in principle, that *any other site you visit* while this
Companion is running could try to do the same, unless the Companion
itself refuses.

This Companion refuses politely by default: it only answers
cross-origin requests from `localhost`/`127.0.0.1` (any port) or a
`*.github.io` site (add more with the `WORKSHOP_HOST_COMPANION_ORIGINS`
environment variable, comma-separated, if you're hosting your own copy
of the Workshop somewhere else). Combined with the two endpoints being
read-only, metadata-only, and confined to one folder you explicitly
chose, the realistic worst case of a stray request reaching this
Companion from somewhere unintended is "a website learned the names of
some files in one folder you picked" — not nothing, but a long way from
"a website read my documents" or "a website ran a program on my
computer." Launching programs or reading file contents would meaningfully
change that calculation, which is exactly why neither exists here yet.

Run this the same way you'd run any small local development tool: on
your own machine, from a copy of this repository you trust, pointed at a
folder you're comfortable listing. Stop it when you're not actively using
it if you'd rather not leave it running in the background.

## If you're extending this

Please read this file's own reasoning above before adding a new endpoint,
not just the code. `docs/HOST.md`'s own "Workshop Host Companion" section
has the fuller architectural picture — how this fits alongside
`HostConnectionManager.js`, `PermissionsService.js`, and the rest of
`src/host/` — and is worth reading first.
