import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { decodeDataset, encodeDataset } from "../universe/perception/dataset.ts";
import { executionSource, heldGpuReads } from "../scripts/report-observations.ts";

test("GPU held reads retain missing values and zero without claiming live queries", () => {
  const empty = heldGpuReads([]);
  assert.equal(empty.readCount, 0);
  assert.equal(empty.first, null);
  assert.equal(empty.heldSingleValue, false);
  assert.equal(empty.unavailabilityReason, "unknown");
  const zero = heldGpuReads([null, 0, 0, undefined, NaN, Infinity]);
  assert.equal(zero.readCount, 6);
  assert.equal(zero.finiteReadCount, 2);
  assert.equal(zero.unavailableReadCount, 4);
  assert.equal(zero.first, 0);
  assert.equal(zero.last, 0);
  assert.equal(zero.distinctValueCount, 1);
  assert.equal(zero.heldSingleValue, true);
  assert.equal(zero.uniqueQueryCount, null);
  const varied = heldGpuReads([1, 2, 1]);
  assert.equal(varied.distinctValueCount, 2);
  assert.equal(varied.heldSingleValue, false);
  assert.equal(varied.liveness, "undetermined");
  assert.equal(varied.freshness, "unknown");
});

test("Replay preserves success and records the first mismatch without partial accuracy", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "vastness-report-"));
  // Verify the exact recursive-cleanup target remains inside the intended temp root.
  assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const unknown = executionSource(directory);
  assert.equal(unknown.revision, "unknown");
  assert.equal(unknown.dirty, null);
  const script = fileURLToPath(new URL("../scripts/replay-rgbd.ts", import.meta.url));
  const fixture = fileURLToPath(new URL("fixtures/clear-eight-frames.tar.gz", import.meta.url));
  const run = (file: string, name: string) => {
    const output = path.join(directory, name + ".json");
    const process = spawnSync(globalThis.process.execPath,
      ["--experimental-strip-types", script, file, "--out", output],
      { encoding: "utf8", timeout: 30000 });
    assert.equal(process.error, undefined);
    return { exit: process.status, stderr: process.stderr,
      report: existsSync(output) ? JSON.parse(readFileSync(output, "utf8")) : null };
  };
  const bytes = readFileSync(fixture), first = run(fixture, "fixture");
  assert.equal(first.exit, 0, first.stderr);
  assert.equal(first.report.inputSha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(first.report.hashedBytes, "archive-as-read");
  assert.equal(first.report.compressed, true);
  assert.equal(first.report.compared, 7);
  assert.deepEqual(first.report.agreement, {
    passed: true, statusInlierFramesChecked: 7, deltaPairsCompared: 7, firstFailure: null,
  });
  assert.deepEqual(first.report.gates.gatesEvaluated, { lostFraction: true, rpeSegments: 0, driftSegments: 1 });
  assert.equal(first.report.evaluation.segments[0].ate, null);
  assert.equal(first.report.metricAvailability[0].ateAvailable, false);
  assert.equal(first.report.metricAvailability[0].rpeAvailable, false);
  assert.equal(first.report.metricAvailability[0].rpePairs, 0);
  assert.ok(Math.abs(first.report.evaluation.segments[0].driftFraction - 0.06660124274743297) < 1e-12);

  const { captures, metadata } = decodeDataset(gunzipSync(bytes));
  const archive = encodeDataset(captures, metadata), roundtripFile = path.join(directory, "roundtrip.tar");
  writeFileSync(roundtripFile, archive);
  const roundtrip = run(roundtripFile, "roundtrip");
  // Establish that re-encoding itself does not cause an earlier mismatch.
  assert.equal(roundtrip.exit, 0, roundtrip.stderr);
  assert.equal(roundtrip.report.agreement.deltaPairsCompared, 7);
  assert.deepEqual(roundtrip.report.evaluation, first.report.evaluation);
  assert.equal(roundtrip.report.inputSha256, createHash("sha256").update(archive).digest("hex"));
  for (const check of ["status", "inliers", "delta"] as const) {
    const modified = decodeDataset(archive).captures;
    const target = modified[2];
    if (check === "status") target.estimate.status = "LOST";
    else if (check === "inliers") target.estimate.inliers++;
    else target.estimate.delta!.p[0] += 1;
    const filename = path.join(directory, check + ".tar");
    writeFileSync(filename, encodeDataset(modified, metadata));
    const failed = run(filename, check);
    assert.equal(failed.exit, 1);
    assert.equal(failed.report.agreement.passed, false);
    assert.equal(failed.report.agreement.firstFailure.id, target.frame.id);
    assert.equal(failed.report.agreement.firstFailure.check, check);
    assert.notDeepEqual(failed.report.agreement.firstFailure.actual, failed.report.agreement.firstFailure.expected);
    assert.equal(failed.report.agreement.statusInlierFramesChecked, check === "delta" ? 2 : 1);
    assert.equal(failed.report.agreement.deltaPairsCompared, 1);
    assert.equal(failed.report.evaluation, null);
    assert.equal(failed.report.gates.evaluated, "not-run-due-to-agreement-failure");
    assert.equal(failed.report.gates.failures, null);
    assert.deepEqual(failed.report.gates.gatesEvaluated, { lostFraction: false, rpeSegments: 0, driftSegments: 0 });
    assert.notEqual(failed.report.inputSha256, roundtrip.report.inputSha256);
  }
  const shortFile = path.join(directory, "one-frame.tar");
  writeFileSync(shortFile, encodeDataset(captures.slice(0, 1), metadata));
  const short = run(shortFile, "one-frame");
  assert.equal(short.exit, 1);
  assert.match(short.stderr, /At least two frames/);
  assert.equal(short.report, null, "minimum-frame errors are not agreement failures");
});
