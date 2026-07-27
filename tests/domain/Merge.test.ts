import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Bucket, createBucket } from "../../assets/scripts/domain/bucket/Bucket.ts";
import { createConveyor } from "../../assets/scripts/domain/bucket/Conveyor.ts";
import {
  DEFAULT_MERGE_BUCKET_COUNT,
  createMergeSystem,
  type MergeResult,
} from "../../assets/scripts/domain/bucket/Merge.ts";

type MutableMergeResult = {
  -readonly [Key in keyof MergeResult]: MergeResult[Key];
};

function bucket(instanceId: string, colorId = 1, capacity = 5, currentAmount = 0): Bucket {
  return createBucket(instanceId, { colorId, capacity }, { currentAmount });
}

function conveyorWith(buckets: readonly Bucket[], maxSlots = 6): ReturnType<typeof createConveyor> {
  const conveyor = createConveyor(maxSlots);
  for (const storedBucket of buckets) {
    conveyor.addBucket(storedBucket);
  }
  return conveyor;
}

function ids(conveyor: ReturnType<typeof createConveyor>): string[] {
  return conveyor.bucketsSnapshot().map((storedBucket) => storedBucket.instanceId);
}

describe("MergeSystem", () => {
  it("does not merge with fewer than three buckets and keeps conveyor unchanged", () => {
    const first = bucket("a", 1, 5, 1);
    const second = bucket("b", 1, 6, 2);
    const conveyor = conveyorWith([first, second]);
    const before = conveyor.snapshot();

    const result = createMergeSystem().mergeOnce(conveyor);

    assert.equal(DEFAULT_MERGE_BUCKET_COUNT, 3);
    assert.equal(result.merged, false);
    assert.equal(result.candidate, null);
    assert.deepEqual(result.participantBuckets, []);
    assert.equal(result.mergedBucket, null);
    assert.equal(result.insertIndex, null);
    assert.deepEqual(result.state, before);
    assert.deepEqual(conveyor.snapshot(), before);
    assert.deepEqual(ids(conveyor), ["a", "b"]);
    assert.equal(conveyor.count, 2);
    assert.equal(conveyor.remainingSlots, 4);
  });

  it("does not merge three different colors", () => {
    const conveyor = conveyorWith([bucket("a", 1), bucket("b", 2), bucket("c", 3)]);
    const before = conveyor.snapshot();

    const result = createMergeSystem().mergeOnce(conveyor);

    assert.equal(result.merged, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(conveyor.snapshot(), before);
    assert.deepEqual(ids(conveyor), ["a", "b", "c"]);
    assert.equal(conveyor.count, 3);
    assert.equal(conveyor.remainingSlots, 3);
  });

  it("merges three same-color buckets into a deterministic in-conveyor bucket", () => {
    const conveyor = conveyorWith([
      bucket("red-1", 2, 5),
      bucket("red-2", 2, 6),
      bucket("red-3", 2, 7),
    ]);

    const result = createMergeSystem().mergeOnce(conveyor);

    assert.equal(result.merged, true);
    assert.deepEqual(result.candidate, {
      colorId: 2,
      bucketIndexes: [0, 1, 2],
      bucketInstanceIds: ["red-1", "red-2", "red-3"],
    });
    assert.deepEqual(result.participantBuckets, [
      { instanceId: "red-1", colorId: 2, capacity: 5, currentAmount: 0, remainingCapacity: 5 },
      { instanceId: "red-2", colorId: 2, capacity: 6, currentAmount: 0, remainingCapacity: 6 },
      { instanceId: "red-3", colorId: 2, capacity: 7, currentAmount: 0, remainingCapacity: 7 },
    ]);
    assert.deepEqual(result.mergedBucket, {
      instanceId: "merge-1-2-red-1_red-2_red-3",
      colorId: 2,
      capacity: 18,
      currentAmount: 0,
      remainingCapacity: 18,
    });
    assert.equal(result.insertIndex, 0);
    assert.deepEqual(ids(conveyor), ["merge-1-2-red-1_red-2_red-3"]);
    assert.equal(conveyor.getBucketAt(0).status, "inConveyor");
    assert.equal(conveyor.count, 1);
    assert.equal(conveyor.remainingSlots, 5);
    assert.deepEqual(result.state.slots, ["merge-1-2-red-1_red-2_red-3", null, null, null, null, null]);
  });

  it("allows same-color buckets with different capacities and conserves totals", () => {
    const conveyor = conveyorWith([
      bucket("a", 4, 2, 1),
      bucket("b", 4, 7, 3),
      bucket("c", 4, 11, 8),
    ]);

    const result = createMergeSystem().mergeOnce(conveyor);

    assert.equal(result.merged, true);
    assert.deepEqual(result.mergedBucket, {
      instanceId: "merge-1-4-a_b_c",
      colorId: 4,
      capacity: 20,
      currentAmount: 12,
      remainingCapacity: 8,
    });
    assert.equal(result.participantBuckets.reduce((sum, item) => sum + item.capacity, 0), 20);
    assert.equal(result.participantBuckets.reduce((sum, item) => sum + item.currentAmount, 0), 12);
    assert.equal(conveyor.getBucketAt(0).capacity, 20);
    assert.equal(conveyor.getBucketAt(0).currentAmount, 12);
    assert.equal(conveyor.getBucketAt(0).remainingCapacity, 8);
  });

  it("merges non-adjacent buckets at the earliest participating position and preserves other order", () => {
    const conveyor = conveyorWith([
      bucket("red-1", 1, 5, 1),
      bucket("blue-1", 2, 5, 2),
      bucket("red-2", 1, 6, 3),
      bucket("green-1", 3, 5, 4),
      bucket("red-3", 1, 7, 5),
    ]);

    const result = createMergeSystem().mergeOnce(conveyor);

    assert.equal(result.insertIndex, 0);
    assert.deepEqual(result.candidate?.bucketIndexes, [0, 2, 4]);
    assert.deepEqual(ids(conveyor), ["merge-1-1-red-1_red-2_red-3", "blue-1", "green-1"]);
    assert.equal(conveyor.count, 3);
    assert.equal(conveyor.remainingSlots, 3);
    assert.equal(conveyor.getBucketAt(1).instanceId, "blue-1");
    assert.equal(conveyor.getBucketAt(1).colorId, 2);
    assert.equal(conveyor.getBucketAt(1).capacity, 5);
    assert.equal(conveyor.getBucketAt(1).currentAmount, 2);
    assert.equal(conveyor.getBucketAt(2).instanceId, "green-1");
    assert.equal(conveyor.getBucketAt(2).colorId, 3);
    assert.equal(conveyor.getBucketAt(2).capacity, 5);
    assert.equal(conveyor.getBucketAt(2).currentAmount, 4);
  });

  it("chooses the first three indexes when one color has four or more buckets", () => {
    const conveyor = conveyorWith([
      bucket("red-1", 1, 5, 1),
      bucket("red-2", 1, 6, 2),
      bucket("blue-1", 2, 5, 3),
      bucket("red-3", 1, 7, 4),
      bucket("red-4", 1, 8, 5),
    ]);

    const result = createMergeSystem().mergeOnce(conveyor);

    assert.deepEqual(result.candidate, {
      colorId: 1,
      bucketIndexes: [0, 1, 3],
      bucketInstanceIds: ["red-1", "red-2", "red-3"],
    });
    assert.deepEqual(ids(conveyor), ["merge-1-1-red-1_red-2_red-3", "blue-1", "red-4"]);
    assert.equal(conveyor.getBucketAt(2).instanceId, "red-4");
    assert.equal(conveyor.getBucketAt(2).capacity, 8);
    assert.equal(conveyor.getBucketAt(2).currentAmount, 5);
  });

  it("chooses the color that reaches three buckets first when several colors can merge", () => {
    const conveyor = conveyorWith([
      bucket("red-1", 1),
      bucket("blue-1", 2),
      bucket("red-2", 1),
      bucket("blue-2", 2),
      bucket("blue-3", 2),
      bucket("red-3", 1),
    ]);

    const result = createMergeSystem().mergeOnce(conveyor);

    assert.deepEqual(result.candidate, {
      colorId: 2,
      bucketIndexes: [1, 3, 4],
      bucketInstanceIds: ["blue-1", "blue-2", "blue-3"],
    });
    assert.equal(result.insertIndex, 1);
    assert.deepEqual(ids(conveyor), ["red-1", "merge-1-2-blue-1_blue-2_blue-3", "red-2", "red-3"]);
  });

  it("allows full buckets that have not left the conveyor and conserves full amount", () => {
    const conveyor = conveyorWith([
      bucket("full-1", 5, 3, 3),
      bucket("full-2", 5, 4, 4),
      bucket("full-3", 5, 8, 8),
    ]);

    const result = createMergeSystem().mergeOnce(conveyor);

    assert.deepEqual(result.mergedBucket, {
      instanceId: "merge-1-5-full-1_full-2_full-3",
      colorId: 5,
      capacity: 15,
      currentAmount: 15,
      remainingCapacity: 0,
    });
    assert.equal(conveyor.getBucketAt(0).isFull(), true);
  });

  it("does not repeat a merge after one completed merge leaves no new group of three", () => {
    const conveyor = conveyorWith([bucket("a", 1), bucket("b", 1), bucket("c", 1)]);
    const mergeSystem = createMergeSystem();

    const first = mergeSystem.mergeOnce(conveyor);
    const second = mergeSystem.mergeOnce(conveyor);

    assert.equal(first.merged, true);
    assert.equal(second.merged, false);
    assert.deepEqual(ids(conveyor), ["merge-1-1-a_b_c"]);
    assert.equal(conveyor.count, 1);
    assert.equal(conveyor.remainingSlots, 5);
  });

  it("uses stable unique ids across consecutive merges", () => {
    const conveyor = conveyorWith([
      bucket("a1", 1),
      bucket("a2", 1),
      bucket("a3", 1),
      bucket("b1", 2),
      bucket("b2", 2),
      bucket("b3", 2),
    ]);
    const mergeSystem = createMergeSystem();

    const first = mergeSystem.mergeOnce(conveyor);
    const second = mergeSystem.mergeOnce(conveyor);

    assert.equal(first.mergedBucket?.instanceId, "merge-1-1-a1_a2_a3");
    assert.equal(second.mergedBucket?.instanceId, "merge-2-2-b1_b2_b3");
    assert.equal(first.mergedBucket?.instanceId === second.mergedBucket?.instanceId, false);
    assert.deepEqual(ids(conveyor), ["merge-1-1-a1_a2_a3", "merge-2-2-b1_b2_b3"]);
    assert.equal(conveyor.count, 2);
    assert.equal(conveyor.remainingSlots, 4);
  });

  it("fails atomically when merged capacity would exceed a safe integer", () => {
    const first = bucket("huge-1", 7, Number.MAX_SAFE_INTEGER - 1);
    const second = bucket("huge-2", 7, 1);
    const third = bucket("huge-3", 7, 1);
    const conveyor = conveyorWith([first, second, third]);
    const before = conveyor.snapshot();

    assert.throws(() => createMergeSystem().mergeOnce(conveyor), RangeError);
    assert.deepEqual(conveyor.snapshot(), before);
    assert.deepEqual(ids(conveyor), ["huge-1", "huge-2", "huge-3"]);
    assert.equal(first.status, "inConveyor");
    assert.equal(second.status, "inConveyor");
    assert.equal(third.status, "inConveyor");
  });

  it("returns immutable merge results that cannot mutate conveyor internals", () => {
    const conveyor = conveyorWith([bucket("a", 1, 5, 1), bucket("b", 1, 5, 2), bucket("c", 1, 5, 3)]);

    const result = createMergeSystem().mergeOnce(conveyor);

    assert.throws(() => {
      (result as MutableMergeResult).insertIndex = 99;
    }, TypeError);
    assert.throws(() => {
      (result.participantBuckets as Array<unknown>).pop();
    }, TypeError);
    assert.throws(() => {
      (result.state.slots as string[])[0] = "changed";
    }, TypeError);
    assert.deepEqual(ids(conveyor), ["merge-1-1-a_b_c"]);
    assert.equal(conveyor.getBucketAt(0).currentAmount, 6);
    assert.equal(conveyor.getBucketAt(0).remainingCapacity, 9);
  });
});
