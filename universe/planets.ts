import * as T from "three/webgpu";
import {
  Fn,
  cameraPosition,
  color,
  float,
  length,
  max,
  mix,
  mx_noise_float,
  normalWorld,
  normalView,
  positionLocal,
  positionWorld,
  positionView,
  modelScale,
  pow,
  sin,
  smoothstep,
  uniform,
  vec3,
  dFdx,
  dFdy,
} from "three/tsl";
const sunDirection = vec3(-0.82, 0.38, 0.43).normalize();
// UV bumpMap() cannot differentiate position-based noise. Use actual screen derivatives.
function reliefNormal(height: T.Node<"float">) {
  return Fn(() => {
    const h = height.mul(modelScale.x),
      dx = positionView.dFdx(),
      dy = positionView.dFdy();
    const a = dy.cross(normalView),
      b = normalView.cross(dx),
      det = dx.dot(a);
    const gradient = a
      .mul(dFdx(vec3(h)).x)
      .add(b.mul(dFdy(vec3(h)).x))
      .mul(det.sign());
    return normalView.mul(det.abs()).sub(gradient).normalize();
  })();
}
export class PlanetLibrary {
  time = uniform(0);
  private surfaces = new Map<number, T.Material>();
  private clouds = new Map<number, T.Material>();
  private atmospheres = new Map<number, T.Material>();
  private auroraMaterial?: T.MeshBasicNodeMaterial;
  private ringMaterial?: T.MeshBasicNodeMaterial;
  private ringGeometry = new T.RingGeometry(1.28, 2.62, 200);
  geometries = [
    new T.SphereGeometry(1, 192, 128),
    new T.SphereGeometry(1, 72, 48),
    new T.SphereGeometry(1, 28, 20),
  ];
  private surface(kind: number) {
    if (this.surfaces.has(kind)) return this.surfaces.get(kind)!;
    const material = new T.MeshStandardNodeMaterial({
      roughness: 0.82,
      metalness: 0.015,
    });
    const p = positionLocal.normalize();
    const living = kind === 0 || kind === 10;
    const q = p.mul(3.6).add(vec3(kind * 13.7, 1.3, 3.1));
    const base = mx_noise_float(q)
      .add(mx_noise_float(q.mul(2.7)).mul(0.32))
      .add(mx_noise_float(q.mul(8.1)).mul(0.11))
      .add(mx_noise_float(q.mul(25)).mul(0.028));
    const land = smoothstep(-0.025, 0.045, base);
    const frost = smoothstep(
      0.72,
      0.96,
      p.y.abs().add(mx_noise_float(p.mul(12)).mul(0.07)),
    );
    const variation = mx_noise_float(p.mul(34)).mul(0.5).add(0.5);
    const fine = mx_noise_float(p.mul(260)).add(
      mx_noise_float(p.mul(840)).mul(0.3),
    );
    const ocean = mix(
      color(0x031c30),
      color(0x117482),
      smoothstep(-0.4, 0.055, base),
    );
    const ground = mix(
      color(0x132d27),
      color(0x697561),
      smoothstep(0.04, 0.62, base).mul(0.8).add(variation.mul(0.2)),
    );
    let albedo = mix(mix(ocean, ground, land), color(0xc8d2c8), frost);
    let relief = max(base, 0).mul(0.004);
    let detailRelief = base
      .mul(0.002)
      .add(
        mx_noise_float(p.mul(75)).mul(
          living ? land.mul(0.0012).add(0.000018) : float(0.0005),
        ),
      );
    if (kind === 1) {
      const wind = vec3(
        this.time.mul(0.007).mul(p.y.sin()),
        0,
        this.time.mul(0.002),
      );
      const warp = mx_noise_float(p.mul(7).add(wind))
        .mul(0.1)
        .add(mx_noise_float(p.mul(24)).mul(0.018));
      const bands = sin(p.y.add(warp.mul(0.4)).mul(46))
        .mul(0.5)
        .add(0.5);
      const storm = mx_noise_float(p.mul(vec3(18, 4, 18)))
        .mul(0.5)
        .add(0.5);
      albedo = mix(
        color(0x727d7e),
        color(0xc1c9bd),
        bands.mul(0.38).add(storm.mul(0.27)).add(0.16),
      );
      relief = float(0);
    } else if (kind === 2) {
      let basins: T.Node<"float"> = float(0);
      for (const [x, y, z, size] of [
        [0.7, 0.45, 0.5, 0.16],
        [-0.65, 0.2, 0.72, 0.21],
        [0.15, -0.7, 0.68, 0.12],
        [-0.35, 0.85, -0.38, 0.17],
        [0.8, -0.4, -0.45, 0.11],
        [-0.6, -0.6, -0.52, 0.19],
        [0.2, 0.3, -0.93, 0.22],
        [0.43, 0.82, 0.38, 0.06],
        [0.86, 0.18, 0.44, 0.065],
      ]) {
        const d = length(p.sub(vec3(x, y, z).normalize())).div(size);
        const bowl = float(1)
          .sub(smoothstep(0.05, 0.86, d))
          .mul(-0.006);
        const rim = pow(max(0, float(1).sub(d.sub(0.88).abs().mul(8))), 2).mul(
          0.003,
        );
        basins = basins.add(bowl).add(rim);
      }
      const fractures = float(1).sub(
        smoothstep(
          0.009,
          0.023,
          mx_noise_float(p.mul(14))
            .add(mx_noise_float(p.mul(85)).mul(0.13))
            .abs(),
        ),
      );
      albedo = mix(
        color(0x405e70),
        color(0xc5d4d1),
        variation.mul(0.5).add(base.mul(0.5)).add(0.25),
      )
        .mul(fractures.mul(-0.16).add(1))
        .mul(basins.mul(28).add(1));
      relief = base.mul(0.0015).add(basins);
      detailRelief = relief.add(fractures.mul(-0.00025)).add(fine.mul(0.00006));
    } else if (kind === 6) {
      const cracks = pow(
        float(1).sub(smoothstep(0.015, 0.055, mx_noise_float(p.mul(25)).abs())),
        2,
      );
      albedo = mix(color(0x0c1012), color(0x5e4635), variation);
      material.emissiveNode = color(0xfc4d0c)
        .mul(cracks)
        .mul(smoothstep(-0.08, 0.3, base))
        .mul(
          sin(this.time.mul(0.35).add(base.mul(19)))
            .mul(0.2)
            .add(1.9),
        );
      relief = max(base, 0).mul(0.009);
      detailRelief = relief.mul(0.4).add(cracks.mul(-0.0008));
    } else if (kind === 9) {
      const basin = smoothstep(-0.3, -0.14, base);
      const dunes = sin(
        p.y
          .mul(210)
          .add(mx_noise_float(p.mul(11)).mul(24))
          .add(p.x.mul(70)),
      )
        .mul(0.5)
        .add(0.5);
      const strata = sin(base.mul(145)).mul(0.08).add(0.88);
      albedo = mix(
        color(0xc9c6ab),
        mix(
          color(0x8c5940),
          color(0xd1ac76),
          variation.mul(0.6).add(dunes.mul(0.22)),
        ),
        basin,
      ).mul(strata);
      relief = max(base, -0.14).mul(0.008).add(dunes.mul(basin).mul(0.00012));
      detailRelief = relief
        .mul(0.4)
        .add(dunes.mul(0.00024))
        .add(fine.mul(0.00004));
    } else if (kind === 10) {
      albedo = mix(
        mix(color(0x042b30), color(0x277767), smoothstep(-0.35, 0.08, base)),
        mix(color(0x102e21), color(0x769680), variation),
        land,
      );
      albedo = mix(albedo, color(0xd0e4da), frost);
    } else if (kind === 8) {
      // The sanctuary ocean is the north cap of this same sphere. Its local
      // reflection mesh recedes gradually into this continuous far surface.
      albedo = mix(color(0x061e28), color(0x123d49), variation.mul(0.45));
      relief = float(0);
    }
    const surfaceDetail = mx_noise_float(p.mul(160))
      .mul(0.1)
      .add(mx_noise_float(p.mul(490)).mul(0.035));
    material.colorNode = albedo.mul(
      surfaceDetail.mul(living ? land : float(0.5)).add(1),
    );
    material.positionNode = positionLocal.mul(float(1).add(relief));
    material.normalNode =
      kind === 1 || kind === 8 ? normalView : reliefNormal(detailRelief);
    material.roughnessNode = living ? mix(0.23, 0.87, land) : float(0.87);
    if (living) {
      const night = float(1).sub(
        smoothstep(-0.15, 0.22, normalWorld.dot(sunDirection)),
      );
      const coasts = float(1).sub(smoothstep(0.012, 0.07, base.abs()));
      const organisms = smoothstep(0.21, 0.42, mx_noise_float(p.mul(340))).mul(
        coasts,
      );
      material.emissiveNode = color(0x52cc9e)
        .mul(organisms)
        .mul(night)
        .mul(
          kind === 10
            ? sin(this.time.mul(0.23).sub(base.mul(17)))
                .mul(0.3)
                .add(1.45)
            : float(0.9),
        );
    }
    this.surfaces.set(kind, material);
    return material;
  }
  create(kind: number) {
    const group = new T.Group();
    const lod = new T.LOD();
    for (let i = 0; i < 3; i++)
      lod.addLevel(
        new T.Mesh(this.geometries[i], this.surface(kind)),
        [0, 7, 30][i],
      );
    // Distances are selected explicitly in body units; world LOD defaults are unsuitable.
    lod.autoUpdate = false;
    group.add(lod);
    group.userData.lod = lod;
    if ([0, 1, 2, 6, 8, 9, 10].includes(kind)) {
      let atmo = this.atmospheres.get(kind);
      if (!atmo) {
        const m = new T.MeshBasicNodeMaterial({
          transparent: true,
          side: T.FrontSide,
          depthWrite: false,
          blending: T.AdditiveBlending,
        });
        const rim = pow(
          float(1).sub(
            normalWorld
              .dot(cameraPosition.sub(positionWorld).normalize())
              .abs(),
          ),
          3.2,
        );
        const day = smoothstep(-0.3, 0.6, normalWorld.dot(sunDirection));
        m.colorNode =
          kind === 0 || kind === 8 || kind === 10
            ? mix(color(0x165d91), color(0x6eb7bd), day)
            : kind === 1
              ? color(0xa9a393)
              : kind === 2
                ? color(0x8babb4)
                : kind === 9
                  ? color(0xc7a37a)
                  : color(0x873913);
        m.opacityNode = rim.mul(day.mul(kind === 2 ? 0.08 : 0.27).add(0.04));
        atmo = m;
        this.atmospheres.set(kind, m);
      }
      const shell = new T.Mesh(this.geometries[0], atmo);
      shell.scale.setScalar(1.009);
      shell.renderOrder = 3;
      group.add(shell);
    }
    if (kind === 0 || kind === 10) {
      let material = this.clouds.get(kind);
      if (!material) {
        const m = new T.MeshStandardNodeMaterial({
          transparent: true,
          depthWrite: false,
          roughness: 1,
        });
        const p = positionLocal.normalize(),
          q = p.mul(6.5);
        const warp = mx_noise_float(q.add(vec3(this.time.mul(0.003), 0, 0)));
        const cloud = mx_noise_float(q.add(warp.mul(0.65)))
          .add(mx_noise_float(q.mul(3).add(warp)).mul(0.38))
          .add(mx_noise_float(q.mul(11).add(warp)).mul(0.32))
          .add(mx_noise_float(q.mul(35)).mul(0.12));
        m.colorNode = mix(
          color(0x788d98),
          color(0xe4e8df),
          smoothstep(0.0, 0.6, cloud),
        );
        m.opacityNode = (kind === 10 ? smoothstep(0.06, 0.43, cloud).mul(0.7) : smoothstep(0.18, 0.3, cloud).mul(0.8));
        m.normalNode = reliefNormal(cloud.mul(0.00035));
        material = m;
        this.clouds.set(kind, m);
      }
      const clouds = new T.Mesh(this.geometries[0], material);
      clouds.scale.setScalar(1.004);
      group.add(clouds);
      if (!this.auroraMaterial) {
        const aurora = new T.MeshBasicNodeMaterial({
          transparent: true,
          depthWrite: false,
          blending: T.AdditiveBlending,
          side: T.DoubleSide,
        });
        const p = positionLocal.normalize(),
          longitude = p.z.atan(p.x);
        const wave = sin(longitude.mul(11).add(this.time.mul(0.025))).mul(
          0.035,
        );
        const band = pow(
          max(0, float(1).sub(p.y.abs().sub(0.78).add(wave).abs().mul(35))),
          2,
        );
        const threads = sin(longitude.mul(260).add(this.time.mul(0.09)))
          .mul(0.25)
          .add(0.75);
        const night = float(1).sub(
          smoothstep(-0.05, 0.3, normalWorld.dot(sunDirection)),
        );
        aurora.colorNode = mix(color(0x398b77), color(0x92b5a6), p.y.abs());
        aurora.opacityNode = band.mul(threads).mul(night).mul(0.35);
        this.auroraMaterial = aurora;
      }
      const a = new T.Mesh(this.geometries[1], this.auroraMaterial);
      a.scale.setScalar(1.019);
      group.add(a);
    }
    if (kind === 1) {
      if (!this.ringMaterial) {
        const ringMaterial = new T.MeshBasicNodeMaterial({
          transparent: true,
          depthWrite: false,
          side: T.DoubleSide,
        });
        const radius = length(positionLocal.xy);
        const grain = sin(radius.mul(180))
          .mul(0.07)
          .add(sin(radius.mul(67)).mul(0.12))
          .add(0.55);
        const gap = smoothstep(0.024, 0.052, radius.sub(1.82).abs());
        ringMaterial.colorNode = mix(color(0x5d584c), color(0xb8afa0), grain);
        ringMaterial.opacityNode = grain
          .mul(gap)
          .mul(0.75)
          .mul(smoothstep(1.28, 1.38, radius))
          .mul(float(1).sub(smoothstep(2.4, 2.62, radius)));
        this.ringMaterial = ringMaterial;
      }
      const rings = new T.Mesh(this.ringGeometry, this.ringMaterial);
      rings.rotation.set(-1.02, 0.14, -0.21);
      group.add(rings);
    }
    return group;
  }
  update(group: T.Group, distanceInRadii: number) {
    const lod = group.userData.lod as T.LOD | undefined;
    if (lod)
      lod.levels.forEach((level, i) => {
        level.object.visible =
          i === (distanceInRadii < 7 ? 0 : distanceInRadii < 30 ? 1 : 2);
      });
  }
}
