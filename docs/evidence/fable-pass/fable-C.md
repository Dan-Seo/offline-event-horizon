# Actual Fable B2/C review

B2 VERDICT: ACCEPT. C VERDICT: ACCEPT (bounded release, 아래 미검증 항목 공개 조건). 검토 리비전 64306e97bbe632a7e06006842e1f49b8d53b7520, 세션 fd835848-842d-4f9b-bfa6-9bc6cdf9304c, claude-fable-5-1, 도구 없이 제시된 diff·JSON만 검토.
B2 확인: watchUntil이 until/holdReason과 분리되고 start()에서 0으로 초기화되어 새 ride가 이전 watch를 잇지 않는다. 123행 stale 초기화만 제거되고 observe()의 stale/unsafe/reset 초기화는 유지된다. 두 회귀 테스트는 내가 B에서 지정한 21.3s 재라벨과 10.86→10.9s 회복 시나리오를 그대로 판별한다. Journey 체크는 DOM 위스퍼를 읽고 동어반복이 사라졌다.
C 확인: metrics.ts 불변, 워커·VO·맵 불변. 우/좌 홀드아웃 모두 lost 0/32, 무스케일 SE3 ATE 0.097/0.105 m over 13.2/13.5 m, RPE-t 0.157/0.191 m per 1 s, RPE-r 0.0095/0.0101 rad, 게이트 실패 없음. 진실 손상 테스트는 워커 출력과 director 명령의 deepEqual로 경계를 잡는다.
실질 이슈 (차단 아님):
1. 정렬 회전 RMS 0.381/0.448 rad는 위치만으로 맞춘 SE3 정렬을 짧은 곡선에 적용한 조건화 산물이며, RPE-r 0.01 rad가 보여주듯 추적기 heading 오차가 아니다. 보고서에서 "orientation accuracy"가 아니라 "alignment conditioning"으로만 표기할 것. 판별: 같은 클립을 두 배 길이 곡선으로 재캡처하면 값이 크게 줄어야 한다.
2. 새 진실 손상 테스트는 워커가 받지 않는 여분 키를 주입하므로 "워커가 무시함"을 증명하고, "런타임이 truth를 벗겨 보냄"은 기존 payload 테스트(perception-runtime.test.ts 242행)가 증명한다. 둘을 함께 인용해야 경계 증거가 완결된다.
3. Journey 위스퍼 체크는 영어 문자열과 `.pilgrim-whisper` 렌더 조건(panel/help 없음)에 묶여 있다. locale 변경 시 "some" 절이 거짓 실패한다. 언어 상수를 evaluate 안에서 읽거나 en-US 고정을 주석으로 명시.
미검증: replay JSON·QA-3.0-HARDENING 추가분·lifecycle.json 원본은 직접 읽지 않았다. 20회 토글 힙 19.8→28.6 MB는 대조군 결과 전까지 누수 여부 미확정. Preview 16/17의 feedback.js CSP 차단이 production에서도 발생하는지 미확인이며 Root의 zero-error 기준상 production 실측 전 통과로 표기하지 말 것. Readback p95 20.6 ms는 4 Hz 경계 아래이나 총 capture-to-command 지연이 아님.
END_REVIEW

Execution metadata (tool-reported; not backend attestation):

```json
{
  "task": "B2/C",
  "revision": "64306e97bbe632a7e06006842e1f49b8d53b7520",
  "requestedModel": "claude-fable-5-1[1m]",
  "session": "fd835848-842d-4f9b-bfa6-9bc6cdf9304c",
  "model": "claude-fable-5-1",
  "provider": "firstParty",
  "contextWindow": 1000000,
  "durationMs": 72716,
  "readOnly": true,
  "tools": [],
  "directBrowserUse": false
}
```

Astra disposition: accepted timer/recovery and boundary findings. The aligned-orientation explanation is an inference, not a separately proven cause; the suggested doubled-path experiment was NOT TESTED and heading accuracy is not claimed. Existing runtime payload exclusion and new worker truth-perturbation checks are cited together. The QA locale is already fixed to en-US; a comment now explains why.
