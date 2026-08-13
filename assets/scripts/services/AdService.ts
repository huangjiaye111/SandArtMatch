import type { AdType } from "./AdServiceTypes";

export interface AdResult {
  readonly success: boolean;
  readonly reason?: string;
}

export interface AdService {
  showRewardedAd(adType: AdType): Promise<AdResult>;
}
