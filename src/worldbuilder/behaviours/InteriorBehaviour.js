import * as THREE from "three";
import { registerBehaviour } from "./registry.js";
import { InteriorSystem } from "../../systems/InteriorSystem.js";

/**
 * Interior Volume
 * -----------------
 * "Future Builder-created buildings should naturally support this system
 * without requiring special cases." Attach this to any enclosed Builder
 * structure and its bounding volume registers with
 * `InteriorSystem.registerVolume()` — the exact same function the
 * Workshop's own room uses directly (see `RoomLayoutSystem.js`). Neither
 * knows the other exists; both are just callers of one small, generic
 * capability, the same "reflective"/"ladder" split already established
 * for mirrors and climbable objects.
 *
 * No properties to configure — an interior volume is simply the object's
 * own designed bounds, exactly as built. The bounds are computed once,
 * when the behaviour applies, rather than tracked for movement the way
 * `LadderSystem`/`ReflectionSystem` track theirs — a reasonable
 * simplification for something the size of a building, which isn't
 * typically repositioned after being placed the way a small decorative
 * object might be.
 */
registerBehaviour("interior", {
  label: "Interior volume (indoors)",
  ownsInteractable: false,
  propsSchema: [],
  apply({ object3D, engine }) {
    const interiorSystem = engine.getSystem(InteriorSystem);
    if (!interiorSystem) return;
    const box = new THREE.Box3().setFromObject(object3D);
    object3D.userData.interiorDispose = interiorSystem.registerVolume(box);
  },
  dispose({ object3D }) {
    object3D.userData.interiorDispose?.();
  },
});
