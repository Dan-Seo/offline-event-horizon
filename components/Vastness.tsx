"use client";
import { useEffect, useRef, useState } from "react";
import { initialSnapshot } from "@/universe/state";
import type { UniverseEngine } from "@/universe/engine";
import type { Quality } from "@/universe/config";
import type { InputAction } from "@/universe/input";
const refuges = [
  ["last-light", "The Last Light", "Water holding the sky"],
  ["moonfall", "Moonfall", "Silver water, falling softly"],
  ["forest", "The Breathing Forest", "A little light, a little life"],
  ["veil", "The Veil", "A garden held by clouds"],
  ["living-sky", "The Living Sky", "Room for a thousand quiet lives"],
];
const distant = [
  ["giant", "The Silent Giant", "Beyond the atmosphere"],
  ["wound", "The Wound", "An absence of light"],
  ["cathedral", "The Cathedral", "Something left behind"],
  ["bloom", "The Bloom", "Interstellar dust"],
];
function Mark({ kind }: { kind: "wander" | "quiet" | "settings" | "sound" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
    >
      {kind === "wander" ? (
        <>
          <path d="M2 13c4-10 6 10 10 0s6 10 10-2" />
          <path d="m18 8 4 3-3 4" />
        </>
      ) : kind === "quiet" ? (
        <circle cx="12" cy="12" r="7" />
      ) : kind === "sound" ? (
        <>
          <path d="m4 10 4 0 5-4v12l-5-4H4z" />
          <path d="M17 8q5 4 0 8" />
        </>
      ) : (
        <>
          <path d="M4 7h16M4 17h16" />
          <circle cx="9" cy="7" r="2" fill="#101e24" />
          <circle cx="15" cy="17" r="2" fill="#101e24" />
        </>
      )}
    </svg>
  );
}
export default function Vastness() {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<UniverseEngine | null>(null);
  const [state, setState] = useState(initialSnapshot),
    [panel, setPanel] = useState<string | null>(null),
    [help, setHelp] = useState(false),
    [sound, setSound] = useState(false),
    [error, setError] = useState("");
  const [gentle, setGentle] = useState(false),
    [intro, setIntro] = useState(true),
    [benchmark, setBenchmark] = useState("NONE"),
    [further, setFurther] = useState(false);
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
        if (!cancelled) setError("This quiet corner could not finish loading.");
      });
    return () => {
      cancelled = true;
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    if (!state.ready) return;
    const timer = setTimeout(() => setIntro(false), 16000);
    return () => clearTimeout(timer);
  }, [state.ready]);
  const action = (a: InputAction) => engine.current?.action(a);
  const toggle = (name: string) => setPanel((v) => (v === name ? null : name));
  return (
    <main
      className={`vastness${state.quiet ? " quiet" : ""}${state.locked ? " pointer-locked" : ""}`}
      data-ready={state.ready}
      data-backend={state.backend}
      data-mode={state.mode}
      data-paused={state.paused}
      data-seeds={state.seeds}
      data-sanctuary={state.sanctuary}
    >
      <div ref={host} className="universe-canvas" />
      <div className="vignette" aria-hidden="true" />
      <header className="masthead">
        <a href="/" aria-label="Offline Vastness home">
          OFFLINE <span>//</span> VASTNESS
        </a>
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
          <p>Take your time.</p>
        </div>
      )}
      {state.ready && (
        <>
          <div
            className={`arrival-thought${intro ? " visible" : ""}`}
            aria-hidden={!intro}
          >
            <p>Nothing needs you right now.</p>
            <span>You can stay a while.</span>
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
          {state.locked && <div className="look-dot" aria-hidden="true" />}
          {help && (
            <aside className="controls-help" aria-label="Flight controls">
              <p>Make yourself comfortable.</p>
              <div>
                <kbd>CLICK</kbd>
                <span>Take the view</span>
                <kbd>MOUSE</kbd>
                <span>Look around</span>
                <kbd>W A S D</kbd>
                <span>Move</span>
                <kbd>SCROLL</kbd>
                <span>Travel speed</span>
                <kbd>SHIFT / CTRL</kbd>
                <span>Faster / slower</span>
                <kbd>Q E</kbd>
                <span>Roll</span>
                <kbd>SPACE / X</kbd>
                <span>Rise / descend</span>
                <kbd>CLICK / F</kbd>
                <span>Select / approach</span>
                <kbd>RIGHT DRAG</kbd>
                <span>Orbit selection</span>
                <kbd>B / K</kbd>
                <span>Wander / quiet</span>
                <kbd>P / R</kbd>
                <span>Pause / return</span>
                <kbd>G / V / N</kbd>
                <span>Gather / release / light</span>
                <kbd>ESC / H</kbd>
                <span>Free cursor / help</span>
              </div>
              <small className="desktop-help">
                Click once to look freely. Esc gives you the cursor.
                <br />
                If pointer lock is unavailable, drag to look.
                <br />
                Your movement always takes over.
              </small>
              <small className="touch-help">
                Left thumb to move. Right thumb to look.
                <br />
                Pinch to change speed. Tap to select.
                <br />
                Double tap to approach.
              </small>
            </aside>
          )}
          <footer className="flight-bar">
            <div className="flight-actions">
              <button
                onClick={() => action("wander")}
                aria-pressed={state.mode === "WANDER"}
                aria-label="WANDER"
              >
                <Mark kind="wander" />
                <span>{state.mode === "WANDER" ? "WANDERING" : "WANDER"}</span>
              </button>
              <button onClick={() => action("quiet")} aria-label="QUIET">
                <Mark kind="quiet" />
                <span>QUIET</span>
              </button>
            </div>
            <div className="flight-tools">
              <button
                onClick={async () => {
                  try {
                    setSound(Boolean(await engine.current?.audio.toggle()));
                  } catch {
                    setSound(false);
                  }
                }}
                aria-label={sound ? "Mute sound" : "Enable sound"}
                aria-pressed={sound}
              >
                <Mark kind="sound" />
                <span>{sound ? "SOUND ON" : "SOUND OFF"}</span>
              </button>
              <button
                onClick={() => toggle("settings")}
                aria-label="Comfort settings"
                aria-expanded={panel === "settings"}
              >
                <Mark kind="settings" />
              </button>
            </div>
          </footer>
          <div
            className={`input-hint${intro || state.paused || state.lockFailed ? " visible" : ""}`}
            role="status"
          >
            {state.paused ? (
              "The world is resting. P to resume."
            ) : state.lockFailed ? (
              "Drag to look · WASD to move"
            ) : state.locked ? (
              "Mouse to look · Esc for the cursor"
            ) : (
              <>
                <span className="desktop-help">
                  Click to look around <b>·</b> WASD to move
                </span>
                <span className="touch-help">
                  Left thumb moves <b>·</b> Right thumb looks
                </span>
              </>
            )}
          </div>
          {panel && (
            <section
              className={`small-panel ${panel}`}
              aria-label={
                panel === "places"
                  ? "Quiet places"
                  : panel === "settings"
                    ? "Comfort settings"
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
              {panel === "settings" && (
                <>
                  <p className="eyebrow">AT YOUR OWN PACE</p>
                  <label>
                    Detail
                    <select
                      aria-label="Detail"
                      value={state.quality}
                      onChange={(e) =>
                        engine.current?.setQuality(e.target.value as Quality)
                      }
                    >
                      {["ULTRA", "HIGH", "BALANCED", "BATTERY"].map((q) => (
                        <option key={q}>{q}</option>
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
                  <button onClick={() => setPanel("places")}>
                    Find somewhere quiet <span>↗</span>
                  </button>
                  <button
                    onClick={() => {
                      action("seed");
                      setPanel(null);
                    }}
                  >
                    Leave a little light
                  </button>
                  <button onClick={() => action("pause")}>
                    {state.paused ? "Resume the world" : "Pause the world"}
                  </button>
                  <button
                    onClick={() => {
                      action("reset");
                      setPanel(null);
                    }}
                  >
                    Return to the water
                  </button>
                  <button
                    className="muted-link"
                    onClick={() => setPanel("benchmark")}
                  >
                    Technical observatory
                  </button>
                </>
              )}
              {panel === "places" && (
                <>
                  <p className="eyebrow">SOMEWHERE TO STAY</p>
                  {(further ? distant : refuges).map(([id, title, kind]) => (
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
                  <button
                    className="muted-link"
                    onClick={() => setFurther((v) => !v)}
                  >
                    {further ? "Back to the water" : "Beyond this world"}
                  </button>
                  <small>Move at any moment to take over.</small>
                </>
              )}
              {panel === "benchmark" && (
                <>
                  <p className="eyebrow">TECHNICAL OBSERVATORY</p>
                  <pre>{`${state.fps} FPS · ${state.frameMs.toFixed(2)} ms\n${state.backend} · ${state.quality}\n${state.drawCalls} draws · ${state.triangles.toLocaleString()} triangles\n${state.particles.toLocaleString()} matter particles\n${engine.current?.world.sanctuaries.life.count.toLocaleString() ?? 0} living particles\nDPR ${state.dpr.toFixed(2)} · ${state.sectors} resident sectors\n${engine.current?.world.generatedSectors ?? 0} sectors generated\nCamera-relative / logarithmic far field\n${state.nearest}\n${Math.round(state.velocity).toLocaleString()} local units / s`}</pre>
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
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <small>
                    Physics-inspired art. Frame cadence, not GPU timestamps.
                    <br />
                    Press ` to hide.
                  </small>
                </>
              )}
            </section>
          )}
          <div
            className={`touch-zones${intro ? " visible" : ""}`}
            aria-hidden="true"
          >
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
          <Mark kind="quiet" />
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
