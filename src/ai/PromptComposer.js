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
 *
 * `context` (optional, second argument) is new this phase — everything
 * `AIApp.js`'s own Advanced preview needs stays exactly as it was (calling
 * this with one argument), while `ResidentConversation.js` can now pass
 * live, runtime context (the resident's own selected traits, its
 * accumulated preferences, a short line of real Workshop knowledge since
 * Version 3 Phase 8b, a handful of curiosity notes, a few remembered
 * things about the player) without this function's core contract
 * changing shape. "Extend with an optional argument before reaching for
 * a new file" — this project's own stated habit (see the README's
 * "Advice to whoever continues this") — applied to a function signature,
 * not just a store.
 */
export function composeSystemPrompt(profile, context = null) {
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

  if (context?.personalityLine) lines.push(context.personalityLine);
  if (context?.preferenceLine) lines.push(context.preferenceLine);
  if (context?.worldKnowledgeLine) lines.push(context.worldKnowledgeLine);
  if (context?.curiosityNotes?.length) lines.push(`Things you might have noticed recently: ${context.curiosityNotes.join(" ")}`);
  if (context?.memoryNotes?.length) lines.push(`A few things you remember about the player: ${context.memoryNotes.join(" ")}`);

  return lines.join("\n\n");
}
