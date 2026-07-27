import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const domainRoot = join("assets", "scripts", "domain");
const mathRandomPattern = /\b(?:globalThis\s*\.\s*)?Math\s*\.\s*random\b/;

function collectTypeScriptFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectTypeScriptFiles(fullPath));
    } else if (fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("gameplay domain random source", () => {
  it("does not call Math.random()", () => {
    const offenders = collectTypeScriptFiles(domainRoot).filter((file) => {
      return mathRandomPattern.test(readFileSync(file, "utf8"));
    });

    assert.deepEqual(offenders, []);
  });
});
