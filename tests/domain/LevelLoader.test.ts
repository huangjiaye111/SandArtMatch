import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BattlePhase } from "../../assets/scripts/domain/battle/BattleState.ts";
import {
  createBattleStateMachineFromLevel,
  createLoadedLevel,
  loadLevelConfig,
  sandMapToRows,
} from "../../assets/scripts/domain/config/LevelLoader.ts";
import {
  DEFAULT_LEVEL_CONVEYOR_SLOTS,
  DEFAULT_RULES,
  LEVEL_CONFIG_VERSION,
  LevelConfigError,
  type LevelConfig,
} from "../../assets/scripts/domain/config/LevelConfig.ts";
import {
  TEST_LEVEL_001,
  createBattleStateMachineForBuiltInTestLevel,
  getBuiltInTestLevel,
} from "../../assets/scripts/domain/config/TestLevels.ts";

function minimalRawLevel() {
  return {
    levelId: 99,
    seed: "minimal",
    width: 1,
    height: 1,
    sandMap: [null],
    bucketQueue: [{ configId: "empty", colorId: 1, capacity: 1 }],
  };
}

function completeRawLevel() {
  return {
    version: LEVEL_CONFIG_VERSION,
    levelId: 7,
    seed: "complete",
    width: 3,
    height: 2,
    sandMap: [1, null, 2, null, 3, null],
    conveyorSlots: 4,
    bucketQueue: [
      { configId: "red", colorId: 1, capacity: 3, initialAmount: 1, specialType: "normal" },
      { configId: "blue", colorId: 2, capacity: 4, initialAmount: 0, specialType: "normal" },
      { configId: "green", colorId: 3, capacity: 5, initialAmount: 2, specialType: "normal" },
    ],
    rules: {
      mergeCount: 3,
      mergeScope: "global",
      absorbMode: "exposedSameColor",
      allowPartialBucketMerge: true,
      allowDifferentCapacityMerge: true,
      enableSideSlip: true,
      mergeSpeedMultiplier: 1,
    },
  };
}

function expectLevelConfigError(callback: () => unknown, path: string): LevelConfigError {
  try {
    callback();
  } catch (error) {
    assert.equal(error instanceof LevelConfigError, true);
    const configError = error as LevelConfigError;
    assert.equal(configError.details.some((detail) => detail.path === path), true, configError.message);
    assert.equal(configError.message.includes(path), true);
    return configError;
  }

  throw new Error("Expected LevelConfigError.");
}

describe("LevelLoader", () => {
  it("loads a valid minimal level and applies documented defaults", () => {
    const config = loadLevelConfig(minimalRawLevel());

    assert.equal(config.version, LEVEL_CONFIG_VERSION);
    assert.equal(config.levelId, 99);
    assert.equal(config.seed, "minimal");
    assert.equal(config.width, 1);
    assert.equal(config.height, 1);
    assert.deepEqual(config.sandMap, [null]);
    assert.equal(config.conveyorSlots, DEFAULT_LEVEL_CONVEYOR_SLOTS);
    assert.deepEqual(config.rules, DEFAULT_RULES);
    assert.deepEqual(config.bucketQueue, [
      { configId: "empty", colorId: 1, capacity: 1, initialAmount: 0, specialType: "normal" },
    ]);
  });

  it("uses the existing ConveyorSystem positive-integer constraint for slot counts", () => {
    const config = loadLevelConfig({ ...minimalRawLevel(), conveyorSlots: 13 });
    const loaded = createLoadedLevel({ ...minimalRawLevel(), conveyorSlots: 13 });

    assert.equal(config.conveyorSlots, 13);
    assert.equal(loaded.conveyor.maxSlots, 13);
  });

  it("loads a valid complete level into domain objects", () => {
    const loaded = createLoadedLevel(completeRawLevel());

    assert.equal(loaded.config.levelId, 7);
    assert.deepEqual(loaded.grid.snapshot().cells, [1, null, 2, null, 3, null]);
    assert.deepEqual(loaded.grid.toRows(), [
      [1, null, 2],
      [null, 3, null],
    ]);
    assert.deepEqual(loaded.bucketQueue.map((bucket) => bucket.snapshot()), [
      { instanceId: "red", colorId: 1, capacity: 3, amount: 1, status: "available" },
      { instanceId: "blue", colorId: 2, capacity: 4, amount: 0, status: "available" },
      { instanceId: "green", colorId: 3, capacity: 5, amount: 2, status: "available" },
    ]);
    assert.deepEqual(loaded.conveyor.snapshot().slots, [null, null, null, null]);
    assert.deepEqual(loaded.rules, DEFAULT_RULES);
    assert.deepEqual(loaded.random.snapshot(), createLoadedLevel(completeRawLevel()).random.snapshot());
  });

  it("creates a BattleStateMachine that the battle UI skeleton can read", () => {
    const machine = createBattleStateMachineFromLevel(completeRawLevel());
    const snapshot = machine.snapshot();

    assert.equal(snapshot.phase, BattlePhase.WaitingInput);
    assert.equal(snapshot.actionIndex, 0);
    assert.deepEqual(snapshot.conveyor.slots, [null, null, null, null]);
    assert.deepEqual(snapshot.buckets.map((bucket) => bucket.instanceId), ["red", "blue", "green"]);
    assert.deepEqual(snapshot.grid.cells, [1, null, 2, null, 3, null]);
  });

  it("loads the built-in test level through the fixed Cocos-facing entry", () => {
    const config = getBuiltInTestLevel();
    const machine = createBattleStateMachineForBuiltInTestLevel();

    assert.equal(config, TEST_LEVEL_001);
    assert.equal(machine.snapshot().phase, BattlePhase.WaitingInput);
    assert.equal(machine.snapshot().conveyor.maxSlots, 6);
    assert.deepEqual(machine.snapshot().buckets.map((bucket) => bucket.instanceId), [
      "t01-green-a",
      "t01-green-b",
      "t01-green-c",
      "t01-red-a",
      "t01-blue-a",
      "t01-red-b",
      "t01-blue-b",
      "t01-yellow-spare",
    ]);
  });

  it("plays the built-in first playable through merge, absorption, gravity, bucket exit, and victory", () => {
    const machine = createBattleStateMachineForBuiltInTestLevel();
    const actions = ["t01-green-a", "t01-green-b", "t01-green-c", "t01-red-a", "t01-blue-a", "t01-red-b"];

    const results = actions.map((bucketId) => machine.selectBucket(bucketId));

    assert.equal(getBuiltInTestLevel().seed, "first-playable-001");
    assert.equal(results.every((result) => result.accepted), true);
    assert.equal(results[2].events.find((event) => event.type === "mergeResolved")?.type, "mergeResolved");
    const mergeEvent = results[2].events.find((event) => event.type === "mergeResolved");
    assert.equal(mergeEvent?.type === "mergeResolved" && mergeEvent.result.merged, true);
    assert.equal(results.some((result) => {
      const event = result.events.find((candidate) => candidate.type === "absorbResolved");
      return event?.type === "absorbResolved" && event.schedule.assignedCount > 0;
    }), true);
    assert.equal(results.some((result) => {
      const event = result.events.find((candidate) => candidate.type === "sandGravityResolved");
      return event?.type === "sandGravityResolved" && event.result.totalMoves > 0;
    }), true);
    assert.equal(results.some((result) => {
      const event = result.events.find((candidate) => candidate.type === "bucketCompleteResolved");
      return event?.type === "bucketCompleteResolved" && event.completedBucketInstanceIds.length > 0;
    }), true);
    assert.equal(results.at(-1)?.afterPhase, BattlePhase.Won);
    assert.equal(machine.snapshot().grid.cells.every((cell) => cell === null), true);
  });

  it("restores the first playable snapshot with undo and repeats deterministically", () => {
    const machine = createBattleStateMachineForBuiltInTestLevel();
    machine.selectBucket("t01-green-a");
    const beforeRepeat = machine.snapshot();
    const first = machine.selectBucket("t01-green-b");

    const undo = machine.undo();
    const second = machine.selectBucket("t01-green-b");

    assert.equal(undo.accepted, true);
    assert.deepEqual(undo.snapshot, beforeRepeat);
    assert.deepEqual(second, first);
  });

  it("replays the first playable deterministically across a longer action and undo sequence", () => {
    const actions = [
      "t01-green-a",
      "t01-green-b",
      "undo",
      "t01-green-b",
      "t01-green-c",
      "t01-red-a",
      "undo",
      "t01-red-a",
      "t01-blue-a",
      "t01-red-b",
    ] as const;
    const play = () => {
      const machine = createBattleStateMachineForBuiltInTestLevel();
      const results = actions.map((action) => (action === "undo" ? machine.undo() : machine.selectBucket(action)));
      return {
        results,
        snapshot: machine.snapshot(),
      };
    };

    const first = play();
    const second = play();

    assert.deepEqual(second, first);
    assert.equal(first.snapshot.phase, BattlePhase.Won);
    assert.equal(first.snapshot.grid.cells.every((cell) => cell === null), true);
  });

  it("returns deterministic loaded configs and battle snapshots for identical input", () => {
    const first = createLoadedLevel(completeRawLevel());
    const second = createLoadedLevel(completeRawLevel());
    const firstMachine = createBattleStateMachineFromLevel(completeRawLevel());
    const secondMachine = createBattleStateMachineFromLevel(completeRawLevel());

    assert.deepEqual(first.config, second.config);
    assert.deepEqual(first.grid.snapshot(), second.grid.snapshot());
    assert.deepEqual(first.bucketQueue.map((bucket) => bucket.snapshot()), second.bucketQueue.map((bucket) => bucket.snapshot()));
    assert.deepEqual(first.conveyor.snapshot(), second.conveyor.snapshot());
    assert.deepEqual(first.rules, second.rules);
    assert.deepEqual(first.random.snapshot(), second.random.snapshot());
    assert.deepEqual(firstMachine.snapshot(), secondMachine.snapshot());
  });

  it("does not mutate raw input or share mutable arrays with the loaded result", () => {
    const raw = completeRawLevel();
    const beforeRaw = JSON.stringify(raw);
    const config = loadLevelConfig(raw);
    const loaded = createLoadedLevel(raw);

    assert.equal(JSON.stringify(raw), beforeRaw);

    raw.sandMap[0] = null;
    raw.bucketQueue[0].capacity = 99;
    raw.rules.mergeSpeedMultiplier = 9;

    assert.deepEqual(config.sandMap, [1, null, 2, null, 3, null]);
    assert.equal(config.bucketQueue[0].capacity, 3);
    assert.equal(config.rules.mergeSpeedMultiplier, 1);
    assert.deepEqual(loaded.grid.snapshot().cells, [1, null, 2, null, 3, null]);
    assert.equal(loaded.bucketQueue[0].capacity, 3);
  });

  it("does not expose mutable config arrays", () => {
    const config = loadLevelConfig(completeRawLevel());

    assert.throws(() => {
      (config.sandMap as (number | null)[])[0] = null;
    }, TypeError);
    assert.throws(() => {
      (config.bucketQueue as LevelConfig["bucketQueue"] & LevelConfig["bucketQueue"][number][]).pop();
    }, TypeError);
    assert.throws(() => {
      (config.rules as { mergeCount: number }).mergeCount = 4;
    }, TypeError);

    assert.deepEqual(config.sandMap, [1, null, 2, null, 3, null]);
  });

  it("reports field paths for invalid basic fields", () => {
    for (const [path, patch] of [
      ["levelId", { levelId: 0 }],
      ["width", { width: 0 }],
      ["width", { width: -1 }],
      ["width", { width: 1.5 }],
      ["width", { width: Number.NaN }],
      ["width", { width: Number.POSITIVE_INFINITY }],
      ["height", { height: 0 }],
      ["height", { height: 1.25 }],
      ["seed", { seed: "" }],
      ["seed", { seed: 123 }],
      ["version", { version: 2 }],
    ] as const) {
      expectLevelConfigError(() => loadLevelConfig({ ...minimalRawLevel(), ...patch }), path);
    }
  });

  it("rejects unsafe grid sizes before relying on sandMap allocation", () => {
    expectLevelConfigError(
      () =>
        loadLevelConfig({
          ...minimalRawLevel(),
          width: Number.MAX_SAFE_INTEGER,
          height: 2,
          sandMap: [null],
        }),
      "width",
    );
    expectLevelConfigError(
      () =>
        loadLevelConfig({
          ...minimalRawLevel(),
          width: 1_000_001,
          height: 1,
          sandMap: [null],
        }),
      "height",
    );
    expectLevelConfigError(
      () =>
        loadLevelConfig({
          ...minimalRawLevel(),
          width: 0,
          sandMap: new Array(10_000_000),
        }),
      "width",
    );
  });

  it("rejects malformed sandMap length and color ids", () => {
    expectLevelConfigError(() => loadLevelConfig({ ...minimalRawLevel(), sandMap: [] }), "sandMap");
    expectLevelConfigError(() => loadLevelConfig({ ...minimalRawLevel(), sandMap: [null, 1] }), "sandMap");
    expectLevelConfigError(() => loadLevelConfig({ ...minimalRawLevel(), sandMap: new Array(1) }), "sandMap[0]");

    for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "1"]) {
      expectLevelConfigError(() => loadLevelConfig({ ...minimalRawLevel(), sandMap: [value] }), "sandMap[0]");
    }
  });

  it("rejects malformed conveyor and bucket queue fields", () => {
    for (const conveyorSlots of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expectLevelConfigError(() => loadLevelConfig({ ...minimalRawLevel(), conveyorSlots }), "conveyorSlots");
    }

    expectLevelConfigError(() => loadLevelConfig({ ...minimalRawLevel(), bucketQueue: "bad" }), "bucketQueue");
    expectLevelConfigError(() => loadLevelConfig({ ...minimalRawLevel(), bucketQueue: new Array(1) }), "bucketQueue[0]");
    expectLevelConfigError(
      () => loadLevelConfig({ ...minimalRawLevel(), bucketQueue: [{ configId: "", colorId: 1, capacity: 1 }] }),
      "bucketQueue[0].configId",
    );
    expectLevelConfigError(
      () => loadLevelConfig({ ...minimalRawLevel(), bucketQueue: [{ configId: "a", colorId: 0, capacity: 1 }] }),
      "bucketQueue[0].colorId",
    );
    expectLevelConfigError(
      () => loadLevelConfig({ ...minimalRawLevel(), bucketQueue: [{ configId: "a", colorId: 1, capacity: 0 }] }),
      "bucketQueue[0].capacity",
    );
    expectLevelConfigError(
      () => loadLevelConfig({ ...minimalRawLevel(), bucketQueue: [{ configId: "a", colorId: 1, capacity: 1, initialAmount: 2 }] }),
      "bucketQueue[0].initialAmount",
    );
    expectLevelConfigError(
      () => loadLevelConfig({ ...minimalRawLevel(), bucketQueue: [{ configId: "a", colorId: 1, capacity: 1, specialType: "bomb" }] }),
      "bucketQueue[0].specialType",
    );
    expectLevelConfigError(
      () =>
        loadLevelConfig({
          ...minimalRawLevel(),
          bucketQueue: [
            { configId: "a", colorId: 1, capacity: 1 },
            { configId: "a", colorId: 2, capacity: 1 },
          ],
        }),
      "bucketQueue[1].configId",
    );
  });

  it("rejects malformed rules and unknown fields", () => {
    expectLevelConfigError(() => loadLevelConfig({ ...minimalRawLevel(), extra: true }), "extra");
    expectLevelConfigError(
      () => loadLevelConfig({ ...minimalRawLevel(), rules: { ...DEFAULT_RULES, extra: true } }),
      "rules.extra",
    );
    expectLevelConfigError(() => loadLevelConfig({ ...minimalRawLevel(), rules: { ...DEFAULT_RULES, mergeCount: 2 } }), "rules.mergeCount");
    expectLevelConfigError(() => loadLevelConfig({ ...minimalRawLevel(), rules: { ...DEFAULT_RULES, mergeScope: "adjacent" } }), "rules.mergeScope");
    expectLevelConfigError(() => loadLevelConfig({ ...minimalRawLevel(), rules: { ...DEFAULT_RULES, absorbMode: "all" } }), "rules.absorbMode");
    expectLevelConfigError(
      () => loadLevelConfig({ ...minimalRawLevel(), rules: { ...DEFAULT_RULES, allowDifferentCapacityMerge: false } }),
      "rules.allowDifferentCapacityMerge",
    );
    expectLevelConfigError(
      () => loadLevelConfig({ ...minimalRawLevel(), rules: { ...DEFAULT_RULES, allowPartialBucketMerge: false } }),
      "rules.allowPartialBucketMerge",
    );
    expectLevelConfigError(
      () => loadLevelConfig({ ...minimalRawLevel(), rules: { ...DEFAULT_RULES, enableSideSlip: false } }),
      "rules.enableSideSlip",
    );
    expectLevelConfigError(
      () => loadLevelConfig({ ...minimalRawLevel(), rules: { ...DEFAULT_RULES, mergeSpeedMultiplier: 2 } }),
      "rules.mergeSpeedMultiplier",
    );
    expectLevelConfigError(
      () => loadLevelConfig({ ...minimalRawLevel(), rules: { ...DEFAULT_RULES, enableSideSlip: "yes" } }),
      "rules.enableSideSlip",
    );
  });

  it("does not produce half-initialized battle state for invalid configs", () => {
    const error = expectLevelConfigError(
      () => createBattleStateMachineFromLevel({ ...minimalRawLevel(), bucketQueue: [{ configId: "bad", colorId: 1, capacity: 0 }] }),
      "bucketQueue[0].capacity",
    );

    assert.deepEqual(error.details.map((detail) => detail.path), ["bucketQueue[0].capacity"]);
  });

  it("converts flat sand maps into rows for Cocos presentation adapters", () => {
    assert.deepEqual(sandMapToRows(2, [1, null, 2, 3]), [
      [1, null],
      [2, 3],
    ]);
    assert.throws(() => sandMapToRows(0, [1]), RangeError);
  });
});
