import { FurnitureSystem } from "../systems/FurnitureSystem.js";
import { damp, clamp } from "../utils/MathUtils.js";
import { makeTopDownRectCorners, projectRect } from "../utils/ScreenProjector.js";
import { WorkbenchPanel } from "./WorkbenchPanel.js";
import { assignSlots } from "./slots.js";
import { buildPresenceItem } from "./presence/registry.js";
import { resolvePresenceTemplate } from "./kindTemplates.js";

const PANEL_SMOOTHING = 8;
const WB_REVEAL_START = 0.3;
const OUT_DURATION = 0.32;
const IN_DURATION = 0.45;
const OUT_TO_IN_DELAY_MS = (OUT_DURATION + 0.05) * 1000;

/**
 * WorkbenchSystem
 * ----------------
 * The workbench, as a system — mirroring `ComputerSystem`'s shape closely
 * on purpose (see docs/COMPUTER.md and docs/WORKBENCH.md), but simpler in
 * one important way: the bench's physical presence is visible *all the
 * time*, whether or not anyone is interacting with it. `progress` here
 * only governs the small clipboard panel — not lights, not a vignette, not
 * the room dimming. Leaning in is a much quieter gesture than sitting down
 * at the computer, and the architecture reflects that.
 *
 * `Workbench.js` builds geometry and emits exactly two events —
 * `workbench:activate` / `workbench:deactivate` — and exposes two anchors
 * on its object3D: `presenceAnchor` (an empty group this system fills) and
 * `clipboardMesh` (what the panel projects itself onto). Everything about
 * *which* project is current, how its presence resolves from metadata, and
 * how transitions play out lives here.
 */
export class WorkbenchSystem {
  constructor(deps) {
    this.deps = deps; // { projectsStore }
    this.active = false;
    this.currentProjectId = null;
    this._panelProgress = 0;
    this._tweens = [];
  }

  init(engine) {
    this.engine = engine;

    const bench = engine.getSystem(FurnitureSystem)?.getPiece("workbench");
    if (!bench) {
      console.warn("[WorkbenchSystem] no workbench found — the bench will be inert this session.");
      return;
    }
    this.benchObject = bench.entity.object3D;
    this.presenceAnchor = this.benchObject.userData.presenceAnchor;
    this.clipboardMesh = this.benchObject.userData.clipboardMesh;
    this.surfaceY = this.benchObject.userData.surfaceY;
    // Clipboard page is 0.17 × 0.008 × 0.22 (see Workbench.js) — a small
    // lift above its top face, toward a camera looking down at it.
    this._clipboardCorners = makeTopDownRectCorners(0.085, 0.11, 0.006);

    this.panel = new WorkbenchPanel(document.getElementById("workbench-root"), {
      onTitleChange: (title) => this.deps.projectsStore.update(this.currentProjectId, { title }),
      onNotesChange: (notes) => this.deps.projectsStore.update(this.currentProjectId, { notes }),
      onFinish: () => this.finishCurrentProject(),
      onStartNew: (title, kind) => this.startNewProject(title, kind),
      onCancelNew: () => this._refreshPanel(),
      onSwitch: (id) => this.setCurrentProject(id),
      onStandUp: () => engine.events.emit("interaction:exitRequested"),
    });

    engine.events.on("workbench:activate", () => this.activate());
    engine.events.on("workbench:deactivate", () => this.deactivate());

    engine.events.on("persistence:save", (bag) => {
      bag.workbench = { currentProjectId: this.currentProjectId };
    });
    engine.events.on("persistence:load", (bag) => {
      if (bag?.workbench?.currentProjectId) this.currentProjectId = bag.workbench.currentProjectId;
    });
  }

  /**
   * Called once from main.js, after `engine.init()` has fully resolved (and
   * therefore after any saved state has already been applied — see
   * docs/WORKBENCH.md for why this can't just happen inside `init()`).
   * Decides what's actually on the bench for this session and builds it
   * without a transition, since there's nothing to transition from yet.
   */
  finalizeInitialState() {
    if (!this.presenceAnchor) return;
    const store = this.deps.projectsStore;

    let project = this.currentProjectId ? store.get(this.currentProjectId) : null;
    if (!project || project.status !== "active") {
      project = this._mostRecentActive();
    }
    if (!project && store.all().length === 0) {
      project = store.add({
        title: "Getting this workshop running",
        status: "active",
        kind: "software",
        notes: "First project on the bench \u2014 everything else grows from here.",
      });
    }

    this.currentProjectId = project?.id ?? null;
    this._rebuildPresence(project, { instant: true });
  }

  activate() {
    if (this.active || !this.clipboardMesh) return;
    this.active = true;
    this.panel.setInteractive(true);
    this._refreshPanel();
    this.engine.input?.exitPointerLock();
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;
    this.panel.setInteractive(false);
    this.engine.input?.requestPointerLock();
  }

  setCurrentProject(projectId) {
    const project = this.deps.projectsStore.get(projectId);
    if (!project) return;
    this.currentProjectId = project.id;
    this._rebuildPresence(project);
    this._refreshPanel();
  }

  startNewProject(title, kind) {
    const project = this.deps.projectsStore.add({ title, status: "active", kind });
    this.currentProjectId = project.id;
    this._rebuildPresence(project);
    this._refreshPanel();
  }

  finishCurrentProject() {
    if (!this.currentProjectId) return;
    this.deps.projectsStore.update(this.currentProjectId, { status: "done" });
    const finishedId = this.currentProjectId;
    const next = this._mostRecentActive(finishedId);
    this.currentProjectId = next?.id ?? null;
    this._rebuildPresence(next);
    this._refreshPanel();
  }

  _mostRecentActive(excludeId = null) {
    const active = this.deps.projectsStore.byStatus("active").filter((p) => p.id !== excludeId);
    return [...active].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0] ?? null;
  }

  _refreshPanel() {
    const project = this.currentProjectId ? this.deps.projectsStore.get(this.currentProjectId) : null;
    const activeProjects = this.deps.projectsStore.byStatus("active");
    this.panel.render({ project, activeProjects });
  }

  /** A project's physical description, resolved from its own metadata if
   *  it has one, or baked in from its `kind` the first time it needs one. */
  _resolvePresenceArray(project) {
    if (Array.isArray(project.presence) && project.presence.length > 0) return project.presence;
    const template = resolvePresenceTemplate(project.kind);
    this.deps.projectsStore.update(project.id, { presence: template });
    return template;
  }

  _resolveAndBuildItems(project) {
    const descriptors = this._resolvePresenceArray(project);
    const built = [];
    for (const descriptor of descriptors) {
      const result = buildPresenceItem(descriptor);
      if (result) built.push({ ...descriptor, object3D: result.object3D, size: result.size });
    }
    const assignments = assignSlots(built);
    for (const { item, slot } of assignments) {
      item.object3D.position.set(slot.position[0], this.surfaceY, slot.position[1]);
      item.object3D.rotation.y = slot.rotationY;
    }
    return assignments.map((a) => a.item);
  }

  /** Clears whatever's currently on the bench (with a "packing away"
   *  shrink) and, once that's finished, builds and grows in the new
   *  project's presence — or leaves the bench honestly empty if `project`
   *  is null. `instant: true` skips the choreography for the initial load. */
  _rebuildPresence(project, { instant = false } = {}) {
    const anchor = this.presenceAnchor;
    const oldChildren = [...anchor.children];

    const buildAndShowNew = () => {
      for (const child of oldChildren) anchor.remove(child);
      const items = project ? this._resolveAndBuildItems(project) : [];
      for (const { object3D } of items) {
        anchor.add(object3D);
        if (instant) {
          object3D.scale.setScalar(1);
        } else {
          object3D.scale.setScalar(0.001);
          this._tweens.push({ group: object3D, elapsed: 0, duration: IN_DURATION, direction: "in" });
        }
      }
    };

    if (instant || oldChildren.length === 0) {
      buildAndShowNew();
      return;
    }

    for (const child of oldChildren) {
      this._tweens.push({
        group: child,
        elapsed: 0,
        duration: OUT_DURATION,
        direction: "out",
        onComplete: () => anchor.remove(child),
      });
    }
    setTimeout(buildAndShowNew, OUT_TO_IN_DELAY_MS);
  }

  _updateTweens(dt) {
    for (let i = this._tweens.length - 1; i >= 0; i--) {
      const tween = this._tweens[i];
      tween.elapsed += dt;
      const t = Math.min(1, tween.elapsed / tween.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const scale = tween.direction === "in" ? eased : 1 - eased;
      tween.group.scale.setScalar(Math.max(0.001, scale));
      if (t >= 1) {
        tween.onComplete?.();
        this._tweens.splice(i, 1);
      }
    }
  }

  update(dt) {
    this._updateTweens(dt);

    if (!this.clipboardMesh) return;
    const target = this.active ? 1 : 0;
    this._panelProgress = damp(this._panelProgress, target, PANEL_SMOOTHING, dt);
    if (Math.abs(this._panelProgress - target) < 0.002) this._panelProgress = target;

    if (this._panelProgress > 0.001) {
      const rect = projectRect(this.clipboardMesh, this._clipboardCorners, this.engine.camera, window.innerWidth, window.innerHeight);
      const opacity = clamp((this._panelProgress - WB_REVEAL_START) / (1 - WB_REVEAL_START), 0, 1);
      this.panel.updateRect(rect, opacity);
    }
  }
}
