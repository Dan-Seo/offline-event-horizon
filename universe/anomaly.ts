import * as T from "three/webgpu";
import {
  color,
  float,
  length,
  max,
  mix,
  mx_noise_float,
  positionLocal,
  pow,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import { OrbitExperiment } from "./orbit-experiment";
export class GravitationalAnomaly {
  group = new T.Group();
  time = uniform(0);
  experiment = new OrbitExperiment();
  private response = uniform(0);
  diskRotation = new T.Quaternion().setFromEuler(new T.Euler(-1.1, 0.12, 0.21));
  private lens: T.Mesh;
  constructor() {
    const shadow = new T.Mesh(
      new T.SphereGeometry(1, 96, 64),
      new T.MeshBasicMaterial({ color: 0x000001 }),
    );
    this.group.add(shadow);
    const material = new T.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      blending: T.AdditiveBlending,
    });
    const p = positionLocal,
      r = length(p.xy),
      angle = p.y.atan(p.x);
    const ripple = sin(
      r
        .mul(125)
        .sub(this.time.mul(1.8))
        .add(sin(angle.mul(9).add(this.time.mul(0.3))).mul(2)),
    )
      .mul(0.13)
      .add(0.82);
    const turbulence = mx_noise_float(
      vec3(r.mul(9), sin(angle.mul(3)).mul(2), this.time.mul(0.05)),
    )
      .mul(0.25)
      .add(0.8);
    const inner = smoothstep(1.16, 1.48, r),
      outer = float(1).sub(smoothstep(1.65, 4.8, r));
    const heat = pow(max(0, float(1).sub(r.sub(1.3).div(3.4))), 2);
    material.colorNode = mix(color(0x97431d), color(0xffe5b4), heat)
      .mul(heat.mul(2.8).add(0.25))
      .mul(p.x.div(5).mul(0.5).add(0.75))
      .mul(this.response.mul(0.13).add(1));
    material.opacityNode = inner
      .mul(outer)
      .mul(ripple)
      .mul(turbulence)
      .mul(0.9);
    const disk = new T.Mesh(new T.RingGeometry(1.12, 4.8, 220, 1), material);
    disk.rotation.x = -1.1;
    disk.rotation.y = 0.12;
    disk.rotation.z = 0.21;
    this.group.add(disk);
    this.experiment.group.quaternion.copy(this.diskRotation);
    this.group.add(this.experiment.group);
    const lensMaterial = new T.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    const u = uv().sub(0.5).mul(6),
      d = length(u);
    const ring = pow(max(0, float(1).sub(d.sub(1.025).abs().mul(45))), 2);
    const highArc = pow(
      max(
        0,
        float(1).sub(
          length(vec2(u.x, u.y.mul(0.96)))
            .sub(1.035)
            .abs()
            .mul(22),
        ),
      ),
      2,
    ).mul(smoothstep(-0.05, 0.55, u.y));
    const lowerArc = pow(
      max(
        0,
        float(1).sub(
          length(vec2(u.x, u.y.mul(1.18)))
            .sub(1.08)
            .abs()
            .mul(18),
        ),
      ),
      2,
    ).mul(smoothstep(0.1, -0.5, u.y));
    lensMaterial.colorNode = color(0xffd49b).mul(2.2);
    lensMaterial.opacityNode = ring
      .mul(0.88)
      .add(highArc.mul(0.42))
      .add(lowerArc.mul(0.17));
    this.lens = new T.Mesh(new T.PlaneGeometry(6, 6), lensMaterial);
    this.lens.position.z = 0.02;
    this.group.add(this.lens);
  }
  update(time: number, camera: T.Camera) {
    this.time.value = time;
    this.lens.quaternion.copy(camera.quaternion);
  }
  simulate(dt: number) {
    this.experiment.update(dt);
    this.response.value = Math.min(
      1,
      this.response.value * Math.exp(-dt * 1.7) +
        this.experiment.model.capturesThisStep * 0.06,
    );
  }
}
