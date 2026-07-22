export type GameLocale = "ko" | "en";

export const DEFAULT_LOCALE: GameLocale = "en";
export const SUPPORTED_LOCALES = ["ko", "en"] as const;

export const GAME_CONFIG = {
  slug: "froggy-hops",
  creator: "Manse",
  sourceUrl: "https://github.com/ahndohun/manse-game-froggy-hops",
  title: {
    ko: "개구리 폴짝",
    en: "Froggy Hops",
  },
  summary: {
    ko: "몸을 낮췄다가 개구리처럼 폴짝 뛰어 연잎을 건너세요.",
    en: "Squat down, spring up like a frog, and hop across the lily pads.",
  },
  hero: {
    src: "/packs/froggy-hops/assets/images/pond-hero.png",
    alt: {
      ko: "잔잔한 청록빛 연못 위에서 연잎 사이를 폴짝 뛰는 초록 개구리",
      en: "A green frog hopping between lily pads on a calm deep-teal pond",
    },
  },
} as const;

export const UI_COPY = {
  ko: {
    page: {
      kicker: "독립형 Manse 게임",
      privacy: "카메라 영상은 이 기기에만 머물러요 · 계정 없음 · 분석 도구 없음",
      heroEyebrow: "천천히 앉고 · 가볍게 폴짝",
      languageLabel: "언어 선택",
      footer: "Manse가 만들었습니다. 불편하면 언제든 움직임을 멈추세요.",
      source: "소스 보기",
    },
    player: {
      label: "게임 플레이어",
      stageLabel: "동작 게임 무대",
      status: {
        attention: "확인이 필요해요",
        starting: "시작하는 중",
        complete: "완료",
        choose: "플레이 방법을 골라 주세요",
        camera: "카메라 영상은 기기에만 머물러요",
        simulator: "포인터 모드 실행 중",
      },
      runtimeReady: "런타임 준비됨",
      tier: "등급",
      mission: "연잎 건너기 임무",
      startHelp: "먼저 포인터로 시작해 보세요. 카메라 모드는 선택 사항이며, 직접 고른 뒤에만 권한을 요청합니다.",
      playPointer: "포인터로 플레이",
      useCamera: "카메라 사용",
      comfort: "주변을 정리하고 편안한 공간에서 플레이하세요.",
      restartPointer: "포인터로 다시 시작",
      switchCamera: "카메라로 전환",
      errorStart: "게임을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      progressLabel: "진행도",
    },
  },
  en: {
    page: {
      kicker: "Independent Manse game",
      privacy: "Camera stays on this device · no account · no analytics",
      heroEyebrow: "Crouch gently · hop lightly",
      languageLabel: "Choose language",
      footer: "Created by Manse. Stop whenever movement feels uncomfortable.",
      source: "View source",
    },
    player: {
      label: "Game player",
      stageLabel: "Interactive motion game stage",
      status: {
        attention: "Needs attention",
        starting: "Starting",
        complete: "Complete",
        choose: "Choose how to play",
        camera: "Camera stays on device",
        simulator: "Simulator live",
      },
      runtimeReady: "runtime ready",
      tier: "tier",
      mission: "Lily-pad crossing mission",
      startHelp: "Start with the pointer. Camera mode is optional and asks permission only after you choose it.",
      playPointer: "Play with pointer",
      useCamera: "Use my camera",
      comfort: "Choose a private, comfortable play space.",
      restartPointer: "Restart with pointer",
      switchCamera: "Switch to camera",
      errorStart: "The game could not start. Please try again.",
      progressLabel: "Progress",
    },
  },
} as const;

export function getBrowserLocale(languages: readonly string[]): GameLocale {
  for (const language of languages) {
    const normalized = language.toLowerCase();
    if (normalized.startsWith("ko")) return "ko";
    if (normalized.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}
