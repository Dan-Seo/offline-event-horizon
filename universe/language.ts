export type Language = "ko" | "en";
export const LANGUAGE_KEY = "vastness-language";
export const GUIDE_KEY = "vastness-guide-2.1";

export function preferredLanguage(
  saved: string | null,
  languages: readonly string[],
): Language {
  if (saved === "ko" || saved === "en") return saved;
  return languages[0]?.toLowerCase().startsWith("ko") ? "ko" : "en";
}

const en = {
  home: "Offline Vastness home",
  help: "HELP",
  helpLabel: "Controls help",
  loading: "Take your time.",
  thought: "Nothing needs you right now.",
  stay: "You can stay a while.",
  welcome: "A little room to breathe.",
  welcomeBody:
    "Fly wherever you like, or let the view come to you. There is nothing to finish here.",
  learn: "Show me how to move",
  justWander: "Let me wander",
  skip: "Skip the guide",
  language: "Language / 언어",
  guideTitle: "Make yourself comfortable.",
  replay: "Try the movement guide again",
  flightControls: "Flight controls",
  guideLook: "First, look around.",
  guideLookBody:
    "Hold the left mouse button over the scene and drag to look around. Let go to use the cursor freely.",
  guideLookTouch:
    "Slide your finger on the right half of the scene to look around.",
  guideMove: "Go a little closer.",
  guideMoveBody:
    "Hold W to move forward. A and D move sideways; S brings you back. Let go to settle.",
  guideMoveTouch:
    "Touch the left half, then slide upward and hold to move. Lift your thumb to settle.",
  guideSpeed: "Find your pace.",
  guideSpeedBody:
    "Scroll up over the scene to travel faster, down to slow down. Hold Shift for a little extra speed.",
  guideSpeedTouch:
    "Spread two fingers over the scene to travel faster. Pinch inward to slow down.",
  guideDone: "That is all you need.",
  guideDoneBody:
    "Explore opens the quiet places and distant worlds. Wander takes over gently. Your movement always takes control back.",
  next: "Next",
  finish: "Stay here",
  guideProgress: "Movement guide",
  guideHint: "Drag to look · H for help",
  wander: "WANDER",
  wandering: "WANDERING",
  quiet: "QUIET",
  explore: "EXPLORE",
  exploreLabel: "Explore places and worlds",
  mute: "Mute sound",
  enableSound: "Enable sound",
  soundOn: "SOUND ON",
  soundOff: "SOUND OFF",
  settings: "Comfort settings",
  paused: "The world is resting. P to resume.",
  dragHint: "Drag to look · WASD to move",
  touchHint: "Left thumb moves · Right thumb looks",
  atYourPace: "AT YOUR OWN PACE",
  detail: "Detail",
  sensitivity: "Look sensitivity",
  gentle: "Gentler movement",
  findQuiet: "Find somewhere quiet",
  seed: "Leave a little light",
  resume: "Resume the world",
  pause: "Pause the world",
  reset: "Return to the water",
  observatory: "Technical observatory",
  close: "Close panel",
  places: "Quiet places",
  somewhere: "SOMEWHERE TO STAY",
  beyond: "Beyond this world",
  backWater: "Back to the water",
  takeOver: "Move at any moment to take over.",
  leaveQuiet: "Leave quiet mode",
  move: "MOVE",
  look: "LOOK",
  errorTitle: "There is still room for quiet.",
  errorBody:
    "The live view could not continue. You can try the lighter graphics below.",
  retry: "Try lighter graphics",
  technical: "TECHNICAL OBSERVATORY",
  technicalLabel: "Technical benchmark",
  stress: "Stress field",
  scenario: "Technical scenario",
  technicalNote:
    "Physics-inspired art. Frame cadence, not GPU timestamps. Press ` to hide.",
  quality: {
    ULTRA: "ULTRA",
    HIGH: "HIGH",
    BALANCED: "BALANCED",
    BATTERY: "BATTERY",
  },
  controls: [
    "Look around",
    "Move",
    "Travel speed",
    "Faster / slower",
    "Roll",
    "Rise / descend",
    "Select / approach",
    "Orbit selection",
    "Wander / quiet",
    "Pause / return",
    "Gather / release / light",
    "Explore / orbit / experiment",
    "Cancel movement / help",
  ],
  desktopHelp:
    "Drag with the left mouse button to look around. The cursor stays free. Click to select; double click to approach. Your movement always takes over.",
  touchHelp:
    "Left thumb to move. Right thumb to look. Pinch to change speed. Tap to select. Double tap to approach.",
  approach: "Approaching",
  orbit: "Drift around this world",
  orbiting: "Stop orbiting",
  freeFlight: "Move to take over · R returns to the water",
  experiment: "Release a little matter",
  experimentLabel: "Black hole experiment",
  experimentTitle: "LET GRAVITY DRAW",
  experimentBody:
    "Let a small cloud go. Its starting speed changes the path it takes.",
  release: "Let it fall",
  circular: "Give it an orbit",
  escape: "Send it past",
  gravity: "Gravitational pull",
  clear: "Clear the trails",
  physics: "About this simulation",
  physicsBody:
    "These particles keep their own position and velocity. A softened inverse-square gravity model changes their paths; crossing the dark sphere absorbs them. The luminous disk and bending of light are artistic approximations, not a relativistic simulation.",
  experimentHint: "T opens the experiment · H for help",
  absorbed: "absorbed",
  escaped: "escaped",
  orbitingMatter: "in flight",
  noMatter: "The next path is yours.",
  worldGuide: "A few worlds worth getting lost beside.",
  localUnits: "local units / s",
  draws: "draws",
  triangles: "triangles",
  particles: "matter particles",
  life: "living particles",
  resident: "resident sectors",
  generated: "sectors generated",
  coordinates: "Camera-relative / logarithmic far field",
};
type Copy = {
  [K in keyof typeof en]: (typeof en)[K] extends string
    ? string
    : (typeof en)[K];
};
const ko: Copy = {
  home: "오프라인 바스트니스 홈",
  help: "도움말",
  helpLabel: "조작 도움말",
  loading: "잠시 숨을 돌려요.",
  thought: "지금은, 아무것도 하지 않아도 돼요.",
  stay: "조금 더 머물러도 괜찮아요.",
  welcome: "잠깐, 쉬어 가세요.",
  welcomeBody:
    "원하는 곳으로 날아가도, 가만히 풍경만 바라봐도 좋아요. 여기서는 끝내야 할 일이 없어요.",
  learn: "움직이는 법 알아보기",
  justWander: "풍경에 맡기기",
  skip: "안내 없이 시작",
  language: "언어 / Language",
  guideTitle: "천천히 익혀 보세요.",
  replay: "움직이는 법 다시 배우기",
  flightControls: "이동과 조작 안내",
  guideLook: "먼저, 주위를 둘러봐요.",
  guideLookBody:
    "풍경 위에서 마우스 왼쪽 버튼을 누른 채 움직여 보세요. 버튼을 놓으면 커서를 자유롭게 쓸 수 있어요.",
  guideLookTouch: "화면 오른쪽에서 손가락을 움직이면 주위를 둘러볼 수 있어요.",
  guideMove: "조금 가까이 가 볼까요.",
  guideMoveBody:
    "W를 누르고 있으면 앞으로 가요. A·D는 옆으로, S는 뒤로 움직여요. 손을 떼면 천천히 멈춰요.",
  guideMoveTouch:
    "화면 왼쪽을 누르고 위로 밀어 보세요. 그 자리에 손가락을 두면 앞으로 가고, 떼면 멈춰요.",
  guideSpeed: "편안한 속도를 찾아요.",
  guideSpeedBody:
    "풍경 위에서 휠을 위로 굴리면 빨라지고, 아래로 굴리면 느려져요. Shift를 누르면 잠시 더 빨라져요.",
  guideSpeedTouch:
    "화면 위에서 두 손가락을 벌리면 빨라져요. 오므리면 느려져요.",
  guideDone: "이제, 어디든 가도 좋아요.",
  guideDoneBody:
    "‘어디로 갈까’에서 쉼터와 다른 행성을 찾을 수 있어요. ‘풍경에 맡기기’를 누르면 천천히 둘러봐요. 직접 움직이면 언제든 조종이 돌아와요.",
  next: "다음",
  finish: "여기 머물기",
  guideProgress: "이동 안내",
  guideHint: "드래그로 둘러보기 · H 도움말",
  wander: "풍경에 맡기기",
  wandering: "천천히 둘러보는 중",
  quiet: "고요하게",
  explore: "어디로 갈까",
  exploreLabel: "쉼터와 행성 둘러보기",
  mute: "소리 끄기",
  enableSound: "소리 켜기",
  soundOn: "소리 켜짐",
  soundOff: "소리 꺼짐",
  settings: "편안하게 설정",
  paused: "세상이 잠시 쉬고 있어요. P를 누르면 다시 움직여요.",
  dragHint: "드래그로 둘러보기 · WASD로 이동",
  touchHint: "왼손은 이동 · 오른손은 둘러보기",
  atYourPace: "나에게 편안한 속도로",
  detail: "화질",
  sensitivity: "시선 이동 감도",
  gentle: "더 부드러운 움직임",
  findQuiet: "조용한 곳 찾아보기",
  seed: "작은 빛 남기기",
  resume: "세상 다시 움직이기",
  pause: "세상 잠시 멈추기",
  reset: "처음 바다로 돌아가기",
  observatory: "기술 관측실",
  close: "패널 닫기",
  places: "조용한 장소",
  somewhere: "머물고 싶은 곳",
  beyond: "다른 행성과 먼 우주",
  backWater: "쉼터로 돌아가기",
  takeOver: "직접 움직이면 언제든 조종할 수 있어요.",
  leaveQuiet: "고요 모드 나가기",
  move: "이동",
  look: "둘러보기",
  errorTitle: "잠시, 이 풍경에 머물러요.",
  errorBody:
    "실시간 화면을 계속 그리지 못했어요. 아래에서 가벼운 그래픽으로 다시 시작할 수 있어요.",
  retry: "가벼운 그래픽으로 다시 시작",
  technical: "기술 관측실",
  technicalLabel: "기술 관측실",
  stress: "부하 테스트",
  scenario: "기술 테스트 선택",
  technicalNote:
    "물리에서 영감을 받은 작품입니다. 표시 시간은 GPU 실행 시간이 아닌 프레임 간격입니다. ` 키로 닫아요.",
  quality: {
    ULTRA: "최상",
    HIGH: "높음",
    BALANCED: "균형",
    BATTERY: "배터리 절약",
  },
  controls: [
    "둘러보기",
    "이동",
    "이동 속도",
    "빠르게 / 천천히",
    "좌우 기울이기",
    "올라가기 / 내려가기",
    "선택 / 가까이 가기",
    "선택한 대상 주위 돌기",
    "풍경에 맡기기 / 고요하게",
    "일시 정지 / 처음으로",
    "모으기 / 흩뜨리기 / 빛 남기기",
    "장소 / 공전 / 중력 실험",
    "자동 이동 취소 / 도움말",
  ],
  desktopHelp:
    "왼쪽 버튼을 누른 채 드래그하면 둘러봐요. 커서는 항상 자유로워요. 클릭하면 대상을 선택하고 두 번 클릭하면 가까이 가요. 직접 움직이면 자동 이동은 멈춰요.",
  touchHelp:
    "왼손으로 이동하고 오른손으로 둘러봐요. 두 손가락으로 속도를 바꿔요. 탭하면 선택하고, 두 번 탭하면 가까이 가요.",
  approach: "가까이 가는 중",
  orbit: "행성 주위를 천천히 돌기",
  orbiting: "공전 멈추기",
  freeFlight: "직접 움직여 조종하기 · R 처음 바다로",
  experiment: "물질을 살며시 놓아보기",
  experimentLabel: "블랙홀 중력 실험",
  experimentTitle: "중력이 그리는 길",
  experimentBody:
    "작은 물질 구름을 놓아 보세요. 출발 속도에 따라 서로 다른 길을 그려요.",
  release: "놓아주기",
  circular: "공전시키기",
  escape: "스쳐 보내기",
  gravity: "중력의 세기",
  clear: "궤적 지우기",
  physics: "어떻게 움직이나요?",
  physicsBody:
    "입자마다 위치와 속도를 계산하고, 거리에 따라 약해지는 중력으로 궤적을 바꿔요. 검은 구 안으로 들어간 입자는 흡수돼요. 빛의 휘어짐과 밝은 원반은 시각적 근사이며, 상대론을 정확히 재현한 시뮬레이션은 아니에요.",
  experimentHint: "T 중력 실험 열기 · H 도움말",
  absorbed: "흡수",
  escaped: "탈출",
  orbitingMatter: "이동 중",
  noMatter: "다음 궤적은 직접 만들어 보세요.",
  worldGuide: "곁에 오래 머물고 싶은, 서로 다른 세계들.",
  localUnits: "로컬 단위 / 초",
  draws: "그리기 호출",
  triangles: "삼각형",
  particles: "물질 입자",
  life: "생명 입자",
  resident: "상주 구역",
  generated: "생성한 구역",
  coordinates: "카메라 기준 좌표 / 먼 공간 로그 변환",
};
export const copy = { en, ko };

type PlaceText = { name: string; kind: string; description: string };
const places: Record<Language, Record<string, PlaceText>> = {
  en: {
    "last-light": {
      name: "The Last Light",
      kind: "Water holding the sky",
      description: "",
    },
    moonfall: {
      name: "Moonfall",
      kind: "Silver water, falling softly",
      description: "",
    },
    forest: {
      name: "The Breathing Forest",
      kind: "A little light, a little life",
      description: "",
    },
    veil: {
      name: "The Veil",
      kind: "A garden held by clouds",
      description: "",
    },
    "living-sky": {
      name: "The Living Sky",
      kind: "Room for a thousand quiet lives",
      description: "",
    },
    orpheus: {
      name: "Orpheus IV",
      kind: "Ocean world",
      description:
        "The mirror sea belongs to this world. Follow its curved horizon back toward the sanctuaries.",
    },
    giant: {
      name: "The Silent Giant",
      kind: "Ringed giant",
      description:
        "Slow storm bands beneath rings of dust and stone. Drift along the ring plane to feel their scale.",
    },
    moon: {
      name: "Selene",
      kind: "Frozen moon",
      description:
        "Impact basins and fine fractures cross an ancient shell of silver ice.",
    },
    ember: {
      name: "Ember",
      kind: "Volcanic world",
      description:
        "Warm seams move through the dark crust. Watch the night side slowly turn toward you.",
    },
    serein: {
      name: "Serein",
      kind: "Dune world",
      description:
        "Wind-drawn ridges, pale salt basins, and a thin amber sky. Nothing hurries here.",
    },
    nacre: {
      name: "Nacre",
      kind: "Living world",
      description:
        "Pearl clouds cross green oceans. Along the dark coasts, small lights breathe together.",
    },
    wound: {
      name: "The Wound",
      kind: "Gravitational anomaly",
      description:
        "Gas arrives unevenly, stretches into bright streams and slips inward. Let a little more go and watch its path.",
    },
    cathedral: {
      name: "The Cathedral",
      kind: "Ancient structure",
      description: "Something left behind",
    },
    bloom: {
      name: "The Bloom",
      kind: "Nebula",
      description: "Interstellar dust",
    },
  },
  ko: {
    "last-light": {
      name: "마지막 빛",
      kind: "하늘을 품은 밤바다",
      description: "",
    },
    moonfall: {
      name: "달빛 폭포",
      kind: "은빛 물이 천천히 떨어지는 곳",
      description: "",
    },
    forest: {
      name: "숨 쉬는 숲",
      kind: "가만히 있으면 깨어나는 작은 빛들",
      description: "",
    },
    veil: { name: "구름 너머", kind: "구름이 품고 있는 정원", description: "" },
    "living-sky": {
      name: "살아 있는 하늘",
      kind: "수많은 작은 생명이 흐르는 곳",
      description: "",
    },
    orpheus: {
      name: "오르페우스 IV",
      kind: "바다 행성",
      description:
        "처음의 거울 바다는 이 행성 위에 있어요. 둥근 수평선을 따라 다시 쉼터로 내려갈 수 있어요.",
    },
    giant: {
      name: "고요한 거인",
      kind: "고리를 두른 거대 행성",
      description:
        "먼지와 바위로 이루어진 고리 아래, 거대한 폭풍 띠가 흘러요. 고리를 따라 천천히 돌아보세요.",
    },
    moon: {
      name: "셀레네",
      kind: "얼어붙은 달",
      description:
        "오래된 충돌 분지와 가느다란 균열이 은빛 얼음 표면을 가로질러요.",
    },
    ember: {
      name: "엠버",
      kind: "화산 행성",
      description:
        "어두운 지각 틈으로 따뜻한 빛이 흘러요. 밤이 된 면을 천천히 바라보세요.",
    },
    serein: {
      name: "세레인",
      kind: "모래 행성",
      description:
        "바람이 그린 모래 능선과 옅은 소금 분지, 얇은 호박빛 대기. 서두르는 것은 없어요.",
    },
    nacre: {
      name: "나크레",
      kind: "생명이 빛나는 행성",
      description:
        "진주빛 구름이 초록 바다를 건너요. 어두운 해안을 따라 작은 빛들이 함께 숨 쉬어요.",
    },
    wound: {
      name: "빛의 틈",
      kind: "블랙홀",
      description:
        "가스가 한꺼번에 밀려들고, 밝은 띠로 늘어지다가 안으로 스며들어요. 한 줄기 더 흘려보내고 그 길을 바라보세요.",
    },
    cathedral: {
      name: "대성당",
      kind: "고대 구조물",
      description: "누군가 남겨 놓은 흔적",
    },
    bloom: {
      name: "피어나는 빛",
      kind: "성운",
      description: "별 사이로 흐르는 먼지",
    },
  },
};
export const refugeIds = [
  "last-light",
  "moonfall",
  "forest",
  "veil",
  "living-sky",
];
export const distantIds = [
  "giant",
  "moon",
  "ember",
  "serein",
  "nacre",
  "wound",
  "cathedral",
  "bloom",
];
export function placeText(
  language: Language,
  id: string,
  fallback = "",
): PlaceText {
  return (
    places[language][id] ?? { name: fallback || id, kind: "", description: "" }
  );
}
