import * as T from "three/webgpu";
import { InputManager, type InputAction } from "./input";
import { FlightController } from "./flight";
import { SurfaceWalker } from "./walk";
import { PilgrimSystem } from "./pilgrim/system";
import type { Condition } from "./perception/types";
import { UniverseWorld } from "./world";
import { QUALITY, type Quality } from "./config";
import { Ambience } from "./audio";
import { MatterField } from "./matter";
import { CreationSystem } from "./creation";
import { pass, uniform, uv, float, smoothstep } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { initialSnapshot, type UniverseSnapshot } from "./state";
import type { ReleaseKind } from "./orbit-model";
import type { RelativityObservation } from "./relativity";
export class UniverseEngine {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(57, 1, 0.5, 20000000);
  flight = new FlightController();
  walker = new SurfaceWalker();
  pilgrim!: PilgrimSystem;
  renderer!: T.WebGPURenderer;
  input!: InputManager;
  world!: UniverseWorld;
  matter!: MatterField;
  creation!: CreationSystem;
  audio = new Ambience();
  state = { ...initialSnapshot };
  private disposed = false;
  private previous = 0;
  private reportAt = 0;
  private frames: number[] = [];
  private resizeObserver?: ResizeObserver;
  private controller = new AbortController();
  private raycaster = new T.Raycaster();
  private projection = new T.Vector3();
  private qualityAt = 0;
  private pipeline?: T.RenderPipeline;
  private scenePass?: T.PassNode;
  private lensCenter = uniform(new T.Vector2());
  private lensRadius = uniform(0.01);
  private lensStrength = uniform(0);
  private glowStrength = uniform(0.16);
  benchmarkMode = "NONE";
  private beforeBenchmark: Quality = "HIGH";
  private relativity?: RelativityObservation;
  private observationRequest = 0;
  private observationPreparation?: Promise<void>;
  private profile = false;
  private timestampsPending = false;
  private gpuRenderMs: number | null = null;
  private gpuComputeMs: number | null = null;
  constructor(
    private host: HTMLElement,
    private report: (s: UniverseSnapshot) => void,
    private uiAction: (a: InputAction) => void,
    private error: (s: string) => void,
    readonly research = false,
  ) {}
  async init() {
    try {
      const params = new URLSearchParams(location.search);
      const mark = (stage: string) => {
        if (params.has("qa")) console.info("VASTNESS ready:", stage);
      };
      const quality = params.get("quality");
      this.state.quality =
        quality && quality in QUALITY
          ? (quality as Quality)
          : innerWidth < 760
            ? "BATTERY"
            : "HIGH";
      this.flight.gentle = matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      this.renderer = new T.WebGPURenderer({
        antialias: true,
        forceWebGL: params.get("backend") === "webgl",
        logarithmicDepthBuffer: true,
        trackTimestamp: params.has("profile"),
      });
      await this.renderer.init();
      mark("renderer");
      if (this.disposed) {
        this.renderer.dispose();
        return;
      }
      this.state.backend = (
        this.renderer.backend as unknown as { isWebGLBackend: boolean }
      ).isWebGLBackend
        ? "WebGL2"
        : "WebGPU";
      this.profile =
        params.has("profile") &&
        this.state.backend === "WebGPU" &&
        this.renderer.hasFeature("timestamp-query");
      // Present on the r183 backend; omitted by its companion type declarations.
      (
        this.renderer.backend as unknown as { trackTimestamp: boolean }
      ).trackTimestamp = this.profile;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      this.scene.background = new T.Color(0x020407);
      this.host.appendChild(this.renderer.domElement);
      this.renderer.domElement.setAttribute(
        "aria-label",
        "Freely explorable universe. WASD to fly, mouse to look. H for all controls.",
      );
      this.world = new UniverseWorld(
        this.scene,
        this.state.backend === "WebGPU",
      );
      mark("world");
      this.world.setQuality(this.state.quality);
      this.pilgrim = new PilgrimSystem(this.scene, this.renderer);
      this.pilgrim.quality = this.state.quality;
      this.pilgrim.lab = this.research;
      this.matter = new MatterField(
        this.scene,
        this.state.backend === "WebGPU",
      );
      this.matter.setQuality(this.state.quality);
      this.creation = new CreationSystem(this.scene);
      this.state.seeds = this.creation.stars.length;
      this.input = new InputManager(
        this.renderer.domElement,
        this.action,
        this.pick,
      );
      this.resize();
      this.resizeObserver = new ResizeObserver(this.resize);
      this.resizeObserver.observe(this.host);
      document.addEventListener(
        "visibilitychange",
        () => {
          this.previous = 0;
          if (document.hidden) this.audio.suspend();
          else this.audio.resume();
        },
        { signal: this.controller.signal },
      );
      this.renderer.domElement.addEventListener(
        "webglcontextlost",
        (e) => {
          e.preventDefault();
          this.fail("The graphics context was interrupted.");
        },
        { signal: this.controller.signal },
      );
      const device = (
        this.renderer.backend as unknown as { device?: GPUDevice }
      ).device;
      if (device)
        void device.lost.then((info) => {
          if (!this.disposed && info.reason !== "destroyed")
            this.fail("The graphics device was interrupted.");
        });
      this.world.update(this.flight.position, 0);
      this.scene.updateMatrixWorld(true);
      this.pilgrim.contact.observer.copy(this.flight.position);
      this.camera.quaternion.copy(this.flight.quaternion);
      this.camera.updateMatrixWorld();
      this.setupPost();
      mark("pipeline");
      // Precompile every material against the actual scene render target. Light topology stays fixed.
      const restore: {
        object: T.Object3D;
        visible: boolean;
        culled: boolean;
      }[] = [];
      this.scene.traverse((object) => {
        restore.push({
          object,
          visible: object.visible,
          culled: object.frustumCulled,
        });
        object.visible = true;
        object.frustumCulled = false;
      });
      // r183's reflector performs a nested render from updateBefore; invoking it
      // while async pipelines are still pending can bind an unfinished pipeline.
      // Warm this one material with the real first draw after other shaders finish.
      this.world.sanctuaries.sea.mesh.visible = false;
      this.world.approaches.reflectiveMeshes.forEach(
        (mesh) => (mesh.visible = false),
      );
      const pending = this.scenePass
        ? this.scenePass.compileAsync(this.renderer)
        : this.renderer.compileAsync(this.scene, this.camera);
      restore.forEach(({ object, visible, culled }) => {
        object.visible = visible;
        object.frustumCulled = culled;
      });
      await pending;
      this.world.sanctuaries.air.depthReady = true;
      mark("compiled");
      this.matter.prepare(this.renderer);
      this.world.sanctuaries.life.prepare(this.renderer);
      if (this.disposed) return;
      // Scene compilation does not warm the post-processing graph. Complete its
      // first draw while the arrival poster is visible, before accepting flight.
      this.pipeline!.render();
      mark("first draw");
      if (device) await device.queue.onSubmittedWorkDone();
      if (this.disposed) return;
      this.state.ready = true;
      if (this.research) this.resetLab();
      this.renderer.setAnimationLoop(this.frame);
      void this.world.loadHero(async (objects) => {
        const old = this.renderer.getRenderTarget();
        if (this.scenePass)
          this.renderer.setRenderTarget(this.scenePass.renderTarget);
        const pending = this.renderer.compileAsync(
          objects,
          this.camera,
          this.scene,
        );
        this.renderer.setRenderTarget(old);
        await pending;
      });
      this.report({ ...this.state });
      if (params.has("qa"))
        (window as unknown as { __vastness: unknown }).__vastness = {
          inspect: () => this.inspect(),
        };
    } catch (e) {
      this.fail(e instanceof Error ? e.message : "Graphics could not start.");
    }
  }
  private leaveGround() {
    if (!this.walker.active) return;
    const surface = this.walker.surface!;
    this.flight.departSurface(surface.id, (position) => {
      const p = this.walker.localPosition(surface, position);
      p.y = surface.height(p.x, p.z) + 1.8 / surface.radius;
      return (
        p.applyQuaternion(surface.frame).add(surface.up).length() *
        surface.radius
      );
    });
    this.walker.stop();
  }
  action = (a: InputAction) => {
    if (a === "manual") this.pilgrim?.manual();
    if (["reset", "focus", "orbit", "walk", "fly"].includes(a))
      this.leavePilgrim();
    if (["pilgrim", "carry", "rest"].includes(a)) {
      if (a === "rest") {
        this.pilgrim.rest();
        this.flight.cancel();
        this.input.clear();
      } else {
        if (!this.pilgrim.active && this.state.pilgrimAvailable) {
          this.walker.stop();
          this.pilgrim.start(
            this.flight,
            this.world.approaches.pilgrimSurface(this.state.approach),
          );
        }
        if (this.pilgrim.active) {
          if (a === "carry") void this.pilgrim.carry();
          else {
            this.pilgrim.manual();
            this.pilgrim.cruise = true;
          }
        }
      }
      this.updateSnapshot();
      this.report({ ...this.state });
      return;
    }
    if (a === "wander" && this.pilgrim.active) {
      void this.pilgrim.carry();
      return;
    }
    if (a === "cancel") this.pilgrim?.rest();
    if (["reset", "focus", "wander", "orbit"].includes(a)) this.leaveGround();
    if (a === "walk") {
      if (this.walker.active) this.leaveGround();
      else {
        const surface = this.world.approaches.walkSurface(this.state.approach);
        if (surface) this.walker.start(surface, this.flight);
      }
      this.input.clear();
      this.updateSnapshot();
      this.report({ ...this.state });
      return;
    }
    if (a === "manual") {
      if (
        this.relativity?.active &&
        ([...this.input.keys].some((k) =>
          [
            "KeyW",
            "KeyA",
            "KeyS",
            "KeyD",
            "Space",
            "KeyX",
            "ShiftLeft",
            "ShiftRight",
          ].includes(k),
        ) ||
          this.input.touchMove.lengthSq() > 0.001)
      )
        this.endObservation();
      if (this.state.relativityLoading) {
        this.observationRequest++;
        this.state.relativityLoading = false;
      }
      if (this.flight.mode !== "FREE") {
        this.flight.cancel();
        this.flight.velocity.multiplyScalar(0.15);
      }
      return;
    }
    if (
      [
        "cancel",
        "reset",
        "places",
        "wander",
        "focus",
        "orbit",
        "experiment",
      ].includes(a)
    )
      this.endObservation();
    if (["help", "hud", "places", "experiment"].includes(a)) {
      this.input?.clear();
      this.flight.cancel();
    }
    if (a === "focus") this.flight.focus();
    else if (a === "orbit") this.flight.orbit();
    else if (a === "reset") {
      this.input.clear();
      this.flight.reset();
      this.input.selected = false;
    } else if (a === "pause") this.state.paused = !this.state.paused;
    else if (a === "quiet") {
      this.state.quiet = !this.state.quiet;
      this.flight.quiet = this.state.quiet;
    } else if (a === "wander") this.flight.wander();
    else if (a === "cancel") {
      this.flight.cancel();
      this.state.quiet = false;
      this.flight.quiet = false;
    } else if (a === "seed" && this.creation) {
      const walking = this.walker.active;
      const local = walking || this.world.sanctuaries.presence > 0.5;
      const distance = walking
          ? 4
          : local
            ? 55
            : Math.max(100, this.matter.domain * 0.35),
        position = new T.Vector3(0, 0, -distance)
          .applyQuaternion(this.flight.quaternion)
          .add(this.flight.position);
      if (walking && this.walker.surface) {
        const up = this.flight.position
          .clone()
          .sub(this.walker.surface.center)
          .normalize();
        const direction = position
          .clone()
          .sub(this.flight.position)
          .addScaledVector(
            up,
            -position.clone().sub(this.flight.position).dot(up),
          )
          .normalize();
        position
          .copy(this.flight.position)
          .addScaledVector(direction, 4)
          .addScaledVector(up, 0.5);
      }
      const star = this.creation.add(
        position,
        walking ? 0.12 : local ? 1.5 : Math.max(8, this.matter.domain * 0.012),
        this.state.time,
      );
      this.state.seeds = this.creation.stars.length;
      this.flight.selected = star;
      this.input.selected = true;
    }
    this.uiAction(a);
    this.report({ ...this.state });
  };
  select(id: string, travel = false) {
    this.endObservation();
    if (travel) {
      this.leaveGround();
      this.leavePilgrim();
    }
    const b = [...this.world.bodies, ...this.creation.stars].find(
      (b) => b.id === id,
    );
    if (!b) return;
    this.flight.selected = b;
    this.input.selected = true;
    if (travel) this.flight.focus(b);
  }
  async beginObservation() {
    if (this.state.relativityLoading || this.relativity?.active) return;
    const hole = this.world.bodies.find((b) => b.id === "wound")!;
    if (this.flight.position.distanceTo(hole.position) > hole.radius * 12)
      return;
    const request = ++this.observationRequest;
    this.walker.stop();
    this.input.clear();
    this.flight.cancel();
    this.flight.velocity.set(0, 0, 0);
    this.state.relativityLoading = true;
    this.state.relativityError = false;
    this.report({ ...this.state });
    try {
      this.observationPreparation ??= (async () => {
        const { RelativityObservation } = await import("./relativity");
        if (this.disposed) return;
        this.relativity = new RelativityObservation(
          this.renderer,
          this.world.anomaly.diskRotation,
          this.world.anomaly.weather,
        );
        await this.relativity.prepare();
      })();
      await this.observationPreparation;
      if (this.disposed || request !== this.observationRequest) return;
      if (!this.relativity) return;
      this.relativity.setQuality(this.state.quality);
      this.relativity.start(
        this.flight.position,
        this.flight.quaternion,
        hole.position,
        hole.radius,
      );
      this.flight.quaternion.multiply(
        new T.Quaternion().setFromEuler(new T.Euler(0.12, 0.42, 0)),
      );
      this.input.selected = false;
    } catch (e) {
      console.warn("Relativistic observation unavailable", e);
      this.state.relativityError = true;
      this.relativity?.dispose();
      this.relativity = undefined;
      this.observationPreparation = undefined;
    } finally {
      if (!this.disposed && request === this.observationRequest) {
        this.state.relativityLoading = false;
        this.updateSnapshot();
        this.report({ ...this.state });
      }
    }
  }
  endObservation() {
    this.observationRequest++;
    this.state.relativityLoading = false;
    if (!this.relativity?.active) return;
    this.flight.position.copy(this.relativity.returnPosition);
    this.flight.quaternion.copy(this.relativity.returnQuaternion);
    this.flight.cancel();
    this.flight.velocity.set(0, 0, 0);
    this.relativity.active = false;
    this.input.selected = !!this.flight.selected;
    this.state.relativity = this.relativity.snapshot();
  }
  setObservationRate(rate: number) {
    if (this.relativity && [0.25, 1, 4].includes(rate))
      this.relativity.rate = rate;
  }
  approach(id = this.state.encounter) {
    const target = this.world.bodies.find((b) => b.id === id);
    if (target?.approachArrival) {
      this.leaveGround();
      this.leavePilgrim();
      this.select(target.id);
      this.flight.approach(target);
    }
  }
  releaseMatter(kind: ReleaseKind) {
    const hole = this.world.bodies.find((b) => b.id === "wound")!;
    if (
      this.state.paused ||
      this.flight.position.distanceTo(hole.position) > hole.radius * 12
    )
      return;
    const local = this.flight.position
      .clone()
      .sub(hole.position)
      .applyQuaternion(this.world.anomaly.diskRotation.clone().invert());
    this.world.anomaly.experiment.release(
      kind,
      Math.atan2(local.y, local.x) + 0.75,
    );
  }
  releaseGas() {
    const hole = this.world.bodies.find((b) => b.id === "wound")!;
    if (
      this.state.paused ||
      (!this.relativity?.active &&
        this.flight.position.distanceTo(hole.position) > hole.radius * 12)
    )
      return;
    const local = this.flight.position
      .clone()
      .sub(hole.position)
      .applyQuaternion(this.world.anomaly.diskRotation.clone().invert());
    this.world.anomaly.weather.model.release(
      Math.atan2(local.y, local.x) + 0.45,
    );
  }
  setGravity(value: number) {
    this.world.anomaly.experiment.model.setGravity(value);
  }
  clearExperiment() {
    this.world.anomaly.experiment.clear();
  }
  private pick = (p: T.Vector2, travel: boolean) => {
    if (this.relativity?.active) return;
    this.raycaster.setFromCamera(p, this.camera);
    let best = Infinity,
      selected;
    for (const b of [...this.world.bodies, ...this.creation.stars]) {
      if (!b.object.visible || ("archetype" in b && b.archetype === 7))
        continue;
      const sphere = new T.Sphere(b.object.position, b.object.scale.x);
      const hit = this.raycaster.ray.intersectSphere(sphere, new T.Vector3());
      if (hit && hit.length() < best) {
        best = hit.length();
        selected = b;
      }
    }
    if (selected) this.select(selected.id, travel);
    else {
      this.flight.selected = undefined;
      this.input.selected = false;
    }
  };
  private leavePilgrim() {
    if (!this.pilgrim?.active) return;
    const surface = this.world.approaches.pilgrimSurface(this.state.approach);
    if (surface)
      this.flight.departSurface(surface.id, (position) => {
        const local = this.pilgrim.contact.toLocal(position);
        local.y = this.pilgrim.contact.sample(local.x, local.z).height + 6;
        return this.pilgrim.contact.toWorld(local).distanceTo(surface.center);
      });
    this.pilgrim.stop();
    this.flight.cancel();
  }
  resetLab(condition: Condition = "CLEAR") {
    if (!this.research) return;
    this.pilgrim.stop();
    this.walker.stop();
    this.flight.cancel();
    this.input.clear();
    // An explicit lab fixture; never used by Carry or its perception worker.
    this.flight.position.set(1600, 40, -1090);
    this.flight.quaternion.setFromEuler(new T.Euler(0.01, 0.58, 0));
    this.world.update(this.flight.position, this.state.time);
    this.scene.updateMatrixWorld(true);
    this.pilgrim.contact.observer.copy(this.flight.position);
    this.pilgrim.start(this.flight);
    void this.pilgrim.enableSensors().then(() => {
      if (this.pilgrim.perception) {
        this.pilgrim.perception.lab = true;
        this.pilgrim.perception.setCondition(condition);
        this.pilgrim.perception.reset();
      }
    });
  }
  private setupPost() {
    this.scenePass = pass(this.scene, this.camera);
    const sceneColor = this.scenePass.getTextureNode("output");
    const offset = uv().sub(this.lensCenter),
      r = offset.length(),
      radius = this.lensRadius;
    const influence = float(1)
      .sub(smoothstep(radius.mul(1.3), radius.mul(3.8), r))
      .mul(smoothstep(radius.mul(0.94), radius.mul(1.25), r));
    const warped = uv().sub(
      offset
        .div(r.max(0.00001))
        .mul(radius.pow(2))
        .div(r.add(radius.mul(0.35)))
        .mul(influence)
        .mul(this.lensStrength)
        .mul(0.18),
    );
    const lensed = sceneColor.sample(warped),
      glow = bloom(sceneColor, 1, 0.48, 1.2);
    this.pipeline = new T.RenderPipeline(this.renderer);
    this.pipeline.outputNode = lensed.add(glow.mul(this.glowStrength));
    this.glowStrength.value = this.state.quality === "BATTERY" ? 0 : 0.15;
  }
  private resize = () => {
    if (!this.renderer || this.disposed) return;
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, QUALITY[this.state.quality].dpr),
    );
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 70 : 57;
    this.camera.updateProjectionMatrix();
    this.state.dpr = this.renderer.getPixelRatio();
  };
  private frame = (now: number) => {
    if (this.disposed || document.hidden) return;
    try {
      const elapsed = this.previous ? (now - this.previous) / 1000 : 1 / 60;
      this.previous = now;
      const dt = Math.min(elapsed, 1 / 30);
      const force = this.input.keys.has("KeyG")
        ? 1
        : this.input.keys.has("KeyV")
          ? -1
          : this.benchmarkMode === "GRAVITY"
            ? 2
            : 0;
      if (this.pilgrim.active)
        this.pilgrim.update(
          dt,
          this.input,
          this.flight,
          this.state.paused,
          this.world.sanctuaries.event !== "none",
        );
      else if (this.walker.active)
        this.walker.update(dt, this.input, this.flight);
      else
        this.flight.update(
          dt,
          this.input,
          this.relativity?.active
            ? []
            : [...this.world.bodies, ...this.creation.stars],
        );
      if (this.relativity?.active) {
        const hole = this.world.bodies.find((b) => b.id === "wound")!;
        this.relativity.advance(this.state.paused ? 0 : dt);
        this.flight.position
          .copy(hole.position)
          .addScaledVector(
            this.relativity.outward,
            this.relativity.radius * hole.radius,
          );
        this.flight.velocity.set(0, 0, 0);
      }
      this.camera.quaternion.copy(this.flight.quaternion);
      this.camera.updateMatrixWorld();
      if (!this.state.paused) this.state.time += dt;
      this.world.sanctuaries.respond(this.flight.velocity.length());
      this.world.sanctuaries.sea.wakeSource = this.pilgrim.active
        ? this.pilgrim.worldPosition
        : undefined;
      this.flight.holdBeauty = this.world.sanctuaries.event !== "none";
      this.world.update(
        this.flight.position,
        this.state.time,
        this.camera,
        this.flight.velocity.length(),
      );
      this.world.anomaly.simulate(this.state.paused ? 0 : dt);
      this.world.sanctuaries.life.update(
        this.renderer,
        this.state.paused ? 0 : dt,
        this.flight.velocity.length(),
        this.world.sanctuaries.event,
        this.world.sanctuaries.eventTime,
      );
      this.creation.update(this.flight.position, this.state.time);
      this.scene.updateMatrixWorld(true);
      this.pilgrim.afterWorld(this.flight.position, this.state.time);
      const hole = this.world.bodies.find((b) => b.id === "wound")!;
      const pull =
        this.creation.nearest(this.flight.position) ??
        (this.flight.position.distanceTo(hole.position) < hole.radius * 4
          ? hole.position
          : undefined);
      this.matter.update(
        this.renderer,
        this.flight.position,
        this.flight.quaternion,
        Math.max(100, this.state.distance),
        this.state.paused ? 0 : dt,
        force,
        pull,
        this.world.sanctuaries.presence,
        this.world.sanctuaries.stillness,
        this.flight.velocity,
      );
      this.projection.copy(hole.object.position).project(this.camera);
      this.lensCenter.value.set(
        this.projection.x * 0.5 + 0.5,
        this.projection.y * 0.5 + 0.5,
      );
      const angularRadius =
        hole.object.scale.x / Math.max(1, hole.object.position.length());
      this.lensRadius.value = Math.min(
        0.42,
        angularRadius / (2 * Math.tan((this.camera.fov * Math.PI) / 360)),
      );
      this.lensStrength.value =
        this.projection.z < 1 &&
        Math.abs(this.projection.x) < 1.6 &&
        Math.abs(this.projection.y) < 1.6
          ? 1
          : 0;
      if (this.relativity?.active)
        this.relativity.render(
          this.camera,
          this.host.clientWidth,
          this.host.clientHeight,
        );
      else this.pipeline!.render();
      if (this.profile && !this.timestampsPending) {
        this.timestampsPending = true;
        void Promise.all([
          this.renderer.resolveTimestampsAsync("render"),
          this.renderer.resolveTimestampsAsync("compute"),
        ])
          .then(([render, compute]) => {
            this.gpuRenderMs = render ?? null;
            this.gpuComputeMs = compute ?? null;
          })
          .catch(() => {
            this.profile = false;
          })
          .finally(() => {
            this.timestampsPending = false;
          });
      }
      this.audio.update(this.state.quiet, this.world.sanctuaries.active);
      this.frames.push(elapsed * 1000);
      if (this.frames.length > 120) this.frames.shift();
      if (now - this.reportAt > 120) {
        this.reportAt = now;
        this.updateSnapshot();
        this.report({ ...this.state });
      }
      if (
        this.benchmarkMode === "NONE" &&
        now - this.qualityAt > 18000 &&
        this.frames.length === 120 &&
        this.state.frameMs > 29
      ) {
        const tiers: Quality[] = ["ULTRA", "HIGH", "BALANCED", "BATTERY"],
          i = tiers.indexOf(this.state.quality);
        if (i < 3) this.setQuality(tiers[i + 1]);
        this.qualityAt = now;
      }
    } catch (e) {
      this.fail(e instanceof Error ? e.message : "Rendering stopped.");
    }
  };
  private updateSnapshot() {
    this.state.sanctuary = this.world.sanctuaries.active;
    const selected = this.flight.selected;
    this.state.selected = selected?.name ?? null;
    this.state.selectedId = selected?.id ?? "";
    this.state.selectedKind = selected?.kind ?? "";
    this.state.mode = this.flight.mode;
    this.state.velocity = this.flight.velocity.length();
    this.state.speedDial = this.flight.speedDial;
    this.state.particles = this.matter.count;
    this.state.field = this.matter.fieldActive;
    this.state.learning = { ...this.input.learning };
    this.state.experiment = this.world.anomaly.experiment.model.snapshot();
    this.state.gas = this.world.anomaly.weather.model.snapshot();
    if (this.relativity) this.state.relativity = this.relativity.snapshot();
    this.state.approach = this.world.approaches?.active ?? "";
    this.state.walking = this.walker.active;
    this.state.pilgrim = this.pilgrim.active;
    this.state.carrying = this.pilgrim.director.active;
    this.state.resting = this.pilgrim.director.active
      ? this.pilgrim.director.resting
      : this.pilgrim.model.velocity.length() < 0.3 && !this.pilgrim.cruise;
    this.state.pilgrimAvailable =
      this.world.sanctuaries.presence > 0.8 ||
      !!this.world.approaches.pilgrimSurface(this.state.approach);
    const walkSurface = this.world.approaches.walkSurface(this.state.approach);
    this.state.walkAvailable =
      !!walkSurface && this.walker.canStart(walkSurface, this.flight.position);
    const encounter =
      this.world.bodies.find(
        (b) =>
          b.id === selected?.id &&
          ![4, 5, 7].includes(b.archetype) &&
          this.flight.position.distanceTo(b.position) <
            b.radius * (b.archetype === 3 ? 12 : 7.5),
      ) ??
      this.world.bodies.find(
        (b) =>
          b.id !== "orpheus" &&
          ![4, 5, 7].includes(b.archetype) &&
          this.flight.position.distanceTo(b.position) <
            b.radius * (b.archetype === 3 ? 4 : 1.5),
      );
    this.state.encounter =
      this.flight.mode === "TRAVEL" ? "" : (encounter?.id ?? "");
    let nearest = Infinity;
    for (const b of this.world.bodies) {
      const d = this.flight.position.distanceTo(b.position) - b.radius;
      if (b.archetype === 7) continue;
      if (d < nearest) {
        nearest = d;
        this.state.nearest = b.name;
      }
    }
    this.state.distance = nearest;
    if (this.world.sanctuaries.active !== "space")
      this.state.nearest = this.world.sanctuaries.places.find(
        (p) => p.id === this.world.sanctuaries.active,
      )!.name;
    this.state.sectors = this.world.sectors;
    if (selected) {
      const b = [...this.world.bodies, ...this.creation.stars].find(
        (b) => b.id === selected.id,
      );
      if (b) {
        this.projection.copy(b.object.position).project(this.camera);
        this.state.selectionX = Math.max(
          10,
          Math.min(
            this.camera.aspect < 1 ? 65 : 84,
            (this.projection.x * 0.5 + 0.5) * 100,
          ),
        );
        this.state.selectionY = Math.max(
          14,
          Math.min(73, (-this.projection.y * 0.5 + 0.5) * 100),
        );
        this.state.selectionVisible =
          this.projection.z < 1 && !("archetype" in b && b.archetype === 7);
      }
    } else this.state.selectionVisible = false;
    if (
      this.relativity?.active ||
      this.state.approach === this.flight.selected?.id
    )
      this.state.selectionVisible = false;
    this.state.frameMs =
      this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    this.state.fps = Math.round(1000 / this.state.frameMs);
    this.state.drawCalls = this.renderer.info.render.drawCalls;
    this.state.triangles = this.renderer.info.render.triangles;
  }
  setQuality(q: Quality) {
    this.state.quality = q;
    this.qualityAt = performance.now();
    this.world?.setQuality(q);
    this.matter?.setQuality(q);
    if (this.pilgrim) this.pilgrim.quality = q;
    this.relativity?.setQuality(q);
    this.glowStrength.value = q === "BATTERY" ? 0 : 0.15;
    this.resize();
  }
  benchmark(mode: string) {
    if (this.benchmarkMode === "NONE")
      this.beforeBenchmark = this.state.quality;
    this.benchmarkMode = mode;
    this.setQuality(this.beforeBenchmark);
    this.world.nebulaBoost = 1;
    if (mode === "PARTICLES") this.matter.setQuality("ULTRA");
    if (mode === "NEBULA") {
      this.world.nebulae.setQuality("ULTRA");
      this.world.nebulaBoost = 1.8;
    }
    if (mode === "ASTEROIDS") this.world.stressAsteroids();
  }
  inspect() {
    return {
      ...this.state,
      assetFallback: this.world.assetFallback,
      generatedSectors: this.world.generatedSectors,
      createdVisible: this.creation.stars.filter((s) => s.object.visible)
        .length,
      benchmark: this.benchmarkMode,
      computeSubmitMs: this.matter.computeMs,
      gpuRenderMs: this.gpuRenderMs,
      gpuComputeMs: this.gpuComputeMs,
      walkedDistance: this.walker.distance,
      walkEyeHeight: this.walker.eyeHeight,
      garden: this.world.approaches.inspectGarden(),
      gasSample: this.world.anomaly.weather.model.streams
        .slice(0, 3)
        .map((s) => [s.angle, s.radius, s.spread, s.heat]),
      orbitSample: Array.from(
        this.world.anomaly.experiment.model.positions.slice(0, 9),
      ),
      sanctuary: this.world.sanctuaries.active,
      stillness: this.world.sanctuaries.stillness,
      beautyEvent: this.world.sanctuaries.event,
      beautyEventTime: this.world.sanctuaries.eventTime,
      eventsSeen: this.world.sanctuaries.eventsSeen,
      livingParticles: this.world.sanctuaries.life.count,
      waterWakes: this.world.sanctuaries.sea.wakeCount,
      pilgrim: this.pilgrim.snapshot(),
      position: this.flight.position.toArray(),
      quaternion: this.flight.quaternion.toArray(),
      velocityVector: this.flight.velocity.toArray(),
      speed: this.flight.speed,
      mode: this.flight.mode,
      keys: [...this.input.keys],
      bodies: this.world.bodies.map((b) => {
        const p = b.object.position.clone().project(this.camera);
        return {
          id: b.id,
          x: (p.x * 0.5 + 0.5) * this.host.clientWidth,
          y: (-p.y * 0.5 + 0.5) * this.host.clientHeight,
          z: p.z,
        };
      }),
    };
  }
  private fail(s: string) {
    if (!this.disposed) {
      this.renderer?.setAnimationLoop(null);
      this.error(s);
    }
  }
  dispose() {
    this.disposed = true;
    this.renderer?.setAnimationLoop(null);
    this.controller.abort();
    this.resizeObserver?.disconnect();
    this.input?.dispose();
    this.audio.dispose();
    this.pilgrim?.dispose();
    this.world?.dispose();
    this.matter?.dispose();
    this.pipeline?.dispose();
    this.relativity?.dispose();
    const geometries = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>();
    this.scene.traverse((o) => {
      if (
        o instanceof T.Mesh ||
        o instanceof T.Points ||
        o instanceof T.LineSegments
      ) {
        geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materials.add(m);
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
