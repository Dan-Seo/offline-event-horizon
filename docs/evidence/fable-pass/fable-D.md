# Actual Fable D review

VERDICT: ACCEPT (release candidate 승격 및 필수 public production 검증 실행 허가; production 미실행 테스트는 이 판정이 대신하지 않음). 리뷰 리비전 64306e97bbe632a7e06006842e1f49b8d53b7520, 배포 dpl_5NZXNY9uzmumMFvN8jkRmCVor9Rr. 세션 fd835848-842d-4f9b-bfa6-9bc6cdf9304c, claude-fable-5-1, 도구 없이 제시된 증거만 평가.
근거: B2/C 수용 이후 애플리케이션 코드 변경 없음이 확인되며, 계약 항목(rest/failure 상태 분리, LOST 동결 포즈 수리, 2회 distinct safe 캡처 회복, 재질 완화, 우/좌 turning 클립+홀드아웃)이 각각 단위 테스트, 실 WebGPU journey/lab, 4 Hz 수명주기 24/24로 뒷받침된다. 게이트·추정기 미조정, 진실 경계 테스트 두 종 병기, 정렬 회전 약점 공개, 내 인과 가설을 사실로 승격하지 않은 점 모두 적절하다.
실질 문제 (차단 아님):
1. Preview 16/17·40/41의 유일 실패는 Vercel 주입 feedback.js의 CSP 차단이다. production 도메인에 동일 주입이 없다는 것은 아직 증거가 아니라 가정이다. 판별: 승격 직후 production에서 console error 0으로 journey/lab을 실행하고, 실패 시 CSP 완화가 아닌 rollback. 대안 없음, 이미 계획대로.
2. 공유 힙 증가 +8.78 MB(Carry) vs +8.89 MB(수동 대조군)는 Carry 특이 누수 부재만 보여주고 원인은 미해결이다. 릴리스 노트에 "20회 토글 기준, 다시간 안정성·VRAM 미검증"으로 한정 표기. 판별: 동일 정적 장면에서 토글 없이 같은 시간 대기한 3번째 대조군의 증가량 비교.
3. 기존 정책상 한계: LOST 동안 director는 held-hull을 감지할 수 없고 4 u/s 폴백 이동은 맵 near-field 거부와 접촉 복구에만 의존한다. A2에서 수용했으나 문서 한계 절에 명시되어야 한다.
판별 체크 추가: production 아티팩트 해시가 preview dpl과 동일함을 확인, production journey에서 stops≥1·holds 보고·위스퍼 DOM 체크 통과, WebGL2 lab에서 LOW_LIGHT LOST→CLEAR TRACKING 재현.
미검증: production 실행 전부, 물리적 GPU 장치 손실, 실제 모바일 기기, 다시간 세션, 정렬 회전 조건화 가설(NOT TESTED 상태 유지가 맞음), wB:pD 시각 리뷰의 forest 관찰은 내가 이미지를 받지 않아 재확인 불가, 셰머·jank 부재.
END_REVIEW

Execution metadata:

```json
{
  "task": "D",
  "revision": "64306e97bbe632a7e06006842e1f49b8d53b7520",
  "deployment": "dpl_5NZXNY9uzmumMFvN8jkRmCVor9Rr",
  "requestedModel": "claude-fable-5-1[1m]",
  "model": "claude-fable-5-1",
  "provider": "firstParty",
  "session": "fd835848-842d-4f9b-bfa6-9bc6cdf9304c",
  "durationMs": 26445,
  "tools": [],
  "directBrowserUse": false
}
```

Astra disposition: accepted the candidate with mandatory production console, artifact and fallback checks still outstanding at review time. Shared heap growth and the LOST near-field/contact fallback remain disclosed limitations. The suggested no-toggle waiting control is NOT TESTED; no leak-free or multi-hour claim is made.
