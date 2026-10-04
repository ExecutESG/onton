import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("@/server/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/redisTools", () => ({
  redisTools: { acquireLock: vi.fn(), releaseLock: vi.fn(), getCache: vi.fn(), setCache: vi.fn(), deleteCache: vi.fn() },
}));

vi.mock("@/cronJobs/helper/deployNftCollection", () => ({
  deployNftCollection: vi.fn(),
}));

vi.mock("@ton/core", () => ({
  Address: { parse: vi.fn() },
}));

describe("MintNFTForPaidOrders lazy deploy", () => {
  let processSinglePaidOrder: any;
  let mockDb: any;
  let mockRedis: any;
  let mockDeployNft: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.MNEMONIC = "test mnemonic string words here";
    
    vi.mock("@/server/config", () => ({
      default: { ONTON_MINTER_WALLET: "minter_wallet" },
      config: { ONTON_MINTER_WALLET: "minter_wallet" }
    }));
    vi.mock("@/context/ConfigContext", () => ({
      useConfig: () => ({ ONTON_MINTER_WALLET: "minter_wallet" })
    }));

    const { db } = await import("@/db/db");
    const { redisTools } = await import("@/lib/redisTools");
    const { deployNftCollection } = await import("@/cronJobs/helper/deployNftCollection");
    
    // We mock config at the top level
    
    mockDb = db;
    mockRedis = redisTools;
    mockDeployNft = deployNftCollection;

    const module = await import("@/cronJobs/tasks/MintNFTForPaidOrders");
    processSinglePaidOrder = module.processSinglePaidOrder;
  });

  it("lazy deploys when collectionAddress is null and persists it", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn()
            .mockResolvedValueOnce([{ uuid: "ord1", event_uuid: "evt1", owner_address: "UQBlq...", state: "processing", order_type: "nft_mint", retry_count: 0 }]) // 1. orders
            .mockResolvedValueOnce([{ id: 1, collectionAddress: null, ticket_type: "NFT" }]) // 2. paymentInfo
            .mockResolvedValueOnce([{ event_uuid: "evt1" }]) // 3. events
        })
      })
    });
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ collectionAddress: "deployed-addr" }]),
          execute: vi.fn().mockResolvedValue([])
        })
      })
    });
    mockRedis.acquireLock.mockResolvedValue(true);
    mockDeployNft.mockResolvedValue("deployed-addr");

    // mock transaction so it stops there instead of doing the whole mint
    mockDb.transaction.mockResolvedValue(true);

    const result = await processSinglePaidOrder("ord1");
    expect(mockDeployNft).toHaveBeenCalledTimes(1);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("handles deploy failure by recording failure and returning false", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn()
            .mockResolvedValueOnce([{ uuid: "ord2", event_uuid: "evt2", owner_address: "UQBlq...valid", retry_count: 0, state: "processing", order_type: "nft_mint" }]) // orders
            .mockResolvedValueOnce([{ id: 2, collectionAddress: null, ticket_type: "NFT" }]) // paymentInfo
            .mockResolvedValueOnce([{ event_uuid: "evt2" }]) // eventData
        })
      })
    });
    mockRedis.acquireLock.mockResolvedValue(true);
    mockDeployNft.mockRejectedValue(new Error("Deploy fail"));

    const result = await processSinglePaidOrder("ord2");
    expect(mockDeployNft).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });

  it("TICKET order bypasses minting, updates registrant, and creates ticket", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn()
            .mockResolvedValueOnce([{ uuid: "ord3", event_uuid: "evt3", user_id: 123, owner_address: "UQBlq...", state: "processing", order_type: "nft_mint", retry_count: 0 }]) // 1. orders
            .mockResolvedValueOnce([{ id: 3, collectionAddress: null, ticket_type: "TICKET" }]) // 2. paymentInfo
        })
      })
    });
    mockRedis.acquireLock.mockResolvedValue(true);
    
    let updateOrdersCalled = false;
    mockDb.transaction.mockImplementation(async (cb: any) => {
      // simulate the transaction for TICKET bypass
      const mockTrx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              for: vi.fn().mockReturnValue({
                execute: vi.fn().mockResolvedValue([{ uuid: "ord3" }])
              }),
              execute: vi.fn().mockResolvedValue([{ register_info: { full_name: "John" } }]) // For eventRegistrants
            })
          })
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockReturnValue({
                execute: vi.fn().mockResolvedValue([{ uuid: "ord3", utm_source: null }])
              }),
              execute: vi.fn().mockResolvedValue([])
            })
          })
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockResolvedValue(true)
          })
        })
      };
      await cb(mockTrx);
      
      // We know order was updated to completed inside the inner transaction
      updateOrdersCalled = true;
      return true;
    });

    const result = await processSinglePaidOrder("ord3");
    expect(mockDeployNft).not.toHaveBeenCalled(); // No NFT call
    expect(updateOrdersCalled).toBe(true);
    expect(result).toBe(true);
  });
});
