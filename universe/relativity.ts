import * as T from "three/webgpu";
import {
  Fn,
  If,
  Loop,
  Break,
  float,
  vec3,
  vec4,
  uniform,
  uv,
  texture,
  mix,
  smoothstep,
  mx_noise_float,
} from "three/tsl";
import {
  GR,
  freefallRadius,
  remainingProperTime,
  tidalEigenvalues,
  radialLightSlopes,
} from "./relativity-model";
import { QUALITY, type Quality } from "./config";
import type { AccretionWeather } from "./accretion";

/** An optional observation, not a second universe or a traversable wormhole. */
export class RelativityObservation {
  active = false;
  ended = false;
  radius = 6;
  properTime = 0;
  rate = 1;
  private initialRadius = 6;
  outward = new T.Vector3();
  returnPosition = new T.Vector3();
  returnQuaternion = new T.Quaternion();
  private r = uniform(6);
  private radial = uniform(new T.Vector3(0, 0, 1));
  private view = uniform(new T.Matrix3());
  private projection = uniform(new T.Vector2(1, 1));
  private normal = uniform(new T.Vector3(0, 1, 0));
  private axisX = uniform(new T.Vector3(1, 0, 0));
  private axisY = uniform(new T.Vector3(0, 1, 0));
  private material = new T.MeshBasicNodeMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  private target = new T.RenderTarget(640, 360, {
    type: T.HalfFloatType,
    depthBuffer: false,
  });
  private quad: T.QuadMesh;
  private display: T.RenderPipeline;
  private quality: Quality = "HIGH";
  constructor(
    private renderer: T.WebGPURenderer,
    diskRotation: T.Quaternion,
    weather: AccretionWeather,
  ) {
    this.normal.value.set(0, 0, 1).applyQuaternion(diskRotation);
    this.axisX.value.applyQuaternion(diskRotation);
    this.axisY.value.applyQuaternion(diskRotation);
    const acceleration = Fn(([p, l2]: [T.Node<"vec3">, T.Node<"float">]) =>
      p.mul(l2.mul(-1.5).div(p.length().pow(5).max(1e-12))),
    );
    this.material.colorNode = Fn(() => {
      const screen = uv().mul(2).sub(1);
      const sight = this.view
        .mul(vec3(screen.mul(this.projection), -1).normalize())
        .normalize()
        .toVar();
      const flow = this.r.reciprocal().sqrt();
      const energy = float(-1)
        .sub(flow.mul(sight.dot(this.radial)))
        .toVar();
      const p = this.radial.mul(this.r).toVar();
      const v = sight.add(this.radial.mul(flow)).toVar();
      const angular = p.cross(v).toVar(),
        l2 = angular.dot(angular).toVar();
      const radiance = vec3(0).toVar();
      // Numerical integration, identical RK4 and adaptive step to the CPU reference.
      Loop(GR.maxSteps, () => {
        const radius = p.length().toVar();
        If(radius.lessThan(GR.rayCutoff), () => {
          Break();
        });
        If(radius.greaterThan(GR.skyRadius), () => {
          If(energy.lessThan(0), () => {
            const direction = v.normalize();
            // Procedural emission sky. Geodesics and frequency transfer are physical;
            // colors, sources and photographic exposure are a designed illustration.
            const n = mx_noise_float(direction.mul(5)).mul(0.5).add(0.5);
            const lane = direction
              .dot(vec3(0.14, 0.94, 0.31).normalize())
              .add(n.sub(0.5).mul(0.2));
            const haze = lane.mul(8).pow(2).negate().exp().mul(n.pow(3));
            const clouds = mx_noise_float(direction.mul(24)).mul(0.5).add(0.5);
            const sky = mix(vec3(0.11, 0.2, 0.23), vec3(0.36, 0.24, 0.14), n)
              .mul(haze.mul(clouds).mul(0.7))
              .add(vec3(0.002, 0.004, 0.008));
            // 3D cellular star populations avoid longitude seams and pole artifacts.
            const stars = float(0).toVar();
            for (const scale of [95, 185]) {
              const q = direction.mul(scale),
                cell = q.floor();
              const hash = cell
                .dot(vec3(12.9898, 78.233, 37.719))
                .sin()
                .mul(43758.5453)
                .fract();
              const point = q.fract().sub(0.5).length();
              stars.addAssign(
                float(1)
                  .sub(smoothstep(0.015, 0.11, point))
                  .mul(smoothstep(0.8, 0.99, hash))
                  .mul(1.1),
              );
            }
            const g = energy.negate().reciprocal().clamp(0.05, 8);
            radiance.assign(
              sky
                .mul(0.35)
                .add(vec3(0.86, 0.91, 1).mul(stars))
                .mul(g.pow(4))
                .min(20),
            );
          });
          Break();
        });
        const h = radius
          .mul(GR.step)
          .div(
            v
              .length()
              .max(0.2)
              .max(l2.div(radius.pow(3)).sqrt().mul(2)),
          )
          .toVar();
        const a1 = acceleration(p, l2).toVar();
        const v2 = v.add(a1.mul(h.mul(0.5))).toVar();
        const a2 = acceleration(p.add(v.mul(h.mul(0.5))), l2).toVar();
        const v3 = v.add(a2.mul(h.mul(0.5))).toVar();
        const a3 = acceleration(p.add(v2.mul(h.mul(0.5))), l2).toVar();
        const v4 = v.add(a3.mul(h)).toVar();
        const a4 = acceleration(p.add(v3.mul(h)), l2).toVar();
        const next = p
          .add(v.add(v2.mul(2)).add(v3.mul(2)).add(v4).mul(h.div(6)))
          .toVar();
        // Opaque, geometrically thin disk. First crossing is the visible source.
        const side = p.dot(this.normal),
          nextSide = next.dot(this.normal);
        If(side.mul(nextSide).lessThan(0), () => {
          const intersection = mix(
            p,
            next,
            side.div(side.sub(nextSide)),
          ).toVar();
          const rd = intersection.length().toVar();
          If(rd.greaterThan(GR.isco).and(rd.lessThan(9)), () => {
            const omega = float(0.5).div(rd.pow(3)).sqrt();
            const g = float(1)
              .sub(float(1.5).div(rd))
              .sqrt()
              .div(energy.negate().add(omega.mul(angular.dot(this.normal))))
              .clamp(0.03, 8)
              .toVar();
            const emission = float(3)
              .div(rd)
              .pow(3)
              .mul(float(1).sub(float(3).div(rd).sqrt()))
              .mul(3);
            const bands = rd
              .mul(34)
              .sin()
              .mul(0.045)
              .add(rd.mul(15).sin().mul(0.04))
              .add(0.92);
            // Variable source brightness is illustrative, evaluated on a shared scene
            // clock, not retarded emission time. Photon paths remain Schwarzschild.
            const gas = weather.emission(
              rd,
              intersection.dot(this.axisY).atan(intersection.dot(this.axisX)),
            );
            const temp = float(3)
              .div(rd)
              .pow(0.75)
              .mul(g)
              .mul(0.72)
              .clamp(0, 1);
            const tint = mix(
              vec3(0.95, 0.22, 0.047),
              vec3(1, 0.89, 0.68),
              temp,
            );
            radiance.assign(
              tint
                .mul(emission)
                .mul(bands.add(gas.mul(2.1)))
                .mul(g.pow(4))
                .min(35),
            );
            Break();
          });
        });
        p.assign(next);
        v.addAssign(a1.add(a2.mul(2)).add(a3.mul(2)).add(a4).mul(h.div(6)));
      });
      return vec4(radiance, 1);
    })();
    this.quad = new T.QuadMesh(this.material);
    this.display = new T.RenderPipeline(renderer);
    this.display.outputNode = texture(this.target.texture);
  }
  async prepare() {
    const previous = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.target);
    const pending = this.renderer.compileAsync(this.quad, this.quad.camera);
    this.renderer.setRenderTarget(previous);
    await pending;
  }
  start(
    position: T.Vector3,
    quaternion: T.Quaternion,
    center: T.Vector3,
    scale: number,
  ) {
    this.returnPosition.copy(position);
    this.returnQuaternion.copy(quaternion);
    this.outward.copy(position).sub(center).normalize();
    this.radius = this.initialRadius = Math.max(
      2.4,
      Math.min(12, position.distanceTo(center) / scale),
    );
    this.properTime = 0;
    this.ended = false;
    this.active = true;
  }
  advance(dt: number) {
    if (!this.active || this.ended) return;
    // Presentation slows near the center; the displayed proper clock is authoritative.
    this.properTime += dt * 0.24 * this.rate * Math.min(1, this.radius ** 1.5);
    const end =
      remainingProperTime(this.initialRadius) -
      remainingProperTime(GR.observerCutoff);
    this.properTime = Math.min(this.properTime, end);
    this.radius = Math.max(
      GR.observerCutoff,
      freefallRadius(this.initialRadius, this.properTime),
    );
    this.ended = this.properTime >= end;
  }
  setQuality(quality: Quality) {
    this.quality = quality;
  }
  render(camera: T.PerspectiveCamera, width: number, height: number) {
    const cap = QUALITY[this.quality].relativityWidth;
    const w = Math.min(width, cap),
      h = Math.round((w * height) / width);
    if (this.target.width !== w || this.target.height !== h)
      this.target.setSize(w, h);
    this.r.value = this.radius;
    this.radial.value.copy(this.outward);
    this.view.value.setFromMatrix4(camera.matrixWorld);
    // A wide observer lens keeps both the dark region and the incoming sky in view.
    const tangent = Math.tan(T.MathUtils.degToRad(106 / 2));
    this.projection.value.set(camera.aspect * tangent, tangent);
    this.renderer.setRenderTarget(this.target);
    this.quad.render(this.renderer);
    this.renderer.setRenderTarget(null);
    this.display.render();
  }
  snapshot() {
    return {
      active: this.active,
      ended: this.ended,
      radius: this.radius,
      properTime: this.properTime,
      rate: this.rate,
      radialTide: tidalEigenvalues(this.radius)[0],
      outwardLight: radialLightSlopes(this.radius).outward,
    };
  }
  dispose() {
    this.target.dispose();
    this.material.dispose();
    this.display.dispose();
  }
}
