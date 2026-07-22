import {
  createDefaultRenderer,
  type ChallengeGuide,
  type RendererFactory,
  type RuntimeRenderFrame,
} from "@manse/runtime-web";

const PAD_COUNT = 6;
const POND_IMAGE = "url('/packs/froggy-hops/assets/images/pond-hero.png')";

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawLilyPad(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  state: "visited" | "current" | "ahead",
  pulse: number,
) {
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
  context.beginPath();
  context.moveTo(-radius * 0.6, 0);
  context.quadraticCurveTo(0, radius * 0.22, radius * 0.58, 0);
  context.strokeStyle = "rgba(16,84,60,.55)";
  context.lineWidth = 2;
  context.stroke();
  context.restore();
}

function drawFrog(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  crouch: number,
  facing: -1 | 1,
) {
  context.save();
  context.translate(x, y);
  context.scale(facing * scale, scale * (1 - crouch * 0.18));
  context.shadowColor = "rgba(0,17,18,.42)";
  context.shadowBlur = 14;

  // Back legs make the avatar visibly compress as the squat hold fills.
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
  context.lineWidth = 3;
  context.beginPath();
  context.arc(0, -2 + bodyY, 13, 0.18, Math.PI - 0.18);
  context.stroke();
  context.restore();
}

function drawProgressPanel(
  context: CanvasRenderingContext2D,
  width: number,
  guide: ChallengeGuide,
) {
  const compact = width < 620;
  const panelWidth = compact ? Math.min(width - 28, 294) : 320;
  const x = compact ? 14 : 24;
  const y = compact ? 14 : 22;
  roundedRect(context, x, y, panelWidth, 68, 18);
  context.fillStyle = "rgba(3,31,36,.78)";
  context.fill();
  context.strokeStyle = "rgba(223,251,224,.3)";
  context.stroke();

  context.fillStyle = "#efffe4";
  context.font = "800 14px system-ui, sans-serif";
  context.fillText("LILY-PAD TRAIL", x + 18, y + 25);
  context.font = "700 12px ui-monospace, monospace";
  context.fillStyle = "#bee5c9";
  context.fillText(`${guide.completedUnits} / ${guide.totalUnits} HOPS`, x + 18, y + 48);

  const barX = x + panelWidth - 116;
  const barY = y + 28;
  roundedRect(context, barX, barY, 94, 10, 5);
  context.fillStyle = "rgba(213,248,211,.16)";
  context.fill();
  roundedRect(context, barX, barY, 94 * guide.progress, 10, 5);
  context.fillStyle = "#b8e96f";
  context.fill();
}

function paintFroggyFrame(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  frame: RuntimeRenderFrame,
  devicePixelRatio: number,
) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const pixelWidth = Math.max(1, Math.round(width * devicePixelRatio));
  const pixelHeight = Math.max(1, Math.round(height * devicePixelRatio));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  const guide = frame.challenge?.kind === "squat" ? frame.challenge : null;
  const completed = guide?.completedUnits ?? 0;
  const total = Math.max(guide?.totalUnits ?? PAD_COUNT, 1);
  const motion = frame.reducedStimulation ? 0 : (Math.sin(frame.timestampMs / 260) + 1) / 2;
  const waterline = height * 0.73;

  // Foreground banks and reeds make the play field read as a pond, not a tinted camera.
  const bank = context.createLinearGradient(0, waterline, 0, height);
  bank.addColorStop(0, "rgba(2,47,48,.08)");
  bank.addColorStop(0.35, "rgba(2,34,35,.78)");
  bank.addColorStop(1, "rgba(1,20,24,.95)");
  context.fillStyle = bank;
  context.fillRect(0, waterline, width, height - waterline);
  context.strokeStyle = "rgba(188,226,147,.58)";
  context.lineWidth = 4;
  for (const side of [-1, 1] as const) {
    const origin = side < 0 ? 20 : width - 20;
    for (let index = 0; index < 5; index += 1) {
      context.beginPath();
      context.moveTo(origin + side * index * 9, height);
      context.quadraticCurveTo(origin + side * (16 + index * 8), height * 0.78, origin + side * (8 + index * 13), height * 0.61);
      context.stroke();
    }
  }

  const usableWidth = Math.max(260, width - 94);
  const spacing = usableWidth / Math.max(total - 1, 1);
  const padRadius = Math.max(26, Math.min(50, spacing * 0.36));
  const positions = Array.from({ length: total }, (_, index) => ({
    x: 47 + spacing * index,
    y: waterline + (index % 2 === 0 ? 20 : -7),
  }));
  positions.forEach((position, index) => {
    drawLilyPad(
      context,
      position.x,
      position.y,
      padRadius,
      index < completed ? "visited" : index === Math.min(completed, total - 1) ? "current" : "ahead",
      motion,
    );
  });

  if (guide !== null) {
    drawProgressPanel(context, width, guide);
    const currentIndex = Math.min(completed, total - 1);
    const current = positions[currentIndex];
    const next = positions[Math.min(currentIndex + 1, total - 1)];
    const landing = guide.phase === "cooldown" ? motion : 0;
    const frogX = current.x + (next.x - current.x) * landing;
    const hopArc = frame.reducedStimulation ? 0 : Math.sin(landing * Math.PI) * Math.min(68, height * 0.11);
    const crouch = guide.phase === "holding" ? Math.max(0.35, guide.holdProgress) : guide.phase === "active" ? motion * 0.12 : 0;
    drawFrog(context, frogX, current.y - padRadius * 0.52 - hopArc, Math.max(0.7, Math.min(1.05, width / 820)), crouch, 1);

    if (guide.phase === "holding") {
      context.textAlign = "center";
      context.fillStyle = "#f2ffd9";
      context.font = "900 18px system-ui, sans-serif";
      context.fillText("CROUCH… READY!", width / 2, height * 0.22);
      context.textAlign = "start";
    }
  }

  if (frame.celebrationProgress > 0) {
    const burst = frame.reducedStimulation ? 1 : Math.min(1, frame.celebrationProgress * 1.7);
    context.save();
    context.globalAlpha = burst;
    context.textAlign = "center";
    context.fillStyle = "rgba(3,35,34,.82)";
    roundedRect(context, width * 0.16, height * 0.18, width * 0.68, Math.min(170, height * 0.3), 28);
    context.fill();
    context.fillStyle = "#f0ffd9";
    context.font = `900 ${Math.max(28, Math.min(54, width * 0.07))}px system-ui, sans-serif`;
    context.fillText("POND CROSSED!", width / 2, height * 0.29);
    context.fillStyle = "#b8e96f";
    context.font = `800 ${Math.max(15, Math.min(23, width * 0.032))}px system-ui, sans-serif`;
    context.fillText("Every lily pad is glowing", width / 2, height * 0.36);
    for (let index = 0; index < 18; index += 1) {
      const angle = (index / 18) * Math.PI * 2;
      const distance = 42 + burst * Math.min(width, height) * 0.3;
      context.fillStyle = index % 2 === 0 ? "#d8f878" : "#ffb778";
      context.beginPath();
      context.arc(width / 2 + Math.cos(angle) * distance, height * 0.31 + Math.sin(angle) * distance * 0.55, 4 + (index % 3), 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }
}

export const FROGGY_RENDERER: RendererFactory = (options) => {
  const base = createDefaultRenderer(options);
  Object.assign(base.element.style, {
    backgroundImage: `linear-gradient(rgba(4,31,35,.03), rgba(3,24,34,.3)), ${POND_IMAGE}`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  });
  const cameraSurface = base.element.firstElementChild as HTMLElement | null;
  if (cameraSurface?.tagName === "CANVAS") cameraSurface.style.opacity = "0.35";

  const overlay = options.document.createElement("canvas");
  overlay.className = "game-fx-canvas";
  overlay.setAttribute("aria-hidden", "true");
  Object.assign(overlay.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
  });
  base.element.append(overlay);
  const context = overlay.getContext("2d");
  if (context === null) return base;
  const devicePixelRatio = Math.min(2, options.document.defaultView?.devicePixelRatio ?? 1);

  return {
    kind: base.kind,
    element: base.element,
    render(frame) {
      base.render(frame);
      paintFroggyFrame(context, overlay, frame, devicePixelRatio);
    },
    destroy() {
      overlay.remove();
      base.destroy();
    },
  };
};
