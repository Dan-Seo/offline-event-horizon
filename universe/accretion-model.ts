/** Physics-inspired dissipative test parcels. This is not relativistic plasma/MHD. */
export type GasParcel = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heat: number;
  alive: boolean;
  trail: number[];
};
export type GasStream = {
  age: number;
  parcels: GasParcel[];
  angle: number;
  radius: number;
  spread: number;
  heat: number;
};
export class AccretionModel {
  readonly streams: GasStream[] = [];
  time = 0;
  released = 0;
  absorbed = 0;
  private accumulator = 0;
  private historyStep = 0;
  private nextEvent = 23;
  private cursor = 0;
  constructor() {
    for (let i = 0; i < 8; i++)
      this.streams.push({
        age: 100,
        parcels: [],
        angle: 0,
        radius: 7,
        spread: 0.1,
        heat: 0,
      });
    this.release(0.8);
    this.release(3.5);
  }
  release(angle = this.time * 0.19 + this.released * 2.39996) {
    const stream = this.streams[this.cursor];
    this.cursor = (this.cursor + 1) % 8;
    const variation = Math.sin(this.released * 5.71);
    stream.age = 0;
    stream.parcels = Array.from({ length: 48 }, (_, i) => {
      const theta = angle + (i / 47 - 0.5) * 0.35;
      const r = 6.2 + (i / 47) * 1.2 + Math.sin(i * 8.37) * 0.12;
      const tangent = Math.sqrt(5 / r) * (0.77 + variation * 0.06);
      const radial = -0.1 - 0.025 * Math.cos(i * 1.7);
      const x = Math.cos(theta) * r,
        y = Math.sin(theta) * r;
      return {
        x,
        y,
        vx: -Math.sin(theta) * tangent + Math.cos(theta) * radial,
        vy: Math.cos(theta) * tangent + Math.sin(theta) * radial,
        heat: 0.45,
        alive: true,
        trail: Array.from({ length: 16 }, (_, j) => (j % 2 ? y : x)),
      };
    });
    this.released++;
    this.measure();
  }
  update(dt: number) {
    this.accumulator += Math.min(0.1, Math.max(0, dt));
    const h = 1 / 120;
    while (this.accumulator + 1e-10 >= h) {
      this.accumulator -= h;
      this.time += h;
      if (this.time >= this.nextEvent) {
        this.release();
        this.nextEvent =
          this.time + 22 + 11 * (0.5 + Math.sin(this.released * 6.1) * 0.5);
      }
      const remember = ++this.historyStep % 8 === 0;
      for (const stream of this.streams) {
        stream.age += h;
        for (const p of stream.parcels) {
          if (!p.alive) continue;
          const r2 = p.x * p.x + p.y * p.y,
            r = Math.sqrt(r2);
          if (r < 2.85 || r > 11 || stream.age > 85) {
            p.alive = false;
            if (r < 2.85) this.absorbed++;
            continue;
          }
          // Softened gravity, weak angular-momentum loss and a slowly varying perturbation.
          const gravity = -5 / Math.pow(r2 + 0.12, 1.5);
          const eddy =
            0.006 * Math.sin(this.time * 0.31 + Math.atan2(p.y, p.x) * 3);
          p.vx += (gravity * p.x - p.vx * 0.016 - (p.y / r) * eddy) * h;
          p.vy += (gravity * p.y - p.vy * 0.016 + (p.x / r) * eddy) * h;
          p.x += p.vx * h;
          p.y += p.vy * h;
          const infall = Math.max(0, -(p.x * p.vx + p.y * p.vy) / r);
          p.heat += (0.24 + infall * 1.1 + 1.4 / r - p.heat) * h * 0.65;
          if (remember) {
            p.trail.copyWithin(2, 0, 14);
            p.trail[0] = p.x;
            p.trail[1] = p.y;
          }
        }
      }
    }
    this.measure();
  }
  private measure() {
    for (const s of this.streams) {
      let sx = 0,
        sy = 0,
        radius = 0,
        heat = 0,
        n = 0;
      for (const p of s.parcels)
        if (p.alive) {
          const r = Math.hypot(p.x, p.y);
          sx += p.x / r;
          sy += p.y / r;
          radius += r;
          heat += p.heat;
          n++;
        }
      s.angle = Math.atan2(sy, sx);
      s.radius = n ? radius / n : 7;
      s.spread = n
        ? Math.min(
            1.2,
            Math.sqrt(
              Math.max(
                0,
                -2 * Math.log(Math.max(0.05, Math.hypot(sx, sy) / n)),
              ),
            ),
          ) + 0.12
        : 0.12;
      s.heat = n
        ? (heat / 48) * Math.exp(-s.age * 0.018) * Math.min(1, s.age / 1.8)
        : 0;
    }
  }
  snapshot() {
    return {
      active: this.streams.reduce(
        (n, s) => n + s.parcels.filter((p) => p.alive).length,
        0,
      ),
      released: this.released,
      absorbed: this.absorbed,
      time: this.time,
    };
  }
}
