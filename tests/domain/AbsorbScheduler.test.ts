import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBucket } from "../../assets/scripts/domain/bucket/Bucket.ts";
import { createConveyor } from "../../assets/scripts/domain/bucket/Conveyor.ts";
import { scheduleAbsorption, runAbsorbSettlement, type AbsorbAllocation } from "../../assets/scripts/domain/battle/Settlement.ts";
import { detectExposedSand } from "../../assets/scripts/domain/core/Exposure.ts";
import { SandGrid } from "../../assets/scripts/domain/core/SandGrid.ts";

type MutableAllocation = {
  -readonly [Key in keyof AbsorbAllocation]: AbsorbAllocation[Key];
};

function bucket(instanceId: string, colorId: number, capacity: number, currentAmount = 0) {
  return createBucket(instanceId, { colorId, capacity }, { currentAmount });
}

function sandCell(x: number, y: number, index: number, colorId: number) {
  return Object.freeze({ x, y, index, colorId });
}

describe("AbsorbScheduler", () => {
  it("returns an empty plan for empty exposed sand", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("red", 1, 3));

    const result = scheduleAbsorption({
      exposedSand: [],
      buckets: conveyor.bucketsSnapshot(),
    });

    assert.deepEqual(result.allocations, []);
    assert.deepEqual(result.unassignedSand, []);
    assert.equal(result.totalExposedCount, 0);
    assert.equal(result.assignedCount, 0);
    assert.equal(result.unassignedCount, 0);
  });

  it("returns an empty plan for an empty conveyor", () => {
    const result = scheduleAbsorption({
      exposedSand: [sandCell(0, 0, 0, 1)],
      buckets: [],
    });

    assert.deepEqual(result.allocations, []);
    assert.deepEqual(result.unassignedSand, [sandCell(0, 0, 0, 1)]);
  });

  it("does not allocate when colors do not match", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("blue", 2, 3));

    const result = scheduleAbsorption({
      exposedSand: [sandCell(0, 0, 0, 1), sandCell(1, 0, 1, 1)],
      buckets: conveyor.bucketsSnapshot(),
    });

    assert.deepEqual(result.allocations, []);
    assert.deepEqual(result.unassignedSand, [sandCell(0, 0, 0, 1), sandCell(1, 0, 1, 1)]);
  });

  it("allocates one same-color sand cell to one bucket", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("red", 1, 3));

    const result = scheduleAbsorption({
      exposedSand: [sandCell(2, 1, 7, 1)],
      buckets: conveyor.bucketsSnapshot(),
    });

    assert.deepEqual(result.allocations, [
      {
        bucketInstanceId: "red",
        bucketIndex: 0,
        colorId: 1,
        sand: [sandCell(2, 1, 7, 1)],
        absorbedCount: 1,
        bucketAmountBefore: 0,
        bucketAmountAfter: 1,
        bucketRemainingCapacityBefore: 3,
        bucketRemainingCapacityAfter: 2,
      },
    ]);
    assert.deepEqual(result.unassignedSand, []);
  });

  it("fills one bucket with multiple same-color sand cells until capacity is reached", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("red", 1, 2));

    const result = scheduleAbsorption({
      exposedSand: [sandCell(0, 0, 0, 1), sandCell(1, 0, 1, 1), sandCell(2, 0, 2, 1)],
      buckets: conveyor.bucketsSnapshot(),
    });

    assert.equal(result.allocations.length, 1);
    assert.equal(result.allocations[0].absorbedCount, 2);
    assert.deepEqual(result.allocations[0].sand, [sandCell(0, 0, 0, 1), sandCell(1, 0, 1, 1)]);
    assert.deepEqual(result.unassignedSand, [sandCell(2, 0, 2, 1)]);
  });

  it("skips a full bucket", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("full", 1, 2, 2));

    const result = scheduleAbsorption({
      exposedSand: [sandCell(0, 0, 0, 1)],
      buckets: conveyor.bucketsSnapshot(),
    });

    assert.deepEqual(result.allocations, []);
    assert.deepEqual(result.unassignedSand, [sandCell(0, 0, 0, 1)]);
  });

  it("only lets in-conveyor buckets absorb", () => {
    const available = bucket("available", 1, 2);
    const completed = bucket("completed", 1, 2);
    completed.moveToConveyor();
    completed.fill(2);
    completed.completeAndLeave();

    const result = scheduleAbsorption({
      exposedSand: [sandCell(0, 0, 0, 1), sandCell(1, 0, 1, 1)],
      buckets: [available, completed],
    });

    assert.deepEqual(result.allocations, []);
    assert.deepEqual(result.unassignedSand, [sandCell(0, 0, 0, 1), sandCell(1, 0, 1, 1)]);
  });

  it("uses conveyor order to fill same-color buckets from front to back", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("front", 1, 1));
    conveyor.addBucket(bucket("back", 1, 2));

    const result = scheduleAbsorption({
      exposedSand: [sandCell(0, 0, 0, 1), sandCell(1, 0, 1, 1), sandCell(2, 0, 2, 1)],
      buckets: conveyor.bucketsSnapshot(),
    });

    assert.deepEqual(result.allocations.map((allocation) => allocation.bucketInstanceId), ["front", "back"]);
    assert.equal(result.allocations[0].absorbedCount, 1);
    assert.equal(result.allocations[1].absorbedCount, 2);
  });

  it("continues with the next bucket after the front bucket reaches capacity", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("front", 1, 1));
    conveyor.addBucket(bucket("back", 1, 2));

    const result = scheduleAbsorption({
      exposedSand: [sandCell(0, 0, 0, 1), sandCell(1, 0, 1, 1), sandCell(2, 0, 2, 1)],
      buckets: conveyor.bucketsSnapshot(),
    });

    assert.deepEqual(result.allocations[0].sand, [sandCell(0, 0, 0, 1)]);
    assert.deepEqual(result.allocations[1].sand, [sandCell(1, 0, 1, 1), sandCell(2, 0, 2, 1)]);
  });

  it("keeps different colors separated in a stable exposed-sand order", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("red", 1, 3));
    conveyor.addBucket(bucket("blue", 2, 2));

    const result = scheduleAbsorption({
      exposedSand: [
        sandCell(0, 0, 0, 2),
        sandCell(1, 0, 1, 1),
        sandCell(2, 0, 2, 2),
        sandCell(3, 0, 3, 1),
      ],
      buckets: conveyor.bucketsSnapshot(),
    });

    assert.deepEqual(result.allocations.map((allocation) => [allocation.bucketInstanceId, allocation.sand.map((cell) => cell.index)]), [
      ["red", [1, 3]],
      ["blue", [0, 2]],
    ]);
    assert.deepEqual(result.unassignedSand, []);
  });

  it("never assigns the same sand cell twice", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("first", 1, 2));
    conveyor.addBucket(bucket("second", 1, 2));

    const result = scheduleAbsorption({
      exposedSand: [sandCell(0, 0, 0, 1), sandCell(1, 0, 1, 1), sandCell(2, 0, 2, 1)],
      buckets: conveyor.bucketsSnapshot(),
    });

    const allIndexes = result.allocations.flatMap((allocation) => allocation.sand.map((cell) => cell.index));
    assert.deepEqual(allIndexes, [0, 1, 2]);
  });

  it("returns stable output for repeated identical input", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("red", 1, 2));

    const exposedSand = [sandCell(0, 0, 0, 1), sandCell(1, 0, 1, 1)];
    const first = scheduleAbsorption({ exposedSand, buckets: conveyor.bucketsSnapshot() });
    const second = scheduleAbsorption({ exposedSand, buckets: conveyor.bucketsSnapshot() });

    assert.deepEqual(first, second);
  });

  it("does not mutate input arrays or input objects", () => {
    const conveyor = createConveyor();
    const firstBucket = bucket("red", 1, 2);
    conveyor.addBucket(firstBucket);
    const exposedSand = [sandCell(0, 0, 0, 1)];
    const beforeBucket = firstBucket.snapshot();
    const beforeConveyor = conveyor.snapshot();

    scheduleAbsorption({
      exposedSand,
      buckets: conveyor.bucketsSnapshot(),
    });

    assert.deepEqual(firstBucket.snapshot(), beforeBucket);
    assert.deepEqual(conveyor.snapshot(), beforeConveyor);
    assert.deepEqual(exposedSand, [sandCell(0, 0, 0, 1)]);
  });

  it("exposes immutable result arrays and cells", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("red", 1, 2));

    const result = scheduleAbsorption({
      exposedSand: [sandCell(0, 0, 0, 1)],
      buckets: conveyor.bucketsSnapshot(),
    });

    assert.throws(() => {
      (result.allocations as AbsorbAllocation[]).push(result.allocations[0]);
    }, TypeError);
    assert.throws(() => {
      (result.allocations[0].sand as Array<unknown>).push(sandCell(1, 0, 1, 1));
    }, TypeError);
    assert.throws(() => {
      (result.allocations[0] as MutableAllocation).absorbedCount = 9;
    }, TypeError);
  });

  it("rejects duplicate exposed sand indexes and invalid cells", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("red", 1, 2));

    assert.throws(
      () =>
        scheduleAbsorption({
          exposedSand: [sandCell(0, 0, 0, 1), sandCell(1, 0, 0, 1)],
          buckets: conveyor.bucketsSnapshot(),
        }),
      Error,
    );
    assert.throws(
      () =>
        scheduleAbsorption({
          exposedSand: [Object.freeze({ x: -1, y: 0, index: 0, colorId: 1 }) as never],
          buckets: conveyor.bucketsSnapshot(),
        }),
      RangeError,
    );
  });

  it("validates every bucket before scheduling even when absorption count is zero", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("red", 1, 2));

    assert.throws(
      () =>
        scheduleAbsorption({
          exposedSand: [sandCell(0, 0, 0, 1)],
          buckets: [conveyor.getBucketAt(0), { instanceId: "bad" } as never],
          maxAbsorbCount: 0,
        }),
      TypeError,
    );
  });

  it("supports a global maximum absorption count", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("red", 1, 5));
    conveyor.addBucket(bucket("blue", 2, 5));

    const result = scheduleAbsorption({
      exposedSand: [
        sandCell(0, 0, 0, 1),
        sandCell(1, 0, 1, 1),
        sandCell(2, 0, 2, 2),
        sandCell(3, 0, 3, 2),
      ],
      buckets: conveyor.bucketsSnapshot(),
      maxAbsorbCount: 2,
    });

    assert.equal(result.assignedCount, 2);
    assert.deepEqual(result.unassignedSand, [sandCell(2, 0, 2, 2), sandCell(3, 0, 3, 2)]);
  });

  it("applies the schedule atomically to grid, buckets, and conveyor", () => {
    const grid = SandGrid.fromConfig({
      width: 3,
      height: 2,
      cells: [
        [null, null, null],
        [1, 2, 2],
      ],
    });
    const conveyor = createConveyor();
    const full = bucket("red-full", 1, 2, 1);
    const partial = bucket("blue-partial", 2, 4, 1);
    conveyor.addBucket(full);
    conveyor.addBucket(partial);

    const result = runAbsorbSettlement({
      grid,
      conveyor,
      exposedSand: detectExposedSand(grid).exposedSand,
    });

    assert.deepEqual(result.schedule.allocations.map((allocation) => allocation.bucketInstanceId), ["red-full", "blue-partial"]);
    assert.deepEqual(result.completedBucketInstanceIds, ["red-full"]);
    assert.deepEqual(grid.toRows(), [[null, null, null], [null, null, null]]);
    assert.deepEqual(conveyor.bucketsSnapshot().map((storedBucket) => storedBucket.instanceId), ["blue-partial"]);
    assert.equal(conveyor.getBucketAt(0).currentAmount, 3);
    assert.equal(conveyor.getBucketAt(0).remainingCapacity, 1);
    assert.equal(conveyor.getBucketAt(0).status, "inConveyor");
  });

  it("does not modify inputs when applying an invalid exposed-sand plan fails", () => {
    const grid = SandGrid.fromConfig({
      width: 1,
      height: 1,
      cells: [[2]],
    });
    const conveyor = createConveyor();
    const red = bucket("red", 1, 2);
    conveyor.addBucket(red);
    const beforeGrid = grid.snapshot();
    const beforeConveyor = conveyor.snapshot();
    const beforeBucket = red.snapshot();

    assert.throws(
      () =>
        runAbsorbSettlement({
          grid,
          conveyor,
          exposedSand: [sandCell(0, 0, 0, 1)],
        }),
      Error,
    );
    assert.deepEqual(grid.snapshot(), beforeGrid);
    assert.deepEqual(conveyor.snapshot(), beforeConveyor);
    assert.deepEqual(red.snapshot(), beforeBucket);
  });

  it("handles larger exposed sets and multiple buckets without exceeding capacities", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("red-front", 1, 30));
    conveyor.addBucket(bucket("blue", 2, 25));
    conveyor.addBucket(bucket("red-back", 1, 30));

    const exposedSand = [
      ...Array.from({ length: 45 }, (_, index) => sandCell(index, 0, index, 1)),
      ...Array.from({ length: 20 }, (_, index) => sandCell(index, 1, 45 + index, 2)),
      ...Array.from({ length: 15 }, (_, index) => sandCell(index, 2, 65 + index, 3)),
    ];

    const result = scheduleAbsorption({
      exposedSand,
      buckets: conveyor.bucketsSnapshot(),
    });

    assert.deepEqual(result.allocations.map((allocation) => [allocation.bucketInstanceId, allocation.absorbedCount]), [
      ["red-front", 30],
      ["blue", 20],
      ["red-back", 15],
    ]);
    assert.equal(result.assignedCount, 65);
    assert.equal(result.unassignedCount, 15);
    assert.deepEqual(result.unassignedSand.map((cell) => cell.colorId), Array.from({ length: 15 }).fill(3));
  });

  it("does not modify the schedule result when the caller mutates copied arrays", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("red", 1, 2));

    const result = scheduleAbsorption({
      exposedSand: [sandCell(0, 0, 0, 1)],
      buckets: conveyor.bucketsSnapshot(),
    });

    assert.throws(() => {
      (result.unassignedSand as Array<unknown>).push(sandCell(1, 0, 1, 1));
    }, TypeError);
    assert.equal(result.allocations[0].sand[0].index, 0);
  });
});
