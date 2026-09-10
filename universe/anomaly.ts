import * as T from "three/webgpu";
import { color, float, length, max, mix, mx_noise_float, positionLocal,
  pow, sin, smoothstep, uniform, uv, vec3 } from "three/tsl";
import { OrbitExperiment } from "./orbit-experiment";
import { AccretionWeather } from "./accretion";
import type { Quality } from "./config";
import { stellarImages } from "./cosmic-motion";

/** Fast qualitative exterior optics, independent of the exact GR observation. */
export class GravitationalAnomaly {
  group = new T.Group();
  time = uniform(0);
  experiment = new OrbitExperiment();
  private response = uniform(0);
  // Fixed plane: the normal Orpheus-to-Wound approach sees ~9.5 degrees
  // above the disk, without changing the flight/arrival coordinate contract.
  diskRotation = new T.Quaternion().setFromEuler(new T.Euler(1.1, 0.12, 0.21));
  weather: AccretionWeather;
  private lens: T.Mesh;
  private view = uniform(new T.Vector3(0, 0, 1));
  private inclination = uniform(1);
  private sourceAngle = uniform(0);
  private detail = uniform(1);
  private center = new T.Vector3();
  private eye = new T.Vector3();
  private normal = new T.Vector3();
  private tangent = new T.Vector3();
  private inverse = new T.Quaternion();
  private roll = new T.Quaternion();
  private axis = new T.Vector3(0, 0, 1);
  private starPositions = new Float32Array(96 * 2 * 3);
  private starColors = new Float32Array(96 * 2 * 3);
  private stars: T.Points;
  private starGeometry = new T.BufferGeometry();
  private starScratch = new T.Vector3();
  private starCount = 96;
  constructor() {
    const gas = new T.Group();
    gas.quaternion.copy(this.diskRotation);
    this.weather = new AccretionWeather(gas);
    this.group.add(gas);
    // Unit sphere is the exterior apparent shadow proxy, NOT the horizon.
    this.group.add(new T.Mesh(new T.SphereGeometry(1, 64, 40),
      new T.MeshBasicMaterial({ color: 0x000000 })));
    const material = new T.MeshBasicNodeMaterial({ transparent: true,
      depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending });
    const r = length(positionLocal.xy), angle = positionLocal.y.atan(positionLocal.x);
    material.colorNode = this.emission(r, angle);
    material.opacityNode = smoothstep(1.16, 1.36, r)
      .mul(float(1).sub(smoothstep(2.0, 4.8, r))).mul(0.88);
    const disk = new T.Mesh(new T.RingGeometry(1.12, 4.8, 192, 1), material);
    disk.quaternion.copy(this.diskRotation);
    this.group.add(disk);
    this.experiment.group.quaternion.copy(this.diskRotation);
    this.group.add(this.experiment.group);

    const lensMaterial = new T.MeshBasicNodeMaterial({ transparent: true,
      depthWrite: false, blending: T.AdditiveBlending });
    const u = uv().sub(0.5).mul(6), d = length(u);
    const a = u.y.atan(u.x);
    // Compressed repeated disk images: an explicit image-space approximation.
    // Broader upper image at grazing incidence; both collapse toward the rim face-on.
    const edge = float(1).sub(this.inclination);
    const upperWidth = edge.mul(0.48).add(0.10);
    const lowerWidth = edge.mul(0.17).add(0.055);
    const upperR = d.sub(1.035).div(upperWidth);
    const lowerR = d.sub(1.025).div(lowerWidth);
    const upper = smoothstep(0, 0.10, upperR)
      .mul(float(1).sub(smoothstep(0.55, 1, upperR)))
      .mul(smoothstep(-0.06, 0.18, u.y));
    const lower = smoothstep(0, 0.10, lowerR)
      .mul(float(1).sub(smoothstep(0.55, 1, lowerR)))
      .mul(float(1).sub(smoothstep(-0.18, 0.06, u.y)));
    const upperEmission = this.emission(max(1.2, upperR.mul(3.6).add(1.2)), a.add(this.sourceAngle));
    const lowerEmission = this.emission(max(1.2, lowerR.mul(3.6).add(1.2)), a.negate().add(this.sourceAngle));
    const critical = pow(max(0, float(1).sub(d.sub(1.017).abs().mul(100))), 2);
    lensMaterial.colorNode = upperEmission.mul(upper).mul(0.8)
      .add(lowerEmission.mul(lower).mul(0.48))
      .add(color(0xffd6a6).mul(critical).mul(0.65));
    lensMaterial.opacityNode = smoothstep(1.002, 1.012, d);
    this.lens = new T.Mesh(new T.PlaneGeometry(6, 6), lensMaterial);
    this.group.add(this.lens);

    // A bounded supplemental source catalogue; it does not sample the main starfield.
    this.starGeometry.setAttribute("position", new T.BufferAttribute(this.starPositions, 3).setUsage(T.DynamicDrawUsage));
    this.starGeometry.setAttribute("color", new T.BufferAttribute(this.starColors, 3).setUsage(T.DynamicDrawUsage));
    this.stars = new T.Points(this.starGeometry, new T.PointsMaterial({
      size: 2, sizeAttenuation: false, vertexColors: true, transparent: true,
      depthWrite: false, blending: T.AdditiveBlending }));
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
  }
  private emission(radius: T.Node<"float">, angle: T.Node<"float">) {
    const r = max(3, radius.sub(1.2).div(0.6).add(3));
    // Keplerian differential angular velocity, accelerated for presentation.
    const phase = angle.sub(this.time.mul(1.4).mul(pow(float(3).div(r), 1.5)));
    const threads = sin(radius.mul(62).add(sin(phase.mul(3)).mul(3)))
      .mul(0.09).add(0.72);
    const structure = mx_noise_float(vec3(phase.cos().mul(7), phase.sin().mul(7), r.mul(2.3)))
      .mul(0.5).add(0.68);
    const heat = pow(max(0, float(1).sub(radius.sub(1.2).div(3.6))), 2.2);
    // Circular-emitter speed in a static Schwarzschild frame; straight outgoing
    // direction approximation (the image warp is NOT a geodesic transfer).
    const beta = float(1).div(r.sub(1).mul(2)).sqrt();
    const toward = angle.sin().negate().mul(this.view.x).add(angle.cos().mul(this.view.y));
    const g = float(1).sub(float(1).div(r)).sqrt()
      .mul(float(1).sub(beta.mul(beta)).sqrt())
      .div(max(0.3, float(1).sub(beta.mul(toward))));
    const gain = g.pow(4).clamp(0.18, 3.2);
    return mix(color(0x9d3612), color(0xffd6a8), heat)
      .mul(heat.mul(1.6).add(0.14)).mul(threads)
      .mul(mix(float(0.8), structure, this.detail)).mul(gain)
      .mul(this.response.mul(0.13).add(1))
      .add(color(0xffbc7c).mul(this.weather.emission(r, angle)).mul(gain).mul(0.85));
  }
  setQuality(quality: Quality) {
    this.detail.value = quality === "BATTERY" ? 0 : 1;
    this.starCount = quality === "BATTERY" ? 24 : quality === "BALANCED" ? 48 : 96;
  }
  inspect() {
    return { time: this.time.value, gasTime: this.weather.model.time,
      inclination: this.inclination.value, view: this.view.value.toArray(),
      stellarImages: this.starGeometry.drawRange.count, starBudget: this.starCount };
  }
  update(time: number, camera: T.Camera) {
    this.time.value = Number.isFinite(time) ? time : 0;
    this.group.updateWorldMatrix(true, false);
    this.group.getWorldPosition(this.center);
    this.eye.copy(camera.position).sub(this.center);
    const distance = this.eye.length();
    this.normal.set(0, 0, 1).applyQuaternion(this.diskRotation);
    this.inclination.value = Math.abs(this.normal.dot(this.eye) / Math.max(1e-8, distance));
    this.view.value.copy(this.eye).normalize().applyQuaternion(this.inverse.copy(this.diskRotation).invert());
    this.inverse.copy(camera.quaternion).invert();
    this.normal.applyQuaternion(this.inverse);
    const roll = Math.atan2(-this.normal.x, this.normal.y);
    this.lens.quaternion.copy(camera.quaternion).multiply(this.roll.setFromAxisAngle(this.axis, roll));
    this.tangent.set(1, 0, 0).applyQuaternion(this.lens.quaternion)
      .applyQuaternion(this.inverse.copy(this.diskRotation).invert());
    this.sourceAngle.value = Math.atan2(this.tangent.y, this.tangent.x);
    // Project fixed distant sources into the observer's local lens plane.
    // Thin-lens approximation only outside the shadow; occult inner images.
    const scale = this.group.matrixWorld.elements[0] ** 2 + this.group.matrixWorld.elements[1] ** 2 + this.group.matrixWorld.elements[2] ** 2;
    const bodyScale = Math.sqrt(scale);
    this.eye.divideScalar(Math.max(1e-8, bodyScale));
    this.inverse.copy(camera.quaternion).invert();
    this.tangent.copy(this.eye).negate().applyQuaternion(this.inverse);
    const lensDepth = -this.tangent.z;
    const centerX = this.tangent.x / Math.max(1e-8, lensDepth);
    const centerY = this.tangent.y / Math.max(1e-8, lensDepth);
    let count = 0;
    for (let i = 0; i < this.starCount && lensDepth > 0; i++) {
      const source = i * (96 / this.starCount);
      const z = 1 - 2 * (source + 0.5) / 96, a = source * 2.39996;
      const radial = Math.sqrt(1 - z * z);
      this.starScratch.set(Math.cos(a) * radial, z, Math.sin(a) * radial).multiplyScalar(80);
      // Only sources on the far side of the lens contribute.
      if (this.starScratch.dot(this.eye) >= 0) continue;
      this.starScratch.sub(this.eye).applyQuaternion(this.inverse);
      if (this.starScratch.z >= -0.01) continue;
      const x = (this.starScratch.x / -this.starScratch.z - centerX) * lensDepth;
      const y = (this.starScratch.y / -this.starScratch.z - centerY) * lensDepth;
      const b = Math.hypot(x, y), einstein = 1.65;
      if (b < 0.001 || b > 5) continue;
      const images = stellarImages(b / einstein);
      for (const theta of [images.positive, images.negative]) {
        const radius = theta * einstein;
        if (Math.abs(radius) < 1.025 || Math.abs(radius) > 5.5) continue;
        this.starScratch.set(x / b * radius, y / b * radius, 0)
          .applyQuaternion(camera.quaternion);
        this.starScratch.toArray(this.starPositions, count * 3);
        const brightness = theta < 0 ? 0.35 : 0.85;
        this.starColors.set([brightness * 0.8, brightness * 0.9, brightness], count * 3);
        count++;
      }
    }
    this.starGeometry.setDrawRange(0, count);
    this.stars.visible = count > 0;
    this.starGeometry.attributes.position.needsUpdate = true;
    this.starGeometry.attributes.color.needsUpdate = true;
  }
  simulate(dt: number) {
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
    if (step === 0) return;
    this.experiment.update(step);
    this.weather.update(step);
    this.response.value = Math.min(1, this.response.value * Math.exp(-step * 1.7) +
      this.experiment.model.capturesThisStep * 0.06);
  }
}
