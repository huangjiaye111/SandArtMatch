import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBucketVisualModel } from "../../assets/scripts/cocos/battle/BucketVisualModel.ts";
import {
  createBucketPoolLayoutModel,
  createBucketPoolVisualLayoutModel,
  createBucketPoolScrollModel,
  selectCandidateBuckets,
} from "../../assets/scripts/cocos/battle/BucketPoolLayoutModel.ts";
import { createConveyorLayoutModel } from "../../assets/scripts/cocos/battle/ConveyorLayoutModel.ts";
import { createPresentationQueue } from "../../assets/scripts/cocos/battle/PresentationQueueModel.ts";
import {
  BucketFlightRegistry,
  createBucketFlyMotionConfig,
  sampleBucketFlyMotion,
  sampleBucketFlyReboundScale,
} from "../../assets/scripts/cocos/battle/BucketFlyMotionModel.ts";
import {
  AbsorptionRevisionGate,
  createAbsorptionMotionPlan,
  sortAbsorbedCells,
} from "../../assets/scripts/cocos/battle/AbsorptionMotionModel.ts";
import {
  createGravityTimelinePlan,
  GravityRevisionGate,
  groupGravityMovesByIteration,
  PresentationGridBuffers,
} from "../../assets/scripts/cocos/battle/GravityMotionModel.ts";
import {
  createBucketExitPresentationTasks,
  createBucketMergePresentationTasks,
} from "../../assets/scripts/cocos/battle/BucketPresentationTaskModel.ts";
import { createBucketPoolState } from "../../assets/scripts/domain/bucket/BucketPool.ts";
import {
  createRenderPresentationFrame,
  SimulationFrameQueue,
} from "../../assets/scripts/cocos/battle/SimulationFrameQueue.ts";
import {
  createCarrierMoveMotionPlan,
  createConveyorCarrierLayout,
  getConveyorCarrierSlotPosition,
  sampleConveyorLoopPosition,
  selectVisibleEmptyCarrierIndex,
} from "../../assets/scripts/cocos/battle/ConveyorCarrierMotionModel.ts";
import { BATTLE_PRESENTATION_CONFIG } from "../../assets/scripts/cocos/battle/BattlePresentationConfig.ts";
import { DEFAULT_BATTLE_SIMULATION_CONFIG } from "../../assets/scripts/domain/battle/BattleSimulationConfig.ts";
import { BattlePhase } from "../../assets/scripts/domain/battle/BattleState.ts";
import type { BattlePresentationEvent } from "../../assets/scripts/cocos/battle/BattleViewContract.ts";
import type { BattleSimulationFrame } from "../../assets/scripts/domain/battle/BattleSimulation.ts";

describe("Presentation visual models", () => {
  it("keeps an empty bucket fill hidden while exposing the target color badge", () => {
    const model = createBucketVisualModel({
      instanceId: "empty-green",
      colorId: 4,
      capacity: 80,
      amount: 0,
      status: "available",
    });

    assert.equal(model.colorBadgeVisible, true);
    assert.equal(model.colorBadgeFill, "#58C889");
    assert.equal(model.bodyFill, "#58C889");
    assert.equal(model.fillSurfaceVisible, false);
    assert.equal(model.fillRatio, 0);
    assert.equal(model.remainingText, "80");
  });

  it("reports fill and full badge state from bucket amount without changing rules", () => {
    const partial = createBucketVisualModel({
      instanceId: "partial",
      colorId: 1,
      capacity: 64,
      amount: 32,
      status: "inConveyor",
    });
    const full = createBucketVisualModel({
      instanceId: "full",
      colorId: 1,
      capacity: 64,
      amount: 64,
      status: "completed",
    });

    assert.equal(partial.fillSurfaceVisible, true);
    assert.equal(partial.fillRatio, 0.5);
    assert.equal(partial.remainingText, "32");
    assert.equal(partial.fullBadgeVisible, false);
    assert.equal(full.fullBadgeVisible, true);
    assert.equal(full.remainingText, "0");
  });

  it("does not carry full state when a later empty bucket visual model is created", () => {
    const full = createBucketVisualModel({
      instanceId: "full",
      colorId: 2,
      capacity: 10,
      amount: 10,
      status: "completed",
    });
    const empty = createBucketVisualModel({
      instanceId: "empty",
      colorId: 1,
      capacity: 10,
      amount: 0,
      status: "available",
    });

    assert.equal(full.fullBadgeVisible, true);
    assert.equal(empty.fullBadgeVisible, false);
    assert.equal(empty.fillSurfaceVisible, false);
    assert.equal(empty.remainingText, "10");
    assert.equal(empty.bodyFill, "#F27C8A");
  });

  it("keeps presentation feedback in domain event order with one visual step per event", () => {
    const events: BattlePresentationEvent[] = [
      { type: "sandCanvasRedrawn", grid: { width: 1, height: 1, cells: [null] } },
      {
        type: "sandGravitySettled",
        revision: 1,
        actionId: 1,
        moves: [],
        result: { stable: true, iterations: 1, totalMoves: 1, hitIterationLimit: false, moveTraces: [] },
        grid: { width: 1, height: 1, cells: [null] },
        totalMoves: 1,
        settlementSteps: [],
      },
      { type: "bucketEnteredConveyor", bucketInstanceId: "b", slotIndex: 0 },
      { type: "sandAbsorbed", allocations: [], assignedCount: 0, absorptionEvents: [] },
      { type: "exposedSandHighlighted", cells: [] },
      { type: "fullBucketLeft", bucketInstanceIds: ["b"], slotIndexes: [0] },
      { type: "merge", bucketInstanceIds: ["a", "b", "c"], insertedBucketInstanceId: "m", slotIndex: 0 },
    ];

    assert.deepEqual(
      createPresentationQueue(events).map((step) => step.events[0]?.type),
      events.map((event) => event.type),
    );
    assert.deepEqual(createPresentationQueue(events).map((step) => step.events.length), [1, 1, 1, 1, 1, 1, 1]);
  });

  it("keeps conveyor slot indexes stable from left to right", () => {
    const layout = createConveyorLayoutModel();

    assert.equal(layout.slots.length, 6);
    assert.deepEqual(layout.slots.map((slot) => slot.index), [0, 1, 2, 3, 4, 5]);
    assert.equal(layout.slots.every((slot, index, slots) => index === 0 || slots[index - 1].x < slot.x), true);
  });

  it("uses slot center as the conveyor bucket target position", () => {
    const layout = createConveyorLayoutModel();

    for (const slot of layout.slots) {
      assert.deepEqual({ x: slot.x, y: slot.y }, { x: layout.slots[slot.index].x, y: layout.slots[slot.index].y });
    }
  });

  it("creates a looping carrier layout with stable spacing and visible bounds", () => {
    const conveyorLayout = createConveyorLayoutModel();
    const layout = createConveyorCarrierLayout({ slotPositions: conveyorLayout.slots });

    assert.equal(layout.slotCount, 6);
    assert.equal(layout.loopLength > layout.spacing, true);
    assert.equal(layout.visibleStartX < layout.visibleEndX, true);
    assert.equal(layout.spacing > 0, true);
    assert.deepEqual(getConveyorCarrierSlotPosition(layout, 0), conveyorLayout.slots[0]);
  });

  it("samples carrier loop positions and wraps them through the hidden zones", () => {
    const layout = createConveyorCarrierLayout({ slotPositions: createConveyorLayoutModel().slots });
    const first = sampleConveyorLoopPosition(layout, 0, 0);
    const moved = sampleConveyorLoopPosition(layout, 0, layout.spacing);

    assert.equal(first.x < moved.x, true);
    assert.equal(first.y, moved.y);
  });

  it("selects a visible empty carrier deterministically from the current loop state", () => {
    const layout = createConveyorCarrierLayout({ slotPositions: createConveyorLayoutModel().slots });
    const occupied = new Set<number>([0, 2, 4]);
    const selected = selectVisibleEmptyCarrierIndex({
      layout,
      phase: 0,
      occupiedCarrierIndexes: occupied,
      reservationSeed: 17,
    });

    assert.equal(occupied.has(selected), false);
    assert.equal(selected >= 0 && selected < layout.slotCount, true);
  });

  it("keeps a separate future carrier move plan for domain snapshot slot compression", () => {
    const conveyorLayout = createConveyorLayoutModel();
    const layout = createConveyorCarrierLayout({ slotPositions: conveyorLayout.slots });
    const plan = createCarrierMoveMotionPlan({
      bucketId: "bucket-c",
      fromSlotIndex: 2,
      toSlotIndex: 1,
      layout,
    });

    assert.equal(plan.bucketId, "bucket-c");
    assert.deepEqual(plan.fromPosition, getConveyorCarrierSlotPosition(layout, 2));
    assert.deepEqual(plan.toPosition, getConveyorCarrierSlotPosition(layout, 1));
  });

  it("lays out the dynamic bucket pool in four columns with label-inclusive rows", () => {
    const layout = createBucketPoolLayoutModel(14);

    assert.equal(layout.columns, 4);
    assert.equal(layout.rows, 4);
    assert.equal(layout.visibleRows >= 3, true);
    assert.equal(layout.cellHeight >= 138, true);
    assert.equal(layout.scrollableOverflow > 0, true);
    assert.deepEqual(layout.cells.slice(0, 4).map((cell) => cell.row), [0, 0, 0, 0]);
    assert.deepEqual(layout.cells.slice(0, 4).map((cell) => cell.column), [0, 1, 2, 3]);
    assert.equal(layout.cells[0].x < layout.cells[1].x, true);
  });

  it("renders only available buckets as candidate pool source data", () => {
    const buckets = [
      { instanceId: "available-a", colorId: 1, capacity: 10, amount: 0, status: "available" as const },
      { instanceId: "conveyor-a", colorId: 1, capacity: 10, amount: 4, status: "inConveyor" as const },
      { instanceId: "complete-a", colorId: 1, capacity: 10, amount: 10, status: "completed" as const },
      { instanceId: "available-b", colorId: 2, capacity: 20, amount: 0, status: "available" as const },
    ];

    assert.deepEqual(selectCandidateBuckets(buckets).map((bucket) => bucket.instanceId), ["available-a", "available-b"]);
  });

  it("lays out available bucket pool rows by column and visible depth", () => {
    const pool = createBucketPoolState([
      { instanceId: "c0-front", colorId: 1, capacity: 10, amount: 0, status: "available" as const },
      { instanceId: "c1-front", colorId: 1, capacity: 10, amount: 0, status: "available" as const },
      { instanceId: "c2-front", colorId: 1, capacity: 10, amount: 0, status: "available" as const },
      { instanceId: "c3-front", colorId: 1, capacity: 10, amount: 0, status: "available" as const },
      { instanceId: "c0-second", colorId: 1, capacity: 10, amount: 0, status: "available" as const },
      { instanceId: "c1-second", colorId: 1, capacity: 10, amount: 0, status: "available" as const },
      { instanceId: "c2-second", colorId: 1, capacity: 10, amount: 0, status: "available" as const },
      { instanceId: "c3-second", colorId: 1, capacity: 10, amount: 0, status: "available" as const },
    ]);
    const layout = createBucketPoolVisualLayoutModel(pool.buckets, 438);

    assert.deepEqual(layout.cells.map((cell) => cell.column), [0, 1, 2, 3, 0, 1, 2, 3]);
    assert.deepEqual(layout.cells.map((cell) => cell.visibleDepthIndex), [0, 0, 0, 0, 1, 1, 1, 1]);
    assert.equal(layout.cells[4].y < layout.cells[0].y, true);
  });

  it("keeps completed and conveyor buckets out of the candidate visual count", () => {
    const buckets = Array.from({ length: 14 }, (_, index) => ({
      instanceId: `bucket-${index}`,
      colorId: index % 2 === 0 ? 1 : 2,
      capacity: 10,
      amount: 0,
      status: "available" as const,
    }));
    const visible = selectCandidateBuckets([
      ...buckets.slice(0, 2).map((bucket) => ({ ...bucket, status: "inConveyor" as const, amount: 3 })),
      ...buckets.slice(2, 4).map((bucket) => ({ ...bucket, status: "completed" as const, amount: 10 })),
      ...buckets.slice(4),
    ]);

    assert.equal(visible.length, 10);
    assert.equal(visible.every((bucket) => bucket.amount === 0 && bucket.status === "available"), true);
  });

  it("calculates vertical scroll range from content and viewport heights", () => {
    const layout = createBucketPoolLayoutModel(14, 438);
    const scroll = createBucketPoolScrollModel(layout.contentHeight, layout.viewportHeight);

    assert.equal(scroll.contentHeight, layout.contentHeight);
    assert.equal(scroll.viewportHeight, 438);
    assert.equal(scroll.scrollRange, Math.max(0, layout.contentHeight - layout.viewportHeight));
  });

  it("samples bucket fly-in motion with a curved path and landing scale", () => {
    const source = { x: -180, y: -240 };
    const target = { x: -242, y: 0 };
    const config = createBucketFlyMotionConfig(source, target, 0.64);
    const start = sampleBucketFlyMotion(source, target, 0, config);
    const middle = sampleBucketFlyMotion(source, target, 0.5, config);
    const end = sampleBucketFlyMotion(source, target, 1, config);

    assert.equal(config.durationSeconds, 0.22);
    assert.equal(config.reboundSeconds, 0.1);
    assert.equal(config.arcHeight >= 30 && config.arcHeight <= 60, true);
    assert.deepEqual({ x: start.x, y: start.y }, source);
    assert.equal(middle.y > Math.min(source.y, target.y), true);
    assert.equal(middle.scale > 0.64, true);
    assert.deepEqual({ x: end.x, y: end.y }, target);
    assert.equal(Number(end.scale.toFixed(4)), Number((0.64 * 0.96).toFixed(4)));
    assert.equal(sampleBucketFlyReboundScale(1, config), 0.64);
  });

  it("allows parallel bucket flights but rejects duplicates for the same bucket", () => {
    const registry = new BucketFlightRegistry();

    assert.equal(registry.start("bucket-a"), true);
    assert.equal(registry.start("bucket-a"), false);
    assert.equal(registry.start("bucket-b"), true);
    assert.equal(registry.size, 2);
    registry.finish("bucket-a");
    assert.equal(registry.has("bucket-a"), false);
    assert.equal(registry.has("bucket-b"), true);
    registry.cancelAll();
    assert.equal(registry.size, 0);
  });

  it("sorts absorbed cells deterministically before batching", () => {
    const cells = [
      { x: 2, y: 1, index: 6, colorId: 3 },
      { x: 0, y: 0, index: 0, colorId: 3 },
      { x: 1, y: 1, index: 5, colorId: 3 },
      { x: 1, y: 0, index: 1, colorId: 3 },
    ];

    assert.deepEqual(sortAbsorbedCells(cells, 11).map((cell) => cell.index), [0, 1, 5, 6]);
    assert.deepEqual(sortAbsorbedCells(cells, 11), sortAbsorbedCells(cells, 11));
  });

  it("creates minimum absorption batches for small absorptions and reaches final bucket state", () => {
    const cells = Array.from({ length: 5 }, (_, index) => ({ x: index, y: 0, index, colorId: 2 }));
    const plan = createAbsorptionMotionPlan({
      bucketInstanceId: "bucket-blue",
      slotIndex: 0,
      colorId: 2,
      absorbedCells: cells,
      amountBefore: 10,
      amountAfter: 15,
      capacity: 20,
      seed: 7,
    });

    assert.equal(plan.batches.length, 4);
    assert.equal(plan.batches.reduce((total, batch) => total + batch.logicalCount, 0), cells.length);
    assert.equal(new Set(plan.batches.flatMap((batch) => batch.cells.map((cell) => cell.index))).size, cells.length);
    assert.equal(plan.batches.at(-1)?.presentationAmount, 15);
    assert.equal(plan.batches.at(-1)?.remaining, 5);
    assert.equal(plan.batches.at(-1)?.fillRatio, 0.75);
    assert.equal(plan.durationSeconds >= 0.45, true);
  });

  it("caps large absorption batches and particle samples", () => {
    const cells = Array.from({ length: 1300 }, (_, index) => ({ x: index % 96, y: Math.floor(index / 96), index, colorId: 4 }));
    const plan = createAbsorptionMotionPlan({
      bucketInstanceId: "bucket-green",
      slotIndex: 1,
      colorId: 4,
      absorbedCells: cells,
      amountBefore: 0,
      amountAfter: 1300,
      capacity: 1400,
      seed: 9,
    });

    assert.equal(plan.batches.length, 8);
    assert.equal(plan.batches.reduce((total, batch) => total + batch.logicalCount, 0), cells.length);
    assert.equal(plan.batches.every((batch) => batch.particleCells.length <= 5), true);
    assert.equal(plan.durationSeconds <= 1.2, true);
  });

  it("rejects duplicate cells, color mismatches, and invalid amount transitions", () => {
    assert.throws(() => createAbsorptionMotionPlan({
      bucketInstanceId: "bad-duplicate",
      slotIndex: 0,
      colorId: 1,
      absorbedCells: [
        { x: 0, y: 0, index: 0, colorId: 1 },
        { x: 0, y: 0, index: 0, colorId: 1 },
      ],
      amountBefore: 0,
      amountAfter: 2,
      capacity: 4,
      seed: 1,
    }), /Duplicate absorbed cell index/);
    assert.throws(() => createAbsorptionMotionPlan({
      bucketInstanceId: "bad-color",
      slotIndex: 0,
      colorId: 1,
      absorbedCells: [{ x: 0, y: 0, index: 0, colorId: 2 }],
      amountBefore: 0,
      amountAfter: 1,
      capacity: 4,
      seed: 1,
    }), /color does not match/);
    assert.throws(() => createAbsorptionMotionPlan({
      bucketInstanceId: "bad-amount",
      slotIndex: 0,
      colorId: 1,
      absorbedCells: [{ x: 0, y: 0, index: 0, colorId: 1 }],
      amountBefore: 2,
      amountAfter: 1,
      capacity: 4,
      seed: 1,
    }), /amountAfter/);
  });

  it("uses revision gates to prevent stale absorption tasks from updating newer canvas state", () => {
    const gate = new AbsorptionRevisionGate();
    const first = gate.next();
    const second = gate.next();

    assert.equal(gate.isCurrent(first), false);
    assert.equal(gate.isCurrent(second), true);
  });

  it("groups gravity moves by iteration in deterministic order", () => {
    const moves = [
      { fromX: 2, fromY: 0, toX: 2, toY: 1, colorId: 3, iteration: 0 },
      { fromX: 0, fromY: 1, toX: 0, toY: 2, colorId: 2, iteration: 0 },
      { fromX: 2, fromY: 1, toX: 2, toY: 2, colorId: 3, iteration: 1 },
    ];

    const steps = groupGravityMovesByIteration(moves);

    assert.deepEqual(steps.map((step) => step.iteration), [0, 1]);
    assert.deepEqual(steps[0].moves.map((move) => [move.fromX, move.fromY]), [[2, 0], [0, 1]]);
    assert.deepEqual(groupGravityMovesByIteration(moves), steps);
  });

  it("applies same-iteration gravity with clear-then-write double buffering", () => {
    const buffers = new PresentationGridBuffers();
    buffers.reset({
      width: 2,
      height: 3,
      cells: [1, null, 2, null, null, null],
    });

    buffers.applyGravityIteration([
      { fromX: 0, fromY: 0, toX: 1, toY: 1, colorId: 1, iteration: 0 },
      { fromX: 0, fromY: 1, toX: 0, toY: 2, colorId: 2, iteration: 0 },
    ]);

    assert.deepEqual(buffers.toSnapshot().cells, [null, null, null, 1, 2, null]);
  });

  it("keeps gravity result independent of move order inside one iteration", () => {
    const moves = [
      { fromX: 0, fromY: 0, toX: 1, toY: 1, colorId: 1, iteration: 0 },
      { fromX: 0, fromY: 1, toX: 0, toY: 2, colorId: 2, iteration: 0 },
    ];
    const first = new PresentationGridBuffers();
    const second = new PresentationGridBuffers();
    const snapshot = { width: 2, height: 3, cells: [1, null, 2, null, null, null] };
    first.reset(snapshot);
    second.reset(snapshot);

    first.applyGravityIteration(moves);
    second.applyGravityIteration([...moves].reverse());

    assert.deepEqual(first.toSnapshot(), second.toSnapshot());
  });

  it("plays continuous iterations to the domain final snapshot", () => {
    const buffers = new PresentationGridBuffers();
    buffers.reset({
      width: 1,
      height: 4,
      cells: [4, null, null, null],
    });

    for (const step of groupGravityMovesByIteration([
      { fromX: 0, fromY: 0, toX: 0, toY: 1, colorId: 4, iteration: 0 },
      { fromX: 0, fromY: 1, toX: 0, toY: 2, colorId: 4, iteration: 1 },
      { fromX: 0, fromY: 2, toX: 0, toY: 3, colorId: 4, iteration: 2 },
    ])) {
      buffers.applyGravityIteration(step.moves);
    }

    assert.deepEqual(buffers.toSnapshot().cells, [null, null, null, 4]);
  });

  it("keeps side-slip as explicit domain trace steps", () => {
    const buffers = new PresentationGridBuffers();
    buffers.reset({
      width: 2,
      height: 3,
      cells: [1, null, null, null, null, null],
    });

    buffers.applyGravityIteration([
      { fromX: 0, fromY: 0, toX: 1, toY: 1, colorId: 1, iteration: 0 },
    ]);
    buffers.applyGravityIteration([
      { fromX: 1, fromY: 1, toX: 0, toY: 2, colorId: 1, iteration: 1 },
    ]);

    assert.deepEqual(buffers.toSnapshot().cells, [null, null, null, null, 1, null]);
  });

  it("limits gravity iterations processed before one texture upload", () => {
    const moves = Array.from({ length: 9 }, (_, iteration) => ({
      fromX: 0,
      fromY: iteration,
      toX: 0,
      toY: iteration + 1,
      colorId: 4,
      iteration,
    }));

    const plan = createGravityTimelinePlan({ revision: 10, actionId: 10, moves });

    assert.equal(plan.uploadHz, 30);
    assert.equal(plan.maxIterationsPerFrame, BATTLE_PRESENTATION_CONFIG.gravityIterationsPerTextureFrame);
    assert.equal(plan.estimatedUploadCount, Math.ceil(9 / BATTLE_PRESENTATION_CONFIG.gravityIterationsPerTextureFrame));
  });

  it("uses visible-tick candidate values that keep each texture frame small", () => {
    assert.equal(DEFAULT_BATTLE_SIMULATION_CONFIG.simulationTickRate, 30);
    assert.equal(DEFAULT_BATTLE_SIMULATION_CONFIG.maxAbsorbCellsPerBucketPerTick, 4);
    assert.equal(DEFAULT_BATTLE_SIMULATION_CONFIG.gravityIterationsPerTick, 1);
    assert.equal(DEFAULT_BATTLE_SIMULATION_CONFIG.maxSimulationTicksPerRenderFrame, 2);
    assert.equal(DEFAULT_BATTLE_SIMULATION_CONFIG.maxVisibleTicksMerged, 1);
    assert.equal(BATTLE_PRESENTATION_CONFIG.presentationTextureUploadRate, 30);
    assert.equal(BATTLE_PRESENTATION_CONFIG.presentationDebugTimeScale, 1);
  });

  it("keeps normal presentation consumption to one SimulationFrame per visible frame", () => {
    const queue = new SimulationFrameQueue({ maxQueueSize: 6, maxVisibleTicksMerged: 1 });
    queue.enqueue(fakeSimulationFrame(1, { absorbed: [1], gravityMoves: 1 }));
    queue.enqueue(fakeSimulationFrame(2, { absorbed: [2], gravityMoves: 1 }));

    const first = queue.dequeueVisibleFrame();
    const second = queue.dequeueVisibleFrame();

    assert.equal(first?.simulationFrameCount, 1);
    assert.equal(first?.tickStart, 1);
    assert.equal(first?.tickEnd, 1);
    assert.deepEqual(first?.absorbedCellIndices, [1]);
    assert.equal(second?.tickStart, 2);
    assert.equal(second?.simulationFrameCount, 1);
  });

  it("bounds the visible frame queue without collapsing everything to the final frame", () => {
    const queue = new SimulationFrameQueue({ maxQueueSize: 3, maxVisibleTicksMerged: 1 });
    for (let tick = 1; tick <= 5; tick += 1) {
      queue.enqueue(fakeSimulationFrame(tick, { absorbed: [tick], gravityMoves: 1 }));
    }

    const first = queue.dequeueVisibleFrame();
    const second = queue.dequeueVisibleFrame();

    assert.equal(queue.droppedFrameCount, 2);
    assert.equal(first?.tickEnd, 3);
    assert.equal(second?.tickEnd, 4);
  });

  it("merges only the configured number of adjacent SimulationFrames", () => {
    const queue = new SimulationFrameQueue({ maxQueueSize: 6, maxVisibleTicksMerged: 2 });
    queue.enqueue(fakeSimulationFrame(1, { absorbed: [1], gravityMoves: 1 }));
    queue.enqueue(fakeSimulationFrame(2, { absorbed: [2], gravityMoves: 1 }));
    queue.enqueue(fakeSimulationFrame(3, { absorbed: [3], gravityMoves: 1 }));

    const frame = queue.dequeueVisibleFrame();

    assert.equal(frame?.simulationFrameCount, 2);
    assert.equal(frame?.tickStart, 1);
    assert.equal(frame?.tickEnd, 2);
    assert.deepEqual(frame?.absorbedCellIndices, [1, 2]);
    assert.equal(queue.size, 1);
  });

  it("creates merge presentation tasks only from domain merge results", () => {
    const tasks = createBucketMergePresentationTasks({
      revision: 12,
      tick: 9,
      mergeResults: [{
        merged: true,
        candidate: {
          colorId: 2,
          bucketIndexes: Object.freeze([0, 2, 4]),
          bucketInstanceIds: Object.freeze(["a", "b", "c"]),
        },
        participantBuckets: Object.freeze([
          { instanceId: "a", colorId: 2, capacity: 4, currentAmount: 1, remainingCapacity: 3 },
          { instanceId: "b", colorId: 2, capacity: 5, currentAmount: 2, remainingCapacity: 3 },
          { instanceId: "c", colorId: 2, capacity: 6, currentAmount: 3, remainingCapacity: 3 },
        ]),
        mergedBucket: { instanceId: "merge-1", colorId: 2, capacity: 15, currentAmount: 6, remainingCapacity: 9 },
        insertIndex: 0,
        state: Object.freeze({ maxSlots: 6, slots: Object.freeze(["merge-1", null, null, null, null, null]) }),
      }],
    });

    assert.equal(tasks.length, 1);
    assert.deepEqual(tasks[0].participantBucketIds, ["a", "b", "c"]);
    assert.deepEqual(tasks[0].participantSlotIndexes, [0, 2, 4]);
    assert.equal(tasks[0].resultBucketId, "merge-1");
    assert.equal(tasks[0].resultSlotIndex, 0);
    assert.equal(tasks[0].revision, 12);
    assert.equal(tasks[0].tick, 9);
  });

  it("creates exit presentation tasks only for buckets that the domain actually exited", () => {
    const tasks = createBucketExitPresentationTasks({
      revision: 21,
      tick: 14,
      completedBucketIds: Object.freeze(["full-a", "full-b"]),
      completedSlotIndexes: Object.freeze([1, 3]),
      exitResults: Object.freeze(["full-b"]),
    });

    assert.deepEqual(tasks, [{
      revision: 21,
      tick: 14,
      bucketId: "full-b",
      slotIndex: 3,
    }]);
  });

  it("applies gravity debug time scale only to presentation frame timing", () => {
    assert.equal(BATTLE_PRESENTATION_CONFIG.gravityDebugTimeScale, 1);
    const plan = createGravityTimelinePlan({
      revision: 12,
      actionId: 12,
      moves: [{ fromX: 0, fromY: 0, toX: 0, toY: 1, colorId: 1, iteration: 0 }],
    });

    assert.equal(plan.frameIntervalSeconds, 1 / 30);
  });

  it("rejects duplicate same-iteration gravity endpoints and invalid upward moves", () => {
    assert.throws(() => groupGravityMovesByIteration([
      { fromX: 0, fromY: 0, toX: 0, toY: 1, colorId: 1, iteration: 0 },
      { fromX: 1, fromY: 0, toX: 0, toY: 1, colorId: 1, iteration: 0 },
    ]), /Duplicate gravity target/);
    assert.throws(() => groupGravityMovesByIteration([
      { fromX: 0, fromY: 1, toX: 0, toY: 0, colorId: 1, iteration: 0 },
    ]), /downward/);
  });

  it("rejects gravity source color mismatches in presentation buffers", () => {
    const buffers = new PresentationGridBuffers();
    buffers.reset({ width: 1, height: 2, cells: [2, null] });

    assert.throws(() => buffers.applyGravityIteration([
      { fromX: 0, fromY: 0, toX: 0, toY: 1, colorId: 1, iteration: 0 },
    ]), /source color mismatch/);
  });

  it("clears absorbed cells directly in the current presentation grid", () => {
    const buffers = new PresentationGridBuffers();
    buffers.reset({ width: 2, height: 2, cells: [1, 2, 3, null] });

    buffers.clearCells([{ x: 1, y: 0, index: 1 }]);

    assert.deepEqual(buffers.toSnapshot().cells, [1, null, 3, null]);
  });

  it("clears absorbed cell indices without allocating coordinate objects", () => {
    const buffers = new PresentationGridBuffers();
    buffers.reset({ width: 2, height: 2, cells: [1, 2, 3, 4] });

    buffers.clearCellIndices([0, 3]);

    assert.deepEqual(buffers.toSnapshot().cells, [null, 2, 3, null]);
    assert.equal(buffers.valueAtIndex(1), 2);
  });

  it("reuses fixed presentation grid buffers across resets of the same size", () => {
    const buffers = new PresentationGridBuffers();
    buffers.reset({ width: 2, height: 2, cells: [1, null, null, null] });
    const firstCurrent = buffers.current;
    buffers.reset({ width: 2, height: 2, cells: [2, null, null, null] });

    assert.equal(buffers.current, firstCurrent);
    assert.deepEqual(buffers.toSnapshot().cells, [2, null, null, null]);
  });

  it("keeps old revision gates from updating newer settlement timelines", () => {
    const gate = new GravityRevisionGate();
    const first = gate.next();
    const second = gate.next();

    assert.equal(gate.isCurrent(first), false);
    assert.equal(gate.isCurrent(second), true);
  });

  it("validates timeline plan input", () => {
    assert.throws(() => createGravityTimelinePlan({
      revision: 1,
      actionId: 1,
      moves: [
        { fromX: 0, fromY: 0, toX: 2, toY: 1, colorId: 1, iteration: 0 },
      ],
    }), /one domain gravity step/);
  });
});

function fakeSimulationFrame(
  tick: number,
  options: { readonly absorbed?: readonly number[]; readonly gravityMoves?: number } = {},
): BattleSimulationFrame {
  const gravityMoves = Array.from({ length: options.gravityMoves ?? 0 }, (_, index) => Object.freeze({
    fromX: index,
    fromY: 0,
    toX: index,
    toY: 1,
    colorId: 1,
    iteration: 0,
  }));
  return Object.freeze({
    tick,
    revision: tick,
    absorbedCellIndices: Object.freeze([...(options.absorbed ?? [])]),
    gravityMoves: Object.freeze(gravityMoves),
    gravityIterations: Object.freeze(gravityMoves.length === 0 ? [] : [Object.freeze(gravityMoves)]),
    bucketAmountDeltas: Object.freeze([]),
    enqueuedBucketId: null,
    enqueuedSlotIndex: null,
    completedBucketIds: Object.freeze([]),
    completedSlotIndexes: Object.freeze([]),
    mergeResults: Object.freeze([]),
    exitResults: Object.freeze([]),
    battleState: Object.freeze({
      phase: BattlePhase.WaitingInput,
      grid: Object.freeze({ width: 1, height: 1, cells: Object.freeze([null]) }),
      conveyor: Object.freeze({ maxSlots: 6, slots: Object.freeze([null, null, null, null, null, null]) }),
      buckets: Object.freeze([]),
      random: Object.freeze({ algorithm: "xorshift32", state: 1 }),
      actionIndex: tick,
    }),
    won: false,
    failed: false,
    deadlock: Object.freeze({
      isVictory: false,
      isDeadlocked: false,
      isStable: true,
      reason: "conveyorHasEmptySlot",
      reasons: Object.freeze(["conveyorHasEmptySlot" as const]),
      conveyorFull: false,
      hasAvailableMerge: false,
      hasAbsorbableMove: false,
      hasPendingBucketCompletion: false,
      hasPendingGravity: false,
      hasPendingResolution: false,
      hasPendingAbsorption: false,
      hasPendingMergeResolution: false,
      hasPendingSpecialResolution: false,
      hasSandMoving: false,
      remainingSandCount: 1,
      exposedSandCount: 0,
      mergeCandidate: null,
    }),
  });
}
