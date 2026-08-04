import type { AbsorbedSandCell } from "../../domain/battle/Settlement";
import { BATTLE_PRESENTATION_CONFIG } from "./BattlePresentationConfig";

export interface AbsorptionMotionInput {
  readonly bucketInstanceId: string;
  readonly slotIndex: number;
  readonly colorId: number;
  readonly absorbedCells: readonly AbsorbedSandCell[];
  readonly amountBefore: number;
  readonly amountAfter: number;
  readonly capacity: number;
  readonly seed: number;
}

export interface AbsorptionMotionBatch {
  readonly index: number;
  readonly startSeconds: number;
  readonly cells: readonly AbsorbedSandCell[];
  readonly logicalCount: number;
  readonly cumulativeCount: number;
  readonly presentationAmount: number;
  readonly remaining: number;
  readonly fillRatio: number;
  readonly particleCells: readonly AbsorbedSandCell[];
}

export interface AbsorptionMotionPlan {
  readonly bucketInstanceId: string;
  readonly slotIndex: number;
  readonly colorId: number;
  readonly amountBefore: number;
  readonly amountAfter: number;
  readonly capacity: number;
  readonly batchIntervalSeconds: number;
  readonly durationSeconds: number;
  readonly batches: readonly AbsorptionMotionBatch[];
}

const MIN_BATCHES = 4;
const TARGET_CELLS_PER_BATCH = 48;
const MAX_PARTICLES_PER_BATCH = 5;

export function createAbsorptionMotionPlan(input: AbsorptionMotionInput): AbsorptionMotionPlan {
  validateInput(input);
  const sortedCells = sortAbsorbedCells(input.absorbedCells, input.seed);
  const batchCount = sortedCells.length === 0
    ? 0
    : Math.min(BATTLE_PRESENTATION_CONFIG.absorptionMaxBatchCount, Math.max(MIN_BATCHES, Math.ceil(sortedCells.length / TARGET_CELLS_PER_BATCH)));
  const batchSize = batchCount === 0 ? 0 : Math.ceil(sortedCells.length / batchCount);
  const batches: AbsorptionMotionBatch[] = [];
  let cumulativeCount = 0;

  for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
    const start = batchIndex * batchSize;
    const cells = sortedCells.slice(start, Math.min(sortedCells.length, start + batchSize));
    cumulativeCount += cells.length;
    const progress = sortedCells.length === 0 ? 1 : cumulativeCount / sortedCells.length;
    const presentationAmount = Math.round(input.amountBefore + (input.amountAfter - input.amountBefore) * progress);
    batches.push(Object.freeze({
      index: batchIndex,
      startSeconds: batchIndex * BATTLE_PRESENTATION_CONFIG.absorptionBatchIntervalSeconds,
      cells: Object.freeze(cells),
      logicalCount: cells.length,
      cumulativeCount,
      presentationAmount,
      remaining: Math.max(0, input.capacity - presentationAmount),
      fillRatio: clamp01(presentationAmount / input.capacity),
      particleCells: Object.freeze(sampleParticleCells(cells, input.seed + batchIndex)),
    }));
  }

  return Object.freeze({
    bucketInstanceId: input.bucketInstanceId,
    slotIndex: input.slotIndex,
    colorId: input.colorId,
    amountBefore: input.amountBefore,
    amountAfter: input.amountAfter,
    capacity: input.capacity,
    batchIntervalSeconds: BATTLE_PRESENTATION_CONFIG.absorptionBatchIntervalSeconds,
    durationSeconds: clamp(
      batchCount * BATTLE_PRESENTATION_CONFIG.absorptionBatchIntervalSeconds + 0.32,
      BATTLE_PRESENTATION_CONFIG.absorptionMinDurationSeconds,
      BATTLE_PRESENTATION_CONFIG.absorptionMaxDurationSeconds,
    ),
    batches: Object.freeze(batches),
  });
}

export function sortAbsorbedCells(
  cells: readonly AbsorbedSandCell[],
  seed = 0,
): readonly AbsorbedSandCell[] {
  return Object.freeze(
    [...cells].sort((left, right) => {
      const row = left.y - right.y;
      if (row !== 0) {
        return row;
      }
      const column = left.x - right.x;
      if (column !== 0) {
        return column;
      }
      return hashCell(left, seed) - hashCell(right, seed);
    }).map((cell) => Object.freeze({ ...cell })),
  );
}

export class AbsorptionRevisionGate {
  private revision = 0;

  public next(): number {
    this.revision += 1;
    return this.revision;
  }

  public isCurrent(revision: number): boolean {
    return revision === this.revision;
  }
}

function sampleParticleCells(cells: readonly AbsorbedSandCell[], seed: number): readonly AbsorbedSandCell[] {
  if (cells.length <= MAX_PARTICLES_PER_BATCH) {
    return cells.map((cell) => Object.freeze({ ...cell }));
  }
  const stride = cells.length / MAX_PARTICLES_PER_BATCH;
  const samples: AbsorbedSandCell[] = [];
  for (let index = 0; index < MAX_PARTICLES_PER_BATCH; index += 1) {
    const sampleIndex = Math.min(cells.length - 1, Math.floor(index * stride + positiveMod(seed, 7) / 7));
    samples.push(Object.freeze({ ...cells[sampleIndex] }));
  }
  return Object.freeze(samples);
}

function validateInput(input: AbsorptionMotionInput): void {
  if (input.amountAfter < input.amountBefore) {
    throw new RangeError("Absorption amountAfter must not be less than amountBefore.");
  }
  if (input.capacity <= 0 || input.amountAfter > input.capacity) {
    throw new RangeError("Absorption capacity must contain amountAfter.");
  }
  const seen = new Set<number>();
  for (const cell of input.absorbedCells) {
    if (seen.has(cell.index)) {
      throw new Error(`Duplicate absorbed cell index: ${cell.index}`);
    }
    seen.add(cell.index);
    if (cell.colorId !== input.colorId) {
      throw new Error(`Absorbed cell color does not match event colorId: ${cell.index}`);
    }
  }
}

function hashCell(cell: Pick<AbsorbedSandCell, "x" | "y" | "index">, seed: number): number {
  let hash = (cell.x + 1) * 374761393 + (cell.y + 1) * 668265263 + (cell.index + 1) * 1442695041 + seed * 2246822519;
  hash = (hash ^ (hash >>> 13)) * 1274126177;
  return hash ^ (hash >>> 16);
}

function positiveMod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
