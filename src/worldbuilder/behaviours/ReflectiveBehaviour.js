import { registerBehaviour } from "./registry.js";
import { ReflectionSystem } from "../../systems/ReflectionSystem.js";

/**
 * Reflective Surface
 * --------------------
 * "Builder objects should be able to specify reflective surfaces where
 * appropriate" — this is that: attach it to any designed object and its
 * largest flat (Plane) part becomes a real reflective surface, through
 * `ReflectionSystem.registerSurface()` — the exact same function
 * `Wardrobe.js`'s hand-built mirror calls directly. Neither knows the
 * other exists; both are just callers of one small, generic capability.
 *
 * No properties to configure — a mirror doesn't need a colour or an
 * intensity, and the plane it applies to is chosen automatically (the
 * largest Plane-shaped part in the object, by area) rather than asking
 * the person designing it to know or type a part's internal id. An
 * object with no Plane part simply has nothing to apply this to and does
 * nothing, rather than erroring — a graceful no-op, the same way most
 * other behaviours degrade when their assumptions aren't met.
 */
registerBehaviour("reflective", {
  label: "Reflective surface",
  ownsInteractable: false,
  propsSchema: [],
  apply({ object3D, engine }) {
    const mesh = findLargestPlane(object3D);
    if (!mesh) return;
    const reflectionSystem = engine.getSystem(ReflectionSystem);
    if (!reflectionSystem) return;
    const aspect = mesh.scale.y / mesh.scale.x || 1;
    mesh.userData.reflectiveDispose = reflectionSystem.registerSurface(mesh, { aspect });
  },
  dispose({ object3D }) {
    const mesh = findLargestPlane(object3D);
    mesh?.userData.reflectiveDispose?.();
  },
});

function findLargestPlane(object3D) {
  let best = null;
  let bestArea = 0;
  object3D.traverse((child) => {
    if (!child.isMesh || child.geometry?.type !== "PlaneGeometry") return;
    const area = child.scale.x * child.scale.y;
    if (area > bestArea) {
      bestArea = area;
      best = child;
    }
  });
  return best;
}
