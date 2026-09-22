# VASTNESS 렌더링·연구 발전 조사 — 2026-09-22

**상태: 1차 조사, 후속 직접 시각 검토, Fable 검토를 마친 구현 인계안. 구현·성능 개선·연구 효과·출시 승인을 주장하는 문서가 아니다.** 렌더링 품질/성능과 연구 신뢰성을 같은 비중으로 평가했다. 현재 코드, 보관된 시각·QA 자료, 공식 구현과 원 논문을 대조했다. 문헌 전체를 빠짐없이 검색한 체계적 문헌고찰은 아니며, 실제 기기 측정과 참가자 연구는 후속 작업이다. **현재 실행 범위는 문서 마지막의 「Fable 검토 완료 — 최종 구현 인계」를 따른다.** 앞의 후보표·실행 권고는 탐색 기록이며 일괄 구현 지시가 아니다.

조사 시작 HEAD는 `9e02ad6ecf5c8322084f89313bbf2a3263a64714`였으며 PILGRIM 관련 수정이 진행 중이었다. 조사 도중 인접 작업이 `a75f9f5ad49741d37025b892e126197ff1ae63d9`로 반영되었다. 이 문서는 해당 변경을 되돌리거나 수정하지 않는다. 설치된 Three.js는 **0.183.2**, package.json의 Next.js는 **16.3.4**다. 온라인 Three.js 문서는 이동하는 최신 문서이므로 설치 소스와 구별했다.

**핵심 판단**

다음 투자의 우선순위는 **측정 기준 고정 → 저비용 렌더링 개선 → 센서·경로 실패 조건의 반복 평가 → 작은 사람 대상 사용성 평가**다. 현재 구조를 다른 엔진이나 거대한 SLAM 스택으로 교체할 근거는 발견하지 못했다. 새로운 연구 주제로는 **제한된 브라우저 연산 예산에서 인지 불확실성과 관찰 경험을 함께 고려하는 느린 자율 이동**이 프로젝트와 잘 맞는다. 이는 연구 가설이며 신규성이나 성능이 입증되었다는 뜻은 아니다.

기존의 두 층을 유지한다. 일반 방문자는 Go / Rest / Carry로 경험하고, `/lab`에서만 공학적 계측을 한다. 렌더링 기법을 바꿔도 truth pose·semantic truth·지형 oracle을 추정기나 경로 선택에 주입하지 않는다. 센서 RGB는 별도 외관 모델이므로 **beauty 화면이 좋아졌다는 사실만으로 VO가 좋아졌다고 주장할 수 없다.**

**현재 기반과 확인 범위**

| 축 | 확인한 기반 | 조사상 남는 공백 |
| --- | --- | --- |
| 렌더링 | WebGPURenderer/TSL, WebGL2 fallback, ACES, MSAA, 평면 반사, 3D 볼륨, GPU 입자, 인스턴싱 | 실제 효과별 비용, 이동 중 aliasing/ghosting, 저전력 기기의 지속 성능 |
| 규모·수명 | floating origin, 원거리 압축, 27 섹터, 행성 3단계 LOD, 자산 2단계 LOD, dispose 경로 | 장시간 이동·재진입 메모리 추이, LOD 전환의 지각적 품질 |
| 지각 | 192×128 동기 RGB-D, LK/RANSAC/Horn VO, bounded worker transaction, 로컬 map | 외부 데이터 일반화, 센서별 잡음, 긴 구간·반복 seed 결과 |
| 평가 | segment별 unscaled SE(3) ATE, 약 1초 RPE, LOST·drift, 실제 clip replay | 평가 가능 범위와 결측률, 독립 기준선, confidence calibration |
| 경험 | 수동 개입, scenic rest와 실패 hold 구분, 저자극 방향, 사운드 opt-in | 실제 참가자 평가, 시각 개선이 편안함/통제감에 미치는 효과 |
| 과학 확장 | 별도 Schwarzschild null-ray 모델, CPU 수렴 테스트, COLMAP 보고 도구 | GPU 픽셀 검증, 실제 촬영 복원, 독립 holdout 평가 |

근거: [ARCHITECTURE](ARCHITECTURE.md), [PILGRIM](PILGRIM.md), [RELATIVITY](RELATIVITY.md), [config.ts](../universe/config.ts), [engine.ts](../universe/engine.ts), [rig.ts](../universe/perception/rig.ts), [FORMATIVE-STUDY](FORMATIVE-STUDY.md), [RECONSTRUCTION](RECONSTRUCTION.md). 1차 조사 단계에서는 새 브라우저 세션이나 빌드를 실행하지 않았다. 당시 동시 작업과 약 5 GiB의 가용 RAM을 고려해 무거운 측정은 보류했다. 이후 사용자가 요청한 짧은 직접 화면 검토는 아래 별도 절에 기록했다.

**시각 자료에서 관찰한 점**

보관된 [수면 정지 장면](evidence/pilgrim-hardening/healing-stillness.jpg)은 수평선, 큰 행성, 반사로 이미 강한 구도를 만든다. [수중 장면](evidence/living-cosmos/production-webgpu-last-light-underwater.jpg)은 가까운 풀·암석·물고기의 형태가 단순하고 명암 분리가 약하다. [Wound](evidence/living-cosmos/production-webgpu-wound-before.jpg)는 미세한 동심 패턴이 많아 이동 중 안정성을 별도 확인할 가치가 있다. 이는 보관된 정지 이미지에 대한 미적 판단이다. 현재 배포를 새로 관찰한 결과도, 영상의 깜박임을 확인한 결과도 아니다.

## 렌더링 후보

P0는 다른 결정을 가능하게 하는 기반, P1은 첫 비교 실험, P2는 선행 결과가 좋을 때, P3는 별도 연구로 분리할 항목이다. 노력 S/M/L은 상대적인 변경 범위이며 일정 견적은 아니다. 효과는 모두 **기대 또는 가설**이다.

| ID | 우선 / 노력 | 후보와 현재 근거 | 가장 작은 실험·판정 |
| --- | --- | --- | --- |
| V01 | P0 / S | **프레임 간격과 GPU 비용을 분리.** `engine.ts`는 선택적 render/compute timestamp를 이미 제공하지만 `sanctuary-performance.mjs`는 기본 `?qa=1`로 RAF 간격을 기록한다. | 기존 harness를 재사용해 동일 경로·tier·DPR에서 profile 유무를 쌍으로 측정. p50/p95/p99, 50ms 초과 횟수, 시작 준비 시간, GPU render/compute, sensor readback/worker 시간을 함께 남긴다. GPU timestamp 미지원은 결측 처리. |
| V02 | P1 / M | **Battery의 Bloom 실행 비용 제거 가능성.** `engine.ts`의 `setupPost` 경로는 Bloom을 그래프에 남긴 채 `glowStrength=0`으로 만든다. 설치된 `BloomNode.updateBefore`는 밝기 추출, 5단계 양방향 blur, 합성을 수행한다. | 기존 warm-graph 선택의 이유를 보존하면서 Bloom 제외 경로와 비교. 이론상 해당 update당 12개 quad render 호출이 있어도 절감 ms는 미측정이다. tier 전환의 재컴파일 hitch·장치 손실·복귀까지 통과해야 채택. |
| V03 | P1 / M | **잎 투명도와 overdraw.** `sanctuary-nature.ts`의 잎은 DoubleSide, transparent, depthWrite=false다. | 숲 한 곳에서 기존 blend / single-pass blend / alpha-test+MSAA alpha-to-coverage를 비교. 실루엣·빈틈·색·반사·센서 외관 차이를 확인한다. 부드러운 반투명 표현 손실도 평가. 모든 투명체에 일괄 적용하지 않는다. |
| V04 | P1 / M | **근거리 재질·명암 분리.** `ocean-life.ts`는 BasicNodeMaterial에 절차적 명암과 caustic을 곱한다. 수중 사진에서 근접 형태와 바닥 접촉이 약하게 읽힌다. | 바위·풀·물고기 중 하나만 개선. 현재 조형 유지 + 거칠기/normal/제한된 접촉 음영을 비교하고, silhouette 개선과 구별한다. 전체 PBR/GI 변환부터 시작하지 않는다. |
| V05 | P1 / S→M | **볼륨 raymarch의 조기 종료.** `SanctuaryAtmosphere.volume`과 `NebulaLibrary.create`의 누적 opacity 이후에도 반복을 끝까지 수행한다. | transmittance가 충분히 작을 때 종료하는 작은 실험. 고밀도·저밀도·역광에서 오차와 GPU 시간을 비교한다. branch divergence 때문에 빨라진다고 단정하지 않는다. |
| V06 | P2 / L | **낮은 해상도 볼륨 + depth-aware 복원.** 현재 안개는 scene 안의 박스 볼륨으로 렌더링하고 opaque depth에서 적분을 자른다. | V05 이후에도 비싸면 한 볼륨만 별도 저해상도 패스로 분리. 줄기 경계 halo, 물/잎 뒤의 합성, 반사 뷰를 검증한다. temporal accumulation은 마지막 단계다. |
| V07 | P1 / M | **반사 품질을 화면 기여에 맞춤.** 바다/lagoon은 이미 tier별 `resolutionScale`을 사용한다. | 먼저 해상도만 비교하고 물이 거의 안 보일 때의 작업을 계측한다. cadence 감소는 파도·생물·PILGRIM 반사가 멈춰 보이는지 검증한 뒤 시도. 현재 reflector 자체의 visibility/behind-plane 처리를 중복 구현하지 않는다. |
| V08 | P1 / M | **공간 AA부터 비교.** 현재 MSAA가 있으며 별도 SMAA/TRAA는 없다. 얇은 고리·별·잎·shader 내부 패턴은 별도 평가가 필요하다. | 동일 경로 영상으로 현재 MSAA와 설치된 SMAANode 후보를 비교. detail 손실, shimmer, 추가 비용을 기록. FXAA를 시험하면 tone mapping/color-space 순서도 맞춘다. |
| V09 | P2 / L | **TRAA/temporal 안정성.** 설치된 TRAANode는 beauty/depth/velocity와 jitter를 사용한다. `engine.ts`는 log depth, `coordinates.ts`는 observer-relative 좌표와 비선형 원거리 압축을 쓴다. | 먼저 log depth를 해당 복원식에 맞추고 previous/current 좌표계·식생 deformation velocity·반사·투명체를 검증한다. teleport/recovery/resize/quality 변경 시 history invalidation 필요. TRAA 사용 시 MSAA를 끄므로 V03의 A2C 경로와 그대로 결합하지 않는다. |
| V10 | P1 / M | **DPR와 연출 밀도 분리.** 현재 `QUALITY` 한 단계가 DPR·입자·식생·안개·반사 등을 함께 바꾼다. 자동 조정은 18초 간격, 최근 120개 평균이 29ms를 넘으면 하향한다. | 새 설정 UI 없이 내부 렌더 해상도만 작은 폭으로 바꾸는 실험. 사용자가 지정한 tier 고정 정책 유지. 짧은 부하·열 누적·경계 oscillation을 확인하고 장면의 생명 밀도는 가능한 보존. |
| V11 | P2 / M | **LOD 전환과 화면 크기 기준.** 행성은 거리/반지름 7·30, Cathedral은 8 부근에서 가시 LOD를 바꾼다. | 전환 구간 왕복 영상을 먼저 수집. 실제 popping이 확인되면 hysteresis부터 추가 검토. dither crossfade는 fill 비용과 AA 문제를 늘리므로 후순위. |
| V12 | P2 / M | **하늘·안개·수면의 빛 방향 일관성.** 현재 sky radiance는 물 반사에도 재사용하고 있어 좋은 기반이다. 지역 안개 조명은 단순한 density/height 함수다. | 같은 색조를 유지한 채 한 장소의 광원 방향·산란 위상만 정리. 그 후 필요한 경우 LUT 기반 대기 검토. 정확한 물리 모델 도입과 연출 일관성 개선을 다른 목표로 평가. |
| V13 | P2 / M | **장시간 streaming과 수명 검증.** dispose, sector 제한, GPU 상태 경로가 이미 있다. `ocean-optics.ts`에는 Three r183 private framebuffer 복원 의존성이 있다. | 20–30분 이동/돌아오기/수면 통과, 화면 크기 변경, 재시도에서 resource count와 메모리 추이 측정. Three 업그레이드는 양 backend 수면 전환 테스트와 함께 별도 처리. |
| V14 | P2 / M | **실제 사진 기반 작은 hero 자산.** 현재 Cathedral은 약 0.86MB/0.29MB, 4재질, 무텍스처이며 개인 촬영 복원은 미실시다. | 돌/나무껍질 한 대상을 COLMAP→Blender→기존 progressive GLB 경로로 연결. 원본/최적화/절차형을 비교. 텍스처가 실제로 생기고 예산을 압박할 때 KTX2를 추가. |

공식 근거: [Three post-processing](https://threejs.org/manual/pages/webgpu-postprocessing.html), [Material의 alphaToCoverage/forceSinglePass](https://threejs.org/docs/pages/Material.html), [NVIDIA SpeedTree의 투명도·AA](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-4-next-generation-speedtree-rendering), [SMAANode](https://threejs.org/docs/pages/SMAANode.html), [TRAANode](https://threejs.org/docs/pages/TRAANode.html), [ReflectorNode](https://threejs.org/docs/pages/ReflectorNode.html). WebGPU timestamp-query는 선택 기능이다. [WebGPU 사양](https://www.w3.org/TR/webgpu/)

V09의 호환성 위험은 일반론만이 아니다. 설치된 `TRAANode.js`의 reprojection은 `getViewPosition`/`viewZToPerspectiveDepth`를 사용하지만 같은 패키지의 `GTAONode.js`에는 명시적인 log-depth 변환 분기가 있다. 따라서 이 프로젝트에서는 TRAA를 무검증으로 연결하지 않는다. 온라인에 있는 [TAAUNode](https://threejs.org/docs/pages/TAAUNode.html)는 설치된 0.183.2의 display addon 목록에 없었다. **현재 의존성에서 바로 쓸 수 있는 기능으로 취급하지 않는다.**

V12의 장기 참고는 [Hillaire의 EGSR 2020 구현](https://github.com/sebh/UnrealEngineSkyAtmosphere)과 [Ghost of Tsushima의 2021 atmospheric/cloud 발표](https://advances.realtimerendering.com/s2021/jpatry_advances2021/index.html)다. 해당 엔진 전체를 이식하는 제안은 아니다. V14는 [COLMAP 공식 tutorial](https://colmap.github.io/tutorial), [glTF PBR](https://www.khronos.org/gltf/pbr), [KTX](https://www.khronos.org/ktx/)를 따른다.

## 연구 신뢰성과 발전 후보

이 표는 연구 데이터와 평가 기능의 후보이며, 현재 알고리즘에 오류가 있다는 판정 목록이 아니다. 추정기의 제한을 숨기지 않고 측정 가능한 질문으로 바꾸는 것이 목적이다.

| ID | 우선 / 노력 | 질문·기회 | 가장 작은 실험·성공 지표 |
| --- | --- | --- | --- |
| R01 | P0 / S | **재현성과 정확도 분리.** 같은 clip의 runtime/replay 일치는 같은 추정기 구현이 재현된다는 뜻이다. | 보고서를 determinism / truth accuracy / evaluation coverage로 분리. SHA·seed·intrinsics·timestamps·단위·조건·backend·clip hash를 함께 보관. missing ATE/RPE를 0으로 취급하지 않기. |
| R02 | P0 / M | **8개 조건의 seed·경로 반복.** 현재 CLEAR 중심 보관 clip과 regression에 비해 다양한 실패의 반복 증거가 필요하다. | CLEAR/FOG/LOW_LIGHT/REPETITIVE/REFLECTIVE_WATER/DYNAMIC/RAIN/FAST_MOTION에서 직선·회전·정지-재출발 경로를 비교. 첫 pilot은 조건당 3 seed로 결함을 찾고, 추론 목적의 표본 수는 pilot 분산 후 결정. |
| R03 | P1 / M | **실패가 평가에서 사라지는가.** ATE 정렬 불가, 짧은 segment, RPE pair 부족을 성공 샘플만의 수치로 가리면 안 된다. 현재 replay gate는 LOST·translation drift·translation RPE 중심이다. | tracked time/distance, reset 수, segment 길이, metric 가용률, 실패까지 시간, 재시작 시간을 함께 보고. 최소 평가 가능 길이·표본 수와 회전 오차 기준도 명시. 이미 계산하는 회전 RPE부터 재사용. |
| R04 | P1 / M | **독립 데이터·추정기 비교.** 내부 예술 세계에서만 잘 되는 baseline인지 확인한다. | 먼저 기존 replay 입력에 외부 RGB-D adapter를 붙이는 실험. depth scale/axial convention·intrinsics·association을 검증한 뒤 TUM/ICL-NUIM의 작은 subset 비교. ORB-SLAM3 같은 큰 시스템은 offline comparator로 검토. |
| R05 | P1 / M | **센서 현실성의 단계적 향상.** CLEAR는 ideal depth이고 IMU는 sensor-rate finite difference이며 DYNAMIC/RAIN은 image-space stressor다. | 거리·표면별 depth noise, missing depth, exposure/blur, 지연·드롭을 하나씩 추가한 ablation. 실제 센서 자료가 없으면 합성 robustness 실험이라고 명시. rolling shutter와 비동기 RGB-D는 후순위의 별도 모델. |
| R06 | P1 / M | **map의 관찰 나이와 불확실성.** `LocalMap`은 point age를 capture 수로 제한하고 cell span/count로 경로를 판단한다. | 현재 frame-count 유지와 timestamp 기반 만료를 비교. rate·drop을 바꿔 오래된 표면이 얼마 동안 사용되는지 평가. 이후 depth residual·inlier geometry를 활용한 보수적 clearance 후보. confidence를 보정된 확률이라고 부르지 않는다. |
| R07 | P1 / M | **안전한 정지가 이동 성공을 대신하는가.** 최근 scenic rest/failed hold 구분을 분석에도 반영할 필요가 있다. | 이동 거리·관찰 가능한 새 영역·접촉 복구·수동 개입·무경로 hold·성공적 scenic rest·lost duration을 별도로 기록. truth는 평가에만 사용하고 정책은 관측치만 입력. |
| R08 | P1 / M | **연산 지연과 미학적 이동의 공동 설계.** sensor는 desktop 8Hz/mobile 초기 4Hz, rest에서는 낮은 rate다. readback/analysis 시간 외에 전체 전달 지연의 상세 기록이 필요하다. | 2/4/8Hz, 주입 지연·drop, 렌더 tier를 통제하여 capture age, LOST, 경로 길이, frame p95의 Pareto 곡선 작성. 요청·capture·전송·수신 시점을 기록하고 simulation time과 wall time을 구분. 단일 in-flight와 세대별 소유권 유지. |
| R09 | P2 / M | **VO 각 단계의 기여.** LK·forward/backward·depth filtering·RANSAC·Horn을 이미 구현했다. | 동일 clip에서 한 요소만 제거/변경하는 ablation. feature 수를 늘리기 전에 오차·inlier 공간 분포·degeneracy·runtime을 확인. test seed와 tuning seed 분리. |
| R10 | P2 / M | **경관 선택이 실제로 유익한가.** RGB의 green/blue/clearance는 예술 heuristic이다. | 안전 조건을 고정하고 clearance-only / 현 scenic score / history 또는 rest 항목 제거를 비교. 보는 장면의 다양성·통제감·정지 위치 선호를 평가. semantic truth나 세계 좌표를 정책에 추가하지 않는다. |
| R11 | P2 / M | **GR CPU 검증을 GPU 출력까지 확장.** CPU 366-ray convergence fixture가 전체 shader pixel을 인증하지는 않는다. | 같은 초기 ray를 GPU float32/CPU float64에서 비교. escape/disk/capture classification, 방향·보존량 오차, step-budget 초과율을 표시. critical curve 부근을 별도 집계. |
| R12 | P2 / M | **개인 촬영·복원의 독립 증거.** `reconstruction_report.py`의 재투영 오차는 학습에 쓴 관측 잔차다. | holdout 사진·실측 길이를 남기고 reprojection, 치수 오차, 등록 실패율, 단순화 전후 형태와 렌더 비용을 분리. 작은 실물 한 개의 완결된 사례부터 만들기. |
| R13 | P1 / M | **WebGPU/WebGL 센서 출력 동등성.** `rig.ts`는 backend별 Y 방향을 보정하며 QA calibration은 일부 ray hit를 검사한다. | 같은 pose/seed/frame의 RGB·depth·normal·label 전체 또는 고정된 다양한 pixel을 비교. depth invalid mask, 법선 각도, 라벨 차이, 후속 VO 차이와 허용 오차를 구분. 미술 화면의 pixel 동일성을 요구하는 테스트는 아니다. |
| R14 | P2 / M | **map 크기가 아닌 복원 품질.** mapCells/points는 많아져도 정확해졌다는 뜻은 아니다. | 보이는 정적 표면만 대상으로 point-to-plane 오차와 completeness를 함께 평가. 관측 밖 영역은 별도 집계. 동적 물체는 지도 오염량으로 측정하고 truth geometry는 평가에만 사용. |
| R15 | P3 / L | **별도 VIO 연구.** 현재 IMU는 이상적 합성 export이며 `SensorImage`/worker에 전달되지 않는다. | 먼저 offline에서 bias·noise·time offset과 VO/VIO 비교. sensor용 IMU payload를 truth record에서 분리하는 계약부터 설계. EuRoC/TUM VI는 현 RGB-D estimator에 바로 넣는 데이터가 아님을 명시. |
| R16 | P2 / L | **능동 관찰.** 현재 아홉 arc의 경로 점수와 무경로 scan에 feature 관측 가능성을 반영할 여지가 있다. | 현재 관측 map/feature만으로 작은 실제 시점 이동의 이득을 예측하고 안전한 probe 후 새 관측으로 갱신. 아직 가보지 않은 위치의 renderer truth를 조회해 선택하면 금지된 oracle이 된다. 이동·tracking 회복·추가 연산·사용자 부담을 함께 비교. |

**외부 비교 데이터와 사용 범위**

| 1차 자료 | 이 프로젝트에 쓸 부분 | 주의할 변환·공정성 |
| --- | --- | --- |
| [TUM RGB-D format](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/file_formats) | 실제 RGB-D의 timestamp·intrinsics·trajectory 검증 | PNG depth scale 5000, 0은 invalid. RGB-depth timestamp association과 distortion 처리, resize 시 intrinsics 및 depth 경계 보존. 센서의 metre와 artistic unit을 혼합하지 않기. |
| [ICL-NUIM](https://www.doc.ic.ac.uk/~ahanda/VaFRIC/iclnuim.html) | 합성 noisy/noiseless RGB-D, living-room surface truth | office에는 같은 형태의 explicit surface truth가 없음. trajectory와 surface 평가의 가용 범위를 구별. |
| [TartanAir](https://theairlab.org/tartanair-dataset/) | 다양한 환경·운동·조명·날씨·동적 장면과 GT로 실패 범위 확장 | 우선 RGB-D/pose subset만 변환. flow/semantic truth를 worker 입력으로 몰래 추가하지 않기. |
| [ORB-SLAM3 공식 구현](https://github.com/UZ-SLAMLab/ORB_SLAM3) | offline RGB-D comparator | 해상도·프레임·calibration·초기화 실패·compute를 공개. global map/loop closure 유무가 다른 시스템의 숫자를 동등 조건의 VO 우열로 해석하지 않기. 앱 통합 전 배포 라이선스 검토. |
| [EuRoC MAV](https://projects.asl.ethz.ch/datasets/euroc-mav/), [TUM VI](https://cvg.cit.tum.de/data/datasets/visual-inertial-dataset) | R15를 선택했을 때 camera+IMU/calibration 평가 | modality·IMU rate·ground-truth coverage가 다름. RGB-D benchmark를 대체하지 않음. |
| [OpenVINS](https://docs.openvins.com/) | VIO uncertainty·calibration·평가 방법 참고 | 별도 offline 연구의 참고 구현. 현재 worker를 교체한다는 결정 아님. |

합성 DYNAMIC의 사각형 가림막을 실제 moving-object dataset과 비교하는 실험은 R05/R14에 포함한다. motion-consistency rejection을 시험할 때 static feature를 잘못 버리는 비율도 보고한다. 불확실성을 보정된 확률로 추정하기 전에는 Brier score나 collision probability를 형식적으로 붙이지 않는다. 또한 같은 noise family로 튜닝하고 검증한 결과만으로 현실 센서 일반화를 주장하지 않는다.

R11의 장기 비교 대상으로 [Bruneton의 non-rotating black-hole renderer](https://ebruneton.github.io/black_hole_shader/)를 조사했다. 사전계산 beam tracing과 별의 filtering은 참고할 수 있으나 현재 infalling observer·horizon 내부·시간 모델과 직접 호환된다는 뜻은 아니다. Kerr/GRMHD로 범위를 넓히기 전에 현재 모델의 GPU 오차와 시간 표현을 검증하는 편이 근거를 빨리 만든다.

## 경험과 사람 대상 평가

**E01 — 이미 있는 소규모 프로토콜을 실제로 시행.** [FORMATIVE-STUDY](FORMATIVE-STUDY.md)의 5–8명 formative 범위에서, 예를 들어 6명에게 자유 비행·Carry·정지 관찰의 6가지 순서를 한 번씩 배정할 수 있다. 목적은 사용성·프로토콜 실행 가능성 확인이며 효과 검증이 아니다. 불편/중단, 수동 개입, 통제감, 다시 머물고 싶은 정도, 선호 장면을 기록한다. 이후 본 연구의 주요 결과변수와 필요한 표본 수를 정한다.

**E02 — 그래픽 품질과 편안함을 동일시하지 않기.** 동일 장소·경로·시간·화면 크기·오디오 조건에서 baseline과 한 가지 개선만 비교한다. 예를 들어 잎 shimmer 감소와 수중 접촉 음영은 서로 다른 실험이다. 프레임 저하가 생기면 그래픽 선호와 구분해 분석한다. Carry 대 자유 비행에서 장면 노출량이 다르면 이는 전체 경험 비교이며 순수한 제어 방식 효과로 해석할 수 없다.

**E03 — 음향·카메라·시각 사건의 일관성.** 사운드의 공간적 위치, 장면별 음량, 이동 가속·jerk, horizon 안정성, 큰 사건 후 quiet 구간을 관찰한다. 합성 오디오를 실제 녹음으로 교체하는 것은 선택지이며 우선 과제가 아니다. motion blur·강한 DOF·색수차는 기본값으로 추가하지 않는다. 사용자가 보는 대상과 자유로운 시점 제어에 불필요한 부담을 줄 수 있다는 설계 가설을 먼저 확인한다.

외부 근거는 서로 다른 장치·영상 경험의 결과를 이 작품에 직접 이식할 수 없음을 보여준다. Kari 등의 2024년 연구는 62명, 같은 자연 영상의 TV/VR/room 조건을 비교했다. Brambilla 등의 2025년 연구는 38명에서 HMD와 tablet의 여러 결과에 유의한 집단 차이를 찾지 못했다. 후자는 동등성 입증도 아니며 자연 연결감 연구이지 이 앱의 치료 효과 검증이 아니다. 장치·presence·노출 방식과 지표를 분리해야 한다. [Kari et al. 원문](https://jukuri.luke.fi/server/api/core/bitstreams/a6fe8eee-47f1-4dcd-89ca-bf1960984d6e/content), [Brambilla et al. 초록](https://pubmed.ncbi.nlm.nih.gov/40523269/)

## 실제 연구 주제로 좁히기

| 질문 | 독립변수 | 주 결과·보조 결과 | 주장 가능한 범위 |
| --- | --- | --- | --- |
| Q1. 화면 예산을 어디에 쓰면 품질 손실이 가장 적은가? | 반사 해상도, 안개 steps, AA, 잎 처리 중 하나씩 | GPU/RAF 분포, 영상 안정성, blind pair 선호 | 측정한 장치·장소·경로의 시각/성능 trade-off |
| Q2. 낮은 센서 빈도에서도 편안하고 유용한 Carry가 가능한가? | 빈도, 지연, map 만료 정책 | tracking coverage, stale capture, 이동/hold/rest, 개입률 | 합성 센서 기반 local navigation 성능 |
| Q3. 경관 heuristic이 clearance-only보다 머무를 곳을 잘 고르는가? | scenic 항목의 ablation | 장소 선호, 통제감, 실패 정지와 scenic rest, 경로 다양성 | 작은 formative 결과 또는 이후 사전 정의된 HCI 평가 |
| Q4. 예술 세계의 실패 조건이 외부 RGB-D 실패를 얼마나 설명하는가? | synthetic stress 강도, 실제/합성 dataset | segment ATE/RPE + 결측률 + LOST/재시작 | 해당 dataset에서의 domain gap; 현실 안전 인증 아님 |
| Q5. 저비용 물리 시각화의 GPU 오차를 어떻게 드러낼 것인가? | ray budget/step/precision | classification, invariant, critical-ring 영상 오차 | 지정 Schwarzschild 모델의 수치 정확도 |

가장 일관된 연구 묶음은 **Q2+Q3**다. 먼저 Q2에서 평가 체계를 만들고 Q3로 사용자 경험을 연결한다. Q1은 제품 개선과 공학 측정, Q4는 CV 확장, Q5는 별도 계산 그래픽 주제로 관리한다. 모든 주제를 한 논문의 신규 기여로 묶지 않는다.

## 첫 실행 순서와 종료 기준

1. **측정 패키지 고정 — V01, R01–R03.** commit/clip hash와 장치 정보를 고정하고, 기존 harness·export를 재사용한다. 수면 정지, 숲 이동, 구름 내부, 수중, Wound, Carry, Lab을 대표 장면으로 둔다. 전체 조합을 처음부터 실행하지 않고 대표 HIGH/BATTERY와 두 backend의 pilot에서 문제를 찾는다.
2. **작은 시각 실험 세 개 — V02, V03, V04.** Bloom bypass, 잎 처리, 수중 근접 재질을 각각 비교한다. 동일한 원본 대비 결과·성능·회귀를 보관한다. 결과가 없으면 대규모 리팩터링하지 않는다.
3. **반복 연구 실험 — R02, R06–R09.** 합성 조건, 주입 지연, 센서 rate, map age를 하나씩 바꾼다. CLEAR에서 좋아지면서 실패 조건이 악화되는지 함께 본다. runtime/replay 일치는 정확도와 별도 판정한다.
4. **체감 확인 — E01–E03, R10.** 구현 후보를 줄인 후 formative 평가한다. 전원 고품질 강제, 효과 과장, 실패 참가자 제외를 피한다. 앱에 자동 업로드나 분석 추적을 추가할 필요는 없다.
5. **조건부 확대 — V06, V09, V12, R04, R11, R12.** 앞선 측정이 필요성을 보여준 후보만 확장한다. 변경이 실제로 들어갈 때 [ORCHESTRATION](ORCHESTRATION.md)의 독립 리뷰와 해당 Gate를 거친다. 이 문서는 Gate A–E 승인 문서가 아니다.

초기 판정 기준의 예: 목표 60Hz 장치는 frame p95 16.7ms, 저전력 30Hz 목표는 33.3ms를 **제안 예산**으로 삼을 수 있다. 이는 현재 충족했다는 수치가 아니다. 지각 오차·허용 잔상·허용 손실률은 baseline과 파일럿을 보고 사전 고정한다. 개선 주장에는 반복 측정 분포와 실패 사례를 함께 제시하며, GPU ms와 CPU/readback wall time을 서로 더해 정확한 frame time이라고 보고하지 않는다.

## 지금 우선순위에서 제외한 것

| 후보 | 제외 이유 | 다시 검토할 조건 |
| --- | --- | --- |
| Unreal/다른 엔진 전면 이식 | 현재 세계·입력·fallback·센서 경계 재구축 비용이 크며 측정 근거가 없음 | 브라우저에서 해결 불가능한 명확한 요구가 생길 때 |
| Path tracing/ReSTIR/전체 GI | 이동 중 수렴·전력·WebGL2 fallback 부담, 현재 근거리 재질보다 선행 근거가 약함 | 독립 고품질 오프라인 출력 또는 고사양 전용 모드가 요구될 때 |
| SSR을 planar reflection 위에 기본 추가 | off-screen 정보 부족과 추가 패스, 현재 평면 반사와 중복 가능 | 물 외의 반사 재질에서 구체적인 결함이 확인될 때 |
| TAAU 즉시 도입 | 설치 버전에 addon이 없음; log-depth/velocity 문제도 해결해야 함 | 버전 업그레이드 검증과 V09 성공 후 |
| ORB-SLAM3 전체 browser/WASM 이식 | 현재 목적은 작고 해석 가능한 baseline; 배포·메모리·라이선스 검토 비용 | offline 비교에서 실제 가치와 필요한 기능이 확인될 때 |
| 3D Gaussian Splatting으로 세계 교체 | 정적 장면 외관 재현과 동적 세계·충돌·센서 depth 일관성은 다른 과제 | 직접 촬영한 작은 정적 공간을 별도 lens로 보여줄 때 |
| 대규모 의미 인식·학습 기반 미학 점수 | 학습 데이터·검증 기준이 없고 색 heuristic의 한계도 아직 정량화하지 않음 | R10과 사용자 평가가 구체적인 실패를 보여줄 때 |
| Kerr/GRMHD·현실 바다 전체 유체 | 독립 연구 규모이며 현재 healing 목적과 직접 연결되지 않음 | 물리 정확도가 주목적인 별도 연구 범위를 정할 때 |

3DGS의 근거는 [원 논문 프로젝트](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)다. 빠른 novel-view rendering의 장점은 인정하되, 이 프로젝트의 물리/센서 표면 모델을 자동으로 제공하는 기술이라고 해석하지 않는다.

## 증거 해석과 남은 일

- [QA-3.0-HARDENING](QA-3.0-HARDENING.md)의 RTX 3090 Ti/Chrome 결과와 [QA-LIVING-COSMOS](QA-LIVING-COSMOS.md)의 production 결과는 **과거 기록**이다. 약 6.9–7ms RAF 간격은 해당 환경의 프레임 전달 기록이며 shader가 7ms 걸렸다는 측정이 아니다. Lab의 큰 단발 hitch도 기록되어 있다.
- 이번 조사는 정적 코드·보관 이미지·문헌 검토다. 새 FPS, 절감률, 모바일 발열, 현재 배포 화면, 참가자 점수를 만들어내지 않았다. Safari/Firefox/실물 휴대폰·장시간 열 부하·음향 체감은 미검증이다.
- 추가로 확인한 기존 로컬 `artifacts/fable-pass/baseline-replay.json`은 32 capture/31 tracked, LOST 0, 13.43 장면 단위 이동, ATE 0.13325, translation RPE 0.15850, drift fraction 0.03436을 기록한다. 이 조사에서 재실행한 결과가 아니고 ignored artifact이므로 저장소의 영구 공개 benchmark로 간주하지 않는다. 짧은 한 CLEAR turning clip의 결과는 전체 실패 조건을 대표하지 않는다.
- 공식 문서·원 저자 구현·논문을 근거로 사용했다. 검색에 나타난 커뮤니티 주장과 출처 불명 성능 수치는 채택하지 않았다. 일부 논문 PDF/사이트는 접근 제한이 있었고, 읽은 원문·저자 구현·초록 범위를 위 링크에 구별했다.
- 관련 키워드 범위는 WebGPU pass profiling, Three r183 post-processing/AA/transparency, volumetric atmosphere, glTF reconstruction/compression, RGB-D VO evaluation/noise, uncertainty-aware local navigation, virtual-nature experience, Schwarzschild rendering이다. 모든 경쟁 연구나 모든 렌더러 파일의 완전한 결함 감사를 마쳤다는 주장은 하지 않는다.
- 연구 코드·외부 baseline 검토는 Herdr의 읽기 전용 워커 1명에게 분담하고 최종 판단은 감독자가 통합했다. 실행 기록상 Luna/max로 요청·시작 표시를 확인했으나 종료 화면은 Astra/ultra/Fast였다. 변경 원인을 확인하지 못했으므로 전체 실행을 Luna/max라고 인증하거나 그 요금으로 비용을 추정하지 않는다. Fast는 사용자가 이번 조사에 명시적으로 허용했다. 사용자 소유 pane과 진행 중인 출시 작업은 수정하지 않았다.

**실행 권고:** 첫 구현 묶음은 **V01 + R01–R03의 측정 정리**, 다음은 **V02/V03/V04 중 측정상 가치가 확인된 두 개**다. 제품의 고유한 방향은 유지하면서 화면 품질과 연구 근거를 함께 쌓을 수 있다.

## 후속 검토·구현 인계 준비

사용자는 Fable 검토를 거쳐 기존 Astra max에게 실행 가능한 개선을 인계하도록 요청했다. 구현·통합 책임자는 기존 출시 작업의 Astra root다. 아래는 Fable의 출시 검토 D 예약 해제 전에 만든 **검토 전 제안 기록**이다. 최종 범위와 판정은 문서 마지막에 기록했다.

- **첫 묶음:** V01 + R01/R03에서 기존 계측의 출처·평가 가능 범위를 명확히 하는 최소 변경. R02의 전체 조건 행렬과 새 렌더링 기법은 이 묶음의 필수 범위가 아니다.
- **재사용:** `scripts/living-cosmos.mjs`, `scripts/vastness-approaches.mjs`, `scripts/pilgrim-lab.mjs`는 이미 GPU 값을 표본화한다. `sanctuary-performance.mjs` 하나의 부족을 프로젝트 전체의 계측 부재로 확대하지 않는다. 기존 harness 한 곳을 우선 보완하고, 새 profiler나 모든 harness의 공통화부터 시작하지 않는다.
- **측정 계약:** RAF 간격과 비동기 GPU resolve 결과는 별개다. 지원 여부·실제 backend/tier/DPR·표본 수·측정 구간·revision을 남긴다. GPU 결과를 매 RAF 읽은 표본 수가 서로 다른 GPU query의 개수라고 주장하지 않는다. 미지원·실패·미수집은 0ms로 바꾸지 않는다.
- **연구 계약:** `scripts/replay-rgbd.ts`의 runtime 일치, truth 대비 정확도, ATE/RPE 평가 가능 범위를 분리한다. 기존 `evaluateTrajectory`의 null/segment/sample/pair 정보를 재사용하고 clip hash와 실행 revision을 기록한다. Lab은 이미 RPE pair와 ATE 가용성 검사를 하므로 그 공백을 과장하지 않는다.
- **회귀 조건:** 짧고 거의 직선인 `clear-eight-frames.tar.gz`는 재현성 fixture로 유지하면서 정확도 증거가 부족함을 보고할 수 있어야 한다. 보관된 더 긴 회전 clip과 LOST/짧은 segment 사례로 결과 해석을 비교한다. 회전 오차 제한값을 근거 없이 새 기본 gate로 고정하지 않는다.
- **후속 시각 실험:** V02/V03/V04 중 한 개를 실제 baseline 비용·시각 결함에 따라 선택한다. 이미지·GPU 시간·tier 전환 회귀를 비교한 뒤 채택한다. 이번 인계는 효과 수치나 특정 기법의 채택을 미리 보장하지 않는다.
- **소유권과 검증:** 감독자는 이 문서만 편집한다. 실행 파일은 Astra root가 선택·소유하고, `engine.ts`/metrics 등 핵심 변경은 직렬화한다. 연구 수학·WebGPU 변경은 독립 검토를 받는다. 기존 출시 QA와 GPU 작업을 겹치지 않으며, production 결정은 기존 root에 남는다.

## 후속 직접 visual review — 2026-09-22

사용자의 추가 요청으로 조사 감독자가 현재 후보의 화면을 직접 검토했다. 앞의 정적 조사와 구분되는 후속 관찰이다. **시작 수면·PILGRIM·Breathing Forest에서 확인된 중대한 시각 회귀는 없었다. 개선 우선 후보는 근거리 재질과 숲의 명도 분리다.** 이는 출시 승인이나 전체 장면 통과 판정이 아니다.

### 관찰 조건과 증거

- 출시 root가 제공한 독점 GPU 시간에 기존 `http://localhost:4173/?qa=1&profile=1`을 한 브라우저 탭으로 열었다. root가 확인한 static build의 runtime revision은 `64306e97bbe632a7e06006842e1f49b8d53b7520`이다. production/preview 검증은 아니다.
- 1600×1000 viewport, device DPR 1. 최초 자동 품질은 BATTERY/실제 렌더 DPR 0.85였으므로 UI에서 HIGH로 바꿨다. 이후 `inspect()`에서 **WebGPU / HIGH / 실제 렌더 DPR 1**을 확인했다. 자동 품질의 원인은 이번 검토에서 진단하지 않았다.
- 실제 UI로 안내 건너뛰기 → Go → Rest → 장소 메뉴 → Breathing Forest를 실행했다. `inspect()`는 읽기 전용으로만 사용했다. scene/camera/clock 값을 강제로 쓰지 않았다.
- 탭을 닫고 GPU 시간을 root에 `RELEASED`로 반환했다. Fable 요청, 제품 코드 수정, 빌드, 새 성능 benchmark를 수행하지 않았다. 해당 탭의 console error/warn 목록은 비어 있었다.
- 새 화면 5장은 [local evidence manifest](../artifacts/visual-review-2026-09-22/manifest.json)에 기록했다. `artifacts/`는 ignored 로컬 증거이므로 저장소에 영구 보관되었다고 주장하지 않는다. 스크린샷 도구의 직접 파일 저장은 workspace 설정 때문에 거부되어, 도구가 반환한 이미지 바이트를 그대로 저장했다. 이미지 보정·합성은 하지 않았다.

| 화면 | 상태와 확인 목적 |
| --- | --- |
| [탑승 직후](../artifacts/visual-review-2026-09-22/02-boarding.png) | simulation time 약 28.84, 기체가 아직 하강 중. 이때 하단 일부가 잘린다. |
| [감속 중](../artifacts/visual-review-2026-09-22/03-deceleration.png) | time 약 41.78, Rest 입력 직후의 감속과 수면 흔적. |
| [수면 정지](../artifacts/visual-review-2026-09-22/04-rest.png) | time 약 52.15, `resting=true`, 속도 약 0.027. 기체 전체와 UI가 보인다. |
| [숲 도착 중](../artifacts/visual-review-2026-09-22/05-forest-arrival.png) | time 약 80.31, `TRAVEL`. 근경 줄기·잎·바닥 확인. |
| [숲 도착 후](../artifacts/visual-review-2026-09-22/06-forest-still.jpg) | time 약 113.90, `FREE`, `sanctuary=forest`. 정지 구도의 재질·깊이 확인. |

### 눈으로 확인한 판단

| 우선순위 | 관찰과 영향 | 가장 작은 후속 검토 범위 |
| --- | --- | --- |
| 유지 | **시작 장면의 원경은 강하다.** 행성·고리·달, 왼쪽 폭포와 오른쪽 숲, 수평선 아래 반사가 큰 구도를 만든다. 차가운 청록색과 절제된 UI가 일관된다. | 거대한 새 효과나 전체 노출 상승을 기본 해결책으로 삼을 근거가 없다. 거울 같은 고요한 수면은 작품의 방향으로 보존한다. |
| 1 | **숲 근경의 깊이와 재질 구분이 약하다.** 큰 줄기가 매끈하고 면의 각이 드러나며, 하단 약 1/4은 저대비 바닥이 넓게 차지한다. 밝은 잎 카드가 겹친 상단은 하나의 얇은 면처럼 읽히는 구간이 있다. | `sanctuary-nature.ts`의 기존 bark grain·leaf color/haze를 먼저 비교한다. 한 번에 하나의 명도/재질 변수를 바꿔 같은 숲 시점에서 판단한다. AO/TAA/새 geometry를 즉시 추가할 근거는 없다. |
| 2 | **기체는 식별되지만 재질의 미세한 차이가 적다.** 밝은 외곽선은 수면과 구분되고 조작 UI를 가리지 않는다. 넓은 단색 면과 단순한 inset 때문에 원경보다 장난감 같은 인상을 준다. | `pilgrim/craft.ts`의 기존 ceramic shell·roughness·normal 기반 색을 대상으로 작은 비교가 가능하다. 엔진 불꽃·강한 발광·HUD는 방향에 맞지 않는다. 정지 중에는 wake가 없을 수 있으므로 이를 버그로 단정하지 않는다. |
| 3 | **수면의 반사는 효과적이지만 근경의 깊이 단서는 적다.** 반사상이 넓은 면적을 차지하고, 움직일 때의 물결 흔적이 정지 후 약해진다. 이는 오류보다는 표현 선택에 가깝다. | Fresnel과 수중 흡수는 이미 구현되어 있다. 반사식을 새로 추가하기보다 동일 시점에서 기존 파라미터의 차이가 필요한지 먼저 판단한다. 이번 출시의 수정 요청은 아니다. |
| 확인만 | **탑승 순간의 하단 잘림은 지속되지 않았다.** 첫 탑승 화면에서는 기체가 하단 밖으로 일부 나갔지만, 안정화 후 전체가 보였다. | 지속 clipping 결함으로 보고하지 않는다. 탑승 전환을 다시 손볼 때만 짧은 영상으로 체감 확인한다. |

`sanctuary-nature.ts`에는 bark grain과 haze가 이미 있고, 잎은 DoubleSide/transparent/depthWrite=false인 Basic node material이다. 따라서 “재질이 없다”는 진단은 틀리다. 위 판단은 **현재 화면에서 그 차이가 충분히 읽히는가**에 관한 것이다. 마찬가지로 기체는 이미 Standard material을 사용한다. 미세한 표면 차이·광량을 조정하는 가설과 실제로 개선되었다는 결론은 구분한다.

### 회귀 비교와 시간 변화의 한계

root가 만든 [baseline manual](../artifacts/fable-pass/baseline-manual.jpg)과 [candidate manual](../artifacts/fable-pass/candidate-manual.jpg)을 나란히 읽었다. 큰 구도·실루엣·반사 배치는 유지되고, 후보 기체는 baseline보다 차가운 회녹색으로 보인다. 이 두 이미지에서 기체 식별성이 무너지는 회귀는 보이지 않는다. 다만 물결·위성·빛의 시간 상태가 완전히 같은 pixel comparison은 아니므로 색 차이의 원인이나 수치적 동등성을 단정하지 않는다.

서로 다른 시간의 수면과 숲 화면에서 위성·잎·물결의 변화가 이어지고 정지 후 구도가 유지되는 것을 확인했다. **연속 고속 영상이 아닌 간격을 둔 스크린샷 관찰이므로 shimmer·ghosting·frame hitch가 없다고 인증할 수 없다.** GPU 시간, FPS, frame percentile도 이번 검토의 결과로 제시하지 않는다.

수중·Nacre coast·Wound·Veil·세로 화면은 기존 보관 이미지로만 살폈다. 그중 수중의 평평한 근거리 음영과 Nacre의 반복되는 납작한 수관은 후속 후보지만, 현재 runtime에서 새로 재현한 결함이나 이번 출시 차단 사유로 올리지 않는다. WebGL2·실물 모바일·음향·장시간 이동은 이번 짧은 직접 관찰 범위 밖이다.

**당시 인계:** root에 직접 관찰 결과와 GPU 반환을 전달했다. 기존 세 출시 묶음의 범위는 유지했다. 당시 Fable은 D까지 예약 중이었으며 조사 verdict가 없었다. 출시 이후 개선을 선택한다면, 새 효과보다 **숲 근경 한 장면의 재질/명도 비교 한 가지**가 이번 관찰에 가장 직접적으로 연결된다. 이 후속 관찰이 기존 V01/R01/R03 측정 정리의 우선순위를 대체하거나 구현을 승인하지는 않는다.

## Fable 검토 완료 — 최종 구현 인계

**판정: ACCEPT, 제안 수준.** Fable은 최초 검토의 세 정정 사항이 후속 설명에서 해소되었다고 확인했다. 실패 테스트의 인과 확인과 catch/count 범위에 관한 최종 두 조건을 아래 계약에 포함했다. **실제 구현과 실행 결과는 아직 검증하지 않았다.** 기존 Astra root가 현재 출시·production QA를 마친 뒤 착수와 통합을 결정한다. 이 인계는 현재 출시 후보 변경이나 새로운 렌더링 작업을 승인하지 않는다.

### 검토 이력과 한계

- root의 명시적인 post-D 반환 후 세션 `fd835848-842d-4f9b-bfa6-9bc6cdf9304c`를 정확히 resume했다. 독립 호출 두 건을 직렬 실행했으며 p9에 요청을 겹쳐 보내지 않았다. 마지막 호출 종료 후 root에 `FABLE RELEASED`를 전달했고, 직접 만든 임시 helper pane만 닫았다.
- 요청 모델은 `claude-fable-5-1[1m]`, effort는 high. 두 결과의 CLI metadata는 `canonicalModel=claude-fable-5-1`, `provider=firstParty`, `is_error=false`, 종료 코드 0이다. Fast는 실제로 off였으며 설정을 바꾸지 않았다. 이는 CLI가 보고한 구성이지 별도의 backend 인증은 아니다.
- 최초 결과: 09:38:21 UTC 종료, CLI duration 87.289초. 보완 확인: 09:40:52 UTC 종료, CLI duration 43.388초. 두 호출 모두 tools/MCP 없이 제공한 코드 발췌와 설명만 검토했다. Fable이 파일을 독립 탐색하거나 이미지를 보거나 테스트를 실행했다는 뜻이 아니다.
- [실제 응답과 metadata](../artifacts/survey-review/fable-survey-review.md), [최초 제공 packet](../artifacts/survey-review/supplied-1.md), [후속 설명](../artifacts/survey-review/supplied-2.md)은 로컬 ignored evidence다. 최종 판정과 필수 조건은 이 절에도 보존한다.
- 출시 root는 promotion이 동일 source runtime을 **재빌드**했다고 알렸다. preview와 entry JS 8개 중 6개 hash만 같으며 bootstrap/loader가 달라 byte-identical이라고 주장할 수 없다. 이 사실은 아래 source/runtime provenance 분리의 실제 사례이며, 이 조사에서 production을 검증했다는 증거가 아니다.

### 범위와 소유권

| 항목 | 구현 계약 |
| --- | --- |
| 목적 | **V01 + R01/R03의 보고 보강만** 수행. 무엇을 측정했고 무엇을 평가하지 못했는지 결과 JSON에서 읽을 수 있게 한다. |
| 구현 소유자 | 기존 Astra root. root가 작업자를 쓰면 파일별 단일 소유권과 통합을 지정한다. 조사 감독자는 앱 구현을 시작하지 않았다. |
| 주 수정 파일 | `scripts/living-cosmos.mjs`, `scripts/replay-rgbd.ts`. 필요한 최소 reporting check와 문서 설명만 추가한다. 문서는 root가 기존 `PILGRIM.md`/QA 설명 중 적절한 위치를 정한다. |
| 읽기 전용 의존 | `engine.inspect()`, `universe/perception/{metrics,dataset,vo}.ts`, 기존 report 소비자·CI, 보관 clip과 그 출처. |
| 고정 경계 | engine/render loop, estimator/metric 수식, sensor/truth 경계, planner, UI, thresholds, archive format은 수정하지 않는다. 새 dependency/profiler/공통 harness framework도 만들지 않는다. |
| 인터페이스 | 성공 report의 기존 키·값·CLI exit 의미를 유지하고 metadata를 추가한다. agreement 실패에는 새 실패 report를 남기되 비영 종료를 유지한다. |
| 반환물 | 수정 파일·간결한 diff, 전후 report 예시, 실제 실행 명령/결과, 출처 hash, 미검증 항목. WebGPU나 연구 수학 변경으로 범위가 늘어나면 별도 소유권·독립 검토가 필요하다. |

### A. 기존 GPU/RAF 보고의 의미를 명확히 하기

`scripts/living-cosmos.mjs`의 기존 `measure()`와 `quantiles()`를 재사용한다. RAF frame interval과 render/compute GPU 읽기값은 각각 기록하며 서로 더하지 않는다. 기존 GPU quantile은 **매 RAF에서 읽은 held-latest 값의 분포**이지 고유 timestamp query의 분포가 아니다.

render/compute 각각에 다음의 작은 관찰 metadata를 추가한다. 이름은 root가 기존 스타일에 맞출 수 있으나 의미는 유지한다.

- `samplingMethod: "raf-held-latest"`, `uniqueQueryCount: null`, `freshness: "unknown"`, `liveness: "undetermined"`.
- 실제 `readCount`, `finiteReadCount`, `unavailableReadCount`를 센다. 마지막 항목은 null/undefined/nonfinite처럼 유효한 수치가 아닌 읽기다. **실제로 측정된 숫자 0은 유효값이고, 결측을 0으로 채우면 안 된다.**
- 유한 읽기값의 `distinctValueCount`, first/last, `heldSingleValue = finiteReadCount > 0 && distinctValueCount === 1`. 서로 다른 숫자의 수는 query 수가 아니다. 모두 같은 값은 GPU 시간이 일정했을 수도, 과거 값이 남았을 수도 있다는 모호함만 나타낸다. 값이 여러 개여도 모든 읽기의 freshness를 증명하지 못한다.
- 유한값이 없으면 기존 GPU 통계는 null. 미지원·비활성·resolve 실패를 구별할 근거가 없으면 원인은 unknown으로 둔다. 현재 engine은 resolve 실패 때 profile을 끄지만 이전 GPU 수치를 지우지 않으며, inspect에는 profile/query serial이 없다. 이를 고치기 위한 engine 변경은 이번 범위 밖이다.
- 현재 루프는 첫 callback에서도 GPU 값을 읽지만 RAF interval은 두 번째부터 만든다. **180 interval에 181 read가 생길 수 있으므로 횟수를 하드코딩하지 않는다.**

begin/end의 측정 시각과 실제 backend/tier/DPR/viewport를 남긴다. 양 끝의 차이는 발견할 수 있지만 중간에 바뀌었다 돌아온 설정을 배제할 수 없음을 명시한다. 새 관측용 renderer/adapter를 만들지 않는다. 별도의 `navigator.gpu.requestAdapter()`가 돌려준 장치를 실제 renderer 장치라고 추정하지 않는다.

provenance에는 harness 실행 revision·dirty 상태·URL·scenario·browser 정보를 기록한다. Git을 읽지 못하면 unknown. dirty가 tracked/untracked 중 무엇을 포함하는지 명시한다. **실행 소스 HEAD와 실제 제공된 runtime artifact의 출처/일치 여부는 별도 항목**으로 두며, 독립된 artifact 근거가 없으면 runtime identity/match는 unknown이다. 동일 source revision도 byte identity를 뜻하지 않는다.

### B. replay의 agreement·기준 통과·지표 가용성 분리

`scripts/replay-rgbd.ts`에서 읽은 원본 archive bytes의 `inputSha256`, `hashedBytes: "archive-as-read"`, `compressed`와 실행 revision/dirty 상태를 추가한다. `.tar.gz`는 압축된 파일 그대로의 hash이며 재압축 후에는 달라질 수 있다. `captures.json`의 해제된 TAR hash와 혼동하지 않는다. 해제된 payload hash는 이번 최소 범위에 필수로 추가하지 않는다. `decodeDataset`가 이미 돌려주는 metadata에서 필요한 작은 출처 정보만 재사용하고 frame/truth payload를 report에 복제하지 않는다.

성공 report는 다음을 분리한다.

1. **기록된 runtime과의 agreement:** 기존 status/inliers/delta 검증 결과, status와 inlier 두 비교를 모두 통과한 frame 수 `statusInlierFramesChecked`, delta 검증을 완전히 통과한 `deltaPairsCompared`. 이 둘은 의미가 다르며 원래 `compared`도 유지한다.
2. **기존 threshold 검사:** LOST 비율·RPE·drift의 현재 한계값/실패 목록을 유지한다. `gatesEvaluated`에 lostFraction 검사 여부와 실제 검사한 RPE/drift segment 수를 추가한다. `failures: []`만으로 모든 정확도 지표가 평가되었다고 읽히지 않아야 한다.
3. **segment별 가용성:** 기존 `ate !== null`, `rpePairs > 0`, `driftFraction !== null`과 sample/pair 수를 그대로 사용한다. 새 충분성 기준이나 종합 accuracy-valid boolean을 만들지 않는다. 기존 `rotation` 키를 유지하면서 해석을 `alignedRotationRms`로 명시한다. 이는 위치 정렬을 적용한 orientation RMS이며 독립적인 heading 정확도 증명이 아니다. 기존 `distance`는 해당 segment의 연속 TRACKING truth 위치 사이 거리를 합친 값이다.

**agreement 실패 경로는 이번 보강의 필수 부분이다.** 현재 비교 assert는 report 작성 전에 throw한다. 루프 내 status/inliers/delta 비교 assert에만 좁게 catch를 적용하고, 해당 AssertionError이면 다음을 기록한 뒤 exit 1로 끝낸다.

- `agreement.passed=false`, `firstFailure`의 capture id·check 종류(status/inliers/delta)·message·expected/actual, 실패 전 완전히 통과한 frame/pair 수. status는 통과했으나 inliers가 실패한 frame은 완료 frame 수에 넣지 않는다.
- `evaluation=null`. 중단된 부분 trajectory로 정확도 검사나 통과 판정을 만들지 않는다. gate 한계값은 남기되 `evaluated: "not-run-due-to-agreement-failure"`처럼 명시하고, `failures: []`가 성공으로 오해되지 않는 형태로 둔다.
- 최소 capture 개수 assert, archive decode, VO 실행 자체의 예외는 이 catch 바깥에 둔다. 일반 런타임 오류를 agreement mismatch로 바꾸거나 삼키지 않는다.

기존 truth→estimate 분리, 무스케일 SE3, RPE pairing, LOST 처리, 기본 한계값은 그대로 둔다. aligned rotation이 큰 원인을 조건화로 설명하는 가설은 아직 실험하지 않았으며, 새 gate나 확정된 인과 설명으로 승격하지 않는다.

### root가 실행할 최소 수용 검사

아래는 **후속 구현의 검사 계획**이며 이번 조사 중 실행한 결과가 아니다. 현재 production QA와 GPU 작업을 겹치지 않는다.

| 검사 | 판정 |
| --- | --- |
| 8-frame 기존 fixture replay | exit 0, completed status/inlier frame 7, delta pair 7, 기존 수치 유지. ATE null/RPE pair 0을 드러내고 driftFraction은 기존 약 0.06660124로 유지한다. 실제 gate count는 lost 1회, RPE segment 0개, drift segment 1개다. |
| agreement 실패 보고 | 같은 테스트의 `os.tmpdir()` 안에서 기존 decode/encode로 **무변형 왕복 TAR부터** replay하여 exit 0/7 delta pair를 확인한다. 그 뒤 recorded status 또는 inlier 하나만 바꾼 TAR은 exit 1, 실패 JSON 존재, 정확히 그 capture id와 의도한 check가 firstFailure, evaluation null/accuracy not-run이어야 한다. 새 binary fixture를 저장소에 추가하지 않는다. |
| retained turning replay | `docs/evidence/fable-pass/right-32-frames.tar.gz`와 `left-32-frames.tar.gz`의 deterministic evaluation/count를 기존 `candidate-replay.json`/`holdout-replay.json`과 대조한다. analysisMs·출력 경로는 동일성 비교에서 제외한다. |
| provenance/결측 경계 | 같은 bytes의 hash 일치, 다른 bytes의 hash 차이, Git 부재에서 unknown. WebGL2의 미수집 GPU는 null이고 이유를 추정하지 않는다. report 내 all-equal/empty reading의 개수·모호함 처리가 정의와 맞아야 한다. |
| 기존 opening QA만 양 backend | root가 production GPU slot을 반환한 뒤 `QA_SCENARIOS=opening`으로 WebGPU와 `QA_BACKEND=webgl`을 직렬 실행한다. 실제 read count, 기존 키 호환, null/held-latest 의미, begin/end settings, runtime identity unknown을 확인한다. 성능 향상이나 새 효과를 측정한 것으로 보고하지 않는다. |
| 기존 검증 | 변경된 스크립트와 최소 reporting check에 적합한 lint/검사를 한 번 실행한다. report-only 변경 때문에 앱 build나 전체 GPU matrix를 새로 시작할 필요는 없다. |

fixture와 turning clip은 이미 존재한다. 이번에 확인한 **압축 입력 파일** SHA-256은 다음과 같다. 이 값들은 replay를 재실행했다는 뜻이 아니다.

| 파일 | input SHA-256 |
| --- | --- |
| `tests/fixtures/clear-eight-frames.tar.gz` | `6b148d743ba2f12ae828fb7346a9e4d69a506e04bffc6c5543dd335c9254a034` |
| `docs/evidence/fable-pass/right-32-frames.tar.gz` | `75b1563aa928fa4dddd07d59144925fdfcf833a0bdc5d9a5dcd2d09a849d436e` |
| `docs/evidence/fable-pass/left-32-frames.tar.gz` | `b0693d9de68d72989257522f13fe4ee107419c6e8fab0f83403eb83573298ce6` |

**보류:** V02 bloom bypass, V03 잎 처리·숲 재질 조정, V04 수중 재질, 전체 R02 조건 행렬, query serial을 위한 engine 수정, AA/AO/GI, 새 회전 gate. 이번 Fable ACCEPT는 위 A/B 보고 보강안에 한정된다. 시각 검토의 후속 아이디어는 별도의 착수 결정과 비교 증거가 필요하다.
