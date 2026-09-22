# Actual Fable reporting implementation review

## Round 1 (ec59776)

VERDICT: ACCEPT. 리뷰 리비전 ec59776e89b9ef35cce9810251ffd7aed26919ca, 세션 fd835848-842d-4f9b-bfa6-9bc6cdf9304c, 도구 없이 제시된 diff·JSON만 검토. 구현은 수용한 경계를 지킨다: 성공 경로 키·값·종료 동작 유지, 일치 실패 시 evaluation=null·gates not-run·exit 1, catch 범위가 비교 assert 3개로 한정되고 AssertionError 외는 재throw, 카운트는 완전 통과 프레임/쌍만 집계, held 읽기는 uniqueQueryCount=null·liveness undetermined, servedRuntime 전부 unknown, 해시는 아카이브 바이트, rotation 키 보존+해석 라벨. 테스트는 왕복 대조군을 먼저 통과시킨 뒤 변형별 첫 실패 id/종류를 귀속하고 최소 프레임 오류가 일치 실패로 위장되지 않음을 확인한다. 적절하다.
실질 발견 (차단 아님):
1. replay-rgbd.ts 머리 주석에서 게이트 기본값의 보정 근거(보존 클립 최악 drift 0.0703/0.067, RPE 0.179, 2.8배 여유)가 삭제되고 "defaults preserved"로 대체됐다. 이 배치의 목적이 provenance인데 임계값 출처를 지운 셈이다. 더 단순한 대안: 원 문장을 복원하거나 docs/PILGRIM.md replay 절로 옮기고 주석에서 참조. 판별: 소스 어딘가에 0.1/0.2/0.5의 유래 수치가 남아 있어야 한다.
2. report-observations.ts executionSource()는 cwd가 어느 상위 저장소에라도 속하면 그 HEAD를 harness 리비전으로 보고한다. 테스트는 tmpdir가 어떤 git 트리에도 속하지 않는다고 가정하므로 홈을 git으로 관리하는 환경에서 거짓 실패하고, 반대로 실제 호출에서는 부모 저장소 커밋을 잘못 귀속할 수 있다. 한 줄 보강: `git rev-parse --show-toplevel`이 cwd와 같을 때만 revision을 채우고 아니면 unknown. 판별: tmpdir 안에 `git init`한 하위 폴더에서 호출하면 그 폴더 HEAD가, 그 옆 비저장소 폴더에서는 unknown이 나와야 한다.
3. opening 증거의 executionSource.revision은 034b142(dirty)로 리뷰 대상 ec59776이 아니다. 차이가 해시 계산 시점 이동뿐이라는 진술은 받아들이되, 증거 문서에 "생성 리비전 034b142, 검토 리비전 ec59776, 차이: 해시-타이밍 순서만"으로 명시해야 한다. 재실행은 GPU 슬롯이 열릴 때 opening 2회로 충분하며 필수는 아니다.
미검증: encodeDataset 시그니처와 왕복 정밀도(테스트 통과 진술에 의존), tests 실행 시간(서브프로세스 6회), living-cosmos 기존 보고서 소비자의 키 호환, WebGL2 unavailabilityReason은 엔진 소스상 profile 미활성이 원인으로 보이나 스크립트가 이를 주장하지 않는 선택은 옳다.
END_REVIEW

```json
{
  "task": "reporting-implementation",
  "revision": "ec59776e89b9ef35cce9810251ffd7aed26919ca",
  "session": "fd835848-842d-4f9b-bfa6-9bc6cdf9304c",
  "requestedModel": "claude-fable-5-1[1m]",
  "canonicalModel": "claude-fable-5-1",
  "provider": "firstParty",
  "durationMs": 68091,
  "tools": [],
  "directBrowserUse": false
}
```

## Round 2 (14275ea)

VERDICT: ACCEPT. 리뷰 리비전 14275eabf0a01cfecb5e51922158eaf9a7258ed9(이전 ec59776), 세션 fd835848-842d-4f9b-bfa6-9bc6cdf9304c, 도구 없이 diff와 진술만 검토.
세 후속 조치는 요청한 범위 안에서 정확히 해결됐다.
- 보정 근거 복원: 9e02ad6 시점 관측값(drift 0.0703/0.067, RPE 0.179, LOST 0)으로 명시하고 "새 클립의 최대값이 아님"과 기본값 불변을 함께 적어 provenance와 오해 방지를 동시에 만족한다.
- 상위 저장소 귀속 차단: `rev-parse --show-toplevel`을 realpath로 정규화해 cwd와 비교하고 불일치·예외 모두 동일한 unknown 객체를 반환한다. 테스트는 임시 저장소 HEAD 일치, 중첩 디렉터리 unknown, 비저장소 형제 unknown을 모두 판별하며, 전역 git 설정 변경 없이 `-c` 인라인 설정과 gpgsign 비활성으로 격리했다.
- 증거 리비전 명시: opening 측정이 034b142+dirty에서 생성됐고 측정 루프가 이후 변경되지 않았다는 기록은 재실행 없이 수용 가능하다. 성능 주장 없음 유지.
한계(비차단): Windows에서 git의 슬래시 경로와 realpathSync 결과의 드라이브 문자 대소문자 정규화는 통과 진술에 의존한다. 임시 저장소 테스트는 git 실행 파일과 쓰기 가능한 tmpdir를 전제하므로 git 없는 CI 러너에서는 스킵 조건이 필요할 수 있다. 워크트리(.git 파일)에서도 show-toplevel이 워크트리 루트를 주므로 정상이나 직접 확인하지 않았다.
이 보고 전용 배치의 최종 통합을 수용한다. 애플리케이션 런타임 64306e9와 종결된 production 검증에는 영향이 없고, 엔진·쿼리 식별·렌더러 변경은 포함되지 않는다.
END_REVIEW

```json
{
  "task": "reporting-implementation-round2",
  "revision": "14275eabf0a01cfecb5e51922158eaf9a7258ed9",
  "session": "fd835848-842d-4f9b-bfa6-9bc6cdf9304c",
  "requestedModel": "claude-fable-5-1[1m]",
  "canonicalModel": "claude-fable-5-1",
  "provider": "firstParty",
  "durationMs": 26784,
  "tools": [],
  "directBrowserUse": false
}
```
