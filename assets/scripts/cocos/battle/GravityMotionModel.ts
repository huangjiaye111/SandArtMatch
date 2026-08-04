import type { GravityMoveTrace } from "../../domain/core/Gravity";
import type { SandGridSnapshot } from "../../domain/core/SandGrid";
import { BATTLE_PRESENTATION_CONFIG } from "./BattlePresentationConfig";

export interface GravityIterationStep {
  readonly iteration: number;
  readonly moves: readonly GravityMoveTrace[];
}

export interface GravityTimelinePlan {
  readonly revision: number;
  readonly actionId: number;
  readonly moveTraceCount: number;
  readonly iterationCount: number;
  readonly uploadHz: number;
  readonly maxIterationsPerFrame: number;
  readonly frameIntervalSeconds: number;
  readonly estimatedUploadCount: number;
}

export class PresentationGridBuffers {
  private widthValue = 0;
  private heightValue = 0;
  private gridA = new Int16Array(0);
  private gridB = new Int16Array(0);
  private usingA = true;

  public get width(): number {
    return this.widthValue;
  }

  public get height(): number {
    return this.heightValue;
  }

  public get current(): Int16Array {
    return this.usingA ? this.gridA : this.gridB;
  }

  public reset(snapshot: SandGridSnapshot): void {
    validateGridSnapshot(snapshot);
    const size = snapshot.width * snapshot.height;
    if (this.gridA.length !== size) {
      this.gridA = new Int16Array(size);
      this.gridB = new Int16Array(size);
    }
    this.widthValue = snapshot.width;
    this.heightValue = snapshot.height;
    this.usingA = true;
    for (let index = 0; index < size; index += 1) {
      this.gridA[index] = snapshot.cells[index] ?? 0;
      this.gridB[index] = this.gridA[index];
    }
  }

  public clearCells(cells: readonly { readonly x: number; readonly y: number; readonly index: number }[]): void {
    const current = this.current;
    for (const cell of cells) {
      const index = this.indexForCell(cell.x, cell.y, cell.index);
      current[index] = 0;
    }
  }

  public clearCellIndices(indices: readonly number[]): void {
    const current = this.current;
    for (const index of indices) {
      this.validateIndex(index);
      current[index] = 0;
    }
  }

  public applyGravityIteration(moves: readonly GravityMoveTrace[]): void {
    if (moves.length === 0) {
      return;
    }
    const read = this.current;
    const write = this.usingA ? this.gridB : this.gridA;
    write.set(read);

    for (const move of moves) {
      validateMove(move, this.widthValue, this.heightValue);
      const fromIndex = move.fromY * this.widthValue + move.fromX;
      const sourceColor = read[fromIndex];
      if (sourceColor !== move.colorId) {
        throw new Error(`Gravity trace source color mismatch at (${move.fromX}, ${move.fromY}).`);
      }
    }

    for (const move of moves) {
      write[move.fromY * this.widthValue + move.fromX] = 0;
    }
    for (const move of moves) {
      write[move.toY * this.widthValue + move.toX] = move.colorId;
    }
    this.usingA = !this.usingA;
  }

  public toSnapshot(): SandGridSnapshot {
    const current = this.current;
    const cells = Array.from(current, (value) => (value === 0 ? null : value));
    return Object.freeze({
      width: this.widthValue,
      height: this.heightValue,
      cells: Object.freeze(cells),
    });
  }

  public valueAtIndex(index: number): number {
    this.validateIndex(index);
    return this.current[index];
  }

  private indexForCell(x: number, y: number, fallbackIndex: number): number {
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
      throw new TypeError("Presentation grid cell coordinates must be safe integers.");
    }
    if (x < 0 || x >= this.widthValue || y < 0 || y >= this.heightValue) {
      throw new RangeError("Presentation grid cell is outside the grid.");
    }
    const index = y * this.widthValue + x;
    if (fallbackIndex !== index) {
      throw new Error(`Presentation grid cell index mismatch: ${fallbackIndex}.`);
    }
    return index;
  }

  private validateIndex(index: number): void {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.widthValue * this.heightValue) {
      throw new RangeError("Presentation grid index is outside the grid.");
    }
  }
}

export function createGravityTimelinePlan(input: {
  readonly revision: number;
  readonly actionId: number;
  readonly moves: readonly GravityMoveTrace[];
}): GravityTimelinePlan {
  if (!Number.isSafeInteger(input.revision) || !Number.isSafeInteger(input.actionId)) {
    throw new TypeError("Gravity timeline revision and actionId must be safe integers.");
  }
  const steps = groupGravityMovesByIteration(input.moves);
  const maxIterationsPerFrame = BATTLE_PRESENTATION_CONFIG.gravityIterationsPerTextureFrame;
  const uploadHz = BATTLE_PRESENTATION_CONFIG.gravityTextureUpdateRate;
  return Object.freeze({
    revision: input.revision,
    actionId: input.actionId,
    moveTraceCount: input.moves.length,
    iterationCount: steps.length,
    uploadHz,
    maxIterationsPerFrame,
    frameIntervalSeconds: (1 / uploadHz) * BATTLE_PRESENTATION_CONFIG.gravityDebugTimeScale,
    estimatedUploadCount: Math.ceil(steps.length / maxIterationsPerFrame),
  });
}

export function groupGravityMovesByIteration(moves: readonly GravityMoveTrace[]): readonly GravityIterationStep[] {
  const byIteration = new Map<number, GravityMoveTrace[]>();
  for (const move of moves) {
    validateMoveShape(move);
    const group = byIteration.get(move.iteration) ?? [];
    group.push(move);
    byIteration.set(move.iteration, group);
  }

  return Object.freeze([...byIteration.entries()]
    .sort(([left], [right]) => left - right)
    .map(([iteration, iterationMoves]) => Object.freeze({
      iteration,
      moves: Object.freeze(sortAndValidateIterationMoves(iterationMoves)),
    })));
}

export class GravityRevisionGate {
  private revision = 0;

  public next(): number {
    this.revision += 1;
    return this.revision;
  }

  public isCurrent(revision: number): boolean {
    return revision === this.revision;
  }
}

function sortAndValidateIterationMoves(moves: readonly GravityMoveTrace[]): GravityMoveTrace[] {
  const fromCells = new Set<string>();
  const toCells = new Set<string>();
  const sorted = [...moves].sort((left, right) =>
    left.fromY - right.fromY ||
    left.fromX - right.fromX ||
    left.toY - right.toY ||
    left.toX - right.toX ||
    left.colorId - right.colorId
  );
  for (const move of sorted) {
    const fromKey = `${move.fromX}:${move.fromY}`;
    const toKey = `${move.toX}:${move.toY}`;
    if (fromCells.has(fromKey)) {
      throw new Error(`Duplicate gravity source in iteration: ${move.iteration}:${fromKey}`);
    }
    if (toCells.has(toKey)) {
      throw new Error(`Duplicate gravity target in iteration: ${move.iteration}:${toKey}`);
    }
    fromCells.add(fromKey);
    toCells.add(toKey);
  }
  return sorted.map((move) => Object.freeze({ ...move }));
}

function validateMove(move: GravityMoveTrace, width: number, height: number): void {
  validateMoveShape(move);
  if (
    move.fromX < 0 ||
    move.fromX >= width ||
    move.toX < 0 ||
    move.toX >= width ||
    move.fromY < 0 ||
    move.fromY >= height ||
    move.toY < 0 ||
    move.toY >= height
  ) {
    throw new RangeError("Gravity move is outside the presentation grid.");
  }
}

function validateMoveShape(move: GravityMoveTrace): void {
  for (const value of [move.fromX, move.fromY, move.toX, move.toY, move.colorId, move.iteration]) {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError("Gravity move values must be safe integers.");
    }
  }
  if (move.colorId <= 0) {
    throw new RangeError("Gravity move colorId must be positive.");
  }
  if (move.toY <= move.fromY) {
    throw new Error("Gravity move must travel downward in domain row coordinates.");
  }
  if (Math.abs(move.toX - move.fromX) > 1 || move.toY - move.fromY !== 1) {
    throw new Error("Gravity move trace must represent one domain gravity step.");
  }
}

function validateGridSnapshot(snapshot: SandGridSnapshot): void {
  if (!Number.isSafeInteger(snapshot.width) || snapshot.width <= 0 || !Number.isSafeInteger(snapshot.height) || snapshot.height <= 0) {
    throw new RangeError("Presentation grid dimensions must be positive safe integers.");
  }
  if (!Array.isArray(snapshot.cells) || snapshot.cells.length !== snapshot.width * snapshot.height) {
    throw new RangeError("Presentation grid cells must match width * height.");
  }
}
