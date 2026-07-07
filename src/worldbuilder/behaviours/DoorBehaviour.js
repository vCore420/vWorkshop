import { InteractableComponent } from "../../core/components/InteractableComponent.js";
import { registerBehaviour } from "./registry.js";

/**
 * Door
 * ----
 * A generic swing: toggling rotates the whole compiled object by
 * `openOffset` degrees around its own Y axis. This works for any shape —
 * it doesn't know or care which part is "the door leaf" — which is the
 * right level of generality for a foundation-phase behaviour system, at
 * the cost of not being a true hinge-on-one-edge swing. A future,
 * fancier Door behaviour could add a "hinge offset" property instead.
 */
registerBehaviour("door", {
  label: "Door",
  ownsInteractable: true,
  propsSchema: [{ key: "openOffset", label: "Open angle (degrees)", type: "number", default: 90 }],
  apply({ entity, object3D, properties }) {
    const closedY = object3D.rotation.y;
    const openY = closedY + ((properties.openOffset ?? 90) * Math.PI) / 180;
    let isOpen = false;

    const interactable = new InteractableComponent({
      prompt: "Open the door",
      radius: 1.3,
      onInteract: () => {
        isOpen = !isOpen;
        object3D.rotation.y = isOpen ? openY : closedY;
        interactable.prompt = isOpen ? "Close the door" : "Open the door";
      },
    });
    entity.addComponent(interactable);
  },
});
