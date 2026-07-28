import { access } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error?.code !== "ERR_MODULE_NOT_FOUND" ||
      !specifier.startsWith(".") ||
      specifier.endsWith(".ts")
    ) {
      throw error;
    }

    const parentUrl = context.parentURL;
    if (parentUrl === undefined || !parentUrl.startsWith("file:")) {
      throw error;
    }

    const candidate = new URL(`${specifier}.ts`, parentUrl);
    await access(fileURLToPath(candidate));
    return nextResolve(pathToFileURL(fileURLToPath(candidate)).href, context);
  }
}
