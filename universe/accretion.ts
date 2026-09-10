import * as T from "three/webgpu";
import { float, uniformArray, vec4 } from "three/tsl";
import { AccretionModel } from "./accretion-model";

/** One persistent gas state drives the illustrative exterior and the optional GR source. */
export class AccretionWeather {
  model = new AccretionModel();
  private values = Array.from({ length: 8 }, () => new T.Vector4());
  private sources = uniformArray(this.values, "vec4");
  private positions = new Float32Array(8 * 48 * 7 * 6);
  private colors = new Float32Array(this.positions.length);
  private geometry = new T.BufferGeometry();
  private lines: T.LineSegments;
  constructor(root: T.Group) {
    this.geometry.setAttribute(
      "position",
      new T.BufferAttribute(this.positions, 3).setUsage(T.DynamicDrawUsage),
    );
    this.geometry.setAttribute(
      "color",
      new T.BufferAttribute(this.colors, 3).setUsage(T.DynamicDrawUsage),
    );
    this.lines = new T.LineSegments(
      this.geometry,
      new T.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    this.lines.frustumCulled = false;
    root.add(this.lines);
    this.update(0);
  }
  emission(radius: T.Node<"float">, angle: T.Node<"float">) {
    let light: T.Node<"float"> = float(0);
    for (let i = 0; i < 8; i++) {
      const s = vec4(this.sources.element(i));
      const angular = angle.sub(s.x).cos().sub(1).div(s.z.pow(2)).exp();
      const radial = radius
        .sub(s.y)
        .div(s.z.mul(0.5).add(0.35))
        .pow(2)
        .negate()
        .exp();
      light = light.add(angular.mul(radial).mul(s.w));
    }
    return light;
  }
  update(dt: number) {
    this.model.update(dt);
    let cursor = 0;
    this.model.streams.forEach((s, i) => {
      this.values[i].set(s.angle, s.radius, s.spread, s.heat);
      for (const p of s.parcels)
        if (p.alive) {
          for (let j = 0; j < 7; j++)
            for (let end = 0; end < 2; end++) {
              const k = (j + end) * 2;
              // Exterior is an art-directed scale: GR disk 3–9 maps to 1.2–4.8.
              const r = Math.hypot(p.trail[k], p.trail[k + 1]),
                scale = (1.2 + (r - 3) * 0.6) / Math.max(1e-6, r);
              this.positions[cursor] = p.trail[k] * scale;
              this.positions[cursor + 1] = p.trail[k + 1] * scale;
              this.positions[cursor + 2] =
                0.016 + Math.sin(i + this.model.time * 0.2) * 0.012;
              const gain = (1 - j / 7) * p.heat * Math.min(1, s.age / 1.8);
              this.colors[cursor] = gain * 1.9;
              this.colors[cursor + 1] = gain * 0.86;
              this.colors[cursor + 2] = gain * 0.32;
              cursor += 3;
            }
        }
    });
    this.geometry.setDrawRange(0, cursor / 3);
    this.lines.visible = cursor > 0;
    this.geometry.attributes.position.needsUpdate =
      this.geometry.attributes.color.needsUpdate = true;
  }
}
