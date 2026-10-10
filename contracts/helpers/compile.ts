import fs from "fs";
import path from "path";
import { compileFunc } from "@ton-community/func-js";
import { Cell } from "@ton/core";

let cachedRegistryCode: Cell | null = null;

export async function compileCsbtRegistry(): Promise<Cell> {
  if (cachedRegistryCode) {
    return cachedRegistryCode;
  }

  const contractsDir = path.resolve(__dirname, "..");
  const stdlibPath = path.join(contractsDir, "stdlib.fc");
  const registryPath = path.join(contractsDir, "csbt_registry.fc");

  const stdlibSource = fs.readFileSync(stdlibPath, "utf-8");
  const registrySource = fs.readFileSync(registryPath, "utf-8");

  const result = await compileFunc({
    targets: ["csbt_registry.fc"],
    sources: {
      "stdlib.fc": stdlibSource,
      "csbt_registry.fc": registrySource,
    },
  });

  if (result.status === "error") {
    throw new Error(`FunC compilation error: ${result.message}`);
  }

  cachedRegistryCode = Cell.fromBoc(Buffer.from(result.codeBoc, "base64"))[0];
  return cachedRegistryCode;
}
