import type { SeededRandom } from "./Random";
import type { SandGrid } from "./SandGrid";
import type { SandColorId } from "../config/LevelConfig";

export interface GravityStepResult {
  moved: boolean;
  moves: number;
  moveTraces: readonly GravityMoveTrace[];
}

export interface GravitySettleOptions {
  maxIterations?: number;
}

export interface GravitySettlementResult {
  stable: boolean;
  iterations: number;
  totalMoves: number;
  hitIterationLimit: boolean;
  moveTraces: readonly GravityMoveTrace[];
}

export interface GravityMoveTrace {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly colorId: SandColorId;
  readonly iteration: number;
}

export function hasPendingGravity(grid: SandGrid): boolean {
  for (let y = grid.height - 2; y >= 0; y -= 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const colorId = grid.get(x, y);
      if (colorId === null) {
        continue;
      }

      if (canSandMove(grid, x, y)) {
        return true;
      }
    }
  }

  return false;
}

export function applyGravityStep(grid: SandGrid, random: SeededRandom): GravityStepResult {
  return applyGravityStepWithIteration(grid, random, 0);
}

function applyGravityStepWithIteration(grid: SandGrid, random: SeededRandom, iteration: number): GravityStepResult {
  let moves = 0;
  const moveTraces: GravityMoveTrace[] = [];

  for (let y = grid.height - 2; y >= 0; y -= 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const colorId = grid.get(x, y);
      if (colorId === null) {
        continue;
      }

      const trace = tryMoveSand(grid, random, x, y, colorId, iteration);
      if (trace !== null) {
        moves += 1;
        moveTraces.push(trace);
      }
    }
  }

  return {
    moved: moves > 0,
    moves,
    moveTraces: Object.freeze(moveTraces),
  };
}

export function settleGravity(
  grid: SandGrid,
  random: SeededRandom,
  options: GravitySettleOptions = {},
): GravitySettlementResult {
  const maxIterations = options.maxIterations ?? defaultMaxIterations(grid);
  validateMaxIterations(maxIterations);

  let iterations = 0;
  let totalMoves = 0;
  const moveTraces: GravityMoveTrace[] = [];

  while (iterations < maxIterations) {
    const step = applyGravityStepWithIteration(grid, random, iterations);
    if (!step.moved) {
      return {
        stable: true,
        iterations,
        totalMoves,
        hitIterationLimit: false,
        moveTraces: Object.freeze(moveTraces),
      };
    }

    iterations += 1;
    totalMoves += step.moves;
    moveTraces.push(...step.moveTraces);
  }

  return {
    stable: false,
    iterations,
    totalMoves,
    hitIterationLimit: true,
    moveTraces: Object.freeze(moveTraces),
  };
}

function tryMoveSand(
  grid: SandGrid,
  random: SeededRandom,
  x: number,
  y: number,
  colorId: SandColorId,
  iteration: number,
): GravityMoveTrace | null {
  const downY = y + 1;
  if (downY >= grid.height) {
    return null;
  }

  if (!grid.hasSandAt(x, downY)) {
    moveSand(grid, x, y, x, downY, colorId);
    return freezeMoveTrace(x, y, x, downY, colorId, iteration);
  }

  const canMoveLeft = x > 0 && !grid.hasSandAt(x - 1, downY);
  const canMoveRight = x < grid.width - 1 && !grid.hasSandAt(x + 1, downY);

  if (canMoveLeft && canMoveRight) {
    const targetX = random.index(2) === 0 ? x - 1 : x + 1;
    moveSand(grid, x, y, targetX, downY, colorId);
    return freezeMoveTrace(x, y, targetX, downY, colorId, iteration);
  }

  if (canMoveLeft) {
    moveSand(grid, x, y, x - 1, downY, colorId);
    return freezeMoveTrace(x, y, x - 1, downY, colorId, iteration);
  }

  if (canMoveRight) {
    moveSand(grid, x, y, x + 1, downY, colorId);
    return freezeMoveTrace(x, y, x + 1, downY, colorId, iteration);
  }

  return null;
}

function canSandMove(grid: SandGrid, x: number, y: number): boolean {
  const downY = y + 1;
  if (downY >= grid.height) {
    return false;
  }

  if (!grid.hasSandAt(x, downY)) {
    return true;
  }

  return (x > 0 && !grid.hasSandAt(x - 1, downY)) || (x < grid.width - 1 && !grid.hasSandAt(x + 1, downY));
}

function moveSand(
  grid: SandGrid,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  colorId: SandColorId,
): void {
  grid.clear(fromX, fromY);
  grid.set(toX, toY, colorId);
}

function freezeMoveTrace(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  colorId: SandColorId,
  iteration: number,
): GravityMoveTrace {
  return Object.freeze({ fromX, fromY, toX, toY, colorId, iteration });
}

function defaultMaxIterations(grid: SandGrid): number {
  return grid.height;
}

function validateMaxIterations(maxIterations: number): void {
  if (!Number.isSafeInteger(maxIterations) || maxIterations <= 0) {
    throw new RangeError("Gravity maxIterations must be a positive safe integer.");
  }
}
