import { describe, it, expect } from "vitest";
import { Address, beginCell, Cell, toNano } from "@ton/core";
import {
  SbtCollection,
  calculateSbtItemAddress,
  encodeOffChainContent,
  makeSnakeCell,
} from "../../src/lib/sbt";
import { SbtOpcodes } from "../../src/lib/sbtOpcodes";

describe("TEP-85 SBT Extended Serialization & Edge Cases", () => {
  const dummyOwner = Address.parse("EQAREREREREREREREREREREREREREREREREREREREREREeYT");
  const dummyAuthority = Address.parse("EQAiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIp3C");
  const dummyCollection = Address.parse("EQAzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzM7SN");

  it("EXT-1: encodes TEP-64 snake cells accurately across 127B, 254B, and 1KB boundaries", () => {
    // 1. Boundary: exactly 126 bytes of text + 1 prefix byte = 127 bytes (single cell)
    const exact127Url = "https://example.com/" + "a".repeat(106);
    const cell127 = encodeOffChainContent(exact127Url);
    expect(cell127.refs.length).toBe(0);
    const slice127 = cell127.beginParse();
    expect(slice127.loadUint(8)).toBe(0x01);
    expect(slice127.loadBuffer(slice127.remainingBits / 8).toString("utf-8")).toBe(exact127Url);

    // 2. Boundary: 254 bytes total (overflow into child ref)
    const longUrl254 = "https://example.com/" + "b".repeat(233);
    const cell254 = encodeOffChainContent(longUrl254);
    expect(cell254.refs.length).toBe(1);

    // 3. Deep chain: ~1KB URL requiring multiple snake cell refs
    const deepUrl = "https://onton.live/metadata/events/badges/" + "c".repeat(950);
    const cellDeep = encodeOffChainContent(deepUrl);
    expect(cellDeep.refs.length).toBe(1);

    // Reconstruct string from nested snake cells to guarantee byte fidelity
    let reconstructed = Buffer.alloc(0);
    let curSlice = cellDeep.beginParse();
    const prefix = curSlice.loadUint(8);
    expect(prefix).toBe(0x01);

    while (curSlice) {
      const remainingBytes = curSlice.loadBuffer(curSlice.remainingBits / 8);
      reconstructed = Buffer.concat([reconstructed, remainingBytes]);
      if (curSlice.remainingRefs > 0) {
        curSlice = curSlice.loadRef().beginParse();
      } else {
        break;
      }
    }
    expect(reconstructed.toString("utf-8")).toBe(deepUrl);
  });

  it("EXT-2: empty buffer in makeSnakeCell produces empty cell", () => {
    const empty = makeSnakeCell(Buffer.alloc(0));
    expect(empty.bits.length).toBe(0);
    expect(empty.refs.length).toBe(0);
  });

  it("EXT-3: collection stateInit and address are strictly deterministic", () => {
    const createParams = () => ({
      ownerAddress: dummyOwner,
      nextItemIndex: 5,
      collectionContentUrl: "https://onton.live/meta/collection.json",
      commonContentUrl: "https://onton.live/meta/",
      royaltyPercent: 0.05,
      royaltyAddress: dummyAuthority,
    });

    const col1 = new SbtCollection(createParams());
    const col2 = new SbtCollection(createParams());

    expect(col1.address.toString()).toBe(col2.address.toString());
    expect(col1.stateInit.code?.toBoc().toString("hex")).toBe(col2.stateInit.code?.toBoc().toString("hex"));
    expect(col1.stateInit.data?.toBoc().toString("hex")).toBe(col2.stateInit.data?.toBoc().toString("hex"));
  });

  it("EXT-4: parses collection data cell according to standard TON NFT/SBT layout", () => {
    const col = new SbtCollection({
      ownerAddress: dummyOwner,
      nextItemIndex: 12,
      collectionContentUrl: "https://onton.live/meta/col.json",
      commonContentUrl: "https://onton.live/meta/",
      royaltyPercent: 0,
      royaltyAddress: dummyOwner,
    });

    const dataCell = col.stateInit.data!;
    const slice = dataCell.beginParse();

    // 1. owner address
    const parsedOwner = slice.loadAddress();
    expect(parsedOwner.toString()).toBe(dummyOwner.toString());

    // 2. next item index (uint64)
    const nextIdx = slice.loadUint(64);
    expect(nextIdx).toBe(12);

    // 3. content cell ref
    const contentRef = slice.loadRef();
    expect(contentRef).toBeDefined();

    // 4. item code ref
    const itemCodeRef = slice.loadRef();
    expect(itemCodeRef).toBeDefined();

    // 5. royalty cell ref
    const royaltyRef = slice.loadRef();
    const royaltySlice = royaltyRef.beginParse();
    const factor = royaltySlice.loadUint(16);
    const base = royaltySlice.loadUint(16);
    const royaltyAddr = royaltySlice.loadAddress();
    expect(factor).toBe(0);
    expect(base).toBe(1000);
    expect(royaltyAddr.toString()).toBe(dummyOwner.toString());
  });

  it("EXT-5: calculateSbtItemAddress yields 1000 unique collision-free addresses", () => {
    const seenAddresses = new Set<string>();
    const count = 1000;

    for (let index = 0; index < count; index++) {
      const addr = calculateSbtItemAddress(dummyCollection, index);
      const addrStr = addr.toString();
      expect(seenAddresses.has(addrStr)).toBe(false);
      seenAddresses.add(addrStr);
    }

    expect(seenAddresses.size).toBe(count);
  });

  it("EXT-6: mint body with amount=0n serializes cleanly without underflow", () => {
    const col = new SbtCollection({
      ownerAddress: dummyOwner,
      nextItemIndex: 0,
      collectionContentUrl: "https://onton.live/meta/col.json",
      commonContentUrl: "",
    });

    const mintBody = col.createMintBody({
      queryId: 0,
      itemIndex: 0,
      amount: BigInt(0),
      itemOwnerAddress: dummyOwner,
      commonContentUrl: "https://onton.live/meta/item-0.json",
      authorityAddress: dummyAuthority,
    });

    const slice = mintBody.beginParse();
    expect(slice.loadUint(32)).toBe(SbtOpcodes.mint);
    expect(slice.loadUint(64)).toBe(0); // queryId
    expect(slice.loadUint(64)).toBe(0); // itemIndex
    expect(slice.loadCoins()).toBe(BigInt(0)); // amount coins
  });

  it("EXT-7: mint body with standard 0.055 TON nano amounts retains bigint precision", () => {
    const col = new SbtCollection({
      ownerAddress: dummyOwner,
      nextItemIndex: 1,
      collectionContentUrl: "https://onton.live/meta/col.json",
      commonContentUrl: "",
    });

    const nanoAmount = toNano("0.055");
    const mintBody = col.createMintBody({
      queryId: 9999,
      itemIndex: 1,
      amount: nanoAmount,
      itemOwnerAddress: dummyOwner,
      commonContentUrl: "https://onton.live/meta/item-1.json",
      authorityAddress: dummyAuthority,
    });

    const slice = mintBody.beginParse();
    slice.loadUint(32); // skip op
    slice.loadUint(64); // skip queryId
    slice.loadUint(64); // skip index
    expect(slice.loadCoins()).toBe(nanoAmount);
  });
});
