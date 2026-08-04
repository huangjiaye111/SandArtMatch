import { createBattleSimulationFromLevel, createBattleStateMachineFromLevel } from "./LevelLoader";
import {
  DEFAULT_RULES,
  LEVEL_CONFIG_VERSION,
  type LevelBucketConfig,
  type LevelConfig,
  type RawLevelConfig,
  type SandCellValue,
} from "./LevelConfig";

export interface SandMapRun {
  readonly value: SandCellValue;
  readonly length: number;
}

export interface ShowcaseLevelMetrics {
  readonly width: number;
  readonly height: number;
  readonly totalCells: number;
  readonly sandCells: number;
  readonly occupancyRatio: number;
  readonly colorCounts: ReadonlyMap<number, number>;
}

const SHOWCASE_WIDTH = 96;
const SHOWCASE_HEIGHT = 96;
const SHOWCASE_SEED = "sand-workshop-island-sunset-019";
const SHOWCASE_SAND_MAP = decodeSandMapRuns(createShowcaseSandMapRuns(), SHOWCASE_WIDTH * SHOWCASE_HEIGHT);
const SHOWCASE_COLOR_COUNTS = countColors(SHOWCASE_SAND_MAP);

export const TEST_LEVEL_001: LevelConfig = Object.freeze({
  version: LEVEL_CONFIG_VERSION,
  levelId: 1,
  seed: SHOWCASE_SEED,
  width: SHOWCASE_WIDTH,
  height: SHOWCASE_HEIGHT,
  sandMap: SHOWCASE_SAND_MAP,
  conveyorSlots: 6,
  bucketQueue: createShowcaseBucketQueue(SHOWCASE_COLOR_COUNTS),
  rules: DEFAULT_RULES,
});

export const TEST_LEVELS: readonly LevelConfig[] = Object.freeze([TEST_LEVEL_001]);

export function getBuiltInTestLevel(levelId: number = TEST_LEVEL_001.levelId): LevelConfig {
  const level = TEST_LEVELS.find((candidate) => candidate.levelId === levelId);
  if (level === undefined) {
    throw new RangeError(`Unknown built-in test level: ${levelId}.`);
  }
  return level;
}

export function createBattleStateMachineForBuiltInTestLevel(levelId: number = TEST_LEVEL_001.levelId) {
  return createBattleStateMachineFromLevel(getBuiltInTestLevel(levelId) as RawLevelConfig);
}

export function createBattleSimulationForBuiltInTestLevel(levelId: number = TEST_LEVEL_001.levelId) {
  return createBattleSimulationFromLevel(getBuiltInTestLevel(levelId) as RawLevelConfig);
}

export function getShowcaseLevelMetrics(): ShowcaseLevelMetrics {
  const sandCells = SHOWCASE_SAND_MAP.filter((cell) => cell !== null).length;
  return Object.freeze({
    width: SHOWCASE_WIDTH,
    height: SHOWCASE_HEIGHT,
    totalCells: SHOWCASE_WIDTH * SHOWCASE_HEIGHT,
    sandCells,
    occupancyRatio: sandCells / (SHOWCASE_WIDTH * SHOWCASE_HEIGHT),
    colorCounts: SHOWCASE_COLOR_COUNTS,
  });
}

export function decodeSandMapRuns(runs: readonly SandMapRun[], expectedCellCount: number): readonly SandCellValue[] {
  const cells: SandCellValue[] = [];
  for (const run of runs) {
    validateRun(run);
    for (let index = 0; index < run.length; index += 1) {
      cells.push(run.value);
    }
  }
  if (cells.length !== expectedCellCount) {
    throw new RangeError(`Decoded showcase sand map length ${cells.length} does not match ${expectedCellCount}.`);
  }
  return Object.freeze(cells);
}

function createShowcaseSandMapRuns(): readonly SandMapRun[] {
  const cells = createIslandSunsetCells();
  const runs: SandMapRun[] = [];
  let currentValue = cells[0];
  let length = 0;
  for (const cell of cells) {
    if (cell === currentValue) {
      length += 1;
      continue;
    }
    runs.push(Object.freeze({ value: currentValue, length }));
    currentValue = cell;
    length = 1;
  }
  runs.push(Object.freeze({ value: currentValue, length }));
  return Object.freeze(runs);
}

function createIslandSunsetCells(): readonly SandCellValue[] {
  const cells: SandCellValue[] = [];
  for (let y = 0; y < SHOWCASE_HEIGHT; y += 1) {
    for (let x = 0; x < SHOWCASE_WIDTH; x += 1) {
      cells.push(colorAt(x, y));
    }
  }
  return Object.freeze(cells);
}

function colorAt(x: number, y: number): SandCellValue {
  if (isAirPore(x, y)) {
    return null;
  }
  if (inSun(x, y)) {
    return 3;
  }
  if (inFlowerAccent(x, y)) {
    return 7;
  }
  if (inPalmLeaf(x, y) || inIsland(x, y)) {
    return 4;
  }
  if (inPalmTrunk(x, y) || inBoatHull(x, y)) {
    return 5;
  }
  if (inSail(x, y) || inCloud(x, y)) {
    return 6;
  }
  if (y >= 48) {
    return 2;
  }
  return 1;
}

function inSun(x: number, y: number): boolean {
  return ellipse(x, y, 72, 30, 17, 17);
}

function inCloud(x: number, y: number): boolean {
  return ellipse(x, y, 20, 22, 10, 4) || ellipse(x, y, 30, 19, 13, 5) || ellipse(x, y, 39, 23, 9, 4);
}

function inIsland(x: number, y: number): boolean {
  return ellipse(x, y, 52, 70, 30, 7) || ellipse(x, y, 58, 75, 22, 5);
}

function inPalmTrunk(x: number, y: number): boolean {
  const centerX = 52 + Math.floor((y - 45) / 7);
  return y >= 44 && y <= 69 && Math.abs(x - centerX) <= 2;
}

function inPalmLeaf(x: number, y: number): boolean {
  return lineBand(x, y, 54, 43, 28, 36, 3)
    || lineBand(x, y, 54, 43, 40, 32, 3)
    || lineBand(x, y, 54, 43, 61, 29, 3)
    || lineBand(x, y, 54, 43, 72, 36, 3)
    || lineBand(x, y, 54, 43, 50, 27, 3);
}

function inBoatHull(x: number, y: number): boolean {
  return y >= 70 && y <= 74 && x >= 17 + (y - 70) && x <= 39 - (y - 70);
}

function inSail(x: number, y: number): boolean {
  return y >= 51 && y <= 69 && x >= 24 && x <= 36 && x - 24 <= Math.floor((69 - y) * 0.72);
}

function inFlowerAccent(x: number, y: number): boolean {
  return ellipse(x, y, 42, 68, 3, 2) || ellipse(x, y, 64, 70, 3, 2) || ellipse(x, y, 57, 76, 4, 2);
}

function isAirPore(x: number, y: number): boolean {
  void x;
  void y;
  return false;
}

function ellipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  return nx * nx + ny * ny <= 1;
}

function lineBand(x: number, y: number, x1: number, y1: number, x2: number, y2: number, radius: number): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  const distanceSquared = (x - px) * (x - px) + (y - py) * (y - py);
  return distanceSquared <= radius * radius;
}

function positiveMod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function countColors(cells: readonly SandCellValue[]): ReadonlyMap<number, number> {
  const counts = new Map<number, number>();
  for (const cell of cells) {
    if (cell !== null) {
      counts.set(cell, (counts.get(cell) ?? 0) + 1);
    }
  }
  return counts;
}

function createShowcaseBucketQueue(counts: ReadonlyMap<number, number>): readonly LevelBucketConfig[] {
  return Object.freeze([
    ...splitBuckets("accent-merge", 7, requireColorCount(counts, 7), 3),
    ...splitBuckets("water", 2, requireColorCount(counts, 2), 3),
    ...splitBuckets("sky", 1, requireColorCount(counts, 1), 3),
    ...splitBuckets("green", 4, requireColorCount(counts, 4), 2),
    bucket("showcase-sun", 3, requireColorCount(counts, 3)),
    bucket("showcase-brown", 5, requireColorCount(counts, 5)),
    bucket("showcase-cream", 6, requireColorCount(counts, 6)),
  ]);
}

function splitBuckets(prefix: string, colorId: number, totalCapacity: number, count: number): readonly LevelBucketConfig[] {
  const buckets: LevelBucketConfig[] = [];
  let remaining = totalCapacity;
  for (let index = 0; index < count; index += 1) {
    const partsLeft = count - index;
    const capacity = index === count - 1 ? remaining : Math.max(1, Math.floor(totalCapacity / count));
    remaining -= capacity;
    buckets.push(bucket(`showcase-${prefix}-${index + 1}`, colorId, capacity + (partsLeft === 1 ? 0 : 0)));
  }
  return Object.freeze(buckets);
}

function bucket(configId: string, colorId: number, capacity: number): LevelBucketConfig {
  return Object.freeze({ configId, colorId, capacity, initialAmount: 0, specialType: "normal" });
}

function requireColorCount(counts: ReadonlyMap<number, number>, colorId: number): number {
  const count = counts.get(colorId);
  if (count === undefined || count <= 0) {
    throw new Error(`Showcase level is missing color ${colorId}.`);
  }
  return count;
}

function validateRun(run: SandMapRun): void {
  if (!Number.isSafeInteger(run.length) || run.length <= 0) {
    throw new RangeError("Showcase sand RLE run length must be a positive safe integer.");
  }
  if (run.value !== null && (!Number.isSafeInteger(run.value) || run.value <= 0)) {
    throw new RangeError("Showcase sand RLE color must be null or a positive safe integer.");
  }
}
