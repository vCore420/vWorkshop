import * as THREE from "three";
import { InteractableComponent } from "../../core/components/InteractableComponent.js";
import { registerBehaviour } from "./registry.js";

/**
 * Seat
 * ----
 * A generic "sit here" — since the object's exact shape is whatever the
 * Builder's parts describe, the focus pose is necessarily approximate: a
 * fixed offset from the object's own origin, facing back toward it. Good
 * enough for a custom stool or bench; a future pass could let a Seat
 * behaviour's properties fine-tune the offset instead of hardcoding it.
 */
registerBehaviour("seat", {
  label: "Seat",
  ownsInteractable: true,
  propsSchema: [{ key: "prompt", label: "Prompt", type: "text", default: "Sit down" }],
  apply({ entity, object3D, properties }) {
    const seatWorldPos = new THREE.Vector3();
    object3D.getWorldPosition(seatWorldPos);

    entity.addComponent(
      new InteractableComponent({
        prompt: properties.prompt || "Sit down",
        radius: 1.3,
        focusPose: {
          position: [seatWorldPos.x, seatWorldPos.y + 0.85, seatWorldPos.z + 0.35],
          lookAt: [seatWorldPos.x, seatWorldPos.y + 0.6, seatWorldPos.z],
        },
      })
    );
  },
});
