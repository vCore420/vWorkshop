import { composeSystemPrompt } from "../ai/PromptComposer.js";
import { traitPersonalityLine } from "./ResidentTraits.js";
import { getIdleLocation } from "./ResidentMovement.js";
import { WEATHER_STATES } from "../systems/EnvironmentSystem.js";

const ACTIVITY_LABELS = {
  listeningToMusic: "listening to music",
  watchingRain: "watching the rain",
  watchingTheSky: "watching the sky",
};

/**
 * createResidentConversationOverlay
 * ------------------------------------
 * "Walking up to the resident should allow the player to begin
 * chatting." Opened the exact same way every other physical object's
 * overlay already opens (`InteractableComponent` -> `overlayId` ->
 * `OverlayManager`, see `ResidentEntity.js`).
 *
 * `residentBehaviour.startConversation()`/`endConversation()` are called
 * from this overlay's own `mount()`/disposer — "the resident should stop
 * moving, turn towards the player, maintain attention throughout the
 * conversation, after the conversation naturally return to its previous
 * behaviour" is implemented as exactly that: opening this overlay is
 * what starts a conversation, closing it (by any means — Escape, walking
 * away, whatever `OverlayManager` already handles) is what ends one.
 *
 * Message history is deliberately session-only, kept in this module's own
 * closure rather than any persisted store — re-opening mid-session picks
 * up where it left off, but a page reload starts fresh, matching
 * "conversation history (future memory system)" being explicitly a later
 * phase's concern (see `MemoryConfiguration.js`'s own "architecture, not
 * implementation" framing), not something to half-implement ahead of a
 * real memory system existing to use it.
 *
 * **Version 2**: `_buildContext()` gathers everything
 * `PromptComposer.composeSystemPrompt()`'s own optional `context` argument
 * accepts — the resident's selected traits (a short prose line, via
 * `ResidentTraits.traitPersonalityLine()`), its accumulated preferences
 * (`ResidentPreferences.favourite()` across each dimension), a handful of
 * curiosity notes (`ResidentCuriosity.gatherNotes()`, called exactly once
 * per conversation open — "these observations should occur naturally
 * within conversation rather than becoming notifications"), and a few
 * remembered things about the player (`ConversationMemory.mostRelevant()`,
 * only when the active profile's `memory.mode !== "disabled"`). None of
 * this is shown to the player directly; it's context for the model to
 * draw on however it naturally would, never a script.
 */
export function createResidentConversationOverlay({
  residentConnection,
  residentProfileStore,
  residentBehaviour,
  projectsStore = null,
  residentPreferences = null,
  playerPatternMemory = null,
  residentCuriosity = null,
  conversationMemory = null,
  worldObjectsStore = null,
  environmentSystem = null,
  timeOfDaySystem = null,
}) {
  const history = []; // [{role: "user"|"assistant", content}] — this session only

  function buildPreferenceLine(profile) {
    if (!residentPreferences) return null;
    const bits = [];
    const locationId = residentPreferences.favourite("locations");
    if (locationId) bits.push(`spending time ${getIdleLocation(locationId).label}`);
    const weatherId = residentPreferences.favourite("weather");
    if (weatherId) bits.push(`${(WEATHER_STATES[weatherId]?.label ?? weatherId).toLowerCase()} weather`);
    const timeOfDay = residentPreferences.favourite("timeOfDay");
    if (timeOfDay) bits.push(`the ${timeOfDay}`);
    const activity = residentPreferences.favourite("activities");
    if (activity) bits.push(ACTIVITY_LABELS[activity] ?? activity);
    if (bits.length === 0) return null;
    void profile;
    return `Over time, you've noticed you especially enjoy ${bits.join(", ")}.`;
  }

  /** Gathered exactly once, right as the conversation opens — never
   *  re-gathered per message, which is what keeps "noticed since you last
   *  talked" honest rather than re-triggering mid-conversation. */
  function buildContext(profile) {
    const curiosityNotes = residentCuriosity
      ? residentCuriosity.gatherNotes({ worldObjectsStore, environmentSystem, timeOfDaySystem, residentPreferences, playerPatternMemory })
      : [];
    const memoryEnabled = profile?.memory?.mode !== "disabled";
    return {
      personalityLine: traitPersonalityLine(profile?.traits),
      preferenceLine: buildPreferenceLine(profile),
      curiosityNotes,
      memoryNotes: memoryEnabled ? conversationMemory?.mostRelevant() ?? [] : [],
    };
  }

  return {
    materialClass: "panel",
    mount(panelEl) {
      residentBehaviour.startConversation();

      const profile = residentProfileStore.getActive();
      const context = buildContext(profile);
      // "A resident that just noticed something interesting briefly shows
      // that over its own steadier mood" — see ResidentBehaviour.js's own
      // triggerEmotion() comment. A short, honest greeting-adjacent blip,
      // never persisted, gone again in a handful of seconds either way.
      residentBehaviour.triggerEmotion(context.curiosityNotes.length ? "curious" : "happy", 6);

      const heading = document.createElement("h2");
      heading.textContent = profile?.name || "Workshop Resident";
      panelEl.appendChild(heading);

      if (!residentConnection.isAwake) {
        const waiting = document.createElement("p");
        waiting.className = "app-subtitle";
        waiting.textContent = `${profile?.name || "This resident"} is waiting for its connection to wake up \u2014 nothing to worry about, it'll be here when Ollama's reachable again.`;
        panelEl.appendChild(waiting);
        return () => residentBehaviour.endConversation();
      }

      if (!profile?.model) {
        const noModel = document.createElement("p");
        noModel.className = "app-subtitle";
        noModel.textContent = "No model has been chosen yet \u2014 pick one in AI Mission Control first.";
        panelEl.appendChild(noModel);
        return () => residentBehaviour.endConversation();
      }

      const messageList = document.createElement("div");
      messageList.className = "resident-conversation-messages";
      panelEl.appendChild(messageList);

      const inputRow = document.createElement("div");
      inputRow.className = "resident-conversation-input-row";
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Say something\u2026";
      const sendBtn = document.createElement("button");
      sendBtn.type = "button";
      sendBtn.textContent = "Send";
      inputRow.append(input, sendBtn);
      panelEl.appendChild(inputRow);

      function renderMessages() {
        messageList.innerHTML = "";
        if (history.length === 0) {
          const empty = document.createElement("p");
          empty.className = "app-subtitle";
          empty.textContent = `Say hello to ${profile.name}.`;
          messageList.appendChild(empty);
        }
        for (const message of history) {
          const bubble = document.createElement("div");
          bubble.className = message.role === "user" ? "resident-message resident-message-player" : "resident-message resident-message-resident";
          bubble.textContent = message.content;
          messageList.appendChild(bubble);
        }
        if (isThinking) {
          const thinkingBubble = document.createElement("div");
          thinkingBubble.className = "resident-message resident-message-resident resident-message-thinking";
          // Three plain spans, not just three dots in the text content —
          // "keep this subtle and in keeping with Bubble's personality" is
          // a CSS animation (see overlays.css) staggering their opacity,
          // not an emoji spinner or anything that reads as a loading
          // spinner from a generic app.
          for (let i = 0; i < 3; i++) thinkingBubble.appendChild(document.createElement("span"));
          messageList.appendChild(thinkingBubble);
          // "Better waiting behaviour while models load... improved
          // loading feedback." Ollama can take well over the first few
          // seconds to load a model's own weights from disk before
          // generating anything at all — past that point, the dots
          // alone, unchanging the whole time, start to feel stuck even
          // though nothing has actually gone wrong. One honest,
          // reassuring line, not a progress bar with numbers this class
          // has no way to know.
          if (longWait) {
            const hint = document.createElement("p");
            hint.className = "resident-thinking-hint";
            hint.textContent = "Still working \u2014 the model may be loading for the first time.";
            messageList.appendChild(hint);
          }
        }
        messageList.scrollTop = messageList.scrollHeight;
      }

      let isThinking = false;
      let longWait = false;
      let longWaitTimer = null;

      async function send() {
        const text = input.value.trim();
        if (!text || sendBtn.disabled) return;
        input.value = "";
        history.push({ role: "user", content: text });
        if (profile?.memory?.mode !== "disabled") conversationMemory?.extractFromMessage(text, { projectsStore });
        renderMessages();

        sendBtn.disabled = true;
        isThinking = true;
        longWait = false;
        residentBehaviour.setThinking(true);
        renderMessages();
        longWaitTimer = setTimeout(() => {
          longWait = true;
          renderMessages();
        }, 8000);
        try {
          const systemPrompt = composeSystemPrompt(profile, context);
          const reply = await residentConnection.sendMessage(profile, history, systemPrompt);
          history.push({ role: "assistant", content: reply || "\u2026" });
        } catch {
          history.push({ role: "assistant", content: "(couldn't reach the model just now \u2014 try again in a moment)" });
        }
        clearTimeout(longWaitTimer);
        isThinking = false;
        longWait = false;
        residentBehaviour.setThinking(false);
        sendBtn.disabled = false;
        renderMessages();
      }

      sendBtn.addEventListener("click", send);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") send();
      });

      renderMessages();
      input.focus();

      return () => {
        residentBehaviour.endConversation();
      };
    },
  };
}
