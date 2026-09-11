import { memo } from "react";
import { copy, type Language } from "@/universe/language";
import type { UniverseSnapshot } from "@/universe/state";

export default memo(function RelativityPanel({
  language,
  state,
  onExit,
  onRate,
  onPause,
  onGas,
}: {
  language: Language;
  state: UniverseSnapshot;
  onExit: () => void;
  onRate: (rate: number) => void;
  onPause: () => void;
  onGas: () => void;
}) {
  const c = copy[language],
    s = state.relativity;
  const inside = s.radius < 1;
  return (
    <aside className="relativity-note" aria-label={c.relativityLabel}>
      <p className="eyebrow">{c.relativityEyebrow}</p>
      <h2>
        {s.ended
          ? c.relativityEndedTitle
          : inside
            ? c.relativityInsideTitle
            : c.relativityOutsideTitle}
      </h2>
      <p>
        {s.ended
          ? c.relativityEndedBody
          : inside
            ? c.relativityInsideBody
            : c.relativityOutsideBody}
      </p>
      <div className="relativity-actions">
        <button onClick={onGas} disabled={state.paused || s.ended}>
          {c.releaseGas}
        </button>
        <button onClick={onPause}>
          {state.paused ? c.observationResume : c.observationPause}
        </button>
        <label>
          {c.playback}{" "}
          <select
            aria-label={c.playbackLabel}
            value={s.rate}
            onChange={(e) => onRate(+e.target.value)}
          >
            <option value="0.25">{c.playbackSlow}</option>
            <option value="1">{c.playbackNormal}</option>
            <option value="4">{c.playbackFast}</option>
          </select>
        </label>
      </div>
      <details>
        <summary>{c.aboutModel}</summary>
        <div className="relativity-readings" aria-label={c.observations}>
          <span>
            r / rₛ <b>{s.radius.toFixed(3)}</b>
          </span>
          <span>
            τ / (rₛ/c) <b>{s.properTime.toFixed(3)}</b>
          </span>
          <span>
            {c.tidalRatio} <b>{s.radialTide.toFixed(2)}</b>
          </span>
        </div>
        <p>{c.relativityModelBody}</p>
        <p>{c.relativityViewBody}</p>
        <p>{c.relativityLimitsBody}</p>
        <a
          href="https://jila.colorado.edu/~ajsh/insidebh/schw.html"
          target="_blank"
          rel="noreferrer"
        >
          JILA · {c.insideBlackHole} ↗
        </a>
        <a
          href="https://arxiv.org/abs/gr-qc/0411060"
          target="_blank"
          rel="noreferrer"
        >
          Hamilton & Lisle · River model ↗
        </a>
      </details>
      <button className="exit-observation" onClick={onExit}>
        {c.endObservation} ↗
      </button>
      <small>{c.observationHint}</small>
    </aside>
  );
});
