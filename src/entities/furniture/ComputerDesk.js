import * as THREE from "three";
import { box, cylinder, group, Materials } from "../../utils/PlaceholderFactory.js";
import { woodGrainTexture } from "../../utils/ProceduralTexture.js";

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
 *
 * **The Desk phase (Version 2, Phase 16) — "the Workshop's command
 * centre... sitting down at the Desk should feel like sitting down at a
 * real creative workspace."** Following the Workbench's own precedent
 * exactly: same footprint, same position, same purpose — the desk, the
 * monitor, the chair, the lamp are all still where and what they were.
 * What changed is craftsmanship: a genuinely higher-detail wood grain on
 * the desk's own top (the same technique the Workbench phase introduced —
 * see `deskTopMaterial()` below), a monitor that finally reads as a
 * monitor (a real bezel behind the glass, a hinge joint, a wider stand
 * foot) rather than a flat glowing panel, plastic/rubber materials
 * replacing several more `matte()` calls that were never really matte
 * (the stand, the keyboard, the mouse, the lamp shade), a mousepad, and a
 * small pen holder in the desk's other back corner — deliberately
 * mirroring the lamp's own corner on the opposite side, the same
 * "visual balance" instinct the brief asked for. The chair gets the
 * bulk of this phase's structural attention: a real five-point swivel
 * base with castors in place of a single flat disc, armrests, a
 * mechanism plate between the post and the seat, and a slightly
 * reclined, slightly thicker-cushioned back — the same "this object
 * should read unmistakably as what it is" standard the Workbench's own
 * vice crank set. See `docs/COMPUTER.md`'s own "Craftsmanship" section
 * for the complete account, including what was deliberately left alone.
 */
let _deskTopMaterial = null;

/** Desk phase — "material quality... surface detail." The desk's own
 *  top is the surface a player sits in front of for as long as they're
 *  at the computer at all — the same reasoning the Workbench phase's
 *  `benchTopMaterial()` already established for its own top, reused
 *  verbatim here rather than invented a second way to do the same
 *  thing: `woodGrainTexture()`'s own optional `size`/`grainLines`/`step`
 *  parameters (added last phase, defaulting to the shared `Materials
 *  .wood()` look everywhere else in the Workshop) let this one surface
 *  ask for a genuinely richer grain without affecting any other wood
 *  object. Built once and cached at module scope, the same discipline
 *  every material factory in this project already holds itself to. */
function deskTopMaterial() {
  if (!_deskTopMaterial) {
    _deskTopMaterial = new THREE.MeshStandardMaterial({
      map: woodGrainTexture("#4a3120", "#2e1d10", { size: 512, grainLines: 60, step: 8 }),
      roughness: 0.75,
      metalness: 0.05,
    });
  }
  return _deskTopMaterial;
}

export const ComputerDeskDefinition = {
  id: "computerDesk",
  label: "Computer desk",
  footprint: { width: 1.5, depth: 1.4 },

  build() {
    const g = group();
    const topY = 0.75;

    const top = box(1.3, 0.06, 0.65, deskTopMaterial());
    top.position.set(0, topY, 0);
    g.add(top);
    // box()/cylinder() geometry is centred at its own local origin — topY
    // is the desk top's own centre, not its actual surface. Everything
    // below that's meant to rest *on* the desk (the monitor stand,
    // keyboard, mouse) needed to account for the top's own half-thickness
    // to sit flush rather than sinking slightly into it; surfaceY is that
    // real surface height, only ever used from here down.
    const surfaceY = topY + 0.03;

    for (const [x, z] of [[-0.58, -0.28], [0.58, -0.28], [-0.58, 0.28], [0.58, 0.28]]) {
      const leg = box(0.06, topY, 0.06, Materials.metal("#4a4844"));
      leg.position.set(x, topY / 2, z);
      g.add(leg);
    }

    // Desk phase — "Desk proportions... nothing should feel left behind
    // from earlier Workshop versions." Four independent legs with
    // nothing joining them low down was exactly the finding the
    // Workbench phase already made and fixed on its own object; the
    // desk had the identical gap. Two rails, spanning the desk's long
    // axis (x) on each side (matching each pair of legs' own z), sized
    // to genuinely reach and overlap them — the same pattern, reoriented
    // to this desk's own proportions rather than copied blindly at the
    // Workbench's own numbers.
    for (const z of [-0.28, 0.28]) {
      const stretcher = box(1.2, 0.05, 0.05, Materials.metal("#4a4844"));
      stretcher.position.set(0, 0.14, z);
      g.add(stretcher);
    }

    // Monitor. Desk phase — "monitor placement... desk accessories...
    // future expandability." The stand's own base and neck are
    // genuinely plastic now (a real monitor stand's foot almost always
    // is), widened slightly for a more convincing footprint, with a
    // small hinge block where the neck actually meets the screen —
    // the one addition that reads as "an adjustable mount" rather than
    // "a pole holding a rectangle up".
    const standBase = cylinder(0.1, 0.13, 0.02, Materials.plastic("#242424"));
    standBase.position.set(0, surfaceY + 0.01, -0.15);
    g.add(standBase);
    const standNeck = box(0.04, 0.15, 0.04, Materials.plastic("#242424"));
    standNeck.position.set(0, surfaceY + 0.085, -0.15);
    g.add(standNeck);
    const standHinge = box(0.07, 0.03, 0.05, Materials.plastic("#242424"));
    standHinge.position.set(0, surfaceY + 0.175, -0.14);
    g.add(standHinge);
    // A real bezel, sitting just behind the glass — larger than the
    // screen on every side so it reads as a frame from head-on, the
    // angle the panel's own opacity timing already keeps this mostly
    // seen from (see docs/COMPUTER.md's "Why the panel waits"). The
    // glass itself (`screen`, below) keeps its exact original size and
    // local position — `ComputerSystem._screenCorners` hardcodes that
    // rectangle, and nothing about adding a frame *behind* it needed to
    // touch the mesh that rectangle actually describes.
    const bezel = box(0.66, 0.42, 0.02, Materials.plastic("#242424"));
    bezel.position.set(0, surfaceY + 0.32, -0.135);
    g.add(bezel);
    const screen = box(0.6, 0.36, 0.03, Materials.emissive("#7fd8c4", 0.05));
    screen.position.set(0, surfaceY + 0.32, -0.12);
    g.add(screen);
    g.userData.screenGlowMesh = screen;

    // Keyboard, mouse, and — new this phase — a mousepad underneath it.
    // Desk phase — "material quality... plastic." Both were sharing
    // `matte()`'s own numbers for something that's always moulded
    // plastic in real life, the identical finding the Workbench phase
    // made about its own clipboard and fan. Proportions nudged slightly
    // closer to a real keyboard's own aspect ratio at the same time.
    const keyboard = box(0.36, 0.02, 0.13, Materials.plastic("#2c2c2c"));
    keyboard.position.set(0, surfaceY + 0.01, 0.15);
    g.add(keyboard);
    // A thin rubber mousepad — "comfort... small practical details."
    // Sits directly on the desk surface; the mouse above is lifted by
    // exactly the pad's own thickness so it rests on top of it, not
    // inside it.
    const mousepad = box(0.2, 0.004, 0.26, Materials.rubber("#1a1a1a"));
    mousepad.position.set(0.22, surfaceY + 0.002, 0.15);
    g.add(mousepad);
    const mouse = box(0.05, 0.025, 0.09, Materials.plastic("#2c2c2c"));
    mouse.position.set(0.22, surfaceY + 0.0165, 0.15);
    g.add(mouse);

    // A small desk lamp, off to the side — its own light (see
    // deskLampSocket, below) is registered with the Workshop's own light
    // switch (ComputerSystem.js), turning on and off right alongside
    // every other practical light in the room.
    const lampBase = cylinder(0.05, 0.06, 0.015, Materials.metal("#3a3a3a"));
    lampBase.position.set(0.52, topY + 0.04, -0.22);
    g.add(lampBase);
    const lampArm = cylinder(0.012, 0.012, 0.28, Materials.metal("#3a3a3a"));
    lampArm.position.set(0.5, topY + 0.15, -0.24);
    g.add(lampArm);
    // Desk phase — genuinely plastic, like every other painted-metal-
    // that-was-actually-plastic call site this pass touched.
    const lampShade = cylinder(0.03, 0.07, 0.1, Materials.plastic("#e0ab5c"));
    lampShade.position.set(0.52, topY + 0.27, -0.22);
    lampShade.rotation.z = 0.5;
    lampShade.rotation.x = -0.5;
    g.add(lampShade);
    g.userData.deskLampSocket = new THREE.Vector3(0.46, topY + 0.24, -0.26);

    // Living Spaces phase — "environmental composition." A monitor and a
    // lamp sitting on this desk with nothing ever visibly plugged into
    // anything was a real, if small, gap — named directly in this
    // project's own Furniture & Storage retrospective ("the music
    // cabinet's own cabling... the next unglamorous detail worth
    // attention," docs/HISTORY.md) and never picked up since. One cable,
    // not a tangle of them — the same "one small, deliberately
    // restrained addition" standard the pen holder and pencil already
    // set. Two plain, single-axis segments (the vice crank's own "a
    // single, unambiguous rotation" preference, not a compound one)
    // rather than a fully modelled drape: along the desk's own back
    // edge, then straight down beside the back-left leg to the floor.
    // Routed just outside the back-left leg's own outer face (leg spans
    // x:[-0.61,-0.55] — see the leg loop above) rather than straight down
    // its centre line, specifically to clear the stretcher rail that
    // shares this same z=-0.28 (spans x:[-0.6,0.6] — see the stretcher
    // loop above): a cable at the leg's own x would have run straight
    // through it.
    const cableMat = Materials.rubber("#1a1a1a");
    const cableAcrossDesk = cylinder(0.006, 0.006, 0.62, cableMat, 6);
    cableAcrossDesk.rotation.z = Math.PI / 2;
    cableAcrossDesk.position.set(-0.31, surfaceY + 0.005, -0.28);
    g.add(cableAcrossDesk);
    const cableDownLeg = cylinder(0.006, 0.006, surfaceY, cableMat, 6);
    cableDownLeg.position.set(-0.62, surfaceY / 2, -0.28);
    g.add(cableDownLeg);

    // Desk phase — "environmental storytelling... without introducing
    // unnecessary clutter." One small holder, a couple of pens leaning
    // in it — the desk's entire environmental-storytelling addition
    // this phase, deliberately alone rather than a scatter of stationery,
    // the identical restraint the Workbench phase held its own pencil to.
    // Placed in the desk's back-left corner specifically to balance the
    // lamp's own back-right corner — "better visual balance," concretely.
    const penCup = cylinder(0.035, 0.04, 0.09, Materials.plastic("#2c2c2c"));
    penCup.position.set(-0.48, surfaceY + 0.045, -0.2);
    g.add(penCup);
    const penCupRecess = cylinder(0.028, 0.028, 0.01, Materials.matte("#111111"));
    penCupRecess.position.set(-0.48, surfaceY + 0.085, -0.2);
    g.add(penCupRecess);
    const pen1 = cylinder(0.004, 0.004, 0.13, Materials.plastic("#c53d3d"));
    pen1.position.set(-0.485, surfaceY + 0.12, -0.195);
    pen1.rotation.z = 0.25;
    pen1.rotation.x = 0.15;
    g.add(pen1);
    const pen2 = cylinder(0.004, 0.004, 0.13, Materials.plastic("#2f5fa8"));
    pen2.position.set(-0.472, surfaceY + 0.12, -0.205);
    pen2.rotation.z = -0.2;
    pen2.rotation.x = -0.1;
    g.add(pen2);

    // Chair. Desk phase — "the chair should support the feeling of
    // comfortably sitting down to work." A mechanism plate between the
    // post and the seat (the small detail that makes the post read as
    // "a gas-lift cylinder" rather than "a pole"), a thicker seat and a
    // slightly reclined back for a genuinely cushioned, sat-in read, and
    // — the chair's own equivalent of the Workbench vice's crank — a
    // real five-point swivel base with castors in place of a single
    // flat disc, plus armrests. Every part still sits directly above
    // the same footprint the old base occupied; only the base itself
    // changed shape.
    const mechPlate = box(0.28, 0.03, 0.28, Materials.plastic("#202020"));
    mechPlate.position.set(0, 0.435, 0.55);
    g.add(mechPlate);
    const post = cylinder(0.03, 0.03, 0.42, Materials.metal());
    post.position.set(0, 0.21, 0.55);
    g.add(post);

    // A five-point base (a real office chair almost never balances on
    // one flat disc), each arm ending in a small castor — the detail
    // that makes this read unmistakably as "an office chair" rather
    // than "a stool on a pole".
    const baseHub = cylinder(0.045, 0.045, 0.04, Materials.metal("#2b2b2b"));
    baseHub.position.set(0, 0.02, 0.55);
    g.add(baseHub);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const arm = box(0.22, 0.025, 0.035, Materials.plastic("#202020"));
      arm.position.set(cos * 0.11, 0.02, 0.55 + sin * 0.11);
      arm.rotation.y = angle;
      g.add(arm);
      // Laid on its side, the same "flat circular faces now point
      // horizontally" technique the Workbench's own fan housing already
      // uses for the identical reason: a cylinder reads as a small wheel
      // once it's rotated this way, not as a coin lying flat.
      const castor = cylinder(0.022, 0.022, 0.02, Materials.rubber("#141414"), 10);
      castor.rotation.x = Math.PI / 2;
      // Rotating around X swaps this cylinder's height (0.02) and radius
      // (0.022) axes — its vertical extent is now governed by the
      // *radius*, not half its height, so it needs to sit a full radius
      // above the floor to actually rest on it rather than clip through.
      castor.position.set(cos * 0.21, 0.022, 0.55 + sin * 0.21);
      g.add(castor);
    }

    const seat = box(0.42, 0.07, 0.42, Materials.fabric("#3c5a53"));
    seat.position.set(0, 0.485, 0.55);
    g.add(seat);
    // A slight recline — the top of the backrest tilts a few degrees
    // toward the back of the chair (away from the desk), the same small,
    // single, unambiguous rotation the Workbench phase's own pencil
    // comment favoured over a compound one risking an unpredictable
    // result.
    const back = box(0.42, 0.44, 0.06, Materials.fabric("#3c5a53"));
    back.position.set(0, 0.74, 0.75);
    back.rotation.x = 0.07;
    g.add(back);

    // Armrests — plastic, spanning roughly the seat's own depth, clear
    // of the desk (whose nearest edge sits at z=0.325, well short of
    // where these begin at z=0.4).
    for (const side of [-1, 1]) {
      const armPost = box(0.03, 0.11, 0.03, Materials.plastic("#2c2c2c"));
      armPost.position.set(side * 0.235, 0.575, 0.55);
      g.add(armPost);
      const armPad = box(0.05, 0.02, 0.3, Materials.plastic("#2c2c2c"));
      armPad.position.set(side * 0.235, 0.64, 0.55);
      g.add(armPad);
    }

    return g;
  },

  interaction: {
    prompt: "Sit down at the computer",
    radius: 2.6, // large furniture — see docs/WORLD.md's interaction-distance pass
    // Focus pose is in the entity's local space; FurnitureSystem converts
    // it to world space once placed, so this definition stays reusable
    // even if the desk is later moved to a different spot in the room.
    // Desk phase — reviewed against every geometry change above (the
    // raised seat, the reclined back, the new monitor bezel) and found
    // to already read naturally, the same "confirming something is
    // already right is a legitimate outcome" verdict the Workbench phase
    // reached about its own lean-in pose. Nothing here actually moves
    // relative to this fixed camera point — the seat is a few
    // centimetres taller, not the screen it's aimed at.
    focusPoseLocal: {
      position: [0, 1.32, 0.19],
      lookAt: [0, 1.1, -0.16],
    },
    // No overlayId — the computer doesn't use the generic full-screen
    // overlay pipeline (see OverlayManager). Sitting down and standing up
    // are just two events; ComputerSystem does the rest.
    onInteract: ({ engine }) => engine.events.emit("computer:activate", {}),
    onExit: ({ engine }) => engine.events.emit("computer:deactivate", {}),
  },
};
