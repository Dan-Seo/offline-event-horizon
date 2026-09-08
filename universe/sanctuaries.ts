import * as T from "three/webgpu";
import { SanctuaryAtmosphere } from "./sanctuary-atmosphere";
import { MirrorSea } from "./sanctuary-water";
import { SANCTUARIES, localPresence } from "./sanctuary-layout";
import { placeRelative } from "./coordinates";
import { clamp, damp, seeded, type Quality } from "./config";
import { SanctuaryNature } from "./sanctuary-nature";
import { SanctuaryLife } from "./sanctuary-life";

/** Local, living detail extends the existing universe. No stage manager, scene switches, or timer tour. */
export class Sanctuaries {
  air: SanctuaryAtmosphere;
  sea: MirrorSea;
  nature: SanctuaryNature;
  life: SanctuaryLife;
  places = SANCTUARIES.map((p) => ({
    ...p,
    object: new T.Group(),
    solid: false,
    color: 0x91a8aa,
    archetype: 7,
  }));
  presence = 1;
  stillness = 0;
  active = "last-light";
  event = "none";
  eventTime = 0;
  eventsSeen = 0;
  private previous = 0;
  private speed = 0;
  private opportunity = 38;
  private random = seeded(7432);
  private residence = 0;
  private eventDuration = 70;
  constructor(scene: T.Scene, density: T.Data3DTexture, gpu: boolean) {
    this.air = new SanctuaryAtmosphere(density, scene);
    this.sea = new MirrorSea(scene, this.air);
    for (const p of this.places) scene.add(p.object);
    this.nature = new SanctuaryNature(this.places, this.air);
    this.life = new SanctuaryLife(scene, this.air, gpu);
  }
  respond(speed: number) {
    this.speed = speed;
  }
  update(observer: T.Vector3, time: number) {
    const dt = Math.min(1 / 30, Math.max(0, time - this.previous));
    this.previous = time;
    this.presence = localPresence(observer);
    this.stillness +=
      ((this.speed < 1.2 ? 1 : 0) - this.stillness) *
      damp(this.speed < 1.2 ? 0.045 : 0.8, dt);
    this.air.presence.value = this.presence;
    this.air.stillness.value = this.stillness;
    this.air.time.value = time;
    this.air.observer.value.copy(observer);
    this.sea.update(observer, time, this.speed, this.presence);
    const closest = this.places.reduce((a, b) =>
      observer.distanceTo(a.position) / a.radius <
      observer.distanceTo(b.position) / b.radius
        ? a
        : b,
    );
    const active = this.presence > 0.1 ? closest.id : "space";
    if (active !== this.active) this.residence = 0;
    this.active = active;
    this.residence += dt;
    for (const p of this.places) {
      placeRelative(p.object, p.position, observer);
      p.object.visible = this.presence > 0.001;
    }
    this.air.forestPulse.value =
      this.stillness * (0.5 + Math.sin(time * 0.16) * 0.5);
    this.air.veilOpen.value = clamp(
      this.stillness * 0.8 + Math.sin(time * 0.013) * 0.3,
    );
    // Opportunities depend on presence and stillness. Nothing seizes the camera or announces them.
    if (this.event === "none") {
      this.opportunity -= dt;
      if (
        this.opportunity <= 0 &&
        this.residence > 18 &&
        this.stillness > 0.5 &&
        this.presence > 0.6
      ) {
        this.event =
          this.active === "moonfall"
            ? "moonbow"
            : this.active === "living-sky"
              ? "sky-visitor"
              : this.active === "last-light"
                ? "sea-visitor"
                : this.active === "forest"
                  ? "forest-breath"
                  : "cloud-opening";
        this.eventTime = 0;
        this.eventDuration = this.event.includes("visitor") ? 82 : 58;
        this.eventsSeen++;
      }
    } else {
      this.eventTime += dt;
      if (this.eventTime >= this.eventDuration) {
        this.event = "none";
        this.opportunity = 170 + this.random() * 190;
      }
    }
    const gift =
      this.event === "none"
        ? 0
        : Math.sin(Math.PI * clamp(this.eventTime / this.eventDuration));
    this.air.creature.value = this.event.includes("visitor")
      ? Math.pow(gift, 0.7)
      : 0;
    this.air.moonbow.value = this.event === "moonbow" ? gift : 0;
    if (this.event === "forest-breath")
      this.air.forestPulse.value = Math.max(this.air.forestPulse.value, gift);
    if (this.event === "cloud-opening")
      this.air.veilOpen.value = Math.max(this.air.veilOpen.value, gift);
  }
  setQuality(q: Quality) {
    this.sea.setQuality(q);
    this.air.setQuality(q);
    this.nature.setQuality(q);
    this.life.setQuality(q);
  }
  dispose() {
    this.sea.dispose();
    this.air.dispose();
    this.life.dispose();
  }
}
