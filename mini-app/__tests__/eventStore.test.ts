import { describe, it, expect, beforeEach } from "vitest";
import { useCreateEventStore } from "../src/zustand/createEventStore";
import { EventDataSchema } from "../src/types";

describe("createEventStore paid/web3 behavior", () => {
  beforeEach(() => {
    useCreateEventStore.getState().resetState();
  });

  it("toggle Paid with Web3 off -> has_web3 stays false, ticket_type = TICKET", () => {
    const store = useCreateEventStore.getState();
    expect(store.eventData.has_web3).toBe(false);
    
    store.togglePaidEvent();
    
    const updatedStore = useCreateEventStore.getState();
    expect(updatedStore.eventData.has_web3).toBe(false);
    expect(updatedStore.eventData.paid_event.has_payment).toBe(true);
    expect(updatedStore.eventData.paid_event.ticket_type).toBe("TICKET");
    expect(updatedStore.eventData.paid_event.has_nft).toBe(false);
  });

  it("Paid on, then Web3 off -> Paid stays on, ticket_type becomes TICKET, NFT fields cleared", () => {
    const store = useCreateEventStore.getState();
    
    // Web3 on first
    store.toggleHasWeb3();
    store.togglePaidEvent();
    
    let updatedStore = useCreateEventStore.getState();
    expect(updatedStore.eventData.has_web3).toBe(true);
    expect(updatedStore.eventData.paid_event.has_payment).toBe(true);
    expect(updatedStore.eventData.paid_event.ticket_type).toBe("NFT");
    
    // Set some NFT fields
    updatedStore.changeNFTTitle("My NFT");
    updatedStore.changeNFTImage("http://example.com/image.png");
    
    // Turn Web3 off
    updatedStore.toggleHasWeb3();
    
    const finalStore = useCreateEventStore.getState();
    expect(finalStore.eventData.has_web3).toBe(false);
    expect(finalStore.eventData.paid_event.has_payment).toBe(true);
    expect(finalStore.eventData.paid_event.ticket_type).toBe("TICKET");
    expect(finalStore.eventData.paid_event.has_nft).toBe(false);
    expect(finalStore.eventData.paid_event.nft_title).toBeUndefined();
    expect(finalStore.eventData.paid_event.nft_image_url).toBeUndefined();
  });

  it("Web3 on + Paid -> NFT (no regression)", () => {
    const store = useCreateEventStore.getState();
    
    store.toggleHasWeb3();
    store.togglePaidEvent();
    
    const updatedStore = useCreateEventStore.getState();
    expect(updatedStore.eventData.has_web3).toBe(true);
    expect(updatedStore.eventData.paid_event.has_payment).toBe(true);
    expect(updatedStore.eventData.paid_event.ticket_type).toBe("NFT");
    expect(updatedStore.eventData.paid_event.has_nft).toBe(true);
  });
});

describe("EventDataSchema accepts Web3-off TICKET payload", () => {
  it("validates payload without NFT fields for TICKET", () => {
    const payload = {
      type: 1,
      title: "Test",
      subtitle: "Sub",
      description: "Desc",
      location: "Loc",
      image_url: "https://telegra.ph/test",
      society_hub: { id: "1", name: "Hub" },
      owner: 1,
      start_date: Date.now() / 1000 + 1000,
      end_date: Date.now() / 1000 + 5000,
      timezone: "UTC",
      dynamic_fields: [],
      has_registration: true,
      has_approval: false,
      capacity: 50,
      has_waiting_list: false,
      category_id: 1,
      has_web3: false,
      paid_event: {
        has_payment: true,
        ticket_type: "TICKET",
        has_nft: false,
        token_id: 1,
        payment_amount: 10,
        // no recipient address because it's optional and we skip validate if has_nft = false
      }
    };
    
    const result = EventDataSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
