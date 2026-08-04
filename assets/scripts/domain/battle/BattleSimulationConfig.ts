export interface BattleSimulationConfig {
  readonly simulationTickRate: number;
  readonly maxAbsorbCellsPerBucketPerTick: number;
  readonly gravityIterationsPerTick: number;
  readonly maxSimulationTicksPerRenderFrame: number;
  readonly maxVisibleTicksMerged: number;
  readonly maxPresentationFrameQueueSize: number;
}

export const DEFAULT_BATTLE_SIMULATION_CONFIG: BattleSimulationConfig = Object.freeze({
  simulationTickRate: 30,
  maxAbsorbCellsPerBucketPerTick: 4,
  gravityIterationsPerTick: 1,
  maxSimulationTicksPerRenderFrame: 2,
  maxVisibleTicksMerged: 1,
  maxPresentationFrameQueueSize: 6,
});
