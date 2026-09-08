"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { initialSnapshot } from "@/universe/state";
import type { UniverseEngine } from "@/universe/engine";
import type { Quality } from "@/universe/config";
import type { InputAction } from "@/universe/input";
import {
  copy,
  LANGUAGE_KEY,
  preferredLanguage,
  placeText,
  refugeIds,
  distantIds,
  type Language,
} from "@/universe/language";
import { ArrivalGuide, LanguageChoice } from "./ArrivalGuide";
import GravityExperiment from "./GravityExperiment";
function Mark({
  kind,
}: {
  kind: "wander" | "quiet" | "settings" | "sound" | "explore";
}) {
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
      ) : kind === "explore" ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5z" />
        </>
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
  const [language, setLanguage] = useState<Language>("en"),
    [guideRun, setGuideRun] = useState(0),
    [guideActive, setGuideActive] = useState(true);
  const c = copy[language];
  const finishLesson = useCallback(() => {
    engine.current?.input.clear();
  }, []);
  const changeLanguage = (value: Language) => {
    setLanguage(value);
    try {
      localStorage.setItem(LANGUAGE_KEY, value);
    } catch {
      /* Device-local preference is optional. */
    }
  };
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LANGUAGE_KEY);
    } catch {
      /* Use the browser language. */
    }
    setLanguage(preferredLanguage(saved, navigator.languages));
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    host.current
      ?.querySelector("canvas")
      ?.setAttribute(
        "aria-label",
        `${c.flightControls}. ${c.dragHint}. ${c.helpLabel}: H.`,
      );
  }, [language, state.ready, c]);
  useEffect(() => {
    let cancelled = false;
    const onAction = (a: InputAction) => {
      if (a === "help") {
        setHelp((v) => !v);
        setPanel(null);
      }
      if (a === "places") {
        setPanel((v) => (v === "places" ? null : "places"));
        setHelp(false);
      }
      if (a === "experiment" && engine.current?.state.encounter === "wound") {
        setPanel((v) => (v === "experiment" ? null : "experiment"));
        setHelp(false);
      }
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
  const encounter = placeText(language, state.encounter);
  const selected = placeText(language, state.selectedId, state.selected ?? "");
  useEffect(() => {
    if (panel === "experiment" && state.encounter !== "wound") setPanel(null);
  }, [panel, state.encounter]);
  return (
    <main
      className={`vastness${state.quiet ? " quiet" : ""}${panel || help ? " has-panel" : ""}`}
      lang={language}
      data-ready={state.ready}
      data-backend={state.backend}
      data-mode={state.mode}
      data-paused={state.paused}
      data-seeds={state.seeds}
      data-sanctuary={state.sanctuary}
      data-encounter={state.encounter}
    >
      <div ref={host} className="universe-canvas" />
      <div className="vignette" aria-hidden="true" />
      <header className="masthead">
        <a href="/" aria-label={c.home}>
          OFFLINE <span>//</span> VASTNESS
        </a>
        <button
          onClick={() => action("help")}
          aria-label={c.helpLabel}
          aria-pressed={help}
        >
          H <span>{c.help}</span>
        </button>
      </header>
      {!state.ready && !error && (
        <div className="arrival" role="status">
          <p>{c.loading}</p>
        </div>
      )}
      {state.ready && (
        <>
          <div
            className={`arrival-thought${intro && !guideActive && !state.encounter && !panel && !help ? " visible" : ""}`}
            aria-hidden={!intro || guideActive || !!state.encounter || !!panel || help}
          >
            <p>{c.thought}</p>
            <span>{c.stay}</span>
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
                {selected.name}
                <small>{selected.kind || state.selectedKind}</small>
              </span>
            </div>
          )}
          {help && (
            <aside className="controls-help" aria-label={c.flightControls}>
              <p>{c.guideTitle}</p>
              <div>
                {[
                  "DRAG",
                  "W A S D",
                  "SCROLL",
                  "SHIFT / CTRL",
                  "Q E",
                  "SPACE / X",
                  "CLICK / F",
                  "RIGHT DRAG",
                  "B / K",
                  "P / R",
                  "G / V / N",
                  "M / O / T",
                  "ESC / H",
                ].map((key, i) => (
                  <div className="control-row" key={key}>
                    <kbd>{key}</kbd>
                    <span>{c.controls[i]}</span>
                  </div>
                ))}
              </div>
              <small className="desktop-help">{c.desktopHelp}</small>
              <small className="touch-help">{c.touchHelp}</small>
              <button
                className="replay-guide"
                onClick={() => {
                  setHelp(false);
                  setGuideRun((v) => v + 1);
                  engine.current?.flight.cancel();
                }}
              >
                {c.replay} ↗
              </button>
            </aside>
          )}
          <footer className="flight-bar">
            <div className="flight-actions">
              <button
                onClick={() => action("wander")}
                aria-pressed={state.mode === "WANDER"}
                aria-label={c.wander}
              >
                <Mark kind="wander" />
                <span>{state.mode === "WANDER" ? c.wandering : c.wander}</span>
              </button>
              <button onClick={() => action("quiet")} aria-label={c.quiet}>
                <Mark kind="quiet" />
                <span>{c.quiet}</span>
              </button>
              <button
                onClick={() => action("places")}
                aria-label={c.exploreLabel}
                aria-expanded={panel === "places"}
              >
                <Mark kind="explore" />
                <span>{c.explore}</span>
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
                aria-label={sound ? c.mute : c.enableSound}
                aria-pressed={sound}
              >
                <Mark kind="sound" />
                <span>{sound ? c.soundOn : c.soundOff}</span>
              </button>
              <button
                onClick={() => toggle("settings")}
                aria-label={c.settings}
                aria-expanded={panel === "settings"}
              >
                <Mark kind="settings" />
              </button>
            </div>
          </footer>
          <div
            className={`input-hint${(!guideActive && intro) || state.paused ? " visible" : ""}`}
            role="status"
          >
            {state.paused ? (
              c.paused
            ) : (
              <>
                <span className="desktop-help">{c.dragHint}</span>
                <span className="touch-help">{c.touchHint}</span>
              </>
            )}
          </div>
          {panel && (
            <section
              className={`small-panel ${panel}`}
              aria-label={
                panel === "places"
                  ? c.places
                  : panel === "settings"
                    ? c.settings
                    : panel === "experiment"
                      ? c.experimentLabel
                      : c.technicalLabel
              }
            >
              <button
                className="close-panel"
                onClick={() => setPanel(null)}
                aria-label={c.close}
              >
                ×
              </button>
              {panel === "settings" && (
                <>
                  <p className="eyebrow">{c.atYourPace}</p>
                  <LanguageChoice
                    language={language}
                    onChange={changeLanguage}
                  />
                  <label>
                    {c.detail}
                    <select
                      aria-label={c.detail}
                      value={state.quality}
                      onChange={(e) =>
                        engine.current?.setQuality(e.target.value as Quality)
                      }
                    >
                      {["ULTRA", "HIGH", "BALANCED", "BATTERY"].map((q) => (
                        <option key={q} value={q}>
                          {c.quality[q as Quality]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {c.sensitivity}
                    <input
                      aria-label={c.sensitivity}
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
                    {c.gentle}
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
                    {c.findQuiet} <span>↗</span>
                  </button>
                  <button
                    onClick={() => {
                      action("seed");
                      setPanel(null);
                    }}
                  >
                    {c.seed}
                  </button>
                  <button onClick={() => action("pause")}>
                    {state.paused ? c.resume : c.pause}
                  </button>
                  <button
                    onClick={() => {
                      action("reset");
                      setPanel(null);
                    }}
                  >
                    {c.reset}
                  </button>
                  <button
                    className="muted-link"
                    onClick={() => setPanel("benchmark")}
                  >
                    {c.observatory}
                  </button>
                </>
              )}
              {panel === "places" && (
                <>
                  <p className="eyebrow">{further ? c.beyond : c.somewhere}</p>
                  {(further ? distantIds : refugeIds).map((id) => (
                    <button
                      className="destination"
                      key={id}
                      data-destination={id}
                      onClick={() => {
                        engine.current?.select(id, true);
                        setIntro(false);
                        setPanel(null);
                      }}
                    >
                      <span>
                        {placeText(language, id).name}
                        <small>{placeText(language, id).kind}</small>
                      </span>
                      <span>↗</span>
                    </button>
                  ))}
                  <button
                    className="muted-link"
                    onClick={() => setFurther((v) => !v)}
                  >
                    {further ? c.backWater : c.beyond}
                  </button>
                  <small>{c.takeOver}</small>
                </>
              )}
              {panel === "experiment" && (
                <GravityExperiment
                  language={language}
                  state={state}
                  onRelease={(kind) => engine.current?.releaseMatter(kind)}
                  onGravity={(value) => engine.current?.setGravity(value)}
                  onClear={() => engine.current?.clearExperiment()}
                />
              )}
              {panel === "benchmark" && (
                <>
                  <p className="eyebrow">{c.technical}</p>
                  <pre>{`${state.fps} FPS · ${state.frameMs.toFixed(2)} ms\n${state.backend} · ${c.quality[state.quality]}\n${state.drawCalls} ${c.draws} · ${state.triangles.toLocaleString()} ${c.triangles}\n${state.particles.toLocaleString()} ${c.particles}\n${engine.current?.world.sanctuaries.life.count.toLocaleString() ?? 0} ${c.life}\nDPR ${state.dpr.toFixed(2)} · ${state.sectors} ${c.resident}\n${engine.current?.world.generatedSectors ?? 0} ${c.generated}\n${c.coordinates}\n${state.nearest}\n${Math.round(state.velocity).toLocaleString()} ${c.localUnits}`}</pre>
                  <label>
                    {c.stress}
                    <select
                      aria-label={c.scenario}
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
                  <small>{c.technicalNote}</small>
                </>
              )}
            </section>
          )}
          <ArrivalGuide
            language={language}
            onLanguage={changeLanguage}
            state={state}
            run={guideRun}
            onActive={setGuideActive}
            onLessonComplete={finishLesson}
            onWander={() => {
              engine.current?.input.clear();
              action("wander");
            }}
            onExplore={() => action("places")}
          />
          {!guideActive &&
            !panel &&
            !help &&
            state.encounter &&
            encounter.description && (
              <aside className="encounter-note" aria-label={encounter.name}>
                <p className="eyebrow">{encounter.kind}</p>
                <h2>{encounter.name}</h2>
                <p>{encounter.description}</p>
                {state.encounter === "wound" ? (
                  <button onClick={() => action("experiment")}>
                    {c.experiment} <span aria-hidden="true">↗</span>
                  </button>
                ) : (
                  <button onClick={() => action("orbit")}>
                    {state.mode === "ORBIT" ? c.orbiting : c.orbit}{" "}
                    <span aria-hidden="true">↻</span>
                  </button>
                )}
                <small>
                  {state.encounter === "wound"
                    ? c.experimentHint
                    : c.freeFlight}
                </small>
              </aside>
            )}
          <div
            className={`touch-zones${intro && !guideActive ? " visible" : ""}`}
            aria-hidden="true"
          >
            <span>{c.move}</span>
            <span>{c.look}</span>
          </div>
        </>
      )}
      {state.quiet && (
        <button
          className="leave-quiet"
          onClick={() => action("quiet")}
          aria-label={c.leaveQuiet}
        >
          <Mark kind="quiet" />
        </button>
      )}
      {error && (
        <div className="error-state" role="alert">
          <p>{c.errorTitle}</p>
          <small>{c.errorBody}</small>
          <a href="/?backend=webgl&quality=BATTERY">{c.retry}</a>
        </div>
      )}
    </main>
  );
}
