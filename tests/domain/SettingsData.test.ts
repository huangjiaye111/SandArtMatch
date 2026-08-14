import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemorySettingsStorage, SettingsData } from "../../assets/scripts/settings/SettingsData.ts";
import { createMockRewardFlowViewData } from "../../assets/scripts/services/MockRewardFlowData.ts";

describe("SettingsData", () => {
  it("defaults sound and vibration to enabled", () => {
    const result = new SettingsData(new MemorySettingsStorage()).getViewData();

    assert.equal(result.soundEnabled, true);
    assert.equal(result.vibrationEnabled, true);
    assert.deepEqual(result.toggles.map((toggle) => [toggle.action, toggle.valueText]), [
      ["sound", "On"],
      ["vibration", "On"],
    ]);
  });

  it("persists toggled settings", () => {
    const storage = new MemorySettingsStorage();
    const first = new SettingsData(storage);
    first.toggle("sound");
    first.toggle("vibration");

    const second = new SettingsData(storage).getViewData();

    assert.equal(second.soundEnabled, false);
    assert.equal(second.vibrationEnabled, false);
  });

  it("recovers defaults from corrupted storage", () => {
    const storage = new MemorySettingsStorage();
    storage.setItem("sand-art-match:settings:v1", "not-json");

    const result = new SettingsData(storage).getViewData();

    assert.equal(result.soundEnabled, true);
    assert.equal(result.vibrationEnabled, true);
  });
});

describe("MockRewardFlowData", () => {
  it("creates typed presentation-only entries for stamina and coins", () => {
    const result = createMockRewardFlowViewData({ staminaAmount: 3, coinsAmount: 40 });

    assert.deepEqual(result.entries.map((entry) => [entry.action, entry.adType, entry.rewardText, entry.visible, entry.presentationOnly]), [
      ["stamina", "stamina", "+3 stamina", true, true],
      ["coins", "coins", "+40 coins", true, true],
      ["revive", "extra_carrier", "Continue once", false, true],
    ]);
  });

  it("exposes revive only when requested", () => {
    const result = createMockRewardFlowViewData({ includeRevive: true });

    assert.equal(result.entries.find((entry) => entry.action === "revive")?.visible, true);
    assert.equal(result.entries.find((entry) => entry.action === "revive")?.enabled, true);
  });
});
