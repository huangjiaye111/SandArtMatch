import type { SeededRandom } from "./Random";
import type { SandGrid } from "./SandGrid";
import type { SandColorId } from "../config/LevelConfig";

export interface GravityStepResult {
  moved: boolean;
  moves: number;
}

export interface GravitySettleOptions {
  maxIterations?: number;
}

export interface GravitySettlementResult {
  stable: boolean;
  iterations: number;
  totalMoves: number;
  hitIterationLimit: boolean;
}

export function applyGravityStep(grid: SandGrid, random: SeededRandom): GravityStepResult {
  let moves = 0;

  for (let y = grid.height - 2; y >= 0; y -= 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const colorId = grid.get(x, y);
      if (colorId === null) {
        continue;
      }

      if (tryMoveSand(grid, random, x, y, colorId)) {
        moves += 1;
      }
    }
  }

  return {
    moved: moves > 0,
    moves,
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

  while (iterations < maxIterations) {
    const step = applyGravityStep(grid, random);
    if (!step.moved) {
      return {
        stable: true,
        iterations,
        totalMoves,
        hitIterationLimit: false,
      };
    }

    iterations += 1;
    totalMoves += step.moves;
  }

  return {
    stable: false,
    iterations,
    totalMoves,
    hitIterationLimit: true,
  };
}

function tryMoveSand(grid: SandGrid, random: SeededRandom, x: number, y: number, colorId: SandColorId): boolean {
  const downY = y + 1;
  if (downY >= grid.height) {
    return false;
  }

  if (!grid.hasSandAt(x, downY)) {
    moveSand(grid, x, y, x, downY, colorId);
    return true;
  }

  const canMoveLeft = x > 0 && !grid.hasSandAt(x - 1, downY);
  const canMoveRight = x < grid.width - 1 && !grid.hasSandAt(x + 1, downY);

  if (canMoveLeft && canMoveRight) {
    const targetX = random.index(2) === 0 ? x - 1 : x + 1;
    moveSand(grid, x, y, targetX, downY, colorId);
    return true;
  }

  if (canMoveLeft) {
    moveSand(grid, x, y, x - 1, downY, colorId);
    return true;
  }

  if (canMoveRight) {
    moveSand(grid, x, y, x + 1, downY, colorId);
    return true;
  }

  return false;
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

function defaultMaxIterations(grid: SandGrid): number {
  return grid.height;
}

function validateMaxIterations(maxIterations: number): void {
  if (!Number.isSafeInteger(maxIterations) || maxIterations <= 0) {
    throw new RangeError("Gravity maxIterations must be a positive safe integer.");
  }
}
