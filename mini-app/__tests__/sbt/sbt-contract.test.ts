import { describe, it, expect } from "vitest";
import { Address, beginCell, Cell } from "@ton/core";
import {
  SbtCollection,
  SbtItem,
  calculateSbtItemAddress,
  calculateSbtItemStateInit,
  SBT_COLLECTION_CODE_BOC,
  SBT_ITEM_CODE_BOC,
  encodeOffChainContent,
} from "../../src/lib/sbt";
import { SbtOpcodes } from "../../src/lib/sbtOpcodes";

describe("Native TEP-85 SBT Engine - Smart Contract & Serialization Tests", () => {
  const dummyOwner = Address.parse("EQAREREREREREREREREREREREREREREREREREREREREREeYT");
  const dummyAuthority = Address.parse("EQAiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIp3C");
  const dummyCollection = Address.parse("EQAzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzM7SN");

  it("should have valid standard TEP-85 opcodes", () => {
    expect(SbtOpcodes.mint).toBe(1);
    expect(SbtOpcodes.transfer).toBe(0x5fcc3d14);
    expect(SbtOpcodes.proveOwnership).toBe(0x04ded148);
    expect(SbtOpcodes.ownershipProof).toBe(0x0524c7ae);
    expect(SbtOpcodes.requestOwner).toBe(0xd0c3bfea);
    expect(SbtOpcodes.ownerInfo).toBe(0x0dd607e3);
    expect(SbtOpcodes.destroy).toBe(0x1f04537a);
    expect(SbtOpcodes.revoke).toBe(0x6f89f5e3);
  });

  it("should parse compiled BOCs for SBT collection and item", () => {
    const colCode = Cell.fromBase64(SBT_COLLECTION_CODE_BOC);
    expect(colCode).toBeDefined();
    expect(colCode.bits.length).toBeGreaterThan(0);

    const itemCode = Cell.fromBase64(SBT_ITEM_CODE_BOC);
    expect(itemCode).toBeDefined();
    expect(itemCode.bits.length).toBeGreaterThan(0);
  });

  it("should deterministically calculate SBT item addresses based on collection and index", () => {
    const addr0 = calculateSbtItemAddress(dummyCollection, 0);
    const addr1 = calculateSbtItemAddress(dummyCollection, 1);
    const addr0Again = calculateSbtItemAddress(dummyCollection, 0);

    expect(addr0).toBeInstanceOf(Address);
    expect(addr1).toBeInstanceOf(Address);
    expect(addr0.toString()).toBe(addr0Again.toString());
    expect(addr0.toString()).not.toBe(addr1.toString());

    const stateInit = calculateSbtItemStateInit(dummyCollection, 0);
    expect(stateInit.code).toBeDefined();
    expect(stateInit.data).toBeDefined();

    // Verify uninitialized storage contains 64-bit index + collection address
    const slice = stateInit.data!.beginParse();
    expect(slice.loadUint(64)).toBe(0);
    expect(slice.loadAddress().toString()).toBe(dummyCollection.toString());
  });

  it("should build valid SbtCollection stateInit and address", () => {
    const col = new SbtCollection({
      ownerAddress: dummyOwner,
      nextItemIndex: 0,
      collectionContentUrl: "https://onton.app/metadata/col.json",
      commonContentUrl: "",
      royaltyPercent: 0,
      royaltyAddress: dummyOwner,
    });

    const stateInit = col.stateInit;
    expect(stateInit.code).toBeDefined();
    expect(stateInit.data).toBeDefined();

    const address = col.address;
    expect(address).toBeInstanceOf(Address);
    expect(address.workChain).toBe(0);
  });

  it("should format TEP-85 mint body with owner, off-chain content, and authority address", () => {
    const col = new SbtCollection({
      ownerAddress: dummyOwner,
      nextItemIndex: 0,
      collectionContentUrl: "https://onton.app/metadata/col.json",
      commonContentUrl: "",
    });

    const mintBody = col.createMintBody({
      queryId: 42,
      itemIndex: 7,
      amount: BigInt(50000000), // 0.05 TON
      itemOwnerAddress: dummyOwner,
      commonContentUrl: "https://onton.app/metadata/item7.json",
      authorityAddress: dummyAuthority,
    });

    const slice = mintBody.beginParse();
    const op = slice.loadUint(32);
    const queryId = slice.loadUint(64);
    const itemIndex = slice.loadUint(64);
    const amount = slice.loadCoins();
    const itemContentCell = slice.loadRef();

    expect(op).toBe(SbtOpcodes.mint);
    expect(queryId).toBe(42);
    expect(itemIndex).toBe(7);
    expect(amount).toBe(BigInt(50000000));

    // Verify item content cell contents per sbt-item.fc:
    // owner_address -> ref(content) -> authority_address
    const itemSlice = itemContentCell.beginParse();
    const owner = itemSlice.loadAddress();
    const contentRef = itemSlice.loadRef();
    const authority = itemSlice.loadAddress();

    expect(owner.toString()).toBe(dummyOwner.toString());
    expect(authority.toString()).toBe(dummyAuthority.toString());
    expect(contentRef).toBeDefined();

    // Verify off-chain content prefix 0x01
    const contentSlice = contentRef.beginParse();
    expect(contentSlice.loadUint(8)).toBe(0x01);
  });

  it("should format SbtItem destroy body according to TEP-85", () => {
    const destroyBody = SbtItem.createDestroyBody(1234);
    const slice = destroyBody.beginParse();
    expect(slice.loadUint(32)).toBe(SbtOpcodes.destroy);
    expect(slice.loadUint(64)).toBe(1234);
  });

  it("should format SbtItem revoke body according to TEP-85", () => {
    const revokeBody = SbtItem.createRevokeBody(5678);
    const slice = revokeBody.beginParse();
    expect(slice.loadUint(32)).toBe(SbtOpcodes.revoke);
    expect(slice.loadUint(64)).toBe(5678);
  });

  it("should format SbtItem proveOwnership body according to TEP-85", () => {
    const dummyPayload = beginCell().storeUint(999, 32).endCell();
    const proveBody = SbtItem.createProveOwnershipBody({
      queryId: 99,
      to: dummyAuthority,
      data: dummyPayload,
      withContent: true,
    });

    const slice = proveBody.beginParse();
    expect(slice.loadUint(32)).toBe(SbtOpcodes.proveOwnership);
    expect(slice.loadUint(64)).toBe(99);
    expect(slice.loadAddress().toString()).toBe(dummyAuthority.toString());
    expect(slice.loadRef()).toBeDefined();
    expect(slice.loadBit()).toBe(true);
  });

  it("should format SbtItem requestOwner body according to TEP-85", () => {
    const forwardPayload = beginCell().storeUint(777, 32).endCell();
    const requestBody = SbtItem.createRequestOwnerBody({
      queryId: 101,
      dest: dummyOwner,
      forwardPayload,
      withContent: false,
    });

    const slice = requestBody.beginParse();
    expect(slice.loadUint(32)).toBe(SbtOpcodes.requestOwner);
    expect(slice.loadUint(64)).toBe(101);
    expect(slice.loadAddress().toString()).toBe(dummyOwner.toString());
    expect(slice.loadRef()).toBeDefined();
    expect(slice.loadBit()).toBe(false);
  });
});
