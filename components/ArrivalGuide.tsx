import { useEffect, useRef, useState } from "react";
import { copy, GUIDE_KEY, type Language } from "@/universe/language";
import type { UniverseSnapshot } from "@/universe/state";

export function LanguageChoice({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <div
      className="language-choice"
      role="group"
      aria-label={copy[language].language}
    >
      <button
        lang="ko"
        aria-pressed={language === "ko"}
        onClick={() => onChange("ko")}
      >
        한국어
      </button>
      <span aria-hidden="true">/</span>
      <button
        lang="en"
        aria-pressed={language === "en"}
        onClick={() => onChange("en")}
      >
        English
      </button>
    </div>
  );
}

export function ArrivalGuide({
  language,
  onLanguage,
  state,
  learning,
  run,
  onActive,
  onLessonComplete,
  onWander,
  onExplore,
}: {
  language: Language;
  onLanguage: (language: Language) => void;
  state: UniverseSnapshot;
  // Read every report rather than from the snapshot: the lesson progress bar is a live value.
  learning: UniverseSnapshot["learning"];
  run: number;
  onActive: (active: boolean) => void;
  onLessonComplete: () => void;
  onWander: () => void;
  onExplore: () => void;
}) {
  const [stage, setStage] = useState<number | null>(null);
  const [touch, setTouch] = useState(false);
  const baseline = useRef(learning);
  const latest = useRef(learning);
  latest.current = learning;
  const c = copy[language];
  const carryLabel = state.pilgrimAvailable ? c.carry : c.justWander;
  useEffect(() => {
    let complete = false;
    try {
      complete = localStorage.getItem(GUIDE_KEY) === "done";
    } catch {
      /* Private browsing still gets a guide. */
    }
    setStage(run > 0 || !complete ? -1 : null);
    const media = matchMedia("(pointer: coarse)");
    const update = () => setTouch(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [run]);
  useEffect(() => {
    onActive(stage !== null);
  }, [stage, onActive]);
  useEffect(() => {
    // The next choices are real buttons. Return the cursor once the hands-on
    // lesson ends, so a first-time visitor can use them immediately.
    if (stage === 3) onLessonComplete();
  }, [stage, onLessonComplete]);
  useEffect(() => {
    baseline.current = { ...latest.current };
  }, [stage]);
  const progress =
    stage === 0
      ? learning.look - baseline.current.look
      : stage === 1
        ? learning.move - baseline.current.move
        : stage === 2
          ? learning.speed - baseline.current.speed
          : 0;
  const goal = stage === 0 ? 0.075 : stage === 1 ? 1.5 : 0.05;
  const reached = progress >= goal;
  useEffect(() => {
    if (
      stage === null ||
      stage < 0 ||
      stage > 2 ||
      !reached ||
      state.quiet
    )
      return;
    const timer = setTimeout(
      () => setStage((s) => (s === stage ? stage + 1 : s)),
      650,
    );
    return () => clearTimeout(timer);
  }, [stage, reached, goal, state.quiet]);
  function finish(next?: () => void) {
    try {
      localStorage.setItem(GUIDE_KEY, "done");
    } catch {
      /* Optional device-local preference. */
    }
    setStage(null);
    next?.();
  }
  if (stage === null || state.quiet) return null;
  const titles = [c.guideLook, c.guideMove, c.guideSpeed, c.guideDone];
  const bodies = touch
    ? [c.guideLookTouch, c.guideMoveTouch, c.guideSpeedTouch, c.guideDoneBody]
    : [c.guideLookBody, c.guideMoveBody, c.guideSpeedBody, c.guideDoneBody];
  return (
    <aside
      className={`arrival-guide${stage === -1 ? " welcome-guide" : " movement-guide"}`}
      aria-label={c.guideProgress}
      data-step={
        stage === -1
          ? "welcome"
          : stage === 3
            ? "done"
            : ["look", "move", "speed"][stage]
      }
    >
      {stage === -1 ? (
        <>
          <LanguageChoice language={language} onChange={onLanguage} />
          <h1>{c.welcome}</h1>
          <p>{c.welcomeBody}</p>
          <div className="guide-actions">
            <button className="guide-primary" onClick={() => finish(onWander)}>
              {carryLabel}
            </button>
            <button onClick={() => setStage(0)}>
              {c.learn} <span aria-hidden="true">↗</span>
            </button>
          </div>
          <button className="guide-skip" onClick={() => finish()}>
            {c.skip}
          </button>
        </>
      ) : (
        <>
          <div
            className="guide-progress"
            aria-label={`${Math.min(stage + 1, 3)} / 3`}
          >
            {[0, 1, 2].map((n) => (
              <i
                key={n}
                className={
                  n < stage || (n === stage && progress >= goal)
                    ? "complete"
                    : n === stage
                      ? "current"
                      : ""
                }
              />
            ))}
            <span>{c.guideProgress}</span>
          </div>
          <div aria-live="polite" aria-atomic="true">
            <h2>{titles[stage]}</h2>
            <p>{bodies[stage]}</p>
          </div>
          {stage === 3 ? (
            <div className="guide-actions">
              <button
                className="guide-primary"
                onClick={() => finish(onExplore)}
              >
                {c.explore} <span aria-hidden="true">↗</span>
              </button>
              <button onClick={() => finish(onWander)}>{carryLabel}</button>
              <button className="guide-skip" onClick={() => finish()}>
                {c.finish}
              </button>
            </div>
          ) : (
            <div className="guide-bottom">
              <small>{touch ? c.takeOver : c.guideHint}</small>
              <button onClick={() => finish()}>{c.skip}</button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
