"use client";
import { useEffect, useRef, useState } from "react";
import Observatory from "./Observatory";
import { CHAPTERS, DURATION, Quality } from "@/experience/timeline";
import type { ExperienceEngine, Snapshot } from "@/experience/engine";

function Icon({
  name,
}: {
  name: "sound" | "mute" | "pause" | "play" | "settings" | "close" | "arrow";
}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "arrow" ? (
        <path d="M4 12h15m-5-5 5 5-5 5" />
      ) : name === "pause" ? (
        <>
          <path d="M8 5v14M16 5v14" />
        </>
      ) : name === "play" ? (
        <path d="m8 5 11 7-11 7Z" />
      ) : name === "close" ? (
        <path d="m6 6 12 12M6 18 18 6" />
      ) : name === "settings" ? (
        <>
          <path d="M4 7h16M4 17h16" />
          <circle cx="9" cy="7" r="2.5" fill="#10171b" />
          <circle cx="15" cy="17" r="2.5" fill="#10171b" />
        </>
      ) : (
        <>
          <path d="m11 5-5 4H3v6h3l5 4Z" />
          {name === "sound" ? (
            <>
              <path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" />
            </>
          ) : (
            <path d="m16 9 5 6m0-6-5 6" />
          )}
        </>
      )}
    </svg>
  );
}
const defaults: Snapshot = {
  time: 0,
  chapter: 0,
  running: false,
  started: false,
  ready: false,
  backend: "Initializing",
  fps: 0,
  frameMs: 0,
  drawCalls: 0,
  triangles: 0,
  particles: 0,
  dpr: 1,
  quality: "HIGH",
  computeMs: 0,
  assetFallback: false,
  released: 0,
  seeds: 0,
  error: null,
};
export default function Experience() {
  const mount = useRef<HTMLDivElement>(null),
    engine = useRef<ExperienceEngine | null>(null);
  const [state, setState] = useState(defaults),
    [sound, setSound] = useState(false),
    [settings, setSettings] = useState(false),
    [hud, setHud] = useState(false),
    [reduced, setReduced] = useState(false),
    [error, setError] = useState<string | null>(null),
    [still, setStill] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const settingsWasOpen = useRef(false);
  useEffect(() => {
    let cancelled = false;
    setReduced(matchMedia("(prefers-reduced-motion: reduce)").matches);
    import("@/experience/engine")
      .then(async ({ ExperienceEngine }) => {
        if (cancelled || !mount.current) return;
        const e = new ExperienceEngine(mount.current, setState, setError);
        engine.current = e;
        await e.init();
        if (cancelled) e.dispose();
      })
      .catch((e) => setError(String(e)));
    return () => {
      cancelled = true;
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,select,textarea")) return;
      if (e.code === "Space" && !(e.target as HTMLElement).matches("button")) {
        e.preventDefault();
        engine.current?.togglePause();
      }
      if (e.key.toLowerCase() === "f") setHud((v) => !v);
      if (e.key === "ArrowRight") engine.current?.next();
      if (e.key === "Escape") setSettings(false);
      if (e.key.toLowerCase() === "r") engine.current?.releaseThought();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (settings) closeRef.current?.focus();
    else if (settingsWasOpen.current) settingsTrigger.current?.focus();
    settingsWasOpen.current = settings;
  }, [settings]);
  const toggleSound = async () => {
    const next = !sound;
    try {
      await engine.current?.audio.setEnabled(next);
      setSound(next);
    } catch {
      setSound(false);
    }
  };
  const chapter = CHAPTERS[state.chapter],
    quiet = state.time >= 277,
    stageAge = state.time - chapter.start;
  return (
    <main
      className={`experience ${state.started ? "started" : ""} ${quiet ? "quiet" : ""} ${still ? "still-mode" : ""}`}
      data-stage={chapter.name}
      data-time={state.time.toFixed(2)}
      data-ready={state.ready}
      data-backend={state.backend}
      data-paused={!state.running}
      data-released={state.released}
      data-seeds={state.seeds}
      data-asset-fallback={state.assetFallback}
    >
      <div ref={mount} className="world" />
      <div className="vignette" />
      <div className="film-grain" />
      <header className="masthead">
        <a
          className="wordmark"
          href="/"
          aria-label="Offline Event Horizon, return to beginning"
        >
          <span className="orbit-mark" />
          <span>
            OFFLINE<span className="slash"> //</span>
            <small>EVENT HORIZON</small>
          </span>
        </a>
        <div className="top-controls">
          <span className="edition">AN INTERACTIVE EXHALE</span>
          <button
            onClick={toggleSound}
            className="sound-control"
            aria-label={sound ? "Mute sound" : "Enable sound"}
            aria-pressed={sound}
          >
            <Icon name={sound ? "sound" : "mute"} />
            <span>{sound ? "Sound on" : "Sound off"}</span>
          </button>
          <span className="control-divider" />
          <button
            ref={settingsTrigger}
            className="icon-button"
            aria-label="Experience settings"
            onClick={() => setSettings((v) => !v)}
            aria-expanded={settings}
          >
            <Icon name="settings" />
          </button>
        </div>
      </header>
      {!state.ready && !error && (
        <div className="loading" role="status">
          <span className="loading-horizon" />
          <span>Leaving a little room.</span>
        </div>
      )}
      {state.ready && !state.started && !error && (
        <>
          <div className="opening-label">
            <span className="status-dot" />
            23:48
            <span className="opening-divider" />
            STILL HERE
          </div>
          <section className="opening-copy">
            <p className="eyebrow">THE DAY CAN END HERE.</p>
            <h1>
              One last thing.
              <br />
              <em>Let it go.</em>
            </h1>
            <p className="opening-sub">
              A five-minute escape from everything
              <br />
              that can wait until tomorrow.
            </p>
          </section>
          <div className="begin-wrap">
            <button
              className="begin-button"
              onClick={() => engine.current?.start()}
            >
              Go offline <Icon name="arrow" />
            </button>
            <span>
              05 MINUTES<span className="small-dot">·</span>NO DESTINATION
              REQUIRED
            </span>
          </div>
          <div className="opening-footer">
            <span>WORK → WONDER → QUIET</span>
            <span className="desktop-only">HEADPHONES, IF YOU LIKE.</span>
          </div>
        </>
      )}
      {state.started && !error && (
        <>
          <div
            className={`chapter-caption ${stageAge > 12 && state.chapter !== 7 ? "receded" : ""}`}
            key={state.chapter}
          >
            <p className="eyebrow">
              {String(state.chapter + 1).padStart(2, "0")}
              <span className="caption-dash" /> {chapter.name}
            </p>
            <h2>{chapter.title}</h2>
          </div>
          {!quiet && (
            <div className="context-prompt" key={"prompt" + state.chapter}>
              <span>{chapter.line}</span>
              {state.chapter === 2 && (
                <button onClick={() => engine.current?.releaseThought()}>
                  Release a thought <span>↗</span>
                </button>
              )}
              {state.chapter === 5 && (
                <button onClick={() => engine.current?.releaseThought()}>
                  Plant a possibility <span>+</span>
                </button>
              )}
            </div>
          )}
          <footer className="journey-footer">
            <div className="chapter-track" aria-label="Journey progress">
              {CHAPTERS.map((c, i) => (
                <button
                  key={c.name}
                  aria-label={`Go to ${c.name.toLowerCase()}`}
                  aria-current={state.chapter === i ? "step" : undefined}
                  onClick={() => engine.current?.seek(c.start + 0.1)}
                  className={i <= state.chapter ? "visited" : ""}
                >
                  <span
                    style={{
                      transform: `scaleX(${i < state.chapter ? 1 : i === state.chapter ? Math.min(1, (state.time - c.start) / (c.end - c.start)) : 0})`,
                    }}
                  />
                </button>
              ))}
            </div>
            <span className="journey-time">
              {String(Math.floor(state.time / 60)).padStart(2, "0")}:
              {String(Math.floor(state.time % 60)).padStart(2, "0")}{" "}
              <span>/ 05:00</span>
            </span>
            <button
              className="pause-button"
              onClick={() => engine.current?.togglePause()}
              aria-label={state.running ? "Pause journey" : "Resume journey"}
            >
              <Icon name={state.running ? "pause" : "play"} />
              <span>{state.running ? "Pause" : "Continue"}</span>
            </button>
          </footer>
          {quiet && (
            <div className="ending" aria-live="polite">
              <span className="eyebrow">O F F L I N E</span>
              <h2>
                Nothing needs you
                <br className="mobile-only" /> right now.
              </h2>
              <p>See you tomorrow.</p>
            </div>
          )}
        </>
      )}
      {settings && (
        <div
          className="settings"
          role="dialog"
          aria-label="Experience settings"
          onKeyDown={(e) => {
            if (e.key === "Escape") setSettings(false);
            if (e.key === "Tab") {
              const items = Array.from(
                e.currentTarget.querySelectorAll<HTMLElement>(
                  "button,input,select",
                ),
              );
              const first = items[0],
                last = items.at(-1);
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }}
        >
          <div className="settings-title">
            Make yourself comfortable.
            <button
              ref={closeRef}
              aria-label="Close settings"
              className="icon-button"
              onClick={() => setSettings(false)}
            >
              <Icon name="close" />
            </button>
          </div>
          <label>
            Detail
            <select
              aria-label="Detail"
              value={state.quality}
              onChange={(e) =>
                engine.current?.setQuality(e.target.value as Quality)
              }
            >
              {(["ULTRA", "HIGH", "BALANCED", "BATTERY"] as Quality[]).map(
                (q) => (
                  <option key={q}>{q}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Gentler motion
            <input
              type="checkbox"
              checked={reduced}
              onChange={(e) => {
                setReduced(e.target.checked);
                if (engine.current) engine.current.reduced = e.target.checked;
              }}
            />
          </label>
          <label>
            Journey pace
            <select
              aria-label="Journey pace"
              defaultValue={engine.current?.speed ?? 1}
              onChange={(e) => {
                if (engine.current)
                  engine.current.speed = Number(e.target.value);
              }}
            >
              <option value="1">Unhurried · 5 min</option>
              <option value="2">A shorter break · 2½ min</option>
              <option value=".5">Stay a little · 10 min</option>
            </select>
          </label>
          <button
            className="text-button"
            onClick={() => {
              setHud((v) => !v);
              setSettings(false);
            }}
          >
            Technical observatory <span>↗</span>
          </button>
          <div className="settings-note">
            Space to pause · → to drift onward
            <br />R to release · F for the observatory
          </div>
        </div>
      )}
      {hud && (
        <aside className="hud" aria-label="Technical benchmark">
          <div className="hud-title">
            TECHNICAL OBSERVATORY{" "}
            <button aria-label="Close benchmark" onClick={() => setHud(false)}>
              ×
            </button>
          </div>
          <dl>
            {Object.entries({
              Backend: state.backend,
              Frame: `${state.fps} fps / ${state.frameMs.toFixed(1)} ms`,
              "Draw calls": state.drawCalls,
              Triangles: state.triangles.toLocaleString(),
              Particles: state.particles.toLocaleString(),
              DPR: state.dpr.toFixed(2),
              Quality: state.quality,
              Stage: chapter.name,
              "Compute submission": `${state.computeMs.toFixed(2)} ms`,
            }).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <label>
            Inspect chapter
            <select
              aria-label="Inspect chapter"
              value={state.chapter}
              onChange={(e) =>
                engine.current?.seek(
                  CHAPTERS[Number(e.target.value)].start + 15,
                )
              }
            >
              {CHAPTERS.map((c, i) => (
                <option value={i} key={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <Observatory engine={engine.current} />
          <p>
            Physics-inspired artistic simulation.
            <br />
            Frame timing includes the browser.
          </p>
        </aside>
      )}
      {error && (
        <div className="error-state" role="alert">
          <span className="eyebrow">A QUIETER WAY IN</span>
          <h1>
            There is still room
            <br />
            to breathe.
          </h1>
          <p>
            This browser could not keep the 3D world open.
            <br />
            You can try the lighter renderer, or stay here.
          </p>
          <a
            className="begin-button"
            href={`/?backend=webgl&quality=BATTERY&t=${Math.round(state.time)}`}
          >
            Try a lighter world <Icon name="arrow" />
          </a>
          <button
            className="text-button"
            onClick={() => {
              engine.current?.dispose();
              engine.current = null;
              setStill(true);
              setError(null);
              setState((s) => ({
                ...s,
                ready: true,
                started: true,
                time: DURATION,
                chapter: 7,
                running: false,
              }));
            }}
          >
            Stay in the quiet
          </button>
          <details>
            <summary>Technical details</summary>
            {error}
          </details>
        </div>
      )}
      <div className="screen-reader" aria-live="polite">
        {state.started
          ? `${chapter.name}. ${chapter.title}`
          : "A five-minute interactive escape. Activate Go offline to begin. Sound is optional."}
      </div>
      <noscript>
        <div className="no-script">
          <h1>Nothing needs you right now.</h1>
          <p>Take a breath. This moment is yours.</p>
          <p>Enable JavaScript to explore the interactive world.</p>
        </div>
      </noscript>
    </main>
  );
}
