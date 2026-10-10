import { describe, it, expect, vi } from "vitest";
import { GET } from "../../src/app/api/v1/share-event/route";
import axios from "axios";
import { NextRequest } from "next/server";

vi.mock("axios");

describe("share-event", () => {
  it("web_app url has no /ptma", async () => {
    process.env.BOT_API_HMAC_SECRET = "test-share-event-hmac-secret-0123456789abcdef";
    const req = new NextRequest("http://localhost/api/v1/share-event?user_id=123&event_uuid=abc");
    
    (axios.post as any).mockResolvedValue({ data: {} });
    
    await GET(req);
    
    expect(axios.post).toHaveBeenCalled();
    const callBody = (axios.post as any).mock.calls[0][1];
    
    expect(callBody.url).not.toContain("/ptma/");
    expect(callBody.url).toContain("/events/abc");
  });
});
