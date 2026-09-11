import { memo } from "react";
import { copy, type Language } from "@/universe/language";
import type { UniverseSnapshot } from "@/universe/state";
import type { ReleaseKind } from "@/universe/orbit-model";

export default memo(function GravityExperiment({
  language,
  state,
  onRelease,
  onGravity,
  onClear,
}: {
  language: Language;
  state: UniverseSnapshot;
  onRelease: (kind: ReleaseKind) => void;
  onGravity: (value: number) => void;
  onClear: () => void;
}) {
  const c = copy[language],
    experiment = state.experiment;
  return (
    <>
      <p className="eyebrow">{c.experimentTitle}</p>
      <p className="experiment-intro">{c.experimentBody}</p>
      <div className="release-options">
        {(
          [
            ["fall", c.release, "↓"],
            ["orbit", c.circular, "↻"],
            ["escape", c.escape, "↗"],
          ] as const
        ).map(([kind, label, glyph]) => (
          <button
            key={kind}
            disabled={state.paused}
            data-release={kind}
            onClick={() => onRelease(kind)}
          >
            <span aria-hidden="true">{glyph}</span>
            {label}
          </button>
        ))}
      </div>
      <label>
        {c.gravity}
        <input
          aria-label={c.gravity}
          type="range"
          min="0.4"
          max="2.5"
          step="0.1"
          value={experiment.gravity}
          onChange={(e) => onGravity(+e.target.value)}
        />
      </label>
      <div className="experiment-readout">
        <div className="experiment-status" role="status" aria-live="polite">
          {state.paused
            ? c.paused
            : experiment.launched
              ? `${experiment.active} ${c.orbitingMatter} · ${experiment.absorbed} ${c.absorbed} · ${experiment.escaped} ${c.escaped}`
              : c.noMatter}
        </div>
        <button className="muted-link" onClick={onClear}>
          {c.clear}
        </button>
      </div>
      <details>
        <summary>{c.physics}</summary>
        <p>{c.physicsBody}</p>
      </details>
    </>
  );
});
