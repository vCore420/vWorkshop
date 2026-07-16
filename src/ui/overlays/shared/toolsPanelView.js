import { NATIVE_CALCULATORS, TOOL_CATEGORIES } from "../../../tools/NativeCalculators.js";
import { CALCULATOR_TEMPLATES } from "../../../tools/CalculatorTemplates.js";
import { validateFormula } from "../../../tools/ToolFormula.js";
import { runTool, valuesFromSnapshot } from "../../../tools/runTool.js";

/**
 * mountToolsPanel
 * ---------------
 * Workshop Tools phase. The one implementation of "browse, run, and
 * build Workshop tools" — used by both `ToolStorageOverlay.js` (the
 * physical toolbox) and the computer's `ToolsApp.js`, exactly the same
 * "one shared view, two physical entry points" shape `Wardrobe.js`
 * already established for the Wardrobe app.
 *
 * Three views, all in one small state machine (no router, no framework —
 * plain DOM, same as every other overlay/app in this project):
 *   - **browse** — every tool, grouped into tabs (category, Pinned, Recent,
 *     Custom), as cards.
 *   - **run** — a chosen tool's own form, a Calculate button, and (once
 *     run) its result, with actions to copy it, save it to a project, or
 *     pin the tool.
 *   - **build** — the Calculator Builder: existing custom calculators,
 *     starting a new one from a template, and an editor for its inputs
 *     and output formulas.
 *
 * @returns {() => void} cleanup function.
 */
export function mountToolsPanel(container, { toolsStore, projectsStore, audioSystem, activeProjectId = null } = {}) {
  const state = { mode: "browse", tab: "all", tool: null, lastResult: null, lastInputs: null, editingCalculator: null };

  function allTools() {
    return [...NATIVE_CALCULATORS, ...toolsStore.allCustomCalculators()];
  }

  function findTool(id) {
    return allTools().find((t) => t.id === id) ?? null;
  }

  function render() {
    container.innerHTML = "";
    const heading = document.createElement("h2");
    heading.textContent = "Workshop Tools";
    const subtitle = document.createElement("p");
    subtitle.className = "app-subtitle";
    subtitle.textContent = "Calculators and planning tools, organised like a real toolbox \u2014 reach for the one you need.";
    container.append(heading, subtitle);

    const topTabs = document.createElement("div");
    topTabs.className = "tools-top-tabs";
    const browseBtn = document.createElement("button");
    browseBtn.textContent = "\uD83E\uDDF0 Toolbox";
    browseBtn.className = state.mode !== "build" ? "active" : "";
    browseBtn.addEventListener("click", () => { state.mode = "browse"; render(); });
    const buildBtn = document.createElement("button");
    buildBtn.textContent = "\uD83D\uDEE0\uFE0F Calculator Builder";
    buildBtn.className = state.mode === "build" ? "active" : "";
    buildBtn.addEventListener("click", () => { state.mode = "build"; state.editingCalculator = null; render(); });
    topTabs.append(browseBtn, buildBtn);
    container.appendChild(topTabs);

    if (state.mode === "build") {
      renderBuild();
    } else if (state.mode === "run" && state.tool) {
      renderRun();
    } else {
      renderBrowse();
    }
  }

  // ---------------------------------------------------------------- browse

  function renderBrowse() {
    const tabBar = document.createElement("div");
    tabBar.className = "settings-tab-bar tools-tab-bar";
    const tabs = [
      { id: "all", label: "All" },
      { id: "pinned", label: "Pinned" },
      { id: "recent", label: "Recent" },
      ...TOOL_CATEGORIES.map((c) => ({ id: c.id, label: `${c.icon} ${c.label}` })),
    ];
    for (const tab of tabs) {
      const btn = document.createElement("button");
      btn.textContent = tab.label;
      btn.className = state.tab === tab.id ? "active" : "";
      btn.addEventListener("click", () => { state.tab = tab.id; render(); });
      tabBar.appendChild(btn);
    }
    container.appendChild(tabBar);

    if (state.tab === "recent") {
      renderRecentList();
      return;
    }

    const tools = allTools().filter((t) => {
      if (state.tab === "all") return true;
      if (state.tab === "pinned") return toolsStore.isPinned(t.id);
      return t.category === state.tab;
    });

    const grid = document.createElement("div");
    grid.className = "tools-grid";
    if (tools.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = state.tab === "pinned"
        ? "Nothing pinned yet \u2014 open a tool and pin it to keep it close at hand."
        : "No tools here yet.";
      grid.appendChild(empty);
    }
    for (const tool of tools) {
      grid.appendChild(buildToolCard(tool));
    }
    container.appendChild(grid);
  }

  function buildToolCard(tool) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "tools-card";
    const pinned = toolsStore.isPinned(tool.id);
    card.innerHTML = `
      <div class="tools-card-icon">${tool.icon || "\u{1F9EE}"}</div>
      <div class="tools-card-title">${tool.title}${tool.custom ? " <span class=\"tools-card-tag\">custom</span>" : ""}</div>
      <div class="tools-card-desc">${tool.description || ""}</div>
    `;
    const pinBtn = document.createElement("span");
    pinBtn.className = "tools-pin-btn" + (pinned ? " pinned" : "");
    pinBtn.textContent = pinned ? "\u2605" : "\u2606";
    pinBtn.title = pinned ? "Unpin" : "Pin";
    pinBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toolsStore.togglePin(tool.id);
      render();
    });
    card.appendChild(pinBtn);
    card.addEventListener("click", () => openTool(tool.id));
    return card;
  }

  function renderRecentList() {
    const entries = toolsStore.getRecent();
    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No calculations run yet.";
      container.appendChild(empty);
      return;
    }
    const list = document.createElement("ul");
    list.className = "wide-list";
    for (const entry of entries) {
      const li = document.createElement("li");
      const title = document.createElement("div");
      title.className = "item-title";
      title.textContent = entry.toolTitle;
      const meta = document.createElement("div");
      meta.className = "item-meta";
      meta.textContent = new Date(entry.createdAt).toLocaleString();
      const reopenBtn = document.createElement("button");
      reopenBtn.textContent = "Reopen";
      reopenBtn.style.marginTop = "8px";
      reopenBtn.addEventListener("click", () => {
        const tool = findTool(entry.toolId);
        if (!tool) return;
        openTool(tool.id, entry.inputs);
      });
      li.append(title, meta, reopenBtn);
      list.appendChild(li);
    }
    container.appendChild(list);
  }

  function openTool(toolId, presetInputs = null) {
    const tool = findTool(toolId);
    if (!tool) return;
    state.mode = "run";
    state.tool = tool;
    state.lastResult = null;
    state.lastInputs = presetInputs;
    render();
  }

  // ------------------------------------------------------------------ run

  function renderRun() {
    const tool = state.tool;
    const back = document.createElement("button");
    back.className = "tools-back-btn";
    back.textContent = "\u2190 Back to toolbox";
    back.addEventListener("click", () => { state.mode = "browse"; render(); });
    container.appendChild(back);

    const header = document.createElement("div");
    header.className = "tools-run-header";
    header.innerHTML = `<span class="tools-run-icon">${tool.icon || "\u{1F9EE}"}</span><div><h3>${tool.title}</h3><p>${tool.description || ""}</p></div>`;
    const pinBtn = document.createElement("button");
    const pinned = toolsStore.isPinned(tool.id);
    pinBtn.textContent = pinned ? "\u2605 Pinned" : "\u2606 Pin this tool";
    pinBtn.className = "tools-pin-toggle";
    pinBtn.addEventListener("click", () => {
      toolsStore.togglePin(tool.id);
      pinBtn.textContent = toolsStore.isPinned(tool.id) ? "\u2605 Pinned" : "\u2606 Pin this tool";
    });
    header.appendChild(pinBtn);
    container.appendChild(header);

    const form = document.createElement("div");
    form.className = "tools-form";
    const fieldEls = {};
    for (const input of tool.inputs) {
      const { wrap, getValue } = buildInputField(input, state.lastInputs?.[input.id]);
      fieldEls[input.id] = getValue;
      form.appendChild(wrap);
    }
    container.appendChild(form);

    const runBtn = document.createElement("button");
    runBtn.className = "button tools-run-btn";
    runBtn.textContent = "Calculate";
    container.appendChild(runBtn);

    const resultHost = document.createElement("div");
    container.appendChild(resultHost);

    function readSnapshot() {
      const snapshot = {};
      for (const input of tool.inputs) snapshot[input.id] = fieldEls[input.id]();
      return snapshot;
    }

    function renderResult(resultHtml, snapshot) {
      resultHost.innerHTML = "";
      const block = document.createElement("div");
      block.className = "tools-result";
      const lines = String(resultHtml).split("<br>").map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const lineEl = document.createElement("div");
        lineEl.className = "tools-result-line";
        lineEl.innerHTML = line.replace(/(-?\d+(?:\.\d+)?)/g, '<span class="tools-result-number">$1</span>');
        block.appendChild(lineEl);
      }
      resultHost.appendChild(block);

      const actions = document.createElement("div");
      actions.className = "tools-result-actions";

      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copy result";
      copyBtn.addEventListener("click", async () => {
        const text = lines.map((l) => l.replace(/<[^>]+>/g, "")).join("\n");
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.textContent = "Copied";
        } catch {
          copyBtn.textContent = "Copy failed";
        }
        setTimeout(() => { copyBtn.textContent = "Copy result"; }, 1200);
      });
      actions.appendChild(copyBtn);

      if (projectsStore) {
        const saveRow = document.createElement("div");
        saveRow.className = "tools-save-row";
        const select = document.createElement("select");
        const activeProjects = projectsStore.all();
        if (activeProjects.length === 0) {
          const opt = document.createElement("option");
          opt.textContent = "No projects yet";
          select.appendChild(opt);
          select.disabled = true;
        } else {
          for (const project of activeProjects) {
            const opt = document.createElement("option");
            opt.value = project.id;
            opt.textContent = project.title;
            if (project.id === activeProjectId) opt.selected = true;
            select.appendChild(opt);
          }
        }
        const saveBtn = document.createElement("button");
        saveBtn.textContent = "Save to project";
        saveBtn.disabled = activeProjects.length === 0;
        saveBtn.addEventListener("click", () => {
          const projectId = Number(select.value);
          projectsStore.addCalculation(projectId, { toolId: tool.id, toolTitle: tool.title, inputs: snapshot, result: resultHtml });
          saveBtn.textContent = "Saved";
          setTimeout(() => { saveBtn.textContent = "Save to project"; }, 1200);
        });
        saveRow.append(select, saveBtn);
        actions.appendChild(saveRow);
      }

      resultHost.appendChild(actions);
    }

    runBtn.addEventListener("click", () => {
      const snapshot = readSnapshot();
      const values = valuesFromSnapshot(tool.inputs, snapshot);
      let result;
      try {
        result = runTool(tool, values);
      } catch (err) {
        result = `Could not calculate: ${err.message}`;
      }
      renderResult(result, snapshot);
      toolsStore.recordRun(tool.id, tool.title, snapshot, result);
      audioSystem?.playInteractionSound?.("paperShuffle", { pitch: 1 });
    });

    if (state.lastInputs) runBtn.click();
  }

  /** One input field, matching the four types the ported calculators
   *  actually use (text, number, radio, checkbox) plus "rows" (a small
   *  add/remove table — see buildRowsEditor below). Returns the field's
   *  own element and a getter for its current value in the same shape
   *  `valuesFromSnapshot()` expects. */
  function buildInputField(input, presetValue) {
    const wrap = document.createElement("div");
    wrap.className = "tools-field";
    const label = document.createElement("label");
    label.textContent = input.unit ? `${input.label} (${input.unit})` : input.label;
    wrap.appendChild(label);

    if (input.type === "radio") {
      const row = document.createElement("div");
      row.className = "tools-radio-row";
      const name = `${input.id}-${Math.random().toString(36).slice(2, 7)}`;
      const radios = [];
      for (const option of input.options ?? []) {
        const optLabel = document.createElement("label");
        optLabel.className = "tools-radio-option";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = name;
        radio.value = option.value;
        radio.checked = presetValue !== undefined ? presetValue === option.value : option.value === input.default;
        radios.push(radio);
        optLabel.append(radio, document.createTextNode(" " + option.label));
        row.appendChild(optLabel);
      }
      wrap.appendChild(row);
      return { wrap, getValue: () => radios.find((r) => r.checked)?.value ?? "" };
    }

    if (input.type === "checkbox") {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = presetValue !== undefined ? Boolean(presetValue) : false;
      label.prepend(checkbox);
      return { wrap, getValue: () => checkbox.checked };
    }

    if (input.type === "rows") {
      const editor = buildRowsEditor(input, presetValue);
      wrap.appendChild(editor.el);
      return { wrap, getValue: editor.getRows };
    }

    const field = document.createElement("input");
    field.type = input.type === "number" ? "number" : "text";
    if (input.min !== undefined) field.min = String(input.min);
    if (input.step !== undefined) field.step = String(input.step);
    field.value = presetValue !== undefined ? presetValue : (input.default ?? "");
    wrap.appendChild(field);
    return { wrap, getValue: () => field.value };
  }

  /** "rows" input — a small add/remove table (used by the Stock and
   *  Mesh Sheet optimisers). `fields` mirrors the source application's
   *  own convention: a "length" field is stored under the internal key
   *  `width` (a single-dimension row still uses the same row shape a
   *  width+height row does), which is what lets both optimiser
   *  calculators' own `calculate()` read `row.width` unchanged. */
  function buildRowsEditor(input, presetRows) {
    const el = document.createElement("div");
    el.className = "tools-rows-editor";
    const list = document.createElement("div");
    list.className = "tools-rows-list";
    el.appendChild(list);

    const fields = input.rowFields || ["width", "height", "qty"];
    const placeholders = { length: "length", width: "width", height: "height", qty: "qty", preferred: "preferred?" };

    function addRow(data = {}) {
      const row = document.createElement("div");
      row.className = "tools-row-item";
      const getters = {};
      for (const fieldName of fields) {
        const dataKey = fieldName === "length" ? "width" : fieldName;
        if (fieldName === "preferred") {
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.title = "Preferred";
          cb.checked = Boolean(data.preferred);
          row.appendChild(cb);
          getters.preferred = () => cb.checked;
        } else {
          const inp = document.createElement("input");
          inp.type = "number";
          inp.placeholder = placeholders[fieldName] ?? fieldName;
          inp.value = data[dataKey] !== undefined ? data[dataKey] : fieldName === "qty" ? 1 : "";
          row.appendChild(inp);
          getters[dataKey] = () => inp.value;
        }
      }
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "\u2715";
      removeBtn.className = "tools-row-remove";
      removeBtn.addEventListener("click", () => row.remove());
      row.appendChild(removeBtn);
      row._getters = getters;
      list.appendChild(row);
    }

    if (Array.isArray(presetRows) && presetRows.length) {
      presetRows.forEach((r) => addRow(r));
    } else {
      addRow();
    }

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "+ Add row";
    addBtn.addEventListener("click", () => addRow());
    el.appendChild(addBtn);

    return {
      el,
      getRows: () => [...list.children].map((row) => {
        const out = {};
        for (const [key, getter] of Object.entries(row._getters)) out[key] = getter();
        return out;
      }),
    };
  }

  // ---------------------------------------------------------------- build

  function renderBuild() {
    if (state.editingCalculator) {
      renderCalculatorEditor(state.editingCalculator);
      return;
    }

    const intro = document.createElement("p");
    intro.className = "app-subtitle";
    intro.textContent = "Build your own Workshop calculators. Not a programming environment \u2014 just inputs, and a formula for each result.";
    container.appendChild(intro);

    const heading = document.createElement("h3");
    heading.textContent = "Start from a template";
    container.appendChild(heading);
    const templateGrid = document.createElement("div");
    templateGrid.className = "tools-grid";
    for (const template of CALCULATOR_TEMPLATES) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "tools-card tools-template-card";
      card.innerHTML = `<div class="tools-card-icon">${template.icon}</div><div class="tools-card-title">${template.label}</div><div class="tools-card-desc">${template.description}</div>`;
      card.addEventListener("click", () => {
        state.editingCalculator = { isNew: true, ...template.build() };
        render();
      });
      templateGrid.appendChild(card);
    }
    container.appendChild(templateGrid);

    const existingHeading = document.createElement("h3");
    existingHeading.textContent = "Your calculators";
    container.appendChild(existingHeading);
    const custom = toolsStore.allCustomCalculators();
    if (custom.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Nothing built yet \u2014 pick a template above to start.";
      container.appendChild(empty);
    } else {
      const list = document.createElement("ul");
      list.className = "wide-list";
      for (const calc of custom) {
        const li = document.createElement("li");
        const title = document.createElement("div");
        title.className = "item-title";
        title.textContent = `${calc.icon || ""} ${calc.title}`;
        const meta = document.createElement("div");
        meta.className = "item-meta";
        meta.textContent = `v${calc.version} \u00B7 updated ${new Date(calc.updatedAt).toLocaleDateString()}`;
        li.append(title, meta);

        const controls = document.createElement("div");
        controls.style.marginTop = "8px";
        controls.style.display = "flex";
        controls.style.gap = "8px";
        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () => { state.editingCalculator = { isNew: false, ...calc }; render(); });
        const dupBtn = document.createElement("button");
        dupBtn.textContent = "Duplicate";
        dupBtn.addEventListener("click", () => { toolsStore.duplicateCustomCalculator(calc.id); render(); });
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", () => { toolsStore.removeCustomCalculator(calc.id); render(); });
        controls.append(editBtn, dupBtn, removeBtn);
        li.appendChild(controls);
        list.appendChild(li);
      }
      container.appendChild(list);
    }
  }

  function renderCalculatorEditor(draft) {
    const back = document.createElement("button");
    back.className = "tools-back-btn";
    back.textContent = "\u2190 Back to Calculator Builder";
    back.addEventListener("click", () => { state.editingCalculator = null; render(); });
    container.appendChild(back);

    const form = document.createElement("div");
    form.className = "tools-builder-form";

    const titleField = labeledInput("Name", draft.title, "text");
    const descField = labeledInput("Description", draft.description, "text");
    form.append(titleField.wrap, descField.wrap);

    const inputsHeading = document.createElement("h4");
    inputsHeading.textContent = "Inputs";
    form.appendChild(inputsHeading);
    const inputsList = document.createElement("div");
    let inputRows = draft.inputs.map((i) => ({ ...i }));

    function renderInputsList() {
      inputsList.innerHTML = "";
      inputRows.forEach((input, index) => {
        const row = document.createElement("div");
        row.className = "tools-builder-row";
        const idField = document.createElement("input");
        idField.placeholder = "id (e.g. width)";
        idField.value = input.id;
        idField.addEventListener("input", () => { input.id = idField.value.trim(); });
        const labelField = document.createElement("input");
        labelField.placeholder = "Label";
        labelField.value = input.label;
        labelField.addEventListener("input", () => { input.label = labelField.value; });
        const typeField = document.createElement("select");
        for (const t of ["number", "text", "checkbox"]) {
          const opt = document.createElement("option");
          opt.value = t;
          opt.textContent = t;
          opt.selected = input.type === t;
          typeField.appendChild(opt);
        }
        typeField.addEventListener("change", () => { input.type = typeField.value; });
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "\u2715";
        removeBtn.addEventListener("click", () => { inputRows.splice(index, 1); renderInputsList(); });
        row.append(idField, labelField, typeField, removeBtn);
        inputsList.appendChild(row);
      });
    }
    renderInputsList();
    form.appendChild(inputsList);
    const addInputBtn = document.createElement("button");
    addInputBtn.textContent = "+ Add input";
    addInputBtn.addEventListener("click", () => {
      inputRows.push({ id: `input${inputRows.length + 1}`, label: "New input", type: "number", default: 0 });
      renderInputsList();
    });
    form.appendChild(addInputBtn);

    const outputsHeading = document.createElement("h4");
    outputsHeading.textContent = "Outputs";
    form.appendChild(outputsHeading);
    const outputsList = document.createElement("div");
    let outputRows = draft.outputs.map((o) => ({ ...o }));
    const validationHost = document.createElement("div");
    validationHost.className = "tools-validation";

    function renderOutputsList() {
      outputsList.innerHTML = "";
      outputRows.forEach((output, index) => {
        const row = document.createElement("div");
        row.className = "tools-builder-row tools-builder-output-row";
        const labelField = document.createElement("input");
        labelField.placeholder = "Label (e.g. Cut Length)";
        labelField.value = output.label;
        labelField.addEventListener("input", () => { output.label = labelField.value; });
        const formulaField = document.createElement("input");
        formulaField.placeholder = "Formula (e.g. width * 2 + height * 2)";
        formulaField.value = output.formula;
        formulaField.className = "tools-formula-input";
        formulaField.addEventListener("input", () => { output.formula = formulaField.value; });
        const unitField = document.createElement("input");
        unitField.placeholder = "unit";
        unitField.value = output.unit || "";
        unitField.style.width = "60px";
        unitField.addEventListener("input", () => { output.unit = unitField.value; });
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "\u2715";
        removeBtn.addEventListener("click", () => { outputRows.splice(index, 1); renderOutputsList(); });
        row.append(labelField, formulaField, unitField, removeBtn);
        outputsList.appendChild(row);
      });
    }
    renderOutputsList();
    form.appendChild(outputsList);
    const addOutputBtn = document.createElement("button");
    addOutputBtn.textContent = "+ Add output";
    addOutputBtn.addEventListener("click", () => {
      outputRows.push({ id: `output${outputRows.length + 1}`, label: "New output", formula: "", unit: "" });
      renderOutputsList();
    });
    form.appendChild(addOutputBtn);
    form.appendChild(validationHost);

    const actions = document.createElement("div");
    actions.className = "tools-builder-actions";
    const testBtn = document.createElement("button");
    testBtn.textContent = "Validate";
    testBtn.addEventListener("click", () => {
      const knownIds = inputRows.map((i) => i.id).filter(Boolean);
      const problems = [];
      for (const output of outputRows) {
        const result = validateFormula(output.formula, knownIds);
        if (!result.valid) problems.push(`${output.label || "(output)"}: ${result.error}`);
      }
      validationHost.innerHTML = "";
      if (problems.length === 0) {
        validationHost.textContent = "\u2713 Every formula checks out.";
        validationHost.classList.add("tools-validation-ok");
        validationHost.classList.remove("tools-validation-error");
      } else {
        validationHost.innerHTML = problems.map((p) => `\u2717 ${p}`).join("<br>");
        validationHost.classList.add("tools-validation-error");
        validationHost.classList.remove("tools-validation-ok");
      }
    });
    const saveBtn = document.createElement("button");
    saveBtn.className = "button";
    saveBtn.textContent = draft.isNew ? "Create calculator" : "Save changes";
    saveBtn.addEventListener("click", () => {
      const payload = {
        title: titleField.getValue(),
        description: descField.getValue(),
        icon: draft.icon,
        inputs: inputRows.filter((i) => i.id && i.label),
        outputs: outputRows.filter((o) => o.id && o.label && o.formula),
      };
      if (draft.isNew) {
        toolsStore.createCustomCalculator(payload);
      } else {
        toolsStore.updateCustomCalculator(draft.id, payload);
      }
      state.editingCalculator = null;
      render();
    });
    actions.append(testBtn, saveBtn);
    form.appendChild(actions);

    container.appendChild(form);
  }

  function labeledInput(labelText, value, type) {
    const wrap = document.createElement("div");
    wrap.className = "tools-field";
    const label = document.createElement("label");
    label.textContent = labelText;
    const field = document.createElement("input");
    field.type = type;
    field.value = value ?? "";
    wrap.append(label, field);
    return { wrap, getValue: () => field.value };
  }

  render();
  const unsubscribe = toolsStore.events.on("tools:changed", () => {
    // Re-render only while browsing/building — never yank the form out
    // from under someone mid-calculation just because, say, a pin toggled
    // elsewhere.
    if (state.mode !== "run") render();
  });
  return unsubscribe;
}
