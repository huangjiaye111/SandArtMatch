import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBattleStateMachine } from "../../assets/scripts/domain/battle/BattleStateMachine.ts";
import { BattlePhase } from "../../assets/scripts/domain/battle/BattleState.ts";
import { detectDeadlock, type DeadlockDetectionResult } from "../../assets/scripts/domain/battle/Outcome.ts";
import { createBucket, type Bucket, type BucketState } from "../../assets/scripts/domain/bucket/Bucket.ts";
import { createConveyor, type ConveyorSystem } from "../../assets/scripts/domain/bucket/Conveyor.ts";
import { MergeSystem } from "../../assets/scripts/domain/bucket/Merge.ts";
import { createSeededRandom } from "../../assets/scripts/domain/core/Random.ts";
import { SandGrid } from "../../assets/scripts/domain/core/SandGrid.ts";

type MutableDeadlockDetectionResult = {
  -readonly [Key in keyof DeadlockDetectionResult]: DeadlockDetectionResult[Key];
};

function bucket(instanceId: string, colorId: number, capacity = 5, currentAmount = 0): Bucket {
  return createBucket(instanceId, { colorId, capacity }, { currentAmount });
}

function conveyorWith(buckets: readonly Bucket[], maxSlots = buckets.length): ConveyorSystem {
  const conveyor = createConveyor(maxSlots);
  for (const storedBucket of buckets) {
    conveyor.addBucket(storedBucket);
  }
  return conveyor;
}

function grid(cells: readonly (readonly (number | null)[])[]): SandGrid {
  return SandGrid.fromConfig({
    width: cells[0].length,
    height: cells.length,
    cells,
  });
}

function deadlockGrid(): SandGrid {
  return grid([[9]]);
}

function fullDeadlockConveyor(): ConveyorSystem {
  return conveyorWith([bucket("red", 1), bucket("blue", 2)], 2);
}

function detect(input: Partial<Parameters<typeof detectDeadlock>[0]> = {}): DeadlockDetectionResult {
  return detectDeadlock({
    grid: input.grid ?? deadlockGrid(),
    conveyor: input.conveyor ?? fullDeadlockConveyor(),
    phase: input.phase ?? BattlePhase.ResultCheck,
    isStable: input.isStable,
    mergeSystem: input.mergeSystem,
    maxAbsorbCount: input.maxAbsorbCount,
    hasPendingAbsorption: input.hasPendingAbsorption,
    hasPendingMergeResolution: input.hasPendingMergeResolution,
    hasPendingSpecialResolution: input.hasPendingSpecialResolution,
    hasSandMoving: input.hasSandMoving,
    hasPendingGravity: input.hasPendingGravity,
    hasPendingBucketCompletion: input.hasPendingBucketCompletion,
  });
}

class ThrowingMergeSystem extends MergeSystem {
  public override findMergeCandidate(): never {
    throw new Error("merge query should not run");
  }
}

function assertNotDeadlocked(result: DeadlockDetectionResult, reason: DeadlockDetectionResult["reason"]): void {
  assert.equal(result.isDeadlocked, false);
  assert.equal(result.reason, reason);
  assert.deepEqual(result.reasons, [reason]);
}

describe("DeadlockDetector", () => {
  it("returns victory before deadlock when the sand grid is empty", () => {
    const result = detect({
      grid: SandGrid.empty(2, 2),
      conveyor: fullDeadlockConveyor(),
      isStable: false,
    });

    assert.equal(result.isVictory, true);
    assert.equal(result.isDeadlocked, false);
    assert.equal(result.reason, "victory");
    assert.equal(result.remainingSandCount, 0);
    assert.equal(result.conveyorFull, true);
  });

  it("does not deadlock while the conveyor still has an empty slot", () => {
    const result = detect({
      conveyor: conveyorWith([bucket("red", 1)], 2),
    });

    assertNotDeadlocked(result, "conveyorHasEmptySlot");
    assert.equal(result.isVictory, false);
    assert.equal(result.isStable, true);
    assert.equal(result.conveyorFull, false);
    assert.equal(result.hasAvailableMerge, false);
    assert.equal(result.hasAbsorbableMove, false);
    assert.equal(result.hasPendingResolution, false);
  });

  it("does not treat a full conveyor as deadlock when a bucket can absorb exposed sand", () => {
    const result = detect({
      grid: grid([[1]]),
      conveyor: conveyorWith([bucket("red", 1), bucket("blue", 2)], 2),
    });

    assertNotDeadlocked(result, "absorbableMove");
    assert.equal(result.conveyorFull, true);
    assert.equal(result.hasAbsorbableMove, true);
    assert.equal(result.exposedSandCount, 1);
  });

  it("does not deadlock when three same-color buckets can merge", () => {
    const result = detect({
      conveyor: conveyorWith([bucket("a", 1), bucket("b", 2), bucket("c", 1), bucket("d", 1)], 4),
    });

    assertNotDeadlocked(result, "availableMerge");
    assert.equal(result.hasAvailableMerge, true);
    assert.deepEqual(result.mergeCandidate?.bucketInstanceIds, ["a", "c", "d"]);
  });

  it("does not deadlock when a full bucket is waiting to leave", () => {
    const result = detect({
      conveyor: conveyorWith([bucket("full", 1, 2, 2), bucket("blue", 2)], 2),
    });

    assertNotDeadlocked(result, "pendingBucketCompletion");
    assert.equal(result.hasPendingBucketCompletion, true);
    assert.equal(result.hasPendingResolution, true);
  });

  it("does not deadlock while sand movement is reported as pending", () => {
    const result = detect({ hasSandMoving: true });

    assertNotDeadlocked(result, "sandMoving");
    assert.equal(result.hasSandMoving, true);
    assert.equal(result.hasPendingResolution, true);
  });

  it("does not deadlock when gravity can still settle sand", () => {
    const result = detect({
      grid: grid([[1], [null]]),
      conveyor: conveyorWith([bucket("blue", 2)], 1),
    });

    assertNotDeadlocked(result, "pendingGravity");
    assert.equal(result.hasPendingGravity, true);
    assert.equal(result.hasPendingResolution, true);
  });

  it("does not deadlock when an absorption plan is waiting to apply", () => {
    const result = detect({ hasPendingAbsorption: true });

    assertNotDeadlocked(result, "pendingAbsorption");
    assert.equal(result.hasPendingAbsorption, true);
    assert.equal(result.hasPendingResolution, true);
  });

  it("does not deadlock when merge settlement is pending", () => {
    const result = detect({ hasPendingMergeResolution: true });

    assertNotDeadlocked(result, "pendingMergeResolution");
    assert.equal(result.hasPendingMergeResolution, true);
    assert.equal(result.hasPendingResolution, true);
  });

  it("does not deadlock while a special mechanism is resolving", () => {
    const result = detect({ hasPendingSpecialResolution: true });

    assertNotDeadlocked(result, "pendingSpecialResolution");
    assert.equal(result.hasPendingSpecialResolution, true);
    assert.equal(result.hasPendingResolution, true);
  });

  it("does not deadlock outside a stable detection phase", () => {
    const result = detect({ phase: BattlePhase.AbsorbResolve });

    assertNotDeadlocked(result, "notStable");
    assert.equal(result.isStable, false);
  });

  it("does not run merge or absorption queries before the stable-state gate passes", () => {
    const result = detect({
      phase: BattlePhase.AbsorbResolve,
      mergeSystem: new ThrowingMergeSystem(),
    });

    assertNotDeadlocked(result, "notStable");
    assert.equal(result.hasAvailableMerge, false);
    assert.equal(result.hasAbsorbableMove, false);
    assert.equal(result.exposedSandCount, 0);
  });

  it("does not run merge or absorption queries before the full-conveyor gate passes", () => {
    const result = detect({
      conveyor: conveyorWith([bucket("red", 1)], 2),
      mergeSystem: new ThrowingMergeSystem(),
    });

    assertNotDeadlocked(result, "conveyorHasEmptySlot");
    assert.equal(result.hasAvailableMerge, false);
    assert.equal(result.hasAbsorbableMove, false);
    assert.equal(result.exposedSandCount, 0);
  });

  it("does not run merge or absorption queries while pending resolution blocks deadlock checks", () => {
    const result = detect({
      hasPendingAbsorption: true,
      mergeSystem: new ThrowingMergeSystem(),
    });

    assertNotDeadlocked(result, "pendingAbsorption");
    assert.equal(result.hasPendingResolution, true);
    assert.equal(result.hasAvailableMerge, false);
    assert.equal(result.hasAbsorbableMove, false);
  });

  it("deadlocks only after stable full conveyor with no merge, absorption, completion, gravity, or special work", () => {
    const result = detect();

    assert.equal(result.isDeadlocked, true);
    assert.equal(result.isVictory, false);
    assert.equal(result.isStable, true);
    assert.equal(result.reason, "deadlocked");
    assert.equal(result.conveyorFull, true);
    assert.equal(result.hasAvailableMerge, false);
    assert.equal(result.hasAbsorbableMove, false);
    assert.equal(result.hasPendingBucketCompletion, false);
    assert.equal(result.hasPendingGravity, false);
    assert.equal(result.hasPendingResolution, false);
  });

  it("deadlocks when exposed sand colors do not match any conveyor bucket", () => {
    const result = detect({
      grid: grid([[3, 4]]),
      conveyor: conveyorWith([bucket("red", 1), bucket("blue", 2)], 2),
    });

    assert.equal(result.isDeadlocked, true);
    assert.equal(result.hasAbsorbableMove, false);
    assert.equal(result.exposedSandCount, 2);
  });

  it("does not count a matching full bucket as absorbable", () => {
    const result = detect({
      grid: grid([[1]]),
      conveyor: conveyorWith([bucket("red-full", 1, 1, 1)], 1),
      hasPendingBucketCompletion: false,
    });

    assertNotDeadlocked(result, "pendingBucketCompletion");
    assert.equal(result.hasAbsorbableMove, false);
    assert.equal(result.hasPendingBucketCompletion, true);
  });

  it("does not count a matching non-working bucket as absorbable", () => {
    const red = bucket("red", 1, 5);
    const conveyor = conveyorWith([red], 1);
    (red as unknown as { statusValue: string }).statusValue = "available";

    const result = detect({
      grid: grid([[1]]),
      conveyor,
    });

    assert.equal(result.isDeadlocked, true);
    assert.equal(result.reason, "deadlocked");
    assert.equal(result.hasAbsorbableMove, false);
  });

  it("finds at least one valid absorb action across multiple colors and buckets", () => {
    const result = detect({
      grid: grid([[3, 4, 5]]),
      conveyor: conveyorWith([bucket("red", 1), bucket("green", 3), bucket("blue", 2)], 3),
    });

    assertNotDeadlocked(result, "absorbableMove");
    assert.equal(result.hasAbsorbableMove, true);
    assert.equal(result.hasAvailableMerge, false);
  });

  it("returns identical results for repeated detection on the same input", () => {
    const sand = deadlockGrid();
    const conveyor = fullDeadlockConveyor();

    const first = detect({ grid: sand, conveyor });
    const second = detect({ grid: sand, conveyor });

    assert.deepEqual(first, second);
  });

  it("does not mutate SandGrid, conveyor order, bucket amounts, or bucket status", () => {
    const sand = grid([[3, null], [1, 2]]);
    const red = bucket("red", 1, 4, 1);
    const blue = bucket("blue", 2, 4, 2);
    const conveyor = conveyorWith([red, blue], 2);
    const beforeGrid = sand.snapshot();
    const beforeConveyor = conveyor.snapshot();
    const beforeBuckets = conveyor.bucketsSnapshot().map((storedBucket) => storedBucket.snapshot());

    detect({ grid: sand, conveyor });

    assert.deepEqual(sand.snapshot(), beforeGrid);
    assert.deepEqual(conveyor.snapshot(), beforeConveyor);
    assert.deepEqual(conveyor.bucketsSnapshot().map((storedBucket) => storedBucket.snapshot()), beforeBuckets);
    assert.deepEqual(conveyor.bucketsSnapshot().map((storedBucket) => storedBucket.instanceId), ["red", "blue"]);
  });

  it("freezes returned results so caller mutation cannot affect later detection", () => {
    const sand = deadlockGrid();
    const conveyor = fullDeadlockConveyor();
    const first = detect({ grid: sand, conveyor });

    assert.throws(() => {
      (first as MutableDeadlockDetectionResult).reason = "victory";
    }, TypeError);
    assert.throws(() => {
      (first.reasons as string[]).push("victory");
    }, TypeError);

    const second = detect({ grid: sand, conveyor });
    assert.equal(second.reason, "deadlocked");
    assert.deepEqual(second.reasons, ["deadlocked"]);
  });
});

describe("DeadlockDetector integration with BattleStateMachine", () => {
  it("lets BattleStateMachine enter Failed only after stable outcome detection", () => {
    const machine = createBattleStateMachine({
      grid: grid([[2]]),
      buckets: [bucket("red", 1)],
      conveyor: createConveyor(1),
      random: createSeededRandom("deadlock-integration"),
    });

    const result = machine.selectBucket("red");
    const outcome = result.events.find((event) => event.type === "resultChecked");

    assert.equal(result.accepted, true);
    assert.equal(result.afterPhase, BattlePhase.Failed);
    assert.equal(machine.currentPhase, BattlePhase.Failed);
    assert.equal(outcome?.type, "resultChecked");
    assert.equal(outcome?.won, false);
    assert.equal(outcome?.failed, true);
    assert.equal(outcome?.failureReason, "deadlocked");
    assert.equal(outcome?.deadlock.isDeadlocked, true);
    assert.deepEqual(result.phaseSequence, [
      BattlePhase.WaitingInput,
      BattlePhase.BucketEnqueue,
      BattlePhase.MergeResolve,
      BattlePhase.ExposedSandResolve,
      BattlePhase.AbsorbResolve,
      BattlePhase.SandGravity,
      BattlePhase.BucketCompleteResolve,
      BattlePhase.ResultCheck,
      BattlePhase.Failed,
    ]);
  });

  it("keeps victory higher priority than deadlock in BattleStateMachine outcome", () => {
    const machine = createBattleStateMachine({
      grid: grid([[1]]),
      buckets: [bucket("red", 1, 1)],
      conveyor: createConveyor(1),
      random: createSeededRandom("victory-integration"),
    });

    const result = machine.selectBucket("red");
    const outcome = result.events.find((event) => event.type === "resultChecked");

    assert.equal(result.afterPhase, BattlePhase.Won);
    assert.equal(outcome?.type, "resultChecked");
    assert.equal(outcome?.won, true);
    assert.equal(outcome?.failed, false);
    assert.equal(outcome?.deadlock.reason, "victory");
  });

  it("does not mutate caller-owned inputs passed into the state machine during deadlock checks", () => {
    const sand = grid([[2]]);
    const red = bucket("red", 1);
    const conveyor = createConveyor(1);
    const beforeGrid = sand.snapshot();
    const beforeBucket: BucketState = red.snapshot();
    const beforeConveyor = conveyor.snapshot();

    createBattleStateMachine({
      grid: sand,
      buckets: [red],
      conveyor,
      random: createSeededRandom("external-readonly"),
    }).selectBucket("red");

    assert.deepEqual(sand.snapshot(), beforeGrid);
    assert.deepEqual(red.snapshot(), beforeBucket);
    assert.deepEqual(conveyor.snapshot(), beforeConveyor);
  });
});
