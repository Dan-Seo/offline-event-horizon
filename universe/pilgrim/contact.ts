import * as T from "three/webgpu";
import { SEA_RADIUS } from "../sanctuary-layout";
import { sensorSurfaces, visibleInTree } from "../perception/surfaces";
import type { ContactWorld, SurfaceSample } from "./model";
import type { WalkSurface } from "../walk";
/** Contact and collision oracle; deliberately private to dynamics, never exposed to the worker. */
export class PilgrimContact implements ContactWorld {
  origin = new T.Vector3();
  frame = new T.Quaternion();
  observer = new T.Vector3();
  private ray = new T.Raycaster();
  private meshes: T.Mesh[] = [];
  private cache = new Map<string, SurfaceSample>();
  private regional?: WalkSurface;
  private inverse = new T.Quaternion();
  private candidates: T.Mesh[] | null = null;
  private rayOrigin = new T.Vector3();
  private down = new T.Vector3(0, -1, 0);
  private instance = new T.Matrix4();
  private normalMatrix = new T.Matrix3();
  private trunks: { p: T.Vector3; r: number; h: number }[] | null = null;
  constructor(private scene: T.Scene) {
    this.meshes = sensorSurfaces(scene).filter((m) => m.userData.contact);
  }
  /** The region the frame and the samples currently speak in; a boarding check restores it. */
  get region() {
    return this.regional;
  }
  /** The one observer update per frame. Visibility changes between frames, so the ray
   *  candidates are dropped here and rebuilt on that frame's first cache miss, if it has one. */
  setObserver(observer: T.Vector3) {
    this.observer.copy(observer);
    this.candidates = null;
  }
  setRegion(region?: WalkSurface) {
    this.regional = region;
    this.cache.clear();
    this.trunks = null;
    this.candidates = null;
    if (region) {
      this.origin
        .copy(region.up)
        .multiplyScalar(region.radius)
        .add(region.center);
      this.frame.copy(region.frame);
    } else {
      this.origin.set(0, 0, 0);
      this.frame.identity();
    }
    this.inverse.copy(this.frame).invert();
  }
  toLocal(world: T.Vector3) {
    return world.clone().sub(this.origin).applyQuaternion(this.inverse);
  }
  toWorld(local: T.Vector3) {
    return local.clone().applyQuaternion(this.frame).add(this.origin);
  }
  sample = (x: number, z: number): SurfaceSample => {
    if (this.regional) {
      const r = this.regional.radius,
        g = this.regional.height(x / r, z / r) * r,
        w = this.regional.water(x / r, z / r) * r;
      const dx =
          ((this.regional.height((x + 2) / r, z / r) -
            this.regional.height((x - 2) / r, z / r)) *
            r) /
          4,
        dz =
          ((this.regional.height(x / r, (z + 2) / r) -
            this.regional.height(x / r, (z - 2) / r)) *
            r) /
          4;
      return {
        height: Math.max(g, w),
        water: w > g,
        normal: new T.Vector3(-dx, 1, -dz).normalize(),
      };
    }
    const gx = Math.floor(x / 3),
      gz = Math.floor(z / 3),
      u = x / 3 - gx,
      v = z / 3 - gz;
    const a = this.node(gx, gz),
      b = this.node(gx + 1, gz),
      c = this.node(gx, gz + 1),
      d = this.node(gx + 1, gz + 1);
    return {
      height:
        (a.height * (1 - u) + b.height * u) * (1 - v) +
        (c.height * (1 - u) + d.height * u) * v,
      water:
        (a.water ? 1 : 0) * (1 - u) * (1 - v) +
          (b.water ? 1 : 0) * u * (1 - v) +
          (c.water ? 1 : 0) * (1 - u) * v +
          (d.water ? 1 : 0) * u * v >
        0.5,
      normal: a.normal.clone().lerp(b.normal, u).lerp(c.normal, v).normalize(),
    };
  };
  private node(gx: number, gz: number) {
    const key = `${gx},${gz}`;
    let cached = this.cache.get(key);
    if (cached) return cached;
    const x = gx * 3,
      z = gz * 3,
      water =
        Math.sqrt(Math.max(1, SEA_RADIUS ** 2 - x * x - z * z)) -
        SEA_RADIUS +
        0.3;
    let height = water,
      isWater = true;
    const normal = new T.Vector3(x / SEA_RADIUS, 1, z / SEA_RADIUS).normalize();
    this.ray.set(this.rayOrigin.set(x, 2400, z).sub(this.observer), this.down);
    this.ray.far = 4800;
    this.candidates ??= this.meshes.filter(
      (m) => m.userData.sensorKind !== "vegetation" && visibleInTree(m),
    );
    const hits = this.ray.intersectObjects(this.candidates, false);
    if (hits[0]) {
      const hit = hits[0],
        h = hit.point.y + this.observer.y;
      if (h > water) {
        height = h;
        isWater = false;
        if (hit.face) {
          normal.copy(hit.face.normal);
          let matrix = hit.object.matrixWorld;
          if (hit.instanceId !== undefined) {
            (hit.object as T.InstancedMesh).getMatrixAt(
              hit.instanceId,
              this.instance,
            );
            matrix = this.instance.premultiply(matrix);
          }
          normal.applyNormalMatrix(this.normalMatrix.getNormalMatrix(matrix));
        }
      }
    }
    cached = { height, water: isWater, normal };
    this.cache.set(key, cached);
    if (this.cache.size > 18000)
      this.cache.delete(this.cache.keys().next().value!);
    return cached;
  }
  blocked = (local: T.Vector3) => {
    // Trunk bounds are a conservative contact approximation; the camera still sees the real branches.
    if (!this.trunks) {
      this.trunks = [];
      const m = new T.Matrix4(),
        center = new T.Vector3(),
        scale = new T.Vector3(),
        q = new T.Quaternion();
      for (const mesh of this.meshes) {
        if (
          mesh.userData.sensorKind !== "vegetation" ||
          !visibleInTree(mesh) ||
          !(mesh instanceof T.InstancedMesh)
        )
          continue;
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, m);
          m.premultiply(mesh.matrixWorld);
          m.decompose(center, q, scale);
          const p = this.toLocal(center.clone().add(this.observer));
          this.trunks.push({
            p,
            r: Math.max(scale.x, scale.z) * 0.032 + 1.7,
            h: scale.y * 0.9 + 3,
          });
        }
      }
    }
    return this.trunks.some(
      (t) =>
        Math.abs(local.y - t.p.y) < t.h &&
        Math.hypot(local.x - t.p.x, local.z - t.p.z) < t.r,
    );
  };
  get cacheSize() {
    return this.cache.size;
  }
}
