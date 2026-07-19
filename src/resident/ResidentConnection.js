const MAX_TOOL_ROUNDS = 4; // a generous but bounded number of "call a function, see the result, maybe call another" round-trips before giving up and returning whatever text came back — a real player-facing safety net against a model that never stops calling functions, not a number chosen to feel exact

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
 *
 * Version 3, Phase 8a — `sendMessage()` now returns `{content,
 * promptEvalCount, evalCount}` instead of a bare string. Ollama's own
 * `/api/chat` response already carries `prompt_eval_count`/`eval_count`
 * (tokens in the prompt / tokens generated) alongside `message` — this
 * was being read and silently discarded before. Both counts are `null`
 * when Ollama doesn't report them (an older server, say), never
 * fabricated. See `ResidentConversation.js`'s own context-usage popup for
 * the one place this is currently used.
 *
 * Version 3, Phase 8b ("Bubble Gains Hands") — `sendMessage()` gained a
 * fourth, optional `dispatcher` argument (a `WorkshopFunctions.js`
 * dispatcher). When provided, and the profile has any Workshop Functions
 * granted, this builds Ollama's own `tools` request field from
 * `dispatcher.definitionsFor(profile)` and runs the standard tool-calling
 * loop: send, check the response for `tool_calls`, invoke the fixed
 * dispatch table for each one, feed the results back as `tool` role
 * messages, and send again — repeating (capped at `MAX_TOOL_ROUNDS`
 * rounds) until a final, tool-call-free reply comes back. Without a
 * dispatcher, or a profile with nothing granted, this is exactly the
 * single request it always was — the loop below only ever runs when
 * Ollama's own response actually contains `tool_calls`, so nothing about
 * an ordinary conversation turn changes shape. `functionCalls` in the
 * return value is a plain transparency record (`{name, args, result}`
 * per call, empty when none happened) — `ResidentConversation.js` uses
 * it for a real, honest "Bubble did X" line, never used to alter the
 * conversation itself.
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

  async _rawChat(profile, messages, tools) {
    const { behaviourConfig } = profile;
    const body = {
      model: profile.model,
      messages,
      stream: false,
      options: {
        temperature: behaviourConfig.temperature,
        num_ctx: behaviourConfig.contextSize,
        num_predict: behaviourConfig.maxResponseLength,
      },
    };
    // Only sent when there's actually something to offer — an empty
    // `tools: []` is harmless to Ollama, but omitting the field entirely
    // for a profile with nothing granted keeps an ordinary conversation
    // turn's own request byte-for-byte what it always was.
    if (tools && tools.length > 0) body.tools = tools;
    const response = await fetch(`${this.aiConnectionManager.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
    return response.json();
  }

  /** A real, multi-turn conversation call — `messages` is the ordinary
   *  `[{role, content}]` shape, `systemPrompt` from
   *  `PromptComposer.composeSystemPrompt()`. Uses Ollama's `/api/chat`
   *  (not `/api/generate`, which `AIConnectionManager.sendTestPrompt()`
   *  uses for Mission Control's own one-off test) since a real
   *  conversation needs Ollama to see the actual turn history, not one
   *  prompt string. Never mutates the `messages` array it's given — the
   *  tool-calling loop below builds and grows its own local copy, so the
   *  caller's own history (a UI's live conversation state) stays exactly
   *  what it was regardless of how many extra tool round-trips happened
   *  underneath this one call. */
  async sendMessage(profile, messages, systemPrompt, dispatcher = null) {
    const tools = dispatcher ? dispatcher.definitionsFor(profile) : [];
    const conversation = [{ role: "system", content: systemPrompt }, ...messages];
    const functionCalls = [];

    let data = await this._rawChat(profile, conversation, tools);
    let rounds = 0;
    while (data.message?.tool_calls?.length && rounds < MAX_TOOL_ROUNDS) {
      rounds += 1;
      conversation.push({ role: "assistant", content: data.message.content ?? "", tool_calls: data.message.tool_calls });
      for (const call of data.message.tool_calls) {
        const name = call.function?.name;
        const rawArgs = call.function?.arguments;
        // Ollama's own tool_calls already hand back a parsed object in
        // practice, but the OpenAI-compatible shape this mirrors allows
        // a JSON *string* here too — tolerate both rather than assuming.
        const args = typeof rawArgs === "string" ? this._parseArgs(rawArgs) : (rawArgs ?? {});
        const result = await dispatcher.invoke(name, args);
        functionCalls.push({ name, args, result });
        conversation.push({ role: "tool", content: JSON.stringify(result) });
      }
      data = await this._rawChat(profile, conversation, tools);
    }

    return {
      content: data.message?.content ?? "",
      promptEvalCount: typeof data.prompt_eval_count === "number" ? data.prompt_eval_count : null,
      evalCount: typeof data.eval_count === "number" ? data.eval_count : null,
      functionCalls,
    };
  }

  _parseArgs(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
}
