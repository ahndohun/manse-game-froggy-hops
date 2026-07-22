import {
  createDefaultPoseProvider,
  isPointerControllable,
  type PoseFrameListener,
  type PoseInputSource,
  type PoseProviderMetrics,
  type ProviderFactory,
  type RuntimePoseFrame,
  type RuntimePoseProvider,
} from "@manse/runtime-web";

const SQUAT_OFFSETS: Readonly<Record<string, { readonly dx?: number; readonly dy?: number }>> = {
  left_hip: { dy: 0.1 },
  right_hip: { dy: 0.1 },
  left_knee: { dx: 0.06, dy: 0.02 },
  right_knee: { dx: -0.06, dy: 0.02 },
  left_shoulder: { dy: 0.1 },
  right_shoulder: { dy: 0.1 },
  nose: { dy: 0.1 },
};

/**
 * The stock pointer provider moves hand landmarks only. Froggy Hops judges a
 * squat, so pointer Y drives the same full-body shape used by the deterministic
 * child-motion replay: high = standing, low = hips down and knees out.
 */
export const FROGGY_PROVIDER_FACTORY: ProviderFactory = async (options) => {
  const provider = await createDefaultPoseProvider(options);
  return options.kind === "simulated" ? new FroggyPointerProvider(provider) : provider;
};

class FroggyPointerProvider implements RuntimePoseProvider {
  readonly id = "froggy-pointer";
  readonly kind = "simulated" as const;
  private squatAmount = 0;

  constructor(private readonly provider: RuntimePoseProvider) {}

  get state(): RuntimePoseProvider["state"] { return this.provider.state; }
  initialize(): Promise<void> { return this.provider.initialize(); }
  start(source?: PoseInputSource): Promise<void> { return this.provider.start(source); }
  pause(): void { this.provider.pause(); }
  resume(): void { this.provider.resume(); }
  stop(): Promise<void> { return this.provider.stop(); }
  destroy(): Promise<void> { return this.provider.destroy(); }
  getMetrics(): PoseProviderMetrics { return this.provider.getMetrics(); }

  setPointer(x: number, y: number, side: "left" | "right" = "right"): void {
    const normalized = Math.min(1, Math.max(0, (y - 0.48) / 0.2));
    this.squatAmount = normalized * normalized * (3 - 2 * normalized);
    if (isPointerControllable(this.provider)) this.provider.setPointer(x, y, side);
  }

  subscribe(listener: PoseFrameListener): () => void {
    return this.provider.subscribe((frame) => listener(this.transform(frame)));
  }

  getLatestFrame(): RuntimePoseFrame | null {
    const frame = this.provider.getLatestFrame();
    return frame === null ? null : this.transform(frame);
  }

  private transform(frame: RuntimePoseFrame): RuntimePoseFrame {
    const amount = this.squatAmount;
    if (amount <= 0) return frame;
    return {
      ...frame,
      poses: frame.poses.map((pose) => ({
        ...pose,
        landmarks: pose.landmarks.map((landmark) => {
          const offset = SQUAT_OFFSETS[landmark.name];
          if (offset === undefined) return landmark;
          return {
            ...landmark,
            x: clamp(landmark.x + (offset.dx ?? 0) * amount),
            y: clamp(landmark.y + (offset.dy ?? 0) * amount),
          };
        }),
      })),
    };
  }
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
