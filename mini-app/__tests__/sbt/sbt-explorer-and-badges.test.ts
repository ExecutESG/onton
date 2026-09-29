import { describe, it, expect, vi } from "vitest";
import { getExplorerLink } from "../../src/server/routers/sbt";

describe("SBT Showcase & Dynamic Explorer Routing", () => {
  it("should generate testnet tonviewer links on testnet environment", () => {
    const testAddress = "0:8a514fbd654d07936a048705f1345866160537e584f29a28c0b5c1e95655e620";
    const link = getExplorerLink(testAddress);
    expect(link).toBe(`https://testnet.tonviewer.com/${testAddress}`);
  });

  it("should correctly format user-facing badge addresses", () => {
    const address = "kQCKUU-9ZU0Hk2oEhwXxNFhmFgU35YTimijAtcHpVlXmIA6r";
    const link = getExplorerLink(address);
    expect(link).toContain(address);
    expect(link.startsWith("https://")).toBe(true);
  });
});
