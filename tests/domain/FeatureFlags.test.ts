import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createFeatureFlags, getBattleConveyorSlotCount } from "../../assets/scripts/services/FeatureFlags.ts";

describe("FeatureFlags", () => {
  it("keeps the battle extra carrier slot disabled by default", () => {
    const flags = createFeatureFlags();

    assert.equal(flags.battleExtraCarrierSlot, false);
    assert.equal(getBattleConveyorSlotCount(6, flags), 6);
  });

  it("adds exactly one battle conveyor slot when explicitly enabled", () => {
    const flags = createFeatureFlags({ battleExtraCarrierSlot: true });

    assert.equal(getBattleConveyorSlotCount(6, flags), 7);
  });

  it("rejects invalid base conveyor slot counts", () => {
    assert.throws(() => getBattleConveyorSlotCount(0, createFeatureFlags()), /positive safe integer/);
  });
});
