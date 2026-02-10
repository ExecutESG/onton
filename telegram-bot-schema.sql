-- Telegram Bot Schema Consolidations

CREATE TABLE IF NOT EXISTS polls (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    created_by BIGINT,
    vote_deadline TIMESTAMP,
    multiple_choice BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS poll_answers (
    id SERIAL PRIMARY KEY,
    poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_user_answers (
    poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    answer_id INTEGER REFERENCES poll_answers(id) ON DELETE CASCADE,
    PRIMARY KEY (poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS poll_sent (
    id SERIAL PRIMARY KEY,
    poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    state TEXT DEFAULT 'waiting_for_send',
    retry_count INTEGER DEFAULT 0,
    message_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_invite_links (
    user_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    invite_link TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, chat_id)
);

CREATE TABLE IF NOT EXISTS broadcasts (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending',
    target_env TEXT
);

CREATE TABLE IF NOT EXISTS telegram_bot_visitors (
    id SERIAL PRIMARY KEY,
    telegram_id TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    username TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
