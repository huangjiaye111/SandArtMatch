import { getSelectableBucketIds } from "../bucket/BucketPool";
import type { BucketState } from "../bucket/Bucket";
import type { SandGridSnapshot } from "../core/SandGrid";
import type { SeededRandom } from "../core/Random";

export type BattleToolAction = "hint" | "shuffle" | "removePoolBucket" | "removeCarrierBucket";
export type TargetedBattleToolAction = "removePoolBucket" | "removeCarrierBucket";

export interface BattleToolRuleSpec {
  readonly action: BattleToolAction;
  readonly displayName: string;
  readonly cost: number;
  readonly cooldownTurns: number;
  readonly allowedPhases: readonly ["WaitingInput"];
}

export interface BattleHintResult {
  readonly recommendedBucketInstanceId: string | null;
  readonly reason: "matchesExposedSand" | "firstSelectable" | "noSelectableBucket";
}

export const BATTLE_TOOL_RULES: readonly BattleToolRuleSpec[] = Object.freeze([
  createToolRule("hint", "Hint"),
  createToolRule("shuffle", "Shuffle"),
  createToolRule("removePoolBucket", "Remove Pool Bucket"),
  createToolRule("removeCarrierBucket", "Remove Carrier Bucket"),
]);

export function isTargetedBattleToolAction(action: BattleToolAction): action is TargetedBattleToolAction {
  return action === "removePoolBucket" || action === "removeCarrierBucket";
}

export function resolveBattleHint(input: {
  readonly grid: SandGridSnapshot;
  readonly buckets: readonly BucketState[];
}): BattleHintResult {
  const selectableIds = getSelectableBucketIds(input.buckets);
  if (selectableIds.length === 0) {
    return Object.freeze({ recommendedBucketInstanceId: null, reason: "noSelectableBucket" });
  }

  const exposedColors = getExposedColors(input.grid);
  for (const bucketId of selectableIds) {
    const bucket = input.buckets.find((candidate) => candidate.instanceId === bucketId) ?? null;
    if (bucket !== null && exposedColors.has(bucket.colorId)) {
      return Object.freeze({ recommendedBucketInstanceId: bucket.instanceId, reason: "matchesExposedSand" });
    }
  }

  return Object.freeze({ recommendedBucketInstanceId: selectableIds[0], reason: "firstSelectable" });
}

export function shuffleAvailableBucketOrder(input: {
  readonly buckets: readonly BucketState[];
  readonly random: SeededRandom;
}): readonly string[] {
  const availableIds = input.buckets
    .filter((bucket) => bucket.status === "available")
    .map((bucket) => bucket.instanceId);
  const shuffledIds = [...availableIds];
  for (let index = shuffledIds.length - 1; index > 0; index -= 1) {
    const selectedIndex = input.random.intInclusive(0, index);
    const selected = shuffledIds[selectedIndex];
    shuffledIds[selectedIndex] = shuffledIds[index];
    shuffledIds[index] = selected;
  }

  const nextOrder = input.buckets.map((bucket) => bucket.instanceId);
  let shuffledIndex = 0;
  for (let index = 0; index < input.buckets.length; index += 1) {
    if (input.buckets[index].status === "available") {
      nextOrder[index] = shuffledIds[shuffledIndex];
      shuffledIndex += 1;
    }
  }
  return Object.freeze(nextOrder);
}

function createToolRule(action: BattleToolAction, displayName: string): BattleToolRuleSpec {
  return Object.freeze({
    action,
    displayName,
    cost: 0,
    cooldownTurns: 0,
    allowedPhases: Object.freeze(["WaitingInput"] as const),
  });
}

function getExposedColors(grid: SandGridSnapshot): ReadonlySet<number> {
  const colors = new Set<number>();
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const index = y * grid.width + x;
      const color = grid.cells[index];
      if (color === null || color === undefined) {
        continue;
      }
      if (isCellExposed(grid, x, y)) {
        colors.add(color);
      }
    }
  }
  return colors;
}

function isCellExposed(grid: SandGridSnapshot, x: number, y: number): boolean {
  return x === 0 || x === grid.width - 1 || y === 0 || y === grid.height - 1 ||
    getCell(grid, x - 1, y) === null ||
    getCell(grid, x + 1, y) === null ||
    getCell(grid, x, y - 1) === null ||
    getCell(grid, x, y + 1) === null;
}

function getCell(grid: SandGridSnapshot, x: number, y: number): number | null {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) {
    return null;
  }
  return grid.cells[y * grid.width + x] ?? null;
}
