/**
 * ONTON cSBT Registry Deployment Script
 *
 * IMPORTANT SAFETY DIRECTIVE:
 * NEVER run this script against mainnet.
 * Contract deployment to staging / mainnet is handled exclusively by Mahdi.
 */

import { Address, toNano } from "@ton/core";
import { compileCsbtRegistry } from "../helpers/compile";
import { CsbtRegistry } from "../wrappers/CsbtRegistry";

async function main() {
  console.log("==================================================================");
  console.log("ONTON cSBT Registry Deployment Helper");
  console.log("SAFETY GUARD: Never deploy to mainnet directly! Mahdi deploys.");
  console.log("==================================================================");

  const adminAddressRaw = process.env.CSBT_REGISTRY_ADMIN || process.env.ONTON_MINTER_WALLET;
  if (!adminAddressRaw) {
    console.error("Error: CSBT_REGISTRY_ADMIN or ONTON_MINTER_WALLET must be set in environment.");
    process.exit(1);
  }

  const adminAddress = Address.parse(adminAddressRaw);
  console.log(`Configuring registry with admin: ${adminAddress.toString()}`);

  const code = await compileCsbtRegistry();
  const registry = CsbtRegistry.createFromConfig({ adminAddress }, code);

  console.log("\nDeployment Details:");
  console.log(`- Contract Address (workchain 0): ${registry.address.toString()}`);
  console.log(`- Contract Address (raw): ${registry.address.toRawString()}`);
  console.log(`- Recommended Initial Gas: 0.1 TON`);

  if (registry.init) {
    const initBoc = registry.init.data.toBoc().toString("base64");
    console.log(`- StateInit Data BoC (base64): ${initBoc}`);
  }

  console.log("\nTo deploy via TonConnect / Minter Wallet:");
  console.log(`Send an internal message with >= 0.1 TON to ${registry.address.toString()} with stateInit.`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Deployment failed:", err);
    process.exit(1);
  });
}
