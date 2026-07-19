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
 */
export function createBubblePhoneApp({ residentProfileStore, residentController, residentConnection, residentBehaviour, engine }) {
  return {
    id: "bubble",
    label: "Bubble",
    glyph: "bubble",
    mount(container) {
      const profile = residentProfileStore.getActive();
      const heading = document.createElement("h2");
      heading.textContent = profile?.name || "Bubble";
      container.appendChild(heading);

      const statusSection = document.createElement("div");
      statusSection.className = "workshop-phone-section";
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
      talkBtn.className = "workshop-phone-primary-button";
      talkBtn.textContent = "Talk";
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
        followBtn.textContent = command === "follow" ? "Following \u2014 tap to resume wandering" : "Follow Me";
        followBtn.classList.toggle("active", command === "follow");
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
        statusText.textContent = `Status: ${residentBehaviour.mode === "conversing" ? "In conversation" : awake ? "Awake" : "Sleeping \u2014 waiting for Ollama"}`;
        connectionText.textContent = `Connection: ${{ connected: "Connected", connecting: "Connecting\u2026", disconnected: "Waiting for Ollama\u2026" }[residentConnection.status] ?? "Unknown"}`;
      }
      refreshStatus();

      const interval = setInterval(refreshStatus, 1000);
      return () => clearInterval(interval);
    },
  };
}
