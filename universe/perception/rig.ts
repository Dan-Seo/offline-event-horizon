import * as T from "three/webgpu";
import {
  color,
  mix,
  mrt,
  normalView,
  normalWorld,
  output,
  positionView,
  positionWorld,
  sin,
  texture,
  uniform,
  vec3,
  vec4,
} from "three/tsl";
import {
  CLASS_ID,
  sensorSurfaces,
  visibleInTree,
  type SurfaceKind,
} from "./surfaces";
import { SENSOR_PITCH } from "./map";
import type { Condition, Intrinsics, SensorFrame } from "./types";
export type Capture = {
  frame: SensorFrame;
  normals: Float32Array;
  labels: Uint8Array;
  camera: T.PerspectiveCamera;
  readbackMs: number;
};
/** Calibrated opaque RGB-D pass: shared geometry/instance transforms, no beauty post-processing. */
export class SensorRig {
  readonly k: Intrinsics;
  camera = new T.PerspectiveCamera(82, 192 / 128, 0.2, 1800);
  condition: Condition = "CLEAR";
  seed = 731;
  frames = 0;
  private scene = new T.Scene();
  private target: T.RenderTarget;
  private pairs: { source: T.Mesh; proxy: T.Mesh }[] = [];
  private worldOrigin = uniform(new T.Vector3());
  private fog = uniform(0);
  private exposure = uniform(1);
  private repeated = uniform(0);
  private materialList: T.MeshBasicNodeMaterial[] = [];
  private gpu: boolean;
  private grainTexture: T.DataTexture;
  calibration: {
    samples: number;
    maxDepthError: number;
    meanDepthError: number;
    labelMismatches: number;
  } | null = null;
  private outputs = mrt({ output, geometry: vec4(0), labels: vec4(0) });
  constructor(
    private renderer: T.WebGPURenderer,
    world: T.Scene,
  ) {
    this.gpu = !(renderer.backend as unknown as { isWebGLBackend: boolean })
      .isWebGLBackend;
    const w = 192,
      h = 128,
      f = h / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.k = {
      width: w,
      height: h,
      fx: f,
      fy: f,
      cx: (w - 1) / 2,
      cy: (h - 1) / 2,
      near: 0.2,
      far: 1800,
    };
    this.target = new T.RenderTarget(w, h, {
      count: 3,
      type: T.FloatType,
      format: T.RGBAFormat,
      minFilter: T.NearestFilter,
      magFilter: T.NearestFilter,
      depthBuffer: true,
      samples: 0,
    });
    ["output", "geometry", "labels"].forEach(
      (name, i) => (this.target.textures[i].name = name),
    );
    // 24 attachment bytes/sample, below WebGPU's baseline 32-byte limit.
    this.target.textures[0].type = T.UnsignedByteType;
    this.target.textures[2].type = T.UnsignedByteType;
    this.scene.background = new T.Color(0, 0, 0);
    // A seeded, mip-filtered surface pattern avoids temporal aliasing of raw high-frequency noise.
    const bytes = new Uint8Array(256 * 256 * 4);
    const hash = (x: number, y: number) => {
      let n = Math.imul(x & 255, 73856093) ^ Math.imul(y & 255, 19349663);
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return (n >>> 0) / 4294967296;
    };
    const smoothNoise = (x: number, y: number, s: number) => {
      x /= s;
      y /= s;
      const ix = Math.floor(x),
        iy = Math.floor(y),
        u = x - ix,
        v = y - iy,
        fu = u * u * (3 - 2 * u),
        fv = v * v * (3 - 2 * v);
      return (
        (hash(ix, iy) * (1 - fu) + hash(ix + 1, iy) * fu) * (1 - fv) +
        (hash(ix, iy + 1) * (1 - fu) + hash(ix + 1, iy + 1) * fu) * fv
      );
    };
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const v =
          255 *
          (0.23 +
            0.5 * smoothNoise(x, y, 8) +
            0.2 * smoothNoise(x, y, 24) +
            0.07 * smoothNoise(x, y, 2));
        bytes.set([v, v, v, 255], (y * 256 + x) * 4);
      }
    this.grainTexture = new T.DataTexture(bytes, 256, 256);
    this.grainTexture.wrapS = this.grainTexture.wrapT = T.RepeatWrapping;
    this.grainTexture.magFilter = T.LinearFilter;
    this.grainTexture.minFilter = T.LinearMipmapLinearFilter;
    this.grainTexture.generateMipmaps = true;
    this.grainTexture.needsUpdate = true;
    const materials = new Map<SurfaceKind, T.MeshBasicNodeMaterial>();
    for (const source of sensorSurfaces(world)) {
      const kind = source.userData.sensorKind as SurfaceKind;
      let material = materials.get(kind);
      if (!material) {
        material = new T.MeshBasicNodeMaterial({ side: T.DoubleSide });
        const p = positionWorld.add(this.worldOrigin),
          n = normalWorld.abs(),
          weights = n.div(n.x.add(n.y).add(n.z).max(0.001));
        const grain = texture(this.grainTexture, p.xz.mul(0.018))
          .r.mul(weights.y)
          .add(texture(this.grainTexture, p.xy.mul(0.018)).r.mul(weights.z))
          .add(texture(this.grainTexture, p.yz.mul(0.018)).r.mul(weights.x));
        const tint = {
          terrain: 0x67815b,
          water: 0x437587,
          vegetation: 0x4f8452,
          rock: 0x827b70,
          sand: 0xb5a17b,
          ice: 0x9bbfca,
          creature: 0xa0d4d0,
        }[kind];
        const stripes = sin(p.x.add(p.z).mul(1.3)).mul(0.34).add(0.6);
        const pattern =
          kind === "vegetation" ? mix(grain, stripes, this.repeated) : grain;
        const lighting = normalWorld
          .dot(vec3(-0.4, 0.85, 0.3).normalize())
          .mul(0.22)
          .add(0.75);
        const appearance = color(tint).mul(pattern).mul(lighting);
        const extinction = positionView.z.negate().mul(this.fog).negate().exp();
        const rgb = mix(vec3(0.22, 0.25, 0.26), appearance, extinction)
          .max(vec3(0.000001))
          .pow(vec3(1 / 2.2))
          .mul(this.exposure);
        material.colorNode = rgb;
        material.mrtNode = mrt({
          output: vec4(rgb, 1),
          geometry: vec4(positionView.z.negate(), normalView),
          labels: vec4(CLASS_ID[kind] / 255, 0, 0, 1),
        });
        materials.set(kind, material);
        this.materialList.push(material);
      }
      let proxy: T.Mesh;
      if (source instanceof T.InstancedMesh) {
        const m = new T.InstancedMesh(
          source.geometry,
          material,
          source.instanceMatrix.count,
        );
        m.instanceMatrix = source.instanceMatrix;
        m.count = source.count;
        proxy = m;
      } else proxy = new T.Mesh(source.geometry, material);
      proxy.matrixAutoUpdate = false;
      proxy.frustumCulled = true;
      this.scene.add(proxy);
      this.pairs.push({ source, proxy });
    }
  }
  sync(
    observer: T.Vector3,
    worldPosition: T.Vector3,
    bodyRotation: T.Quaternion,
  ) {
    this.worldOrigin.value.copy(observer);
    this.camera.position
      .copy(worldPosition)
      .sub(observer)
      .add(new T.Vector3(0, 1.2, -0.8).applyQuaternion(bodyRotation));
    this.camera.quaternion
      .copy(bodyRotation)
      .multiply(
        new T.Quaternion().setFromEuler(new T.Euler(-SENSOR_PITCH, 0, 0)),
      );
    this.camera.updateMatrixWorld(true);
    for (const { source, proxy } of this.pairs) {
      proxy.visible = visibleInTree(source);
      proxy.matrix.copy(source.matrixWorld);
      if (source instanceof T.InstancedMesh)
        (proxy as T.InstancedMesh).count = source.count;
    }
    this.scene.updateMatrixWorld(true);
    this.fog.value = this.condition === "FOG" ? 0.07 : 0;
    this.exposure.value = this.condition === "LOW_LIGHT" ? 0.018 : 1;
    this.repeated.value = +(this.condition === "REPETITIVE");
  }
  async prepare() {
    const previous = this.renderer.getRenderTarget(),
      oldMRT = this.renderer.getMRT();
    this.renderer.setRenderTarget(this.target);
    this.renderer.setMRT(this.outputs);
    const pending = this.renderer.compileAsync(this.scene, this.camera);
    this.renderer.setMRT(oldMRT);
    this.renderer.setRenderTarget(previous);
    await pending;
  }
  async capture(timestamp: number): Promise<Capture> {
    const start = performance.now(),
      id = ++this.frames,
      condition = this.condition,
      { width: w, height: h } = this.k;
    const camera = this.camera.clone(),
      old = this.renderer.getRenderTarget(),
      oldMRT = this.renderer.getMRT();
    const references: { i: number; depth: number; label: number }[] = [];
    if (id === 3 && new URLSearchParams(location.search).has("qa")) {
      const ray = new T.Raycaster(),
        inverseView = camera.matrixWorldInverse.clone();
      for (const y of [38, 67, 91, 113])
        for (const x of [29, 72, 119, 163]) {
          ray.setFromCamera(
            new T.Vector2(((x + 0.5) / w) * 2 - 1, 1 - ((y + 0.5) / h) * 2),
            camera,
          );
          const hit = ray.intersectObjects(
            this.pairs.filter((p) => p.proxy.visible).map((p) => p.proxy),
            false,
          )[0];
          if (hit) {
            const source = this.pairs.find(
                (p) => p.proxy === hit.object,
              )!.source,
              depth = -hit.point.clone().applyMatrix4(inverseView).z;
            if (depth < camera.far)
              references.push({
                i: y * w + x,
                depth,
                label: CLASS_ID[source.userData.sensorKind as SurfaceKind],
              });
          }
        }
    }
    const tone = this.renderer.toneMapping;
    this.renderer.toneMapping = T.NoToneMapping;
    try {
      this.renderer.setRenderTarget(this.target);
      this.renderer.setMRT(this.outputs);
      this.renderer.render(this.scene, this.camera);
    } finally {
      this.renderer.setMRT(oldMRT);
      this.renderer.setRenderTarget(old);
      this.renderer.toneMapping = tone;
    }
    const [rgbRaw, geometryRaw, labelRaw] = await Promise.all(
      [0, 1, 2].map((i) =>
        this.renderer.readRenderTargetPixelsAsync(this.target, 0, 0, w, h, i),
      ),
    );
    const rgb = new Uint8Array(w * h * 4),
      depth = new Float32Array(w * h),
      normals = new Float32Array(w * h * 3),
      labels = new Uint8Array(w * h);
    let random = (this.seed + id * 1717) >>> 0;
    const noise = () => {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      return random / 4294967296;
    };
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x,
          s = ((this.gpu ? y : h - 1 - y) * w + x) * 4,
          klass = Math.round(Number(labelRaw[s]));
        labels[i] = klass;
        const valid = klass > 0 && Number(geometryRaw[s]) > 0;
        depth[i] = valid ? Number(geometryRaw[s]) : 0;
        for (let c = 0; c < 3; c++) {
          rgb[i * 4 + c] = Number(rgbRaw[s + c]);
          normals[i * 3 + c] =
            Number(geometryRaw[s + 1 + c]) * (c === 0 ? 1 : -1);
        }
        rgb[i * 4 + 3] = 255;
        if (condition === "REFLECTIVE_WATER" && klass === 2) depth[i] = 0;
        if (condition === "FOG" && noise() > Math.exp(-depth[i] * 0.04))
          depth[i] = 0;
        if (condition === "LOW_LIGHT")
          for (let c = 0; c < 3; c++)
            rgb[i * 4 + c] = Math.max(0, rgb[i * 4 + c] + (noise() - 0.5) * 3);
        if (condition === "RAIN" && (x * 19 + y * 3 + id * 7) % 103 < 3) {
          depth[i] = 0;
          rgb.set([165, 183, 188, 255], i * 4);
        }
      }
    // Moving opaque foreground occlusion is an explicit sensor stressor, not claimed world fauna.
    if (condition === "DYNAMIC")
      for (let y = 30; y < 100; y++)
        for (
          let x = Math.floor(75 + Math.sin(timestamp) * 35);
          x < Math.floor(110 + Math.sin(timestamp) * 35);
          x++
        ) {
          const i = y * w + x;
          rgb.set([70 + ((x + y) % 5) * 18, 125, 130, 255], i * 4);
          depth[i] = 2.5;
          labels[i] = 7;
          normals.set([0, 0, 1], i * 3);
        }
    if (references.length) {
      const errors = references.map((r) => Math.abs(depth[r.i] - r.depth));
      this.calibration = {
        samples: references.length,
        maxDepthError: Math.max(...errors),
        meanDepthError: errors.reduce((s, x) => s + x, 0) / errors.length,
        labelMismatches: references.filter((r) => labels[r.i] !== r.label)
          .length,
      };
    }
    return {
      frame: {
        id,
        timestamp,
        rgb,
        depth,
        k: this.k,
        condition,
        seed: this.seed,
      },
      normals,
      labels,
      camera,
      readbackMs: performance.now() - start,
    };
  }
  dispose() {
    this.target.dispose();
    this.grainTexture.dispose();
    this.materialList.forEach((m) => m.dispose());
    this.scene.clear();
  }
}
