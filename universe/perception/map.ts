import { transform, type V3 } from "./math.ts";
import type {
  Analysis,
  MapCell,
  Route,
  SensorImage,
  VOResult,
} from "./types.ts";
export const SENSOR_PITCH = 0.22;
// Body-relative sensor extrinsics, shared by the rig and the evaluation export.
export const SENSOR_OFFSET: V3 = [0, 1.2, -0.8];
export const CELL = 2;
type Point = { p: V3; green: number; blue: number; age: number };
const body = (p: V3): V3 => [
  p[0],
  -p[1] * Math.cos(SENSOR_PITCH) - p[2] * Math.sin(SENSOR_PITCH),
  -p[1] * Math.sin(SENSOR_PITCH) + p[2] * Math.cos(SENSOR_PITCH),
];
export class LocalMap {
  private points: Point[] = [];
  private history: V3[] = [];
  private lastHistory = 0;
  private lastTurn = 0;
  reset() {
    this.points = [];
    this.history = [];
    this.lastHistory = 0;
    this.lastTurn = 0;
  }
  update(
    f: SensorImage,
    vo: VOResult,
  ): Omit<Analysis, "id" | "timestamp" | "vo" | "ms"> {
    if (vo.delta && vo.status === "TRACKING")
      this.points = this.points
        .filter((p) => p.age < 2)
        .map((p) => ({ ...p, p: transform(vo.delta!, p.p), age: p.age + 1 }));
    else this.points = [];
    if (vo.status === "LOST") this.history = [];
    const { width: w, height: h, fx, fy, cx, cy, far } = f.k;
    let water = 0,
      green = 0,
      sky = 0,
      count = 0;
    const columns = Array.from({ length: 9 }, () => ({
      green: 0,
      blue: 0,
      n: 0,
      upper: 0,
      open: 0,
      crowded: 0,
    }));
    for (let y = 0; y < h; y += 2)
      for (let x = 0; x < w; x += 2) {
        const i = y * w + x,
          d = f.depth[i],
          r = f.rgb[i * 4] / 255,
          g = f.rgb[i * 4 + 1] / 255,
          b = f.rgb[i * 4 + 2] / 255;
        const vegetation = Math.max(0, Math.min(1, (g - r) * 5 + (g - b) * 2)),
          blue = Math.max(0, Math.min(1, (b - r) * 5));
        const col = columns[Math.min(8, Math.floor((x / w) * 9))];
        col.green += vegetation;
        col.blue += blue;
        col.n++;
        if (y < h * 0.66) {
          col.upper++;
          col.open += +(d <= 0 || d > 80);
          col.crowded += +(d > 0 && d < 24);
        }
        water += blue;
        green += vegetation;
        sky += +(d <= 0);
        count++;
        if (d > 0.1 && d < Math.min(240, far))
          this.points.push({
            p: [((x - cx) * d) / fx, ((y - cy) * d) / fy, d],
            green: vegetation,
            blue,
            age: 0,
          });
      }
    this.points = this.points.slice(-14000);
    const grid = new Map<string, MapCell>();
    for (const p of this.points) {
      const [x, y, z] = body(p.p);
      if (z < 0 || z > 100 || Math.abs(x) > 72 || y > 35 || y < -45) continue;
      const gx = Math.floor(x / CELL),
        gz = Math.floor(z / CELL),
        key = `${gx},${gz}`;
      let cell = grid.get(key);
      if (!cell) {
        cell = {
          x: (gx + 0.5) * CELL,
          z: (gz + 0.5) * CELL,
          y,
          span: 0,
          count: 0,
          green: 0,
          blue: 0,
          age: p.age,
        };
        grid.set(key, cell);
      }
      const hi = Math.max(cell.y + cell.span, y),
        lo = Math.min(cell.y, y);
      cell.y = lo;
      cell.span = hi - lo;
      cell.count++;
      cell.green += p.green;
      cell.blue += p.blue;
      cell.age = Math.min(cell.age, p.age);
    }
    for (const c of grid.values()) {
      c.green /= c.count;
      c.blue /= c.count;
    }
    const read = (x: number, z: number) =>
      grid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
    const routes: Route[] = [];
    for (const turn of [-0.65, -0.48, -0.3, -0.15, 0, 0.15, 0.3, 0.48, 0.65]) {
      const points: V3[] = [];
      let previousY: number | undefined,
        coverage = 0,
        safe = true,
        vegetation = 0,
        blue = 0,
        steepness = 0;
      const length = vo.status === "TRACKING" ? 32 : 18;
      for (let s = 4; s <= length; s += 2) {
        const a = (turn * s) / length,
          x = Math.abs(turn) < 1e-6 ? 0 : ((1 - Math.cos(a)) * length) / turn,
          z = Math.abs(turn) < 1e-6 ? s : (Math.sin(a) * length) / turn;
        const c = read(x, z);
        if (!c || c.count < 1) {
          if (s < 9) {
            safe = false;
            break;
          }
          break;
        }
        const neighbors = [c, read(x - 1.5, z), read(x + 1.5, z)].filter(
          Boolean,
        ) as MapCell[];
        if (neighbors.some((n) => n.span > 3.4 || n.y > -0.7) || c.y < -18) {
          safe = false;
          break;
        }
        const slope =
          previousY === undefined ? 0 : Math.abs(c.y - previousY) / 2;
        if (slope > 0.9) {
          safe = false;
          break;
        }
        steepness += slope;
        previousY = c.y;
        coverage++;
        vegetation += c.green;
        blue += c.blue;
        points.push([x, c.y, z]);
      }
      const reach = points.length ? points[points.length - 1][2] : 0;
      const col = columns[Math.max(0, Math.min(8, Math.round(4 + turn * 5)))];
      const variety =
        (col.green / Math.max(1, col.n)) * 3 +
        Math.sqrt(vegetation * blue) / Math.max(1, coverage);
      let revisit = 0;
      if (vo.status === "TRACKING" && points.length) {
        const end = points[points.length - 1],
          cam: V3 = [
            end[0],
            -end[1] * Math.cos(SENSOR_PITCH) - end[2] * Math.sin(SENSOR_PITCH),
            -end[1] * Math.sin(SENSOR_PITCH) + end[2] * Math.cos(SENSOR_PITCH),
          ];
        const world = transform(vo.pose, cam);
        revisit =
          this.history.reduce(
            (sum, p) =>
              sum +
              Math.exp(-Math.hypot(world[0] - p[0], world[2] - p[2]) / 15),
            0,
          ) / Math.max(1, this.history.length);
      }
      const score =
        reach * 0.07 +
        variety * 0.7 -
        (col.crowded / Math.max(1, col.upper)) * 1.2 +
        (col.open / Math.max(1, col.upper)) * 0.5 -
        steepness * 0.13 -
        Math.abs(turn - this.lastTurn) * 0.4 -
        revisit * 0.7;
      routes.push({
        turn,
        curvature: turn / length,
        speed: Math.min(
          vo.status === "TRACKING" ? 10 : 4,
          Math.max(0, reach - 5) * 0.42,
        ),
        score,
        length: reach,
        safe: safe && reach >= 8,
        points,
      });
    }
    const chosen =
      routes.filter((r) => r.safe).sort((a, b) => b.score - a.score)[0] ?? null;
    if (chosen) this.lastTurn = chosen.turn;
    if (vo.status === "TRACKING" && f.timestamp - this.lastHistory > 3) {
      this.lastHistory = f.timestamp;
      this.history.push([...vo.pose.p]);
      this.history = this.history.slice(-32);
    }
    return {
      cells: [...grid.values()],
      routes,
      chosen,
      coverage: grid.size,
      water: water / count,
      green: green / count,
      sky: sky / count,
      points: this.points.length,
    };
  }
}
