# Authentication & Session Management

## 1. Telegram Mini App (TMA) Auth
- **Mechanism**: Validates the `initData` string provided by Telegram.
- **Flow**:
    1. TMA frontend sends `initData` to `mini-app` API.
    2. Backend verifies the cryptographic signature using the `BOT_TOKEN`.
    3. If valid, issues a **JWT** or Session Cookie.
    4. User identity is linked to `users` table via `telegram_id`.

## 2. Wallet Authentication (TON Connect)
- **Mechanism**: **TON Connect 2.0** verification.
- **Flow**:
    1. Frontend requests a `ton_proof` payload from Backend (`tonProofRouter`).
    2. User signs payload with their Wallet (e.g., Tonkeeper).
    3. Backend verifies the signature against the public key on-chain.
    4. Wallet address is linked to the User profile.

## 3. Web Panel Auth
- **Mechanism**: Likely similar Wallet-based login or a specialized "Admin/Organizer" login flow.
