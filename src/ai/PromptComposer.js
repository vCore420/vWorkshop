/**
 * PromptComposer
 * ----------------
 * "These should ultimately combine into the future system prompt, but
 * the player should feel like they are defining who this resident is
 * rather than editing raw prompt text." `composeSystemPrompt()` is that
 * combination — a pure function, deliberately not a method on
 * `ResidentProfileStore` itself, so it can be imported and called
 * identically by `AIApp.js`'s own "Advanced" section (showing the
 * generated prompt for experienced users) and by a future real AI
 * Resident, without either needing its own copy of this logic. "The
 * future AI Resident should simply consume these configurations rather
 * than implementing its own copies" applies exactly as much to *how a
 * profile becomes a prompt* as it does to the profile data itself.
 */
export function composeSystemPrompt(profile) {
  if (!profile) return "";
  const { name, identity = {} } = profile;
  const lines = [];

  if (name) lines.push(`You are ${name}, a resident of the Workshop.`);
  else lines.push("You are a resident of the Workshop.");

  if (identity.purpose) lines.push(`Your purpose: ${identity.purpose}`);
  if (identity.identity) lines.push(`Who you are: ${identity.identity}`);
  if (identity.personality) lines.push(`Your personality: ${identity.personality}`);
  if (identity.behaviour) lines.push(`How you behave: ${identity.behaviour}`);
  if (identity.conversationStyle) lines.push(`Your conversation style: ${identity.conversationStyle}`);

  return lines.join("\n\n");
}
