import * as THREE from "three";
import { EventBus } from "./EventBus.js";
import { EntityManager } from "./EntityManager.js";
import { PluginManager } from "./PluginManager.js";

/**
 * Engine
 * ------
 * The one object that owns the Three.js renderer, scene, and camera, and
 * drives the update/render loop. Everything else — systems, entities,
 * plugins — is handed a reference to this Engine and talks to the rest of
 * the world through it (engine.events, engine.entities, engine.scene...).
 *
 * Systems are plain objects with an `init(engine)` and `update(dt)` method,
 * added in the order they should run. Order matters a little: e.g. the
 * FurnitureSystem should exist before the InteractionSystem looks for
 * interactable furniture, and PersistenceSystem should load *after* every
 * other system has had a chance to register a save/load provider.
 */
export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.events = new EventBus();
    this.entities = new EntityManager();
    this.plugins = new PluginManager(this);

    this.clock = new THREE.Clock();
    this.systems = [];

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.05,
      200
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this._paused = false;

    window.addEventListener("resize", () => this._onResize());
  }

  /** Register a system. Order of registration = order of update(). */
  addSystem(system) {
    this.systems.push(system);
    return system;
  }

  getSystem(SystemClass) {
    return this.systems.find((s) => s instanceof SystemClass) ?? null;
  }

  async init() {
    for (const system of this.systems) {
      await system.init?.(this);
    }
    this.events.emit("engine:ready", { engine: this });
  }

  start() {
    this.renderer.setAnimationLoop(() => this._tick());
  }

  pause() {
    this._paused = true;
  }

  resume() {
    this._paused = false;
    this.clock.getDelta(); // discard the paused-time delta
  }

  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.1); // clamp to avoid huge jumps on tab-switch
    if (!this._paused) {
      for (const system of this.systems) system.update?.(dt);
      this.entities.update(dt);
      this.plugins.update(dt);
      this.input?.endFrame();
    }
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.events.emit("engine:resize", {
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }
}
