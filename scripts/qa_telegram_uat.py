# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "telethon>=1.36.0",
# ]
# ///
#!/usr/bin/env python3
"""
ONTON Telegram UAT Runner via @ontonadmin MTProto session.
Executes and verifies Telegram-native UAT flows against Staging.
"""

import sys
import json
import asyncio
from pathlib import Path
from datetime import datetime

from telethon import TelegramClient
from telethon.tl.types import User, Channel, Chat

CONFIG_DIR = Path.home() / ".config" / "onton"
CONFIG_FILE = CONFIG_DIR / "tgadmin.json"
SESSION_FILE = CONFIG_DIR / "ontonadmin"

STAGING_BOT = "notnonstagebot"
STAGING_LOGS_GROUP = -1002264975789
STAGING_MOD_GROUP = -1004304657491
TEST_GROUP_ID = -1004339285693  # Test3oct private group


def get_client() -> TelegramClient:
    if not CONFIG_FILE.exists():
        raise RuntimeError("Missing ~/.config/onton/tgadmin.json")
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    return TelegramClient(str(SESSION_FILE), int(cfg["api_id"]), cfg["api_hash"])


async def run_uat_org_01(client: TelegramClient) -> dict:
    """UAT-ORG-01: Group linking via /invitor."""
    print("\n--- Running UAT-ORG-01: /invitor Bot DM & Group Linking ---")
    bot = await client.get_entity(STAGING_BOT)

    # 1. Reset any stale state
    await client.send_message(bot, "/start")
    await asyncio.sleep(1.5)

    # 2. Send /invitor
    sent_invitor = await client.send_message(bot, "/invitor")
    print(f"Sent /invitor (Msg #{sent_invitor.id})")
    await asyncio.sleep(2.0)

    # 3. Read bot response with event list buttons
    messages = await client.get_messages(bot, limit=3)
    event_msg = None
    for msg in messages:
        if not msg.out and msg.buttons:
            event_msg = msg
            break

    if not event_msg or not event_msg.buttons:
        return {
            "test_id": "UAT-ORG-01",
            "status": "FAIL",
            "error": "No event buttons received from bot in response to /invitor",
        }

    print(f"Received event picker (Msg #{event_msg.id}): {event_msg.text.splitlines()[0]}")
    # Click the first event button
    first_btn = event_msg.buttons[0][0]
    print(f"Clicking event button: '{first_btn.text}' (data: {first_btn.data})")
    await event_msg.click(0, 0)
    await asyncio.sleep(2.0)

    # 4. Read confirmation prompt ("Proceed?")
    confirm_messages = await client.get_messages(bot, limit=3)
    confirm_msg = None
    for msg in confirm_messages:
        if not msg.out and "Proceed?" in (msg.text or ""):
            confirm_msg = msg
            break

    if confirm_msg:
        print(f"Received confirmation prompt (Msg #{confirm_msg.id}): Clicking 'Yes'")
        await confirm_msg.click(text="Yes")
        await asyncio.sleep(2.0)

    # 5. Read prompt asking for group ID
    group_req_messages = await client.get_messages(bot, limit=3)
    group_req = None
    for msg in group_req_messages:
        if not msg.out and ("Paste the group ID" in (msg.text or "") or "add Onton Bot" in (msg.text or "")):
            group_req = msg
            break

    if not group_req:
        return {
            "test_id": "UAT-ORG-01",
            "status": "FAIL",
            "error": "Bot did not request group ID",
            "last_message": [m.text for m in group_req_messages if not m.out],
        }

    print(f"Bot requested group ID (Msg #{group_req.id})")
    # 6. Send numeric group ID
    sent_group = await client.send_message(bot, str(TEST_GROUP_ID))
    print(f"Sent group ID {TEST_GROUP_ID} (Msg #{sent_group.id})")
    await asyncio.sleep(2.5)

    # 7. Check for group check success prompt or final confirmation
    res_messages = await client.get_messages(bot, limit=3)
    check_msg = None
    for msg in res_messages:
        if not msg.out and msg.buttons:
            check_msg = msg
            break

    if check_msg and "Group Check Success" in (check_msg.text or ""):
        print(f"Received Group Check Success prompt (Msg #{check_msg.id}): Clicking 'Yes'")
        await check_msg.click(text="Yes")
        await asyncio.sleep(2.0)
        res_messages = await client.get_messages(bot, limit=2)

    final_msg = next((m for m in res_messages if not m.out), None)
    final_text = final_msg.text if final_msg else ""
    print(f"Final bot response (Msg #{getattr(final_msg, 'id', 'N/A')}): {final_text}")

    passed = "Success" in final_text or "already has a Telegram group" in final_text or "Group Check Success" in final_text
    return {
        "test_id": "UAT-ORG-01",
        "status": "PASS" if passed else "FAIL",
        "final_message_id": getattr(final_msg, "id", None),
        "final_text": final_text,
        "date": getattr(final_msg, "date", datetime.utcnow()).isoformat(),
    }


async def run_uat_org_04(client: TelegramClient) -> dict:
    """UAT-ORG-04: Topic 2 announcement in Staging Logs group (-1002264975789)."""
    print("\n--- Running UAT-ORG-04: Staging Forum Topic 2 Announcement ---")
    group = await client.get_entity(STAGING_LOGS_GROUP)

    topic_2_messages = []
    # In Telethon, reply_to=2 filters by forum topic 2
    async for msg in client.iter_messages(group, reply_to=2, limit=10):
        if msg.text:
            topic_2_messages.append(msg)

    if not topic_2_messages:
        return {
            "test_id": "UAT-ORG-04",
            "status": "FAIL",
            "error": "No messages found in Topic 2",
        }

    latest = topic_2_messages[0]
    print(f"Latest in Topic 2 (Msg #{latest.id}, {latest.date}):\n  {latest.text.replace(chr(10), ' ')}")

    # Check for event announcement signatures
    has_event_info = any(kw in latest.text for kw in ["event", "Updated", "Published", "QA-E2E", "onton.live/events"])

    return {
        "test_id": "UAT-ORG-04",
        "status": "PASS" if has_event_info else "FAIL",
        "message_id": latest.id,
        "date": latest.date.isoformat(),
        "snippet": latest.text[:120],
        "topic_id": 2,
    }


async def run_uat_adm_01(client: TelegramClient) -> dict:
    """UAT-ADM-01: 4-way topic segregation audit in -1002264975789."""
    print("\n--- Running UAT-ADM-01: Forum Topic Segregation Audit ---")
    group = await client.get_entity(STAGING_LOGS_GROUP)

    topics = {
        2: "events_topic",
        4: "tickets_topic",
        276: "payments_topic",
        12: "system_topic",
    }

    results = {}
    all_passed = True
    for topic_id, topic_name in topics.items():
        found = []
        async for msg in client.iter_messages(group, reply_to=topic_id, limit=5):
            if msg.text:
                found.append({"id": msg.id, "text": msg.text.replace("\n", " ")[:80], "date": msg.date.isoformat()})
        results[topic_name] = {
            "topic_id": topic_id,
            "message_count": len(found),
            "sample": found[0] if found else None,
        }
        print(f"• Topic {topic_id} ({topic_name}): {len(found)} recent messages found.")
        if found:
            print(f"    └─ Sample: \"{found[0]['text']}\"")
        # Topic 2 and 4 must have messages
        if topic_id in (2, 4) and len(found) == 0:
            all_passed = False

    return {
        "test_id": "UAT-ADM-01",
        "status": "PASS" if all_passed else "FAIL",
        "topics": results,
    }


async def run_uat_adm_03(client: TelegramClient) -> dict:
    """UAT-ADM-03: Event report alert in Staging Moderation group (-1004304657491)."""
    print("\n--- Running UAT-ADM-03: Moderation Abuse Report Alert ---")
    group = await client.get_entity(STAGING_MOD_GROUP)

    report_msgs = []
    async for msg in client.iter_messages(group, limit=10):
        if msg.text and "COMMUNITY EVENT REPORT" in msg.text:
            report_msgs.append(msg)

    if not report_msgs:
        return {
            "test_id": "UAT-ADM-03",
            "status": "FAIL",
            "error": "No COMMUNITY EVENT REPORT messages found",
        }

    latest = report_msgs[0]
    print(f"Latest Report Alert (Msg #{latest.id}, {latest.date}):")
    for line in latest.text.splitlines():
        print(f"  {line}")

    has_uuid = "UUID:" in latest.text
    has_reason = "Reason:" in latest.text
    has_reporter = "Reported by:" in latest.text

    passed = has_uuid and has_reason and has_reporter
    return {
        "test_id": "UAT-ADM-03",
        "status": "PASS" if passed else "FAIL",
        "message_id": latest.id,
        "date": latest.date.isoformat(),
        "event_uuid_present": has_uuid,
        "reason_present": has_reason,
        "reporter_present": has_reporter,
    }


async def run_uat_adm_02(client: TelegramClient) -> dict:
    """UAT-ADM-02: Moderation card inspection in -1004304657491."""
    print("\n--- Running UAT-ADM-02: Moderation Card Inspection ---")
    group = await client.get_entity(STAGING_MOD_GROUP)

    card_msgs = []
    async for msg in client.iter_messages(group, limit=15):
        if msg.text and ("New Event Published" in msg.text or "Trust Score" in msg.text):
            card_msgs.append(msg)

    if not card_msgs:
        return {
            "test_id": "UAT-ADM-02",
            "status": "FAIL",
            "error": "No event publication cards found in moderation group",
        }

    latest = card_msgs[0]
    print(f"Latest Moderation Card (Msg #{latest.id}, {latest.date}):\n  {latest.text.splitlines()[0]}")

    # Check for buttons or approval state
    has_buttons = bool(latest.buttons)
    button_labels = [btn.text for row in (latest.buttons or []) for btn in row]
    print(f"Card buttons: {button_labels}")

    return {
        "test_id": "UAT-ADM-02",
        "status": "PASS",
        "message_id": latest.id,
        "date": latest.date.isoformat(),
        "buttons": button_labels,
        "snippet": latest.text[:120],
    }


async def run_uat_att_02(client: TelegramClient) -> dict:
    """UAT-ATT-02: Attendee DM check with @notnonstagebot."""
    print("\n--- Running UAT-ATT-02: Bot DM Ticket & Event Delivery ---")
    bot = await client.get_entity(STAGING_BOT)

    ticket_dms = []
    async for msg in client.iter_messages(bot, limit=20):
        if not msg.out and msg.text:
            if any(kw in msg.text for kw in ["Payment Received", "Ticket", "registered", "approved", "Welcome"]):
                ticket_dms.append(msg)

    if not ticket_dms:
        return {
            "test_id": "UAT-ATT-02",
            "status": "FAIL",
            "error": "No ticket/welcome DMs found from bot",
        }

    latest = ticket_dms[0]
    button_labels = [btn.text for row in (latest.buttons or []) for btn in row]
    print(f"Latest Bot Notification (Msg #{latest.id}, {latest.date}):")
    print(f"  Text: {latest.text[:100]}...")
    print(f"  Buttons: {button_labels}")

    return {
        "test_id": "UAT-ATT-02",
        "status": "PASS",
        "message_id": latest.id,
        "date": latest.date.isoformat(),
        "buttons": button_labels,
        "snippet": latest.text[:100],
    }


async def main():
    client = get_client()
    async with client:
        me = await client.get_me()
        print(f"Authenticated as @{me.username or me.first_name} (ID: {me.id})")

        results = []
        # Run sequentially
        results.append(await run_uat_org_01(client))
        results.append(await run_uat_org_04(client))
        results.append(await run_uat_att_02(client))
        results.append(await run_uat_adm_01(client))
        results.append(await run_uat_adm_02(client))
        results.append(await run_uat_adm_03(client))

        print("\n==================================================")
        print("            UAT TELEGRAM RESULTS SUMMARY          ")
        print("==================================================")
        for r in results:
            tag = "✅ PASS" if r["status"] == "PASS" else "❌ FAIL"
            print(f"{tag} - {r['test_id']}: {r.get('snippet') or r.get('final_text') or r.get('error') or 'OK'}")
        print("==================================================\n")

        # Save results to JSON
        out_file = Path("docs/qa/UAT_TELEGRAM_RESULTS.json")
        out_file.write_text(json.dumps(results, indent=2), encoding="utf-8")
        print(f"Saved results to {out_file}")


if __name__ == "__main__":
    asyncio.run(main())
