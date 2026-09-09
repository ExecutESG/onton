import { describe, it, expect } from "vitest";
import { createMockContext } from "../helpers/mockContext";

describe("User & Identity API Flow", () => {
  it("creates standard participant context with correct role defaults", () => {
    const ctx = createMockContext({ role: "user" });
    expect(ctx.user.user_id).toBe(12345);
    expect(ctx.user.username).toBe("onton_tester");
    expect(ctx.userRole).toBe("user");
    expect(ctx.isOrganizer).toBe(false);
    expect(ctx.isAdmin).toBe(false);
  });

  it("identifies organizer privileges properly", () => {
    const ctx = createMockContext({ role: "organizer" });
    expect(ctx.isOrganizer).toBe(true);
    expect(ctx.isAdmin).toBe(false);
  });

  it("identifies admin privileges properly", () => {
    const ctx = createMockContext({ role: "admin" });
    expect(ctx.isOrganizer).toBe(true);
    expect(ctx.isAdmin).toBe(true);
  });

  it("handles wallet address binding", () => {
    const testWallet = "EQBvW8Z5huBkMJYdn3PCDnTWKK3iqKIOFd3zCXPawpReQDrC";
    const ctx = createMockContext({ wallet_address: testWallet });
    expect(ctx.userAddress).toBe(testWallet);
  });
});
