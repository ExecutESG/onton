import { describe, it, expect, beforeEach } from "vitest";
import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { Address, Cell, toNano } from "@ton/core";
import crypto from "crypto";
import { compileCsbtRegistry } from "../helpers/compile";
import {
  CsbtRegistry,
  CSBT_REGISTRY_ERRORS,
} from "../wrappers/CsbtRegistry";

function computeTestEventHash(kind: "native" | "legacy", uuidStr: string): bigint {
  const cleanUuid = uuidStr.replace(/-/g, "");
  const uuidBuf = Buffer.from(cleanUuid, "hex");
  const kindBuf = Buffer.from(kind, "utf-8");
  const hash = crypto.createHash("sha256").update(Buffer.concat([kindBuf, uuidBuf])).digest();
  return BigInt("0x" + hash.toString("hex"));
}

interface TxExpectation {
  from?: Address;
  to?: Address;
  success?: boolean;
  exitCode?: number;
}

function expectTransaction(transactions: any[], filter: TxExpectation) {
  const match = transactions.find((tx) => {
    if (filter.to) {
      const dest = tx.inMessage?.info?.dest;
      if (dest && !dest.equals(filter.to)) return false;
      if (!dest && BigInt("0x" + filter.to.hash.toString("hex")) !== tx.address) return false;
    }
    if (filter.from) {
      const src = tx.inMessage?.info?.src;
      if (!src || !src.equals(filter.from)) return false;
    }
    if (filter.success !== undefined) {
      const isSuccess = tx.description?.computePhase?.success ?? false;
      if (isSuccess !== filter.success) return false;
    }
    if (filter.exitCode !== undefined) {
      const code = tx.description?.computePhase?.exitCode;
      if (code !== filter.exitCode) return false;
    }
    return true;
  });

  expect(match).toBeDefined();
  return match;
}

describe("cSBT Registry Contract Sandbox Suite", () => {
  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let admin: SandboxContract<TreasuryContract>;
  let nonAdmin: SandboxContract<TreasuryContract>;
  let newAdmin: SandboxContract<TreasuryContract>;
  let registryCode: Cell;
  let registry: SandboxContract<CsbtRegistry>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury("deployer");
    admin = await blockchain.treasury("admin");
    nonAdmin = await blockchain.treasury("nonAdmin");
    newAdmin = await blockchain.treasury("newAdmin");

    registryCode = await compileCsbtRegistry();
    registry = blockchain.openContract(
      CsbtRegistry.createFromConfig(
        {
          adminAddress: admin.address,
        },
        registryCode
      )
    );

    const deployResult = await registry.sendDeploy(deployer.getSender(), toNano("0.1"));
    expectTransaction(deployResult.transactions, {
      from: deployer.address,
      to: registry.address,
      success: true,
    });
  });

  describe("Initialization & Getters", () => {
    it("should return the correct initial admin address", async () => {
      const currentAdmin = await registry.getAdmin();
      expect(currentAdmin.equals(admin.address)).toBe(true);
    });

    it("should return 0 for non-existent event roots", async () => {
      const nonExistent = 0x1234567890abcdefn;
      const root = await registry.getRoot(nonExistent);
      expect(root).toBe(0n);

      const opt = await registry.getRootOpt(nonExistent);
      expect(opt.root).toBe(0n);
      expect(opt.found).toBe(false);
    });
  });

  describe("Root Anchoring (set_root)", () => {
    it("should allow admin to set root for a native event and return it via getter", async () => {
      const eventHash = computeTestEventHash("native", "4b287361-a06f-43dd-87c1-2d3a68f99fa7");
      const rootHash = 0xdeadbeefcafebaben;

      const result = await registry.sendSetRoot(admin.getSender(), {
        eventHash,
        root: rootHash,
        value: toNano("0.05"),
      });

      expectTransaction(result.transactions, {
        from: admin.address,
        to: registry.address,
        success: true,
      });

      const storedRoot = await registry.getRoot(eventHash);
      expect(storedRoot).toBe(rootHash);

      const opt = await registry.getRootOpt(eventHash);
      expect(opt.found).toBe(true);
      expect(opt.root).toBe(rootHash);
    });

    it("should allow admin to anchor multiple distinct events (native and legacy)", async () => {
      const nativeHash = computeTestEventHash("native", "11111111-1111-1111-1111-111111111111");
      const legacyHash = computeTestEventHash("legacy", "22222222-2222-2222-2222-222222222222");

      const nativeRoot = 0xaaaa1111n;
      const legacyRoot = 0xbbbb2222n;

      await registry.sendSetRoot(admin.getSender(), {
        eventHash: nativeHash,
        root: nativeRoot,
        value: toNano("0.05"),
      });

      await registry.sendSetRoot(admin.getSender(), {
        eventHash: legacyHash,
        root: legacyRoot,
        value: toNano("0.05"),
      });

      expect(await registry.getRoot(nativeHash)).toBe(nativeRoot);
      expect(await registry.getRoot(legacyHash)).toBe(legacyRoot);
    });

    it("should enforce overwrite policy: REJECT overwrite once set (exit code 409)", async () => {
      const eventHash = computeTestEventHash("native", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
      const initialRoot = 0x1111222233334444n;
      const newRootAttempt = 0x9999888877776666n;

      // 1. Initial set succeeds
      const firstSet = await registry.sendSetRoot(admin.getSender(), {
        eventHash,
        root: initialRoot,
        value: toNano("0.05"),
      });
      expectTransaction(firstSet.transactions, {
        from: admin.address,
        to: registry.address,
        success: true,
      });

      // 2. Overwrite attempt MUST fail with error::already_exists (409)
      const overwriteResult = await registry.sendSetRoot(admin.getSender(), {
        eventHash,
        root: newRootAttempt,
        value: toNano("0.05"),
      });

      expectTransaction(overwriteResult.transactions, {
        from: admin.address,
        to: registry.address,
        success: false,
        exitCode: CSBT_REGISTRY_ERRORS.already_exists,
      });

      // 3. Stored root MUST remain the original root
      const storedRoot = await registry.getRoot(eventHash);
      expect(storedRoot).toBe(initialRoot);
    });

    it("should reject set_root from non-admin caller (exit code 401)", async () => {
      const eventHash = computeTestEventHash("native", "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
      const root = 0x1234n;

      const result = await registry.sendSetRoot(nonAdmin.getSender(), {
        eventHash,
        root,
        value: toNano("0.05"),
      });

      expectTransaction(result.transactions, {
        from: nonAdmin.address,
        to: registry.address,
        success: false,
        exitCode: CSBT_REGISTRY_ERRORS.unauthorized,
      });

      // Verify nothing was written
      expect(await registry.getRoot(eventHash)).toBe(0n);
    });
  });

  describe("Admin Management (change_admin)", () => {
    it("should allow admin to transfer ownership to a new admin", async () => {
      const result = await registry.sendChangeAdmin(admin.getSender(), {
        newAdmin: newAdmin.address,
        value: toNano("0.05"),
      });

      expectTransaction(result.transactions, {
        from: admin.address,
        to: registry.address,
        success: true,
      });

      expect((await registry.getAdmin()).equals(newAdmin.address)).toBe(true);

      // New admin can anchor
      const eventHash = computeTestEventHash("native", "cccccccc-cccc-cccc-cccc-cccccccccccc");
      const root = 0x5555n;

      const newAdminSet = await registry.sendSetRoot(newAdmin.getSender(), {
        eventHash,
        root,
        value: toNano("0.05"),
      });
      expectTransaction(newAdminSet.transactions, {
        from: newAdmin.address,
        to: registry.address,
        success: true,
      });

      expect(await registry.getRoot(eventHash)).toBe(root);

      // Old admin can no longer anchor
      const oldAdminSet = await registry.sendSetRoot(admin.getSender(), {
        eventHash: computeTestEventHash("native", "dddddddd-dddd-dddd-dddd-dddddddddddd"),
        root: 0x6666n,
        value: toNano("0.05"),
      });
      expectTransaction(oldAdminSet.transactions, {
        from: admin.address,
        to: registry.address,
        success: false,
        exitCode: CSBT_REGISTRY_ERRORS.unauthorized,
      });
    });

    it("should reject change_admin from non-admin (exit code 401)", async () => {
      const result = await registry.sendChangeAdmin(nonAdmin.getSender(), {
        newAdmin: nonAdmin.address,
        value: toNano("0.05"),
      });

      expectTransaction(result.transactions, {
        from: nonAdmin.address,
        to: registry.address,
        success: false,
        exitCode: CSBT_REGISTRY_ERRORS.unauthorized,
      });

      expect((await registry.getAdmin()).equals(admin.address)).toBe(true);
    });
  });

  describe("Rent & Bounce Safety", () => {
    it("should accept pure Toncoin transfers with empty body for storage rent", async () => {
      const transfer = await deployer.send({
        to: registry.address,
        value: toNano("0.5"),
      });

      expectTransaction(transfer.transactions, {
        from: deployer.address,
        to: registry.address,
        success: true,
      });
    });
  });
});
