/**
 * WorkbenchPanel
 * ---------------
 * Deliberately small. This is a clipboard, not a dashboard: a title, a
 * short note, a kind tag, and two actions — finish the current project, or
 * start a new one. If more than one project is active, a compact switch
 * list appears; otherwise it doesn't, so the common case (one thing in
 * progress) stays as quiet as possible.
 *
 * WorkbenchPanel owns no project data itself — `render(state)` is called
 * by `WorkbenchSystem` whenever something changes, and every control here
 * calls straight back into the callbacks passed to the constructor.
 */
import { KIND_OPTIONS } from "./kindTemplates.js";

export class WorkbenchPanel {
  /**
   * @param {HTMLElement} rootEl
   * @param {{onTitleChange, onNotesChange, onFinish, onStartNew, onSwitch, onStandUp}} callbacks
   */
  constructor(rootEl, callbacks) {
    this.callbacks = callbacks;
    this._showingNewForm = false;

    this.el = document.createElement("div");
    this.el.className = "workbench-panel";
    rootEl.appendChild(this.el);
  }

  setInteractive(flag) {
    this.el.classList.toggle("interactive", flag);
    if (!flag) this._showingNewForm = false;
  }

  updateRect(rect, opacity) {
    this.el.style.left = `${rect.left}px`;
    this.el.style.top = `${rect.top}px`;
    this.el.style.width = `${Math.max(0, rect.width)}px`;
    this.el.style.height = `${Math.max(0, rect.height)}px`;
    this.el.style.opacity = String(opacity);
  }

  _buildStandUpButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "wb-stand-up";
    btn.textContent = "Stand up (Esc)";
    btn.addEventListener("click", () => this.callbacks.onStandUp());
    return btn;
  }

  /**
   * @param {{ project: object|null, activeProjects: object[] }} state
   */
  render(state) {
    const { project, activeProjects } = state;
    this.el.innerHTML = "";

    if (this._showingNewForm) {
      this.el.appendChild(this._buildStandUpButton());
      this.el.appendChild(this._buildNewForm());
      return;
    }

    if (!project) {
      this.el.appendChild(this._buildStandUpButton());
      this.el.appendChild(this._buildEmptyState());
      return;
    }

    const header = document.createElement("div");
    header.className = "wb-header";
    const titleInput = document.createElement("input");
    titleInput.className = "wb-title";
    titleInput.value = project.title;
    titleInput.addEventListener("change", () => this.callbacks.onTitleChange(titleInput.value));
    const kindTag = document.createElement("span");
    kindTag.className = "wb-kind-tag";
    kindTag.textContent = KIND_OPTIONS.find(([k]) => k === project.kind)?.[1] ?? project.kind;
    header.append(titleInput, kindTag);

    this.el.appendChild(this._buildStandUpButton());

    const notes = document.createElement("textarea");
    notes.className = "wb-notes";
    notes.placeholder = "What's the plan\u2026";
    notes.value = project.notes ?? "";
    notes.addEventListener("input", () => this.callbacks.onNotesChange(notes.value));

    this.el.append(header, notes);

    if (activeProjects.length > 1) {
      const switchRow = document.createElement("div");
      switchRow.className = "wb-switch-row";
      const label = document.createElement("span");
      label.textContent = "also active:";
      switchRow.appendChild(label);
      for (const other of activeProjects) {
        if (other.id === project.id) continue;
        const btn = document.createElement("button");
        btn.textContent = other.title;
        btn.addEventListener("click", () => this.callbacks.onSwitch(other.id));
        switchRow.appendChild(btn);
      }
      this.el.appendChild(switchRow);
    }

    const actions = document.createElement("div");
    actions.className = "wb-actions";
    const finishBtn = document.createElement("button");
    finishBtn.textContent = "Mark finished";
    finishBtn.addEventListener("click", () => this.callbacks.onFinish());
    const newBtn = document.createElement("button");
    newBtn.textContent = "Start new project";
    newBtn.addEventListener("click", () => {
      this._showingNewForm = true;
      this.render(state);
    });
    actions.append(finishBtn, newBtn);
    this.el.appendChild(actions);
  }

  _buildEmptyState() {
    const wrap = document.createElement("div");
    wrap.className = "wb-empty";
    const p = document.createElement("p");
    p.textContent = "The bench is clear.";
    const btn = document.createElement("button");
    btn.textContent = "Start a new project";
    btn.addEventListener("click", () => {
      this._showingNewForm = true;
      this.render({ project: null, activeProjects: [] });
    });
    wrap.append(p, btn);
    return wrap;
  }

  _buildNewForm() {
    const wrap = document.createElement("div");
    wrap.className = "wb-new-form";

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.placeholder = "What are you making\u2026";

    const kindSelect = document.createElement("select");
    for (const [value, label] of KIND_OPTIONS) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      kindSelect.appendChild(opt);
    }

    const row = document.createElement("div");
    row.className = "wb-new-form-row";
    const beginBtn = document.createElement("button");
    beginBtn.textContent = "Begin";
    beginBtn.addEventListener("click", () => {
      if (!titleInput.value.trim()) return;
      this._showingNewForm = false;
      this.callbacks.onStartNew(titleInput.value, kindSelect.value);
    });
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "wb-cancel";
    cancelBtn.addEventListener("click", () => {
      this._showingNewForm = false;
      this.callbacks.onCancelNew();
    });
    row.append(beginBtn, cancelBtn);

    wrap.append(titleInput, kindSelect, row);
    return wrap;
  }
}
