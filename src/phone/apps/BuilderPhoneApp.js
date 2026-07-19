/**
 * createBuilderPhoneApp
 * ------------------------
 * "Move the existing Builder Phone functionality into the new Builder
 * application. Maintain all existing Builder behaviour. Continue
 * allowing world building while walking naturally through the
 * environment." A thin wrapper — all the actual behaviour still lives in
 * `BuildModeSystem.js`/`BuilderPhoneUI.js`, unchanged except for no
 * longer owning their own shell, mouse, or camera handling (see those
 * files' own comments on why — `PhoneSystem.js` now does that
 * uniformly, for every app, not just this one).
 */
export function createBuilderPhoneApp({ buildModeSystem }) {
  return {
    id: "builder",
    label: "Builder",
    glyph: "builder",
    mount(container) {
      buildModeSystem.mountUI(container);
      return () => buildModeSystem.unmountUI();
    },
    onCancel() {
      return buildModeSystem.handleCancelKey();
    },
  };
}
