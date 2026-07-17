import { EventBus } from "../core/EventBus.js";

const DEFAULT_BASE_URL = "http://localhost:11434";
const POLL_INTERVAL_MS = 10000; // a calm cadence, not a tight retry loop
const FETCH_TIMEOUT_MS = 4000;
// Workshop Refinement phase (Pass A) — "quietly warming models in the
// background, periodically keeping them alive." Ollama's own default is
// to unload a model after 5 minutes of inactivity; pinging somewhat
// inside that window (not right up against it) keeps a genuinely-in-use
// model loaded without a person ever noticing it almost lapsed.
// `KEEP_ALIVE_DURATION` is how long *each* ping asks Ollama to hold the
// model for — generous enough that a slightly-late next ping (the
// Workshop tab backgrounded for a bit, say) still won't have let it
// unload, but not "forever": once the Workshop stops asking, a
// person's own machine gets that memory back within a reasonable time
// on its own, the same way it would if they'd been using Ollama
// directly.
const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000;
const KEEP_ALIVE_DURATION = "10m";
// The warm-up/keep-alive ping *is* a real model-load request on a cold
// model — same reasoning as ResidentConnection.sendMessage()'s own
// timeout, and the same number, for the same reason.
const WARM_TIMEOUT_MS = 180000;

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
 *
 * **Workshop Refinement phase (Pass A) — keeping a model warm.** "The
 * Workshop should feel patient rather than fragile" when a slower
 * machine needs real time to load a model into memory — the honest fix
 * isn't a longer timeout (that only makes the *wait* more tolerable,
 * never shorter), it's not needing that cold load to happen in the
 * middle of a conversation at all. `setWarmModel(modelId)` — called by
 * `main.js` whenever the active resident profile's own model changes —
 * pings Ollama once immediately (so switching to a model warms it right
 * away, in the background, before anyone's actually waiting on it) and
 * keeps re-pinging on `KEEP_ALIVE_INTERVAL_MS`, each ping asking Ollama
 * to hold the model for `KEEP_ALIVE_DURATION` — comfortably inside
 * Ollama's own 5-minute default unload window, so a model that's
 * genuinely in use never has the chance to cool down between messages.
 * `keepAliveEnabled` (persisted, on by default) is the whole feature's
 * own on/off switch — Mission Control's own "Connection" section — for
 * anyone who'd rather Ollama managed its own memory without the
 * Workshop's help, or is running something memory-constrained enough
 * that holding a model warm between messages isn't welcome. Every ping
 * fails exactly as quietly as `checkConnection()` already does — a
 * missed keep-alive isn't an error, it just means the next real message
 * pays the ordinary cold-load cost once, same as always.
 */
export class AIConnectionManager {
  constructor() {
    this.events = new EventBus();
    this.baseUrl = DEFAULT_BASE_URL;
    this.status = "connecting"; // "connecting" | "connected" | "disconnected"
    this.lastLatencyMs = null; // "Resident Health" (AI Intelligence phase) — round-trip time of the most recent successful connection check, or null before the first one / after a failure
    // Diagnostics phase — "last successful response. Last failure." Two
    // plain timestamps, updated in the same one place `lastLatencyMs`
    // already is, so AI Diagnostics has something honest to show beyond
    // just the current instantaneous status.
    this.lastSuccessAt = null;
    this.lastFailureAt = null;
    this._pollTimer = null;
    this._disposed = false;
    // Workshop Refinement phase (Pass A) — see the class comment's own
    // "keeping a model warm" section.
    this.keepAliveEnabled = true;
    this._warmModelId = null;
    this._keepAliveTimer = null;
  }

  init() {
    this._poll();
    this._scheduleKeepAlive();
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
   *  this to stay calm. Also updates `lastLatencyMs` — "Resident Health"
   *  (`AIApp.js`) shows this as a calm, informative number, not a
   *  debugging metric; a poll's own round trip is a perfectly honest
   *  stand-in for "how responsive is the connection right now," without
   *  this file needing any dedicated ping mechanism of its own. */
  async checkConnection() {
    if (this.status === "disconnected") this._setStatus("connecting");
    const startedAt = performance.now();
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`Ollama responded with ${response.status}`);
      const data = await response.json();
      this.lastLatencyMs = Math.round(performance.now() - startedAt);
      this.lastSuccessAt = new Date().toISOString();
      this._setStatus("connected");
      return data.models ?? [];
    } catch {
      this.lastLatencyMs = null;
      this.lastFailureAt = new Date().toISOString();
      this._setStatus("disconnected");
      return null;
    }
  }

  /** Workshop Refinement phase (Pass A) — called by `main.js` whenever
   *  the active resident profile's own model changes (including on
   *  startup, and including to `null` if no profile has a model
   *  configured at all). Warms the new model immediately, in the
   *  background, rather than waiting for the next scheduled keep-alive —
   *  switching models is exactly the moment a cold load is otherwise
   *  about to happen the instant someone actually says something. */
  setWarmModel(modelId) {
    const normalized = modelId || null;
    if (normalized === this._warmModelId) return;
    this._warmModelId = normalized;
    if (normalized && this.keepAliveEnabled && this.status === "connected") this._pingKeepAlive(normalized);
  }

  /** Mission Control's own "Connection" toggle. Turning this off doesn't
   *  retroactively unload anything already warm — it just stops asking
   *  Ollama to keep holding it, the same way turning it back on doesn't
   *  force an immediate warm-up either; the next scheduled tick (or the
   *  next real message) picks it back up naturally. */
  setKeepAliveEnabled(enabled) {
    this.keepAliveEnabled = !!enabled;
    this.events.emit("connection:changed");
    this.events.emit("persistence:saveRequested");
  }

  _scheduleKeepAlive() {
    if (this._keepAliveTimer) clearTimeout(this._keepAliveTimer);
    this._keepAliveTimer = setTimeout(() => this._runKeepAlive(), KEEP_ALIVE_INTERVAL_MS);
  }

  async _runKeepAlive() {
    if (this._disposed) return;
    if (this.keepAliveEnabled && this.status === "connected" && this._warmModelId) {
      await this._pingKeepAlive(this._warmModelId);
    }
    if (this._disposed) return;
    this._scheduleKeepAlive();
  }

  /** The actual ping — `prompt: ""` asks Ollama to load the model without
   *  generating anything, and `keep_alive` is the one part of this
   *  request that isn't just "a normal generation call": it's what tells
   *  Ollama to hold the model in memory for `KEEP_ALIVE_DURATION` rather
   *  than its own default. Fire-and-forget from every caller's own
   *  perspective — failures are swallowed here, on purpose, the same
   *  "a background health check is never a user-facing error"
   *  reasoning `checkConnection()` already follows. */
  async _pingKeepAlive(modelId) {
    try {
      await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId, prompt: "", keep_alive: KEEP_ALIVE_DURATION }),
        signal: AbortSignal.timeout(WARM_TIMEOUT_MS),
      });
    } catch {
      // Quiet — see this method's own comment above.
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
      // Same reasoning as ResidentConnection.js's own sendMessage() —
      // this is a real generation request too, and can trigger the exact
      // same cold model load on slower hardware.
      signal: AbortSignal.timeout(180000),
    });
    if (!response.ok) throw new Error(`Ollama responded with ${response.status}`);
    const data = await response.json();
    return data.response ?? "";
  }

  dispose() {
    this._disposed = true;
    if (this._pollTimer) clearTimeout(this._pollTimer);
    if (this._keepAliveTimer) clearTimeout(this._keepAliveTimer);
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { baseUrl: this.baseUrl, keepAliveEnabled: this.keepAliveEnabled };
  }

  load(data) {
    if (!data) return;
    if (data.baseUrl) this.baseUrl = data.baseUrl;
    // Workshop Refinement phase (Pass A) — explicit `=== false` rather
    // than a falsy check: a save file from before this phase existed has
    // no `keepAliveEnabled` key at all (`undefined`), which should mean
    // "keep the default (on)," not "off."
    if (data.keepAliveEnabled === false) this.keepAliveEnabled = false;
    this.events.emit("connection:changed");
  }
}

export { DEFAULT_BASE_URL };
