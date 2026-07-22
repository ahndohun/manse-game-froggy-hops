import type {
  ChallengeGuide,
  RendererFactory,
  RendererFactoryOptions,
  RuntimeRenderFrame,
  RuntimeRenderer,
} from "@manse/runtime-web";
import type { GameLocale } from "./game-config";

const FONT = '"Avenir Next", Avenir, "Segoe UI", system-ui, sans-serif';
const MONO = 'ui-monospace, "SFMono-Regular", Menlo, monospace';

const COPY = {
  en: {
    aria: "Froggy Hops augmented-reality pond",
    trail: "LILY-PAD TRAIL",
    hops: "HOPS",
    crouch: "CROUCH… READY!",
    crossed: "POND CROSSED!",
    glowing: "Every lily pad is glowing",
    camera: "LOCAL CAMERA · POND LIVE",
    simulator: "POINTER POND · LIVE",
  },
  ko: {
    aria: "개구리 폴짝 증강현실 연못",
    trail: "연잎 건너기",
    hops: "번 폴짝",
    crouch: "몸을 낮춰요… 준비!",
    crossed: "연못 건너기 성공!",
    glowing: "모든 연잎이 반짝여요",
    camera: "기기 내 카메라 · 연못 실행 중",
    simulator: "포인터 연못 · 실행 중",
  },
} as const;

interface Size {
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
}

export function createFroggyRendererFactory(locale: GameLocale): RendererFactory {
  return (options) => new FroggyRenderer(options, locale);
}

class FroggyRenderer implements RuntimeRenderer {
  readonly kind = "canvas2d" as const;
  readonly element: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly setImage: HTMLImageElement;
  private destroyed = false;

  constructor(
    private readonly options: RendererFactoryOptions,
    private readonly locale: GameLocale,
  ) {
    this.element = options.document.createElement("div");
    this.element.dataset.manseRenderer = "froggy-hops";
    this.element.setAttribute("role", "img");
    this.element.setAttribute("aria-label", COPY[locale].aria);
    Object.assign(this.element.style, {
      position: "relative",
      width: "100%",
      height: "100%",
      minHeight: "320px",
      overflow: "hidden",
      background: "#062f35",
      touchAction: "none",
    });
    this.canvas = options.document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    Object.assign(this.canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    const context = this.canvas.getContext("2d", { alpha: false });
    if (context === null) throw new Error("Canvas 2D is unavailable.");
    this.context = context;
    this.setImage = options.document.createElement("img");
    this.setImage.decoding = "async";
    this.setImage.src = "/packs/froggy-hops/assets/images/pond-hero.png";
    this.element.append(this.canvas);
    options.container.append(this.element);
  }

  render(frame: RuntimeRenderFrame): void {
    if (this.destroyed) return;
    const size = resize(this.element, this.canvas, frame.tier);
    const { context } = this;
    context.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    if (frame.video !== null && frame.video.readyState >= 2) {
      drawVideoCover(context, frame.video, size, frame.mirror);
      drawCameraGrade(context, size);
    } else {
      if (this.setImage.complete && this.setImage.naturalWidth > 0) {
        drawImageCover(context, this.setImage, size);
        drawSimulatorGrade(context, size);
      } else {
        drawPondSet(context, size, frame.timestampMs, frame.reducedStimulation);
      }
    }
    drawPondForeground(context, size);
    paintGame(context, size, frame, COPY[this.locale]);
    drawModeBadge(context, size, frame.video !== null ? COPY[this.locale].camera : COPY[this.locale].simulator);
    if (frame.caption !== null && frame.celebrationProgress <= 0) drawCaption(context, size, frame.caption);
  }

  destroy(): void {
    this.destroyed = true;
    this.element.remove();
  }
}

function resize(element: HTMLElement, canvas: HTMLCanvasElement, tier: RuntimeRenderFrame["tier"]): Size {
  const width = Math.max(1, element.clientWidth || 960);
  const height = Math.max(1, element.clientHeight || 620);
  const deviceRatio = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
  const tierLimit = tier === "S" || tier === "A" ? 2 : tier === "B" ? 1.5 : 1;
  const dpr = Math.min(deviceRatio, tierLimit);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  return { width, height, dpr };
}

function drawVideoCover(context: CanvasRenderingContext2D, video: HTMLVideoElement, size: Size, mirror: boolean): void {
  const sourceWidth = Math.max(1, video.videoWidth || 1280);
  const sourceHeight = Math.max(1, video.videoHeight || 720);
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = size.width / size.height;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;
  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }
  context.save();
  if (mirror) {
    context.translate(size.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(video, sx, sy, sw, sh, 0, 0, size.width, size.height);
  context.restore();
}

function drawCameraGrade(context: CanvasRenderingContext2D, size: Size): void {
  context.fillStyle = "rgba(3,35,38,.14)";
  context.fillRect(0, 0, size.width, size.height);
  const vignette = context.createRadialGradient(size.width * 0.5, size.height * 0.45, 20, size.width * 0.5, size.height * 0.48, size.width * 0.72);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(1,23,27,.52)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, size.width, size.height);
}

function drawImageCover(context: CanvasRenderingContext2D, image: HTMLImageElement, size: Size): void {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = size.width / size.height;
  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;
  if (sourceRatio > targetRatio) { sw = image.naturalHeight * targetRatio; sx = (image.naturalWidth - sw) / 2; }
  else { sh = image.naturalWidth / targetRatio; sy = (image.naturalHeight - sh) / 2; }
  context.drawImage(image, sx, sy, sw, sh, 0, 0, size.width, size.height);
}

function drawSimulatorGrade(context: CanvasRenderingContext2D, size: Size): void {
  const grade = context.createLinearGradient(0, 0, 0, size.height);
  grade.addColorStop(0, "rgba(4,36,38,.08)");
  grade.addColorStop(0.55, "rgba(3,40,42,.2)");
  grade.addColorStop(1, "rgba(1,24,28,.58)");
  context.fillStyle = grade;
  context.fillRect(0, 0, size.width, size.height);
}

function drawPondSet(context: CanvasRenderingContext2D, size: Size, nowMs: number, reduced: boolean): void {
  const sky = context.createLinearGradient(0, 0, 0, size.height);
  sky.addColorStop(0, "#83d6cf");
  sky.addColorStop(0.5, "#237f83");
  sky.addColorStop(1, "#07515c");
  context.fillStyle = sky;
  context.fillRect(0, 0, size.width, size.height);
  const sun = context.createRadialGradient(size.width * 0.78, size.height * 0.16, 0, size.width * 0.78, size.height * 0.16, size.width * 0.31);
  sun.addColorStop(0, "rgba(255,243,184,.55)");
  sun.addColorStop(1, "rgba(255,243,184,0)");
  context.fillStyle = sun;
  context.fillRect(0, 0, size.width, size.height);
  context.fillStyle = "#0b5960";
  context.beginPath();
  context.moveTo(0, size.height * 0.47);
  for (let x = 0; x <= size.width; x += size.width / 8) {
    context.lineTo(x, size.height * (0.38 + ((x / size.width * 7) % 2) * 0.08));
  }
  context.lineTo(size.width, size.height * 0.62);
  context.lineTo(0, size.height * 0.62);
  context.closePath();
  context.fill();
  const water = context.createLinearGradient(0, size.height * 0.42, 0, size.height);
  water.addColorStop(0, "rgba(73,173,171,.92)");
  water.addColorStop(1, "#073b49");
  context.fillStyle = water;
  context.fillRect(0, size.height * 0.43, size.width, size.height * 0.57);
  context.strokeStyle = "rgba(214,249,224,.26)";
  context.lineWidth = 2;
  const drift = reduced ? 0 : (nowMs / 55) % 46;
  for (let row = 0; row < 8; row += 1) {
    const y = size.height * (0.5 + row * 0.055);
    for (let x = -50 + drift * (row % 2 === 0 ? 1 : -1); x < size.width + 50; x += 92) {
      context.beginPath();
      context.moveTo(x, y);
      context.quadraticCurveTo(x + 22, y - 5, x + 46, y);
      context.stroke();
    }
  }
}

function drawPondForeground(context: CanvasRenderingContext2D, size: Size): void {
  const waterline = size.height * 0.73;
  const bank = context.createLinearGradient(0, waterline, 0, size.height);
  bank.addColorStop(0, "rgba(2,47,48,.05)");
  bank.addColorStop(0.35, "rgba(2,34,35,.74)");
  bank.addColorStop(1, "rgba(1,20,24,.96)");
  context.fillStyle = bank;
  context.fillRect(0, waterline, size.width, size.height - waterline);
  context.strokeStyle = "rgba(188,226,147,.7)";
  context.lineWidth = 4;
  for (const side of [-1, 1] as const) {
    const origin = side < 0 ? 20 : size.width - 20;
    for (let index = 0; index < 6; index += 1) {
      context.beginPath();
      context.moveTo(origin + side * index * 8, size.height);
      context.quadraticCurveTo(origin + side * (16 + index * 8), size.height * 0.77, origin + side * (8 + index * 13), size.height * 0.59);
      context.stroke();
    }
  }
}

function paintGame(
  context: CanvasRenderingContext2D,
  size: Size,
  frame: RuntimeRenderFrame,
  copy: typeof COPY[GameLocale],
): void {
  const guide = frame.challenge?.kind === "squat" ? frame.challenge : null;
  const completed = guide?.completedUnits ?? 0;
  const total = Math.max(guide?.totalUnits ?? 6, 1);
  const pulse = frame.reducedStimulation ? 0 : (Math.sin(frame.timestampMs / 260) + 1) / 2;
  const waterline = size.height * 0.73;
  const usableWidth = Math.max(250, size.width - 94);
  const spacing = usableWidth / Math.max(total - 1, 1);
  const padRadius = Math.max(26, Math.min(50, spacing * 0.36));
  const positions = Array.from({ length: total }, (_, index) => ({ x: 47 + spacing * index, y: waterline + (index % 2 === 0 ? 20 : -7) }));
  positions.forEach((position, index) => drawLilyPad(context, position.x, position.y, padRadius, index < completed ? "visited" : index === Math.min(completed, total - 1) ? "current" : "ahead", pulse));

  if (guide !== null) {
    drawProgressPanel(context, size, guide, copy);
    const currentIndex = Math.min(completed, total - 1);
    const current = positions[currentIndex];
    const next = positions[Math.min(currentIndex + 1, total - 1)];
    const landing = guide.phase === "cooldown" ? pulse : 0;
    const hopArc = frame.reducedStimulation ? 0 : Math.sin(landing * Math.PI) * Math.min(68, size.height * 0.11);
    const crouch = guide.phase === "holding" ? Math.max(0.35, guide.holdProgress) : guide.phase === "active" ? pulse * 0.12 : 0;
    drawFrog(context, current.x + (next.x - current.x) * landing, current.y - padRadius * 0.52 - hopArc, Math.max(0.7, Math.min(1.05, size.width / 820)), crouch);
    if (guide.phase === "holding") {
      context.textAlign = "center";
      context.fillStyle = "#f2ffd9";
      context.font = `900 18px ${FONT}`;
      context.fillText(copy.crouch, size.width / 2, size.height * 0.22);
      context.textAlign = "start";
    }
  }

  if (frame.celebrationProgress > 0) drawCelebration(context, size, frame, copy);
}

function drawLilyPad(context: CanvasRenderingContext2D, x: number, y: number, radius: number, state: "visited" | "current" | "ahead", pulse: number): void {
  const scale = state === "current" ? 1 + pulse * 0.05 : 1;
  context.save();
  context.translate(x, y);
  context.scale(scale, scale * 0.54);
  context.beginPath();
  context.arc(0, 0, radius, 0.28, Math.PI * 2 - 0.28);
  context.lineTo(0, 0);
  context.closePath();
  context.fillStyle = state === "visited" ? "#d9ef83" : state === "current" ? "#b8e96f" : "#4f9c70";
  context.shadowColor = state === "current" ? "rgba(209,255,141,.85)" : "rgba(0,24,28,.35)";
  context.shadowBlur = state === "current" ? 22 : 9;
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = state === "ahead" ? "rgba(213,244,218,.44)" : "rgba(245,255,217,.92)";
  context.stroke();
  context.restore();
}

function drawFrog(context: CanvasRenderingContext2D, x: number, y: number, scale: number, crouch: number): void {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale * (1 - crouch * 0.18));
  context.shadowColor = "rgba(0,17,18,.42)";
  context.shadowBlur = 14;
  context.fillStyle = "#7dbc4b";
  context.beginPath();
  context.ellipse(-27, 16 + crouch * 8, 29, 13, -0.22, 0, Math.PI * 2);
  context.ellipse(27, 16 + crouch * 8, 29, 13, 0.22, 0, Math.PI * 2);
  context.fill();
  const bodyY = crouch * 10;
  context.fillStyle = "#91d85b";
  context.beginPath();
  context.ellipse(0, bodyY, 37, 31 - crouch * 5, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#dff3a2";
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = "#f1ffd2";
  context.beginPath();
  context.ellipse(-18, -25 + bodyY, 14, 17, 0, 0, Math.PI * 2);
  context.ellipse(18, -25 + bodyY, 14, 17, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#123f38";
  context.beginPath();
  context.arc(-15, -27 + bodyY, 5, 0, Math.PI * 2);
  context.arc(21, -27 + bodyY, 5, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#225e49";
  context.beginPath();
  context.arc(0, -2 + bodyY, 13, 0.18, Math.PI - 0.18);
  context.stroke();
  context.restore();
}

function drawProgressPanel(context: CanvasRenderingContext2D, size: Size, guide: ChallengeGuide, copy: typeof COPY[GameLocale]): void {
  const panelWidth = Math.min(320, size.width - 28);
  const x = size.width < 620 ? 14 : 24;
  const y = size.width < 620 ? 14 : 22;
  roundedRect(context, x, y, panelWidth, 68, 18);
  context.fillStyle = "rgba(3,31,36,.82)";
  context.fill();
  context.strokeStyle = "rgba(223,251,224,.34)";
  context.stroke();
  context.fillStyle = "#efffe4";
  context.font = `800 14px ${FONT}`;
  context.fillText(copy.trail, x + 18, y + 25);
  context.font = `700 12px ${MONO}`;
  context.fillStyle = "#bee5c9";
  context.fillText(`${guide.completedUnits} / ${guide.totalUnits} ${copy.hops}`, x + 18, y + 48);
  const barX = x + panelWidth - 116;
  roundedRect(context, barX, y + 28, 94, 10, 5);
  context.fillStyle = "rgba(213,248,211,.16)";
  context.fill();
  roundedRect(context, barX, y + 28, 94 * guide.progress, 10, 5);
  context.fillStyle = "#b8e96f";
  context.fill();
}

function drawCelebration(context: CanvasRenderingContext2D, size: Size, frame: RuntimeRenderFrame, copy: typeof COPY[GameLocale]): void {
  const burst = frame.reducedStimulation ? 1 : Math.min(1, frame.celebrationProgress * 1.7);
  context.save();
  context.globalAlpha = burst;
  const panelWidth = size.width * 0.68;
  roundedRect(context, size.width * 0.16, size.height * 0.18, panelWidth, Math.min(170, size.height * 0.3), 28);
  context.fillStyle = "rgba(3,35,34,.88)";
  context.fill();
  context.textAlign = "center";
  context.fillStyle = "#f0ffd9";
  context.font = `900 ${Math.max(28, Math.min(54, size.width * 0.07))}px ${FONT}`;
  context.fillText(copy.crossed, size.width / 2, size.height * 0.29);
  context.fillStyle = "#b8e96f";
  context.font = `800 ${Math.max(15, Math.min(23, size.width * 0.032))}px ${FONT}`;
  context.fillText(copy.glowing, size.width / 2, size.height * 0.36);
  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * Math.PI * 2;
    const distance = 42 + burst * Math.min(size.width, size.height) * 0.3;
    context.fillStyle = index % 2 === 0 ? "#d8f878" : "#ffb778";
    context.beginPath();
    context.arc(size.width / 2 + Math.cos(angle) * distance, size.height * 0.31 + Math.sin(angle) * distance * 0.55, 4 + (index % 3), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawModeBadge(context: CanvasRenderingContext2D, size: Size, text: string): void {
  context.save();
  context.font = `800 10px ${MONO}`;
  const width = context.measureText(text).width + 24;
  const x = size.width - width - 14;
  roundedRect(context, x, 14, width, 28, 999);
  context.fillStyle = "rgba(3,31,36,.78)";
  context.fill();
  context.fillStyle = "#dff9d9";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, x + width / 2, 28);
  context.restore();
}

function drawCaption(context: CanvasRenderingContext2D, size: Size, caption: string): void {
  const width = Math.min(size.width * 0.72, 650);
  const x = (size.width - width) / 2;
  const y = size.height - 82;
  roundedRect(context, x, y, width, 54, 14);
  context.fillStyle = "rgba(2,21,25,.82)";
  context.fill();
  context.fillStyle = "white";
  context.font = `700 ${Math.max(13, Math.min(19, size.width * 0.018))}px ${FONT}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(caption, size.width / 2, y + 27, width - 30);
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}
