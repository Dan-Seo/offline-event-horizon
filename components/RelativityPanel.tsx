import type { Language } from "@/universe/language";
import type { UniverseSnapshot } from "@/universe/state";

export default function RelativityPanel({
  language,
  state,
  onExit,
  onRate,
  onPause,
}: {
  language: Language;
  state: UniverseSnapshot;
  onExit: () => void;
  onRate: (rate: number) => void;
  onPause: () => void;
}) {
  const ko = language === "ko",
    s = state.relativity;
  const inside = s.radius < 1;
  return (
    <aside
      className="relativity-note"
      aria-label={
        ko ? "일반상대론 자유낙하 관측" : "Relativistic freefall observation"
      }
    >
      <p className="eyebrow">
        SCHWARZSCHILD · {ko ? "자유낙하 관측" : "FREEFALL OBSERVATION"}
      </p>
      <h2>
        {s.ended
          ? ko
            ? "계산은 여기서 멈춰요."
            : "Our calculation stops here."
          : inside
            ? ko
              ? "지평선 너머에도 빛은 닿아요."
              : "Light still reaches you here."
            : ko
              ? "빛을 따라, 지평선 안으로."
              : "Following light beyond the horizon."}
      </h2>
      <p>
        {s.ended
          ? ko
            ? "r = 0.2 rₛ에서 관측을 정지했어요. 계산 범위로 정한 지점이며, 물리적 경계가 아닙니다. r = 0의 특이점은 재현하지 않습니다."
            : "Observation stopped at r = 0.2 rₛ, our chosen calculation limit, not a physical boundary. The singularity at r = 0 is not rendered."
          : inside
            ? ko
              ? "바깥에서 오는 빛은 여전히 보이지만, 미래로 향하는 모든 경로는 더 작은 반지름으로 이어집니다."
              : "You can still see incoming light. Every future-directed path now leads toward smaller radius."
            : ko
              ? "회전·전하가 없는 이상적인 블랙홀입니다. 지평선은 벽이 아니며 통과하는 순간 섬광이 생기지 않습니다."
              : "An ideal black hole with no spin or charge. The horizon is not a wall, and crossing it creates no flash."}
      </p>
      <div
        className="relativity-readings"
        aria-label={ko ? "관측값" : "Observations"}
      >
        <span>
          r / rₛ <b>{s.radius.toFixed(3)}</b>
        </span>
        <span>
          τ / (rₛ/c) <b>{s.properTime.toFixed(3)}</b>
        </span>
        <span>
          {ko ? "조석력 비" : "Tidal ratio"} <b>{s.radialTide.toFixed(2)}</b>
        </span>
      </div>
      <div className="relativity-actions">
        <button onClick={onPause}>
          {state.paused
            ? ko
              ? "계속 관측"
              : "Resume"
            : ko
              ? "잠시 멈추기"
              : "Pause"}
        </button>
        <label>
          {ko ? "재생" : "Playback"}{" "}
          <select
            aria-label={ko ? "관측 재생 속도" : "Observation playback speed"}
            value={s.rate}
            onChange={(e) => onRate(+e.target.value)}
          >
            <option value="0.25">× 0.25</option>
            <option value="1">× 1</option>
            <option value="4">× 4</option>
          </select>
        </label>
      </div>
      <details>
        <summary>{ko ? "무엇을 계산하나요?" : "What is calculated?"}</summary>
        <p>
          {ko
            ? "무한대에서 정지 상태로 낙하한 관측자(E=1)의 시점입니다. 각 화소의 과거 방향 광선에 슈바르츠실트 null 측지선 방정식을 적용합니다. 원반은 3–9 rₛ, 주파수 이동과 g⁴ 밝기 변화를 반영합니다. 색·광원·노출은 시각화용이며 실제 내부를 관측한 영상은 아닙니다."
            : "View from a radial E=1 infaller released from rest at infinity. Each pixel traces a past-directed Schwarzschild null geodesic. The disk spans 3–9 rₛ, with frequency shift and g⁴ intensity transfer. Sources, colors and exposure are illustrative; this is not an observed interior."}
        </p>
        <p>
          {ko
            ? "τ는 관측자의 고유시간입니다. 가까워질수록 재생을 늦추며, 조석력 비는 지평선에서의 방사 방향 값 대비 1/r³입니다. 회전, 실제 별의 붕괴, 플라스마 역학과 양자중력은 포함하지 않습니다."
            : "τ is observer proper time. Playback slows near the center. The tidal ratio is radial stretching relative to its horizon value, 1/r³. Spin, stellar collapse, plasma dynamics and quantum gravity are omitted."}
        </p>
        <a
          href="https://jila.colorado.edu/~ajsh/insidebh/schw.html"
          target="_blank"
          rel="noreferrer"
        >
          JILA ·{" "}
          {ko ? "블랙홀 내부 시각화" : "Inside a Schwarzschild black hole"} ↗
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
        {ko ? "관측을 마치고 돌아가기" : "End observation and return"} ↗
      </button>
      <small>
        {ko
          ? "드래그: 둘러보기 · WASD / Esc: 종료. 돌아가기는 시뮬레이션 복귀이며 실제 탈출이 아닙니다."
          : "Drag to look · WASD / Esc to end. Returning resets the observation; it is not a physical escape."}
      </small>
    </aside>
  );
}
