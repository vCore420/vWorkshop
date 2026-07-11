/**
 * createEmotesPhoneApp
 * ----------------------
 * "The Phone should become the natural home for player expressions.
 * Maintain quick and comfortable access." Rather than a screen of its
 * own, selecting this tile does exactly what pressing the emote wheel's
 * own key already does — opens `EmoteWheelSystem`'s existing radial
 * menu — and gets out of the way immediately, emitting
 * "phone:closeRequested" for `PhoneSystem.js` to act on. Two separate
 * quick-access surfaces (the phone's own home screen, and the direct key
 * this app doesn't touch or replace) both lead to the exact same wheel,
 * never two different emote systems to keep in sync.
 */
export function createEmotesPhoneApp({ emoteWheelSystem, engine }) {
  return {
    id: "emotes",
    label: "Emotes",
    glyph: "\uD83D\uDC4B",
    mount(_container) {
      emoteWheelSystem?.toggle();
      engine.events.emit("phone:closeRequested");
      return null;
    },
  };
}
