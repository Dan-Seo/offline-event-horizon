"use client";
import type { BenchmarkMode, ExperienceEngine } from "@/experience/engine";
export default function Observatory({
  engine,
}: {
  engine: ExperienceEngine | null;
}) {
  return (
    <div className="benchmark-controls">
      <label>
        Technical scenario
        <select
          aria-label="Technical scenario"
          value={engine?.benchmarkScenario ?? "NONE"}
          onChange={(e) => engine?.benchmark(e.target.value as BenchmarkMode)}
        >
          <option value="NONE">Journey</option>
          <option value="STORM">Particle storm · 180k</option>
          <option value="GRAVITY">Three attractors</option>
          <option value="GALAXY">Galaxy</option>
          <option value="ECOSYSTEM">Ecosystem</option>
          <option value="TRANSFORMATION">Transformation loop</option>
        </select>
      </label>
      <label>
        Field strength
        <input
          aria-label="Field strength"
          type="range"
          min="0"
          max="6"
          step=".1"
          defaultValue={engine?.gravity ?? 1}
          onChange={(e) => {
            if (engine) engine.gravity = Number(e.target.value);
          }}
        />
      </label>
    </div>
  );
}
