import { createBattleStateMachineFromLevel } from "./LevelLoader";
import {
  DEFAULT_RULES,
  LEVEL_CONFIG_VERSION,
  type LevelConfig,
  type RawLevelConfig,
} from "./LevelConfig";

export const TEST_LEVEL_001: LevelConfig = Object.freeze({
  version: LEVEL_CONFIG_VERSION,
  levelId: 1,
  seed: "first-playable-001",
  width: 4,
  height: 4,
  sandMap: Object.freeze([
    null, null, null, null,
    1, null, 2, null,
    1, 2, 2, null,
    1, 1, 2, null,
  ]),
  conveyorSlots: 6,
  bucketQueue: Object.freeze([
    Object.freeze({ configId: "t01-green-a", colorId: 3, capacity: 2, initialAmount: 0, specialType: "normal" }),
    Object.freeze({ configId: "t01-green-b", colorId: 3, capacity: 3, initialAmount: 0, specialType: "normal" }),
    Object.freeze({ configId: "t01-green-c", colorId: 3, capacity: 4, initialAmount: 0, specialType: "normal" }),
    Object.freeze({ configId: "t01-red-a", colorId: 1, capacity: 3, initialAmount: 0, specialType: "normal" }),
    Object.freeze({ configId: "t01-blue-a", colorId: 2, capacity: 4, initialAmount: 0, specialType: "normal" }),
    Object.freeze({ configId: "t01-red-b", colorId: 1, capacity: 2, initialAmount: 0, specialType: "normal" }),
    Object.freeze({ configId: "t01-blue-b", colorId: 2, capacity: 2, initialAmount: 0, specialType: "normal" }),
    Object.freeze({ configId: "t01-yellow-spare", colorId: 4, capacity: 2, initialAmount: 0, specialType: "normal" }),
  ]),
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
