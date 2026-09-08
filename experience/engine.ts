import * as T from "three/webgpu";
import { pass, uniform, uv } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { registerExperienceTools } from "./webmcp";
import { Office } from "./office";
import { Ambience } from "./audio";
import {
  CHAPTERS,
  DURATION,
  QUALITY,
  Quality,
  chapterAt,
  smooth,
} from "./timeline";
import { cameraAt } from "./journey";
import type { ScaleJourney } from "./journey";
import type { Cosmos } from "./cosmos";
import type { LivingWorld } from "./life";
import type { ThoughtDebris } from "./debris";

export type Snapshot = {
  time: number;
  chapter: number;
  running: boolean;
  started: boolean;
  ready: boolean;
  backend: string;
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  particles: number;
  dpr: number;
  quality: Quality;
  computeMs: number;
  assetFallback: boolean;
  released: number;
  seeds: number;
  error: string | null;
};
export type BenchmarkMode =
  "NONE" | "STORM" | "GRAVITY" | "GALAXY" | "ECOSYSTEM" | "TRANSFORMATION";
export const initialSnapshot: Snapshot = {
  time: 0,
  chapter: 0,
  running: false,
  started: false,
  ready: false,
  backend: "Initializing",
  fps: 0,
  frameMs: 0,
  drawCalls: 0,
  triangles: 0,
  particles: 0,
  dpr: 1,
  quality: "BALANCED",
  computeMs: 0,
  assetFallback: false,
  released: 0,
  seeds: 0,
  error: null,
};
export class ExperienceEngine {
  renderer!: T.WebGPURenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(46, 1, 0.05, 2000);
  office!: Office;
  audio = new Ambience();
  state = { ...initialSnapshot };
  pointer = new T.Vector2();
  reduced = false;
  speed = 1;
  gravity = 1;
  energy = 1;
  private pipeline?: T.RenderPipeline;
  private previous = 0;
  private elapsed = 0;
  private lastReport = 0;
  private frames: number[] = [];
  private disposed = false;
  private resizeObserver?: ResizeObserver;
  private raycaster = new T.Raycaster();
  private drag = -1;
  private plane = new T.Plane(new T.Vector3(0, 0, 1), 0.12);
  private hit = new T.Vector3();
  private look = new T.Vector3(-0.25, 1.86, -0.4);
  private qualitySince = 0;
  private backgroundPaused = false;
  private cosmos?: Cosmos;
  private living?: LivingWorld;
  private journey?: ScaleJourney;
  private debris?: ThoughtDebris;
  private lensStrength = uniform(0);
  private lensCenter = uniform(new T.Vector2(0.5, 0.5));
  private cameraTarget = new T.Vector3();
  private targetLook = new T.Vector3();
  private projected = new T.Vector3();
  private unregisterTools?: () => void;
  private benchmarkMode: BenchmarkMode = "NONE";
  private benchmarkStart = 0;
  private returnTo?: { time: number; running: boolean; quality: Quality };
  private surfaceFog = new T.Color(0x3f6263);
  constructor(
    private host: HTMLElement,
    private report: (s: Snapshot) => void,
    private onError: (error: string) => void,
  ) {
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  async init() {
    const params = new URLSearchParams(location.search);
    const mobile = innerWidth < 760;
    const q = params.get("quality") as Quality | null;
    this.state.quality = q && q in QUALITY ? q : mobile ? "BATTERY" : "HIGH";
    try {
      this.renderer = new T.WebGPURenderer({
        antialias: true,
        alpha: false,
        forceWebGL: params.get("backend") === "webgl",
        powerPreference: "high-performance",
      });
      await this.renderer.init();
      if (this.disposed) {
        this.renderer.dispose();
        return;
      }
      this.state.backend = (
        this.renderer.backend as unknown as { isWebGLBackend?: boolean }
      ).isWebGLBackend
        ? "WebGL2"
        : "WebGPU";
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.2;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = T.PCFShadowMap;
      this.renderer.setClearColor(0x080d12);
      const device = (
        this.renderer.backend as unknown as { device?: GPUDevice }
      ).device;
      if (device)
        void device.lost.then((info) => {
          if (!this.disposed && info.reason !== "destroyed") {
            this.state.running = false;
            this.renderer.setAnimationLoop(null);
            this.onError(
              "The graphics device was interrupted. Your place is saved.",
            );
          }
        });
      this.host.appendChild(this.renderer.domElement);
      this.renderer.domElement.setAttribute(
        "aria-label",
        "A late-night workspace gradually becoming a living universe",
      );
      this.scene.background = new T.Color(0x090f15);
      this.scene.fog = new T.FogExp2(0x0c1721, 0.017);
      this.office = new Office(this.scene);
      this.state.assetFallback = !(await this.office.load());
      if (this.disposed) {
        this.dispose();
        return;
      }
      this.setupPost();
      this.resize();
      this.camera.position.set(
        this.camera.aspect < 1 ? 4.9 : 4.45,
        3.22,
        this.camera.aspect < 1 ? 9.2 : 6.7,
      );
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.host);
      this.host.addEventListener("pointermove", this.onPointerMove);
      this.host.addEventListener("pointerdown", this.onPointerDown);
      this.host.addEventListener("pointerup", this.onPointerUp);
      this.host.addEventListener("pointercancel", this.onPointerUp);
      document.addEventListener("visibilitychange", this.onVisibility);
      this.renderer.domElement.addEventListener(
        "webglcontextlost",
        this.onContextLost,
      );
      this.state.ready = true;
      this.unregisterTools = registerExperienceTools(this);
      this.report({ ...this.state });
      if (params.has("t")) {
        this.seek(Number(params.get("t")) || 0);
        this.state.started = true;
        this.state.running = params.get("play") === "1";
      }
      this.renderer.setAnimationLoop(this.frame);
      void this.loadLater();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Graphics could not initialize";
      this.state.error = message;
      this.onError(message);
    }
  }
  private async loadLater() {
    try {
      const [cosmos, life, journey, debris] = await Promise.all([
        import("./cosmos"),
        import("./life"),
        import("./journey"),
        import("./debris"),
      ]);
      if (this.disposed) return;
      this.cosmos = new cosmos.Cosmos(
        this.scene,
        this.state.backend === "WebGPU",
      );
      this.living = new life.LivingWorld(this.scene);
      this.journey = new journey.ScaleJourney(this.scene);
      this.debris = new debris.ThoughtDebris(this.scene);
      this.cosmos.setCount(this.state.quality);
      this.living.setQuality(this.state.quality);
    } catch (e) {
      this.onError(
        e instanceof Error ? e.message : "The next part could not load",
      );
    }
  }
  private setupPost() {
    this.pipeline?.dispose();
    this.pipeline = undefined;
    if (!QUALITY[this.state.quality].bloom) return;
    const scenePass = pass(this.scene, this.camera);
    const color = scenePass.getTextureNode("output");
    const offset = uv().sub(this.lensCenter);
    const r2 = offset.dot(offset).add(0.008);
    const warped = uv().add(offset.mul(this.lensStrength).mul(0.002).div(r2));
    const lensed = color.sample(warped);
    const glow = bloom(color, 0.25, 0.55, 1.05);
    this.pipeline = new T.RenderPipeline(this.renderer);
    this.pipeline.outputNode = lensed.add(glow);
  }
  private resize() {
    if (!this.renderer || this.disposed) return;
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, QUALITY[this.state.quality].dpr),
    );
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 59 : 46;
    this.camera.updateProjectionMatrix();
    this.state.dpr = this.renderer.getPixelRatio();
  }
  private frame = (now: number) => {
    if (this.disposed) return;
    try {
      const frameSeconds = this.previous
        ? (now - this.previous) / 1000
        : 1 / 60;
      const realDt = Math.min(frameSeconds, 0.1);
      this.previous = now;
      if (document.hidden) return;
      const dt = Math.min(realDt, 1 / 30);
      this.elapsed += dt * (1 - smooth(268, 300, this.state.time) * 0.7);
      if (this.state.running)
        this.state.time = Math.min(
          DURATION,
          this.state.time + realDt * this.speed,
        );
      if (this.benchmarkMode === "TRANSFORMATION")
        this.state.time = 58 + ((this.elapsed - this.benchmarkStart) % 95);
      if (this.state.time >= DURATION) this.state.running = false;
      const t = this.state.time;
      this.state.chapter = chapterAt(t);
      this.office.update(t, this.elapsed, dt, this.pointer, this.reduced);
      this.office.group.scale.setScalar(1 - smooth(103, 132, t) * 0.9998);
      this.cosmos?.update(
        t,
        this.elapsed,
        dt,
        this.pointer,
        this.renderer,
        this.gravity,
        this.reduced,
        this.benchmarkMode === "GRAVITY",
      );
      this.living?.update(t, this.elapsed, this.reduced);
      this.journey?.update(t);
      this.debris?.update(t);
      this.state.particles = this.cosmos?.count ?? 0;
      this.state.computeMs = this.cosmos?.computeMs ?? 0;
      if (this.scene.fog instanceof T.FogExp2) {
        this.scene.fog.density =
          0.017 * (1 - smooth(76, 143, t)) + smooth(237, 253, t) * 0.01;
        this.scene.fog.color
          .set(0x0c1721)
          .lerp(this.surfaceFog, smooth(228, 249, t));
      }
      const mobile = this.camera.aspect < 1;
      const move = this.reduced ? 0 : 1;
      cameraAt(t, this.cameraTarget, this.targetLook);
      if (mobile) {
        this.cameraTarget.z *= 1.25;
        if (t > 230) this.cameraTarget.y += 0.6;
      }
      this.cameraTarget.x +=
        this.pointer.x * (t > 130 && t < 225 ? 1.2 : 0.14) * move;
      this.cameraTarget.y += this.pointer.y * 0.1 * move;
      this.camera.position.lerp(this.cameraTarget, 1 - Math.exp(-dt * 2.8));
      this.look.lerp(this.targetLook, 1 - Math.exp(-dt * 2.8));
      this.camera.lookAt(this.look);
      this.audio.update(t);
      if (this.cosmos) {
        this.cosmos.singularity.quaternion.copy(this.camera.quaternion);
        this.projected
          .copy(this.cosmos.singularity.position)
          .project(this.camera);
        this.lensCenter.value.set(
          this.projected.x * 0.5 + 0.5,
          this.projected.y * 0.5 + 0.5,
        );
        this.lensStrength.value = smooth(35, 75, t) * (1 - smooth(106, 145, t));
      }
      if (this.pipeline) this.pipeline.render();
      else this.renderer.render(this.scene, this.camera);
      this.frames.push(frameSeconds * 1000);
      if (this.frames.length > 100) this.frames.shift();
      if (this.elapsed - this.lastReport > 0.35) {
        this.lastReport = this.elapsed;
        const avg = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
        this.state.fps = Math.round(1000 / avg);
        this.state.frameMs = avg;
        this.state.drawCalls = this.renderer.info.render.drawCalls;
        this.state.triangles = this.renderer.info.render.triangles;
        this.report({ ...this.state });
        if (
          this.benchmarkMode === "NONE" &&
          this.elapsed - this.qualitySince > 15 &&
          avg > 30 &&
          this.frames.length >= 90
        ) {
          const tiers: Quality[] = ["ULTRA", "HIGH", "BALANCED", "BATTERY"];
          const i = tiers.indexOf(this.state.quality);
          if (i < 3) this.setQuality(tiers[i + 1]);
          this.qualitySince = this.elapsed;
        }
      }
    } catch (e) {
      this.renderer.setAnimationLoop(null);
      this.onError(e instanceof Error ? e.message : "The renderer stopped");
    }
  };
  start() {
    this.state.started = true;
    this.state.running = true;
    this.camera.position.set(4.45, 3.22, 6.7);
    this.report({ ...this.state });
  }
  togglePause() {
    if (!this.state.started) {
      this.start();
      return;
    }
    this.state.running = !this.state.running;
    this.report({ ...this.state });
  }
  seek(t: number) {
    this.state.time = Math.max(0, Math.min(DURATION, t));
    this.state.chapter = chapterAt(t);
    this.office?.reset();
    cameraAt(this.state.time, this.cameraTarget, this.targetLook);
    if (this.camera.aspect < 1) this.cameraTarget.z *= 1.25;
    this.camera.position.copy(this.cameraTarget);
    this.look.copy(this.targetLook);
    this.report({ ...this.state });
  }
  next() {
    this.seek(CHAPTERS[Math.min(7, this.state.chapter + 1)].start + 0.1);
  }
  get benchmarkScenario() {
    return this.benchmarkMode;
  }
  benchmark(mode: BenchmarkMode) {
    if (this.benchmarkMode === "NONE" && mode !== "NONE")
      this.returnTo = {
        time: this.state.time,
        running: this.state.running,
        quality: this.state.quality,
      };
    this.benchmarkMode = mode;
    this.benchmarkStart = this.elapsed;
    if (mode === "NONE" && this.returnTo) {
      this.seek(this.returnTo.time);
      this.state.running = this.returnTo.running;
      this.setQuality(this.returnTo.quality);
      return;
    }
    this.state.started = true;
    this.state.running = false;
    this.setQuality(mode === "STORM" ? "ULTRA" : this.state.quality);
    this.seek(
      mode === "ECOSYSTEM" ? 260 : mode === "TRANSFORMATION" ? 58 : 165,
    );
  }
  setQuality(q: Quality) {
    this.state.quality = q;
    this.qualitySince = this.elapsed;
    this.setupPost();
    this.resize();
    this.cosmos?.setCount(q);
    this.living?.setQuality(q);
    this.report({ ...this.state });
  }
  releaseThought() {
    if (this.state.time >= 180) {
      this.cosmos?.seed(this.state.time, this.pointer);
      this.state.seeds++;
      this.report({ ...this.state });
      return;
    }
    const i =
      this.office?.thoughts.findIndex(
        (t) => t.released < 0 && t.mesh.visible,
      ) ?? -1;
    if (i >= 0) {
      this.debris?.emit(this.office.thoughts[i].mesh, this.state.time);
      this.office.release(i, this.state.time);
      this.state.released++;
      this.report({ ...this.state });
    }
  }
  private onPointerMove = (e: PointerEvent) => {
    const r = this.host.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    if (this.drag >= 0) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      this.raycaster.ray.intersectPlane(this.plane, this.hit);
      this.office.thoughts[this.drag].mesh.position.copy(this.hit);
    }
  };
  private onPointerDown = (e: PointerEvent) => {
    this.onPointerMove(e);
    if (this.state.time >= 180 && this.state.time < 229) {
      this.cosmos?.seed(this.state.time, this.pointer);
      this.state.seeds++;
      this.report({ ...this.state });
      return;
    }
    if (this.state.time < 35 || this.state.time > 108) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(
      this.office.thoughts
        .filter((t) => t.mesh.visible && t.released < 0)
        .map((t) => t.mesh),
    );
    if (hits.length) {
      this.drag = this.office.thoughts.findIndex(
        (t) => t.mesh === hits[0].object,
      );
      this.office.thoughts[this.drag].mesh.userData.dragged = true;
      this.host.setPointerCapture(e.pointerId);
    }
  };
  private onPointerUp = (e: PointerEvent) => {
    if (this.drag >= 0) {
      this.debris?.emit(this.office.thoughts[this.drag].mesh, this.state.time);
      this.office.release(this.drag, this.state.time);
      this.state.released++;
      this.report({ ...this.state });
      this.drag = -1;
      if (this.host.hasPointerCapture(e.pointerId))
        this.host.releasePointerCapture(e.pointerId);
    }
  };
  private onVisibility = () => {
    if (document.hidden) {
      this.backgroundPaused = this.state.running;
      this.state.running = false;
      this.audio.suspend();
    } else {
      if (this.backgroundPaused) this.state.running = true;
      this.previous = 0;
      this.audio.resume();
    }
  };
  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.state.running = false;
    this.renderer.setAnimationLoop(null);
    this.onError("The graphics context was interrupted. Your place is saved.");
  };
  dispose() {
    this.disposed = true;
    this.renderer?.setAnimationLoop(null);
    this.resizeObserver?.disconnect();
    this.host.removeEventListener("pointermove", this.onPointerMove);
    this.host.removeEventListener("pointerdown", this.onPointerDown);
    this.host.removeEventListener("pointerup", this.onPointerUp);
    this.host.removeEventListener("pointercancel", this.onPointerUp);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.renderer?.domElement.removeEventListener(
      "webglcontextlost",
      this.onContextLost,
    );
    this.unregisterTools?.();
    this.cosmos?.dispose();
    this.audio.dispose();
    this.pipeline?.dispose();
    const geometries = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>(),
      textures = new Set<T.Texture>();
    this.scene.traverse((o) => {
      if (
        o instanceof T.Mesh ||
        o instanceof T.LineSegments ||
        o instanceof T.Points ||
        o instanceof T.Sprite
      ) {
        geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          materials.add(m);
          for (const value of Object.values(m))
            if (value instanceof T.Texture) textures.add(value);
        }
      }
    });
    geometries.forEach((g) => g.dispose());
    textures.forEach((t) => t.dispose());
    materials.forEach((m) => m.dispose());
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
