/**
 * ProviderRegistry
 * ------------------
 * "Please begin preparing Mission Control for additional providers...
 * only Ollama needs to be fully functional during this phase. The
 * remaining providers should simply be supported architecturally for
 * future expansion." This is that architecture: a plain, static list of
 * providers, each honestly marked `implemented` or not — the exact same
 * "honest placeholder" convention `src/host/`'s services already
 * established (see docs/HOST.md), applied to AI providers instead of
 * local-machine services.
 *
 * A profile's `provider` field (see `ResidentProfileStore.js`) is just
 * one of these ids. `AIConnectionManager.js` itself stays exactly what
 * it always was — an Ollama-specific connection concern — rather than
 * being generalised into a multi-provider client prematurely; the
 * *architecture* this phase adds is entirely about the Mission Control
 * surface (a provider selector, honest unavailable-provider messaging)
 * knowing these providers exist, not about actually speaking to any of
 * them besides Ollama.
 *
 * Why not build real OpenAI/Anthropic clients now, gated behind a
 * feature flag? Because a convincing-looking "Connected" status for a
 * provider that doesn't actually work would be exactly the kind of
 * misleading placeholder `docs/HOST.md` already warns against — "a
 * convincing fake would be more misleading than an honest 'not yet.'"
 */
export const AI_PROVIDERS = [
  { id: "ollama", label: "Ollama", implemented: true, defaultBaseUrl: "http://localhost:11434", description: "A local model server running on your own machine." },
  { id: "lmstudio", label: "LM Studio", implemented: false, defaultBaseUrl: "http://localhost:1234", description: "Another local model server — reserved for a future phase." },
  { id: "openai", label: "OpenAI", implemented: false, defaultBaseUrl: "https://api.openai.com", description: "A hosted provider — reserved for a future phase." },
  { id: "anthropic", label: "Anthropic", implemented: false, defaultBaseUrl: "https://api.anthropic.com", description: "A hosted provider — reserved for a future phase." },
  { id: "custom", label: "Custom Endpoint", implemented: false, defaultBaseUrl: "", description: "Any other OpenAI-compatible endpoint — reserved for a future phase." },
];

export const DEFAULT_PROVIDER_ID = "ollama";

export function getProvider(id) {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS.find((p) => p.id === DEFAULT_PROVIDER_ID);
}

export function normalizeProviderId(id) {
  return AI_PROVIDERS.some((p) => p.id === id) ? id : DEFAULT_PROVIDER_ID;
}
