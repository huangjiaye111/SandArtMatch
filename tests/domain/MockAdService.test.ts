import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MockAdService } from "../../assets/scripts/services/MockAdService.ts";

describe("MockAdService", () => {
  it("returns success by default", async () => {
    const result = await new MockAdService({ logger: () => {} }).showRewardedAd("stamina");

    assert.equal(result.success, true);
  });

  it("returns failure when failure probability is 100 percent", async () => {
    const result = await new MockAdService({ failureProbability: 1, logger: () => {} }).showRewardedAd("coins");

    assert.equal(result.success, false);
    assert.equal(result.reason, "mock_failure");
  });

  it("always includes a success field", async () => {
    const result = await new MockAdService({ defaultResult: { success: false, reason: "closed" }, logger: () => {} }).showRewardedAd("extra_carrier");

    assert.equal(typeof result.success, "boolean");
  });
});
