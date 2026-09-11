import type { Analysis } from "../perception/types";
import type { V3 } from "../perception/math";
import { CRUISE_SPEED, STEER_YAW_RATE, type Drive } from "./model.ts";
import { seeded } from "../config.ts";
const rest = (): Drive => ({
  throttle: 0,
  steer: 0,
  lift: false,
  precision: false,
  boost: false,
});
// One scan window turns about 79 degrees. The heading is kept, so the next scan opens a new sector.
const SCAN_STEER = 0.8,
  SCAN_TIME = 3.5;
// Commanded motion whose estimate refuses to move means the hull is held against something.
const STALL_TIME = 4,
  STALL_EPSILON = 0.6;
/** Only observations enter this director. It has no world, landmark or ground-truth reference. */
export class ScenicDirector {
  active = false;
  resting = true;
  stops = 0;
  age = 0;
  reason = "rest";
  private until = 0;
  private latest?: Analysis;
  private started = -Infinity;
  private movingTime = 0;
  private random = seeded(731);
  private blockedTime = 0;
  private stallTime = 0;
  private throttled = false;
  private anchor?: V3;
  start(time: number) {
    this.clearObservation();
    this.started = time;
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
  clearObservation() {
    this.latest = undefined;
    this.blockedTime = 0;
    this.stallTime = 0;
    this.throttled = false;
    this.anchor = undefined;
  }
  observe(a: Analysis, time: number) {
    const age = time - a.timestamp;
    this.latest = this.active && Number.isFinite(age) && age >= 0 &&
      age <= 0.85 && a.timestamp >= this.started ? a : undefined;
  }
  private hold(reason: string) {
    this.resting = true;
    this.throttled = false;
    this.reason = reason;
    return rest();
  }
  /** Estimated translation only: no truth pose, contact query or world coordinate enters here. */
  private stalled(dt: number) {
    const p = this.latest?.vo?.pose?.p;
    if (p && p.every((v) => Number.isFinite(v))) {
      const moved =
        !this.anchor ||
        Math.hypot(
          p[0] - this.anchor[0],
          p[1] - this.anchor[1],
          p[2] - this.anchor[2],
        ) > STALL_EPSILON;
      if (moved) {
        this.anchor = p;
        this.stallTime = 0;
      } else if (this.throttled) this.stallTime += dt;
    }
    return this.stallTime > STALL_TIME;
  }
  update(time: number, dt: number, beauty: boolean): Drive {
    if (!this.active) return rest();
    this.age = time;
    if (beauty) {
      this.until = Math.max(this.until, time + 14);
      return this.hold("watching");
    }
    const captureAge = time - (this.latest?.timestamp ?? -Infinity);
    if (!Number.isFinite(captureAge) || captureAge < 0 || captureAge > 0.85)
      return this.hold("waiting for a fresh view");
    if (time < this.until) return this.hold("resting");
    const route = this.latest?.chosen;
    if (!route || this.stalled(dt)) {
      this.blockedTime += dt;
      if (this.blockedTime > SCAN_TIME) {
        this.until = time + 30 + this.random() * 30;
        this.blockedTime = this.movingTime = this.stallTime = 0;
        this.anchor = undefined;
        this.stops++;
        return this.hold("resting");
      }
      // Turning in place is not rest, and the retained heading carries the sweep onward.
      this.resting = this.throttled = false;
      this.reason = "looking for an opening";
      return { ...rest(), steer: SCAN_STEER };
    }
    this.blockedTime = 0;
    this.resting = false;
    this.reason = "following observed ground";
    this.movingTime += dt;
    if (this.movingTime > 18 + this.latest!.green * 18) {
      this.until = time + 32 + this.random() * 26;
      this.movingTime = this.stallTime = 0;
      this.anchor = undefined;
      this.stops++;
      return this.hold("resting");
    }
    const speed = Math.min(CRUISE_SPEED * 0.48, route.speed);
    this.throttled = true;
    return {
      ...rest(),
      throttle: speed / CRUISE_SPEED,
      // Match the candidate arc's yaw rate to the physical steering response.
      steer: Math.max(
        -1,
        Math.min(1, (route.curvature * speed) / STEER_YAW_RATE),
      ),
    };
  }
}
