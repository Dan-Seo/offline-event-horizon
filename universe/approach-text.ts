const descriptions = {
  moon: {
    ko: [
      "얼음의 숨",
      "협곡 틈에서 얼음 입자가 천천히 솟아올라요. 능선 사이로 날아가 보세요.",
    ],
    en: [
      "The ice exhales",
      "Ice rises quietly from the fractures. Fly between the ridges.",
    ],
  },
  serein: {
    ko: [
      "바람이 남긴 결",
      "모래 능선을 낮게 따라가면 작은 입자들이 햇빛 속에 흘러요.",
    ],
    en: [
      "The shape of wind",
      "Follow the low dune ridges. Fine dust drifts through the light.",
    ],
  },
  ember: {
    ko: [
      "아직 식지 않은 세계",
      "분지 아래의 용암과 위로 떠오르는 불씨를 가까이서 바라보세요.",
    ],
    en: [
      "A world still cooling",
      "Watch the lava below the caldera and embers rising above it.",
    ],
  },
  nacre: {
    ko: [
      "빛이 밀려오는 해안",
      "오로라가 물에 비치는 해안이에요. 땅에 내려 걸어보세요. 가만히 쉬고 있으면 작은 빛들이 다가와요.",
    ],
    en: [
      "A luminous tide",
      "Aurora rests on the water. Come down for a walk. Stay still and little lights will find you.",
    ],
  },
  giant: {
    ko: [
      "고리 아래의 구름바다",
      "이곳에는 단단한 지표가 없어요. 구름의 윗부분을 따라 떠다니며 하늘의 고리를 찾아보세요.",
    ],
    en: [
      "Cloud ocean beneath the rings",
      "There is no solid ground here. Skim the cloud tops and find the rings overhead.",
    ],
  },
} as const;
export function approachText(id: string, language: "ko" | "en") {
  return descriptions[id as keyof typeof descriptions]?.[language];
}
