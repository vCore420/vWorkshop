import { registerBehaviour } from "./registry.js";

/**
 * Decoration
 * ----------
 * Does nothing at all functionally — no InteractableComponent, no light,
 * no properties. It exists purely so an object's metadata can honestly say
 * "this isn't interactive, it's just here to look right", which is a
 * meaningful thing to be able to say given every other behaviour adds
 * *something*.
 */
registerBehaviour("decoration", {
  label: "Decoration",
  ownsInteractable: false,
  propsSchema: [],
  apply() {
    // Intentionally empty.
  },
});
