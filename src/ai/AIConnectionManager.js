import { EventBus } from "../core/EventBus.js";

const DEFAULT_BASE_URL = "http://localhost:11434";
const POLL_INTERVAL_MS = 10000; // a calm cadence, not a tight retry loop
const FETCH_TIMEOUT_MS = 4000;

/**
 * AIConnectionManager
 * ----------------------
 * "This is NOT the AI itself... preparing another presence that will
 * eventually live inside the Workshop." This file owns exactly one thing:
 * whether a configured Ollama server is currently reachable, and the
 * plain requests (list models, send a test prompt) that only make sense
 * once it is. It has no idea what a "resident profile" or "embodiment" is
 * — see `ResidentProfileStore.js`/`ModelRegistry.js` for those, kept
 * deliberately separate so a future real AI Resident can depend on this
 * one connection concern without inheriting anything about identity,
 * memory, or appearance.
 *
 * **"Never block the Workshop. Never interrupt gameplay. Never spam
 * errors."** Polls quietly on a calm interval (10s, not a tight retry
 * loop), every failure is caught and folded into one plain `status`
 * string rather than thrown or logged — there is no `console.error` for
 * "Ollama isn't running right now," because that isn't an error, it's an
 * ordinary, expected state for anyone who hasn't started Ollama yet or
 * doesn't use it at all. `status` is exactly the three states the brief's
 * own status examples describe: `"connecting"` (actively checking, e.g.
 * right after the URL changes), `"connected"`, and `"disconnected"`
 * (quietly waiting, retrying on the next poll) — `AIApp.js` maps these
 * straight onto "Connecting…"/"Connected"/"Waiting for Ollama…".
 *
 * **A real, honest limitation worth naming**: Ollama's own default CORS
 * policy only allows requests from a small set of origins, and the
 * Workshop's own deployed origin (a GitHub Pages URL, say) isn't one of
 * them out of the box. A person wanting to actually connect needs to set
 * `OLLAMA_ORIGINS` themselves before this can succeed — not something
 * fixable from inside the browser, the same category of limitation
 * `BrowserApp.js`'s own `X-Frame-Options` note already documents for a
 * different reason. Every failure (network error, CORS rejection,
 * timeout) is indistinguishable from "Ollama isn't running" from here,
 * which is exactly right for staying calm: there's no way to tell them
 * apart reliably, so there's no reason to show a different, scarier
 * message for one than the other.
 */
export class AIConnectionManager {
  constructor() {
    this.events = new EventBus();
    this.baseUrl = DEFAULT_BASE_URL;
    this.status = "connecting"; // "connecting" | "connected" | "disconnected"
    this._pollTimer = null;
    this._disposed = false;
  }

  init() {
    this._poll();
  }

  setBaseUrl(url) {
    const trimmed = (url ?? "").trim().replace(/\/+$/, "");
    if (!trimmed || trimmed === this.baseUrl) return;
    this.baseUrl = trimmed;
    this.events.emit("connection:changed");
    this.events.emit("persistence:saveRequested");
    this._checkNow(); // a URL change deserves an immediate recheck, not waiting out the rest of the current poll interval
  }

  _setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this.events.emit("connection:changed");
  }

  async _poll() {
    if (this._disposed) return;
    await this._checkNow();
    if (this._disposed) return;
    this._pollTimer = setTimeout(() => this._poll(), POLL_INTERVAL_MS);
  }

  _checkNow() {
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }
    return this.checkConnection();
  }

  /** Checks whether `baseUrl` is currently reachable and, if so, returns
   *  its raw model list (straight from `/api/tags`, undigested — see
   *  `ModelRegistry.js` for turning that into something the UI actually
   *  wants). Returns `null` on any failure at all, having already quietly
   *  updated `status` — callers never need their own try/catch around
   *  this to stay calm. */
  async checkConnection() {
    if (this.status === "disconnected") this._setStatus("connecting");
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`Ollama responded with ${response.status}`);
      const data = await response.json();
      this._setStatus("connected");
      return data.models ?? [];
    } catch {
      this._setStatus("disconnected");
      return null;
    }
  }

  /** A one-off test prompt — "purely for testing... not yet the Workshop
   *  chat interface." Callers are expected to show their own honest
   *  failure message; this doesn't swallow the error the way
   *  `checkConnection()` does, since a person who explicitly asked to
   *  test a specific model deserves to know exactly what went wrong. */
  async sendTestPrompt(model, prompt) {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Ollama responded with ${response.status}`);
    const data = await response.json();
    return data.response ?? "";
  }

  dispose() {
    this._disposed = true;
    if (this._pollTimer) clearTimeout(this._pollTimer);
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { baseUrl: this.baseUrl };
  }

  load(data) {
    if (!data?.baseUrl) return;
    this.baseUrl = data.baseUrl;
    this.events.emit("connection:changed");
  }
}

export { DEFAULT_BASE_URL };
