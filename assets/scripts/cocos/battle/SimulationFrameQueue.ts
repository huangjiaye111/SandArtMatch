import type { BattleSimulationFrame, BucketAmountDelta } from "../../domain/battle/BattleSimulation";
import type { BattleViewSnapshot } from "../../domain/battle/BattleState";
import type { MergeResult } from "../../domain/bucket/Merge";
import type { GravityMoveTrace } from "../../domain/core/Gravity";

export interface RenderPresentationFrame {
  readonly tickStart: number;
  readonly tickEnd: number;
  readonly revisionStart: number;
  readonly revisionEnd: number;
  readonly simulationFrameCount: number;
  readonly absorbedCellIndices: readonly number[];
  readonly gravityMoves: readonly GravityMoveTrace[];
  readonly gravityIterations: readonly (readonly GravityMoveTrace[])[];
  readonly bucketAmountDeltas: readonly BucketAmountDelta[];
  readonly mergeResults: readonly MergeResult[];
  readonly completedBucketIds: readonly string[];
  readonly completedSlotIndexes: readonly number[];
  readonly exitResults: readonly string[];
  readonly battleState: BattleViewSnapshot;
  readonly won: boolean;
  readonly failed: boolean;
}

export interface SimulationFrameQueueOptions {
  readonly maxQueueSize: number;
  readonly maxVisibleTicksMerged: number;
}

export class SimulationFrameQueue {
  private readonly maxQueueSize: number;
  private readonly maxVisibleTicksMerged: number;
  private readonly frames: BattleSimulationFrame[] = [];
  private droppedFrameCountValue = 0;

  public constructor(options: SimulationFrameQueueOptions) {
    if (!Number.isSafeInteger(options.maxQueueSize) || options.maxQueueSize <= 0) {
      throw new RangeError("Presentation frame queue size must be positive.");
    }
    if (!Number.isSafeInteger(options.maxVisibleTicksMerged) || options.maxVisibleTicksMerged <= 0) {
      throw new RangeError("Visible tick merge limit must be positive.");
    }
    this.maxQueueSize = options.maxQueueSize;
    this.maxVisibleTicksMerged = options.maxVisibleTicksMerged;
  }

  public get size(): number {
    return this.frames.length;
  }

  public get droppedFrameCount(): number {
    return this.droppedFrameCountValue;
  }

  public clear(): void {
    this.frames.length = 0;
    this.droppedFrameCountValue = 0;
  }

  public enqueue(frame: BattleSimulationFrame): void {
    this.frames.push(frame);
    this.trimToBound();
  }

  public dequeueVisibleFrame(): RenderPresentationFrame | null {
    if (this.frames.length === 0) {
      return null;
    }
    const count = Math.min(this.maxVisibleTicksMerged, this.frames.length);
    const frames = this.frames.splice(0, count);
    return createRenderPresentationFrame(frames);
  }

  private trimToBound(): void {
    while (this.frames.length > this.maxQueueSize) {
      const emptyIndex = this.frames.findIndex((frame) =>
        frame.absorbedCellIndices.length === 0 &&
        frame.gravityMoves.length === 0 &&
        frame.bucketAmountDeltas.length === 0
      );
      const removeIndex = emptyIndex >= 0 ? emptyIndex : 0;
      this.frames.splice(removeIndex, 1);
      this.droppedFrameCountValue += 1;
    }
  }
}

export function createRenderPresentationFrame(frames: readonly BattleSimulationFrame[]): RenderPresentationFrame {
  if (frames.length === 0) {
    throw new RangeError("RenderPresentationFrame requires at least one simulation frame.");
  }
  const first = frames[0];
  const last = frames[frames.length - 1];
  return Object.freeze({
    tickStart: first.tick,
    tickEnd: last.tick,
    revisionStart: first.revision,
    revisionEnd: last.revision,
    simulationFrameCount: frames.length,
    absorbedCellIndices: Object.freeze(frames.flatMap((frame) => [...frame.absorbedCellIndices])),
    gravityMoves: Object.freeze(frames.flatMap((frame) => [...frame.gravityMoves])),
    gravityIterations: Object.freeze(frames.flatMap((frame) => [...frame.gravityIterations])),
    bucketAmountDeltas: Object.freeze(frames.flatMap((frame) => [...frame.bucketAmountDeltas])),
    mergeResults: Object.freeze(frames.flatMap((frame) => [...frame.mergeResults])),
    completedBucketIds: Object.freeze(frames.flatMap((frame) => [...frame.completedBucketIds])),
    completedSlotIndexes: Object.freeze(frames.flatMap((frame) => [...frame.completedSlotIndexes])),
    exitResults: Object.freeze(frames.flatMap((frame) => [...frame.exitResults])),
    battleState: last.battleState,
    won: last.won,
    failed: last.failed,
  });
}
