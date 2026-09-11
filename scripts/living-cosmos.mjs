import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { Vector3, Quaternion } from "three";
import { groundHeight, lagoonHeight } from "../universe/walk-ground.ts";
import { enterEnglishExperience } from "./qa-entry.mjs";
import { qaLaunch } from "./qa-browser.mjs";

// Real-browser release evidence. QA_SCENARIOS accepts opening,ocean,coast,giant,wound,
// or all (the default). The script never changes simulator state except through UI
// controls and keyboard input; inspect() is read-only evidence only.
const url = process.env.QA_URL || "http://localhost:4173";
const webgl = process.env.QA_BACKEND === "webgl";
const requested = new Set(
  (process.env.QA_SCENARIOS || "all").split(",").map((x) => x.trim()),
);
const active = (name) => requested.has("all") || requested.has(name);
const root = process.env.QA_OUTPUT_DIR || path.join("artifacts", "living-cosmos", webgl ? "webgl" : "gpu");
const browser = await chromium.launch(qaLaunch());
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  locale: "en-US",
});
const page = await context.newPage();
const checks = [], errors = [], performance = [], snapshots = [];
const read = () => page.evaluate(() => window.__vastness.inspect());
// Euler.toArray() includes an order string after its three numeric angles.
const delta = (a, b) => Math.hypot(...a.slice(0, 3).map((v, i) => v - b[i]));
const check = (name, ok, detail = undefined) => {
  checks.push({ name, passed: !!ok, detail });
  console.log(ok ? "PASS" : "FAIL", name, detail ? JSON.stringify(detail) : "");
};
page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
page.on("console", (message) => {
  if (["error", "warning"].includes(message.type()))
    errors.push(`console: ${message.text()}`);
});

function pick(value, keys) {
  return Object.fromEntries(keys.filter((key) => key in value).map((key) => [key, value[key]]));
}
function quantiles(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  return sorted.length ? { samples: sorted.length, p50: at(.5), p95: at(.95), p99: at(.99) } : null;
}
async function measure(name) {
  const result = await page.evaluate(async () => {
    const rows = [], gpu = [], compute = [];
    let previous = 0;
    await new Promise((resolve) => {
      const frame = (now) => {
        const state = window.__vastness.inspect();
        if (previous) rows.push(now - previous);
        if (Number.isFinite(state.gpuRenderMs)) gpu.push(state.gpuRenderMs);
        if (Number.isFinite(state.gpuComputeMs)) compute.push(state.gpuComputeMs);
        previous = now;
        if (rows.length < 180) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    const state = window.__vastness.inspect();
    return {
      frames: rows,
      gpu,
      compute,
      actual: { backend: state.backend, quality: state.quality, dpr: state.dpr, viewport: { width: innerWidth, height: innerHeight } },
    };
  });
  const row = { name, frameMs: quantiles(result.frames), gpuRenderMs: quantiles(result.gpu), gpuComputeMs: quantiles(result.compute), ...result.actual };
  performance.push(row);
  check(`${name} produces bounded frame samples`, row.frameMs?.samples === 180, row);
}
async function shot(name) {
  // Element screenshots include overlapping DOM UI; retain it as honest UI evidence.
  await page.locator(".universe-canvas canvas").screenshot({
    path: path.join(root, `${name}.jpg`), type: "jpeg", quality: 88,
  });
}
async function waitFreeEncounter(id, timeout = 130000) {
  await page.waitForFunction((target) => {
    const s = window.__vastness.inspect();
    return s.mode === "FREE" && (s.encounter === target || s.approach === target || s.sanctuary === target);
  }, id, { timeout });
}
async function places() {
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", {
      name: /^(Explore places and worlds|Find somewhere quiet)$/,
    })
    .click();
}
async function travel(id) {
  await places();
  const destination = page.locator(`[data-destination="${id}"]`);
  if (!(await destination.count())) {
    await page.getByRole("button", {
      name: /^(Beyond this world|Back to the water)$/,
    }).click();
  }
  const beforeSelection = await read();
  await destination.click();
  await page.waitForTimeout(250);
  const selected = await read();
  // Supersedes the old Last Light TRAVEL failure: HOME is already its arrival.
  // Match both the actual sanctuary and FlightController's <3 m arrival threshold.
  const atLastLightArrival = (s) => s.mode === "FREE" && s.sanctuary === "last-light" &&
    Array.isArray(s.position) && s.position.length === 3 && s.position.every(Number.isFinite) &&
    delta(s.position, [0, 22, 460]) < 3; // sanctuary-layout.ts HOME
  const alreadyArrived = id === "last-light" && selected.selectedId === id &&
    atLastLightArrival(beforeSelection) && atLastLightArrival(selected);
  check(`${id} begins actual UI travel or is already at its arrival`, selected.mode === "TRAVEL" || alreadyArrived,
    { mode: selected.mode, alreadyArrived, selectedId: selected.selectedId });
  await waitFreeEncounter(id === "nacre-coast" ? "nacre" : id);
  await page.waitForTimeout(750);
}
function requireFields(state, names) {
  const missing = names.filter((name) => name.split(".").reduce((v, key) => v?.[key], state) === undefined);
  check("Release diagnostics expose required geometry observables", missing.length === 0, { missing });
  return missing.length === 0;
}
async function opening() {
  const state = await read();
  snapshots.push({ scenario: "opening", state: pick(state, ["backend", "quality", "position", "mode", "paused"]) });
  check("Requested backend is active", state.backend === (webgl ? "WebGL2" : "WebGPU"), { actual: state.backend });
  const sea = state.ocean?.sanctuary;
  check("Opening starts above the sea", Number.isFinite(sea?.signedDepth) && sea.submersion < 0.01, sea);
  await shot("opening-above-sea");
  await measure("opening-above-sea");
}
// QA-only pose/geometry reads: the approved Nacre frame from approaches.ts.
// All movement still goes through real keyboard input; no simulator writes.
async function coastToLagoon() {
  const up = new Vector3(-0.6, 0.33, 0.73).normalize();
  const inverse = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), up).invert();
  const pose = (s) => {
    const local = new Vector3().fromArray(s.position).sub(new Vector3(175000, 45000, -380000))
      .divideScalar(21000).sub(up).applyQuaternion(inverse);
    const forward = new Vector3(0, 0, -1).applyQuaternion(new Quaternion().fromArray(s.quaternion)).applyQuaternion(inverse);
    return { local: local.toArray(), forward: forward.toArray(),
      waterColumn: (lagoonHeight(local.x, local.z) - groundHeight(10, local.x, local.z)) * 21000 };
  };
  let state = await read(), current = pose(state);
  const shore = { position: state.position, quaternion: state.quaternion, ...current };
  await shot("coast-shore-arrival");
  // Existing arrival gaze points from z=.126 toward -.16. Fly ~190 m forward
  // to z=.117, rather than attempting to descend through the solid entry shore.
  if (state.approach !== "nacre" || !current.local.every(Number.isFinite) ||
      current.forward[2] >= -0.8 || Math.abs(current.forward[0]) > 0.2)
    throw new Error("Coast arrival pose does not match the verified forward lagoon route");
  const deadline = Date.now() + 40000;
  await page.keyboard.down("KeyW");
  try {
    while (current.local[2] > 0.117 && Date.now() < deadline) {
      await page.waitForTimeout(100);
      state = await read(); current = pose(state);
      if (state.approach !== "nacre" || !current.local.every(Number.isFinite) || Math.abs(current.local[0]) > 0.01)
        throw new Error("Real coast flight left its bounded lagoon corridor");
    }
  } finally { await page.keyboard.up("KeyW"); }
  await page.waitForTimeout(750);
  state = await read(); current = pose(state);
  const arrived = state.approach === "nacre" && current.local[2] <= 0.117 &&
    current.local[2] > 0.11 && Math.abs(current.local[0]) < 0.01 &&
    Number.isFinite(current.waterColumn) && current.waterColumn > 20 && state.ocean?.regional?.valid;
  check("Real keyboard flight reaches water beyond the solid coast", arrived, { shore, arrived: current });
  snapshots.push({ scenario: "coast-route", shore, arrived: { position: state.position, quaternion: state.quaternion, ...current } });
  if (!arrived) throw new Error("Coast route did not reach a verified wet column; no underwater claim recorded");
}
async function ocean(region = "sanctuary") {
  const label = region === "sanctuary" ? "last-light" : "coast";
  await travel(region === "sanctuary" ? "last-light" : "nacre-coast");
  const fly = page.getByRole("button", { name: "Leave PILGRIM and fly", exact: true });
  if (await fly.isVisible()) await fly.click();
  if (region === "regional") await coastToLagoon();
  let state = await read();
  if (!requireFields(state, [`ocean.${region}.signedDepth`, `ocean.${region}.seabedHeight`, `ocean.${region}.floorClearance`, `ocean.${region}.submersion`, `ocean.${region}.ecosystem.animatedTime`])) return;
  const ocean = (s) => s.ocean[region];
  check(`${label} arrival is above water`, ocean(state).submersion < 0.01, ocean(state));
  await shot(`${label}-before-descent`);
  const above = ocean(state);
  await page.keyboard.down("KeyX"); await page.waitForTimeout(3500); await page.keyboard.up("KeyX");
  await page.waitForTimeout(450);
  state = await read();
  const submerged = ocean(state).submersion > 0.5 && Number.isFinite(ocean(state).signedDepth) && ocean(state).signedDepth > 0 && ocean(state).signedDepth > above.signedDepth;
  check("Keyboard descent enters real underwater volume", submerged, ocean(state));
  if (!submerged) throw new Error(`${label} descent did not enter water; no underwater screenshot or timing claimed`);
  const underwater = ocean(state);
  await shot(`${label}-underwater`);
  await page.keyboard.down("KeyX"); await page.waitForTimeout(7000); await page.keyboard.up("KeyX");
  await page.waitForTimeout(300);
  state = await read();
  const nearFloor = ocean(state);
  await page.keyboard.down("KeyX"); await page.waitForTimeout(1800); await page.keyboard.up("KeyX");
  const floorHeld = ocean(await read());
  check("Seabed maintains non-negative metre clearance during descent", floorHeld.floorClearance >= -0.02 && nearFloor.floorClearance >= -0.02, { nearFloor, floorHeld });
  await page.waitForTimeout(750);
  const settled = ocean(await read());
  const underwaterSettled = settled.submersion > 0.5 && Number.isFinite(settled.signedDepth) && settled.signedDepth > 0 &&
    Number.isFinite(settled.floorClearance) && settled.floorClearance >= -0.02 && settled.floorClearance <= 0.1;
  check(`${label} settles underwater at the seabed before profiling`, underwaterSettled, settled);
  if (!underwaterSettled) throw new Error(`${label} underwater floor settlement failed; timing skipped`);
  await measure(`${label}-underwater`);
  const life0 = (await read()).ocean[region].ecosystem.animatedTime;
  await page.waitForTimeout(1300);
  const life1 = await read();
  check("Underwater life continues moving while unpaused", life1.ocean[region].ecosystem.animatedTime !== life0 && life1.ocean[region].ecosystem.fish > 0, { before: life0, after: life1.ocean[region].ecosystem.animatedTime, ecosystem: ocean(life1).ecosystem });
  await page.keyboard.press("p"); await page.waitForTimeout(250);
  const paused = await read(); await page.waitForTimeout(700); const frozen = await read();
  // Supersedes the old exact-depth failure (5.9e-10 m normalization drift).
  // Animation clocks remain exact. Regional recovery showed 2.19714e-5 m drift;
  // allow 0.1 mm there, retaining the sanctuary 1 micrometre tolerance.
  const pauseMetreEpsilon = region === "regional" ? 1e-4 : 1e-6;
  const pausedOcean = ocean(paused), frozenOcean = ocean(frozen);
  const stableMetres = ["signedDepth", "floorClearance"].every((key) =>
    Number.isFinite(pausedOcean[key]) && Number.isFinite(frozenOcean[key]) &&
    Math.abs(pausedOcean[key] - frozenOcean[key]) <= pauseMetreEpsilon);
  const clock = pausedOcean.ecosystem.animatedTime, frozenClock = frozenOcean.ecosystem.animatedTime;
  check("Pause freezes underwater geometry and life", paused.paused && frozen.paused &&
    Number.isFinite(paused.time) && Number.isFinite(frozen.time) && paused.time === frozen.time &&
    Number.isFinite(clock) && Number.isFinite(frozenClock) && clock === frozenClock && stableMetres,
    { paused: pausedOcean, frozen: frozenOcean });
  await page.keyboard.press("p");
  await page.keyboard.down("Space"); await page.waitForTimeout(3500); await page.keyboard.up("Space");
  await page.waitForTimeout(350);
  state = await read();
  check("Keyboard ascent returns above sea", ocean(state).submersion < 0.01 && ocean(state).signedDepth < underwater.signedDepth, ocean(state));
  snapshots.push({ scenario: label, above, underwater, floor: ocean(life1), final: ocean(state) });
  await shot(`${label}-after-ascent`); await measure(`${label}-after-ascent`);
}
async function giant() {
  await travel("giant");
  let before = await read();
  if (!requireFields(before, ["cosmic.planets"])) return;
  const giantMotion = (s) => s.cosmic.planets.find((planet) => planet.id === "giant");
  const required = giantMotion(before);
  check("Cosmic diagnostics include the giant's surface, bands, and satellites", !!required && Array.isArray(required.rotation) && Number.isFinite(required.bandEquatorPhase) && required.satellites.length > 0, required);
  if (!required || !Array.isArray(required.rotation) || !Number.isFinite(required.bandEquatorPhase) || !required.satellites.length) return;
  await shot("giant-before-orbit");
  await page.getByRole("button", { name: "Drift around this world", exact: true }).click();
  await page.waitForTimeout(1800);
  const after = await read();
  const giantAfter = giantMotion(after);
  const anchorDelta = delta(required.anchor, giantAfter.anchor);
  const orientationDelta = delta(required.rotation, giantAfter.rotation);
  const bandPhaseDelta = giantAfter.bandEquatorPhase - required.bandEquatorPhase;
  const satelliteDelta = delta(required.satellites[0].position, giantAfter.satellites[0].position);
  check("Giant approach anchor and orientation stay fixed", anchorDelta === 0 && orientationDelta === 0 && required.rotation[3] === giantAfter.rotation[3], { anchorDelta, orientationDelta });
  check("Giant bands and satellites evolve around the fixed anchor", Math.abs(bandPhaseDelta) > 0.0001 && satelliteDelta > 0.0001, { bandPhaseDelta, satelliteDelta });
  await page.keyboard.down("w"); await page.waitForTimeout(90); await page.keyboard.up("w");
  check("Manual keyboard input takes over giant orbit", (await read()).mode === "FREE");
  snapshots.push({ scenario: "giant", before: required, after: giantAfter });
  await shot("giant-after-motion"); await measure("giant-motion");
}
async function wound() {
  await travel("wound");
  let before = await read();
  if (!requireFields(before, ["gas.released", "gas.active", "gas.absorbed", "gas.time", "cosmic.anomaly.gasTime", "cosmic.anomaly.time", "gasSample"])) return;
  const woundMotion = (s) => ({ gas: s.gas, gasSample: s.gasSample, anomaly: s.cosmic.anomaly });
  const initial = woundMotion(before);
  await shot("wound-before");
  if (before.gasSample.length !== 8) throw new Error("Expected rebuilt eight-stream inspection hook");
  await page.getByRole("button", { name: /^Release a stream of gas(?:\s|$)/ }).click();
  await page.waitForFunction(released => window.__vastness.inspect().gas.released > released,
    initial.gas.released, { timeout: 3000 });
  const immediate = woundMotion(await read());
  const streamIndex = (immediate.gas.released - 1) % 8;
  await shot("wound-release-immediate");
  await page.waitForTimeout(1700);
  const after = await read();
  const dynamic = woundMotion(after);
  // The read-only hook covers all eight slots. Compare the freshly released
  // stream's measured mean angle/radius/spread, not just a running clock.
  const firstStream = immediate.gasSample[streamIndex], laterStream = dynamic.gasSample[streamIndex];
  const streamMotion = delta(firstStream, laterStream);
  check("Released gas stream measured geometry evolves", firstStream.every(Number.isFinite) &&
    laterStream.every(Number.isFinite) && laterStream[3] > 0 && streamMotion > 1e-5,
    { streamIndex, immediate: firstStream, later: laterStream, angleRadiusSpreadDelta: streamMotion });
  await shot("wound-release-evolved");
  const countersFinite = [initial.gas, dynamic.gas].every(g =>
    [g.released, g.active, g.absorbed, g.time].every(Number.isFinite));
  check("Wound UI gas release changes full-model activity", countersFinite &&
    dynamic.gas.released > initial.gas.released && dynamic.gas.active > 0 &&
    (dynamic.gas.active !== initial.gas.active || dynamic.gas.absorbed !== initial.gas.absorbed),
    { before: initial.gas, after: dynamic.gas });
  check("Wound shared model and shader clocks advance", countersFinite &&
    [initial.anomaly.gasTime, dynamic.anomaly.gasTime, initial.anomaly.time, dynamic.anomaly.time].every(Number.isFinite) &&
    dynamic.gas.time > initial.gas.time && dynamic.anomaly.gasTime > initial.anomaly.gasTime && dynamic.anomaly.time > initial.anomaly.time,
    { before: initial.anomaly, after: dynamic.anomaly });
  await page.keyboard.press("p"); await page.waitForTimeout(220); const paused = await read(); await page.waitForTimeout(650); const frozen = await read();
  check("Pause freezes accretion geometry", ["time", "released", "active", "absorbed"].every(k => Number.isFinite(paused.gas[k]) && paused.gas[k] === frozen.gas[k]) && paused.cosmic.anomaly.gasTime === frozen.cosmic.anomaly.gasTime && paused.cosmic.anomaly.time === frozen.cosmic.anomaly.time && JSON.stringify(paused.gasSample) === JSON.stringify(frozen.gasSample), { paused: woundMotion(paused), frozen: woundMotion(frozen) });
  await page.keyboard.press("p");
  await page.keyboard.down("w"); await page.waitForTimeout(90); await page.keyboard.up("w");
  check("Manual keyboard input remains available at the Wound", (await read()).mode === "FREE");
  snapshots.push({ scenario: "wound", before: initial, immediate, streamIndex, dynamic, frozen: woundMotion(frozen) });
  await shot("wound-after-accretion"); await measure("wound-accretion");
}

await fs.mkdir(root, { recursive: true });
try {
  await page.goto(`${url}/?qa=1&profile=1${webgl ? "&backend=webgl&quality=BATTERY" : ""}`);
  await page.locator("main[data-ready=true]").waitFor({ timeout: 120000 });
  await enterEnglishExperience(page);
  if (active("opening")) await opening();
  if (active("ocean")) await ocean();
  if (active("coast")) await ocean("regional");
  if (active("giant")) await giant();
  if (active("wound")) await wound();
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(350);
  check("Portrait viewport has no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  check("No browser, console, or shader errors", errors.length === 0, errors);
} catch (error) {
  check("Browser completion", false, String(error));
  try { await shot("failure"); } catch {}
} finally {
  const report = { url, testedAt: new Date().toISOString(), backend: webgl ? "webgl" : "normal", browser: await browser.version(), scenarios: [...requested], checks, performance, snapshots, errors };
  const encoded = JSON.stringify(report, null, 2);
  if (Buffer.byteLength(encoded) > 500_000) throw new Error("living-cosmos QA report exceeded 500KB");
  await fs.writeFile(path.join(root, "report.json"), encoded);
  await browser.close();
}
if (checks.some((check) => !check.passed)) process.exitCode = 1;
