import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Bucket, createBucket } from "../../assets/scripts/domain/bucket/Bucket.ts";
import {
  createConveyor,
  DEFAULT_CONVEYOR_MAX_SLOTS,
  type ConveyorState,
} from "../../assets/scripts/domain/bucket/Conveyor.ts";

type MutableConveyorState = {
  -readonly [Key in keyof ConveyorState]: ConveyorState[Key];
};

function bucket(instanceId: string, colorId = 1, capacity = 5, currentAmount = 0): Bucket {
  return createBucket(instanceId, { colorId, capacity }, { currentAmount });
}

function ids(conveyor: ReturnType<typeof createConveyor>): string[] {
  return conveyor.bucketsSnapshot().map((storedBucket) => storedBucket.instanceId);
}

describe("ConveyorSystem", () => {
  it("creates an empty conveyor with the default slot count", () => {
    const conveyor = createConveyor();

    assert.equal(DEFAULT_CONVEYOR_MAX_SLOTS, 6);
    assert.equal(conveyor.maxSlots, 6);
    assert.equal(conveyor.count, 0);
    assert.equal(conveyor.remainingSlots, 6);
    assert.equal(conveyor.isEmpty(), true);
    assert.equal(conveyor.isFull(), false);
    assert.equal(conveyor.findFirstEmptySlotIndex(), 0);
    assert.deepEqual(conveyor.snapshot(), {
      maxSlots: 6,
      slots: [null, null, null, null, null, null],
    });
  });

  it("creates an empty conveyor with a legal custom slot count", () => {
    const conveyor = createConveyor(3);

    assert.equal(conveyor.maxSlots, 3);
    assert.equal(conveyor.count, 0);
    assert.equal(conveyor.remainingSlots, 3);
    assert.equal(conveyor.isEmpty(), true);
    assert.equal(conveyor.isFull(), false);
    assert.deepEqual(conveyor.getSlots(), [
      { index: 0, bucketInstanceId: null },
      { index: 1, bucketInstanceId: null },
      { index: 2, bucketInstanceId: null },
    ]);
  });

  it("rejects invalid slot counts explicitly", () => {
    assert.throws(() => createConveyor(0), RangeError);
    assert.throws(() => createConveyor(-1), RangeError);
    assert.throws(() => createConveyor(1.5), RangeError);
    assert.throws(() => createConveyor(Number.NaN), RangeError);
    assert.throws(() => createConveyor(Number.POSITIVE_INFINITY), RangeError);
  });

  it("adds one bucket to the conveyor tail and occupies one slot", () => {
    const conveyor = createConveyor(2);
    const first = bucket("bucket-001", 2, 7, 3);

    const result = conveyor.addBucket(first);

    assert.equal(result.bucket, first);
    assert.equal(result.slotIndex, 0);
    assert.equal(conveyor.count, 1);
    assert.equal(conveyor.remainingSlots, 1);
    assert.equal(conveyor.isEmpty(), false);
    assert.equal(conveyor.isFull(), false);
    assert.equal(conveyor.getBucketAt(0), first);
    assert.equal(conveyor.findFirstEmptySlotIndex(), 1);
    assert.deepEqual(conveyor.snapshot(), {
      maxSlots: 2,
      slots: ["bucket-001", null],
    });
    assert.equal(first.status, "inConveyor");
    assert.equal(first.colorId, 2);
    assert.equal(first.capacity, 7);
    assert.equal(first.currentAmount, 3);
  });

  it("stores multiple buckets in insertion order", () => {
    const conveyor = createConveyor(4);
    const first = bucket("a");
    const second = bucket("b", 2);
    const third = bucket("c", 3);

    conveyor.addBucket(first);
    conveyor.addBucket(second);
    conveyor.addBucket(third);

    assert.deepEqual(ids(conveyor), ["a", "b", "c"]);
    assert.equal(conveyor.getBucketAt(0), first);
    assert.equal(conveyor.getBucketAt(1), second);
    assert.equal(conveyor.getBucketAt(2), third);
    assert.equal(conveyor.count, 3);
    assert.equal(conveyor.remainingSlots, 1);
    assert.deepEqual(conveyor.snapshot().slots, ["a", "b", "c", null]);
  });

  it("reports full state after filling all slots", () => {
    const conveyor = createConveyor(2);

    conveyor.addBucket(bucket("a"));
    conveyor.addBucket(bucket("b"));

    assert.equal(conveyor.count, 2);
    assert.equal(conveyor.remainingSlots, 0);
    assert.equal(conveyor.isFull(), true);
    assert.equal(conveyor.findFirstEmptySlotIndex(), null);
    assert.deepEqual(conveyor.snapshot().slots, ["a", "b"]);
  });

  it("rejects adding to a full conveyor without changing state", () => {
    const conveyor = createConveyor(2);
    const first = bucket("a", 1, 5, 1);
    const second = bucket("b", 2, 6, 2);
    const rejected = bucket("c", 3, 7, 3);

    conveyor.addBucket(first);
    conveyor.addBucket(second);
    const before = conveyor.snapshot();

    assert.throws(() => conveyor.addBucket(rejected), Error);
    assert.deepEqual(conveyor.snapshot(), before);
    assert.deepEqual(ids(conveyor), ["a", "b"]);
    assert.equal(conveyor.count, 2);
    assert.equal(conveyor.remainingSlots, 0);
    assert.equal(rejected.status, "available");
    assert.equal(rejected.colorId, 3);
    assert.equal(rejected.capacity, 7);
    assert.equal(rejected.currentAmount, 3);
  });

  it("rejects adding the same bucket instance twice without changing state", () => {
    const conveyor = createConveyor(3);
    const first = bucket("duplicate");

    conveyor.addBucket(first);
    const before = conveyor.snapshot();

    assert.throws(() => conveyor.addBucket(first), Error);
    assert.deepEqual(conveyor.snapshot(), before);
    assert.deepEqual(ids(conveyor), ["duplicate"]);
    assert.equal(conveyor.count, 1);
    assert.equal(conveyor.remainingSlots, 2);
  });

  it("rejects different bucket objects with the same instanceId", () => {
    const conveyor = createConveyor(3);
    const original = bucket("same-id", 1, 5, 1);
    const duplicateId = bucket("same-id", 2, 8, 4);

    conveyor.addBucket(original);
    const before = conveyor.snapshot();

    assert.throws(() => conveyor.addBucket(duplicateId), Error);
    assert.deepEqual(conveyor.snapshot(), before);
    assert.deepEqual(ids(conveyor), ["same-id"]);
    assert.equal(duplicateId.status, "available");
    assert.equal(duplicateId.colorId, 2);
    assert.equal(duplicateId.capacity, 8);
    assert.equal(duplicateId.currentAmount, 4);
  });

  it("removes the head bucket and shifts later buckets forward", () => {
    const conveyor = createConveyor(4);
    const first = bucket("a");
    const second = bucket("b");
    const third = bucket("c");
    conveyor.addBucket(first);
    conveyor.addBucket(second);
    conveyor.addBucket(third);

    const result = conveyor.removeBucketAt(0);

    assert.equal(result.bucket, first);
    assert.equal(result.slotIndex, 0);
    assert.deepEqual(ids(conveyor), ["b", "c"]);
    assert.equal(conveyor.getBucketAt(0), second);
    assert.equal(conveyor.getBucketAt(1), third);
    assert.equal(conveyor.count, 2);
    assert.equal(conveyor.remainingSlots, 2);
    assert.deepEqual(conveyor.snapshot().slots, ["b", "c", null, null]);
  });

  it("removes a middle bucket and preserves the remaining order", () => {
    const conveyor = createConveyor(5);
    const first = bucket("a");
    const second = bucket("b");
    const third = bucket("c");
    const fourth = bucket("d");
    conveyor.addBucket(first);
    conveyor.addBucket(second);
    conveyor.addBucket(third);
    conveyor.addBucket(fourth);

    const result = conveyor.removeBucketAt(1);

    assert.equal(result.bucket, second);
    assert.deepEqual(ids(conveyor), ["a", "c", "d"]);
    assert.equal(conveyor.getBucketAt(0), first);
    assert.equal(conveyor.getBucketAt(1), third);
    assert.equal(conveyor.getBucketAt(2), fourth);
    assert.equal(conveyor.count, 3);
    assert.equal(conveyor.remainingSlots, 2);
  });

  it("removes the tail bucket and leaves other bucket order unchanged", () => {
    const conveyor = createConveyor(4);
    const first = bucket("a");
    const second = bucket("b");
    const third = bucket("c");
    conveyor.addBucket(first);
    conveyor.addBucket(second);
    conveyor.addBucket(third);

    const result = conveyor.removeBucketAt(2);

    assert.equal(result.bucket, third);
    assert.deepEqual(ids(conveyor), ["a", "b"]);
    assert.equal(conveyor.getBucketAt(0), first);
    assert.equal(conveyor.getBucketAt(1), second);
    assert.equal(conveyor.count, 2);
    assert.equal(conveyor.remainingSlots, 2);
  });

  it("finds and removes buckets by instanceId", () => {
    const conveyor = createConveyor(4);
    const first = bucket("a");
    const second = bucket("b");
    const third = bucket("c");
    conveyor.addBucket(first);
    conveyor.addBucket(second);
    conveyor.addBucket(third);

    assert.equal(conveyor.findBucketIndex("b"), 1);
    assert.equal(conveyor.findBucket("b"), second);
    assert.equal(conveyor.hasBucket("b"), true);

    const result = conveyor.removeBucketByInstanceId("b");

    assert.equal(result.bucket, second);
    assert.equal(result.slotIndex, 1);
    assert.deepEqual(ids(conveyor), ["a", "c"]);
    assert.equal(conveyor.findBucketIndex("b"), null);
    assert.equal(conveyor.findBucket("b"), null);
    assert.equal(conveyor.hasBucket("b"), false);
  });

  it("rejects removing a missing bucket without changing state", () => {
    const conveyor = createConveyor(3);
    conveyor.addBucket(bucket("a"));
    conveyor.addBucket(bucket("b"));
    const before = conveyor.snapshot();

    assert.throws(() => conveyor.removeBucketByInstanceId("missing"), Error);
    assert.deepEqual(conveyor.snapshot(), before);
    assert.deepEqual(ids(conveyor), ["a", "b"]);
    assert.equal(conveyor.count, 2);
    assert.equal(conveyor.remainingSlots, 1);
  });

  it("rejects out-of-bounds slot access and empty slot removal clearly", () => {
    const conveyor = createConveyor(2);
    conveyor.addBucket(bucket("a"));
    const before = conveyor.snapshot();

    assert.throws(() => conveyor.getBucketAt(-1), RangeError);
    assert.throws(() => conveyor.getBucketAt(2), RangeError);
    assert.throws(() => conveyor.getBucketAt(1), Error);
    assert.throws(() => conveyor.getSlotState(2), RangeError);
    assert.throws(() => conveyor.removeBucketAt(-1), RangeError);
    assert.throws(() => conveyor.removeBucketAt(2), RangeError);
    assert.throws(() => conveyor.removeBucketAt(1), Error);
    assert.deepEqual(conveyor.snapshot(), before);
    assert.deepEqual(ids(conveyor), ["a"]);
  });

  it("does not expose a mutable internal bucket array through snapshots", () => {
    const conveyor = createConveyor(3);
    const first = bucket("a");
    const second = bucket("b");
    conveyor.addBucket(first);
    conveyor.addBucket(second);

    const bucketList = conveyor.bucketsSnapshot();
    const state = conveyor.snapshot();
    const slots = conveyor.getSlots();

    assert.throws(() => {
      (bucketList as Bucket[]).push(bucket("c"));
    }, TypeError);
    assert.throws(() => {
      ((state as MutableConveyorState).slots as string[])[0] = "changed";
    }, TypeError);
    assert.throws(() => {
      (slots as Array<{ index: number; bucketInstanceId: string | null }>).pop();
    }, TypeError);

    assert.deepEqual(ids(conveyor), ["a", "b"]);
    assert.deepEqual(conveyor.snapshot().slots, ["a", "b", null]);
    assert.equal(conveyor.count, 2);
    assert.equal(conveyor.remainingSlots, 1);
  });

  it("does not modify bucket color, capacity, or collected amount during conveyor operations", () => {
    const conveyor = createConveyor(3);
    const first = bucket("stable", 9, 12, 4);

    conveyor.addBucket(first);
    conveyor.removeBucketByInstanceId("stable");

    assert.equal(first.instanceId, "stable");
    assert.equal(first.colorId, 9);
    assert.equal(first.capacity, 12);
    assert.equal(first.currentAmount, 4);
  });

  it("keeps different conveyor instances independent", () => {
    const firstConveyor = createConveyor(2);
    const secondConveyor = createConveyor(3);

    firstConveyor.addBucket(bucket("a"));
    secondConveyor.addBucket(bucket("b"));
    secondConveyor.addBucket(bucket("c"));

    assert.deepEqual(ids(firstConveyor), ["a"]);
    assert.equal(firstConveyor.count, 1);
    assert.equal(firstConveyor.remainingSlots, 1);
    assert.deepEqual(ids(secondConveyor), ["b", "c"]);
    assert.equal(secondConveyor.count, 2);
    assert.equal(secondConveyor.remainingSlots, 1);
  });
});
