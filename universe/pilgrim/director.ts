import type { Analysis } from "../perception/types";
import type { Drive } from "./model";
const rest = (): Drive => ({
  throttle: 0,
  steer: 0,
  lift: false,
  precision: false,
  boost: false,
});
/** Only observations enter this director. It has no world, landmark or ground-truth reference. */
export class ScenicDirector {
  active = false;
  resting = true;
  stops = 0;
  age = 0;
  reason = "rest";
  private until = 0;
  private latest?: Analysis;
  private received = -Infinity;
  private movingTime = 0;
  private seed = 731;
  private blockedTime = 0;
  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  start(time: number) {
    this.active = true;
    this.resting = true;
    this.age = time;
    this.until = time + 2;
    this.movingTime = 0;
    this.reason = "looking";
  }
  cancel() {
    this.active = false;
    this.reason = "manual";
  }
  observe(a: Analysis, time: number) {
    this.latest = a;
    this.received = time;
  }
  update(time: number, dt: number, beauty: boolean): Drive {
    if (!this.active) return rest();
    this.age = time;
    if (beauty) {
      this.resting = true;
      this.until = Math.max(this.until, time + 14);
      this.reason = "watching";
      return rest();
    }
    if (time - this.received > 0.85) {
      this.reason = "waiting for a fresh view";
      return rest();
    }
    if (this.resting && time < this.until) {
      this.reason = "resting";
      return rest();
    }
    const route = this.latest?.chosen;
    if (!route) {
      this.reason = "looking for an opening";
      this.blockedTime += dt;
      if (this.blockedTime > 3.5) {
        this.resting = true;
        this.until = time + 28 + this.random() * 12;
        this.blockedTime = 0;
        this.movingTime = 0;
        this.stops++;
        return rest();
      }
      return { ...rest(), steer: 0.12 };
    }
    this.blockedTime = 0;
    this.resting = false;
    this.reason = "following observed ground";
    this.movingTime += dt;
    if (this.movingTime > 18 + this.latest!.green * 18) {
      this.resting = true;
      this.until = time + 32 + this.random() * 26;
      this.movingTime = 0;
      this.stops++;
      return rest();
    }
    const speed = Math.min(5.76, route.speed);
    return {
      ...rest(),
      throttle: speed / 12,
      // Match the candidate arc's yaw rate to the physical steering response.
      steer: Math.max(-1, Math.min(1, (route.curvature * speed) / 0.52)),
    };
  }
}
