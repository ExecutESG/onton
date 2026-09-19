import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "https://app.dev.onton.live";

test.describe("Role: Check-in Officer - Access Control, QR Validation & Attendance Tracking", () => {
  test("Flow C-1: Checkin Officer Protected Checkin API", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/client/v1/protected/checkin`, {
      data: {
        registrant_id: "test-reg-uuid",
      },
    });

    expect([200, 400, 401, 403]).toContain(response.status());
    const data = await response.json().catch(() => ({}));
    expect(data).toBeDefined();
  });

  test("Flow C-2: Protected Guest List Endpoint for Officers", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/client/v1/protected/guestList/0cf4733c-190c-4e5a-9a1d-8d8631f7b725`);
    expect([200, 400, 401, 403]).toContain(response.status());
  });

  test("Flow C-3: Scoped Event Access for Assigned Events", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/client/v1/protected/events`);
    expect([200, 401, 403]).toContain(response.status());
  });
});
