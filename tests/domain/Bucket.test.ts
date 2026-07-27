import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  Bucket,
  createBucket,
  type BucketState,
} from "../../assets/scripts/domain/bucket/Bucket.ts";

type MutableBucketState = {
  -readonly [Key in keyof BucketState]: BucketState[Key];
};

describe("Bucket", () => {
  it("creates a normal bucket from valid configuration", () => {
    const bucket = createBucket("bucket-001", {
      colorId: 1,
      capacity: 5,
    });

    assert.equal(bucket.instanceId, "bucket-001");
    assert.equal(bucket.colorId, 1);
    assert.equal(bucket.capacity, 5);
    assert.equal(bucket.currentAmount, 0);
    assert.equal(bucket.remainingCapacity, 5);
    assert.equal(bucket.status, "available");
    assert.equal(bucket.isEmpty(), true);
    assert.equal(bucket.isFull(), false);
    assert.deepEqual(bucket.snapshot(), {
      instanceId: "bucket-001",
      colorId: 1,
      capacity: 5,
      amount: 0,
      status: "available",
    });
  });

  it("keeps different color ids and capacities", () => {
    const red = createBucket("red-small", { colorId: 2, capacity: 3 });
    const blue = createBucket("blue-large", { colorId: 7, capacity: 11 });

    assert.equal(red.colorId, 2);
    assert.equal(red.capacity, 3);
    assert.equal(blue.colorId, 7);
    assert.equal(blue.capacity, 11);
  });

  it("rejects invalid capacity values", () => {
    assert.throws(() => createBucket("zero", { colorId: 1, capacity: 0 }), RangeError);
    assert.throws(() => createBucket("negative", { colorId: 1, capacity: -2 }), RangeError);
    assert.throws(() => createBucket("float", { colorId: 1, capacity: 2.5 }), RangeError);
    assert.throws(() => createBucket("infinite", { colorId: 1, capacity: Number.POSITIVE_INFINITY }), RangeError);
  });

  it("rejects invalid color ids and instance ids", () => {
    assert.throws(() => createBucket("", { colorId: 1, capacity: 2 }), TypeError);
    assert.throws(() => createBucket("zero-color", { colorId: 0, capacity: 2 }), RangeError);
    assert.throws(() => createBucket("negative-color", { colorId: -1, capacity: 2 }), RangeError);
    assert.throws(() => createBucket("float-color", { colorId: 1.5, capacity: 2 }), RangeError);
  });

  it("rejects invalid initial amounts", () => {
    assert.throws(() => createBucket("negative-amount", { colorId: 1, capacity: 4 }, { currentAmount: -1 }), RangeError);
    assert.throws(() => createBucket("overflow-amount", { colorId: 1, capacity: 4 }, { currentAmount: 5 }), RangeError);
    assert.throws(() => createBucket("float-amount", { colorId: 1, capacity: 4 }, { currentAmount: 1.5 }), RangeError);
    assert.throws(() => createBucket("nan-amount", { colorId: 1, capacity: 4 }, { currentAmount: Number.NaN }), RangeError);
    assert.throws(
      () => createBucket("infinite-amount", { colorId: 1, capacity: 4 }, { currentAmount: Number.POSITIVE_INFINITY }),
      RangeError,
    );
  });

  it("computes remaining capacity from capacity and amount", () => {
    const bucket = createBucket("remaining", { colorId: 3, capacity: 8 }, { currentAmount: 3 });

    assert.equal(bucket.currentAmount, 3);
    assert.equal(bucket.remainingCapacity, 5);
    assert.equal(bucket.snapshot().amount, 3);
  });

  it("identifies empty, partially filled, and full buckets", () => {
    const empty = createBucket("empty", { colorId: 1, capacity: 4 });
    const half = createBucket("half", { colorId: 1, capacity: 4 }, { currentAmount: 2 });
    const full = createBucket("full", { colorId: 1, capacity: 4 }, { currentAmount: 4 });

    assert.equal(empty.isEmpty(), true);
    assert.equal(empty.isFull(), false);
    assert.equal(half.isEmpty(), false);
    assert.equal(half.isFull(), false);
    assert.equal(full.isEmpty(), false);
    assert.equal(full.isFull(), true);
    assert.equal(full.remainingCapacity, 0);
  });

  it("fills a bucket and returns the accepted amount", () => {
    const bucket = createBucket("fill", { colorId: 4, capacity: 6 });

    const result = bucket.fill(2);

    assert.deepEqual(result, {
      requestedAmount: 2,
      acceptedAmount: 2,
      rejectedAmount: 0,
      bucket: {
        instanceId: "fill",
        colorId: 4,
        capacity: 6,
        amount: 2,
        status: "available",
      },
    });
    assert.equal(bucket.currentAmount, 2);
    assert.equal(bucket.remainingCapacity, 4);
  });

  it("does not overflow when filling past remaining capacity", () => {
    const bucket = createBucket("overflow", { colorId: 5, capacity: 5 }, { currentAmount: 3 });

    const result = bucket.fill(10);

    assert.equal(result.requestedAmount, 10);
    assert.equal(result.acceptedAmount, 2);
    assert.equal(result.rejectedAmount, 8);
    assert.equal(result.bucket.amount, 5);
    assert.equal(bucket.currentAmount, 5);
    assert.equal(bucket.remainingCapacity, 0);
    assert.equal(bucket.isFull(), true);
  });

  it("treats zero fill as an explicit no-op and rejects negative fill", () => {
    const bucket = createBucket("zero-fill", { colorId: 2, capacity: 4 }, { currentAmount: 1 });

    const zero = bucket.fill(0);

    assert.equal(zero.requestedAmount, 0);
    assert.equal(zero.acceptedAmount, 0);
    assert.equal(zero.rejectedAmount, 0);
    assert.equal(bucket.currentAmount, 1);
    assert.equal(bucket.remainingCapacity, 3);
    assert.throws(() => bucket.fill(-1), RangeError);
    assert.throws(() => bucket.fill(Number.NaN), RangeError);
    assert.throws(() => bucket.fill(Number.POSITIVE_INFINITY), RangeError);
  });

  it("does not keep a mutable reference to the source configuration", () => {
    const config = {
      colorId: 2,
      capacity: 4,
    };
    const runtime = {
      currentAmount: 1,
    };
    const bucket = createBucket("config-copy", config, runtime);

    config.colorId = 9;
    config.capacity = 99;
    runtime.currentAmount = 88;

    assert.equal(bucket.colorId, 2);
    assert.equal(bucket.capacity, 4);
    assert.equal(bucket.currentAmount, 1);
    assert.equal(bucket.remainingCapacity, 3);
  });

  it("keeps runtime bucket instances independent", () => {
    const first = createBucket("instance-a", { colorId: 3, capacity: 6 });
    const second = createBucket("instance-b", { colorId: 3, capacity: 6 });

    first.fill(5);

    assert.equal(first.currentAmount, 5);
    assert.equal(first.remainingCapacity, 1);
    assert.equal(second.currentAmount, 0);
    assert.equal(second.remainingCapacity, 6);
  });

  it("supports snapshots and clones without sharing runtime state", () => {
    const bucket = createBucket("snapshot", { colorId: 6, capacity: 9 }, { currentAmount: 4 });
    bucket.moveToConveyor();
    const snapshot = bucket.snapshot();
    const restored = Bucket.fromSnapshot(snapshot);
    const clone = bucket.clone();

    restored.fill(2);
    clone.fill(1);

    assert.deepEqual(snapshot, {
      instanceId: "snapshot",
      colorId: 6,
      capacity: 9,
      amount: 4,
      status: "inConveyor",
    });
    assert.equal(bucket.currentAmount, 4);
    assert.equal(restored.currentAmount, 6);
    assert.equal(clone.currentAmount, 5);
  });

  it("does not expose mutable snapshot or fill result state", () => {
    const bucket = createBucket("immutable", { colorId: 8, capacity: 2 });
    const fillResult = bucket.fill(1);
    const snapshot = bucket.snapshot();

    assert.throws(() => {
      (fillResult as { acceptedAmount: number }).acceptedAmount = 9;
    }, TypeError);
    assert.throws(() => {
      (fillResult.bucket as MutableBucketState).amount = 9;
    }, TypeError);
    assert.throws(() => {
      (snapshot as MutableBucketState).status = "completed";
    }, TypeError);
    assert.equal(bucket.currentAmount, 1);
    assert.equal(bucket.status, "available");
  });

  it("allows only explicit bucket status transitions", () => {
    const bucket = createBucket("status", { colorId: 1, capacity: 3 });

    bucket.moveToConveyor();
    assert.equal(bucket.status, "inConveyor");

    assert.throws(() => bucket.completeAndLeave(), Error);
    bucket.fill(3);
    bucket.completeAndLeave();
    assert.equal(bucket.status, "completed");

    assert.throws(() => bucket.moveToConveyor(), Error);
    assert.throws(() => bucket.fill(1), Error);
  });

  it("rejects malformed snapshots explicitly", () => {
    assert.throws(
      () =>
        Bucket.fromSnapshot({
          instanceId: "bad-amount",
          colorId: 1,
          capacity: 2,
          amount: 3,
          status: "available",
        }),
      RangeError,
    );
    assert.throws(
      () =>
        Bucket.fromSnapshot({
          instanceId: "bad-status",
          colorId: 1,
          capacity: 2,
          amount: 1,
          status: "mystery" as BucketState["status"],
        }),
      Error,
    );
    assert.throws(
      () =>
        Bucket.fromSnapshot({
          instanceId: "completed-not-full",
          colorId: 1,
          capacity: 2,
          amount: 1,
          status: "completed",
        }),
      RangeError,
    );
  });
});
