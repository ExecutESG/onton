#!/usr/bin/env bash
# Resets the persistent real-backend QA fixtures on STAGING before each run.
# Reuses 3 existing QA events (InPerson/Approval visible so attendees can open them; Report hidden), so no new events and no "New Event Published" alerts.
# Touches only the fixture events and their registrations, visitors, rewards and reports.
#
# Requires in tests/e2e/.env.test:
#   E2E_STAGING_SSH        e.g. "ssh -i ~/.ssh/key tonont@65.109.182.13"
#   E2E_FIXTURE_INPERSON_UUID / E2E_FIXTURE_APPROVAL_UUID / E2E_FIXTURE_REPORT_UUID
#   E2E_ORGANIZER_TG_ID / E2E_ATTENDEE_TG_ID
set -euo pipefail

: "${E2E_STAGING_SSH:?missing}"
: "${E2E_FIXTURE_INPERSON_UUID:?missing}"
: "${E2E_FIXTURE_APPROVAL_UUID:?missing}"
: "${E2E_FIXTURE_REPORT_UUID:?missing}"
: "${E2E_ORGANIZER_TG_ID:?missing}"
: "${E2E_ATTENDEE_TG_ID:?missing}"

case "$E2E_STAGING_SSH" in
  *65.109.212.86*) echo "REFUSING: production host" >&2; exit 1 ;;
esac

UUID_RE='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
for value in "$E2E_FIXTURE_INPERSON_UUID" "$E2E_FIXTURE_APPROVAL_UUID" "$E2E_FIXTURE_REPORT_UUID"; do
  [[ "$value" =~ $UUID_RE ]] || { echo "bad fixture uuid: $value" >&2; exit 1; }
done
[[ "$E2E_ORGANIZER_TG_ID" =~ ^[0-9]+$ && "$E2E_ATTENDEE_TG_ID" =~ ^[0-9]+$ ]] || { echo "bad tg id" >&2; exit 1; }

FIXTURES="'$E2E_FIXTURE_INPERSON_UUID','$E2E_FIXTURE_APPROVAL_UUID','$E2E_FIXTURE_REPORT_UUID'"

SQL=$(cat <<EOF
\set ON_ERROR_STOP 1
BEGIN;
-- Guard: fixtures must be QA events owned by the organizer test account.
DO \$\$ BEGIN
  IF (SELECT count(*) FROM events WHERE event_uuid IN ($FIXTURES) AND title LIKE 'QA-E2E-%' AND owner = $E2E_ORGANIZER_TG_ID) <> 3 THEN
    RAISE EXCEPTION 'fixture guard failed: events are not the 3 QA fixtures of the organizer';
  END IF;
END \$\$;

UPDATE events SET participation_type = 'in_person', has_registration = true, has_approval = false,
  capacity = 100, has_waiting_list = false, has_payment = false, has_web3 = false,
  moderation_message_id = NULL, activity_id = NULL, enabled = true, hidden = false,
  title = 'QA-E2E-FIXTURE-InPerson', updated_by = 'qa-fixture', updated_at = now()
  WHERE event_uuid = '$E2E_FIXTURE_INPERSON_UUID';
UPDATE events SET participation_type = 'online', has_registration = true, has_approval = true,
  capacity = 100, has_waiting_list = false, has_payment = false, has_web3 = false,
  moderation_message_id = NULL, activity_id = NULL, enabled = true, hidden = false,
  title = 'QA-E2E-FIXTURE-Approval', updated_by = 'qa-fixture', updated_at = now()
  WHERE event_uuid = '$E2E_FIXTURE_APPROVAL_UUID';
UPDATE events SET has_payment = false, moderation_message_id = NULL, activity_id = NULL,
  enabled = true, hidden = true, title = 'QA-E2E-FIXTURE-Report', updated_by = 'qa-fixture', updated_at = now()
  WHERE event_uuid = '$E2E_FIXTURE_REPORT_UUID';

DELETE FROM rewards WHERE visitor_id IN (SELECT id FROM visitors WHERE event_uuid IN ($FIXTURES));
DELETE FROM visitors WHERE event_uuid IN ($FIXTURES);
DELETE FROM event_registrants WHERE event_uuid IN ($FIXTURES);
DELETE FROM event_reports WHERE event_uuid IN ($FIXTURES);
SELECT 'fixtures_reset', count(*) FROM events WHERE event_uuid IN ($FIXTURES);
COMMIT;
EOF
)

REDIS_KEYS="user:$E2E_ATTENDEE_TG_ID user:$E2E_ORGANIZER_TG_ID"
for value in $E2E_FIXTURE_INPERSON_UUID $E2E_FIXTURE_APPROVAL_UUID $E2E_FIXTURE_REPORT_UUID; do
  REDIS_KEYS="$REDIS_KEYS event_uuid:$value"
done

# shellcheck disable=SC2086
printf '%s\n' "$SQL" | $E2E_STAGING_SSH "
  set -e
  P=\$(docker ps -q -f name=onton-dev_postgres | head -1)
  R=\$(docker ps -q -f name=onton-dev_redis | head -1)
  M=\$(docker ps -q -f name=onton-dev_mini-app. | head -1)
  docker exec -i \$P psql -U onton -d mini-app -qAt
  IDS=\$(docker exec \$P psql -U onton -d mini-app -At -c \"select string_agg('event_id:'||event_id, ' ') from events where event_uuid in ($FIXTURES)\")
  PW=\$(docker exec \$M printenv REDIS_PASSWORD 2>/dev/null || true)
  if [ -n \"\$PW\" ]; then AUTH=\"-a \$PW --no-auth-warning\"; else AUTH=\"\"; fi
  for db in 0 1 2 3; do docker exec \$R redis-cli \$AUTH -n \$db DEL $REDIS_KEYS \$IDS >/dev/null; done
  echo redis_cache_cleared
"
