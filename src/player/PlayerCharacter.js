import * as THREE from "three";
import { getBodyModel } from "./BodyModels.js";

/**
 * PlayerCharacter
 * -----------------
 * "Think along the lines of Minecraft... simple geometry is preferred
 * because it allows complete customisation." Every body section is a
 * unit-sized box (same "unit primitive, scaled per-instance" idea
 * `ObjectCompiler.js` already uses for Builder objects), scaled by that
 * section's own width/height/depth multipliers — never hand-modelled,
 * never unique geometry per proportion.
 *
 * The rig is a genuine parent-child joint hierarchy — a shoulder pivot
 * holds the upper arm, which holds an elbow pivot, which holds the lower
 * arm, which holds a wrist pivot, which holds the hand — not eight
 * independent meshes positioned by hand. That's what makes "Animation"
 * (`PlayerAnimationSystem.js`) a matter of rotating pivots that already
 * exist, not a rig rewrite: a clip stores a rotation per pivot name, and
 * `applyPose()` below just sets `.rotation` on whichever of these groups
 * that name refers to.
 *
 * **Body models** (`BodyModels.js`) supply the base dimensions every part
 * scales from — `buildCharacter()` itself has no opinion on masculine vs.
 * feminine vs. anything added later; it just asks `BodyModels.js` for
 * whichever one the appearance says is active and builds from that. Every
 * model produces the exact same `PART_IDS`/pivot names, which is what
 * lets "the same animation library work across every supported body
 * model" be true without either side needing to know about the other.
 *
 * `buildCharacter(appearance, bodyModelId, textureImages)` fully rebuilds
 * the mesh from scratch. That's deliberate, not a missed optimisation:
 * changing a proportion changes where every joint *below* it needs to sit
 * (a longer upper arm moves the elbow), so a partial update would need
 * the same joint-position logic a full rebuild already has, for an
 * operation that only ever happens when a person is actively adjusting a
 * slider in the Wardrobe or switching body models — never per frame.
 */

export const PART_IDS = ["head", "torso", "upperArm", "lowerArm", "hand", "upperLeg", "lowerLeg", "foot"];

export const MATERIAL_PRESETS = {
  matte: { roughness: 0.85, metalness: 0.05 },
  fabric: { roughness: 0.95, metalness: 0 },
  metal: { roughness: 0.4, metalness: 0.8 },
  glossy: { roughness: 0.15, metalness: 0.1 },
  glass: { roughness: 0.05, metalness: 0, transparent: true, opacity: 0.55 },
};

export function defaultPartAppearance(partId, color) {
  return { width: 1, height: 1, depth: 1, color, material: "matte", textureId: null };
}

function partSize(partId, appearance, baseDimensions) {
  const base = baseDimensions[partId];
  const a = appearance.parts[partId] ?? defaultPartAppearance(partId, "#888888");
  return {
    width: base.width * a.width,
    height: base.height * a.height,
    depth: base.depth * a.depth,
  };
}

function buildMaterial(partId, appearance, textureImage) {
  const a = appearance.parts[partId] ?? defaultPartAppearance(partId, "#888888");
  const preset = MATERIAL_PRESETS[a.material] ?? MATERIAL_PRESETS.matte;
  const options = { color: a.color, ...preset };
  if (textureImage) {
    const texture = new THREE.CanvasTexture(textureImage);
    texture.colorSpace = THREE.SRGBColorSpace;
    options.map = texture;
    delete options.color; // let the texture provide colour; the flat colour becomes the "no texture" fallback only
  }
  return new THREE.MeshStandardMaterial(options);
}

function boxMesh(width, height, depth, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * @param {object} appearance - see BodyModels.js's own defaultAppearance()
 * @param {string} bodyModelId - see BodyModels.js
 * @param {Record<string, HTMLCanvasElement|HTMLImageElement>} textureImages - partId -> image, for parts with a textureId set
 * @returns {{root: THREE.Group, pivots: Record<string, THREE.Group>, meshes: Record<string, THREE.Mesh>, totalHeight: number}}
 */
export function buildCharacter(appearance, bodyModelId, textureImages = {}) {
  const baseDimensions = getBodyModel(bodyModelId).baseDimensions;
  const root = new THREE.Group();
  root.name = "PlayerCharacter";
  const pivots = {};
  const meshes = {};

  const sizeOf = (id) => partSize(id, appearance, baseDimensions);
  const materialOf = (id) => buildMaterial(id, appearance, textureImages[id]);

  const torsoSize = sizeOf("torso");
  const legSize = sizeOf("upperLeg");
  const lowerLegSize = sizeOf("lowerLeg");
  const footSize = sizeOf("foot");

  // The torso pivot sits at the hip line — the "root joint" everything else
  // hangs from or stands under. Standing on the floor (y=0) means the feet
  // need to reach it, so the whole rig is built bottom-up in world terms
  // even though the hierarchy is top-down in parenting terms.
  const standingHeight = footSize.height + lowerLegSize.height + legSize.height;
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, standingHeight, 0);
  root.add(torsoPivot);
  pivots.torso = torsoPivot;

  const torsoMesh = boxMesh(torsoSize.width, torsoSize.height, torsoSize.depth, materialOf("torso"));
  torsoMesh.position.set(0, torsoSize.height / 2, 0);
  torsoPivot.add(torsoMesh);
  meshes.torso = torsoMesh;

  // --- Head ---
  const headSize = sizeOf("head");
  const headPivot = new THREE.Group();
  headPivot.position.set(0, torsoSize.height, 0);
  torsoPivot.add(headPivot);
  pivots.head = headPivot;
  const headMesh = boxMesh(headSize.width, headSize.height, headSize.depth, materialOf("head"));
  headMesh.position.set(0, headSize.height / 2, 0);
  headPivot.add(headMesh);
  meshes.head = headMesh;

  // --- Arms (mirrored left/right, one appearance shared by both) ---
  const upperArmSize = sizeOf("upperArm");
  const lowerArmSize = sizeOf("lowerArm");
  const handSize = sizeOf("hand");
  const shoulderX = torsoSize.width / 2 + upperArmSize.width / 2 - 0.02;
  const shoulderY = torsoSize.height - upperArmSize.width * 0.3;

  for (const side of [-1, 1]) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(shoulderX * side, shoulderY, 0);
    torsoPivot.add(shoulderPivot);
    pivots[`upperArm${side < 0 ? "Left" : "Right"}`] = shoulderPivot;

    const upperArmMesh = boxMesh(upperArmSize.width, upperArmSize.height, upperArmSize.depth, materialOf("upperArm"));
    upperArmMesh.position.set(0, -upperArmSize.height / 2, 0);
    shoulderPivot.add(upperArmMesh);
    meshes[`upperArm${side < 0 ? "Left" : "Right"}`] = upperArmMesh;

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -upperArmSize.height, 0);
    shoulderPivot.add(elbowPivot);
    pivots[`lowerArm${side < 0 ? "Left" : "Right"}`] = elbowPivot;

    const lowerArmMesh = boxMesh(lowerArmSize.width, lowerArmSize.height, lowerArmSize.depth, materialOf("lowerArm"));
    lowerArmMesh.position.set(0, -lowerArmSize.height / 2, 0);
    elbowPivot.add(lowerArmMesh);
    meshes[`lowerArm${side < 0 ? "Left" : "Right"}`] = lowerArmMesh;

    const wristPivot = new THREE.Group();
    wristPivot.position.set(0, -lowerArmSize.height, 0);
    elbowPivot.add(wristPivot);
    pivots[`hand${side < 0 ? "Left" : "Right"}`] = wristPivot;

    const handMesh = boxMesh(handSize.width, handSize.height, handSize.depth, materialOf("hand"));
    handMesh.position.set(0, -handSize.height / 2, 0);
    wristPivot.add(handMesh);
    meshes[`hand${side < 0 ? "Left" : "Right"}`] = handMesh;
  }

  // --- Legs (mirrored left/right, one appearance shared by both) ---
  const hipX = torsoSize.width / 2 - legSize.width / 2 - 0.01;

  for (const side of [-1, 1]) {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(hipX * side, 0, 0);
    torsoPivot.add(hipPivot);
    pivots[`upperLeg${side < 0 ? "Left" : "Right"}`] = hipPivot;

    const upperLegMesh = boxMesh(legSize.width, legSize.height, legSize.depth, materialOf("upperLeg"));
    upperLegMesh.position.set(0, -legSize.height / 2, 0);
    hipPivot.add(upperLegMesh);
    meshes[`upperLeg${side < 0 ? "Left" : "Right"}`] = upperLegMesh;

    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -legSize.height, 0);
    hipPivot.add(kneePivot);
    pivots[`lowerLeg${side < 0 ? "Left" : "Right"}`] = kneePivot;

    const lowerLegMesh = boxMesh(lowerLegSize.width, lowerLegSize.height, lowerLegSize.depth, materialOf("lowerLeg"));
    lowerLegMesh.position.set(0, -lowerLegSize.height / 2, 0);
    kneePivot.add(lowerLegMesh);
    meshes[`lowerLeg${side < 0 ? "Left" : "Right"}`] = lowerLegMesh;

    const anklePivot = new THREE.Group();
    anklePivot.position.set(0, -lowerLegSize.height, 0);
    kneePivot.add(anklePivot);
    pivots[`foot${side < 0 ? "Left" : "Right"}`] = anklePivot;

    const footMesh = boxMesh(footSize.width, footSize.height, footSize.depth, materialOf("foot"));
    footMesh.position.set(0, -footSize.height / 2, footSize.depth * 0.15);
    anklePivot.add(footMesh);
    meshes[`foot${side < 0 ? "Left" : "Right"}`] = footMesh;
  }

  return {
    root,
    pivots,
    meshes,
    bodyModelId,
    totalHeight: standingHeight + torsoSize.height + headSize.height,
    // Roughly where eyes would sit within the head — 85% up its height —
    // used by PlayerCharacterSystem to line the rig up with the camera
    // during normal play. An approximation, not an anatomical claim; see
    // docs/PLAYER.md.
    eyeHeight: standingHeight + torsoSize.height + headSize.height * 0.85,
  };
}

/**
 * Applies a pose — `{ pivotName: [x, y, z] }`, Euler angles in radians —
 * to a live rig's pivots. Used every frame by `PlayerAnimationSystem`.
 * Every pivot is explicitly set, not just the ones the pose mentions —
 * anything left out is reset to its rest rotation ([0,0,0]) rather than
 * left at whatever it happened to be. That's deliberate: without it, a
 * rotation from whichever clip played *previously* (bent knees from
 * Crouch, say) could silently persist into a new clip that never
 * mentions that pivot at all, since nothing would ever reset it back.
 * This is the entire "playback" mechanism — an animation clip is just a
 * sequence of poses to interpolate between and apply this way, one frame
 * at a time.
 */
export function applyPose(pivots, pose) {
  for (const name of Object.keys(pivots)) {
    const rotation = pose[name];
    if (rotation) pivots[name].rotation.set(rotation[0], rotation[1], rotation[2]);
    else pivots[name].rotation.set(0, 0, 0);
  }
}

/** Disposes every geometry/material this rig created — call before rebuilding, so the old rig doesn't leak. */
export function disposeCharacter({ meshes }) {
  for (const mesh of Object.values(meshes)) {
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      material.map?.dispose();
      material.dispose();
    }
  }
}
