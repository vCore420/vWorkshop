import * as THREE from "three";
import { box, cylinder, group, Materials } from "../../utils/PlaceholderFactory.js";

/**
 * Workbench
 * ---------
 * Like `ComputerDesk.js`, this file's job is narrow on purpose: build the
 * permanent geometry (vice, tool tray, lamp — unchanged since phase 1 —
 * plus a clipboard) and describe how leaning in to work feels, in local
 * space. Everything about what's actually *on* the bench — which project,
 * which physical objects represent it — lives entirely in `src/workbench/`,
 * reached only through `workbench:activate` / `workbench:deactivate`.
 *
 * Two anchors exist purely for `src/workbench/` to use:
 *   - `presenceAnchor`: an empty group `WorkbenchSystem` fills with
 *     whatever the current project's presence items are, and clears
 *     wholesale when the project changes — never touching the bench's own
 *     permanent geometry.
 *   - `clipboardMesh`: the small always-there clipboard the workbench's
 *     panel visually anchors to, regardless of which project is active.
 */
export const WorkbenchDefinition = {
  id: "workbench",
  label: "Workbench",
  footprint: { width: 1.9, depth: 1.0 },

  build() {
    const g = group();
    const topY = 0.85;
    const surfaceY = topY + 0.04;

    const top = box(1.8, 0.08, 0.8, Materials.wood("#5a3d29"));
    top.position.set(0, topY, 0);
    g.add(top);

    const legGeoPositions = [
      [-0.82, 0, -0.32], [0.82, 0, -0.32], [-0.82, 0, 0.32], [0.82, 0, 0.32],
    ];
    for (const [x, , z] of legGeoPositions) {
      const leg = box(0.08, topY, 0.08, Materials.wood("#3d2a1c"));
      leg.position.set(x, topY / 2, z);
      g.add(leg);
    }

    // A small vice at one end — signals "this is a place work happens".
    const viceBase = box(0.18, 0.08, 0.22, Materials.metal());
    viceBase.position.set(0.68, topY + 0.06, -0.2);
    g.add(viceBase);
    const viceJaw = box(0.18, 0.1, 0.05, Materials.metal("#6f6c64"));
    viceJaw.position.set(0.68, topY + 0.14, -0.05);
    g.add(viceJaw);

    // A shallow tray holding a couple of tool placeholders — enough to read
    // as "tools live here" without turning into decorative clutter.
    const tray = box(0.5, 0.03, 0.28, Materials.matte("#2f2a24"));
    tray.position.set(-0.55, topY + 0.03, 0.2);
    g.add(tray);
    for (let i = 0; i < 3; i++) {
      const handle = cylinder(0.015, 0.015, 0.28, Materials.matte(["#b8863b", "#8d8577", "#6b4a34"][i]));
      handle.rotation.z = Math.PI / 2;
      handle.position.set(-0.7 + i * 0.14, topY + 0.06, 0.2);
      g.add(handle);
    }

    // A dim work-light on a simple arm — LightingSystem attaches the real
    // PointLight; this is just the fixture geometry.
    const lampArm = cylinder(0.015, 0.015, 0.4, Materials.metal());
    lampArm.position.set(0.75, topY + 0.2, 0.3);
    g.add(lampArm);
    const lampHead = cylinder(0.09, 0.06, 0.12, Materials.metal("#3a3a3a"));
    lampHead.position.set(0.75, topY + 0.42, 0.3);
    lampHead.rotation.x = Math.PI / 2.6;
    g.add(lampHead);
    g.userData.lampSocket = new THREE.Vector3(0.75, topY + 0.42, 0.34);

    // The clipboard — always here, independent of whatever project is
    // currently occupying the bench. This is what the workbench's small
    // panel anchors itself to (see src/workbench/WorkbenchSystem.js).
    const clipboardBoard = box(0.2, 0.015, 0.26, Materials.matte("#3a3a3a"));
    clipboardBoard.position.set(0.05, surfaceY + 0.008, 0.34);
    g.add(clipboardBoard);
    const clip = box(0.1, 0.02, 0.03, Materials.metal("#8d8577"));
    clip.position.set(0.05, surfaceY + 0.024, 0.22);
    g.add(clip);
    const clipboardPage = box(0.17, 0.008, 0.22, Materials.paper());
    clipboardPage.position.set(0.05, surfaceY + 0.02, 0.35);
    g.add(clipboardPage);
    g.userData.clipboardMesh = clipboardPage;

    // Where the current project's physical presence lives. Empty until
    // WorkbenchSystem populates it — see docs/WORKBENCH.md.
    const presenceAnchor = new THREE.Group();
    presenceAnchor.name = "presenceAnchor";
    g.add(presenceAnchor);
    g.userData.presenceAnchor = presenceAnchor;
    g.userData.surfaceY = surfaceY;

    return g;
  },

  interaction: {
    prompt: "Lean in over the bench",
    radius: 2.4, // large furniture — see docs/WORLD.md's interaction-distance pass
    // A closer, lower pose — leaning over your work, not sitting down.
    focusPoseLocal: {
      position: [0.0, 1.28, 0.62],
      lookAt: [0.02, 0.92, 0.05],
    },
    // No overlayId — like the computer, the workbench doesn't use the
    // generic overlay pipeline. See src/workbench/WorkbenchSystem.js.
    onInteract: ({ engine }) => engine.events.emit("workbench:activate", {}),
    onExit: ({ engine }) => engine.events.emit("workbench:deactivate", {}),
  },
};
