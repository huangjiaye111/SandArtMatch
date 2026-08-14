import { AD_TYPE_COINS, AD_TYPE_EXTRA_CARRIER, AD_TYPE_STAMINA, type AdType } from "./AdServiceTypes";

export type MockRewardFlowAction = "stamina" | "coins" | "revive";

export interface MockRewardFlowEntryData {
  readonly action: MockRewardFlowAction;
  readonly adType: AdType;
  readonly label: string;
  readonly rewardText: string;
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly presentationOnly: boolean;
}

export interface MockRewardFlowViewData {
  readonly entries: readonly MockRewardFlowEntryData[];
}

export function createMockRewardFlowViewData(options: {
  readonly includeRevive?: boolean;
  readonly staminaAmount?: number;
  readonly coinsAmount?: number;
} = {}): MockRewardFlowViewData {
  const entries: MockRewardFlowEntryData[] = [
    createEntry("stamina", AD_TYPE_STAMINA, "Stamina", `+${normalizeAmount(options.staminaAmount ?? 5)} stamina`, true),
    createEntry("coins", AD_TYPE_COINS, "Coins", `+${normalizeAmount(options.coinsAmount ?? 100)} coins`, true),
    createEntry("revive", AD_TYPE_EXTRA_CARRIER, "Revive", "Continue once", options.includeRevive === true),
  ];
  return Object.freeze({ entries: Object.freeze(entries) });
}

function createEntry(
  action: MockRewardFlowAction,
  adType: AdType,
  label: string,
  rewardText: string,
  visible: boolean,
): MockRewardFlowEntryData {
  return Object.freeze({
    action,
    adType,
    label,
    rewardText,
    visible,
    enabled: visible,
    presentationOnly: true,
  });
}

function normalizeAmount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    return 0;
  }
  return value;
}
