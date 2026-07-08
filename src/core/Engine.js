import * as THREE from "three";
import { EventBus } from "./EventBus.js";
import { EntityManager } from "./EntityManager.js";
import { PluginManager } from "./PluginManager.js";

const FPS_SAMPLE_INTERVAL = 1; // seconds between "engine:performanceSample" emissions

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
 *
 * Engine deliberately stays settings-agnostic — it exposes the low-level
 * primitives a graphics setting needs (`setAntialiasing`,
 * `setFrameRateLimit`, direct access to `camera`/`renderer`), but has no
 * idea what "Performance" vs "Quality" means. `SettingsSystem`
 * (src/settings/) is the thing that decides what a setting actually does
 * and calls these; see docs/PERFORMANCE.md.
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

    this._antialias = true;
    this._pixelRatioCap = 2;
    this._createRenderer();

    this._paused = false;
    this._frameInterval = 0; // seconds; 0 = uncapped
    this._frameAccumulator = 0;

    this._fpsSampleTimer = 0;
    this._fpsSampleFrames = 0;

    window.addEventListener("resize", () => this._onResize());
  }

  _createRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this._antialias,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this._pixelRatioCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    // If the animation loop is already running (a live antialiasing
    // toggle, not the initial construction), re-attach it to the new
    // renderer — setAnimationLoop belongs to the renderer instance, not
    // the canvas, so a fresh renderer starts with no loop at all.
    if (this._running) this.renderer.setAnimationLoop(() => this._tick());
  }

  /**
   * Antialiasing is a WebGL context option — it can't be flipped on an
   * existing renderer, only chosen when the context is created. Toggling
   * it live means disposing the current renderer and building a new one
   * with the same configuration otherwise. `engine.renderer` is only ever
   * referenced from within this file, which is what makes that safe: there
   * are no other stale references anywhere else in the codebase to a
   * renderer this replaces.
   */
  setAntialiasing(enabled) {
    if (enabled === this._antialias) return;
    this._antialias = enabled;
    this.renderer.dispose();
    this._createRenderer();
  }

  /** A cap on internal render resolution, independent of antialiasing —
   *  the cheapest, highest-impact lever for a busy scene on a high-DPI
   *  tablet display. Does not need a renderer rebuild, but does still
   *  trigger an internal framebuffer resize, so it's still worth skipping
   *  when the value hasn't actually changed (SettingsSystem re-applies
   *  every graphics setting on every settings change, not just this one). */
  setPixelRatioCap(cap) {
    if (cap === this._pixelRatioCap) return;
    this._pixelRatioCap = cap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cap));
  }

  setShadowsEnabled(enabled) {
    this.renderer.shadowMap.enabled = enabled;
  }

  /** 0 disables the cap entirely (render every animation-frame tick, i.e.
   *  follow the display's own refresh rate, exactly as before this setting existed). */
  setFrameRateLimit(fps) {
    this._frameInterval = fps > 0 ? 1 / fps : 0;
    this._frameAccumulator = 0;
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
    this._running = true;
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

    // Frame-rate cap: still called every display refresh (setAnimationLoop
    // can't be throttled itself), but skips the update+render work — and,
    // importantly, the *render* — until enough time has actually passed.
    // This is what makes a 30fps cap genuinely cheaper rather than just
    // rendering identical frames twice as often as needed.
    if (this._frameInterval > 0) {
      this._frameAccumulator += dt;
      if (this._frameAccumulator < this._frameInterval) return;
      this._frameAccumulator %= this._frameInterval;
    }

    if (!this._paused) {
      for (const system of this.systems) system.update?.(dt);
      this.entities.update(dt);
      this.plugins.update(dt);
      this.input?.endFrame();
    }
    this.renderer.render(this.scene, this.camera);

    this._sampleFPS(dt);
  }

  _sampleFPS(dt) {
    this._fpsSampleFrames++;
    this._fpsSampleTimer += dt;
    if (this._fpsSampleTimer < FPS_SAMPLE_INTERVAL) return;
    const fps = this._fpsSampleFrames / this._fpsSampleTimer;
    this.events.emit("engine:performanceSample", { fps, frameTimeMs: 1000 / fps });
    this._fpsSampleTimer = 0;
    this._fpsSampleFrames = 0;
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
