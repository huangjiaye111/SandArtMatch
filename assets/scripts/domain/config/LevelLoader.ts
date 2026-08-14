import { createBattleStateMachine, type BattleStateMachine } from "../battle/BattleStateMachine";
import { createBattleSimulation, type BattleSimulation } from "../battle/BattleSimulation";
import { createBucket, type Bucket } from "../bucket/Bucket";
import { createConveyor, type ConveyorSystem } from "../bucket/Conveyor";
import { createSeededRandom, type SeededRandom } from "../core/Random";
import { SandGrid } from "../core/SandGrid";
import { getBattleConveyorSlotCount, type FeatureFlagsData } from "../../services/FeatureFlags";
import {
  parseLevelConfig,
  type LevelConfig,
  type LevelRulesConfig,
  type RawLevelConfig,
  type SandCellValue,
} from "./LevelConfig";

export interface LoadedLevel {
  readonly config: LevelConfig;
  readonly grid: SandGrid;
  readonly bucketQueue: readonly Bucket[];
  readonly conveyor: ConveyorSystem;
  readonly rules: LevelRulesConfig;
  readonly random: SeededRandom;
}

export interface LoadedLevelOptions {
  readonly featureFlags?: FeatureFlagsData;
}

export function loadLevelConfig(raw: RawLevelConfig): LevelConfig {
  return parseLevelConfig(raw);
}

export function createLoadedLevel(raw: RawLevelConfig, options: LoadedLevelOptions = {}): LoadedLevel {
  return createLoadedLevelFromConfig(loadLevelConfig(raw), options);
}

export function createLoadedLevelFromConfig(config: LevelConfig, options: LoadedLevelOptions = {}): LoadedLevel {
  const parsedConfig = parseLevelConfig(config);
  const grid = new SandGrid(parsedConfig.width, parsedConfig.height, parsedConfig.sandMap);
  const bucketQueue = parsedConfig.bucketQueue.map((bucket) =>
    createBucket(bucket.configId, { colorId: bucket.colorId, capacity: bucket.capacity }, { currentAmount: bucket.initialAmount }),
  );

  return Object.freeze({
    config: parsedConfig,
    grid,
    bucketQueue: Object.freeze([...bucketQueue]),
    conveyor: createConveyor(options.featureFlags === undefined
      ? parsedConfig.conveyorSlots
      : getBattleConveyorSlotCount(parsedConfig.conveyorSlots, options.featureFlags)),
    rules: parsedConfig.rules,
    random: createSeededRandom(parsedConfig.seed),
  });
}

export function createBattleStateMachineFromLevel(raw: RawLevelConfig): BattleStateMachine {
  const loaded = createLoadedLevel(raw);
  return createBattleStateMachine({
    grid: loaded.grid,
    buckets: loaded.bucketQueue,
    conveyor: loaded.conveyor,
    random: loaded.random,
  });
}

export function createBattleSimulationFromLevel(raw: RawLevelConfig): BattleSimulation {
  const loaded = createLoadedLevel(raw);
  return createBattleSimulation({
    grid: loaded.grid,
    buckets: loaded.bucketQueue,
    conveyor: loaded.conveyor,
    random: loaded.random,
  });
}

export function createBattleSimulationFromLevelWithOptions(raw: RawLevelConfig, options: LoadedLevelOptions): BattleSimulation {
  const loaded = createLoadedLevel(raw, options);
  return createBattleSimulation({
    grid: loaded.grid,
    buckets: loaded.bucketQueue,
    conveyor: loaded.conveyor,
    random: loaded.random,
  });
}

export function sandMapToRows(width: number, sandMap: readonly SandCellValue[]): readonly (readonly SandCellValue[])[] {
  if (!Number.isSafeInteger(width) || width <= 0) {
    throw new RangeError("sandMap row width must be a positive safe integer.");
  }

  const rows: SandCellValue[][] = [];
  for (let start = 0; start < sandMap.length; start += width) {
    rows.push(sandMap.slice(start, start + width));
  }
  return Object.freeze(rows.map((row) => Object.freeze([...row])));
}
