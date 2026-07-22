import { composeSystemPrompt } from "../ai/PromptComposer.js";
import { buildConversationContext } from "./ResidentContext.js";
import { WORKSHOP_FUNCTIONS } from "../ai/WorkshopFunctions.js";
import { ResidentBehaviour } from "./ResidentBehaviour.js";

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
 * phase's concern, not something to half-implement ahead of a real
 * memory system existing to use it.
 *
 * **AI Intelligence phase**: context-building itself moved out to
 * `ResidentContext.js` (see its own comment) once the new Resident
 * Sandbox in `AIApp.js` needed the identical logic — this file now just
 * calls `buildConversationContext()` the same way the sandbox does,
 * `mutateCuriosity` left at its default `true` since a real conversation
 * *should* consume whatever curiosity noticed.
 *
 * **Version 3, Phase 8a ("Bubble Gains Hands", chat-surface half)** —
 * five small, real pieces of conversation-UX friction closed, all client-
 * side, none touching what's actually sent to Ollama:
 *   - Long messages already wrapped; they now also cap at four visible
 *     lines with their own scrollbar, so one long reply can't push the
 *     rest of the conversation out of view. **Version 3, Phase 14
 *     ("Further Environmental Polish") moved this cap from the message
 *     bubbles to the input itself** — a long *reply* now displays in
 *     full (the outer `.resident-conversation-messages` list was always
 *     the real scroll owner for the whole conversation; a second, nested
 *     scrollbar on one bubble was never actually needed), while a long
 *     *draft* is what grows and caps at four lines now (a `<textarea>`,
 *     not a single-line `<input>` — see `resizeInput()` below and
 *     `css/overlays.css`'s own comment).
 *   - A reply reveals word-by-word once it's back, purely client-side —
 *     `sendMessage()` still returns the complete string in one piece
 *     (Ollama is never asked to stream; see `ResidentConnection.js`'s own
 *     comment on why that's the deliberately cheaper, lower-risk choice).
 *   - A failed send no longer becomes a fake apology bubble mixed into
 *     the conversation — it's a distinct error row with a real Retry
 *     button that resends the exact same text.
 *   - Up/Down in the input cycles back through this session's own sent
 *     messages, the same convention a terminal already uses.
 *   - A small "usage" toggle surfaces Ollama's own `prompt_eval_count`/
 *     `eval_count` for the last turn against the profile's own context
 *     size — approximate and last-turn-only (Ollama doesn't report a
 *     running total), worded that way rather than implying more
 *     precision than the data actually has.
 *
 * **Version 3, Phase 8b ("Bubble Gains Hands", Workshop Functions half)**
 * — `functionDispatcher` (a `WorkshopFunctions.js` dispatcher) and
 * `worldAwareness` are both optional, both simply forwarded on: the
 * dispatcher to `residentConnection.sendMessage()`'s own tool-calling
 * loop, `worldAwareness` into `buildConversationContext()` for the
 * grounding line. When a reply's own `functionCalls` comes back non-
 * empty, a small, honest transparency line renders per call — "Bubble
 * turned the lights off" — resolved from `WORKSHOP_FUNCTIONS`' own
 * labels, never fabricated from anything the model merely *said* it did.
 *
 * **Version 4, Phase 7 ("Being ↔ Resident Convergence") — one registered
 * overlay now serves *any* resident-capable Being, not one fixed
 * singleton.** `OverlayManager.open(overlayId, context)` already passed
 * `context` straight into `mount()`; this factory used to close over
 * fixed store instances at registration time instead of reading it.
 * `mount(panelEl, context)` now resolves `context.residentProfileId` via
 * `residentProfileStore.get()` (never `getActive()` — there is no single
 * "active" resident anymore) and `context.beingInstanceId` via
 * `beingResidentStateStore.getOrCreate()` for that instance's own
 * `residentPreferences`/`playerPatternMemory`/`residentCuriosity`/
 * `conversationMemory` bundle — genuinely per-Being data now, not one
 * shared singleton four different Beings would otherwise fight over.
 * Everything below this point in the file is unchanged from before —
 * the whole body already only ever called methods on whatever `profile`/
 * `residentPreferences`/etc. resolved to, never assumed which one.
 * `residentBehaviour` is now a fresh, throwaway instance built once per
 * conversation (never persisted, never was) rather than one shared,
 * injected singleton — honestly, its own mode/mood/expression state has
 * no visual consumer for a Being-based resident today (no separate face
 * mesh to express on, no movement-mode this file's own `startConversation()`/
 * `endConversation()` calls currently gate) — kept wired rather than
 * ripped out, so the exact same calls stay ready the moment a future
 * phase gives a Being's own face somewhere to show it.
 *
 * **Version 4, Phase 7a** — a new optional `audioSystem` dependency
 * restores the resident's own soft "thinking" sound cue (see
 * `AudioSynth.js`'s own `playResidentThinking()` comment), unheard since
 * Phase 7 deleted `ResidentController.js`'s own per-frame watcher for it;
 * see the real `setThinking(true)` call site below.
 */
const REVEAL_WORD_DELAY_MS = 40;

function describeFunctionCall(call, residentName) {
  const label = WORKSHOP_FUNCTIONS.find((fn) => fn.id === call.name)?.label ?? call.name;
  if (call.result?.error) return `${residentName} tried to ${label.toLowerCase()}, but couldn't: ${call.result.error}`;
  return `${residentName} used: ${label}.`;
}

export function createResidentConversationOverlay({
  residentConnection,
  residentProfileStore,
  beingResidentStateStore,
  projectsStore = null,
  worldObjectsStore = null,
  environmentSystem = null,
  timeOfDaySystem = null,
  worldEventLog = null,
  worldAwareness = null,
  worldTimeService = null,
  functionDispatcher = null,
  audioSystem = null,
}) {
  const history = []; // [{role: "user"|"assistant", content}] — this session only
  const sentMessages = []; // just the player's own sent text, in order — Up/Down history
  let disposed = false;

  return {
    // Version 3, Phase 6 ("The Workshop Remembers") — was "panel" (the
    // same full-screen, centred, heavy-backdrop treatment every document
    // overlay uses). Bubble is a character to watch while talking, not a
    // document to read — see css/overlays.css's own comment on
    // `.overlay--companion` for the full reasoning.
    materialClass: "companion",
    mount(panelEl, overlayContext = {}, engine) {
      const { beingInstanceId, residentProfileId } = overlayContext;
      // Fresh per conversation — see this file's own header comment on
      // why this is no longer one shared, injected singleton.
      const residentBehaviour = new ResidentBehaviour();
      const bundle = beingResidentStateStore.getOrCreate(beingInstanceId);
      const { residentPreferences, playerPatternMemory, residentCuriosity, conversationMemory } = bundle;

      // A thin wrapper scoping the shared `functionDispatcher` to this
      // specific instance — `WorkshopFunctions.js`'s own `moveTo` needs
      // to know *which* resident-capable Being is acting, since there's
      // no longer a singular `residentController` this could assume. See
      // that file's own `invoke()`/`moveTo` comments.
      const scopedFunctionDispatcher = functionDispatcher
        ? {
            definitionsFor: (p) => functionDispatcher.definitionsFor(p),
            invoke: (name, args) => functionDispatcher.invoke(name, args, { beingInstanceId }),
          }
        : null;

      residentBehaviour.startConversation();

      const profile = residentProfileStore.get(residentProfileId);
      if (!profile) {
        const noProfile = document.createElement("p");
        noProfile.className = "app-subtitle";
        noProfile.textContent = "This resident's own AI profile no longer exists — pick or create one for it in the Being Creator first.";
        panelEl.appendChild(noProfile);
        return () => residentBehaviour.endConversation();
      }
      const context = buildConversationContext(profile, {
        residentCuriosity,
        residentPreferences,
        playerPatternMemory,
        conversationMemory,
        worldObjectsStore,
        environmentSystem,
        timeOfDaySystem,
        worldEventLog,
        worldAwareness,
        worldTimeService,
      });
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

      // Version 3, Phase 8a — a small, dismissible readout of Ollama's own
      // usage counts for the last turn (see ResidentConnection.js's own
      // comment on where these come from). Hidden until a first real
      // reply actually reports numbers — never shows a stale "0" before
      // any turn has happened.
      const usageButton = document.createElement("button");
      usageButton.type = "button";
      usageButton.className = "resident-usage-button";
      usageButton.textContent = "ⓘ";
      usageButton.title = "Roughly how much of the model's context this conversation is using";
      usageButton.hidden = true;
      heading.appendChild(usageButton);

      const usagePopup = document.createElement("div");
      usagePopup.className = "resident-usage-popup";
      usagePopup.hidden = true;
      panelEl.appendChild(usagePopup);

      usageButton.addEventListener("click", () => {
        usagePopup.hidden = !usagePopup.hidden;
      });

      function updateUsage(promptEvalCount, evalCount) {
        if (promptEvalCount == null && evalCount == null) return;
        const prompt = promptEvalCount ?? 0;
        const reply = evalCount ?? 0;
        const limit = profile?.behaviourConfig?.contextSize;
        usagePopup.textContent = limit
          ? `Last turn: ~${prompt + reply} tokens (${prompt} in, ${reply} out) of a ${limit}-token context limit. Ollama doesn't report a running conversation total, so this is the last turn only.`
          : `Last turn: ~${prompt + reply} tokens (${prompt} in, ${reply} out). Ollama doesn't report a running conversation total, so this is the last turn only.`;
        usageButton.hidden = false;
      }

      const messageList = document.createElement("div");
      messageList.className = "resident-conversation-messages";
      panelEl.appendChild(messageList);

      const inputRow = document.createElement("div");
      inputRow.className = "resident-conversation-input-row";
      // Version 3, Phase 14 ("Further Environmental Polish") \u2014 a growing
      // textarea instead of a single-line input, capped at ~4 lines with
      // its own scrollbar beyond that (see resizeInput() below and
      // css/overlays.css's own comment on why this moved here from the
      // message bubbles).
      const input = document.createElement("textarea");
      input.rows = 1;
      input.placeholder = "Say something\u2026";
      const resizeInput = () => {
        input.style.height = "auto";
        input.style.height = `${input.scrollHeight}px`;
      };
      input.addEventListener("input", resizeInput);
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
          // Version 3, Phase 8b — a small, honest transparency line per
          // Workshop Function actually called for this reply, resolved
          // from WORKSHOP_FUNCTIONS' own labels rather than anything the
          // model merely claimed in its own text. Never shown mid-reveal
          // (functionCalls is only ever attached once revealReply()
          // finishes — see below), so it can't appear before the reply
          // it belongs to has finished typing out.
          if (message.functionCalls?.length) {
            const note = document.createElement("div");
            note.className = "resident-function-note";
            note.textContent = message.functionCalls.map((call) => describeFunctionCall(call, profile.name)).join(" ");
            messageList.appendChild(note);
          }
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
        // Version 3, Phase 8a \u2014 a failed turn used to become a fake
        // assistant apology mixed into the conversation itself. It's now
        // a distinct row with a real Retry button, only shown once the
        // thinking dots are gone, that resends the exact same text
        // without re-pushing a duplicate player bubble (see send()'s own
        // retryText parameter).
        if (lastError && !isThinking) {
          const errorRow = document.createElement("div");
          errorRow.className = "resident-message-error";
          const errorText = document.createElement("span");
          errorText.textContent = "Couldn't reach the model just now.";
          const retryBtn = document.createElement("button");
          retryBtn.type = "button";
          retryBtn.textContent = "Retry";
          retryBtn.addEventListener("click", () => send(lastError.text));
          errorRow.append(errorText, retryBtn);
          messageList.appendChild(errorRow);
        }
        messageList.scrollTop = messageList.scrollHeight;
      }

      let isThinking = false;
      let longWait = false;
      let longWaitTimer = null;
      let lastError = null;
      let historyCursor = -1; // -1 = not navigating Up/Down history
      let draftBeforeHistoryNav = "";
      let revealToken = 0;

      // Version 3, Phase 8a \u2014 Ollama is never asked to stream (see
      // ResidentConnection.js's own comment); this reveals an already-
      // complete reply word-by-word purely for a nicer conversational
      // rhythm. Mutates one history entry in place, re-rendering on every
      // word \u2014 cheap DOM work at this conversation's scale, the same
      // "just re-render everything" pattern already used for the
      // thinking dots. `revealToken` guards against a reveal started
      // before the overlay closed still ticking after `disposed` \u2014 it
      // can never overlap with a *second* reveal, since sendBtn stays
      // disabled for the whole reveal and Enter/click both no-op while
      // disabled.
      async function revealReply(fullText, functionCalls) {
        const myToken = ++revealToken;
        const entry = { role: "assistant", content: "" };
        history.push(entry);
        const parts = fullText.split(/(\s+)/).filter((part) => part.length > 0);
        let revealed = "";
        for (const part of parts) {
          if (disposed || myToken !== revealToken) return;
          revealed += part;
          entry.content = revealed;
          renderMessages();
          if (part.trim().length > 0) await new Promise((resolve) => setTimeout(resolve, REVEAL_WORD_DELAY_MS));
        }
        // Attached only once fully revealed — see renderMessages()'s own
        // comment on why that keeps a function-call note from appearing
        // before the reply it belongs to has finished typing out.
        if (functionCalls?.length) entry.functionCalls = functionCalls;
        renderMessages();
      }

      async function send(retryText) {
        const text = retryText ?? input.value.trim();
        if (!text || sendBtn.disabled) return;
        lastError = null;
        if (!retryText) {
          input.value = "";
          resizeInput();
          history.push({ role: "user", content: text });
          sentMessages.push(text);
          historyCursor = -1;
          if (profile?.memory?.mode !== "disabled") conversationMemory?.extractFromMessage(text, { projectsStore, categories: profile?.memory?.categories });
        }
        renderMessages();

        sendBtn.disabled = true;
        isThinking = true;
        longWait = false;
        residentBehaviour.setThinking(true);
        // Version 4, Phase 7b — restores the "thinking" expression
        // override/squash-stretch pulse for a resident-embodiment Being
        // (see BeingController.js's own resident:thinkingChanged
        // listener) at the exact same edge the Phase 7a audio cue below
        // already uses.
        engine?.events.emit("resident:thinkingChanged", { beingInstanceId, thinking: true });
        // Version 4, Phase 7a — the real false→true edge this resident's
        // own soft "thinking" cue fires on (see AudioSynth.js's own
        // playResidentThinking() comment); its old watcher lived on the
        // deleted ResidentController.js's own per-frame loop. AudioSystem
        // only ever reads .x/.y/.z off whatever position it's given, so
        // the plain {x,y,z} already on residentState works directly.
        audioSystem?.playInteractionSound("residentThinking", { position: bundle.residentState.currentPosition });
        renderMessages();
        longWaitTimer = setTimeout(() => {
          longWait = true;
          renderMessages();
        }, 8000);
        try {
          const systemPrompt = composeSystemPrompt(profile, context);
          const { content, promptEvalCount, evalCount, functionCalls } = await residentConnection.sendMessage(profile, history, systemPrompt, scopedFunctionDispatcher);
          clearTimeout(longWaitTimer);
          isThinking = false;
          longWait = false;
          residentBehaviour.setThinking(false);
          engine?.events.emit("resident:thinkingChanged", { beingInstanceId, thinking: false });
          updateUsage(promptEvalCount, evalCount);
          await revealReply(content || "\u2026", functionCalls);
        } catch {
          clearTimeout(longWaitTimer);
          isThinking = false;
          longWait = false;
          residentBehaviour.setThinking(false);
          engine?.events.emit("resident:thinkingChanged", { beingInstanceId, thinking: false });
          lastError = { text };
          renderMessages();
        }
        sendBtn.disabled = false;
      }

      sendBtn.addEventListener("click", () => send());
      // Version 3, Phase 14 \u2014 true, since the caret's own line matters
      // once the input can hold more than one now (see below).
      const isCaretOnFirstLine = () => input.value.slice(0, input.selectionStart).indexOf("\n") === -1;
      const isCaretOnLastLine = () => input.value.slice(input.selectionEnd).indexOf("\n") === -1;
      input.addEventListener("keydown", (event) => {
        // Plain Enter sends, the same as before; Shift+Enter inserts a
        // real newline instead \u2014 now that this is a textarea rather than
        // a single-line input, a plain Enter would otherwise just add a
        // line break of its own.
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          send();
          return;
        }
        if (event.key === "Enter") return;
        // Version 3, Phase 8a \u2014 the same Up/Down convention a terminal
        // already uses, cycling back through this session's own sent
        // messages. `draftBeforeHistoryNav` restores whatever the player
        // was mid-typing once they arrow back down past the most recent
        // one, rather than leaving them on a blank input.
        //
        // Version 3, Phase 14 \u2014 only fires at the caret's own first/last
        // line now, so navigating a genuinely multi-line draft with the
        // arrow keys still moves the caret normally rather than getting
        // hijacked into history-cycling on every line.
        if (event.key === "ArrowUp" && isCaretOnFirstLine()) {
          if (sentMessages.length === 0) return;
          event.preventDefault();
          if (historyCursor === -1) draftBeforeHistoryNav = input.value;
          historyCursor = historyCursor === -1 ? sentMessages.length - 1 : Math.max(0, historyCursor - 1);
          input.value = sentMessages[historyCursor];
          input.setSelectionRange(input.value.length, input.value.length);
          resizeInput();
        } else if (event.key === "ArrowDown" && isCaretOnLastLine()) {
          if (historyCursor === -1) return;
          event.preventDefault();
          historyCursor += 1;
          if (historyCursor >= sentMessages.length) {
            historyCursor = -1;
            input.value = draftBeforeHistoryNav;
          } else {
            input.value = sentMessages[historyCursor];
          }
          input.setSelectionRange(input.value.length, input.value.length);
          resizeInput();
        }
      });

      renderMessages();
      input.focus();

      return () => {
        disposed = true;
        residentBehaviour.endConversation();
      };
    },
  };
}
