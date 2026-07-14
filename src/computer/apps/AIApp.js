import { MEMORY_MODES, MEMORY_SIZE_OPTIONS, CONTEXT_BUDGET_OPTIONS, MEMORY_CATEGORIES, CATEGORY_LIFETIMES, MEMORY_LIFETIMES } from "../../ai/MemoryConfiguration.js";
import { EMBODIMENT_TYPES, IDLE_BEHAVIOUR_OPTIONS } from "../../ai/EmbodimentConfiguration.js";
import { PERSONALITY_TRAITS, MAX_SELECTED_TRAITS } from "../../ai/TraitConfiguration.js";
import { BEHAVIOUR_DIALS } from "../../ai/BehaviourDialsConfiguration.js";
import { AI_PROVIDERS, getProvider } from "../../ai/ProviderRegistry.js";
import { composeSystemPrompt } from "../../ai/PromptComposer.js";
import { buildConversationContext } from "../../resident/ResidentContext.js";
import { getIdleLocation } from "../../resident/ResidentMovement.js";

const STATUS_LABELS = {
  connected: "Connected",
  connecting: "Connecting\u2026",
  disconnected: "Waiting for Ollama\u2026",
};

/**
 * createAIApp — AI Mission Control
 * -----------------------------------
 * "Mission Control should no longer feel like a configuration utility.
 * Instead, it should become the place where Workshop residents are
 * understood, configured and nurtured." Every section here edits a
 * `ResidentProfileStore` profile (identity, intelligence, behaviour,
 * memory, embodiment) or reads from the systems that make the resident
 * this profile describes actually real in the room —
 * `AIConnectionManager`/`ModelRegistry` for the connection itself,
 * `residentBehaviour`/`residentState`/`conversationMemory` for what
 * Bubble is *currently* doing. This file coordinates all of them but
 * owns none of their actual state itself, the same "app renders a store,
 * doesn't duplicate it" shape every other Workshop app already follows.
 *
 * "Avoid making this feel like configuring software. Instead, make it
 * feel like preparing another presence." Section order: status, health,
 * connection, model, profiles, identity, traits, intelligence,
 * behaviour, memory, embodiment, sandbox, advanced, connection test —
 * *who this resident is* and *how it's doing right now* both come before
 * the numeric tuning knobs, not after.
 */
export function createAIApp({
  aiConnectionManager,
  modelRegistry,
  residentProfileStore,
  residentBehaviour = null,
  residentConnection = null,
  residentState = null,
  residentPreferences = null,
  playerPatternMemory = null,
  residentCuriosity = null,
  conversationMemory = null,
  worldObjectsStore = null,
  environmentSystem = null,
  timeOfDaySystem = null,
  worldEventLog = null,
}) {
  return {
    id: "ai",
    label: "AI Control",
    glyph: "\u2726",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "AI Mission Control";
      const subtitle = document.createElement("p");
      subtitle.className = "app-subtitle";
      subtitle.textContent = "Where Bubble is understood, configured, and gently nurtured.";
      container.append(heading, subtitle);

      const form = document.createElement("div");
      container.appendChild(form);

      let testState = { status: "idle", response: "", error: "" }; // "idle" | "sending" | "done" | "error"
      let advancedOpen = false;
      // "A safe place to experiment with resident configuration before
      // applying changes" — entirely separate from the real conversation
      // in `ResidentConversation.js`: its own history, never touching
      // `residentBehaviour`/`ConversationMemory`'s own writes, so nothing
      // typed here ever reaches Bubble in the room. See buildSandboxSection().
      let sandboxHistory = [];
      let sandboxThinking = false;

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
        form.appendChild(buildHealthSection());
        form.appendChild(buildConnectionSection());
        form.appendChild(buildModelSection());
        form.appendChild(buildProfilesSection());
        const profile = activeProfile();
        if (profile) {
          form.appendChild(buildIdentitySection(profile));
          form.appendChild(buildTraitsSection(profile));
          form.appendChild(buildIntelligenceSection(profile));
          form.appendChild(buildBehaviourDialsSection(profile));
          form.appendChild(buildMemorySection(profile));
          form.appendChild(buildEmbodimentSection(profile));
          form.appendChild(buildSandboxSection(profile));
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

      /** "Resident Health... calm and informative. Avoid making it feel
       *  like a developer debugging tool." A plain, read-only grid — no
       *  raw numbers without a unit, no field that isn't something a
       *  person would actually want to know about how Bubble is doing,
       *  nothing here is editable (that's every section below it). */
      function buildHealthSection() {
        const profile = activeProfile();
        const section = document.createElement("div");
        section.className = "builder-section";
        section.appendChild(sectionHeading("Resident Health"));

        const rows = [
          ["Resident status", STATUS_LABELS[aiConnectionManager.status]],
          ["Connected model", profile?.model || "No model selected yet"],
          ["Provider", getProvider(profile?.provider).label],
          ["Latency", aiConnectionManager.lastLatencyMs != null ? `${aiConnectionManager.lastLatencyMs} ms` : "\u2014"],
          ["Current activity", describeActivity()],
          ["Current mood", residentState ? capitalize(residentState.mood) : "\u2014"],
          ["Memory status", describeMemoryStatus(profile)],
          ["Current location", residentState?.idleLocationId ? getIdleLocation(residentState.idleLocationId).label : "\u2014"],
        ];
        const grid = document.createElement("div");
        grid.className = "ai-health-grid";
        for (const [label, value] of rows) {
          const row = document.createElement("div");
          row.className = "ai-health-row";
          const labelEl = document.createElement("span");
          labelEl.className = "ai-health-label";
          labelEl.textContent = label;
          const valueEl = document.createElement("span");
          valueEl.className = "ai-health-value";
          valueEl.textContent = value;
          row.append(labelEl, valueEl);
          grid.appendChild(row);
        }
        section.appendChild(grid);
        return section;
      }

      function describeActivity() {
        if (!residentBehaviour) return "\u2014";
        if (aiConnectionManager.status !== "connected") return "Waiting quietly";
        return residentBehaviour.mode === "conversing" ? "In conversation" : "Going about its day";
      }

      function describeMemoryStatus(profile) {
        if (!profile) return "\u2014";
        if (profile.memory.mode === "disabled") return "Disabled";
        const count = conversationMemory?.notes.length ?? 0;
        const modeLabel = MEMORY_MODES.find((m) => m.id === profile.memory.mode)?.label ?? profile.memory.mode;
        return `${modeLabel} \u2014 ${count} thing${count === 1 ? "" : "s"} remembered`;
      }

      /** "Please begin preparing Mission Control for additional
       *  providers... only Ollama needs to be fully functional during
       *  this phase." The provider selector is real (it's a genuine field
       *  on the profile), but choosing anything besides Ollama honestly
       *  says so rather than pretending to connect — see
       *  `src/ai/ProviderRegistry.js`'s own comment on why a convincing
       *  fake would be worse than this. */
      function buildConnectionSection() {
        const profile = activeProfile();
        const section = document.createElement("div");
        section.className = "builder-section";
        section.appendChild(sectionHeading("Connection"));

        section.appendChild(selectRow("Provider", profile?.provider ?? "ollama", AI_PROVIDERS, (v) => updateActive({ provider: v })));
        const provider = getProvider(profile?.provider);

        if (!provider.implemented) {
          const notice = document.createElement("p");
          notice.className = "app-subtitle";
          notice.textContent = `${provider.label} isn't functional yet \u2014 ${provider.description} This provider is supported architecturally so a future phase can activate it without reshaping anything here.`;
          section.appendChild(notice);
          return section;
        }

        section.appendChild(
          textRow("Ollama server", aiConnectionManager.baseUrl, (v) => aiConnectionManager.setBaseUrl(v), "http://localhost:11434")
        );
        const hint = document.createElement("p");
        hint.className = "app-subtitle";
        hint.textContent = "Checked automatically every few seconds \u2014 nothing needs to be started in a particular order. If the connection drops, the Workshop keeps quietly retrying on its own; nothing here needs to be manually reconnected.";
        section.appendChild(hint);
        return section;
      }

      function buildModelSection() {
        const section = document.createElement("div");
        section.className = "builder-section";
        section.appendChild(sectionHeading("Model"));
        const profile = activeProfile();

        const provider = getProvider(profile?.provider);
        if (!provider.implemented) {
          const notice = document.createElement("p");
          notice.className = "app-subtitle";
          notice.textContent = `Model discovery isn't available for ${provider.label} yet \u2014 switch back to Ollama in Connection above to choose a model.`;
          section.appendChild(notice);
          return section;
        }

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

      /** "Review the overall application layout and ensure it feels
       *  cohesive, welcoming." A one-line, at-a-glance summary under each
       *  profile's name \u2014 traits and embodiment, the two things that
       *  most make a resident feel like *someone* rather than a row in a
       *  list. Returns `null` (rendering nothing) for a profile with
       *  neither set, rather than a summary line that would just say
       *  "Floating Orb" on its own for every untouched profile. */
      function profileSummary(profile) {
        const bits = [];
        if (profile.traits.selected.length) {
          bits.push(profile.traits.selected.map((id) => PERSONALITY_TRAITS.find((t) => t.id === id)?.label ?? id).join(", "));
        }
        const embodimentType = EMBODIMENT_TYPES.find((t) => t.id === profile.embodiment.type);
        if (embodimentType && embodimentType.id !== "floatingOrb") bits.push(embodimentType.label);
        return bits.length ? bits.join(" \u00b7 ") : null;
      }

      function buildProfileRow(profile) {
        const li = document.createElement("li");
        if (profile.id === residentProfileStore.activeProfileId) li.classList.add("selected");

        const info = document.createElement("div");
        info.className = "ai-profile-info";
        const meta = document.createElement("span");
        meta.className = "builder-library-meta";
        meta.textContent = profile.name;
        meta.style.cursor = "pointer";
        meta.addEventListener("click", () => residentProfileStore.setActive(profile.id));
        info.appendChild(meta);

        const summaryText = profileSummary(profile);
        if (summaryText) {
          const summary = document.createElement("span");
          summary.className = "ai-profile-summary";
          summary.textContent = summaryText;
          info.appendChild(summary);
        }
        li.appendChild(info);

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

      /** "Continue expanding resident intelligence settings... Identity,
       *  Purpose, Personality, Behaviour, Conversation style, Temperature,
       *  Context length... these settings should now genuinely influence
       *  Bubble's behaviour." The free-text identity fields above already
       *  reach the system prompt (`PromptComposer.composeSystemPrompt()`);
       *  the numeric settings below already reach real conversation turns
       *  (`ResidentConnection.sendMessage()`, unchanged this phase) — this
       *  section is named to match the brief's own "Intelligence"
       *  grouping rather than reusing "Behaviour," which now names
       *  something distinct (see `buildBehaviourDialsSection()` below). */
      function buildIntelligenceSection(profile) {
        const section = document.createElement("div");
        section.className = "builder-section";
        section.appendChild(sectionHeading("Intelligence"));
        const hint = document.createElement("p");
        hint.className = "app-subtitle";
        hint.textContent = "How this resident actually generates a reply \u2014 applied to every real conversation turn, not just stored.";
        section.appendChild(hint);
        const c = profile.behaviourConfig;
        section.appendChild(sliderRow("Temperature", c.temperature, 0, 1.5, 0.05, (v) => updateActive({ behaviourConfig: { temperature: v } }), (v) => v.toFixed(2)));
        section.appendChild(sliderRow("Creativity", c.creativity, 0, 1, 0.05, (v) => updateActive({ behaviourConfig: { creativity: v } }), (v) => v.toFixed(2)));
        section.appendChild(sliderRow("Determinism", c.determinism, 0, 1, 0.05, (v) => updateActive({ behaviourConfig: { determinism: v } }), (v) => v.toFixed(2)));
        section.appendChild(sliderRow("Context Size (tokens)", c.contextSize, 512, 32768, 512, (v) => updateActive({ behaviourConfig: { contextSize: v } }), (v) => Math.round(v).toString()));
        section.appendChild(sliderRow("Maximum Response Length (tokens)", c.maxResponseLength, 64, 4096, 64, (v) => updateActive({ behaviourConfig: { maxResponseLength: v } }), (v) => Math.round(v).toString()));
        return section;
      }

      /** "Curiosity, Talkativeness, Playfulness, Energy, Independence,
       *  Reflection, Calmness... these should influence movement,
       *  conversations and general behaviour. Please favour subtle
       *  changes over dramatic differences." Seven continuous dials,
       *  distinct from the discrete Resident Traits above — see
       *  `src/ai/BehaviourDialsConfiguration.js`'s own comment on how the
       *  two are meant to complement rather than duplicate each other.
       *  Each slider's own low/high labels (e.g. "Reserved \u2194
       *  Talkative") replace a bare 0-1 number with something a person
       *  actually reads as a temperament, not a config value. */
      function buildBehaviourDialsSection(profile) {
        const section = document.createElement("div");
        section.className = "builder-section";
        section.appendChild(sectionHeading("Behaviour"));
        const hint = document.createElement("p");
        hint.className = "app-subtitle";
        hint.textContent = "Fine, continuous dials on top of the traits above \u2014 genuinely subtle, never a dramatic shift in who Bubble is.";
        section.appendChild(hint);
        const dials = profile.behaviourConfig.dials;
        for (const dial of BEHAVIOUR_DIALS) {
          section.appendChild(
            dialRow(dial, dials[dial.id], (v) => updateActive({ behaviourConfig: { dials: { [dial.id]: v } } }))
          );
        }
        return section;
      }

      function buildMemorySection(profile) {
        const section = document.createElement("div");
        section.className = "builder-section";
        section.appendChild(sectionHeading("Memory"));
        const badge = document.createElement("span");
        badge.className = "ai-future-badge";
        badge.textContent = "Mode and categories are active \u2014 size, summaries and context budget remain architecture only";
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

        section.appendChild(buildMemoryCategoriesSubsection(profile));
        return section;
      }

      /** "Allow the player to configure what Bubble remembers... please
       *  also introduce configurable memory lifetimes where appropriate."
       *  One toggle per category (`ConversationMemory.js` genuinely checks
       *  each of these — see its own comment), with the lifetime tier its
       *  category defaults to shown alongside as an honest, informative
       *  label rather than a slider for every category (see
       *  `MemoryConfiguration.js`'s own `CATEGORY_LIFETIMES` comment for
       *  why that stays fixed-per-category this phase). */
      function buildMemoryCategoriesSubsection(profile) {
        const wrap = document.createElement("div");
        wrap.className = "ai-memory-categories";
        const heading = document.createElement("h4");
        heading.textContent = "What Bubble Remembers";
        wrap.appendChild(heading);

        const categories = profile.memory.categories;
        for (const category of MEMORY_CATEGORIES) {
          const row = document.createElement("label");
          row.className = "panel-row ai-trait-row";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = categories[category.id];
          checkbox.addEventListener("change", () => {
            updateActive({ memory: { categories: { [category.id]: checkbox.checked } } });
          });
          const text = document.createElement("span");
          const lifetimeId = CATEGORY_LIFETIMES[category.id];
          const lifetimeLabel = lifetimeId ? ` (${MEMORY_LIFETIMES.find((l) => l.id === lifetimeId)?.label})` : "";
          text.textContent = `${category.label}${lifetimeLabel} \u2014 ${category.description}`;
          row.append(checkbox, text);
          wrap.appendChild(row);
        }
        return wrap;
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

      /** "A dedicated testing environment inside Mission Control... allow
       *  the player to interact with Bubble without interrupting Bubble
       *  inside the Workshop... a safe place to experiment with resident
       *  configuration before applying changes." Genuinely isolated: its
       *  own `sandboxHistory` (never `ResidentConversation.js`'s own),
       *  never calls `residentBehaviour.triggerEmotion()`/`setThinking()`
       *  (so Bubble's actual presence in the room never reacts), and never
       *  writes to `ConversationMemory` (`buildConversationContext()` is
       *  called with `mutateCuriosity: false` for the same reason — a test
       *  message must never consume the real "something new was built"
       *  note before the player gets to it for real). The system prompt
       *  is built exactly the way a real conversation's would be, so a
       *  test here is an honest preview of how a setting change actually
       *  reads, not an approximation of one. */
      function buildSandboxSection(profile) {
        const section = document.createElement("div");
        section.className = "builder-section";
        section.appendChild(sectionHeading("Resident Sandbox"));
        const hint = document.createElement("p");
        hint.className = "app-subtitle";
        hint.textContent = "Test prompts and settings here without interrupting Bubble in the Workshop \u2014 nothing typed below reaches the real conversation or its memory.";
        section.appendChild(hint);

        if (!residentConnection) {
          const note = document.createElement("p");
          note.className = "app-subtitle";
          note.textContent = "The sandbox isn't available in this session.";
          section.appendChild(note);
          return section;
        }

        const memoryPreview = document.createElement("div");
        memoryPreview.className = "ai-sandbox-memory";
        const memoryHeading = document.createElement("h4");
        memoryHeading.textContent = "Memory Inspection";
        memoryPreview.appendChild(memoryHeading);
        const notes = conversationMemory?.mostRelevant(8) ?? [];
        if (notes.length === 0) {
          const empty = document.createElement("p");
          empty.className = "app-subtitle";
          empty.textContent = "Nothing remembered yet.";
          memoryPreview.appendChild(empty);
        } else {
          const list = document.createElement("ul");
          list.className = "ai-sandbox-memory-list";
          for (const note of notes) {
            const li = document.createElement("li");
            li.textContent = note;
            list.appendChild(li);
          }
          memoryPreview.appendChild(list);
        }
        section.appendChild(memoryPreview);

        const messageList = document.createElement("div");
        messageList.className = "resident-conversation-messages ai-sandbox-messages";
        if (sandboxHistory.length === 0) {
          const empty = document.createElement("p");
          empty.className = "app-subtitle";
          empty.textContent = profile.model ? "Try a message to see how this configuration actually responds." : "Choose a model above first.";
          messageList.appendChild(empty);
        }
        for (const message of sandboxHistory) {
          const bubble = document.createElement("div");
          bubble.className = message.role === "user" ? "resident-message resident-message-player" : "resident-message resident-message-resident";
          bubble.textContent = message.content;
          messageList.appendChild(bubble);
        }
        if (sandboxThinking) {
          const thinkingBubble = document.createElement("div");
          thinkingBubble.className = "resident-message resident-message-resident resident-message-thinking";
          for (let i = 0; i < 3; i++) thinkingBubble.appendChild(document.createElement("span"));
          messageList.appendChild(thinkingBubble);
        }
        section.appendChild(messageList);

        const inputRow = document.createElement("div");
        inputRow.className = "resident-conversation-input-row";
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Try a test prompt\u2026";
        input.disabled = !profile.model || sandboxThinking;
        const sendBtn = document.createElement("button");
        sendBtn.type = "button";
        sendBtn.textContent = sandboxThinking ? "Sending\u2026" : "Send";
        sendBtn.disabled = !profile.model || sandboxThinking;
        inputRow.append(input, sendBtn);
        section.appendChild(inputRow);

        async function sendSandboxMessage() {
          const text = input.value.trim();
          if (!text || sandboxThinking) return;
          input.value = "";
          sandboxHistory.push({ role: "user", content: text });
          sandboxThinking = true;
          render();
          try {
            const context = buildConversationContext(
              profile,
              { residentCuriosity, residentPreferences, playerPatternMemory, conversationMemory, worldObjectsStore, environmentSystem, timeOfDaySystem, worldEventLog },
              { mutateCuriosity: false }
            );
            const systemPrompt = composeSystemPrompt(profile, context);
            const reply = await residentConnection.sendMessage(profile, sandboxHistory, systemPrompt);
            sandboxHistory.push({ role: "assistant", content: reply || "\u2026" });
          } catch {
            sandboxHistory.push({ role: "assistant", content: "(couldn't reach the model just now \u2014 try again in a moment)" });
          }
          sandboxThinking = false;
          render();
        }

        sendBtn.addEventListener("click", sendSandboxMessage);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") sendSandboxMessage();
        });

        if (sandboxHistory.length > 0) {
          const clearBtn = document.createElement("button");
          clearBtn.type = "button";
          clearBtn.className = "builder-small-button";
          clearBtn.textContent = "Clear Sandbox Conversation";
          clearBtn.addEventListener("click", () => {
            sandboxHistory = [];
            render();
          });
          section.appendChild(clearBtn);
        }
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

      /** Like `sliderRow()`, but for a 0-1 dial with its own low/high
       *  labels instead of a bare formatted number \u2014 "Reserved" and
       *  "Talkative" either side of the handle read as a temperament, a
       *  raw 0.62 never would. */
      function dialRow(dial, value, onChange) {
        const wrap = document.createElement("div");
        wrap.className = "ai-dial-row";
        const labelEl = document.createElement("label");
        labelEl.textContent = dial.label;
        wrap.appendChild(labelEl);

        const sliderWrap = document.createElement("div");
        sliderWrap.className = "ai-dial-slider-wrap";
        const lowEl = document.createElement("span");
        lowEl.className = "ai-dial-endpoint";
        lowEl.textContent = dial.low;
        const input = document.createElement("input");
        input.type = "range";
        input.min = "0";
        input.max = "1";
        input.step = "0.05";
        input.value = String(value);
        const highEl = document.createElement("span");
        highEl.className = "ai-dial-endpoint";
        highEl.textContent = dial.high;
        input.addEventListener("input", () => onChange(parseFloat(input.value)));
        sliderWrap.append(lowEl, input, highEl);
        wrap.appendChild(sliderWrap);
        return wrap;
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
      // "Resident Health" fields (current activity, mood, location) don't
      // have their own change events to listen for \u2014 they drift
      // continuously as Bubble goes about its day, not in discrete steps
      // worth an EventBus emission of their own. A calm 10-second refresh
      // (the same cadence `AIConnectionManager`'s own poll already uses)
      // keeps them honestly current \u2014 skipped entirely whenever a
      // field in the form currently has focus, so a full re-render never
      // interrupts someone mid-sentence in the Sandbox or an identity
      // field.
      const healthTimer = setInterval(() => {
        if (form.contains(document.activeElement)) return;
        render();
      }, 10000);
      render();

      return () => {
        offConnection();
        offModels();
        offResidents();
        clearInterval(healthTimer);
      };
    },
  };
}

function formatBytes(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${bytes} B`;
}

function capitalize(text) {
  const value = String(text ?? "");
  return value ? value[0].toUpperCase() + value.slice(1) : "\u2014";
}

function escapeHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
