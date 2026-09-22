## Round 1

VERDICT: ACCEPT (제안 범위 기준; 아래 3개 정정을 구현에 반영해야 실행 결과를 수용할 수 있음). 검토 대상은 제공된 발췌(replay-rgbd.ts, metrics.ts, living-cosmos.mjs 앞부분, engine.ts:94/751)뿐이며 도구·이미지·실행 없이 판단했다. 세션 fd835848-842d-4f9b-bfa6-9bc6cdf9304c, claude-fable-5-1. 릴리스 64306e9의 C/D 판정과는 무관하다.

**범위 판단.** 렌더링·추정기·지표 수식·임계값·엔진 무변경, 보고 필드 추가만이라는 경계는 발췌와 일치한다. 서브 어댑터 추론 금지, local HEAD≠served build, 불가용 지표≠0, 정렬 회전≠heading 증명, 내 조건화 가설 미검증 유지는 모두 옳다.

**정정 1 (held GPU 값의 생사 구분).** engine.ts:751의 catch는 profile=false로 바꾸지만 gpuRenderMs를 비우지 않는다. 이후 measure()의 180회 RAF 읽기는 죽은 값을 계속 유한값으로 수집한다. samplingMethod=raf-held-latest와 freshness=unknown만으로는 "살아 있는 held"와 "정지된 held"를 구분할 수 없다. 최소 처리: 읽기값에서 distinctValueCount(고유 쿼리 수가 아님)와 first/last 값을 함께 기록하고, 180회 동안 distinct=1이면 `heldSingleValue: true, liveness: undetermined`로 표기한다. inspect()가 profile 플래그를 노출하는지는 발췌로 알 수 없으니, 노출되면 begin/end에 기록하고 아니면 unknown. readCount와 nullReadCount도 분리(현재 finite만 push하므로 180과 다를 수 있음).

**정정 2 (agreement 결과의 동어반복).** replay-rgbd.ts의 status/inlier/delta assert는 report 작성 전에 throw하므로, JSON에 기록되는 agreement는 항상 "통과"다. 실패는 보고서 부재+예외 종료로만 남는다. 최소 처리: AssertionError를 잡아 `agreement:{passed:false,message}`로 보고서를 쓴 뒤 exitCode=1로 종료(비영 종료 유지). 별도로 `statusInlierFramesChecked = captures.length-1`과 `deltaPairsCompared = compared`를 구분해 기록한다. 8프레임 픽스처는 7/7이어야 한다.

**정정 3 (게이트 통과 ≠ 정확도 증거).** 정렬 ATE와 1초 RPE가 불가용이면 RPE/drift 게이트는 평가된 세그먼트가 0개인 채 "failures: []"가 된다. 불리언 대신 `gatesEvaluated:{lostFraction:true, rpeSegments:n, driftSegments:m}` 카운트를 추가해 어떤 게이트가 실제로 데이터를 봤는지 드러낸다. 세그먼트 가용성은 기존 값에서만 유도한다: ate!==null, rpePairs>0, driftFraction!==null. `rotation` 필드는 보고서에서 alignedRotationRms로 이름 붙이고 heading이 아님을 명기한다. distance는 TRACKING 쌍 사이의 truth 경로 길이라는 점도 표기.

**작은 보완.** 압축 파일은 읽은 바이트 그대로 해시하되 `compressed:true`를 기록한다. 재압축으로 같은 tar 내용의 해시가 달라질 수 있으니 필요하면 해제된 tar 바이트 해시를 두 번째 필드로 두면 되고, 필수는 아니다. begin/end 설정 비교는 순수 하향 자동 티어 변경은 잡지만 창 안의 일시 변경은 잡지 못한다는 한계를 문서에 적는다.

**최소 수용 체크(추가 없이 정밀화).** (1) 픽스처: deltaPairsCompared=7, statusInlierFramesChecked=7, ate=null, rpePairs=0, driftFraction 유한, gatesEvaluated.rpeSegments=0, 동일 바이트 동일 해시, 1바이트 변형 시 해시 변화, git 없는 환경에서 revision "unknown". (2) 보존된 turning 클립: ate/rpe/driftFraction 값과 segment 수가 기존 JSON과 비트 단위 동일, 해시 기록. (3) opening 시나리오 WebGPU/WebGL2: 기존 키 전부 유지, WebGL2에서 gpuRenderMs=null·reason unknown, WebGPU에서 distinctValueCount와 readCount 기록, runtimeRevision status unknown(독립 식별자 없을 때). 성능 개선 주장 없음.

**미검증.** inspect()의 노출 필드, decodeDataset metadata 내용, 기존 보고서 소비자의 스키마 의존, docs/evidence/fable-pass 클립 존재 여부.
END_SURVEY_REVIEW


{
    "session":  "fd835848-842d-4f9b-bfa6-9bc6cdf9304c",
    "canonicalModel":  "claude-fable-5-1",
    "provider":  "firstParty",
    "requestedEffort":  "high",
    "fastMode":  "off",
    "exitCode":  0,
    "completedAt":  "2026-09-22T09:38:21.233Z",
    "durationMs":  87289,
    "tools":  [

              ],
    "isError":  false
}
## Round 2

VERDICT: ACCEPT (제안 수준). 정정 1·2·3은 제안 수준에서 해소됐다. 구현은 미검증 상태이며 실행 결과는 별도 수용 대상이다. 세션 fd835848-842d-4f9b-bfa6-9bc6cdf9304c, 발췌와 코디네이터 진술만 근거, 도구·이미지 없음.

**해소 확인.**
- 정정 1: readCount/finiteReadCount/unavailableReadCount/distinctValueCount/first·last/heldSingleValue를 실제 콜백 수 기준으로 세고, 고유값이 1이라도 ambiguity로만 표기하며 unsupported/failure를 주장하지 않는 설계는 발췌된 engine.ts:751의 held 동작과 정합한다. 181 vs 180 카운트 구분과 begin/end 티어 샘플링 한계 명시도 적절하다.
- 정정 2: 런타임 일치 AssertionError만 잡고, evaluation=null·게이트 not-run·exit 1을 유지하는 실패 보고서는 동어반복을 없앤다.
- 정정 3: 기존 rotation 키 보존 + alignedRotationRms 해석 라벨, gatesEvaluated 카운트, 기존 값에서 유도한 가용성, distance 정의, 아카이브 바이트 해시와 compressed 플래그. 모두 보고 전용이다.

**남은 실질 이슈 2건.**

1. 실패 테스트의 인과 귀속. encodeDataset 왕복이 기록된 estimate delta를 비트 단위로 보존하는지는 발췌로 알 수 없다. 보존되지 않으면 1e-5 허용치 때문에 변형하지 않은 프레임에서 먼저 실패해 테스트가 잘못된 이유로 통과한다. 최소 처리: 같은 테스트 안에서 무변형 왕복 TAR을 먼저 돌려 exit 0과 deltaPairsCompared=7을 확인한 뒤, 변형본에서 exit 1과 `agreement.firstFailure.id`가 변형한 capture id이고 `check`가 의도한 종류(status 또는 inliers)임을 단언한다. 임시 파일은 artifacts가 아닌 os.tmpdir에 둔다.

2. catch 범위와 카운트 의미. try는 루프 안의 세 비교 assert만 감싸고, 시작부의 `captures.length >= 2` assert(같은 AssertionError 타입)와 decode/VO 예외는 밖에 둔다. 카운트는 "완전히 통과한 프레임/쌍"으로 정의한다: 한 프레임에서 status 통과 후 inliers 실패면 statusInlierFramesChecked는 그 프레임을 포함하지 않는다. firstFailure에는 id, check 종류, 메시지, 기대값/실측값을 넣는다. 실패 보고서의 gates에는 임계값 설정은 남기되 `evaluated: "not-run-due-to-agreement-failure"`와 failures 부재를 구분 가능한 형태로 기록해, 빈 failures 배열이 통과처럼 읽히지 않게 한다.

**작은 보완.** docs/evidence/fable-pass/captures.json의 해시는 해제된 tar 바이트이므로 보고서 필드는 `inputSha256`에 `hashedBytes: "archive-as-read"`를 붙여 혼동을 막는다. 테스트 비교 대상은 evaluation의 결정적 값과 카운트로 한정하고 analysisMs·report 경로는 제외한다는 원칙에 동의한다.

**미검증.** encodeDataset 왕복 정밀도, inspect() 필드 목록 이외의 런타임 노출, 기존 보고서 소비자의 키 의존, 보존 클립의 실제 재실행 결과.
END_SURVEY_REVIEW


{
    "session":  "fd835848-842d-4f9b-bfa6-9bc6cdf9304c",
    "canonicalModel":  "claude-fable-5-1",
    "provider":  "firstParty",
    "requestedEffort":  "high",
    "fastMode":  "off",
    "exitCode":  0,
    "completedAt":  "2026-09-22T09:40:52.679Z",
    "durationMs":  43388,
    "tools":  [

              ],
    "isError":  false
}