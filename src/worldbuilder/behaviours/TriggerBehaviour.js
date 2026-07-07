import { InteractableComponent } from "../../core/components/InteractableComponent.js";
import { registerBehaviour } from "./registry.js";

/**
 * Trigger
 * -------
 * The deliberately open-ended behaviour: interacting emits
 * `engine.events.emit("worldObject:trigger", { eventName, instanceId, definitionId })`
 * with whatever `eventName` was typed into the Builder, and nothing else.
 * No system in this codebase currently listens for a specific
 * `eventName` — that's the point. A future system or plugin (see
 * docs/PLUGIN_GUIDE.md) can listen for `worldObject:trigger` and act on
 * whichever `eventName` it cares about, without this behaviour — or the
 * object that carries it — needing to know that listener exists.
 */
registerBehaviour("trigger", {
  label: "Trigger",
  ownsInteractable: true,
  propsSchema: [
    { key: "prompt", label: "Prompt", type: "text", default: "Activate" },
    { key: "eventName", label: "Event name", type: "text", default: "custom-event" },
  ],
  apply({ entity, properties, engine, instance, definition }) {
    entity.addComponent(
      new InteractableComponent({
        prompt: properties.prompt || "Activate",
        radius: 1.3,
        onInteract: () =>
          engine.events.emit("worldObject:trigger", {
            eventName: properties.eventName || "custom-event",
            instanceId: instance.id,
            definitionId: definition.id,
          }),
      })
    );
  },
});
