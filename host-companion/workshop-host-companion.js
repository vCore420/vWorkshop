#!/usr/bin/env node
/**
 * Workshop Host Companion
 * =========================
 * "Some capabilities requested during this phase cannot reasonably exist
 * inside a browser environment alone... please feel free to think beyond
 * JavaScript running in the browser where appropriate." This is that —
 * a small, real, optional local server, entirely separate from the
 * Workshop itself, that the Workshop's own `HostConnectionManager`
 * (`src/host/HostConnectionManager.js`) polls the exact same calm way
 * `AIConnectionManager` already polls Ollama.
 *
 * It is NOT part of the Workshop's own bundle, NOT started automatically
 * by anything, and NOT required for the Workshop to work — every Host
 * service already treats "the Companion isn't running" as the ordinary,
 * ~100%-of-the-time expected case, exactly like Ollama. Full account,
 * including *why* only these two endpoints exist and not more, lives in
 * this same folder's own README.md — read that before running this.
 *
 * Zero dependencies on purpose — only Node's own built-in modules
 * (`http`, `fs`, `path`, `url`), so running it is exactly
 * `node workshop-host-companion.js`, nothing to `npm install` first.
 *
 * ---- Deliberately minimal, deliberately safe ----
 * Two endpoints exist. That's not a phase-one slice of a bigger API
 * that ran out of time — it's the actual, considered scope for a
 * service that:
 *   (a) listens on a port any web page's own JavaScript can reach
 *       (browsers don't block a page from sending a request to
 *       `localhost` — that's exactly what lets the *Workshop* talk to
 *       this at all), and
 *   (b) would otherwise be a real, standing local attack surface the
 *       moment it could do anything more.
 * `GET /status` reveals nothing sensitive. `GET /files` reveals only
 * directory *listings* (names, sizes, timestamps — never file
 * contents) and only inside one folder chosen when the Companion is
 * started, with path traversal rejected outright. Deleting, renaming,
 * moving, copying — every one of those stays an honestly-thrown "not
 * implemented" in `src/host/FilesService.js`, even when the Companion is
 * reachable, until a real design exists for doing them safely from
 * something reachable by any browser tab.
 *
 * ---- Version 4, Phase 1 (v4.0.1): reading and writing one file ----
 * Two more endpoints now exist beyond status/listing: `GET /file` (read
 * one text file's contents) and `PUT /file` (write/overwrite one text
 * file's contents). Both reveal or change something meaningfully more
 * sensitive than a directory listing, so both require **two** things a
 * plain `GET /files` request never needed: a custom `X-Workshop-Host-
 * Token` header (which forces the browser to run a real CORS preflight
 * before ever sending the actual request — see `isAllowedOrigin()` below
 * for why that matters, not just origin-restricting the *response*) and
 * the token itself, printed once to this process's own terminal at
 * startup and never written to disk. See `README.md`'s own security
 * section for the full reasoning before extending this further.
 *
 * ---- Version 4, Phase v4.0.1b: launching a configured program ----
 * `GET /programs` and `POST /launch` — the capability every earlier
 * version of this comment named as deliberately deferred. The core
 * safety property: **the browser can never supply an arbitrary command
 * or path.** It can only reference a program by `id` from an allow-list
 * the person running the Companion configured themselves (an optional
 * JSON file, `process.argv[3]`, loaded once at startup — see
 * `loadProgramsConfig()`), and optionally supply values for *that
 * program's own pre-declared* argument slots (`acceptsArgs`), each
 * independently validated against one of exactly two fixed validator
 * types (`workspacePath` — reusing `resolveWithinWorkspace()` unchanged;
 * `enum` — exact match against a config-declared list) before anything
 * is spawned. Spawning always uses `child_process.spawn(command, argv,
 * {shell: false})` — args passed as a real argv array, never
 * concatenated into a shell string, which closes off shell-metacharacter
 * injection entirely regardless of what a validated value contains. Both
 * new endpoints require the same header+token pairing bar `PUT /file`
 * does — no lighter tier for merely *listing* what's configured, unlike
 * the read/write split above. See `README.md`'s own "Launching a
 * configured program" section before configuring or extending this.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
// `URL` itself is a Node.js global (since Node 10) — no import needed.

const PORT = Number(process.env.WORKSHOP_HOST_COMPANION_PORT) || 7777;
const VERSION = "0.3.0-preview";

// "Please read this before running it" (README.md) applies doubly here —
// a fresh, random token every process start, held only in memory. Never
// persisted: a token that outlived this process would just go stale the
// moment the Companion restarts anyway, so there's nothing to gain from
// writing it anywhere and a real (if small) downside to doing so.
const PAIRING_TOKEN = crypto.randomBytes(16).toString("hex");

// A generous cap for text/code/config files, small enough to keep this a
// text-file bridge rather than a general-purpose file-transfer endpoint —
// both GET /file and PUT /file enforce it.
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

// "Choose one folder when the Companion is started" — a command-line
// argument, not a hardcoded path and not "the whole filesystem." Falls
// back to the current directory so `node workshop-host-companion.js`
// with no arguments still does something sensible and inspectable
// rather than erroring immediately.
const WORKSPACE_ROOT = path.resolve(process.argv[2] || process.cwd());

// Version 4, Phase v4.0.1b — a second, optional CLI argument: the
// allow-list of programs this Companion is willing to launch. Absent by
// default, the same "off unless deliberately configured" default every
// Host capability so far has used — no argument means `PROGRAMS` stays
// empty and launching stays entirely unavailable, not an error.
const PROGRAMS_CONFIG_PATH = process.argv[3] ? path.resolve(process.argv[3]) : null;
const VALID_ARG_TYPES = new Set(["workspacePath", "enum"]);
/** @type {Map<string, {id:string, name:string, icon:string|null, command:string, args:string[], acceptsArgs:Array<{name:string, type:string, required:boolean, argTemplate:string[], values?:string[]}>}>} */
const PROGRAMS = new Map();

/** Loaded once at startup, never hot-reloaded — same "chosen when it's
 *  started" reasoning as `WORKSPACE_ROOT` itself. A missing file, invalid
 *  JSON, or a malformed individual entry is reported plainly to the
 *  console and skipped rather than crashing the whole Companion — one
 *  typo in one entry shouldn't take down `/status`/`/files` along with
 *  it. `command`/`args`/`argTemplate` are the actual mechanics of what
 *  runs — deliberately never sent to the browser (see `handleListPrograms()`);
 *  everything else here exists only to let a Companion operator author
 *  correct config, not because the browser needs to see it. */
function loadProgramsConfig() {
  if (!PROGRAMS_CONFIG_PATH) return;
  let raw;
  try {
    raw = fs.readFileSync(PROGRAMS_CONFIG_PATH, "utf-8");
  } catch (err) {
    console.warn(`[workshop-host-companion] Couldn't read the programs config at ${PROGRAMS_CONFIG_PATH}: ${err.code || err.message}. Launching stays unavailable.`);
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn(`[workshop-host-companion] The programs config at ${PROGRAMS_CONFIG_PATH} isn't valid JSON: ${err.message}. Launching stays unavailable.`);
    return;
  }
  const list = Array.isArray(parsed?.programs) ? parsed.programs : [];
  for (const entry of list) {
    const validated = validateProgramEntry(entry);
    if (!validated) {
      console.warn(`[workshop-host-companion] Skipping an invalid programs config entry (see README.md's own config format): ${JSON.stringify(entry)}`);
      continue;
    }
    if (PROGRAMS.has(validated.id)) {
      console.warn(`[workshop-host-companion] Duplicate program id "${validated.id}" in the config — keeping the first, ignoring this one.`);
      continue;
    }
    PROGRAMS.set(validated.id, validated);
  }
}

function validateProgramEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const { id, name, icon, command, args, acceptsArgs } = entry;
  if (typeof id !== "string" || !id.trim()) return null;
  if (typeof name !== "string" || !name.trim()) return null;
  if (typeof command !== "string" || !command.trim()) return null;
  if (args !== undefined && (!Array.isArray(args) || !args.every((a) => typeof a === "string"))) return null;
  const slots = [];
  if (acceptsArgs !== undefined) {
    if (!Array.isArray(acceptsArgs)) return null;
    for (const slot of acceptsArgs) {
      const validatedSlot = validateArgSlot(slot);
      if (!validatedSlot) return null;
      slots.push(validatedSlot);
    }
  }
  return { id: id.trim(), name: name.trim(), icon: typeof icon === "string" ? icon : null, command: command.trim(), args: args ?? [], acceptsArgs: slots };
}

/** Every declared slot must place its value somewhere in `argTemplate`
 *  (`{value}` appears literally in at least one template segment) — a
 *  slot that couldn't possibly affect the launched command isn't a
 *  config mistake worth launching with silently. */
function validateArgSlot(slot) {
  if (!slot || typeof slot !== "object") return null;
  const { name, type, required, argTemplate } = slot;
  if (typeof name !== "string" || !name.trim()) return null;
  if (!VALID_ARG_TYPES.has(type)) return null;
  if (!Array.isArray(argTemplate) || argTemplate.length === 0 || !argTemplate.every((t) => typeof t === "string")) return null;
  if (!argTemplate.some((t) => t.includes("{value}"))) return null;
  const base = { name: name.trim(), type, required: required === true, argTemplate };
  if (type === "enum") {
    if (!Array.isArray(slot.values) || slot.values.length === 0 || !slot.values.every((v) => typeof v === "string")) return null;
    base.values = slot.values;
  }
  return base;
}

/** Returns the validated value for one declared arg slot, or `null` if
 *  the supplied raw value fails that slot's own declared validator —
 *  never partially applied. `workspacePath` reuses
 *  `resolveWithinWorkspace()` unchanged (the same containment check
 *  `/files`/`/file` already rely on) and additionally requires the
 *  resolved path to exist as a real file; the *resolved, absolute* path
 *  is what actually gets substituted, since the launched program has no
 *  reason to share the Companion's own working directory. `enum`
 *  requires an exact match against the slot's own config-declared list —
 *  no prefix matching, no case-insensitivity, no ambiguity about what
 *  was actually approved. */
function validateArgValue(slot, rawValue) {
  if (typeof rawValue !== "string") return null;
  if (slot.type === "workspacePath") {
    const resolved = resolveWithinWorkspace(rawValue);
    if (!resolved) return null;
    try {
      return fs.statSync(resolved).isFile() ? resolved : null;
    } catch {
      return null;
    }
  }
  if (slot.type === "enum") {
    return slot.values.includes(rawValue) ? rawValue : null;
  }
  return null;
}

/** Builds the final argv for a launch request — the program's own fixed
 *  `args`, then each declared `acceptsArgs` slot's own `argTemplate`
 *  (with `{value}` substituted) *in the config's own declared order*,
 *  never an order or content the request body could influence. Returns
 *  `{error}` instead of an argv the moment anything doesn't check out;
 *  nothing spawns on a partial/best-effort basis. */
function buildArgv(program, providedArgs) {
  const argv = [...program.args];
  for (const slot of program.acceptsArgs) {
    const hasValue = Object.prototype.hasOwnProperty.call(providedArgs, slot.name);
    if (!hasValue) {
      if (slot.required) return { error: `Missing required argument "${slot.name}".` };
      continue;
    }
    const validated = validateArgValue(slot, providedArgs[slot.name]);
    if (validated === null) return { error: `Argument "${slot.name}" failed validation for this program.` };
    for (const part of slot.argTemplate) argv.push(part.replaceAll("{value}", validated));
  }
  return { argv };
}

/** Spawns detached and unref'd so the Companion process itself never
 *  blocks on, or dies alongside, the launched program — a genuine
 *  fire-and-forget launch, not a supervised child. Waits for Node's own
 *  `"spawn"`/`"error"` event before resolving so a response never claims
 *  `launched: true` for a command the OS actually failed to start (a bad
 *  `command`, most commonly) — still fire-and-forget in the sense that
 *  nothing here ever waits for the program to *exit*. */
function launchProgram(program, argv) {
  return new Promise((resolve) => {
    const child = spawn(program.command, argv, { shell: false, detached: true, stdio: "ignore" });
    let settled = false;
    child.once("spawn", () => {
      if (settled) return;
      settled = true;
      child.unref();
      resolve({ ok: true, pid: child.pid, startedAt: new Date().toISOString() });
    });
    child.once("error", (err) => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, error: err.code === "ENOENT" ? `"${program.command}" wasn't found on this machine.` : err.message });
    });
  });
}

// "Restrict CORS thoughtfully" — see README.md's own "A note on origins
// and security" section for the full reasoning. Same-machine origins
// (any port) plus GitHub Pages, the two places this Workshop is actually
// expected to be served from; add more via WORKSHOP_HOST_COMPANION_ORIGINS
// (comma-separated) rather than editing this file.
const DEFAULT_ALLOWED_ORIGIN_PATTERNS = [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/, /^https:\/\/[\w-]+\.github\.io$/];
const extraOrigins = (process.env.WORKSHOP_HOST_COMPANION_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (extraOrigins.includes(origin)) return true;
  return DEFAULT_ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

function withCors(req, res) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  // "X-Workshop-Host-Token" is a custom header — a cross-origin request
  // that sets it can never be a CORS "simple request," which is exactly
  // the point: the browser is forced to send a preflight OPTIONS first,
  // and only sends the real GET/PUT afterwards if this server's own
  // preflight response allows it. That's what makes a disallowed origin's
  // blind request actually get blocked before it happens, not merely
  // unreadable afterwards the way plain GET /status and GET /files are.
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Workshop-Host-Token");
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(text) });
  res.end(text);
}

/** `GET /file` and `PUT /file` both require this — see the top-of-file
 *  comment's own "Version 4, Phase 1" section for why listing stays
 *  lighter-gated than actual file contents. Constant-time comparison
 *  isn't protecting a cryptographic secret here (this is a local,
 *  low-stakes pairing token, not a password), but it costs nothing and
 *  avoids a lazy string `===` being the one thing in this file that
 *  isn't held to its own stated bar. */
function hasValidToken(req) {
  const provided = req.headers["x-workshop-host-token"];
  if (typeof provided !== "string" || provided.length !== PAIRING_TOKEN.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(PAIRING_TOKEN));
  } catch {
    return false;
  }
}

/** Reads the full request body, rejecting anything past
 *  `MAX_FILE_SIZE_BYTES` while still streaming — a deliberately large
 *  `Content-Length` lie or a body that just keeps sending doesn't get to
 *  sit in memory unbounded first and get rejected only afterwards. */
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_FILE_SIZE_BYTES) {
        reject(Object.assign(new Error("Request body too large."), { code: "TOO_LARGE" }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** A simple, honest heuristic, not a real content-type sniffer: a NUL
 *  byte essentially never appears in genuine text, and does appear near
 *  the start of almost every real binary format. Good enough to tell
 *  "this is source code/config/notes" from "this is a model file or an
 *  image" without pulling in a dependency for something this small. */
function looksBinary(buffer) {
  const sampleLength = Math.min(buffer.length, 8000);
  for (let i = 0; i < sampleLength; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

/** Resolves `requestedPath` (from `?path=`) against `WORKSPACE_ROOT`,
 *  refusing anything that would escape it — the one thing standing
 *  between "a folder the person running this explicitly chose" and "any
 *  path on their entire computer." `path.resolve()` collapses `..`
 *  segments before the containment check runs, so `../../etc` is caught
 *  by the check below rather than needing its own special-cased reject. */
function resolveWithinWorkspace(requestedPath) {
  const resolved = path.resolve(WORKSPACE_ROOT, requestedPath || ".");
  const relative = path.relative(WORKSPACE_ROOT, resolved);
  const escapesRoot = relative.startsWith("..") || path.isAbsolute(relative);
  return escapesRoot ? null : resolved;
}

function handleStatus(req, res) {
  sendJson(res, 200, {
    running: true,
    version: VERSION,
    platform: process.platform,
    workspaceRoot: WORKSPACE_ROOT,
  });
}

function handleFiles(req, res, requestedPath) {
  const target = resolveWithinWorkspace(requestedPath);
  if (!target) {
    sendJson(res, 400, { error: "That path is outside the Companion's configured workspace root." });
    return;
  }
  fs.readdir(target, { withFileTypes: true }, (err, entries) => {
    if (err) {
      sendJson(res, 404, { error: `Couldn't read that folder: ${err.code || err.message}` });
      return;
    }
    const items = entries.map((entry) => {
      let size = null;
      let modified = null;
      try {
        const stat = fs.statSync(path.join(target, entry.name));
        size = stat.size;
        modified = stat.mtime.toISOString();
      } catch {
        // A file that vanished or became unreadable between readdir() and
        // statSync() just gets null metadata rather than failing the
        // whole listing over one entry.
      }
      return { name: entry.name, isDirectory: entry.isDirectory(), size, modified };
    });
    sendJson(res, 200, { path: path.relative(WORKSPACE_ROOT, target) || ".", items });
  });
}

/** `GET /file?path=...` — reads one file's contents as UTF-8 text. Every
 *  rejection is specific and honest (never a bare 500) so a caller — and
 *  the person reading FilesService's own error message — knows exactly
 *  which of several distinct conditions actually failed. */
function handleReadFile(req, res, requestedPath) {
  if (!hasValidToken(req)) {
    sendJson(res, 401, { error: "Missing or incorrect pairing token. Check this Companion's own terminal output and re-enter it in the Workshop at host://permissions." });
    return;
  }
  const target = resolveWithinWorkspace(requestedPath);
  if (!target) {
    sendJson(res, 400, { error: "That path is outside the Companion's configured workspace root." });
    return;
  }
  fs.stat(target, (statErr, stat) => {
    if (statErr) {
      sendJson(res, 404, { error: `Couldn't read that file: ${statErr.code || statErr.message}` });
      return;
    }
    if (!stat.isFile()) {
      sendJson(res, 400, { error: "That path is a folder, not a file." });
      return;
    }
    if (stat.size > MAX_FILE_SIZE_BYTES) {
      sendJson(res, 413, { error: `That file is larger than the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB the Companion will read (${stat.size} bytes).` });
      return;
    }
    fs.readFile(target, (readErr, buffer) => {
      if (readErr) {
        sendJson(res, 500, { error: `Couldn't read that file: ${readErr.code || readErr.message}` });
        return;
      }
      if (looksBinary(buffer)) {
        sendJson(res, 415, { error: "That file looks like a binary file. The Companion only reads and writes text files." });
        return;
      }
      sendJson(res, 200, { path: path.relative(WORKSPACE_ROOT, target) || ".", contents: buffer.toString("utf-8"), size: stat.size, modified: stat.mtime.toISOString() });
    });
  });
}

/** `PUT /file?path=...`, body `{ contents: "..." }` — writes (creating if
 *  it doesn't already exist) or overwrites (if it does) one text file.
 *  Deliberately does **not** create missing parent directories — a write
 *  into a folder that doesn't exist yet fails honestly rather than
 *  silently inventing structure nobody asked for. */
async function handleWriteFile(req, res, requestedPath) {
  if (!hasValidToken(req)) {
    sendJson(res, 401, { error: "Missing or incorrect pairing token. Check this Companion's own terminal output and re-enter it in the Workshop at host://permissions." });
    return;
  }
  const target = resolveWithinWorkspace(requestedPath);
  if (!target) {
    sendJson(res, 400, { error: "That path is outside the Companion's configured workspace root." });
    return;
  }
  const parentDir = path.dirname(target);
  if (!fs.existsSync(parentDir) || !fs.statSync(parentDir).isDirectory()) {
    sendJson(res, 404, { error: "The folder that path would live in doesn't exist." });
    return;
  }
  if (fs.existsSync(target) && !fs.statSync(target).isFile()) {
    sendJson(res, 400, { error: "That path is a folder, not a file." });
    return;
  }

  let body;
  try {
    body = await readRequestBody(req);
  } catch (err) {
    sendJson(res, err.code === "TOO_LARGE" ? 413 : 400, { error: err.code === "TOO_LARGE" ? `The Companion won't write more than ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.` : "Couldn't read the request body." });
    return;
  }

  let contents;
  try {
    const parsed = JSON.parse(body.toString("utf-8"));
    contents = parsed.contents;
  } catch {
    sendJson(res, 400, { error: "Expected a JSON body shaped like { contents: \"...\" }." });
    return;
  }
  if (typeof contents !== "string") {
    sendJson(res, 400, { error: "Expected a JSON body shaped like { contents: \"...\" }." });
    return;
  }
  if (Buffer.byteLength(contents, "utf-8") > MAX_FILE_SIZE_BYTES) {
    sendJson(res, 413, { error: `The Companion won't write more than ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.` });
    return;
  }

  fs.writeFile(target, contents, "utf-8", (writeErr) => {
    if (writeErr) {
      sendJson(res, 500, { error: `Couldn't write that file: ${writeErr.code || writeErr.message}` });
      return;
    }
    const stat = fs.statSync(target);
    sendJson(res, 200, { path: path.relative(WORKSPACE_ROOT, target) || ".", size: stat.size, modified: stat.mtime.toISOString() });
  });
}

/** `GET /programs` — the configured allow-list, for display only. Each
 *  slot's `name`/`type`/`required`/`values` is included so the Workshop
 *  can render the right kind of input (a dropdown for `enum`, a file
 *  field for `workspacePath`) — but `command`, the program's own fixed
 *  `args`, and each slot's own `argTemplate` (the actual mechanics of
 *  how a value reaches the command line) never leave this process. */
function handleListPrograms(req, res) {
  if (!hasValidToken(req)) {
    sendJson(res, 401, { error: "Missing or incorrect pairing token. Check this Companion's own terminal output and re-enter it in the Workshop at host://permissions." });
    return;
  }
  const items = [...PROGRAMS.values()].map((p) => ({
    id: p.id,
    name: p.name,
    icon: p.icon,
    acceptsArgs: p.acceptsArgs.map((s) => ({ name: s.name, type: s.type, required: s.required, values: s.values })),
  }));
  sendJson(res, 200, { items });
}

/** `POST /launch`, body `{ id, args?: {name: value} }`. See this file's
 *  own top-of-file "Version 4, Phase v4.0.1b" comment for the full
 *  safety property this enforces — every check below runs *before*
 *  anything is spawned, and any single failure aborts the whole request
 *  rather than launching with partial/defaulted arguments. */
async function handleLaunch(req, res) {
  if (!hasValidToken(req)) {
    sendJson(res, 401, { error: "Missing or incorrect pairing token. Check this Companion's own terminal output and re-enter it in the Workshop at host://permissions." });
    return;
  }
  let body;
  try {
    body = await readRequestBody(req);
  } catch (err) {
    sendJson(res, err.code === "TOO_LARGE" ? 413 : 400, { error: "Couldn't read the request body." });
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(body.toString("utf-8"));
  } catch {
    sendJson(res, 400, { error: 'Expected a JSON body shaped like { id, args? }.' });
    return;
  }
  const { id, args } = parsed ?? {};
  if (typeof id !== "string" || !id.trim()) {
    sendJson(res, 400, { error: 'Expected a JSON body shaped like { id, args? }.' });
    return;
  }
  const program = PROGRAMS.get(id);
  if (!program) {
    sendJson(res, 404, { error: `No program is configured with id "${id}".` });
    return;
  }
  const providedArgs = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  const declaredNames = new Set(program.acceptsArgs.map((s) => s.name));
  const undeclared = Object.keys(providedArgs).filter((k) => !declaredNames.has(k));
  if (undeclared.length) {
    sendJson(res, 400, { error: `"${program.name}" doesn't accept argument(s): ${undeclared.join(", ")}.` });
    return;
  }
  const built = buildArgv(program, providedArgs);
  if (built.error) {
    sendJson(res, 400, { error: built.error });
    return;
  }
  const result = await launchProgram(program, built.argv);
  if (!result.ok) {
    sendJson(res, 500, { error: `Couldn't launch "${program.name}": ${result.error}` });
    return;
  }
  sendJson(res, 200, { launched: true, id: program.id, name: program.name, pid: result.pid, startedAt: result.startedAt });
}

const server = http.createServer((req, res) => {
  withCors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== "GET" && req.method !== "PUT" && req.method !== "POST") {
    sendJson(res, 405, { error: "Only GET, PUT, POST (and CORS preflight OPTIONS) are supported." });
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === "GET" && url.pathname === "/status") return handleStatus(req, res);
  if (req.method === "GET" && url.pathname === "/files") return handleFiles(req, res, url.searchParams.get("path"));
  if (req.method === "GET" && url.pathname === "/file") return handleReadFile(req, res, url.searchParams.get("path"));
  if (req.method === "PUT" && url.pathname === "/file") return handleWriteFile(req, res, url.searchParams.get("path"));
  if (req.method === "GET" && url.pathname === "/programs") return handleListPrograms(req, res);
  if (req.method === "POST" && url.pathname === "/launch") return handleLaunch(req, res);
  sendJson(res, 404, { error: "Unknown endpoint. See this folder's own README.md for what exists." });
});

loadProgramsConfig();

server.listen(PORT, () => {
  console.log(`Workshop Host Companion ${VERSION}`);
  console.log(`Listening on http://localhost:${PORT}`);
  console.log(`Workspace root: ${WORKSPACE_ROOT}`);
  console.log(`Pairing token (enter this at host://permissions to read/edit files or launch programs): ${PAIRING_TOKEN}`);
  console.log(
    PROGRAMS.size > 0
      ? `Programs configured to launch: ${[...PROGRAMS.values()].map((p) => p.name).join(", ")} (from ${PROGRAMS_CONFIG_PATH})`
      : PROGRAMS_CONFIG_PATH
        ? `No valid programs loaded from ${PROGRAMS_CONFIG_PATH} — launching stays unavailable. See warnings above, if any.`
        : `No programs config passed — launching stays unavailable. See README.md's own "Launching a configured program" section.`
  );
  console.log(`Press Ctrl+C to stop.`);
});
