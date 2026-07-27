# Data Schema

This document records proposed data shapes for planning. Field names and exact TypeScript interfaces are 待验证 until implemented in an active task.

## Level Config

待验证:

```ts
interface LevelConfig {
  levelId: number;
  seed: string;
  grid: SandGridConfig;
  buckets: BucketConfig[];
  conveyor: ConveyorConfig;
  rules: RuleConfig;
}
```

可配置:

- `seed`.
- Grid size and initial sand layout.
- Bucket list.
- Conveyor capacity.
- Rule overrides.

## Sand Grid

待验证:

```ts
interface SandCell {
  x: number;
  y: number;
  colorId: number | null;
  hasSand: boolean;
  isMoving: boolean;
  isExposed: boolean;
}
```

Frozen concept:

- Sand is represented by a two-dimensional logical grid.

可配置:

- Whether empty cells use `null`, `0`, or a separate enum.
- Whether exposed status is stored or computed.

## Bucket

待验证:

```ts
interface BucketState {
  id: string;
  colorId: number;
  capacity: number;
  amount: number;
  absorbRate: number;
  mergeLevel: number;
  specialType: BucketSpecialType;
  status: BucketStatus;
}
```

Frozen concept:

- Buckets have color, capacity, current fill, and conveyor/pool state.

可配置:

- Capacity values.
- Absorb rate.
- Merge level behavior.
- Special type support.

## Conveyor

待验证:

```ts
interface ConveyorState {
  maxSlots: number;
  slots: Array<string | null>;
}
```

Frozen concept:

- Default conveyor capacity is 6.
- A bucket occupies one slot.

可配置:

- Per-level max slots.
- Temporary extra-slot rule.

## Battle Snapshot

待验证:

```ts
interface BattleSnapshot {
  levelId: number;
  phase: string;
  randomState: string;
  grid: unknown;
  buckets: BucketState[];
  conveyor: ConveyorState;
  historyDepth: number;
}
```

Frozen concept:

- Undo must restore deterministic gameplay state, including randomness.

可配置:

- Snapshot frequency.
- Maximum history depth.
- Compression format.
