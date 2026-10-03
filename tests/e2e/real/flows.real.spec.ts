import { expect, request, test, APIRequestContext } from "@playwright/test";
import { signTelegramInitData } from "../helpers/initDataSigner";
import { TRPCClient } from "../helpers/trpcClient";
import { loadEnvTest, requireEnv } from "../helpers/envTest";

loadEnvTest();

/**
 * Core release flows against STAGING, using persistent fixtures reset by global-setup:
 *   InPerson  (registration, auto-approve, in_person)  -> register, permissions, check-in, web3 toggle
 *   Approval  (registration, approval required)        -> pending -> organizer approves
 *   Report    (hidden)                                 -> hidden-access rule, report + duplicate
 * Side effects per run: 1 moderation-group alert (report), up to 2 bot DMs to the attendee test account.
 */

interface EventView {
  event_uuid: string;
  owner: number;
  title: string;
  subtitle: string;
  description: string;
  location: string;
  type: number;
  image_url: string;
  start_date: number;
  end_date: number;
  timezone: string;
  participationType: "online" | "in_person";
  has_registration: boolean;
  has_approval: boolean;
  has_waiting_list: boolean;
  capacity: number | null;
  category_id: number;
  has_web3: boolean;
  registrant_status: "" | "pending" | "rejected" | "approved" | "checkedin";
  registrant_uuid: string;
}

interface Registrant {
  user_id: number;
  status: "pending" | "rejected" | "approved" | "checkedin";
}

interface PassToken {
  token: string;
  uuid: string;
  epochStep: number;
  stepSeconds: number;
}

const baseURL = requireEnv("BASE_URL");
const botToken = requireEnv("STAGING_BOT_TOKEN");
const organizerId = Number(requireEnv("E2E_ORGANIZER_TG_ID"));
const attendeeId = Number(requireEnv("E2E_ATTENDEE_TG_ID"));
const officerId = Number(requireEnv("E2E_OFFICER_TG_ID"));
const inPersonUuid = requireEnv("E2E_FIXTURE_INPERSON_UUID");
const approvalUuid = requireEnv("E2E_FIXTURE_APPROVAL_UUID");
const reportUuid = requireEnv("E2E_FIXTURE_REPORT_UUID");

const REGISTER_INFO = { full_name: "QA E2E Attendee", company: "QA E2E", position: "Tester" };

let context: APIRequestContext;
let organizer: TRPCClient;
let attendee: TRPCClient;
let officer: TRPCClient;
let inPersonRegistrantUuid = "";

async function getEvent(client: TRPCClient, eventUuid: string): Promise<EventView> {
  const response = await client.query<EventView>("events.getEvent", { event_uuid: eventUuid });
  expect(response.status, response.errorMessage).toBe(200);
  expect(response.data).toBeDefined();
  return response.data as EventView;
}

async function registrantStatus(eventUuid: string, userId: number): Promise<Registrant["status"] | undefined> {
  const response = await organizer.query<{ registrants: Registrant[] }>("registrant.getEventRegistrants", {
    event_uuid: eventUuid,
    limit: 50,
  });
  expect(response.status, response.errorMessage).toBe(200);
  return response.data?.registrants.find((row) => row.user_id === userId)?.status;
}

function updatePayload(event: EventView, hasWeb3: boolean): Record<string, unknown> {
  return {
    event_uuid: event.event_uuid,
    eventData: {
      event_uuid: event.event_uuid,
      type: event.type,
      title: event.title,
      subtitle: event.subtitle,
      description: event.description,
      location: event.location,
      eventLocationType: event.participationType,
      image_url: event.image_url,
      ts_reward_url: event.image_url,
      has_web3: hasWeb3,
      owner: event.owner,
      start_date: event.start_date,
      end_date: event.end_date,
      timezone: event.timezone,
      dynamic_fields: [],
      has_approval: event.has_approval,
      capacity: event.capacity,
      has_waiting_list: event.has_waiting_list,
      category_id: event.category_id,
    },
  };
}

test.beforeAll(async () => {
  context = await request.newContext({ baseURL });
  organizer = new TRPCClient(context, baseURL, signTelegramInitData({ id: organizerId, first_name: "ontonadmin", username: "ontonadmin" }, botToken));
  attendee = new TRPCClient(context, baseURL, signTelegramInitData({ id: attendeeId, first_name: "challenquizer", username: "challenquizer" }, botToken));
  officer = new TRPCClient(context, baseURL, signTelegramInitData({ id: officerId, first_name: "Mfarimani", username: "Mfarimani" }, botToken));
});

test.afterAll(async () => {
  await context.dispose();
});

test.describe.serial("Organizer", () => {
  test("fixture event is readable by its organizer with expected settings", async () => {
    const event = await getEvent(organizer, inPersonUuid);
    expect(event.owner).toBe(organizerId);
    expect(event.has_registration).toBe(true);
    expect(event.has_approval).toBe(false);
    expect(event.participationType).toBe("in_person");
    expect(event.has_web3).toBe(false);
  });

  test("web3 toggle persists on and off (has_web3, migration 0127)", async () => {
    const before = await getEvent(organizer, inPersonUuid);

    const on = await organizer.mutation<unknown>("events.updateEvent", updatePayload(before, true));
    expect(on.status, on.errorMessage).toBe(200);
    expect((await getEvent(organizer, inPersonUuid)).has_web3).toBe(true);

    const off = await organizer.mutation<unknown>("events.updateEvent", updatePayload(before, false));
    expect(off.status, off.errorMessage).toBe(200);
    expect((await getEvent(organizer, inPersonUuid)).has_web3).toBe(false);
  });
});

test.describe.serial("Attendee registration + permissions + check-in", () => {
  test("attendee registers for an auto-approve event and is approved", async () => {
    const response = await attendee.mutation<{ status: string; code: number }>("registrant.eventRegister", {
      event_uuid: inPersonUuid,
      ...REGISTER_INFO,
    });
    expect(response.status, response.errorMessage).toBe(200);
    expect(response.data?.status).toBe("approved");

    const view = await getEvent(attendee, inPersonUuid);
    expect(view.registrant_status).toBe("approved");
    expect(view.registrant_uuid).toMatch(/^[0-9a-f-]{36}$/);
    inPersonRegistrantUuid = view.registrant_uuid;
    expect(await registrantStatus(inPersonUuid, attendeeId)).toBe("approved");
  });

  test("registering twice is rejected with CONFLICT", async () => {
    const response = await attendee.mutation<unknown>("registrant.eventRegister", { event_uuid: inPersonUuid, ...REGISTER_INFO });
    expect(response.errorCode).toBe("CONFLICT");
  });

  test("attendee cannot edit someone else's event", async () => {
    const event = await getEvent(organizer, inPersonUuid);
    const response = await attendee.mutation<unknown>("events.updateEvent", { ...updatePayload(event, false), eventData: { ...(updatePayload(event, false).eventData as Record<string, unknown>), title: "QA-E2E-HIJACK" } });
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(response.errorCode);
    expect((await getEvent(organizer, inPersonUuid)).title).toBe("QA-E2E-FIXTURE-InPerson");
  });

  test("attendee cannot list registrants or approve requests", async () => {
    const list = await attendee.query<unknown>("registrant.getEventRegistrants", { event_uuid: inPersonUuid, limit: 5 });
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(list.errorCode);
    const approve = await attendee.mutation<unknown>("registrant.processRegistrantRequest", {
      event_uuid: approvalUuid,
      user_id: attendeeId,
      status: "approved",
    });
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(approve.errorCode);
  });

  test("attendee cannot check themselves in", async () => {
    const pass = await attendee.query<PassToken>("registrant.getRegistrantQrToken", { registrant_uuid: inPersonRegistrantUuid });
    expect(pass.status).toBe(200);
    const response = await attendee.mutation<unknown>("registrant.checkinRegistrantRequest", {
      event_uuid: inPersonUuid,
      registrant_uuid: pass.data?.token,
    });
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(response.errorCode);
    expect(await registrantStatus(inPersonUuid, attendeeId)).toBe("approved");
  });

  test("pass token is issued only to the pass owner (F-24)", async () => {
    const response = await organizer.query<PassToken>("registrant.getRegistrantQrToken", { registrant_uuid: inPersonRegistrantUuid });
    expect(response.errorCode).toBe("NOT_FOUND");
  });

  test("officer: static registrant UUID is rejected (F-24)", async () => {
    const response = await officer.mutation<unknown>("registrant.checkinRegistrantRequest", {
      event_uuid: inPersonUuid,
      registrant_uuid: inPersonRegistrantUuid,
    });
    expect(response.errorCode).toBe("BAD_REQUEST");
    expect(await registrantStatus(inPersonUuid, attendeeId)).toBe("approved");
  });

  test("attendee cannot use ticket scan or ticket check-in (F-25)", async () => {
    const scan = await attendee.query<unknown>("ticket.getTicketByUuid", { event_uuid: inPersonUuid, ticketUuid: inPersonRegistrantUuid });
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(scan.errorCode);
    const checkIn = await attendee.mutation<unknown>("ticket.checkInTicket", { event_uuid: inPersonUuid, ticketUuid: inPersonRegistrantUuid });
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(checkIn.errorCode);
    expect(await registrantStatus(inPersonUuid, attendeeId)).toBe("approved");
  });

  test("officer: forged pass signature is rejected", async () => {
    const pass = await attendee.query<PassToken>("registrant.getRegistrantQrToken", { registrant_uuid: inPersonRegistrantUuid });
    const token = pass.data?.token ?? "";
    const signature = token.split(":")[4] ?? "";
    const forged = `${token.slice(0, token.length - signature.length)}${signature.startsWith("0") ? "1" : "0"}${signature.slice(1)}`;
    const response = await officer.mutation<unknown>("registrant.checkinRegistrantRequest", { event_uuid: inPersonUuid, registrant_uuid: forged });
    expect(response.errorCode).toBe("BAD_REQUEST");
    expect(response.errorMessage ?? "").toMatch(/signature|forged/i);
    expect(await registrantStatus(inPersonUuid, attendeeId)).toBe("approved");
  });

  test("officer: expired pass (screenshot older than the window) is rejected", async () => {
    const pass = await attendee.query<PassToken>("registrant.getRegistrantQrToken", { registrant_uuid: inPersonRegistrantUuid });
    const data = pass.data as PassToken;
    const oldStep = data.epochStep - 10;
    const expired = `ONTON:v1:${data.uuid}:${oldStep}:${"0".repeat(16)}`;
    const response = await officer.mutation<unknown>("registrant.checkinRegistrantRequest", { event_uuid: inPersonUuid, registrant_uuid: expired });
    expect(response.errorCode).toBe("BAD_REQUEST");
    expect(response.errorMessage ?? "").toMatch(/expired/i);
  });

  test("officer checks the attendee in with a fresh rotating pass", async () => {
    const pass = await attendee.query<PassToken>("registrant.getRegistrantQrToken", { registrant_uuid: inPersonRegistrantUuid });
    expect(pass.data?.token).toMatch(/^ONTON:v1:/);
    const response = await officer.mutation<{ code: number; message: string }>("registrant.checkinRegistrantRequest", {
      event_uuid: inPersonUuid,
      registrant_uuid: pass.data?.token,
    });
    expect(response.status, response.errorMessage).toBe(200);
    expect(response.data?.code).toBe(200);
    expect(await registrantStatus(inPersonUuid, attendeeId)).toBe("checkedin");
    expect((await getEvent(attendee, inPersonUuid)).registrant_status).toBe("checkedin");
  });

  test("second check-in is idempotent", async () => {
    const pass = await attendee.query<PassToken>("registrant.getRegistrantQrToken", { registrant_uuid: inPersonRegistrantUuid });
    const response = await officer.mutation<{ code: number; message: string }>("registrant.checkinRegistrantRequest", {
      event_uuid: inPersonUuid,
      registrant_uuid: pass.data?.token,
    });
    expect(response.status, response.errorMessage).toBe(200);
    expect(response.data?.message).toMatch(/already/i);
  });

  test("non-admin cannot mint SBTs manually (F-29)", async () => {
    const response = await attendee.mutation<unknown>("sbt.mintBadge", {
      eventUuid: inPersonUuid,
      walletAddress: "QA-E2E-NOT-A-WALLET",
    });
    expect(["FORBIDDEN", "UNAUTHORIZED"]).toContain(response.errorCode);
  });

  test("only the ticket owner can claim its SBT (F-29)", async () => {
    const response = await organizer.mutation<unknown>("sbt.claimAttendanceSbt", {
      ticketUuid: inPersonRegistrantUuid,
      walletAddress: "QA-E2E-NOT-A-WALLET",
    });
    expect(response.errorCode).toBe("NOT_FOUND");
  });

  test("auth link rejects unproven wallet and Google identities (F-26)", async () => {
    const attendeeInitData = signTelegramInitData({ id: attendeeId, first_name: "challenquizer", username: "challenquizer" }, botToken);
    for (const body of [
      { provider: "ton_wallet", data: { address: "QA-E2E-NOT-A-WALLET" } },
      { provider: "google", data: { sub: "qa-e2e-fake-sub" } },
    ]) {
      const response = await context.post(`${baseURL}/api/v1/auth/link`, {
        headers: { Authorization: attendeeInitData, "Content-Type": "application/json" },
        data: body,
      });
      expect(response.status(), `${body.provider} link must be rejected`).toBe(400);
    }
  });
});

test.describe.serial("Approval-gated registration", () => {
  test("registration on an approval event is pending and hides the pass", async () => {
    const response = await attendee.mutation<{ status: string }>("registrant.eventRegister", { event_uuid: approvalUuid, ...REGISTER_INFO });
    expect(response.status, response.errorMessage).toBe(200);
    expect(response.data?.status).toBe("pending");
    const view = await getEvent(attendee, approvalUuid);
    expect(view.registrant_status).toBe("pending");
    expect(view.registrant_uuid).toBe("");
  });

  test("organizer approves and the attendee sees approved + a pass", async () => {
    const response = await organizer.mutation<{ code: number }>("registrant.processRegistrantRequest", {
      event_uuid: approvalUuid,
      user_id: attendeeId,
      status: "approved",
    });
    expect(response.status, response.errorMessage).toBe(200);
    expect(await registrantStatus(approvalUuid, attendeeId)).toBe("approved");
    const view = await getEvent(attendee, approvalUuid);
    expect(view.registrant_status).toBe("approved");
    expect(view.registrant_uuid).toMatch(/^[0-9a-f-]{36}$/);
  });
});

test.describe.serial("Moderation / reports (migration 0126)", () => {
  test("hidden event is not viewable by a regular user", async () => {
    const response = await attendee.query<EventView>("events.getEvent", { event_uuid: reportUuid });
    expect(response.errorCode).toBe("UNPROCESSABLE_CONTENT");
  });

  test("report on a non-existent event is NOT_FOUND", async () => {
    const response = await attendee.mutation<unknown>("events.reportEvent", {
      event_uuid: "00000000-0000-4000-8000-000000000000",
      reason: "spam",
    });
    expect(response.errorCode).toBe("NOT_FOUND");
  });

  test("attendee reports an event once; duplicate is rejected", async () => {
    const first = await attendee.mutation<{ success: boolean; quarantined: boolean; totalReports: number }>("events.reportEvent", {
      event_uuid: reportUuid,
      reason: "spam",
      notes: "QA-E2E automated report (staging)",
    });
    expect(first.status, first.errorMessage).toBe(200);
    expect(first.data?.success).toBe(true);
    expect(first.data?.quarantined).toBe(false);
    expect(first.data?.totalReports).toBe(1);

    const duplicate = await attendee.mutation<unknown>("events.reportEvent", { event_uuid: reportUuid, reason: "spam" });
    expect(duplicate.errorCode).toBe("CONFLICT");
  });
});
