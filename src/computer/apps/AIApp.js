import { MEMORY_MODES, MEMORY_SIZE_OPTIONS, CONTEXT_BUDGET_OPTIONS } from "../../ai/MemoryConfiguration.js";
import { EMBODIMENT_TYPES, IDLE_BEHAVIOUR_OPTIONS } from "../../ai/EmbodimentConfiguration.js";
import { PERSONALITY_TRAITS, MAX_SELECTED_TRAITS } from "../../ai/TraitConfiguration.js";
import { composeSystemPrompt } from "../../ai/PromptComposer.js";

const STATUS_LABELS = {
  connected: "Connected",
  connecting: "Connecting\u2026",
  disconnected: "Waiting for Ollama\u2026",
};

/**
 * createAIApp — AI Mission Control
 * -----------------------------------
 * "This is NOT the AI itself... think of this as Mission Control for
 * future Workshop residents." Every section here edits a
 * `ResidentProfileStore` profile (identity, behaviour tuning, memory and
 * embodiment preparation) or reads from `AIConnectionManager`/
 * `ModelRegistry` — this file coordinates the three (calling
 * `checkConnection()` on refresh and handing the raw result to
 * `ModelRegistry.setModels()`), but owns none of their actual state
 * itself, the same "app renders a store, doesn't duplicate it" shape
 * every other Workshop app already follows.
 *
 * "Avoid making this feel like configuring software. Instead, make it
 * feel like preparing another presence." Section order follows the
 * brief's own — connection, model, identity, behaviour, memory,
 * embodiment, profiles, test — deliberately putting *who this resident
 * is* before the numeric tuning knobs, not after.
 */
export function createAIApp({ aiConnectionManager, modelRegistry, residentProfileStore }) {
  return {
    id: "ai",
    label: "AI Control",
    glyph: "\u2726",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "AI Mission Control";
      const subtitle = document.createElement("p");
      subtitle.className = "app-subtitle";
      subtitle.textContent = "Preparing a future resident for the Workshop — not a chat, not yet.";
      container.append(heading, subtitle);

      const form = document.createElement("div");
      container.appendChild(form);

      let testState = { status: "idle", response: "", error: "" }; // "idle" | "sending" | "done" | "error"
      let advancedOpen = false;

      function activeProfile() {
        return residentProfileStore.getActive();
      }

      function updateActive(patch) {
        const profile = activeProfile();
        if (profile) residentProfileStore.update(profile.id, patch);
      }

      async function refreshModels() {
        const models = await aiConnectionManager.checkConnection();
        // Only replaces the known model list on an actual success — a
        // transient failure during refresh shouldn't wipe out what was
        // already known to work, which would read as more alarming than
        // the calm, quiet-retry philosophy this whole app follows.
        if (models) modelRegistry.setModels(models);
        render();
      }

      async function runTest() {
        const profile = activeProfile();
        if (!profile?.model) return;
        testState = { status: "sending", response: "", error: "" };
        render();
        try {
          const response = await aiConnectionManager.sendTestPrompt(profile.model, "Hello.");
          testState = { status: "done", response, error: "" };
        } catch (err) {
          testState = { status: "error", response: "", error: err?.message || "The test prompt couldn't be sent." };
        }
        render();
      }

      function render() {
        form.innerHTML = "";
        form.appendChild(buildStatusCard());
        form.appendChild(buildConnectionSection());
        form.appendChild(buildModelSection());
        form.appendChild(buildProfilesSection());
        const profile = activeProfile();
        if (profile) {
          form.appendChild(buildIdentitySection(profile));
          form.appendChild(buildTraitsSection(profile));
          form.appendChild(buildBehaviourSection(profile));
          form.appendChild(buildMemorySection(profile));
          form.appendChild(buildEmbodimentSection(profile));
          form.appendChild(buildAdvancedSection(profile));
          form.appendChild(buildTestSection(profile));
        }
      }

      function buildStatusCard() {
        const profile = activeProfile();
        const section = document.createElement("div");
        section.className = "builder-section ai-status-card";
        const title = document.createElement("h3");
        title.textContent = profile?.name || "Workshop Resident";
        section.appendChild(title);

        const statusRow = document.createElement("p");
        statusRow.className = `ai-status-line ai-status-${aiConnectionManager.status}`;
        statusRow.innerHTML = `<span class="ai-status-dot">\u25CF</span> ${STATUS_LABELS[aiConnectionManager.status]}`;
        section.appendChild(statusRow);

        const followUp = document.createElement("p");
        followUp.className = "app-subtitle";
        followUp.style.margin = "4px 0 0";
        followUp.textContent =
          aiConnectionManager.status === "connected"
            ? "Embodied as Bubble, the Workshop's own resident \u2014 its appearance and traits above are already reflected there."
            : "The Workshop will keep waiting quietly \u2014 nothing here blocks anything else you're doing.";
        section.appendChild(followUp);
        return section;
      }

      function buildConnectionSection() {
        const section = document.createElement("div");
        section.className = "builder-section";
        section.appendChild(sectionHeading("Connection"));
        section.appendChild(
          textRow("Ollama server", aiConnectionManager.baseUrl, (v) => aiConnectionManager.setBaseUrl(v), "http://localhost:11434")
        );
        const hint = document.createElement("p");
        hint.className = "app-subtitle";
        hint.textContent = "Checked automatically every few seconds \u2014 nothing needs to be started in a particular order.";
        section.appendChild(hint);
        return section;
      }

      function buildModelSection() {
        const section = document.createElement("div");
        section.className = "builder-section";
        section.appendChild(sectionHeading("Model"));
        const profile = activeProfile();

        const models = modelRegistry.all();
        const row = document.createElement("div");
        row.className = "panel-row";
        const label = document.createElement("label");
        label.textContent = "Current model";
        const select = document.createElement("select");
        select.disabled = models.length === 0;
        const emptyOpt = document.createElement("option");
        emptyOpt.value = "";
        emptyOpt.textContent = models.length ? "\u2014 choose a model \u2014" : "No models found yet";
        select.appendChild(emptyOpt);
        for (const model of models) {
          const opt = document.createElement("option");
          opt.value = model.name;
          opt.textContent = model.name;
          if (profile?.model === model.name) opt.selected = true;
          select.appendChild(opt);
        }
        select.addEventListener("change", () => updateActive({ model: select.value || null }));
        row.append(label, select);
        section.appendChild(row);

        const refreshBtn = document.createElement("button");
        refreshBtn.type = "button";
        refreshBtn.className = "builder-small-button";
        refreshBtn.textContent = "Refresh Models";
        refreshBtn.addEventListener("click", refreshModels);
        section.appendChild(refreshBtn);

        const currentModel = profile?.model ? modelRegistry.get(profile.model) : null;
        if (currentModel) {
          const info = document.createElement("p");
          info.className = "app-subtitle";
          info.style.marginTop = "10px";
          const bits = [];
          if (currentModel.parameterSize) bits.push(currentModel.parameterSize);
          if (currentModel.quantization) bits.push(currentModel.quantization);
          if (currentModel.sizeBytes) bits.push(formatBytes(currentModel.sizeBytes));
          info.textContent = bits.length ? bits.join(" \u00b7 ") : "No further information available for this model.";
          section.appendChild(info);
        } else if (models.length === 0) {
          const info = document.createElement("p");
          info.className = "app-subtitle";
          info.style.marginTop = "10px";
          info.textContent = "Once connected, press Refresh Models to see what's available.";
          section.appendChild(info);
        }
        return section;
      }

      function buildProfilesSection() {
        const section = document.createElement("div");
        section.className = "builder-section builder-library";
        section.appendChild(sectionHeading("Profiles"));

        const actions = document.createElement("div");
        actions.className = "builder-library-controls";
        const newBtn = document.createElement("button");
        newBtn.type = "button";
        newBtn.className = "builder-primary";
        newBtn.textContent = "Create Profile";
        newBtn.addEventListener("click", () => {
          const name = window.prompt("Name this resident:", "New Resident");
          if (name) residentProfileStore.create(name);
        });
        actions.appendChild(newBtn);
        section.appendChild(actions);

        const list = document.createElement("ul");
        list.className = "builder-library-list";
        for (const profile of residentProfileStore.all()) {
          list.appendChild(buildProfileRow(profile));
        }
        section.appendChild(list);
        return section;
      }

      function buildProfileRow(profile) {
        const li = document.createElement("li");
        if (profile.id === residentProfileStore.activeProfileId) li.classList.add("selected");

        const meta = document.createElement("span");
        meta.className = "builder-library-meta";
        meta.textContent = profile.name;
        meta.style.cursor = "pointer";
        meta.addEventListener("click", () => residentProfileStore.setActive(profile.id));
        li.appendChild(meta);

        const actions = document.createElement("div");
        actions.className = "builder-inline-row";

        const renameBtn = document.createElement("button");
        renameBtn.type = "button";
        renameBtn.className = "builder-icon-button";
        renameBtn.textContent = "Rename";
        renameBtn.addEventListener("click", () => {
          const name = window.prompt("Rename this resident:", profile.name);
          if (name) residentProfileStore.rename(profile.id, name);
        });
        actions.appendChild(renameBtn);

        const dupBtn = document.createElement("button");
        dupBtn.type = "button";
        dupBtn.className = "builder-icon-button";
        dupBtn.textContent = "Duplicate";
        dupBtn.addEventListener("click", () => residentProfileStore.duplicate(profile.id));
        actions.appendChild(dupBtn);

        if (residentProfileStore.all().length > 1) {
          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "builder-icon-button";
          delBtn.textContent = "Delete";
          delBtn.addEventListener("click", () => {
            if (window.confirm(`Delete "${profile.name}"? This can't be undone.`)) residentProfileStore.remove(profile.id);
          });
          actions.appendChild(delBtn);
        }
        li.appendChild(actions);
        return li;
      }

      function buildIdentitySection(profile) {
        const section = document.createElement("div");
        section.className = "builder-section";
        section.appendChild(sectionHeading("Resident Identity"));
        const hint = document.createElement("p");
        hint.className = "app-subtitle";
        hint.textContent = "Who this resident is, in your own words \u2014 this becomes their system prompt later.";
        section.appendChild(hint);

        section.appendChild(textRow("Name", profile.name, (v) => residentProfileStore.rename(profile.id, v)));
        section.appendChild(textareaRow("Purpose", profile.identity.purpose, (v) => updateActive({ identity: { purpose: v } }), "What is this resident here to help with?"));
        section.appendChild(textareaRow("Identity", profile.identity.identity, (v) => updateActive({ identity: { identity: v } }), "Who are they, beyond their purpose?"));
        section.appendChild(textareaRow("Personality", profile.identity.personality, (v) => updateActive({ identity: { personality: v } }), "Warm? Dry? Curious? Direct?"));
        section.appendChild(textareaRow("Behaviour", profile.identity.behaviour, (v) => updateActive({ identity: { behaviour: v } }), "How do they act — proactive, reserved, thorough?"));
        section.appendChild(textareaRow("Conversation Style", profile.identity.conversationStyle, (v) => updateActive({ identity: { conversationStyle: v } }), "Short and plain? Detailed? Playful?"));
        return section;
      }

      function buildTraitsSection(profile) {
        const section = document.createElement("div");
        section.className = "builder-section";
        section.appendChild(sectionHeading("Resident Traits"));
        const hint = document.createElement("p");
        hint.className = "app-subtitle";
        hint.textContent = `A long-term temperament, not a mood \u2014 choose up to ${MAX_SELECTED_TRAITS}. These quietly shape movement, awareness, idle habits, and conversation, without replacing anything above.`;
        section.appendChild(hint);

        const selected = profile.traits.selected;
        const list = document.createElement("div");
        list.className = "ai-trait-list";
        for (const trait of PERSONALITY_TRAITS) {
          const row = document.createElement("label");
          row.className = "panel-row ai-trait-row";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = selected.includes(trait.id);
          checkbox.disabled = !checkbox.checked && selected.length >= MAX_SELECTED_TRAITS;
          checkbox.addEventListener("change", () => {
            const next = checkbox.checked ? [...selected, trait.id] : selected.filter((id) => id !== trait.id);
            updateActive({ traits: { selected: next } });
          });
          const text = document.createElement("span");
          text.textContent = `${trait.label} \u2014 ${trait.description}`;
          row.append(checkbox, text);
          list.appendChild(row);
        }
        section.appendChild(list);
        return section;
      }

      function buildBehaviourSection(profile) {
        const section = document.createElement("div");
        section.className = "builder-section";
        section.appendChild(sectionHeading("Behaviour"));
        const c = profile.behaviourConfig;
        section.appendChild(sliderRow("Temperature", c.temperature, 0, 1.5, 0.05, (v) => updateActive({ behaviourConfig: { temperature: v } }), (v) => v.toFixed(2)));
        section.appendChild(sliderRow("Creativity", c.creativity, 0, 1, 0.05, (v) => updateActive({ behaviourConfig: { creativity: v } }), (v) => v.toFixed(2)));
        section.appendChild(sliderRow("Determinism", c.determinism, 0, 1, 0.05, (v) => updateActive({ behaviourConfig: { determinism: v } }), (v) => v.toFixed(2)));
        section.appendChild(sliderRow("Context Size (tokens)", c.contextSize, 512, 32768, 512, (v) => updateActive({ behaviourConfig: { contextSize: v } }), (v) => Math.round(v).toString()));
        section.appendChild(sliderRow("Maximum Response Length (tokens)", c.maxResponseLength, 64, 4096, 64, (v) => updateActive({ behaviourConfig: { maxResponseLength: v } }), (v) => Math.round(v).toString()));
        return section;
      }

      function buildMemorySection(profile) {
        const section = document.createElement("div");
        section.className = "builder-section";
        section.appendChild(sectionHeading("Memory"));
        const badge = document.createElement("span");
        badge.className = "ai-future-badge";
        badge.textContent = "Mode is active \u2014 size, summaries and context budget remain architecture only";
        section.appendChild(badge);

        section.appendChild(
          selectRow("Memory", profile.memory.mode, MEMORY_MODES, (v) => updateActive({ memory: { mode: v } }))
        );
        const currentMode = MEMORY_MODES.find((m) => m.id === profile.memory.mode);
        if (currentMode) {
          const desc = document.createElement("p");
          desc.className = "app-subtitle";
          desc.textContent = currentMode.description;
          section.appendChild(desc);
        }
        section.appendChild(selectRow("Memory Size", profile.memory.memorySize, MEMORY_SIZE_OPTIONS, (v) => updateActive({ memory: { memorySize: v } }), true));
        section.appendChild(selectRow("Context Budget", profile.memory.contextBudget, CONTEXT_BUDGET_OPTIONS, (v) => updateActive({ memory: { contextBudget: v } }), true));

        const checkboxRow = document.createElement("div");
        checkboxRow.className = "panel-row";
        const checkboxLabel = document.createElement("label");
        checkboxLabel.textContent = "Memory Summaries";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = profile.memory.memorySummaries;
        checkbox.disabled = true;
        checkboxRow.append(checkboxLabel, checkbox);
        section.appendChild(checkboxRow);
        return section;
      }

      function buildEmbodimentSection(profile) {
        const section = document.createElement("div");
        section.className = "builder-section";
        section.appendChild(sectionHeading("Embodiment"));
        const badge = document.createElement("span");
        badge.className = "ai-future-badge";
        badge.textContent = "Now shaping Bubble's actual appearance in the room";
        section.appendChild(badge);

        const e = profile.embodiment;
        section.appendChild(selectRow("Embodiment Type", e.type, EMBODIMENT_TYPES, (v) => updateActive({ embodiment: { type: v } })));
        section.appendChild(colorRow("Colour", e.color, (v) => updateActive({ embodiment: { color: v } })));
        section.appendChild(sliderRow("Glow", e.glow, 0, 1, 0.05, (v) => updateActive({ embodiment: { glow: v } }), (v) => v.toFixed(2)));
        section.appendChild(sliderRow("Scale", e.scale, 0.3, 2, 0.05, (v) => updateActive({ embodiment: { scale: v } }), (v) => v.toFixed(2)));
        section.appendChild(selectRow("Idle Behaviour", e.idleBehaviour, IDLE_BEHAVIOUR_OPTIONS, (v) => updateActive({ embodiment: { idleBehaviour: v } })));
        return section;
      }

      function buildAdvancedSection(profile) {
        const section = document.createElement("div");
        section.className = "builder-section";
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "builder-small-button";
        toggle.textContent = advancedOpen ? "Hide Advanced" : "Advanced: Show Generated Prompt";
        toggle.addEventListener("click", () => {
          advancedOpen = !advancedOpen;
          render();
        });
        section.appendChild(toggle);
        if (advancedOpen) {
          const pre = document.createElement("pre");
          pre.className = "ai-generated-prompt";
          pre.textContent = composeSystemPrompt(profile) || "Nothing entered yet \u2014 fill in the Resident Identity section above.";
          section.appendChild(pre);
        }
        return section;
      }

      function buildTestSection(profile) {
        const section = document.createElement("div");
        section.className = "builder-section";
        section.appendChild(sectionHeading("Connection Test"));
        const hint = document.createElement("p");
        hint.className = "app-subtitle";
        hint.textContent = 'Sends a small test prompt ("Hello.") to the selected model \u2014 just to confirm things are working, not a conversation.';
        section.appendChild(hint);

        const testBtn = document.createElement("button");
        testBtn.type = "button";
        testBtn.className = "builder-primary";
        testBtn.textContent = testState.status === "sending" ? "Sending\u2026" : "Send Test Prompt";
        testBtn.disabled = !profile.model || testState.status === "sending" || aiConnectionManager.status !== "connected";
        testBtn.addEventListener("click", runTest);
        section.appendChild(testBtn);

        if (!profile.model) {
          const note = document.createElement("p");
          note.className = "app-subtitle";
          note.textContent = "Choose a model above first.";
          section.appendChild(note);
        }

        if (testState.status === "done") {
          const result = document.createElement("div");
          result.className = "ai-test-result ai-test-success";
          result.innerHTML = `<strong>\u25CF Working</strong><p>${escapeHtml(testState.response)}</p>`;
          section.appendChild(result);
        } else if (testState.status === "error") {
          const result = document.createElement("div");
          result.className = "ai-test-result ai-test-failure";
          result.innerHTML = `<strong>Couldn't reach the model</strong><p>${escapeHtml(testState.error)}</p>`;
          section.appendChild(result);
        }
        return section;
      }

      // ---- small field helpers, matching the rest of the Workshop's own form conventions ----
      function sectionHeading(text) {
        const h = document.createElement("h3");
        h.textContent = text;
        return h;
      }

      function textRow(label, value, onChange, placeholder) {
        const row = document.createElement("div");
        row.className = "panel-row";
        const labelEl = document.createElement("label");
        labelEl.textContent = label;
        const input = document.createElement("input");
        input.type = "text";
        input.value = value ?? "";
        if (placeholder) input.placeholder = placeholder;
        input.addEventListener("change", () => onChange(input.value));
        row.append(labelEl, input);
        return row;
      }

      function textareaRow(label, value, onChange, placeholder) {
        const wrap = document.createElement("div");
        wrap.className = "ai-textarea-row";
        const labelEl = document.createElement("label");
        labelEl.textContent = label;
        const textarea = document.createElement("textarea");
        textarea.value = value ?? "";
        textarea.rows = 2;
        if (placeholder) textarea.placeholder = placeholder;
        textarea.addEventListener("change", () => onChange(textarea.value));
        wrap.append(labelEl, textarea);
        return wrap;
      }

      function sliderRow(label, value, min, max, step, onChange, format) {
        const row = document.createElement("div");
        row.className = "panel-row";
        const labelEl = document.createElement("label");
        labelEl.textContent = label;
        const input = document.createElement("input");
        input.type = "range";
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(value);
        const valueEl = document.createElement("span");
        valueEl.className = "settings-range-value";
        valueEl.textContent = format(value);
        input.addEventListener("input", () => {
          const v = parseFloat(input.value);
          valueEl.textContent = format(v);
          onChange(v);
        });
        row.append(labelEl, input, valueEl);
        return row;
      }

      function selectRow(label, value, options, onChange, disabled = false) {
        const row = document.createElement("div");
        row.className = "panel-row";
        const labelEl = document.createElement("label");
        labelEl.textContent = label;
        const select = document.createElement("select");
        select.disabled = disabled;
        for (const opt of options) {
          const optionEl = document.createElement("option");
          optionEl.value = opt.id;
          optionEl.textContent = opt.label;
          if (opt.id === value) optionEl.selected = true;
          select.appendChild(optionEl);
        }
        select.addEventListener("change", () => onChange(select.value));
        row.append(labelEl, select);
        return row;
      }

      function colorRow(label, value, onChange) {
        const row = document.createElement("div");
        row.className = "panel-row";
        const labelEl = document.createElement("label");
        labelEl.textContent = label;
        const input = document.createElement("input");
        input.type = "color";
        input.value = value;
        input.addEventListener("input", () => onChange(input.value));
        row.append(labelEl, input);
        return row;
      }

      const offConnection = aiConnectionManager.events.on("connection:changed", render);
      const offModels = modelRegistry.events.on("models:changed", render);
      const offResidents = residentProfileStore.events.on("residents:changed", render);
      render();

      return () => {
        offConnection();
        offModels();
        offResidents();
      };
    },
  };
}

function formatBytes(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${bytes} B`;
}

function escapeHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
