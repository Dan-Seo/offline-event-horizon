# Actual Fable D2 release review

VERDICT: ACCEPT. 리뷰 리비전 64306e97bbe632a7e06006842e1f49b8d53b7520, production dpl_DsqUqYYtJekVNyey8ZSvneZm9FDH(원본 dpl_5NZXNY9uzmumMFvN8jkRmCVor9Rr에서 promote·재빌드). 세션 fd835848-842d-4f9b-bfa6-9bc6cdf9304c, claude-fable-5-1, 도구·이미지 없이 진술된 증거만 평가.
근거: D의 "바이트 동일 승격" 가정은 철회하고, 대신 sourceCommit/githubCommitSha=643, action=promote, buildSkipped=false 메타데이터와 실제 public 도메인에서 완료된 WebGPU journey 17/17, WebGPU lab 41/41, WebGL2 lab 41/41, 콘솔 오류 0, 두 production export의 replay 일치(차이 0)와 게이트 통과를 근거로 받아들인다. 테스트가 서빙 중인 바로 그 산출물에서 실행됐으므로 이 판정은 "동일 소스 + 검증된 서빙 산출물"에 대한 것이다.
실질 우려 (차단 아님):
1. 프레임워크/로더 청크 2/8이 preview와 다르고 의미 동등성은 미증명이다. 수용 가능한 이유는 production 스위트가 그 산출물 위에서 통과했기 때문이며, 테스트되지 않은 경로에 대한 동등성 주장은 하지 말 것. production-artifact.json에 8개 해시와 "동등성 미증명" 문구를 유지.
2. gitDirty=1은 "증거/문서만"이라는 Root 진술에 의존한다. Vercel CLI 업로드는 작업 트리를 포함하므로 dirty 파일 경로 목록을 production-artifact.json에 기록해, app/public/scripts 아래에 미추적 파일이 없었음을 사후 검증 가능하게 할 것.
3. 전체 clear lab ATE 1.446 m over 182.9 m(drift 0.028, RPE-t 0.200 m)은 짧은 클립(0.10 m)보다 크며 ATE는 게이트 대상이 아니다. 문서에 거리 대비 누적 오차로 함께 표기하고 정밀도 주장으로 쓰지 말 것.
미검증(진술대로 유지): 공유 힙 증가 원인·대기 대조군·VRAM·다시간, 실제 모바일 기기, 강제 GPU 손실, 오디오/편안함, 시간적 아티팩트, 정렬 회전 조건화 원인. Root의 새 public 스크린샷은 내가 받지 않았으므로 시각 판단은 B 시점 재질 검토와 Root 진술에 한정된다.
승인 범위: 이 production 배포의 릴리스 종결과 증거 커밋·main fast-forward. 별도 수용된 두 스크립트 보고 제안은 미구현이며 이 판정이 인증하지 않는다.
END_REVIEW

Execution metadata:

```json
{
  "task": "D2",
  "revision": "64306e97bbe632a7e06006842e1f49b8d53b7520",
  "deployment": "dpl_DsqUqYYtJekVNyey8ZSvneZm9FDH",
  "requestedModel": "claude-fable-5-1[1m]",
  "model": "claude-fable-5-1",
  "provider": "firstParty",
  "session": "fd835848-842d-4f9b-bfa6-9bc6cdf9304c",
  "durationMs": 29558,
  "tools": [],
  "directBrowserUse": false
}
```

Astra corrections and disposition: the D2 packet incorrectly rounded both replay translation differences to zero. The actual WebGPU maximum is 0; WebGL2 is 1.7763568394002505e-15, rotation 0 for both. The original numeric JSON in summary.json is authoritative. This correction does not change the 1e-5 agreement tolerance or any accuracy gate; no algorithm was changed and another review was not required for the floating-point reporting correction.

The upload-time dirty-path manifest was not captured atomically. production-artifact.json records the actual subsequent docs-only snapshot and its timing limitation, without presenting it as historical proof. The complete clear-path ATE is reported with distance and is not an acceptance gate. Differing framework chunk semantic equivalence remains unproven; actual production suites passed.
