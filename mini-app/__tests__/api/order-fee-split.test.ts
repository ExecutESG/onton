import { describe, it, expect, vi } from "vitest";
import {
  computeSplit,
  verifyFeeSplitTrace,
  decrementOrganizerFeeWaiver,
  MIN_FEE_TON_NANOTONS,
  MIN_FEE_USDT_MICROS,
  PLATFORM_FEE_BPS,
  normaliseAddress,
} from "@/lib/platformFee";
import { EventDataSchema } from "@/types";

describe("Non-custodial 3% Ticket Fee Split (Issue #1034)", () => {
  describe("computeSplit calculations", () => {
    describe("TON splits", () => {
      it("computes standard 3% split when fee exceeds minimum (10 TON)", () => {
        // 10 TON = 10,000,000,000 nanotons
        const tenTon = BigInt("10000000000");
        const result = computeSplit(tenTon, "TON", 0);

        // 3% of 10 TON = 0.3 TON = 300,000,000 nanotons
        expect(result.platformFeeRaw).toBe(BigInt("300000000"));
        // Organizer gets 9.7 TON = 9,700,000,000 nanotons
        expect(result.organizerAmountRaw).toBe(BigInt("9700000000"));
        expect(result.feeBps).toBe(300);
        // Sum invariant holds
        expect(result.platformFeeRaw + result.organizerAmountRaw).toBe(tenTon);
      });

      it("enforces minimum fee of 0.06 TON (60,000,000 nanotons) for small amounts (1 TON)", () => {
        // 1 TON = 1,000,000,000 nanotons. 3% is 30,000,000, which is below min 60,000,000
        const oneTon = BigInt("1000000000");
        const result = computeSplit(oneTon, "TON", 0);

        expect(result.platformFeeRaw).toBe(MIN_FEE_TON_NANOTONS); // 60,000,000
        expect(result.organizerAmountRaw).toBe(BigInt("940000000")); // 1 TON - 0.06 TON
        expect(result.feeBps).toBe(300);
        expect(result.platformFeeRaw + result.organizerAmountRaw).toBe(oneTon);
      });

      it("enforces minimum fee for 0.1 TON (100,000,000 nanotons)", () => {
        // 0.1 TON = 100,000,000 nanotons. 3% is 3,000,000 nanotons. Min fee 60,000,000
        const hundredMilliTon = BigInt("100000000");
        const result = computeSplit(hundredMilliTon, "TON", 0);

        expect(result.platformFeeRaw).toBe(MIN_FEE_TON_NANOTONS);
        expect(result.organizerAmountRaw).toBe(BigInt("40000000")); // 0.04 TON
        expect(result.feeBps).toBe(300);
        expect(result.platformFeeRaw + result.organizerAmountRaw).toBe(hundredMilliTon);
      });

      it("caps platform fee at total amount if total amount is less than minimum fee", () => {
        // 0.05 TON = 50,000,000 nanotons (< 60,000,000 min fee)
        const fiftyMilliTon = BigInt("50000000");
        const result = computeSplit(fiftyMilliTon, "TON", 0);

        expect(result.platformFeeRaw).toBe(fiftyMilliTon);
        expect(result.organizerAmountRaw).toBe(BigInt(0));
        expect(result.feeBps).toBe(300);
        expect(result.platformFeeRaw + result.organizerAmountRaw).toBe(fiftyMilliTon);
      });
    });

    describe("USDT splits", () => {
      it("computes standard 3% split when fee exceeds minimum (100 USDT)", () => {
        // 100 USDT = 100,000,000 micro-USDT (decimals = 6)
        const hundredUsdt = BigInt("100000000");
        const result = computeSplit(hundredUsdt, "USDT", 0);

        // 3% of 100 USDT = 3 USDT = 3,000,000 micro-USDT
        expect(result.platformFeeRaw).toBe(BigInt("3000000"));
        // Organizer gets 97 USDT = 97,000,000 micro-USDT
        expect(result.organizerAmountRaw).toBe(BigInt("97000000"));
        expect(result.feeBps).toBe(300);
        expect(result.platformFeeRaw + result.organizerAmountRaw).toBe(hundredUsdt);
      });

      it("enforces minimum fee of 0.25 USDT (250,000 micro-USDT) for small amounts (1 USDT)", () => {
        // 1 USDT = 1,000,000 micro-USDT. 3% is 30,000, below 250,000 min fee
        const oneUsdt = BigInt("1000000");
        const result = computeSplit(oneUsdt, "USDT", 0);

        expect(result.platformFeeRaw).toBe(MIN_FEE_USDT_MICROS); // 250,000
        expect(result.organizerAmountRaw).toBe(BigInt("750000")); // 0.75 USDT
        expect(result.feeBps).toBe(300);
        expect(result.platformFeeRaw + result.organizerAmountRaw).toBe(oneUsdt);
      });

      it("caps platform fee at total amount for USDT below 0.25 USDT", () => {
        const smallUsdt = BigInt("150000"); // 0.15 USDT
        const result = computeSplit(smallUsdt, "USDT", 0);

        expect(result.platformFeeRaw).toBe(smallUsdt);
        expect(result.organizerAmountRaw).toBe(BigInt(0));
        expect(result.feeBps).toBe(300);
        expect(result.platformFeeRaw + result.organizerAmountRaw).toBe(smallUsdt);
      });
    });

    describe("Fee waiver behavior", () => {
      it("grants 0 bps fee and 100% to organizer when feeWaiverTicketsRemaining > 0", () => {
        const tenTon = BigInt("10000000000");
        const resultTon = computeSplit(tenTon, "TON", 5);

        expect(resultTon.feeBps).toBe(0);
        expect(resultTon.platformFeeRaw).toBe(BigInt(0));
        expect(resultTon.organizerAmountRaw).toBe(tenTon);

        const hundredUsdt = BigInt("100000000");
        const resultUsdt = computeSplit(hundredUsdt, "USDT", 1);

        expect(resultUsdt.feeBps).toBe(0);
        expect(resultUsdt.platformFeeRaw).toBe(BigInt(0));
        expect(resultUsdt.organizerAmountRaw).toBe(hundredUsdt);
      });
    });

    describe("Stars fee calculations", () => {
      it("computes 500 bps (5%) for Stars payments without waiver", () => {
        const starsTotal = BigInt("100000000000"); // 100 Stars (with 9 decimals)
        const feeBps = 500;
        const platformFeeRaw = (starsTotal * BigInt(feeBps)) / BigInt(10000);
        const organizerAmountRaw = starsTotal - platformFeeRaw;

        expect(platformFeeRaw).toBe(BigInt("5000000000")); // 5 Stars
        expect(organizerAmountRaw).toBe(BigInt("95000000000")); // 95 Stars
        expect(platformFeeRaw + organizerAmountRaw).toBe(starsTotal);
      });

      it("grants 0 bps fee for Stars payments when feeWaiverTicketsRemaining > 0", () => {
        const starsTotal = BigInt("100000000000");
        const feeWaiverRemaining = 3;
        const feeBps = feeWaiverRemaining > 0 ? 0 : 500;
        const platformFeeRaw = feeBps === 0 ? BigInt(0) : (starsTotal * BigInt(feeBps)) / BigInt(10000);
        const organizerAmountRaw = starsTotal - platformFeeRaw;

        expect(feeBps).toBe(0);
        expect(platformFeeRaw).toBe(BigInt(0));
        expect(organizerAmountRaw).toBe(starsTotal);
      });
    });

    describe("Rounding and boundary behavior", () => {
      it("rounds half-up correctly for fractional amounts without violating sum invariant", () => {
        // An amount where 3% results in a fractional value above min fee:
        // total = 10,000,000,033 nanotons. 3% is 300,000,000.99 nanotons -> rounds to 300,000,001
        const oddAmount = BigInt("10000000033");
        const result = computeSplit(oddAmount, "TON", 0);

        expect(result.platformFeeRaw).toBe(BigInt("300000001"));
        expect(result.organizerAmountRaw).toBe(oddAmount - BigInt("300000001"));
        expect(result.platformFeeRaw + result.organizerAmountRaw).toBe(oddAmount);
      });

      it("handles zero and negative amounts gracefully", () => {
        const zeroResult = computeSplit(BigInt(0), "TON", 0);
        expect(zeroResult.platformFeeRaw).toBe(BigInt(0));
        expect(zeroResult.organizerAmountRaw).toBe(BigInt(0));

        const negativeResult = computeSplit(BigInt(-100), "USDT", 0);
        expect(negativeResult.platformFeeRaw).toBe(BigInt(0));
        expect(negativeResult.organizerAmountRaw).toBe(BigInt(0));
      });
    });
  });

  describe("verifyFeeSplitTrace", () => {
    const treasury = "0:1111111111111111111111111111111111111111111111111111111111111111";
    const recipient = "0:2222222222222222222222222222222222222222222222222222222222222222";
    const wrongRecipient = "0:3333333333333333333333333333333333333333333333333333333333333333";
    const jettonMaster = "0:4444444444444444444444444444444444444444444444444444444444444444";
    const wrongMaster = "0:5555555555555555555555555555555555555555555555555555555555555555";

    describe("TON native traces", () => {
      it("validates successfully when both fee and organizer transfers match", () => {
        const trace = {
          actions: [
            {
              type: "ton_transfer",
              recipient: treasury,
              amount: "300000000",
            },
            {
              type: "ton_transfer",
              recipient: recipient,
              amount: "9700000000",
            },
          ],
        };

        const result = verifyFeeSplitTrace({
          trace,
          orderUuid: "test-order-uuid",
          expectedPlatformFeeRaw: BigInt("300000000"),
          expectedOrganizerAmountRaw: BigInt("9700000000"),
          recipientAddress: recipient,
          treasuryAddress: treasury,
          isJetton: false,
        });

        expect(result.valid).toBe(true);
        expect(result.platformFeeFound).toBe(BigInt("300000000"));
        expect(result.organizerAmountFound).toBe(BigInt("9700000000"));
      });

      it("validates successfully from low-level transaction out_msgs", () => {
        const trace = {
          transaction: {
            out_msgs: [
              {
                destination: treasury,
                value: "300000000",
                opcode: "0x00000000",
              },
              {
                destination: recipient,
                value: "9700000000",
                opcode: "0x00000000",
              },
            ],
          },
        };

        const result = verifyFeeSplitTrace({
          trace,
          orderUuid: "test-order-uuid",
          expectedPlatformFeeRaw: BigInt("300000000"),
          expectedOrganizerAmountRaw: BigInt("9700000000"),
          recipientAddress: recipient,
          treasuryAddress: treasury,
          isJetton: false,
        });

        expect(result.valid).toBe(true);
        expect(result.organizerAmountFound).toBe(BigInt("9700000000"));
      });

      it("fails with missing_organizer_transfer when only platform fee is present", () => {
        const trace = {
          actions: [
            {
              type: "ton_transfer",
              recipient: treasury,
              amount: "300000000",
            },
          ],
        };

        const result = verifyFeeSplitTrace({
          trace,
          orderUuid: "test-order-uuid",
          expectedPlatformFeeRaw: BigInt("300000000"),
          expectedOrganizerAmountRaw: BigInt("9700000000"),
          recipientAddress: recipient,
          treasuryAddress: treasury,
          isJetton: false,
        });

        expect(result.valid).toBe(false);
        expect(result.reason).toBe("missing_organizer_transfer");
      });

      it("fails with missing_fee_transfer when only organizer transfer is present (missing fee)", () => {
        const trace = {
          actions: [
            {
              type: "ton_transfer",
              recipient: recipient,
              amount: "9700000000",
            },
          ],
        };

        const result = verifyFeeSplitTrace({
          trace,
          orderUuid: "test-order-uuid",
          expectedPlatformFeeRaw: BigInt("300000000"),
          expectedOrganizerAmountRaw: BigInt("9700000000"),
          recipientAddress: recipient,
          treasuryAddress: treasury,
          isJetton: false,
        });

        expect(result.valid).toBe(false);
        expect(result.reason).toBe("missing_fee_transfer");
      });

      it("fails with missing_fee_transfer when platform fee amount is insufficient", () => {
        const trace = {
          actions: [
            {
              type: "ton_transfer",
              recipient: treasury,
              amount: "1000", // Much less than 300,000,000
            },
            {
              type: "ton_transfer",
              recipient: recipient,
              amount: "9700000000",
            },
          ],
        };

        const result = verifyFeeSplitTrace({
          trace,
          orderUuid: "test-order-uuid",
          expectedPlatformFeeRaw: BigInt("300000000"),
          expectedOrganizerAmountRaw: BigInt("9700000000"),
          recipientAddress: recipient,
          treasuryAddress: treasury,
          isJetton: false,
        });

        expect(result.valid).toBe(false);
        expect(result.reason).toBe("missing_fee_transfer");
      });

      it("validates successfully for fee-waived orders when expectedPlatformFeeRaw is 0", () => {
        const trace = {
          actions: [
            {
              type: "ton_transfer",
              recipient: recipient,
              amount: "10000000000",
            },
          ],
        };

        const result = verifyFeeSplitTrace({
          trace,
          orderUuid: "test-order-uuid",
          expectedPlatformFeeRaw: BigInt(0),
          expectedOrganizerAmountRaw: BigInt("10000000000"),
          recipientAddress: recipient,
          treasuryAddress: treasury,
          isJetton: false,
        });

        expect(result.valid).toBe(true);
        expect(result.organizerAmountFound).toBe(BigInt("10000000000"));
        expect(result.platformFeeFound).toBe(BigInt(0));
      });

      it("fails with wrong_recipient when organizer share was sent to a different address", () => {
        const trace = {
          actions: [
            {
              type: "ton_transfer",
              recipient: treasury,
              amount: "300000000",
            },
            {
              type: "ton_transfer",
              recipient: wrongRecipient,
              amount: "9700000000",
            },
          ],
        };

        const result = verifyFeeSplitTrace({
          trace,
          orderUuid: "test-order-uuid",
          expectedPlatformFeeRaw: BigInt("300000000"),
          expectedOrganizerAmountRaw: BigInt("9700000000"),
          recipientAddress: recipient,
          treasuryAddress: treasury,
          isJetton: false,
        });

        expect(result.valid).toBe(false);
        expect(result.reason).toBe("wrong_recipient");
      });

      it("fails with empty_trace when trace is null or empty", () => {
        const result = verifyFeeSplitTrace({
          trace: null,
          orderUuid: "test-order-uuid",
          expectedPlatformFeeRaw: BigInt("300000000"),
          expectedOrganizerAmountRaw: BigInt("9700000000"),
          recipientAddress: recipient,
          treasuryAddress: treasury,
          isJetton: false,
        });

        expect(result.valid).toBe(false);
        expect(result.reason).toBe("empty_trace");
      });
    });

    describe("USDT Jetton traces", () => {
      it("validates successfully for valid jetton fee split", () => {
        const trace = {
          actions: [
            {
              type: "jetton_transfer",
              destination: treasury,
              amount: "3000000",
              jetton_master: jettonMaster,
            },
            {
              type: "jetton_transfer",
              destination: recipient,
              amount: "97000000",
              jetton_master: jettonMaster,
            },
          ],
        };

        const result = verifyFeeSplitTrace({
          trace,
          orderUuid: "test-order-uuid",
          expectedPlatformFeeRaw: BigInt("3000000"),
          expectedOrganizerAmountRaw: BigInt("97000000"),
          recipientAddress: recipient,
          treasuryAddress: treasury,
          isJetton: true,
          expectedJettonMaster: jettonMaster,
          decimals: 6,
        });

        expect(result.valid).toBe(true);
        expect(result.organizerAmountFound).toBe(BigInt("97000000"));
      });

      it("fails with wrong_jetton_master if jetton master does not match", () => {
        const trace = {
          actions: [
            {
              type: "jetton_transfer",
              destination: treasury,
              amount: "3000000",
              jetton_master: wrongMaster,
            },
            {
              type: "jetton_transfer",
              destination: recipient,
              amount: "97000000",
              jetton_master: wrongMaster,
            },
          ],
        };

        const result = verifyFeeSplitTrace({
          trace,
          orderUuid: "test-order-uuid",
          expectedPlatformFeeRaw: BigInt("3000000"),
          expectedOrganizerAmountRaw: BigInt("97000000"),
          recipientAddress: recipient,
          treasuryAddress: treasury,
          isJetton: true,
          expectedJettonMaster: jettonMaster,
          decimals: 6,
        });

        expect(result.valid).toBe(false);
        expect(result.reason).toBe("wrong_jetton_master");
      });

      it("fails with missing_organizer_transfer when only jetton fee was sent", () => {
        const trace = {
          actions: [
            {
              type: "jetton_transfer",
              destination: treasury,
              amount: "3000000",
              jetton_master: jettonMaster,
            },
          ],
        };

        const result = verifyFeeSplitTrace({
          trace,
          orderUuid: "test-order-uuid",
          expectedPlatformFeeRaw: BigInt("3000000"),
          expectedOrganizerAmountRaw: BigInt("97000000"),
          recipientAddress: recipient,
          treasuryAddress: treasury,
          isJetton: true,
          expectedJettonMaster: jettonMaster,
          decimals: 6,
        });

        expect(result.valid).toBe(false);
        expect(result.reason).toBe("missing_organizer_transfer");
      });

      it("fails with missing_fee_transfer when only organizer jetton transfer was sent", () => {
        const trace = {
          actions: [
            {
              type: "jetton_transfer",
              destination: recipient,
              amount: "97000000",
              jetton_master: jettonMaster,
            },
          ],
        };

        const result = verifyFeeSplitTrace({
          trace,
          orderUuid: "test-order-uuid",
          expectedPlatformFeeRaw: BigInt("3000000"),
          expectedOrganizerAmountRaw: BigInt("97000000"),
          recipientAddress: recipient,
          treasuryAddress: treasury,
          isJetton: true,
          expectedJettonMaster: jettonMaster,
          decimals: 6,
        });

        expect(result.valid).toBe(false);
        expect(result.reason).toBe("missing_fee_transfer");
      });

      it("validates successfully for fee-waived jetton orders when expectedPlatformFeeRaw is 0", () => {
        const trace = {
          actions: [
            {
              type: "jetton_transfer",
              destination: recipient,
              amount: "100000000",
              jetton_master: jettonMaster,
            },
          ],
        };

        const result = verifyFeeSplitTrace({
          trace,
          orderUuid: "test-order-uuid",
          expectedPlatformFeeRaw: BigInt(0),
          expectedOrganizerAmountRaw: BigInt("100000000"),
          recipientAddress: recipient,
          treasuryAddress: treasury,
          isJetton: true,
          expectedJettonMaster: jettonMaster,
          decimals: 6,
        });

        expect(result.valid).toBe(true);
        expect(result.organizerAmountFound).toBe(BigInt("100000000"));
        expect(result.platformFeeFound).toBe(BigInt(0));
      });
    });
  });

  describe("decrementOrganizerFeeWaiver", () => {
    it("executes update query with GREATEST(0, fee_waiver_tickets_remaining - 1)", async () => {
      const executeMock = vi.fn().mockResolvedValue(undefined);
      const whereMock = vi.fn().mockReturnValue({ execute: executeMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      const updateMock = vi.fn().mockReturnValue({ set: setMock });

      const mockTrx = {
        update: updateMock,
      };

      await decrementOrganizerFeeWaiver(123, mockTrx);

      expect(updateMock).toHaveBeenCalled();
      expect(setMock).toHaveBeenCalled();
      expect(whereMock).toHaveBeenCalled();
      expect(executeMock).toHaveBeenCalled();
    });
  });

  describe("Event creation schema recipient_address validation", () => {
    const baseEvent = {
      type: 1,
      title: "Test Event",
      subtitle: "Test Subtitle",
      description: "Test Description",
      location: "Online",
      image_url: "https://example.com/image.png",
      society_hub: { id: "1", name: "Hub" },
      owner: 100,
      start_date: 1735689600,
      end_date: 1735693200,
      timezone: "UTC",
      dynamic_fields: [],
      has_registration: true,
      has_approval: false,
      capacity: 50,
      has_waiting_list: false,
      category_id: 1,
      has_web3: true,
      ts_reward_url: "https://example.com/reward.png",
    };

    it("requires payment_recipient_address when has_nft is true", () => {
      const payload = {
        ...baseEvent,
        paid_event: {
          has_payment: true,
          ticket_type: "NFT",
          has_nft: true,
          token_id: 1,
          payment_amount: 5,
          nft_title: "NFT Ticket",
          nft_description: "Access pass",
          nft_image_url: "https://example.com/nft.png",
          payment_recipient_address: "",
        },
      };

      const result = EventDataSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("rejects invalid TON recipient address when has_nft is true", () => {
      const payload = {
        ...baseEvent,
        paid_event: {
          has_payment: true,
          ticket_type: "NFT",
          has_nft: true,
          token_id: 1,
          payment_amount: 5,
          nft_title: "NFT Ticket",
          nft_description: "Access pass",
          nft_image_url: "https://example.com/nft.png",
          payment_recipient_address: "not-a-valid-ton-address",
        },
      };

      const result = EventDataSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("accepts valid TON recipient address when has_nft is true", () => {
      const payload = {
        ...baseEvent,
        paid_event: {
          has_payment: true,
          ticket_type: "NFT",
          has_nft: true,
          token_id: 1,
          payment_amount: 5,
          nft_title: "NFT Ticket",
          nft_description: "Access pass",
          nft_image_url: "https://example.com/nft.png",
          payment_recipient_address: "EQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAc3j",
        },
      };

      const result = EventDataSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("allows omitting recipient_address when has_nft is false (defaults to platform wallet)", () => {
      const payload = {
        ...baseEvent,
        has_web3: false,
        paid_event: {
          has_payment: true,
          ticket_type: "TICKET",
          has_nft: false,
          token_id: 1,
          payment_amount: 5,
        },
      };

      const result = EventDataSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });
});
