import * as T from "three/webgpu";
import {
  color,
  mix,
  positionLocal,
  positionWorld,
  sin,
  uniform,
  uv,
  vec3,
} from "three/tsl";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { grassInfluence, pilgrimObserver } from "./influence";
import type { PilgrimContact } from "./contact";
import type { Quality } from "../config";
/** Bounded close detail on existing terrain, built in small slices while the observer travels. */
export class PilgrimMeadow {
  private root = new T.Group();
  private mesh: T.InstancedMesh;
  private clock = uniform(0);
  private cursor = 0;
  private total = 900;
  private key = "";
  private x = 0;
  private z = 0;
  private dummy = new T.Object3D();
  constructor(scene: T.Scene) {
    const blade = new T.PlaneGeometry(0.055, 0.8, 1, 3);
    blade.translate(0, 0.4, 0);
    const p = blade.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 0.8;
      p.setX(i, p.getX(i) * (1 - y * 0.94) + y * y * 0.14);
    }
    blade.computeVertexNormals();
    const parts = Array.from({ length: 5 }, (_, i) =>
        blade
          .clone()
          .rotateY(i * 2.4)
          .scale(1, 0.6 + i * 0.13, 1),
      ),
      geometry = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    blade.dispose();
    const material = new T.MeshBasicNodeMaterial({ side: T.DoubleSide }),
      h = uv().y.clamp(0, 1),
      world = positionWorld.add(pilgrimObserver),
      bend = grassInfluence(world);
    material.colorNode = mix(color(0x143d35), color(0x91aaa0), h.mul(h)).mul(
      0.8,
    );
    material.positionNode = positionLocal.add(
      vec3(
        sin(world.x.mul(0.3).add(this.clock.mul(0.65)))
          .mul(0.13)
          .add(bend.mul(0.5))
          .mul(h.mul(h)),
        0,
        sin(world.z.mul(0.4).add(this.clock.mul(0.4)))
          .mul(0.07)
          .mul(h.mul(h)),
      ),
    );
    this.mesh = new T.InstancedMesh(geometry, material, 900);
    this.mesh.frustumCulled = false;
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < 900; i++) this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.root.add(this.mesh);
    this.root.visible = false;
    scene.add(this.root);
  }
  update(
    contact: PilgrimContact,
    position: T.Vector3,
    observer: T.Vector3,
    time: number,
    enabled: boolean,
    quality: Quality,
  ) {
    this.clock.value = time;
    this.root.visible = enabled;
    if (!enabled) return;
    this.root.position.copy(contact.origin).sub(observer);
    this.root.quaternion.copy(contact.frame);
    const total =
        quality === "BATTERY" ? 350 : quality === "BALANCED" ? 600 : 900,
      key = `${Math.floor(position.x / 22)},${Math.floor(position.z / 22)},${total}`;
    if (key !== this.key) {
      this.key = key;
      this.x = Math.floor(position.x / 22) * 22;
      this.z = Math.floor(position.z / 22) * 22;
      this.cursor = 0;
      this.total = total;
      this.mesh.count = total;
    }
    const random = (i: number) => {
      let n = Math.imul(i + 17713, 15731);
      n = Math.imul(n ^ (n >>> 13), 789221);
      return (n >>> 0) / 4294967296;
    };
    let changed = false;
    for (let n = 0; n < 12 && this.cursor < this.total; n++, this.cursor++) {
      const i = this.cursor,
        x = this.x + (random(i * 5) - 0.5) * 74,
        z = this.z + (random(i * 5 + 1) - 0.5) * 74,
        g = contact.sample(x, z);
      this.dummy.position.set(x, g.height - 0.07, z);
      this.dummy.rotation.set(0, random(i * 5 + 2) * 6.28, 0);
      this.dummy.scale.setScalar(g.water ? 0 : 0.7 + random(i * 5 + 3) * 0.6);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      changed = true;
    }
    if (changed) this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    this.root.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as T.Material).dispose();
  }
}
