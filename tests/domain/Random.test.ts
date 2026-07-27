import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSeededRandom, SeededRandom, type RandomSnapshot } from "../../assets/scripts/domain/core/Random.ts";

function sequence(seed: string | number, count: number): number[] {
  const random = createSeededRandom(seed);
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push(random.nextUint32());
  }
  return values;
}

describe("SeededRandom", () => {
  it("generates identical sequences for identical string seeds", () => {
    assert.deepEqual(sequence("level-001", 12), sequence("level-001", 12));
  });

  it("generates identical sequences for identical numeric seeds", () => {
    assert.deepEqual(sequence(123456789, 12), sequence(123456789, 12));
  });

  it("generates stable known sequences for different seeds", () => {
    assert.deepEqual(sequence("level-001", 5), [1394512101, 2706144484, 4107115020, 3054174346, 358570855]);
    assert.deepEqual(sequence("level-002", 5), [775749483, 2347317219, 263531593, 3988222903, 2079578295]);
  });

  it("restores the same continuation after snapshot", () => {
    const random = createSeededRandom("undo-state");
    random.nextUint32();
    random.nextUint32();

    const snapshot = random.snapshot();
    const firstContinuation = [
      random.nextFloat(),
      random.intInclusive(2, 8),
      random.index(5),
      random.nextUint32(),
    ];

    random.restore(snapshot);

    assert.deepEqual(
      [random.nextFloat(), random.intInclusive(2, 8), random.index(5), random.nextUint32()],
      firstContinuation,
    );
  });

  it("can construct a generator from a serialized snapshot", () => {
    const random = createSeededRandom("serialized");
    random.nextUint32();
    const snapshotJson = JSON.stringify(random.snapshot());
    const restored = SeededRandom.fromSnapshot(JSON.parse(snapshotJson) as RandomSnapshot);

    assert.equal(restored.nextUint32(), random.nextUint32());
  });

  it("keeps float values in [0, 1)", () => {
    const random = createSeededRandom("float-range");
    for (let index = 0; index < 200; index += 1) {
      const value = random.nextFloat();
      assert.equal(value >= 0, true);
      assert.equal(value < 1, true);
    }
  });

  it("supports integer range boundaries", () => {
    const random = createSeededRandom("integer-boundaries");

    assert.equal(random.intInclusive(7, 7), 7);

    for (let index = 0; index < 200; index += 1) {
      const value = random.intInclusive(-3, 3);
      assert.equal(value >= -3, true);
      assert.equal(value <= 3, true);
      assert.equal(Number.isInteger(value), true);
    }
  });

  it("supports index boundaries", () => {
    const random = createSeededRandom("index-boundaries");

    assert.equal(random.index(1), 0);

    for (let index = 0; index < 200; index += 1) {
      const value = random.index(8);
      assert.equal(value >= 0, true);
      assert.equal(value < 8, true);
      assert.equal(Number.isInteger(value), true);
    }
  });

  it("rejects invalid ranges and snapshots", () => {
    const random = createSeededRandom("invalid-input");

    assert.throws(() => random.intInclusive(3, 2), RangeError);
    assert.throws(() => random.intInclusive(0.5, 2), RangeError);
    assert.throws(() => random.index(0), RangeError);
    assert.throws(() => random.restore({ algorithm: "xorshift32", state: -1 }), RangeError);
    assert.throws(() => random.restore({ algorithm: "xorshift32", state: 0 }), RangeError);
    assert.throws(() => SeededRandom.fromSeed(Number.NaN), RangeError);
  });
});
