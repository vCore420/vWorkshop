import { registerBehaviour } from "./registry.js";
import { LadderSystem } from "../../systems/LadderSystem.js";

/**
 * Climbable (Ladder)
 * --------------------
 * "Ladders should integrate into the existing Builder behaviour system so
 * future Builder-created ladders automatically become climbable." Attach
 * this to any object and its bounding volume becomes a climbable zone
 * through `LadderSystem.registerLadder()` — the exact same function a
 * future hand-built ladder furniture piece would call directly. Neither
 * knows the other exists; both are just callers of one small, generic
 * capability, the same "reflective"/"reflection" split established for
 * mirrors.
 *
 * No properties to configure — a ladder doesn't need a colour or an
 * intensity, and its climbable zone is simply its own designed shape and
 * size, exactly as built.
 */
registerBehaviour("ladder", {
  label: "Climbable (ladder)",
  ownsInteractable: false,
  propsSchema: [],
  apply({ object3D, engine }) {
    const ladderSystem = engine.getSystem(LadderSystem);
    if (!ladderSystem) return;
    object3D.userData.ladderDispose = ladderSystem.registerLadder(object3D);
  },
  dispose({ object3D }) {
    object3D.userData.ladderDispose?.();
  },
});
