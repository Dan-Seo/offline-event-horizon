import type * as T from "three/webgpu";

/** What the HUD math reads from a body; the world's bodies satisfy it as they are. */
export type SnapshotBody = {
  id: string;
  name: string;
  position: T.Vector3;
  radius: number;
  archetype: number;
};
/** The body close enough to count as met, or "". Rings, clouds and sanctuaries are never met:
 *  a ring has no ground and a sanctuary announces itself by name instead. */
export function encounterFor(
  bodies: SnapshotBody[],
  selectedId: string | undefined,
  position: T.Vector3,
  mode: string,
): string {
  // Travelling is a passage, not an arrival; nothing is met until the flight settles.
  if (mode === "TRAVEL") return "";
  const within = (b: SnapshotBody, radii: number) =>
    ![4, 5, 7].includes(b.archetype) &&
    position.distanceTo(b.position) < b.radius * radii;
  // A chosen destination announces itself from further out than a body merely passed, and the
  // anomaly from further out again, because its reach is far larger than its drawn radius.
  const encounter =
    bodies.find(
      (b) => b.id === selectedId && within(b, b.archetype === 3 ? 12 : 7.5),
    ) ??
    bodies.find(
      (b) => b.id !== "orpheus" && within(b, b.archetype === 3 ? 4 : 1.5),
    );
  return encounter?.id ?? "";
}
/** Closest surface, skipping the sanctuaries, whose own name overrides this reading anyway.
 *  `name` is undefined when nothing qualified, so the caller can keep the last one it had. */
export function nearestBody(bodies: SnapshotBody[], position: T.Vector3) {
  let distance = Infinity,
    name: string | undefined;
  for (const b of bodies) {
    const d = position.distanceTo(b.position) - b.radius;
    if (b.archetype === 7) continue;
    if (d < distance) {
      distance = d;
      name = b.name;
    }
  }
  return { name, distance };
}
/** Where the selection marker sits, in percent. The clamps keep it clear of the panels: wider on
 *  a landscape window, and never under the top readout or the bottom controls. */
export function hudPosition(projected: T.Vector3, aspect: number) {
  return {
    x: Math.max(
      10,
      Math.min(aspect < 1 ? 65 : 84, (projected.x * 0.5 + 0.5) * 100),
    ),
    y: Math.max(14, Math.min(73, (-projected.y * 0.5 + 0.5) * 100)),
    visible: projected.z < 1,
  };
}
