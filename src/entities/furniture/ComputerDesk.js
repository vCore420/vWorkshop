import * as THREE from "three";
import { box, cylinder, group, Materials } from "../../utils/PlaceholderFactory.js";

/**
 * ComputerDesk
 * ------------
 * The desk's job in this phase is narrow on purpose: build the geometry
 * (including its own small lamp — see `deskLampSocket`) and describe *how*
 * sitting down feels, in local space. Everything about what the computer
 * actually *does* once you're sitting — the screen turning on, the panel
 * appearing, which app is open — lives entirely in `src/computer/`, and
 * this file talks to it only through two events: `computer:activate` and
 * `computer:deactivate`. That's deliberate: `src/computer/ComputerSystem.js`
 * could be deleted and this desk would still be a desk, just an inert one.
 *
 * `screenGlowMesh` and `deskLampSocket` are read by ComputerSystem to attach
 * its own lights — not by LightingSystem, which only owns the room's
 * general-purpose fixtures. The computer's atmosphere is self-contained.
 */
export const ComputerDeskDefinition = {
  id: "computerDesk",
  label: "Computer desk",
  footprint: { width: 1.5, depth: 1.4 },

  build() {
    const g = group();
    const topY = 0.75;

    const top = box(1.3, 0.06, 0.65, Materials.wood("#4a3120"));
    top.position.set(0, topY, 0);
    g.add(top);

    for (const [x, z] of [[-0.58, -0.28], [0.58, -0.28], [-0.58, 0.28], [0.58, 0.28]]) {
      const leg = box(0.06, topY, 0.06, Materials.metal("#4a4844"));
      leg.position.set(x, topY / 2, z);
      g.add(leg);
    }

    // Monitor
    const standBase = cylinder(0.09, 0.11, 0.02, Materials.matte("#232323"));
    standBase.position.set(0, topY + 0.01, -0.15);
    g.add(standBase);
    const standNeck = box(0.04, 0.18, 0.04, Materials.matte("#232323"));
    standNeck.position.set(0, topY + 0.1, -0.15);
    g.add(standNeck);
    const screen = box(0.6, 0.36, 0.03, Materials.emissive("#7fd8c4", 0.05));
    screen.position.set(0, topY + 0.32, -0.16);
    g.add(screen);
    g.userData.screenGlowMesh = screen;

    // Keyboard + mouse placeholders
    const keyboard = box(0.34, 0.02, 0.12, Materials.matte("#3a3a3a"));
    keyboard.position.set(0, topY + 0.02, 0.15);
    g.add(keyboard);
    const mouse = box(0.05, 0.02, 0.09, Materials.matte("#3a3a3a"));
    mouse.position.set(0.22, topY + 0.02, 0.15);
    g.add(mouse);

    // A small desk lamp, off to the side — this is the "always a little
    // warm and inviting" light ComputerSystem attaches to, independent of
    // whether the monitor itself is on. Real desk lamps get left on.
    const lampBase = cylinder(0.05, 0.06, 0.015, Materials.metal("#3a3a3a"));
    lampBase.position.set(0.52, topY + 0.01, -0.22);
    g.add(lampBase);
    const lampArm = cylinder(0.012, 0.012, 0.28, Materials.metal("#3a3a3a"));
    lampArm.position.set(0.5, topY + 0.15, -0.24);
    lampArm.rotation.z = -0.25;
    g.add(lampArm);
    const lampShade = cylinder(0.03, 0.07, 0.1, Materials.matte("#e0ab5c"));
    lampShade.position.set(0.46, topY + 0.27, -0.26);
    lampShade.rotation.x = 0.5;
    g.add(lampShade);
    g.userData.deskLampSocket = new THREE.Vector3(0.46, topY + 0.24, -0.26);

    // Chair
    const seat = box(0.42, 0.06, 0.42, Materials.fabric("#3c5a53"));
    seat.position.set(0, 0.46, 0.55);
    g.add(seat);
    const back = box(0.42, 0.42, 0.06, Materials.fabric("#3c5a53"));
    back.position.set(0, 0.7, 0.75);
    g.add(back);
    const post = cylinder(0.03, 0.03, 0.44, Materials.metal());
    post.position.set(0, 0.22, 0.55);
    g.add(post);
    const chairBase = cylinder(0.22, 0.22, 0.03, Materials.metal("#2b2b2b"), 12);
    chairBase.position.set(0, 0.02, 0.55);
    g.add(chairBase);

    return g;
  },

  interaction: {
    prompt: "Sit down at the computer",
    radius: 2.4, // large furniture — see docs/WORLD.md's interaction-distance pass
    // Focus pose is in the entity's local space; FurnitureSystem converts
    // it to world space once placed, so this definition stays reusable
    // even if the desk is later moved to a different spot in the room.
    focusPoseLocal: {
      position: [0, 1.22, 0.25],
      lookAt: [0, 1.05, -0.16],
    },
    // No overlayId — the computer doesn't use the generic full-screen
    // overlay pipeline (see OverlayManager). Sitting down and standing up
    // are just two events; ComputerSystem does the rest.
    onInteract: ({ engine }) => engine.events.emit("computer:activate", {}),
    onExit: ({ engine }) => engine.events.emit("computer:deactivate", {}),
  },
};
