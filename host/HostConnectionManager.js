import { EventBus } from "../core/EventBus.js";

const DEFAULT_BASE_URL = "http://localhost:7777";
const POLL_INTERVAL_MS = 10000; // the identical calm cadence AIConnectionManager.js already uses for Ollama
const FETCH_TIMEOUT_MS = 3000;

/**
 * HostConnectionManager
 * ------------------------
 * "The Workshop Host Companion" (see `host-companion/README.md` for the
 * companion program itself) needed a Workshop-side counterpart the
 * moment it became a real, separate local process rather than an
 * in-browser placeholder — this is deliberately the *exact* shape
 * `src/ai/AIConnectionManager.js` already established for Ollama, not a
 * new design: poll a local `/status` endpoint on a calm ten-second
 * interval, fold every possible outcome into one plain `status` string
 * (`"connecting"` | `"connected"` | `"disconnected"`), never throw, never
 * log an error, never block anything else the Workshop is doing. A
 * person who has never heard of the Companion, and never will, should
 * never notice this file exists — "disconnected" is simply what it reads
 * as forever, identical in every visible way to Ollama not running.
 *
 * This file owns exactly one thing: whether the Companion is currently
 * reachable, and the one real request (`listFiles()`) that only makes
 * sense once it is. It has no idea what a "permission" or a "Host
 * service" is — `PermissionsService.js`/`FilesService.js` are what
 * actually decide whether, and how, to use this connection, kept
 * deliberately separate the same reason `AIConnectionManager.js` itself
 * gives for staying ignorant of "resident profiles."
 */
export class HostConnectionManager {
  constructor() {
    this.events = new EventBus();
    this.baseUrl = DEFAULT_BASE_URL;
    this.status = "connecting"; // "connecting" | "connected" | "disconnected"
    this.workspaceRoot = null; // reported by the Companion's own /status, once connected
    this._pollTimer = null;
    this._disposed = false;
  }

  init() {
    this._poll();
  }

  async _poll() {
    if (this._disposed) return;
    await this.checkConnection();
    if (this._disposed) return;
    this._pollTimer = setTimeout(() => this._poll(), POLL_INTERVAL_MS);
  }

  _setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this.events.emit("hostConnection:changed");
  }

  /** Checks whether the Companion is currently reachable. Returns `true`
   *  on success, `false` on any failure at all — a closed window, no
   *  Companion ever started, a firewall, anything — all indistinguishable
   *  from here and deliberately treated identically, the same reasoning
   *  `AIConnectionManager.checkConnection()`'s own comment gives for
   *  Ollama. */
  async checkConnection() {
    if (this.status === "disconnected") this._setStatus("connecting");
    try {
      const response = await fetch(`${this.baseUrl}/status`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`Companion responded with ${response.status}`);
      const data = await response.json();
      this.workspaceRoot = data.workspaceRoot ?? null;
      this._setStatus("connected");
      return true;
    } catch {
      this.workspaceRoot = null;
      this._setStatus("disconnected");
      return false;
    }
  }

  /** Lists the contents of `relativePath` (relative to the Companion's
   *  own configured workspace root) — throws on any failure, since a
   *  caller that explicitly asked to list files deserves to know exactly
   *  what went wrong, the same standard `AIConnectionManager.
   *  sendTestPrompt()`'s own comment holds real, on-demand actions to
   *  (as opposed to the quiet background poll above, which stays calm on
   *  purpose). Callers are expected to have already checked `status ===
   *  "connected"` and the relevant permission — this method itself
   *  enforces neither, matching `AIConnectionManager.sendMessage()`'s own
   *  "the caller already knows this is a deliberate, on-demand action"
   *  contract. */
  async listFiles(relativePath = ".") {
    const response = await fetch(`${this.baseUrl}/files?path=${encodeURIComponent(relativePath)}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Companion responded with ${response.status}`);
    }
    return response.json();
  }

  dispose() {
    this._disposed = true;
    if (this._pollTimer) clearTimeout(this._pollTimer);
  }
}

export { DEFAULT_BASE_URL };
