import type { AdResult, AdService } from "./AdService";
import type { AdType } from "./AdServiceTypes";

export interface MockAdServiceOptions {
  readonly failureProbability?: number;
  readonly delayMs?: number;
  readonly defaultResult?: AdResult;
  readonly logger?: (message: string) => void;
  readonly randomSource?: () => number;
}

export class MockAdService implements AdService {
  private readonly failureProbability: number;
  private readonly delayMs: number;
  private readonly defaultResult: AdResult | null;
  private readonly logger: (message: string) => void;
  private readonly randomSource: () => number;

  public constructor(options: MockAdServiceOptions = {}) {
    this.failureProbability = clampProbability(options.failureProbability ?? 0);
    this.delayMs = Math.max(0, options.delayMs ?? 0);
    this.defaultResult = options.defaultResult === undefined ? null : Object.freeze({ ...options.defaultResult });
    this.logger = options.logger ?? ((message) => console.log(message));
    this.randomSource = options.randomSource ?? Math.random;
  }

  public showRewardedAd(adType: AdType): Promise<AdResult> {
    this.logger(`[MockAdService] rewarded ad requested adType=${adType}`);
    return new Promise((resolve) => {
      const finish = () => resolve(this.createResult());
      if (this.delayMs === 0) {
        finish();
        return;
      }
      setTimeout(finish, this.delayMs);
    });
  }

  private createResult(): AdResult {
    if (this.defaultResult !== null) {
      return this.defaultResult;
    }
    if (this.failureProbability >= 1) {
      return Object.freeze({ success: false, reason: "mock_failure" });
    }
    if (this.failureProbability > 0 && this.randomSource() < this.failureProbability) {
      return Object.freeze({ success: false, reason: "mock_failure" });
    }
    return Object.freeze({ success: true });
  }
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
