# Fable gate B verdict

- task_id: vastness-20260922-B
- reviewed revision: a75f9f5ad49741d37025b892e126197ff1ae63d9 (baseline 9e02ad6, one commit "fix: distinguish scenic rests from failed Carry searches", HEAD at review time, tree clean)
- reviewer session: fd835848-842d-4f9b-bfa6-9bc6cdf9304c (Claude Code 2.1.278, claude-fable-5-1, effort max)
- scope: read-only diff, test, QA script, doc and screenshot review. No product file changed. This file is the only write.

## VERDICT: REVISE

A2의 핵심 계약은 정확히 구현되어 있고 테스트로 확인된다. 아래 코드 결함 2건과 문서 1건을 고친 뒤 C로 넘기면 된다. 안전, 수동 우선, 유계 재시도, 센서 기하, 소스 수학은 모두 보존됐다.

## A2 대비 확인된 사항

- LOST 동결 포즈 무시와 segment 전환 시 앵커 초기화: director.ts stalled() 90~112행. 테스트 "LOST bookkeeping poses and new VO gauges never imply a held hull" 통과.
- 현재 깊이 폴백 속도 4 u/s 이하 유지, reason "following current depth": director.ts 157~158행. map.ts 미변경.
- stops는 완주 휴식만, holds는 실패 스캔만: director.ts 146행, 165행. 기존 스캔 테스트에 stops=0, holds>=2 단언 추가.
- 서로 다른 capture id 2회로만 no-route/tracking-lost 홀드 종료, 같은 id 중복 불가, stall 홀드는 지름길 없음: observe() 78~81행, update() 127~133행. 스캔 원인 래치는 136~138행에서 스캔 시작 시 또는 stalled일 때만 대입되므로 추적 손실로 stallTime이 0이 되어도 "stalled"가 지워지지 않는다. 테스트 "A genuinely held hull keeps its cooldown" 통과. 질문 답: 래치는 추적 손실을 견딘다.
- 물리 resting, UI intentionalRest, 센서 slowSensing 분리: director.ts 40~46행, engine.ts 859~860행, system.ts 231행. 초기 "looking"과 "waiting for a fresh view"는 전체 케이던스.
- 진실 섭동: perception-runtime.test.ts에서 실제 8프레임 픽스처에 손상된 truth/labels/normals를 붙여도 워커 결과와 director 명령이 동일함을 검증. 진실 경로 추가 없음.
- 증거 상태: candidate-tests.log 93/93 pass, lint 출력 없음, build 정적 라우트 생성. candidate-journey.log는 완료된 실행이며 17/17 PASS, 120초 Carry에서 distance 142.5, stops 1, holds 0.

## 실질 이슈 (최대 3)

### 1. beauty 이벤트가 실패 탐색 홀드를 scenic 휴식으로 바꾼다 (계약 위반, 코드)

- 위치: director.ts update() 116~119행. beauty가 참이면 holdReason을 무조건 "watching"으로 덮어쓴다.
- 시나리오: "blocked" cooldown이 T+45까지인 상태에서 T+5에 beauty 이벤트가 6초 지속. holdReason이 "watching"이 되고 until은 그대로 T+45. 이벤트가 끝난 T+11부터 T+45까지 hold("watching")이 이어져 intentionalRest가 참이 되고 stayHere 위스퍼가 표시되며, 127~132행의 2회 safe 관측 지름길도 닫힌다. "blocked/stale states cannot claim scenic rest" 수용 기준 위반.
- 수정: 별도 watchUntil을 두고 beauty 시 watchUntil = max(watchUntil, time+14)만 갱신한다. until 검사 전에 time < watchUntil이면 hold("watching"), 아니면 기존 holdReason으로 진행. holdReason은 건드리지 않는다. 약 4줄.
- 판별 테스트: blocked cooldown 진입 후 beauty=true 프레임 3개, 이후 beauty=false. 14초 뒤 reason이 "blocked"로 복귀하고 intentionalRest가 거짓이며, 서로 다른 safe 관측 2회로 throttle>0이 되는지 단언. 현재 구현은 실패한다.

### 2. 4 Hz 뷰포트에서 2회 safe 관측 지름길이 사실상 도달 불가 (기기 클래스 계약 공백, 코드)

- 위치: director.ts 123행이 stale 프레임마다 safeViews를 0으로 되돌린다. blocked 홀드는 slowSensing이 참이라(43~46행 → system.ts 231행 → runtime.ts 161~162행) 캡처 간격이 min(4/frequency, 0.8)이다. 4 Hz면 0.8초.
- 결과: readback+분석 지연이 50 ms를 넘으면 다음 캡처가 도착하기 전에 직전 관측이 0.85초 창을 넘겨 stale이 되고, 123행이 스트릭을 0으로 되돌린다. 스트릭은 1을 넘지 못하고 홀드는 항상 30~60초를 채운다. 8 Hz 데스크톱은 간격 0.5초라 영향 없음.
- 수정: 123행의 초기화를 삭제한다. observe() 73~80행이 이미 stale 수신과 non-safe 캡처에서 0으로 되돌리므로 "연속된 서로 다른 신선한 safe 캡처" 의미는 유지된다. 임계값 변경 없음.
- 판별 테스트: blocked 홀드 중 observe(a1, 10.0), update(10.86), observe(a2, 10.9), update(10.9). id가 다른 두 safe 캡처가 각각 수신 시점에 신선하므로 두 번째 뒤 throttle>0이어야 한다. 현재 구현은 실패한다. C의 4 Hz 수명주기 증거에서 readbackMs p95를 함께 기록해 50 ms 경계를 확인할 것.

### 3. 문서가 증거보다 앞선다 (문서)

- 위치: docs/PILGRIM.md replay 문단이 "the September 22 turning capture produces a conditioned unscaled SE(3) alignment (see the appended pass in QA-3.0-HARDENING.md)"라고 쓴다.
- 사실: a75f9f5의 docs/QA-3.0-HARDENING.md에는 해당 pass가 없고, Astra 보고대로 replay는 아직 진행 중이다. 미션의 "source evidence outranks claims"에 어긋난다.
- 수정: C에서 replay 결과와 함께 QA 기록을 같은 커밋에 넣거나, 그때까지 문장을 "pending"으로 바꾼다.

## 더 단순한 대안

이슈 1은 watchUntil 한 필드로 끝난다. 이슈 2는 한 줄 삭제다. 그 외 구조는 그대로 두면 된다. journey의 새 체크 "Carry only presents deliberate pauses as scenic rest"는 getter 정의를 스스로 재계산해 비교하므로 실패할 수 없는 동어반복이다. D에서 `.pilgrim-whisper` 텍스트를 reason과 함께 샘플링해 stayHere가 resting/watching에서만 보이는지 DOM 수준으로 확인하는 편이 판별력이 있다.

## 시각 검토 (스크린샷 리뷰)

- baseline-manual.jpg와 candidate-manual.jpg는 선체를 제외하면 동일한 구도·조명이다. 후보 선체는 차분한 회녹색 세라믹으로 바뀌어 행성·수평선과 경쟁하지 않고, 수면 반사도 함께 가라앉았다.
- 가독성: 실루엣과 청록 inset 원반이 수면 위에서 여전히 읽힌다. 후보 실행의 실제 Carry 장면 artifacts/journey-water-stillness.jpg(17:46)에서도 같은 판단이다. 회귀 없음.
- 미확인: 모래·안개가 있는 coast 구도에서의 대비. journey-aurora-coast.jpg는 검토하지 않았다.

## 미확인 항목

- 4 Hz 기기의 실제 readbackMs 분포. 이슈 2의 실제 발생 여부를 결정한다.
- 기존 동작이지만 기록해 둔다: 제자리 회전은 센서 오프셋 때문에 VO 카메라 포즈를 최대 약 1 unit 움직이므로, 실제 VO에서는 stalled 스캔이 약 2초 뒤 스스로 해제되고 경로가 남아 있으면 주행이 재개된다. "stalled" cooldown은 경로까지 사라질 때 주로 도달한다. 이 diff가 만든 문제는 아니며 테스트는 포즈를 고정해 이 경우를 다루지 않는다.
- A2에서 수용한 한계: LOST 동안에는 director가 held hull을 감지할 수 없고 맵의 near-field 거부와 접촉 복구만 남는다.
- candidate-journey.json의 샘플별 reason 전이 시퀀스는 열지 않았다.

## 질문에 대한 짧은 답

- A2와 구현의 불일치: 이슈 1(beauty 덮어쓰기), 이슈 2(4 Hz에서 지름길 무효). 나머지는 일치.
- 실질적 제어/상태 결함: 이슈 1은 상태 라벨 결함, 이슈 2는 케이던스 상호작용 결함. 안전 관련 결함 없음.
- 시각 회귀: 없음. 낮은 대비의 선체도 읽힌다.
- 스캔 원인 래치의 추적 손실 생존: 그렇다, 136~138행과 테스트로 확인.
