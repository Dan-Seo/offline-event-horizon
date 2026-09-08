import type { Language } from "@/universe/language";
import type { UniverseSnapshot } from "@/universe/state";

export default function RelativityPanel({
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
      <p className="eyebrow">{ko ? "블랙홀 곁에서" : "BESIDE A BLACK HOLE"}</p>
      <h2>
        {s.ended
          ? ko
            ? "여기서 잠시 멈출게요."
            : "We will pause here."
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
            ? "이 관측은 중심에 닿기 전에 끝나요. 실제로 확인하지 못한 중심의 모습을 만들어 보여주지는 않아요."
            : "This observation ends before reaching the center. We do not invent a view of the unobserved singularity."
          : inside
            ? ko
              ? "바깥의 별빛은 계속 들어와요. 하지만 여기서 밖으로 보낸 빛은 다시 빠져나갈 수 없어요."
              : "Starlight still comes in. But light sent outward from here can no longer escape."
            : ko
              ? "밝은 가스가 돌면서 길게 흩어져요. 그 빛도 블랙홀 주변에서는 휘어져, 원반 뒤쪽이 위로 솟아 보입니다."
              : "Bright gas stretches as it orbits. Its light bends around the black hole, lifting the far side of the disk into view."}
      </p>
      <div className="relativity-actions">
        <button onClick={onGas} disabled={state.paused || s.ended}>
          {ko ? "가스 한 줄기 흘려보내기" : "Release a stream of gas"}
        </button>
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
            <option value="0.25">{ko ? "천천히" : "Slow"}</option>
            <option value="1">{ko ? "보통" : "Normal"}</option>
            <option value="4">{ko ? "빠르게" : "Fast"}</option>
          </select>
        </label>
      </div>
      <details>
        <summary>{ko ? "계산과 표현에 대해" : "About the model"}</summary>
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
        <p>
          {ko
            ? "빛의 경로는 회전하지 않는 블랙홀을 기준으로 계산해요. 가스는 중력·마찰·작은 교란을 넣은 단순화된 모형입니다. 밝기 변화에는 광원이 빛을 보낸 시각의 차이를 반영하지 않아, 실제 플라스마 영상으로 볼 수는 없어요."
            : "Light paths use a non-spinning black hole. Gas uses simplified gravity, drag and small disturbances. Variable brightness omits differences in emission time, so it is not a realistic plasma movie."}
        </p>
        <p>
          {ko
            ? "무한대에서 정지 상태로 낙하한 관측자(E=1)의 시점입니다. 각 화소의 과거 방향 광선에 슈바르츠실트 null 측지선 방정식을 적용합니다. 원반은 3–9 rₛ, 주파수 이동과 g⁴ 밝기 변화를 반영합니다. 색·광원·노출은 시각화용이며 실제 내부를 관측한 영상은 아닙니다."
            : "View from a radial E=1 infaller released from rest at infinity. Each pixel traces a past-directed Schwarzschild null geodesic. The disk spans 3–9 rₛ, with frequency shift and g⁴ intensity transfer. Sources, colors and exposure are illustrative; this is not an observed interior."}
        </p>
        <p>
          {ko
            ? "τ는 관측자의 고유시간입니다. 가까워질수록 재생을 늦추며, 조석력 비는 지평선에서의 방사 방향 값 대비 1/r³입니다. r = 0.2 rₛ에서 정지하는 것은 앱의 계산 범위이며, 물리적 경계가 아닙니다. 회전·자기장·양자중력은 포함하지 않습니다."
            : "τ is observer proper time. Playback slows near the center. The tidal ratio is radial stretching relative to its horizon value, 1/r³. Stopping at r = 0.2 rₛ is an application limit, not a physical boundary. Spin, magnetic fields and quantum gravity are omitted."}
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
