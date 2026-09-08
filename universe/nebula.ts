import * as T from "three/webgpu";
import {
  Fn,
  float,
  length,
  max,
  mix,
  pow,
  sin,
  smoothstep,
  texture3D,
  uniform,
  vec3,
  vec4,
  screenCoordinate,
} from "three/tsl";
import { RaymarchingBox } from "three/addons/tsl/utils/Raymarching.js";
import { QUALITY, seeded, type Quality } from "./config";
function noiseVolume() {
  const size = 96,
    data = new Uint8Array(size ** 3),
    random = seeded(246);
  const lattice = Float32Array.from({ length: 32 ** 3 }, () => random());
  // Every octave must tile at its own period. Repeating a nonperiodic volume
  // produces visible planar seams when the camera enters the cloud.
  const noise = (x: number, y: number, z: number, period: number) => {
    const ix = Math.floor(x),
      iy = Math.floor(y),
      iz = Math.floor(z);
    let u = x - ix,
      v = y - iy,
      w = z - iz;
    u = u * u * (3 - 2 * u);
    v = v * v * (3 - 2 * v);
    w = w * w * (3 - 2 * w);
    const h = (a: number, b: number, c: number) =>
      lattice[
        ((a + period) % period) +
          ((b + period) % period) * 32 +
          ((c + period) % period) * 1024
      ];
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    return lerp(
      lerp(
        lerp(h(ix, iy, iz), h(ix + 1, iy, iz), u),
        lerp(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), u),
        v,
      ),
      lerp(
        lerp(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), u),
        lerp(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), u),
        v,
      ),
      w,
    );
  };
  for (let z = 0; z < size; z++)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        let n = 0,
          amplitude = 0.58;
        for (let o = 0; o < 4; o++) {
          const f = (4 << o) / size;
          n += noise(x * f, y * f, z * f, 4 << o) * amplitude;
          amplitude *= 0.5;
        }
        data[x + y * size + z * size * size] = Math.min(255, n * 255);
      }
  const texture = new T.Data3DTexture(data, size, size, size);
  texture.format = T.RedFormat;
  texture.type = T.UnsignedByteType;
  texture.minFilter = T.LinearFilter;
  texture.magFilter = T.LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = T.RepeatWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}
export class NebulaLibrary {
  time = uniform(0);
  steps = uniform(32);
  density = uniform(1);
  texture = noiseVolume();
  private materials = new Map<number, T.MeshBasicNodeMaterial>();
  geometry = new T.BoxGeometry(1, 1, 1);
  create(palette = 0) {
    let material = this.materials.get(palette);
    if (!material) {
      material = new T.MeshBasicNodeMaterial({
        transparent: true,
        side: T.BackSide,
        depthWrite: false,
      });
      const dust = this.texture;
      material.colorNode = Fn(() => {
        const result = vec4(0).toVar();
        const jitter = sin(
          screenCoordinate.x.mul(12.9898).add(screenCoordinate.y.mul(78.233)),
        )
          .mul(43758.5453)
          .fract()
          .sub(0.5)
          .mul(0.06)
          .div(this.steps);
        RaymarchingBox(this.steps, ({ positionRay }) => {
          const p = positionRay.add(vec3(jitter));
          const n = texture3D(
            dust,
            p
              .mul(1.8)
              .add(0.5)
              .add(vec3(this.time.mul(0.0003), 0, 0)),
          ).r;
          const small = texture3D(dust, p.mul(5.5).add(0.25)).r;
          const envelope = float(1)
            .sub(smoothstep(0.28, 0.49, length(p.mul(vec3(0.9, 1.65, 1.3)))))
            .mul(
              float(1).sub(
                smoothstep(
                  0.38,
                  0.49,
                  max(p.x.abs(), max(p.y.abs(), p.z.abs())),
                ),
              ),
            );
          const filament = pow(
            max(
              0,
              float(1).sub(
                p.y
                  .sub(sin(p.x.mul(8).add(n.mul(3))).mul(0.13))
                  .abs()
                  .mul(5),
              ),
            ),
            1.5,
          );
          const wisps = texture3D(dust, p.mul(14).add(n.mul(0.4))).r;
          const d = pow(max(0, n.sub(0.38)), 1.4)
            .mul(smoothstep(0.25, 0.66, small))
            .mul(wisps.mul(0.75).add(0.25))
            .mul(envelope)
            .mul(filament.mul(0.8).add(0.12))
            .mul(3);
          const alpha = float(1).sub(
            d.mul(this.density).mul(14).div(this.steps).negate().exp(),
          );
          const warm = vec3(0.49, 0.31, 0.17),
            cool = vec3(0.08, 0.29, 0.32),
            red = vec3(0.45, 0.12, 0.065);
          const c = mix(
            palette === 1 ? red : warm,
            cool,
            smoothstep(-0.12, 0.3, p.x.add(n.mul(0.2))),
          ).mul(n.mul(1.4).add(0.15));
          const remaining = float(1).sub(result.a);
          result.rgb.addAssign(c.mul(alpha).mul(remaining));
          result.a.addAssign(alpha.mul(remaining));
        });
        return vec4(result.rgb.div(max(result.a, 0.001)), result.a);
      })();
      this.materials.set(palette, material);
    }
    const mesh = new T.Mesh(this.geometry, material);
    mesh.frustumCulled = false;
    return mesh;
  }
  setQuality(quality: Quality) {
    this.steps.value = QUALITY[quality].steps;
  }
  dispose() {
    this.texture.dispose();
  }
}
