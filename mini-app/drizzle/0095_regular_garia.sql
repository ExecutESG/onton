-- Re-usable enums
CREATE TYPE broadcast_send_status AS ENUM ('pending', 'sent', 'failed');
CREATE TYPE broadcast_delivery_status AS ENUM ('unknown', 'delivered', 'read');

-- Root table: one row per broadcast message
CREATE TABLE broadcast_messages (
                                    broadcast_id        BIGSERIAL    PRIMARY KEY,
                                    broadcaster_id      BIGINT       NOT NULL,          -- Telegram user who pressed /broadcast
                                    source_chat_id      BIGINT       NOT NULL,
                                    source_message_id   BIGINT       NOT NULL,
                                    broadcast_type      TEXT         NOT NULL,          -- 'event' | 'csv'
                                    event_uuid          UUID,                            -- nullable unless type = event
                                    title               TEXT,                            -- cached title for dashboards
                                    created_at          TIMESTAMPTZ  DEFAULT now()
);

-- One row per target recipient
CREATE TABLE broadcast_users (
                                 id                  BIGSERIAL    PRIMARY KEY,
                                 broadcast_id        BIGINT       REFERENCES broadcast_messages(broadcast_id) ON DELETE CASCADE,
                                 user_id             BIGINT       NOT NULL,
                                 send_status         broadcast_send_status    DEFAULT 'pending',
                                 delivery_status     broadcast_delivery_status DEFAULT 'unknown',
                                 last_error          TEXT,
                                 sent_at             TIMESTAMPTZ
);

CREATE INDEX ON broadcast_users (broadcast_id, send_status);
-- Custom SQL migration file, put you code below! --

ALTER TABLE broadcast_users
    ADD COLUMN retry_count     INT    DEFAULT 0,
    ADD COLUMN sent_message_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_bu_pending
    ON broadcast_users (send_status, retry_count);

ALTER TABLE broadcast_messages
    ADD COLUMN message_text TEXT;       -- nullable is fine

