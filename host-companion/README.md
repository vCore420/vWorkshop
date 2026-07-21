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
node workshop-host-companion.js [workspace-folder] [programs-config.json]
```

`workspace-folder` is optional and defaults to whatever folder you ran
the command from. It's the **one folder** this Companion will ever list,
read from, or write to — see "What this actually does" below.
`programs-config.json` is also optional — pass it only if you want to be
able to launch a program from the Workshop; see "Launching a configured
program" below for its format. No second argument means launching stays
entirely unavailable, the same "off unless you deliberately set it up"
default this Companion uses everywhere.

Two tiny launcher scripts are included if you'd rather double-click than
type a command — `start.sh` (macOS/Linux) and `start.ps1` (Windows
PowerShell). Both just run the line above with no arguments (folder
listing/reading/writing only, no programs configured).

Once it's running, you'll see:

```
Workshop Host Companion 0.3.0-preview
Listening on http://localhost:7777
Workspace root: /path/you/chose
Pairing token (enter this at host://permissions to read/edit files or launch programs): 3f9a1c...
Programs configured to launch: Notepad, Open in VS Code (from /path/to/programs-config.json)
Press Ctrl+C to stop.
```

(That last line reads differently if you didn't pass a programs config,
or if the one you passed didn't load — see "Launching a configured
program" below.)

That pairing token is what `host://permissions`' own "Companion Pairing"
section asks for — copy it from here, once, and the Workshop remembers it
in memory for the rest of the session (see "Reading and writing one file"
below for why it's never saved anywhere). It changes every time you
restart the Companion — the same token gates both file writes and
launching a program.

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
listing folders for real once **Filesystem Read** is granted at
`host://permissions`, and reading/saving individual files once
**Filesystem Write** is granted *and* the Companion has been paired (see
"Reading and writing one file" below); `src/host/ProgramsService.js`
starts listing and launching whatever's in your programs config once
**Launch Applications** is granted *and* the Companion is paired (see
"Launching a configured program" below) — a reachable Companion alone is
not enough for any of it.

## What this actually does — and, deliberately, does not

Six endpoints exist:

- **`GET /status`** — `{ running, version, platform, workspaceRoot }`.
  Reveals nothing about your files.
- **`GET /files?path=...`** — lists the *names, sizes, and modified
  times* of whatever's inside `path` (relative to the workspace folder
  you chose at startup). Never file *contents*. Never a path outside
  that one folder — this is checked and rejected, not just discouraged
  (see the source's own `resolveWithinWorkspace()`).
- **`GET /file?path=...`** — reads one file's actual *contents*, as text.
  Requires the pairing header/token described below.
- **`PUT /file?path=...`** — writes (creating if new, overwriting if not)
  one file's contents, given as JSON. Also requires the pairing
  header/token.
- **`GET /programs`** — lists the programs *you* configured in your own
  `programs-config.json` (id, name, icon — never the real command).
  Requires the pairing header/token.
- **`POST /launch`** — launches one of those configured programs by id.
  Also requires the pairing header/token. See "Launching a configured
  program" below — read that before setting this up, not just this list.

The four gated endpoints are covered in their own sections below, since
they need more explaining than `/status`/`/files` did. **Creating an
empty file, renaming, copying, moving, deleting anything, or stopping/
monitoring a launched program** all remain honestly unimplemented — in
the Workshop's own `FilesService.js`/`ProgramsService.js` *and* in this
Companion itself — even once it's running, reachable, and paired. This
isn't an oversight or a "phase two" placeholder; it's a considered
decision, explained next.

## Reading and writing one file — why it needed more than origin-checking

`GET /files` (a listing) stays safe under the same reasoning as before:
even if a disallowed origin's request reached the server, the Companion's
CORS headers mean that origin can't *read the response* — the realistic
worst case is "a website learned the names of some files," not an actual
leak. Reading a file's *contents*, and especially writing them, don't fit
that reasoning as comfortably — a page's blind request could still cause
something to happen server-side even if it could never read the result,
which matters a great deal more once "something" is "overwrite a real
file" than it ever did for "list some names."

So `GET /file` and `PUT /file` both require two things neither `/status`
nor `/files` needs:

1. **A custom `X-Workshop-Host-Token` header.** Setting a custom header on
   a cross-origin request forces the browser to send a CORS preflight
   (`OPTIONS`) first — unlike a plain `GET` or a simple `POST`, which the
   browser will just send. A disallowed origin's preflight gets refused,
   and the browser never sends the real request at all. This is what
   actually blocks the request itself, not merely its response.
2. **The token's own value.** A random token, printed once to this
   process's own terminal when it starts (`node
   workshop-host-companion.js`'s own console output), held only in
   memory — never written to disk, and gone the moment the process
   restarts. Enter it once at `host://permissions` in the Workshop
   ("Companion Pairing") to use it; if the Companion restarts, its token
   changes and needs re-entering.

Both are required together, deliberately: the header alone stops a
*different site* from triggering a request the Workshop's own code didn't
intend, and the token alone stops a request that *did* clear the header
check from succeeding without the value only this Companion's own
terminal ever shows. `docs/HOST.md`'s own "Permissions" section covers
the Workshop side (`filesystem-read`/`filesystem-write`, checked before
either endpoint is ever called).

Both new endpoints also stay **text-only** (a NUL-byte heuristic rejects
anything that looks like a binary file) and capped at **2 MB per file** —
a bridge for source files, notes, and config, not a general-purpose file
transfer or a way to read something like an image or a saved model.

## Launching a configured program

Please read this section in full before creating a programs config, not
just the example below — what you're actually trusting when you add an
entry is easy to get wrong by skimming.

**The core safety property.** The Workshop's own Browser can never send
this Companion a command or a path to execute. It can only reference a
program you configured, by the `id` you gave it, and — only if you
declared that program willing to accept one — a value for one of its own
named argument slots, which this Companion validates itself before
spawning anything. You, running this Companion, are the only source of
truth for what `command` actually runs and what its base `args` are;
neither of those ever appears in any response this Companion sends back
to the browser.

**The config file** — pass its path as this Companion's second
command-line argument. Loaded once at startup; editing it while the
Companion is running has no effect until you restart. A single bad entry
is skipped (with a warning printed to this terminal) rather than
crashing the whole file — the rest of your config still loads.

```json
{
  "programs": [
    {
      "id": "notepad",
      "name": "Notepad",
      "command": "notepad.exe",
      "args": []
    },
    {
      "id": "vscode-open",
      "name": "Open in VS Code",
      "command": "code",
      "args": [],
      "acceptsArgs": [
        { "name": "file", "type": "workspacePath", "required": true, "argTemplate": ["{value}"] }
      ]
    }
  ]
}
```

- **`id`** — what the Workshop references when it asks to launch this.
  Yours to choose; must be unique in the file.
- **`name`** — the label shown in the Workshop's own `host://applications`
  page. Never treated as a command.
- **`command`**/**`args`** — the actual program and its fixed arguments,
  exactly as you'd type them yourself. **Never sent to the browser.**
  Spawned with Node's own `child_process.spawn(command, args, {shell:
  false})` — passed as a real argv array, not built into a shell command
  line, which is what keeps a value later substituted into `args`
  (below) from ever being interpreted as shell syntax, regardless of what
  characters it contains.
- **`acceptsArgs`** *(optional)* — the only way the browser can ever
  influence what's actually run, and only in a way you explicitly
  declared. Each entry:
  - **`name`** — what the Workshop's own request must call this value.
  - **`type`** — exactly one of two validators this Companion itself
    enforces, nothing free-form:
    - **`"workspacePath"`** — the supplied value must resolve (via the
      identical `resolveWithinWorkspace()` check `/files`/`/file` already
      use) to a file that actually exists inside your workspace folder.
      The *resolved, absolute* path is what gets substituted — the
      launched program has no reason to share this Companion's own
      working directory.
    - **`"enum"`** — the value must exactly match one entry in a `values`
      list you provide on the slot itself. No prefix matching, no
      case-insensitivity.
  - **`required`** — if `true` and the Workshop's request doesn't supply
    this slot, the whole launch is rejected rather than run with it
    silently missing.
  - **`argTemplate`** — where the validated value actually lands in the
    final command line, e.g. `["{value}"]` or `["--open", "{value}"]`.
    `{value}` must appear somewhere in it.

A launch request supplying a key `acceptsArgs` doesn't declare, missing a
`required` slot, or a value that fails its own declared validator is
rejected outright — nothing is spawned on a partial or best-effort basis.

**Why no free-form text argument type exists yet.** A validator that just
checks "is this a string" would let the browser influence the launched
command's own argument parsing in ways this Companion can't reason about
in general (a flag that changes dangerous behaviour, for instance) — see
`docs/HOST.md`'s own "Future extension points" for this named as a
deliberately deferred capability, not an oversight. If a program you want
to launch needs something neither `workspacePath` nor `enum` can express
safely, don't declare `acceptsArgs` for it — it'll still launch, just
always with exactly the fixed `args` you gave it.

**Same pairing bar as file writes, not a lighter one.** `GET /programs`
and `POST /launch` both require the identical `X-Workshop-Host-Token`
header and token value `PUT /file` does — see "Reading and writing one
file" above for the full CSRF reasoning. Merely *seeing* what's
configured needs pairing here too, unlike `/files`' lighter bar for a
plain folder listing.

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
of the Workshop somewhere else). Combined with `/status`/`/files` being
read-only, metadata-only, and confined to one folder you explicitly
chose, the realistic worst case of a stray request reaching those two
endpoints from somewhere unintended is "a website learned the names of
some files in one folder you picked" — not nothing, but a long way from
"a website read my documents." `/file`'s own read and write, and
`/programs`/`/launch`, all additionally require the pairing header and
token described above, precisely because reading/changing file contents
or launching a program don't fit that same "worst case" reasoning.
Launching a program carries one further, deliberate boundary beyond the
pairing bar: *what* gets launched is entirely your own choice, made once,
in a config file only you control — see "Launching a configured program"
above if you haven't read it yet.

Run this the same way you'd run any small local development tool: on
your own machine, from a copy of this repository you trust, pointed at a
folder you're comfortable listing, reading, and — once you've paired it —
editing, with only the programs *you* configured launchable at all. Stop
it when you're not actively using it if you'd rather not leave it running
in the background; restarting it later prints a fresh pairing token, so
re-enter that at `host://permissions` when you do.

## If you're extending this

Please read this file's own reasoning above before adding a new endpoint,
not just the code. `docs/HOST.md`'s own "Workshop Host Companion" section
has the fuller architectural picture — how this fits alongside
`HostConnectionManager.js`, `PermissionsService.js`, `ProgramsService.js`,
and the rest of `src/host/` — and is worth reading first. If you're
adding a new `acceptsArgs` validator type in particular, read "Why no
free-form text argument type exists yet" above before doing so — the
gap is deliberate, not an oversight to casually close.
