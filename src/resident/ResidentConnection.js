/**
 * ResidentConnection
 * --------------------
 * "Mission Control should continue attempting reconnection automatically"
 * — it already does (`AIConnectionManager`'s own calm polling loop, see
 * docs/AI.md); this file doesn't re-implement any of that. It exists
 * purely to translate `AIConnectionManager.status` into the one thing
 * the resident's own behaviour actually needs (`isAwake`), and to carry
 * real conversation turns — distinct from Mission Control's own
 * single-shot Connection Test — through to Ollama's `/api/chat` endpoint,
 * using the active profile's own behaviour settings.
 *
 * "The resident should never duplicate these settings" — every value
 * `sendMessage()` sends (model, temperature, context size) is read
 * straight off whichever profile is passed in at call time, never cached
 * or copied here.
 */
export class ResidentConnection {
  constructor(aiConnectionManager) {
    this.aiConnectionManager = aiConnectionManager;
  }

  get isAwake() {
    return this.aiConnectionManager.status === "connected";
  }

  get status() {
    return this.aiConnectionManager.status;
  }

  /** A real, multi-turn conversation call — `messages` is the ordinary
   *  `[{role, content}]` shape, `systemPrompt` from
   *  `PromptComposer.composeSystemPrompt()`. Uses Ollama's `/api/chat`
   *  (not `/api/generate`, which `AIConnectionManager.sendTestPrompt()`
   *  uses for Mission Control's own one-off test) since a real
   *  conversation needs Ollama to see the actual turn history, not one
   *  prompt string. */
  async sendMessage(profile, messages, systemPrompt) {
    const { behaviourConfig } = profile;
    const response = await fetch(`${this.aiConnectionManager.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: profile.model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: false,
        options: {
          temperature: behaviourConfig.temperature,
          num_ctx: behaviourConfig.contextSize,
          num_predict: behaviourConfig.maxResponseLength,
        },
      }),
      // "Longer connection timeouts for slower hardware... current
      // behaviour sometimes disconnects before slower systems have
      // finished loading a model." Ollama loads a model's own weights
      // from disk into memory the first time it's used (or after it's
      // been idle long enough to unload) — for a larger model on modest
      // hardware, that alone can take well over a minute, before
      // generation even begins. 60s was cutting a legitimate, still-in-
      // progress load off as if it had failed; this is a generous upper
      // bound for "the model is genuinely loading," not a sign anything
      // is actually stuck.
      signal: AbortSignal.timeout(180000),
    });
    if (!response.ok) throw new Error(`Ollama responded with ${response.status}`);
    const data = await response.json();
    return data.message?.content ?? "";
  }
}
