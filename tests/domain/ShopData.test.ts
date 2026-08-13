import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AdResult, AdService } from "../../assets/scripts/services/AdService.ts";
import { ShopData, SHOP_REFRESH_SECONDS, type ShopResourceStore } from "../../assets/scripts/shop/ShopData.ts";

describe("ShopData", () => {
  it("generates three free ad shop items", () => {
    const result = createData().getViewData();

    assert.equal(result.items.length, 3);
    assert.deepEqual(result.items.map((item) => item.id), ["ad-stamina", "ad-coins", "ad-extra-carrier"]);
    assert.deepEqual(result.items.map((item) => item.costType), ["free_ad", "free_ad", "free_ad"]);
  });

  it("returns complete item fields", () => {
    const item = createData().getViewData().items[0];

    assert.equal(item.id.length > 0, true);
    assert.equal(item.type, "stamina");
    assert.equal(item.displayName.length > 0, true);
    assert.equal(item.description.length > 0, true);
    assert.equal(item.rewardAmount, 5);
    assert.equal(item.cost, 0);
    assert.equal(item.available, true);
  });

  it("grants stamina when a rewarded ad succeeds", async () => {
    const resourceStore = createResourceStore({ stamina: 3, coins: 10 });
    const data = createData(resourceStore);

    const result = await data.claimItem("ad-stamina", createAdService({ success: true }));

    assert.equal(result.success, true);
    assert.equal(data.getViewData().currentStamina, 8);
    assert.equal(data.getViewData().currentCoins, 10);
  });

  it("grants coins when a rewarded ad succeeds", async () => {
    const resourceStore = createResourceStore({ stamina: 3, coins: 10 });
    const data = createData(resourceStore);

    const result = await data.claimItem("ad-coins", createAdService({ success: true }));

    assert.equal(result.success, true);
    assert.equal(data.getViewData().currentCoins, 110);
  });

  it("does not grant rewards when the ad fails", async () => {
    const resourceStore = createResourceStore({ stamina: 3, coins: 10 });
    const data = createData(resourceStore);

    const result = await data.claimItem("ad-stamina", createAdService({ success: false, reason: "closed" }));

    assert.equal(result.success, false);
    assert.equal(result.reason, "closed");
    assert.equal(data.getViewData().currentStamina, 3);
  });

  it("handles a missing item id safely", async () => {
    const data = createData();

    const result = await data.claimItem("missing", createAdService({ success: true }));

    assert.equal(result.success, false);
    assert.equal(result.reason, "item_not_found");
  });

  it("resets refresh time when refreshShop is called", () => {
    const data = createData();
    data.advanceRefreshTime(60);

    const result = data.refreshShop();

    assert.equal(result.refreshTimeRemaining, SHOP_REFRESH_SECONDS);
    assert.equal(result.canRefresh, false);
  });

  it("reports canRefresh after the refresh time reaches zero", () => {
    const data = createData();

    assert.equal(data.getViewData().canRefresh, false);
    assert.equal(data.advanceRefreshTime(SHOP_REFRESH_SECONDS).canRefresh, true);
  });
});

function createData(resourceStore = createResourceStore()): ShopData {
  return new ShopData(resourceStore);
}

function createResourceStore(initial: { readonly stamina: number; readonly coins: number } = { stamina: 5, coins: 20 }): ShopResourceStore {
  let stamina = initial.stamina;
  let coins = initial.coins;
  const items = new Map<string, number>();
  return Object.freeze({
    getCurrentStamina(): number {
      return stamina;
    },
    getCurrentCoins(): number {
      return coins;
    },
    addStamina(amount: number): void {
      stamina += amount;
    },
    addCoins(amount: number): void {
      coins += amount;
    },
    addItem(itemId: string, amount: number): void {
      items.set(itemId, (items.get(itemId) ?? 0) + amount);
    },
  });
}

function createAdService(result: AdResult): AdService {
  return Object.freeze({
    showRewardedAd(): Promise<AdResult> {
      return Promise.resolve(result);
    },
  });
}
