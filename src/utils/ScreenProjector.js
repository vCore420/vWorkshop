import * as THREE from "three";
import { clamp } from "./MathUtils.js";

/**
 * ScreenProjector
 * ---------------
 * The technique that makes an object's own on-screen UI feel like it
 * belongs to that object instead of the browser window: every frame,
 * project a flat rectangle's four corners (in some mesh's local space)
 * through the *actual* camera, and return the bounding rectangle in CSS
 * pixels. Both the computer's monitor panel (`src/computer/`) and the
 * workbench's clipboard panel (`src/workbench/`) position their DOM panel
 * to exactly that rectangle, every frame — this is the one shared piece
 * between those two otherwise-independent, self-contained modules.
 *
 * This is an axis-aligned approximation, not a true perspective-correct
 * quad (that would need a 3D CSS transform / matrix3d, à la
 * THREE.CSS3DRenderer). That's a deliberate simplification, safe as long
 * as the panel only becomes visible once the camera is looking at the
 * anchor object roughly head-on — both callers fade their panel in only
 * during the tail end of a camera-focus transition, for exactly this
 * reason. See either module's docs for more detail.
 */
export function makeRectCorners(halfWidth, halfHeight, localOffsetZ = 0) {
  return [
    new THREE.Vector3(-halfWidth, -halfHeight, localOffsetZ),
    new THREE.Vector3(halfWidth, -halfHeight, localOffsetZ),
    new THREE.Vector3(halfWidth, halfHeight, localOffsetZ),
    new THREE.Vector3(-halfWidth, halfHeight, localOffsetZ),
  ];
}

/**
 * Same idea as `makeRectCorners`, but for a surface you look down at rather
 * than face-on — a rectangle in the local X/Z plane with a small lift along
 * local Y (toward a camera looking down at it). Used by the workbench's
 * clipboard, which lies flat on the bench rather than standing upright like
 * a monitor.
 */
export function makeTopDownRectCorners(halfWidth, halfDepth, liftY = 0) {
  return [
    new THREE.Vector3(-halfWidth, liftY, -halfDepth),
    new THREE.Vector3(halfWidth, liftY, -halfDepth),
    new THREE.Vector3(halfWidth, liftY, halfDepth),
    new THREE.Vector3(-halfWidth, liftY, halfDepth),
  ];
}

const _scratch = new THREE.Vector3();

/**
 * @param {THREE.Object3D} anchorMesh - corners are transformed through this mesh's world matrix
 * @param {THREE.Vector3[]} localCorners - four corners in anchorMesh's local space (see makeRectCorners)
 * @param {THREE.Camera} camera
 * @returns {{left:number, top:number, width:number, height:number}} in CSS pixels
 */
export function projectRect(anchorMesh, localCorners, camera, viewportWidth, viewportHeight) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const corner of localCorners) {
    _scratch.copy(corner);
    anchorMesh.localToWorld(_scratch);
    _scratch.project(camera); // -> NDC, [-1, 1]

    const x = (_scratch.x * 0.5 + 0.5) * viewportWidth;
    const y = (1 - (_scratch.y * 0.5 + 0.5)) * viewportHeight;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
}

const MIN_COMFORTABLE_WIDTH = 480; // below this, forms/tabs/buttons stop having room to breathe
const MIN_COMFORTABLE_HEIGHT = 360;
const NARROW_VIEWPORT_WIDTH = 700; // matches the breakpoint computer.css/buildmode.css already use elsewhere

/**
 * "Avoid shrinking interfaces until they become unusable. Instead, allow
 * layouts to intelligently reorganise themselves." `projectRect()`'s own
 * output has no floor — standing far from the monitor, or simply having
 * a narrow viewport altogether, can project a rectangle far too small to
 * hold a real interface. This is the shared floor under it: below either
 * a comfortable minimum size or a narrow-viewport threshold, the
 * projected rect (still used to decide *where*, so the panel still reads
 * as belonging to the monitor/clipboard it's projected from, not just
 * slapped onto the page) is widened/heightened back out to a comfortable
 * size, centred on wherever the projection itself was centred, then
 * clamped back on-screen. Both `ComputerSystem.js` and
 * `WorkbenchSystem.js` share this one function rather than each
 * reimplementing their own floor.
 */
export function comfortableRect(rect, viewportWidth, viewportHeight) {
  const tooSmall = rect.width < MIN_COMFORTABLE_WIDTH || rect.height < MIN_COMFORTABLE_HEIGHT;
  const narrowViewport = viewportWidth < NARROW_VIEWPORT_WIDTH;
  if (!tooSmall && !narrowViewport) return rect;

  const targetWidth = clamp(rect.width, MIN_COMFORTABLE_WIDTH, viewportWidth * 0.94);
  const targetHeight = clamp(rect.height, MIN_COMFORTABLE_HEIGHT, viewportHeight * 0.88);
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  let left = centerX - targetWidth / 2;
  let top = centerY - targetHeight / 2;
  left = clamp(left, 4, viewportWidth - targetWidth - 4);
  top = clamp(top, 4, viewportHeight - targetHeight - 4);

  return { left, top, width: targetWidth, height: targetHeight };
}
