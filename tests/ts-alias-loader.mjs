import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(pathToFileURL(resolvePath(process.cwd(), `${specifier.slice(2)}.ts`)).href, context);
  }
  return nextResolve(specifier, context);
}
