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
 * started, with path traversal rejected outright. Opening files,
 * launching programs, writing, deleting, moving — every one of those
 * stays an honestly-thrown "not implemented" in
 * `src/host/FilesService.js`/`ProgramsService.js`, even when the
 * Companion is reachable, until a real design exists for doing them
 * safely from something reachable by any browser tab.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
// `URL` itself is a Node.js global (since Node 10) — no import needed.

const PORT = Number(process.env.WORKSHOP_HOST_COMPANION_PORT) || 7777;
const VERSION = "0.1.0-prototype";

// "Choose one folder when the Companion is started" — a command-line
// argument, not a hardcoded path and not "the whole filesystem." Falls
// back to the current directory so `node workshop-host-companion.js`
// with no arguments still does something sensible and inspectable
// rather than erroring immediately.
const WORKSPACE_ROOT = path.resolve(process.argv[2] || process.cwd());

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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(text) });
  res.end(text);
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

const server = http.createServer((req, res) => {
  withCors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Only GET (and CORS preflight OPTIONS) are supported." });
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === "/status") return handleStatus(req, res);
  if (url.pathname === "/files") return handleFiles(req, res, url.searchParams.get("path"));
  sendJson(res, 404, { error: "Unknown endpoint. See this folder's own README.md for what exists." });
});

server.listen(PORT, () => {
  console.log(`Workshop Host Companion ${VERSION}`);
  console.log(`Listening on http://localhost:${PORT}`);
  console.log(`Workspace root: ${WORKSPACE_ROOT}`);
  console.log(`Press Ctrl+C to stop.`);
});
