"use client";
import { useEffect, useRef, useState } from "react";
import { initialSnapshot } from "@/universe/state";
import type { UniverseEngine } from "@/universe/engine";
import type { Quality } from "@/universe/config";
import type { InputAction } from "@/universe/input";
const destinations = [
  ["orpheus", "Orpheus IV", "Ocean world"],
  ["giant", "The Silent Giant", "Ringed giant"],
  ["wound", "The Wound", "Gravitational anomaly"],
  ["cathedral", "The Cathedral", "Ancient structure"],
  ["bloom", "The Bloom", "Luminous nebula"],
  ["ember", "Ember", "Volcanic world"],
];
export default function Vastness() {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<UniverseEngine | null>(null);
  const [state, setState] = useState(initialSnapshot),
    [panel, setPanel] = useState<string | null>(null),
    [help, setHelp] = useState(true),
    [sound, setSound] = useState(false),
    [error, setError] = useState("");
  const [gentle, setGentle] = useState(false),
    [creation, setCreation] = useState(false);
  const [benchmark, setBenchmark] = useState("NONE");
  useEffect(() => {
    let cancelled = false;
    const onAction = (a: InputAction) => {
      if (a === "help") setHelp((v) => !v);
      if (a === "hud")
        setPanel((v) => (v === "benchmark" ? null : "benchmark"));
      if (a === "cancel") {
        setPanel(null);
        setHelp(false);
      }
    };
    void import("@/universe/engine")
      .then(({ UniverseEngine }) => {
        if (cancelled || !host.current) return;
        const instance = new UniverseEngine(
          host.current,
          setState,
          onAction,
          setError,
        );
        engine.current = instance;
        void instance.init();
        setGentle(matchMedia("(prefers-reduced-motion: reduce)").matches);
      })
      .catch(() => {
        if (!cancelled)
          setError("The universe could not finish loading. Please try again.");
      });
    return () => {
      cancelled = true;
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    if (!state.ready) return;
    const id = setTimeout(() => setHelp(false), 12000);
    return () => clearTimeout(id);
  }, [state.ready]);
  const action = (a: InputAction) => {
    engine.current?.action(a);
  };
  const toggle = (name: string) => setPanel((v) => (v === name ? null : name));
  return (
    <main
      className={`vastness${state.quiet ? " quiet" : ""}`}
      data-ready={state.ready}
      data-backend={state.backend}
      data-mode={state.mode}
      data-paused={state.paused}
      data-seeds={state.seeds}
    >
      <div ref={host} className="universe-canvas" />
      <div className="vignette" aria-hidden="true" />
      <header className="masthead">
        <a href="/" aria-label="Offline Vastness home">
          OFFLINE <span>//</span> VASTNESS
        </a>
        <span className="header-note">NOWHERE TO BE. NOTHING TO FINISH.</span>
        <button
          onClick={() => setHelp((v) => !v)}
          aria-label="Controls help"
          aria-pressed={help}
        >
          H <span>HELP</span>
        </button>
      </header>
      {!state.ready && !error && (
        <div className="arrival" role="status">
          <div className="arrival-orbit" />
          <p>Making room.</p>
        </div>
      )}
      {state.ready && (
        <>
          <div className="place">
            <span className="eyebrow">
              {state.mode === "DRIFT"
                ? "DRIFTING NEAR"
                : state.mode === "TRAVEL"
                  ? "ON YOUR WAY"
                  : "SOMEWHERE NEAR"}
            </span>
            <p>{state.mode === "TRAVEL" ? state.selected : state.nearest}</p>
            <span className="place-line">
              You can stay as long as you like.
            </span>
          </div>
          {state.selectionVisible && (
            <div
              className="focus-marker"
              style={{
                left: `${state.selectionX}%`,
                top: `${state.selectionY}%`,
              }}
            >
              <i />
              <span>
                {state.selected}
                <small>{state.selectedKind}</small>
              </span>
            </div>
          )}
          {help && (
            <aside className="controls-help" aria-label="Flight controls">
              <p>GO ANYWHERE.</p>
              <div>
                <kbd>W A S D</kbd>
                <span>Move</span>
                <kbd>MOUSE</kbd>
                <span>Look around</span>
                <kbd>SCROLL</kbd>
                <span>Travel speed</span>
                <kbd>SHIFT / CTRL</kbd>
                <span>Boost / precision</span>
                <kbd>Q E · SPACE X</kbd>
                <span>Roll · rise / descend</span>
                <kbd>CLICK · F</kbd>
                <span>Select · approach</span>
                <kbd>LEFT DRAG</kbd>
                <span>Orbit selection</span>
                <kbd>G / V</kbd>
                <span>Attract / repel matter</span>
                <kbd>P · R · ESC</kbd>
                <span>Pause · recover · cancel</span>
                <kbd>B · K · H</kbd>
                <span>Drift · quiet · help</span>
              </div>
              <small className="touch-help">
                Left thumb to move. Right thumb to look.
                <br />
                Pinch to change speed. Double tap to approach.
              </small>
              <small className="desktop-help">
                L locks the pointer. Esc releases it.
                <br />
                Your movement always takes over.
              </small>
            </aside>
          )}
          <footer className="flight-bar">
            <div className="flight-actions">
              <button
                onClick={() => action("drift")}
                aria-pressed={state.mode === "DRIFT"}
              >
                ↝ <span>DRIFT</span>
              </button>
              <button
                onClick={() => toggle("places")}
                aria-expanded={panel === "places"}
              >
                ⌖ <span>PLACES</span>
              </button>
              <button
                onClick={() => {
                  setCreation((v) => !v);
                  setPanel(null);
                }}
                aria-pressed={creation}
              >
                ＋ <span>CREATE</span>
              </button>
              <button onClick={() => action("quiet")}>
                ○ <span>QUIET</span>
              </button>
            </div>
            <div className="flight-tools">
              <button
                onClick={async () => {
                  const enabled = await engine.current?.audio.toggle();
                  setSound(Boolean(enabled));
                }}
                aria-label={sound ? "Mute sound" : "Enable sound"}
                aria-pressed={sound}
              >
                {sound ? "SOUND ON" : "SOUND OFF"}
              </button>
              <button
                onClick={() => toggle("settings")}
                aria-label="Flight settings"
              >
                ⚙
              </button>
            </div>
          </footer>
          <div className="speed-hint" aria-hidden="true">
            <span>{state.mode === "FREE" ? "FREE FLIGHT" : state.mode}</span>
            <i
              style={{
                width: `${Math.min(70, 10 + Math.log2(1 + state.speedDial) * 12)}px`,
              }}
            />
            {state.paused && <span>SIMULATION PAUSED</span>}
          </div>
          {creation && (
            <div className="creation-bar">
              <p>A small beginning.</p>
              <button onClick={() => action("seed")}>
                Plant a star <span>N</span>
              </button>
              <button
                onPointerDown={() => engine.current?.input.keys.add("KeyG")}
                onPointerUp={() => engine.current?.input.keys.delete("KeyG")}
                onPointerLeave={() => engine.current?.input.keys.delete("KeyG")}
                onPointerCancel={() =>
                  engine.current?.input.keys.delete("KeyG")
                }
              >
                Hold to gather
              </button>
              <small>
                {state.seeds
                  ? `${state.seeds} ${state.seeds === 1 ? "star" : "stars"} left in the quiet.`
                  : "Matter remembers your touch."}
              </small>
            </div>
          )}
          {panel && (
            <section
              className={`small-panel ${panel}`}
              aria-label={
                panel === "places"
                  ? "Places to discover"
                  : panel === "settings"
                    ? "Flight settings"
                    : "Technical benchmark"
              }
            >
              <button
                className="close-panel"
                onClick={() => setPanel(null)}
                aria-label="Close panel"
              >
                ×
              </button>
              {panel === "places" && (
                <>
                  <p className="eyebrow">A FEW PLACES IN THE INFINITE</p>
                  {destinations.map(([id, title, kind]) => (
                    <button
                      className="destination"
                      key={id}
                      onClick={() => {
                        engine.current?.select(id, true);
                        setPanel(null);
                      }}
                    >
                      <span>
                        {title}
                        <small>{kind}</small>
                      </span>
                      <span>↗</span>
                    </button>
                  ))}
                  <small>Move at any moment to take over.</small>
                </>
              )}
              {panel === "settings" && (
                <>
                  <p className="eyebrow">MAKE YOURSELF COMFORTABLE</p>
                  <label>
                    Detail
                    <select
                      aria-label="Detail"
                      value={state.quality}
                      onChange={(e) =>
                        engine.current?.setQuality(e.target.value as Quality)
                      }
                    >
                      {["ULTRA", "HIGH", "BALANCED", "BATTERY"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Look sensitivity
                    <input
                      aria-label="Look sensitivity"
                      type="range"
                      min="0.3"
                      max="2"
                      step="0.1"
                      defaultValue="1"
                      onChange={(e) => {
                        if (engine.current)
                          engine.current.flight.sensitivity = +e.target.value;
                      }}
                    />
                  </label>
                  <label>
                    Gentler movement
                    <input
                      type="checkbox"
                      checked={gentle}
                      onChange={(e) => {
                        setGentle(e.target.checked);
                        if (engine.current)
                          engine.current.flight.gentle = e.target.checked;
                      }}
                    />
                  </label>
                  <button onClick={() => action("pause")}>
                    {state.paused ? "Resume simulation" : "Pause simulation"}
                  </button>
                  <button onClick={() => action("reset")}>
                    Return to a safe orbit
                  </button>
                  <button onClick={() => setPanel("benchmark")}>
                    Technical observatory ↗
                  </button>
                  <small>
                    Physics-inspired interactive art.
                    <br />
                    No astrophysical accuracy is implied.
                  </small>
                </>
              )}
              {panel === "benchmark" && (
                <>
                  <p className="eyebrow">TECHNICAL OBSERVATORY</p>
                  <pre>{`${state.fps} FPS · ${state.frameMs.toFixed(2)} ms\n${state.backend} · ${state.quality}\n${state.drawCalls} draws · ${state.triangles.toLocaleString()} triangles\n${state.particles.toLocaleString()} simulated particles\nDPR ${state.dpr.toFixed(2)} · ${state.sectors} resident sectors\n${engine.current?.world.generatedSectors ?? 0} sectors generated\nCamera-relative / logarithmic far field\n${Math.round(state.velocity).toLocaleString()} local units / s\n${engine.current?.matter.computeMs.toFixed(3) ?? 0} ms compute submission`}</pre>
                  <label>
                    Stress field
                    <select
                      aria-label="Technical scenario"
                      value={benchmark}
                      onChange={(e) => {
                        setBenchmark(e.target.value);
                        engine.current?.benchmark(e.target.value);
                      }}
                    >
                      {[
                        "NONE",
                        "PARTICLES",
                        "NEBULA",
                        "ASTEROIDS",
                        "GRAVITY",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <small>
                    Frame cadence and CPU submission time,
                    <br />
                    not GPU timestamps. Press ` to hide.
                  </small>
                </>
              )}
            </section>
          )}
          <div className="touch-zones" aria-hidden="true">
            <span>MOVE</span>
            <span>LOOK</span>
          </div>
        </>
      )}
      {state.quiet && (
        <button
          className="leave-quiet"
          onClick={() => action("quiet")}
          aria-label="Leave quiet mode"
        >
          ○
        </button>
      )}
      {error && (
        <div className="error-state" role="alert">
          <p>There is still room for quiet.</p>
          <small>{error}</small>
          <a href="/?backend=webgl&quality=BATTERY">Try lighter graphics</a>
        </div>
      )}
    </main>
  );
}
