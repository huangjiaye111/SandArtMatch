import type { AdService, AdResult } from "../services/AdService";
import {
  AD_TYPE_COINS,
  AD_TYPE_EXTRA_CARRIER,
  AD_TYPE_STAMINA,
  type AdType,
} from "../services/AdServiceTypes";

export type ShopItemType = "stamina" | "coins" | "item";
export type ShopCostType = "free_ad" | "coins";

export interface ShopItemData {
  readonly id: string;
  readonly type: ShopItemType;
  readonly displayName: string;
  readonly description: string;
  readonly rewardAmount: number;
  readonly costType: ShopCostType;
  readonly cost: number;
  readonly available: boolean;
  readonly adType: AdType;
}

export interface ShopViewData {
  readonly currentStamina: number;
  readonly currentCoins: number;
  readonly items: readonly ShopItemData[];
  readonly refreshTimeRemaining: number;
  readonly canRefresh: boolean;
}

export interface ShopResourceStore {
  getCurrentStamina(): number;
  getCurrentCoins(): number;
  addStamina(amount: number): void;
  addCoins(amount: number): void;
  addItem(itemId: string, amount: number): void;
}

export interface ShopItemConfig {
  readonly id: string;
  readonly type: ShopItemType;
  readonly displayName: string;
  readonly description: string;
  readonly rewardAmount: number;
  readonly adType: AdType;
}

export const SHOP_REFRESH_SECONDS = 60;

const DEFAULT_ITEMS: readonly ShopItemConfig[] = Object.freeze([
  Object.freeze({
    id: "ad-stamina",
    type: "stamina",
    displayName: "Stamina Gift",
    description: "Watch a rewarded ad to recover stamina.",
    rewardAmount: 5,
    adType: AD_TYPE_STAMINA,
  }),
  Object.freeze({
    id: "ad-coins",
    type: "coins",
    displayName: "Coin Gift",
    description: "Watch a rewarded ad to receive coins.",
    rewardAmount: 100,
    adType: AD_TYPE_COINS,
  }),
  Object.freeze({
    id: "ad-extra-carrier",
    type: "item",
    displayName: "Extra Carrier",
    description: "Watch a rewarded ad to receive a temporary item.",
    rewardAmount: 1,
    adType: AD_TYPE_EXTRA_CARRIER,
  }),
]);

export class ShopData {
  private readonly resourceStore: ShopResourceStore;
  private readonly itemConfigs: readonly ShopItemConfig[];
  private refreshTimeRemaining = SHOP_REFRESH_SECONDS;

  public constructor(resourceStore: ShopResourceStore, itemConfigs: readonly ShopItemConfig[] = DEFAULT_ITEMS) {
    this.resourceStore = resourceStore;
    this.itemConfigs = Object.freeze(itemConfigs.map((item) => Object.freeze({ ...item })));
  }

  public getViewData(): ShopViewData {
    return Object.freeze({
      currentStamina: this.resourceStore.getCurrentStamina(),
      currentCoins: this.resourceStore.getCurrentCoins(),
      items: Object.freeze(this.itemConfigs.map((item) => this.createItemData(item))),
      refreshTimeRemaining: this.refreshTimeRemaining,
      canRefresh: this.refreshTimeRemaining <= 0,
    });
  }

  public async claimItem(itemId: string, adService: AdService): Promise<AdResult> {
    const item = this.itemConfigs.find((candidate) => candidate.id === itemId);
    if (item === undefined) {
      return Object.freeze({ success: false, reason: "item_not_found" });
    }
    const result = await adService.showRewardedAd(item.adType);
    if (!result.success) {
      return Object.freeze({ success: false, reason: result.reason ?? "ad_failed" });
    }
    this.grantReward(item);
    return Object.freeze({ success: true });
  }

  public refreshShop(): ShopViewData {
    this.refreshTimeRemaining = SHOP_REFRESH_SECONDS;
    return this.getViewData();
  }

  public advanceRefreshTime(seconds: number): ShopViewData {
    if (Number.isFinite(seconds) && seconds > 0) {
      this.refreshTimeRemaining = Math.max(0, this.refreshTimeRemaining - seconds);
    }
    return this.getViewData();
  }

  private createItemData(config: ShopItemConfig): ShopItemData {
    return Object.freeze({
      id: config.id,
      type: config.type,
      displayName: config.displayName,
      description: config.description,
      rewardAmount: config.rewardAmount,
      costType: "free_ad" as const,
      cost: 0,
      available: true,
      adType: config.adType,
    });
  }

  private grantReward(item: ShopItemConfig): void {
    if (item.type === "stamina") {
      this.resourceStore.addStamina(item.rewardAmount);
      return;
    }
    if (item.type === "coins") {
      this.resourceStore.addCoins(item.rewardAmount);
      return;
    }
    this.resourceStore.addItem(item.id, item.rewardAmount);
  }
}
