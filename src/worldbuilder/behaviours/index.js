/**
 * behaviours/index.js
 * ---------------------
 * Importing this file registers every built-in behaviour (each file
 * registers itself as a side effect of being imported — see registry.js).
 * Anything that needs to read/apply behaviours (BuilderApp, WorldObjectsSystem)
 * should import from here rather than registry.js directly, so the act of
 * "having the registry" always also means "the built-ins are in it".
 */
import "./InteractableBehaviour.js";
import "./LightSourceBehaviour.js";
import "./SeatBehaviour.js";
import "./StorageBehaviour.js";
import "./DoorBehaviour.js";
import "./ComputerBehaviour.js";
import "./DecorationBehaviour.js";
import "./TriggerBehaviour.js";
import "./AudioSourceBehaviour.js";
import "./MusicPlayerBehaviour.js";
import "./ReflectiveBehaviour.js";

export { registerBehaviour, getBehaviourTypes, getBehaviourConfig, applyBehaviour, disposeBehaviour, defaultPropertiesFor } from "./registry.js";
