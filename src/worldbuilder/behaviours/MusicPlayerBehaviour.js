import { InteractableComponent } from "../../core/components/InteractableComponent.js";
import { registerBehaviour } from "./registry.js";

/**
 * Music Player
 * ------------
 * "Eventually any Builder-created object with a future MusicPlayer
 * behaviour should be capable of opening this same player... avoid
 * hardcoding object-specific behaviour" — this is that behaviour, and it's
 * as small as it looks: attach an `InteractableComponent` whose only job is
 * to emit the exact same `interaction:trigger` event the stereo's own
 * `overlayId: "music"` already produces (see
 * `src/entities/furniture/StereoPlayer.js`). Both paths converge on the
 * identical registered overlay — there is no separate "world object music
 * player" implementation to keep in sync with the real one.
 *
 * Distinct from the existing `audioSource` behaviour on purpose: that one
 * plays a single generative ambient track directly through `AudioSystem` —
 * closer to a music box than a stereo. This one opens the real personal
 * library (`docs/MUSIC.md`). A custom object can carry either, matching
 * whichever it's actually meant to be.
 */
registerBehaviour("musicPlayer", {
  label: "Music player",
  ownsInteractable: true,
  propsSchema: [],
  apply({ entity, engine }) {
    entity.addComponent(
      new InteractableComponent({
        prompt: "Play some music",
        radius: 2.0,
        onInteract: () => engine.events.emit("interaction:trigger", { overlayId: "music" }),
      })
    );
  },
});
