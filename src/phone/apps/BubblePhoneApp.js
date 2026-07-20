import { iconMarkup } from "../../utils/ProceduralIcons.js";

/**
 * createBubblePhoneApp
 * -----------------------
 * "This should become the player's quick interaction point with the
 * Workshop's first resident... future residents should naturally
 * integrate into this application." Deliberately built against
 * `residentProfileStore`/`residentController`/`residentConnection`
 * directly rather than anything Bubble-specific — a future second
 * resident reusing this exact same trio of stores would already work
 * here with no changes beyond however a future multi-resident picker
 * chooses which one's own state to display.
 *
 * Version 3, Phase 13 ("The Phone Becomes a Device"), Wave 2 — "each app
 * should read as distinctly itself." This is the one app that's
 * fundamentally about a *person* (well, a resident), not a list or a
 * control panel, so its own distinctness leans into that: a real
 * presence dot (the same signal a messaging app's own contact list
 * already uses that convention for) and a Talk button styled as an
 * actual speech bubble, not a generic full-width rectangle every other
 * app's own primary action already is.
 */
export function createBubblePhoneApp({ residentProfileStore, residentController, residentConnection, residentBehaviour, engine }) {
  return {
    id: "bubble",
    label: "Bubble",
    glyph: "bubble",
    mount(container) {
      const profile = residentProfileStore.getActive();

      const header = document.createElement("div");
      header.className = "workshop-phone-bubble-header";
      const presenceDot = document.createElement("span");
      presenceDot.className = "workshop-phone-presence-dot";
      presenceDot.setAttribute("aria-hidden", "true"); // the text status lines below already say the same thing in words
      const heading = document.createElement("h2");
      heading.textContent = profile?.name || "Bubble";
      header.append(presenceDot, heading);
      container.appendChild(header);

      const statusSection = document.createElement("div");
      statusSection.className = "workshop-phone-section";
      // `refreshStatus()` runs on a 1s interval below — a live region here,
      // not on the whole app, so only these two lines are ever announced.
      statusSection.setAttribute("aria-live", "polite");
      const statusText = document.createElement("p");
      statusText.className = "app-subtitle";
      statusSection.appendChild(statusText);
      const connectionText = document.createElement("p");
      connectionText.className = "app-subtitle";
      statusSection.appendChild(connectionText);
      container.appendChild(statusSection);

      const actionsSection = document.createElement("div");
      actionsSection.className = "workshop-phone-section";

      const talkBtn = document.createElement("button");
      talkBtn.type = "button";
      talkBtn.className = "workshop-phone-talk-button";
      const talkIcon = document.createElement("span");
      talkIcon.className = "workshop-phone-talk-icon";
      talkIcon.innerHTML = iconMarkup("bubble");
      const talkLabel = document.createElement("span");
      talkLabel.textContent = "Talk";
      talkBtn.append(talkIcon, talkLabel);
      talkBtn.addEventListener("click", () => {
        engine.events.emit("interaction:trigger", { overlayId: "residentConversation", context: {} });
        engine.events.emit("phone:closeRequested");
      });
      actionsSection.appendChild(talkBtn);

      const commandRow = document.createElement("div");
      commandRow.className = "workshop-phone-button-row";

      const stayBtn = document.createElement("button");
      stayBtn.type = "button";
      stayBtn.className = "workshop-phone-small-button";
      const followBtn = document.createElement("button");
      followBtn.type = "button";
      followBtn.className = "workshop-phone-small-button";
      const homeBtn = document.createElement("button");
      homeBtn.type = "button";
      homeBtn.className = "workshop-phone-small-button";
      homeBtn.textContent = "Return Home";
      homeBtn.addEventListener("click", () => {
        residentController.returnHome();
        refreshCommandButtons();
      });

      function refreshCommandButtons() {
        const command = residentController.playerCommand;
        stayBtn.textContent = command === "stay" ? "Staying \u2014 tap to resume wandering" : "Stay Here";
        stayBtn.classList.toggle("active", command === "stay");
        stayBtn.setAttribute("aria-pressed", String(command === "stay"));
        followBtn.textContent = command === "follow" ? "Following \u2014 tap to resume wandering" : "Follow Me";
        followBtn.classList.toggle("active", command === "follow");
        followBtn.setAttribute("aria-pressed", String(command === "follow"));
      }
      stayBtn.addEventListener("click", () => {
        if (residentController.playerCommand === "stay") residentController.resumeWandering();
        else residentController.stayHere();
        refreshCommandButtons();
      });
      followBtn.addEventListener("click", () => {
        if (residentController.playerCommand === "follow") residentController.resumeWandering();
        else residentController.followMe();
        refreshCommandButtons();
      });
      refreshCommandButtons();

      commandRow.append(stayBtn, followBtn);
      actionsSection.appendChild(commandRow);
      actionsSection.appendChild(homeBtn);
      container.appendChild(actionsSection);

      function refreshStatus() {
        const awake = residentConnection.isAwake;
        const conversing = residentBehaviour.mode === "conversing";
        statusText.textContent = `Status: ${conversing ? "In conversation" : awake ? "Awake" : "Sleeping \u2014 waiting for Ollama"}`;
        connectionText.textContent = `Connection: ${{ connected: "Connected", connecting: "Connecting\u2026", disconnected: "Waiting for Ollama\u2026" }[residentConnection.status] ?? "Unknown"}`;
        // One dot, one of four states \u2014 the same presence-indicator
        // convention a messaging app's own contact list already uses.
        // Conversing wins over every other signal (a real, more specific
        // activity); a `data-` attribute, not a class per state, so
        // `css/phone.css` owns every actual colour in one place.
        presenceDot.dataset.presence = conversing
          ? "conversing"
          : residentConnection.status === "connecting"
            ? "connecting"
            : awake
              ? "awake"
              : "sleeping";
      }
      refreshStatus();

      const interval = setInterval(refreshStatus, 1000);
      return () => clearInterval(interval);
    },
  };
}
