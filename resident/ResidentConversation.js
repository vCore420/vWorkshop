import { composeSystemPrompt } from "../ai/PromptComposer.js";

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
 * phase's concern, not something to half-implement ahead of a real memory
 * system existing to use it.
 */
export function createResidentConversationOverlay({ residentConnection, residentProfileStore, residentBehaviour }) {
  const history = []; // [{role: "user"|"assistant", content}] — this session only

  return {
    materialClass: "panel",
    mount(panelEl) {
      residentBehaviour.startConversation();

      const profile = residentProfileStore.getActive();
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
        messageList.scrollTop = messageList.scrollHeight;
      }

      async function send() {
        const text = input.value.trim();
        if (!text || sendBtn.disabled) return;
        input.value = "";
        history.push({ role: "user", content: text });
        renderMessages();

        sendBtn.disabled = true;
        residentBehaviour.setThinking(true);
        try {
          const systemPrompt = composeSystemPrompt(profile);
          const reply = await residentConnection.sendMessage(profile, history, systemPrompt);
          history.push({ role: "assistant", content: reply || "\u2026" });
        } catch {
          history.push({ role: "assistant", content: "(couldn't reach the model just now \u2014 try again in a moment)" });
        }
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
