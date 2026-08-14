import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BattlePhase } from "../../assets/scripts/domain/battle/BattleState.ts";
import { createBattleStateMachine } from "../../assets/scripts/domain/battle/BattleStateMachine.ts";
import { createBucket, type BucketState } from "../../assets/scripts/domain/bucket/Bucket.ts";
import {
  BUCKET_POOL_COLUMN_COUNT,
  createBucketPoolState,
  getBucketPoolSelectionReason,
  getSelectableBucketIds,
} from "../../assets/scripts/domain/bucket/BucketPool.ts";
import { createSeededRandom } from "../../assets/scripts/domain/core/Random.ts";
import { SandGrid } from "../../assets/scripts/domain/core/SandGrid.ts";

function basicGrid() {
  return SandGrid.fromConfig({
    width: 3,
    height: 2,
    cells: [
      [null, null, null],
      [1, 2, null],
    ],
  });
}

function bucket(instanceId: string, colorId = 1, status: BucketState["status"] = "available") {
  const created = createBucket(instanceId, { colorId, capacity: 3 });
  if (status === "available") {
    return created;
  }
  if (status === "inConveyor") {
    created.moveToConveyor();
    return created;
  }
  created.moveToConveyor();
  created.completeAndLeave();
  return created;
}

describe("BucketPool", () => {
  it("groups available buckets into four independent column fronts", () => {
    const state = createBucketPoolState([
      bucket("c0-front", 1).snapshot(),
      bucket("c1-front", 2).snapshot(),
      bucket("c2-front", 3).snapshot(),
      bucket("c3-front", 4).snapshot(),
      bucket("c0-second", 1).snapshot(),
      bucket("c1-second", 2).snapshot(),
      bucket("c2-second", 3).snapshot(),
      bucket("c3-second", 4).snapshot(),
    ]);

    assert.equal(BUCKET_POOL_COLUMN_COUNT, 4);
    assert.deepEqual(state.columns.map((column) => column.bucketIds), [
      ["c0-front", "c0-second"],
      ["c1-front", "c1-second"],
      ["c2-front", "c2-second"],
      ["c3-front", "c3-second"],
    ]);
    assert.deepEqual(state.selectableBucketIds, ["c0-front", "c1-front", "c2-front", "c3-front"]);
    assert.deepEqual(getSelectableBucketIds([
      bucket("c0-front", 1).snapshot(),
      bucket("c1-front", 2).snapshot(),
      bucket("c2-front", 3).snapshot(),
      bucket("c3-front", 4).snapshot(),
      bucket("c0-second", 1).snapshot(),
      bucket("c1-second", 2).snapshot(),
      bucket("c2-second", 3).snapshot(),
      bucket("c3-second", 4).snapshot(),
    ]), ["c0-front", "c1-front", "c2-front", "c3-front"]);
  });


  it("keeps visual bucket slots in their original columns after a front bucket leaves", () => {
    const state = createBucketPoolState([
      bucket("c0-front", 1, "inConveyor").snapshot(),
      bucket("c1-front", 2).snapshot(),
      bucket("c2-front", 3).snapshot(),
      bucket("c3-front", 4).snapshot(),
      bucket("c0-second", 1).snapshot(),
      bucket("c1-second", 2).snapshot(),
      bucket("c2-second", 3).snapshot(),
      bucket("c3-second", 4).snapshot(),
    ]);

    assert.deepEqual(state.buckets.map((stored) => [stored.bucketId, stored.columnIndex, stored.visibleDepthIndex]), [
      ["c0-second", 0, 0],
      ["c1-front", 1, 0],
      ["c2-front", 2, 0],
      ["c3-front", 3, 0],
      ["c1-second", 1, 1],
      ["c2-second", 2, 1],
      ["c3-second", 3, 1],
    ]);
  });

  it("rejects deeper column buckets until the front bucket is removed", () => {
    const machine = createBattleStateMachine({
      grid: basicGrid(),
      buckets: [
        bucket("c0-front", 1),
        bucket("c1-front", 2),
        bucket("c2-front", 3),
        bucket("c3-front", 4),
        bucket("c0-second", 1),
        bucket("c1-second", 2),
        bucket("c2-second", 3),
        bucket("c3-second", 4),
      ],
      random: createSeededRandom("bucket-pool-front"),
    });

    assert.equal(getBucketPoolSelectionReason(machine.snapshot().buckets, "c0-second"), "bucketNotColumnFront");

    const first = machine.selectBucket("c0-front");
    assert.equal(first.accepted, true);
    assert.equal(machine.currentPhase, BattlePhase.WaitingInput);
    assert.equal(getBucketPoolSelectionReason(machine.snapshot().buckets, "c0-second"), null);

    const second = machine.selectBucket("c0-second");
    assert.equal(second.accepted, true);
    assert.equal(second.snapshot.buckets.find((stored) => stored.instanceId === "c0-front")?.status, "inConveyor");
  });
});
