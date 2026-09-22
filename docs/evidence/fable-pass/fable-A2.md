# Fable gate A2 verdict

- task_id: vastness-20260922-A2 (follows vastness-20260922-A)
- reviewed revision: 9e02ad6ecf5c8322084f89313bbf2a3263a64714 (working tree clean at review time)
- reviewer session: fd835848-842d-4f9b-bfa6-9bc6cdf9304c (Claude Code 2.1.278, claude-fable-5-1, effort max)
- scope: read-only review. No product file was changed. This file is the only write.

## VERDICT: ACCEPT

Astra의 A2 해결안 다섯 항목을 모두 수용한다. 아래 두 가드는 구현에 반영해야 하는 조건이다.

## 항목별 확인

### 1. LOST 동결 포즈와 정체 감지 — ACCEPT

- 근거: vo.ts 246행이 status와 무관하게 마지막 포즈를 result.pose로 내보내고, 301~303행 LOST 분기도 비우지 않는다. runtime.ts 271~273행 snapshot만 가리고 director로 가는 Analysis는 그대로다. director.ts 68행 stalled()는 status를 보지 않는다. LOST 시 map.ts 129행과 195~198행의 현재 프레임 폴백 경로가 존재하므로 throttled가 참이 되고, 포즈가 멈춰 있어 4초 뒤 허위 "held hull" 판정, 스캔, 30~60초 휴식, stops++가 난다.
- 조건: stalled()는 vo.status가 TRACKING일 때만 포즈를 쓰고, segment가 바뀌면 앵커와 stallTime을 초기화한다.
- 폴백 속도 4 u/s 이하와 현재 프레임 깊이 폴백은 유지한다. reason은 "following current depth" 계열의 진실한 표현으로 한다.
- 워커 표현(VOResult.pose)은 유지하고, PILGRIM.md 30행은 내부 last-pose 부기와 snapshot/현재 포즈 권위를 구분하도록 정정한다.
- LOST 질문에 대한 답: 센서 전용 폴백 이동은 진실한 상태와 양립한다. 폴백 이동을 전부 끌 필요는 없다. 접촉 복구가 마지막 방어선이라는 PILGRIM.md 52행 구조와 일치한다.

### 2. resting 분리 — ACCEPT

- 근거: system.ts 231행이 director.resting을 runtime.tick에 넘기고 runtime.ts 161~162행이 4배 느린 간격(최대 0.8초)을 잡는다. "waiting for a fresh view"도 resting=true라 신선한 관측이 필요한 순간에 속도가 떨어진다. engine.ts 859행과 Vastness.tsx 668~672행은 carrying && resting이면 stayHere 위스퍼를 표시한다.
- 조건: 물리 resting, UI intentionalRest, 센서 slowSensing을 분리한다. 신선한 관측 대기와 초기 관측은 전체 케이던스를 유지한다. 의도된 휴식/watch와 유계 재시도 cooldown만 느린 케이던스를 쓸 수 있다. blocked/stale 대기는 stayHere를 표시하지 않는다. aria-live 위스퍼는 프레임 단위 resting이 아니라 명시 상태를 읽는다.
- 일반 FSM 클래스는 만들지 않는다. kind 필드와 카운터 수준의 최소 변경.

### 3. blocked cooldown 조기 종료 — ACCEPT, 가드 포함

- 조건: no-route cooldown은 서로 다른 신선한 safe 관측 2회 뒤에만 종료할 수 있다. 같은 capture는 두 번 세지 않는다. stalled-hull cooldown은 이 지름길을 쓸 수 없다. 의도된 휴식/watch 홀드는 보호된다.
- 카운터: holds는 실패한 스캔을, stops는 완료된 주행 뒤 scenic 휴식만 센다. QA 스크립트(pilgrim-journey.mjs 81~89행, pilgrim-lab.mjs 143~148행)는 stops>0을 scenic 의미로 읽고 holds를 보고에 추가한다.
- 한도: 3.5초 스캔, 30~60초 재시도, 0.85초 신선도 창, 4초/0.6 정체 판정은 변경하지 않는다.

**추가 가드 A.** 신선한 safe 관측 2회 카운트는 update()의 프레임 단위가 아니라 observe()에서 capture id 기준으로 센다. 느린 케이던스와 0.85초 창 때문에 프레임 타이밍에 따라 카운트가 흔들리는 것을 막는다.

**추가 가드 B.** no-route와 stall은 director.ts 96행의 같은 분기로 들어오므로, 스캔 시작 시점에 원인을 기록한다. stall로 시작한 스캔이 경로를 못 찾아 cooldown에 들어가도 원인은 stall로 유지되어 지름길이 닫혀야 한다.

### 4. 메트릭 범위 반박 — 수용

- 세그먼트별 lost 카운터 제안은 철회한다. 게이지 재시작 시 LOST 레코드가 이전 segment id를 갖는다는 지적이 맞다.
- 수학은 유지한다. lab.mjs 174~176행과 replay-rgbd.ts 94~96행은 둘 다 전체 샘플 손실률로 서로 일치한다. PILGRIM.md 64행의 "segment loses more than 0.1" 문구만 정정한다.
- 실제 회전 클립과 replay는 유지한다. 진실 섭동 커버리지는 기존 워커 테스트(perception-runtime.test.ts 242행 페이로드 검증) 위에서 강화한다. 임계값 변경 없음.

### 5. VISUAL (선체 재질) — ACCEPT

- 기준 이미지 artifacts/fable-pass/baseline-water.jpg에서 크림색 선체가 수면 하단 중앙에서 행성 다음으로 밝은 덩어리이고, 수면 반사에 한 번 더 나타난다.
- 원인: craft.ts 9~19행 shell의 혼합 상단색 0xc7c9b7과 normalWorld.y bias 0.65, 93~94행 seam 불투명도 0.24~0.40.
- 조건: craft.ts 재질만 변경한다. 상단색 채도·명도 하향, roughness 0.43 이상, metalness 0.25 이하, seam 불투명도 하향. 지오메트리, 조명 패스, 센서 변경 없음.
- 센서 안전성 확인: rig.ts 170~186행이 프록시에 rig 자체 material을 쓰고 지오메트리와 행렬만 공유하므로, 재질만 바꾸면 센서 RGB와 깊이는 변하지 않는다.
- 비교: 동일한 manual-rest 구도와 실제 Carry 장면으로 전후 비교한다.

## 최소 결정적 테스트 (A에서 유지)

pilgrim.test.ts의 기존 fixture와 estimated()로 충분하다.

1. 실패 스캔 뒤 stops 불변, holds 증가. 18초 주행 뒤 stops 증가.
2. no-route cooldown 중 서로 다른 신선한 safe 관측 2회가 들어오면 주행 재개. 같은 id 반복은 카운트되지 않음. stall cooldown은 같은 입력에도 until까지 유지. 주행 뒤 scenic 휴식도 until까지 유지.
3. TRACKING 이동 뒤 LOST 동결 포즈 6초를 넣어도 throttle>0 유지. 재획득으로 segment+1이 되어도 허위 정체 없음.
4. 신선한 관측 대기 상태에서 센서 케이던스가 느려지지 않고 stayHere가 표시되지 않음.

## 미지수

- 4 Hz 뷰포트의 실제 readbackMs 분포.
- journey 120초 내 scenic stop 발생 보장 여부. 초기 차단 시 약 102초까지 밀릴 수 있다.
- blocked 홀드에 위스퍼를 보일지는 설계 결정이며 A2에서 "표시하지 않음"으로 확정됨.

## 다음 단계

Astra가 유계 변경을 구현한다. B/C/D는 실제 diff와 증거로 검토한다. 이 세션은 제품 파일 쓰기 권한이 없다.
