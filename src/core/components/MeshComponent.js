import { Component } from "../Component.js";

/**
 * MeshComponent
 * -------------
 * Wraps a Three.js Object3D (mesh, group, whatever) and manages its
 * lifecycle in the scene graph. Every visible entity has one of these.
 * Keeping this as a component (rather than special-casing "entities with
 * meshes" everywhere) means non-visual entities — e.g. a save-point trigger,
 * or a future "quest" entity — are just as valid without dragging Three.js
 * concerns into unrelated systems.
 */
export class MeshComponent extends Component {
  /**
   * @param {import('three').Object3D} object3D
   * @param {import('three').Scene} scene
   */
  constructor(object3D, scene) {
    super();
    this.object3D = object3D;
    this.scene = scene;
  }

  init() {
    this.entity.object3D = this.object3D;
    this.object3D.userData.entityId = this.entity.id;
    this.scene.add(this.object3D);
  }

  dispose() {
    this.scene.remove(this.object3D);
    this.object3D.traverse((child) => {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose?.());
      else child.material?.dispose?.();
    });
  }
}
