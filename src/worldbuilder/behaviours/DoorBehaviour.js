import * as THREE from "three";
import { InteractableComponent } from "../../core/components/InteractableComponent.js";
import { registerBehaviour } from "./registry.js";
import { WorldObjectsSystem } from "../WorldObjectsSystem.js";

/**
 * Door
 * ----
 * Toggling swings the whole compiled object between a closed and an open
 * Y rotation. `hingeOffset` (metres, measured along the object's own
 * local +X axis before rotation) names how far the true hinge edge sits
 * from the object's own origin; the object is repositioned on every
 * toggle so that point — not the origin — stays fixed in world space,
 * which is what makes the swing read as "pivoting at an edge" instead of
 * "spinning in place." `hingeOffset === 0` (the default) reproduces the
 * original rotate-in-place behaviour exactly, so every door placed
 * before this existed is unaffected until its own properties panel is
 * used to opt in.
 *
 * Version 3, Phase 10 ("Real Assets, Honestly Introduced") — this
 * replaces the rotate-in-place placeholder this file's own comment used
 * to name as a known gap ("a future, fancier Door behaviour could add a
 * 'hinge offset' property instead"), a note Phase 14's own account in
 * `docs/ROADMAP_V3.md` names again as the same limitation observed from
 * the player's side — solved once, here, rather than twice.
 * `hingeWorld`/`closedY` are captured once, when `apply()` first runs at
 * placement — same as `closedY` alone already was before this change —
 * so a door moved *and* re-rotated later via Build Mode's move tool
 * keeps swinging around its placement-time pivot, not the moved one.
 * That's an existing limitation of how moved objects don't re-run
 * behaviour setup (`BuildModeSystem._confirmGhost()` only calls
 * `updateInstanceTransform()`, never `apply()` again) — not a new one
 * introduced here, and worth fixing together if that's ever revisited.
 *
 * Version 3, Phase 5 ("Beyond One Building") — swinging the mesh open
 * used to be the whole story, but its own cached collision (see
 * `WorldObjectsSystem`'s own per-part footprints) stayed frozen at
 * whatever it was when the door was placed, closed. A player could watch
 * the door swing open and still walk into thin air where it used to be —
 * or, worse, still be blocked by where it no longer visually is.
 * `refreshFootprint()` recomputes collision from the object3D's *current*
 * transform without persisting "open" as if it were the door's own
 * placement — see that method's own comment for why that distinction
 * matters. Covers Double Door and Gate too, both sharing this exact
 * behaviour.
 */
registerBehaviour("door", {
  label: "Door",
  ownsInteractable: true,
  propsSchema: [
    { key: "openOffset", label: "Open angle (degrees)", type: "number", default: 90 },
    { key: "hingeOffset", label: "Hinge edge offset (m)", type: "number", default: 0 },
  ],
  apply({ entity, object3D, properties, engine, instance }) {
    const closedY = object3D.rotation.y;
    const openY = closedY + ((properties.openOffset ?? 90) * Math.PI) / 180;
    const upAxis = new THREE.Vector3(0, 1, 0);
    const pivotLocal = new THREE.Vector3(properties.hingeOffset ?? 0, 0, 0);
    const hingeWorld = object3D.position.clone().add(pivotLocal.clone().applyAxisAngle(upAxis, closedY));
    const positionFor = (rotationY) => hingeWorld.clone().sub(pivotLocal.clone().applyAxisAngle(upAxis, rotationY));
    let isOpen = false;

    const interactable = new InteractableComponent({
      prompt: "Open the door",
      radius: 1.3,
      onInteract: () => {
        isOpen = !isOpen;
        const targetY = isOpen ? openY : closedY;
        object3D.rotation.y = targetY;
        object3D.position.copy(positionFor(targetY));
        interactable.prompt = isOpen ? "Close the door" : "Open the door";
        engine.getSystem(WorldObjectsSystem)?.refreshFootprint(instance.id);
      },
    });
    entity.addComponent(interactable);
  },
});
