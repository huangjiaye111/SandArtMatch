export interface FeatureFlagsData {
  readonly battleExtraCarrierSlot: boolean;
}

const DEFAULT_FEATURE_FLAGS: FeatureFlagsData = Object.freeze({
  battleExtraCarrierSlot: false,
});

export function createFeatureFlags(overrides: Partial<FeatureFlagsData> = {}): FeatureFlagsData {
  return Object.freeze({
    ...DEFAULT_FEATURE_FLAGS,
    ...overrides,
  });
}

export function getBattleConveyorSlotCount(baseSlotCount: number, flags: FeatureFlagsData): number {
  if (!Number.isSafeInteger(baseSlotCount) || baseSlotCount <= 0) {
    throw new RangeError("Base conveyor slot count must be a positive safe integer.");
  }
  return flags.battleExtraCarrierSlot ? baseSlotCount + 1 : baseSlotCount;
}
