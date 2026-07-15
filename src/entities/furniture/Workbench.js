import * as THREE from "three";
import { box, cylinder, group, Materials } from "../../utils/PlaceholderFactory.js";
import { woodGrainTexture } from "../../utils/ProceduralTexture.js";

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
 * **The Workbench phase — "it should become the Workshop's hero prop...
 * refine, don't redesign."** Every permanent fixture below is unchanged in
 * *position* and *purpose* from before this phase — the same vice, the
 * same tray, the same lamp, the same clipboard, the same fan, at the same
 * footprint and height. What changed is craftsmanship: a genuinely
 * higher-detail wood grain on the one surface a player actually leans
 * over and looks straight down at (see the top's own material comment),
 * a stretcher between the legs for real structural weight instead of
 * four posts floating independently, a vice that actually has a crank,
 * plastic/rubber materials replacing a handful of `matte()` calls that
 * were never really matte to begin with, and one small, deliberately
 * restrained sign of daily use (a pencil, set down near the clipboard —
 * see "Environmental Storytelling" below). See `docs/WORKBENCH.md`'s own
 * "Craftsmanship" section for the complete account and the reasoning
 * behind what was deliberately left alone.
 *
 * Two anchors exist purely for `src/workbench/` to use:
 *   - `presenceAnchor`: an empty group `WorkbenchSystem` fills with
 *     whatever the current project's presence items are, and clears
 *     wholesale when the project changes — never touching the bench's own
 *     permanent geometry.
 *   - `clipboardMesh`: the small always-there clipboard the workbench's
 *     panel visually anchors to, regardless of which project is active.
 *
 * Also carries a small desk fan with genuinely spinning blades — a
 * performance reference object, not decoration; see its own comment
 * further down and docs/PERFORMANCE.md.
 */
let _benchTopMaterial = null;

/** Workbench phase — "material quality... wood... surface detail." The
 *  one wood surface in the whole Workshop a player leans directly over
 *  and looks straight down at, for as long as they're at the bench at
 *  all — worth a genuinely richer grain than `Materials.wood()`'s own
 *  shared, cached default (256px canvas, 40 lines, tuned to look right
 *  on everything from a chair leg to a wall panel). Same base colour,
 *  same roughness/metalness as `Materials.wood()` — this isn't a
 *  different *material*, just a more detailed *texture* on it, so the
 *  top still reads as unmistakably the same wood the legs and every
 *  other wood surface in the Workshop are. Built once and cached at
 *  module scope, the same "don't rebuild a texture on every call"
 *  discipline `Materials`' own cache already holds itself to — a
 *  second Workbench instance (there isn't one today, but nothing here
 *  should assume that) would reuse it rather than generating a second,
 *  identical canvas. */
function benchTopMaterial() {
  if (!_benchTopMaterial) {
    _benchTopMaterial = new THREE.MeshStandardMaterial({
      map: woodGrainTexture("#5a3d29", "#3a2416", { size: 512, grainLines: 70, step: 8 }),
      roughness: 0.75,
      metalness: 0.05,
    });
  }
  return _benchTopMaterial;
}

export const WorkbenchDefinition = {
  id: "workbench",
  label: "Workbench",
  footprint: { width: 1.9, depth: 1.0 },

  build() {
    const g = group();
    const topY = 0.85;
    const surfaceY = topY + 0.04;

    const top = box(1.8, 0.08, 0.8, benchTopMaterial());
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

    // Workbench phase — "overall proportions... small visual
    // refinements... nothing should feel like it belongs to an older
    // version of the Workshop." Four independent posts with nothing
    // connecting them low down never quite read as one solid piece of
    // furniture — a real workbench almost always has a stretcher
    // (a rail joining the legs, low near the floor) for exactly this
    // reason: both genuine rigidity and the visual weight of "this was
    // built to hold real force." Two rails, spanning the long axis on
    // each side, sitting well clear of anything on the surface above.
    for (const z of [-0.32, 0.32]) {
      const stretcher = box(1.68, 0.06, 0.06, Materials.wood("#3d2a1c"));
      stretcher.position.set(0, 0.16, z);
      g.add(stretcher);
    }

    // A small vice at one end — signals "this is a place work happens".
    const viceBase = box(0.18, 0.08, 0.22, Materials.metal());
    viceBase.position.set(0.68, topY + 0.06, -0.2);
    g.add(viceBase);
    const viceJaw = box(0.18, 0.1, 0.05, Materials.metal("#6f6c64"));
    viceJaw.position.set(0.68, topY + 0.14, -0.05);
    g.add(viceJaw);
    // Workbench phase — "looks intentional... supports the Workshop's
    // identity." A small T-shaped crank on the screw side, the one
    // addition that reads unmistakably as "a vice" rather than "two
    // metal boxes" — stays well inside the bench's own edge (see this
    // comment's own arithmetic: the base's own right edge is at
    // x=0.77; the crank reaches to x=0.87, short of the bench's 0.9m
    // half-width).
    const viceCrankRod = cylinder(0.012, 0.012, 0.1, Materials.metal("#8d8577"));
    viceCrankRod.rotation.z = Math.PI / 2;
    viceCrankRod.position.set(0.82, topY + 0.08, -0.2);
    g.add(viceCrankRod);
    const viceCrankHandle = cylinder(0.012, 0.012, 0.09, Materials.metal("#8d8577"));
    viceCrankHandle.rotation.x = Math.PI / 2;
    viceCrankHandle.position.set(0.87, topY + 0.08, -0.2);
    g.add(viceCrankHandle);

    // A shallow tray holding a couple of tool placeholders — enough to read
    // as "tools live here" without turning into decorative clutter.
    //
    // Workshop Reliability phase — "behind the notebook, a cylindrical
    // object currently appears with overlapping colours and visual
    // clipping." Root cause, found by tracing exact positions: these
    // three handles (0.28m long, spaced only 0.14m apart — half their
    // own length) already overlapped *each other*, and the tray itself
    // reached to z=0.34, well inside the standalone Notebook prop's own
    // footprint (bench-local x=-0.45, z=0.4 — see slots.js's own
    // comment on that placement) — three different-coloured cylinders
    // intersecting both their neighbours and the notebook mesh is
    // exactly "overlapping colours and visual clipping." Still needed —
    // "tools live here" is the entire point of a tray — so repaired,
    // not removed: shorter handles that clear each other, moved back
    // (lower z) to clear the notebook by a genuine margin instead of
    // reaching underneath it.
    const tray = box(0.5, 0.03, 0.28, Materials.matte("#2f2a24"));
    tray.position.set(-0.55, topY + 0.03, 0.05);
    g.add(tray);
    for (let i = 0; i < 3; i++) {
      const handle = cylinder(0.015, 0.015, 0.16, Materials.matte(["#b8863b", "#8d8577", "#6b4a34"][i]));
      handle.rotation.z = Math.PI / 2;
      handle.position.set(-0.68 + i * 0.18, topY + 0.06, 0.05);
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
    // Workbench phase — "small visual inconsistencies" (architectural
    // review): the whole assembly used to sit at z=0.34 with a 0.26m
    // depth, meaning its own front edge reached to z=0.47 — 7cm past
    // the bench's own actual edge at z=0.4, quietly overhanging thin
    // air the entire time. Pulled back as one unit (board, clip, and
    // page keep the exact same relative offsets to each other, so
    // WorkbenchSystem's own panel projection — which only ever reads
    // `clipboardMesh`'s current world transform, not a remembered
    // position — needed no changes at all) to sit fully on the surface.
    // Board is genuinely plastic, not an unnamed "matte" surface; see
    // Materials.plastic()'s own comment.
    const clipboardBoard = box(0.2, 0.015, 0.26, Materials.plastic("#3a3a3a"));
    clipboardBoard.position.set(0.05, surfaceY + 0.008, 0.27);
    g.add(clipboardBoard);
    const clip = box(0.1, 0.02, 0.03, Materials.metal("#8d8577"));
    clip.position.set(0.05, surfaceY + 0.024, 0.15);
    g.add(clip);
    const clipboardPage = box(0.17, 0.008, 0.22, Materials.paper());
    clipboardPage.position.set(0.05, surfaceY + 0.02, 0.28);
    g.add(clipboardPage);
    g.userData.clipboardMesh = clipboardPage;

    // Workbench phase — "environmental storytelling... without
    // introducing unnecessary clutter... one small believable detail."
    // A single pencil, resting across the clipboard as if just set down
    // mid-thought — the one addition this phase makes here, deliberately
    // alone rather than a whole cup of them or a scatter of other
    // stationery, which would read as staged clutter rather than a
    // genuine, momentary pause in someone's work.
    const pencil = cylinder(0.004, 0.004, 0.15, Materials.matte("#d9a441"));
    pencil.position.set(0.06, surfaceY + 0.03, 0.26);
    pencil.rotation.z = Math.PI / 2; // lying flat on the clipboard, parallel to its own long edge — a single, unambiguous rotation rather than a compound one risking an unpredictable result
    g.add(pencil);

    // Where the current project's physical presence lives. Empty until
    // WorkbenchSystem populates it — see docs/WORKBENCH.md.
    const presenceAnchor = new THREE.Group();
    presenceAnchor.name = "presenceAnchor";
    g.add(presenceAnchor);
    g.userData.presenceAnchor = presenceAnchor;
    g.userData.surfaceY = surfaceY;

    // A small desk fan — deliberately not decoration. Its whole purpose
    // is a constant, always-moving visual reference for judging frame
    // smoothness while testing: a real stutter or a dropped frame shows
    // up immediately as a stumble in its otherwise perfectly steady spin,
    // in a way that's much harder to judge from camera movement alone
    // (which a choppy *input* system, rather than a choppy *renderer*,
    // can also make look uneven). See docs/PERFORMANCE.md.
    //
    // Workbench phase — base, housing, and blades are genuinely
    // plastic on a real desk fan like this one; only the thin
    // adjustable neck stays a matte-painted metal stem.
    const fanGroup = new THREE.Group();
    const fanBase = cylinder(0.05, 0.06, 0.02, Materials.plastic("#2c2c2c"));
    fanBase.position.set(0, 0.01, 0);
    fanGroup.add(fanBase);
    const fanNeck = cylinder(0.012, 0.012, 0.16, Materials.matte("#3a3a3a"));
    fanNeck.position.set(0, 0.1, 0);
    fanGroup.add(fanNeck);
    const fanHousing = cylinder(0.09, 0.09, 0.025, Materials.plastic("#5a5a5a"), 20);
    fanHousing.rotation.x = Math.PI / 2; // lay the cylinder on its side so its flat faces point horizontally, like a real fan
    fanHousing.position.set(0, 0.2, 0);
    fanGroup.add(fanHousing);

    const bladeAssembly = new THREE.Group();
    bladeAssembly.position.set(0, 0.2, 0.018);
    const bladeMat = Materials.plastic("#d8d8d8");
    for (let i = 0; i < 3; i++) {
      const blade = box(0.018, 0.075, 0.006, bladeMat, { castShadow: false });
      blade.position.set(0, 0.04, 0);
      blade.rotation.z = (i / 3) * Math.PI * 2;
      bladeAssembly.add(blade);
    }
    fanGroup.add(bladeAssembly);

    fanGroup.position.set(-0.72, topY + 0.02, -0.32);
    fanGroup.rotation.y = 0.5; // angled slightly, as if aimed across the bench rather than dead-on
    g.add(fanGroup);
    g.userData.spinningParts = [{ mesh: bladeAssembly, axis: "z", speed: 7 }];

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
