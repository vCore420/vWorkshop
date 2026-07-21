import { iconMarkup } from "../../utils/ProceduralIcons.js";
import { BUBBLE_DEFINITION_ID } from "../../beings/DefaultBeings.js";

/**
 * createBubblePhoneApp
 * -----------------------
 * "This should become the player's quick interaction point with the
 * Workshop's first resident... future residents should naturally
 * integrate into this application."
 *
 * Version 4, Phase 7 ("Being ↔ Resident Convergence") — Bubble is a real
 * `BeingLibrary` definition/instance now, not a singular
 * `ResidentController`. **Decided with Vi**: this app keeps working
 * exactly as before, resolved as Bubble's own specific, well-known Being
 * instance (`BUBBLE_DEFINITION_ID`) rather than a global singleton — a
 * genuine multi-resident picker (any resident-capable Being getting its
 * own dashboard here) is a real, separate feature, deliberately not
 * attempted this phase. `residentConnection` is unchanged — Ollama
 * reachability isn't per-resident state. Command buttons (Stay/Follow/
 * Return Home) now call `beingController`'s own per-instance methods
 * instead of a singular `residentController`'s. One honest simplification:
 * the old "In conversation" status line is gone — that lived on a
 * `ResidentBehaviour` instance that's now genuinely ephemeral, scoped to
 * one open conversation overlay, with nothing outside it left to read;
 * awake/connection status alone remain fully accurate.
 */
export function createBubblePhoneApp({ residentProfileStore, beingLibrary, beingInstanceStore, beingController, residentConnection, engine }) {
  function findBubbleInstance() {
    return beingInstanceStore.all().find((i) => i.definitionId === BUBBLE_DEFINITION_ID) ?? null;
  }

  return {
    id: "bubble",
    label: "Bubble",
    glyph: "bubble",
    mount(container) {
      const bubbleInstance = findBubbleInstance();
      const definition = beingLibrary.get(BUBBLE_DEFINITION_ID);
      const profile = definition?.residentProfileId ? residentProfileStore.get(definition.residentProfileId) : null;

      const header = document.createElement("div");
      header.className = "workshop-phone-bubble-header";
      const presenceDot = document.createElement("span");
      presenceDot.className = "workshop-phone-presence-dot";
      presenceDot.setAttribute("aria-hidden", "true"); // the text status line below already says the same thing in words
      const heading = document.createElement("h2");
      heading.textContent = profile?.name || "Bubble";
      header.append(presenceDot, heading);
      container.appendChild(header);

      if (!bubbleInstance) {
        const missing = document.createElement("p");
        missing.className = "app-subtitle";
        missing.textContent = "Bubble isn't in the Workshop right now.";
        container.appendChild(missing);
        return () => {};
      }

      const statusSection = document.createElement("div");
      statusSection.className = "workshop-phone-section";
      // `refreshStatus()` runs on a 1s interval below — a live region here,
      // not on the whole app, so only this line is ever announced.
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
        engine.events.emit("interaction:trigger", {
          overlayId: "residentConversation",
          context: { beingInstanceId: bubbleInstance.id, residentProfileId: definition?.residentProfileId ?? null },
        });
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
        beingController.returnResidentHome(bubbleInstance.id);
        refreshCommandButtons();
      });

      function refreshCommandButtons() {
        const command = beingController.getResidentCommand(bubbleInstance.id);
        stayBtn.textContent = command === "stay" ? "Staying — tap to resume wandering" : "Stay Here";
        stayBtn.classList.toggle("active", command === "stay");
        stayBtn.setAttribute("aria-pressed", String(command === "stay"));
        followBtn.textContent = command === "follow" ? "Following — tap to resume wandering" : "Follow Me";
        followBtn.classList.toggle("active", command === "follow");
        followBtn.setAttribute("aria-pressed", String(command === "follow"));
      }
      stayBtn.addEventListener("click", () => {
        beingController.setResidentCommand(bubbleInstance.id, beingController.getResidentCommand(bubbleInstance.id) === "stay" ? null : "stay");
        refreshCommandButtons();
      });
      followBtn.addEventListener("click", () => {
        beingController.setResidentCommand(bubbleInstance.id, beingController.getResidentCommand(bubbleInstance.id) === "follow" ? null : "follow");
        refreshCommandButtons();
      });
      refreshCommandButtons();

      commandRow.append(stayBtn, followBtn);
      actionsSection.appendChild(commandRow);
      actionsSection.appendChild(homeBtn);
      container.appendChild(actionsSection);

      function refreshStatus() {
        const awake = residentConnection.isAwake;
        statusText.textContent = `Status: ${awake ? "Awake" : "Sleeping — waiting for Ollama"}`;
        connectionText.textContent = `Connection: ${{ connected: "Connected", connecting: "Connecting…", disconnected: "Waiting for Ollama…" }[residentConnection.status] ?? "Unknown"}`;
        // One dot, one of three states now (see this file's own header
        // comment on why "conversing" is no longer tracked outside an
        // actually-open conversation) — a `data-` attribute, not a class
        // per state, so `css/phone.css` owns every actual colour in one
        // place.
        presenceDot.dataset.presence = residentConnection.status === "connecting" ? "connecting" : awake ? "awake" : "sleeping";
      }
      refreshStatus();

      const interval = setInterval(refreshStatus, 1000);
      return () => clearInterval(interval);
    },
  };
}
