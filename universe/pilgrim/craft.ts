import * as T from "three/webgpu";
import { color, mix, normalWorld, uniform } from "three/tsl";
/** One quiet ceramic shell: no cockpit, engine flames, or vehicle HUD. */
export class PilgrimCraft {
  root = new T.Group();
  private breathing = uniform(0);
  private wings: T.Mesh[] = [];
  constructor(scene: T.Scene) {
    const shell = new T.MeshStandardNodeMaterial({
      color: 0xb4beb6,
      roughness: 0.43,
      metalness: 0.25,
      side: T.DoubleSide,
    });
    shell.colorNode = mix(
      color(0x667c79),
      color(0xc7c9b7),
      normalWorld.y.mul(0.35).add(0.65),
    );
    const positions: number[] = [],
      indices: number[] = [],
      uvs: number[] = [];
    for (let j = 0; j <= 24; j++)
      for (let i = 0; i <= 80; i++) {
        const t = i / 80,
          a = (j / 24) * Math.PI * 2,
          z = (t - 0.5) * 7.6,
          width = Math.sin(Math.PI * t) ** 0.75 * (1.3 + 0.6 * t);
        positions.push(
          Math.cos(a) * width,
          0.26 * Math.sin(a) * Math.sin(Math.PI * t) + 0.35 * (t - 0.5) ** 2,
          z,
        );
        uvs.push(t, j / 24);
      }
    for (let j = 0; j < 24; j++)
      for (let i = 0; i < 80; i++) {
        const a = j * 81 + i,
          b = a + 81;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    this.root.add(new T.Mesh(g, shell));
    const inset = new T.Mesh(
      new T.SphereGeometry(1, 40, 20),
      new T.MeshStandardMaterial({
        color: 0x638c87,
        emissive: 0x193934,
        emissiveIntensity: 0.25,
        roughness: 0.48,
        metalness: 0.12,
      }),
    );
    inset.scale.set(0.5, 0.16, 1.7);
    inset.position.set(0, 0.26, 0.1);
    this.root.add(inset);
    for (const sign of [-1, 1]) {
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(sign * 0.9, 0.03, 2.8),
        new T.Vector3(sign * 2.2, -0.1, 1.1),
        new T.Vector3(sign * 2.65, 0.12, -1.7),
        new T.Vector3(sign * 0.6, 0.5, -3.2),
      ]);
      const vertices: number[] = [],
        ids: number[] = [];
      for (let i = 0; i <= 44; i++) {
        const p = curve.getPoint(i / 44),
          width = Math.sin((Math.PI * i) / 44) * 0.32;
        vertices.push(p.x, p.y, p.z, p.x - sign * width, p.y + 0.04, p.z);
        if (i < 44) {
          const j = i * 2;
          ids.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
        }
      }
      const wingGeometry = new T.BufferGeometry();
      wingGeometry.setAttribute(
        "position",
        new T.Float32BufferAttribute(vertices, 3),
      );
      wingGeometry.setIndex(ids);
      wingGeometry.computeVertexNormals();
      const wing = new T.Mesh(wingGeometry, shell);
      this.root.add(wing);
      this.wings.push(wing);
      const seamMaterial = new T.MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
      });
      seamMaterial.colorNode = color(0xbac8a2);
      seamMaterial.opacityNode = this.breathing.mul(0.16).add(0.24);
      const seam = new T.Mesh(
        new T.TubeGeometry(curve, 44, 0.02, 6, false),
        seamMaterial,
      );
      seam.position.y = 0.085;
      this.root.add(seam);
    }
    this.root.scale.setScalar(0.65);
    this.root.visible = false;
    scene.add(this.root);
  }
  update(position: T.Vector3, quaternion: T.Quaternion, time: number) {
    this.root.position.copy(position);
    this.root.quaternion.copy(quaternion);
    this.breathing.value = 0.5 + Math.sin(time * 0.3) * 0.5;
  }
}
