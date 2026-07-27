import type { SandColorId } from "../config/LevelConfig.ts";
import { SandGrid } from "./SandGrid.ts";

export interface ExposedSandCell {
  x: number;
  y: number;
  index: number;
  colorId: SandColorId;
}

export interface ExternalAirCell {
  x: number;
  y: number;
  index: number;
}

export interface ExposureDetectionOptions {
  colorId?: SandColorId;
}

export interface ExposureDetectionResult {
  exposedSand: readonly ExposedSandCell[];
  externalAir: readonly ExternalAirCell[];
  hasExternalAirEntry: boolean;
}

const ORTHOGONAL_DIRECTIONS: ReadonlyArray<readonly [dx: number, dy: number]> = Object.freeze([
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]);

export function detectExposedSand(
  grid: SandGrid,
  options: ExposureDetectionOptions = {},
): ExposureDetectionResult {
  validateGrid(grid);
  if (options.colorId !== undefined) {
    validateColorId(options.colorId);
  }

  const { externalAirFlags, hasExternalAirEntry } = findExternalAir(grid);
  const exposedFlags = findExposedSandFlags(grid, externalAirFlags);
  const exposedSand = collectExposedSand(grid, exposedFlags, options.colorId);
  const externalAir = collectExternalAir(grid, externalAirFlags);

  return Object.freeze({
    exposedSand,
    externalAir,
    hasExternalAirEntry,
  });
}

export function detectExposedSandByColor(grid: SandGrid, colorId: SandColorId): readonly ExposedSandCell[] {
  return detectExposedSand(grid, { colorId }).exposedSand;
}

function findExternalAir(grid: SandGrid): { externalAirFlags: boolean[]; hasExternalAirEntry: boolean } {
  const externalAirFlags = new Array<boolean>(grid.width * grid.height).fill(false);
  const queue: number[] = [];
  const bottomY = grid.height - 1;

  for (let x = 0; x < grid.width; x += 1) {
    if (!grid.hasSandAt(x, bottomY)) {
      enqueueAir(grid, externalAirFlags, queue, x, bottomY);
    }
  }

  let readIndex = 0;
  while (readIndex < queue.length) {
    const currentIndex = queue[readIndex];
    readIndex += 1;
    const x = currentIndex % grid.width;
    const y = Math.floor(currentIndex / grid.width);

    for (const [dx, dy] of ORTHOGONAL_DIRECTIONS) {
      const nextX = x + dx;
      const nextY = y + dy;
      if (isInBounds(grid, nextX, nextY) && !grid.hasSandAt(nextX, nextY)) {
        enqueueAir(grid, externalAirFlags, queue, nextX, nextY);
      }
    }
  }

  return {
    externalAirFlags,
    hasExternalAirEntry: queue.length > 0,
  };
}

function enqueueAir(grid: SandGrid, externalAirFlags: boolean[], queue: number[], x: number, y: number): void {
  const index = toIndex(grid, x, y);
  if (!externalAirFlags[index]) {
    externalAirFlags[index] = true;
    queue.push(index);
  }
}

function findExposedSandFlags(grid: SandGrid, externalAirFlags: readonly boolean[]): boolean[] {
  const exposedFlags = new Array<boolean>(grid.width * grid.height).fill(false);

  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const colorId = grid.get(x, y);
      if (colorId === null) {
        continue;
      }

      if (y === grid.height - 1 || touchesExternalAir(grid, externalAirFlags, x, y)) {
        exposedFlags[toIndex(grid, x, y)] = true;
      }
    }
  }

  return exposedFlags;
}

function touchesExternalAir(grid: SandGrid, externalAirFlags: readonly boolean[], x: number, y: number): boolean {
  for (const [dx, dy] of ORTHOGONAL_DIRECTIONS) {
    const nextX = x + dx;
    const nextY = y + dy;
    if (isInBounds(grid, nextX, nextY) && externalAirFlags[toIndex(grid, nextX, nextY)]) {
      return true;
    }
  }

  return false;
}

function collectExposedSand(
  grid: SandGrid,
  exposedFlags: readonly boolean[],
  colorFilter: SandColorId | undefined,
): readonly ExposedSandCell[] {
  const exposedSand: ExposedSandCell[] = [];

  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const index = toIndex(grid, x, y);
      if (!exposedFlags[index]) {
        continue;
      }

      const colorId = grid.get(x, y);
      if (colorId !== null && (colorFilter === undefined || colorId === colorFilter)) {
        exposedSand.push(Object.freeze({ x, y, index, colorId }));
      }
    }
  }

  return Object.freeze(exposedSand);
}

function collectExternalAir(grid: SandGrid, externalAirFlags: readonly boolean[]): readonly ExternalAirCell[] {
  const externalAir: ExternalAirCell[] = [];

  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const index = toIndex(grid, x, y);
      if (externalAirFlags[index]) {
        externalAir.push(Object.freeze({ x, y, index }));
      }
    }
  }

  return Object.freeze(externalAir);
}

function isInBounds(grid: SandGrid, x: number, y: number): boolean {
  return x >= 0 && x < grid.width && y >= 0 && y < grid.height;
}

function toIndex(grid: SandGrid, x: number, y: number): number {
  return y * grid.width + x;
}

function validateGrid(grid: SandGrid): void {
  if (!(grid instanceof SandGrid)) {
    throw new TypeError("Exposure detection requires a SandGrid.");
  }
}

function validateColorId(colorId: SandColorId): void {
  if (!Number.isSafeInteger(colorId) || colorId <= 0) {
    throw new RangeError("Exposure color id must be a positive safe integer.");
  }
}
