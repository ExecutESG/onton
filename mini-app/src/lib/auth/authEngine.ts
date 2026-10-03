import { db } from "@/db/db";
import { users } from "@/db/schema/users";
import { userIdentitiesDB } from "@/db/modules/userIdentities.db";
import { createPlatformToken, PlatformAuthPayload } from "@/server/utils/jwt";
import { safeTimingEqual } from "@/server/apiKeyAuth";
import { redisTools } from "@/lib/redisTools";
import { logger } from "@/server/utils/logger";
import { validate } from "@tma.js/init-data-node";
import { eq, or } from "drizzle-orm";
import crypto from "crypto";

export type AuthProviderType = "telegram" | "google" | "email" | "ton_wallet";

export interface ResolvedUserAuth {
  user: typeof users.$inferSelect;
  token: string;
  isNewUser: boolean;
  provider: AuthProviderType;
}

export const authEngine = {
  /**
   * 1. Validate Telegram Web App initData and extract Telegram user payload.
   */
  verifyTelegramInitData(rawInitData: string): {
    valid: boolean;
    telegramUser?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      photo_url?: string;
    };
    startParam?: string;
  } {
    const botToken = process.env.BOT_TOKEN;
    if (!botToken || !rawInitData) {
      return { valid: false };
    }

    try {
      validate(rawInitData, botToken);
      const params = new URLSearchParams(rawInitData);
      const userRaw = params.get("user");
      const startParam = params.get("start_param") || undefined;

      if (!userRaw) return { valid: false };

      const parsed = JSON.parse(userRaw);
      return {
        valid: true,
        telegramUser: {
          id: parsed.id,
          first_name: parsed.first_name || "",
          last_name: parsed.last_name,
          username: parsed.username,
          language_code: parsed.language_code,
          photo_url: parsed.photo_url,
        },
        startParam,
      };
    } catch (error) {
      logger.error("Failed to validate Telegram initData:", error);
      return { valid: false };
    }
  },

  /**
   * 2. Generate and store a 6-digit Email OTP in Redis (with rate limiting).
   */
  async generateEmailOtp(rawEmail: string): Promise<{ success: boolean; message: string }> {
    const email = rawEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, message: "Invalid email address format." };
    }

    // Rate limit: max 3 requests per 5 minutes per email
    const rlKey = `otp:rl:${email}`;
    const attempts = await redisTools.getCache(rlKey);
    if (attempts && Number(attempts) >= 3) {
      return {
        success: false,
        message: "Too many OTP requests. Please wait 5 minutes before trying again.",
      };
    }

    // Generate cryptographically random 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();

    // Cache code for 5 minutes (300 seconds)
    const codeKey = `otp:code:${email}`;
    await redisTools.setCache(codeKey, code, 300);

    // Increment rate limit counter (expires in 300s)
    const currentAttempts = attempts ? Number(attempts) + 1 : 1;
    await redisTools.setCache(rlKey, String(currentAttempts), 300);

    // Log OTP code (in staging/dev or until email transport is configured)
    logger.info(`[AUTH] Email verification code generated for ${email}: ${code}`);
    console.log(`\n========================================\n[ONTON OTP] Code for ${email}: ${code}\n========================================\n`);

    return {
      success: true,
      message: "Verification code sent to your email.",
    };
  },

  /**
   * 3. Verify an Email OTP code using constant-time comparison.
   */
  async verifyEmailOtp(rawEmail: string, code: string): Promise<{ valid: boolean; email?: string; error?: string }> {
    const email = rawEmail.trim().toLowerCase();
    const cleanCode = code.trim();

    const codeKey = `otp:code:${email}`;
    const cachedCode = await redisTools.getCache(codeKey);

    if (!cachedCode) {
      return { valid: false, error: "Verification code expired or not found. Please request a new one." };
    }

    if (!safeTimingEqual(cleanCode, cachedCode)) {
      return { valid: false, error: "Invalid verification code. Please check and try again." };
    }

    // Single-use: delete code on successful verification
    await redisTools.deleteCache(codeKey);

    return { valid: true, email };
  },

  /**
   * 4. Resolve an existing ONTON user or create a new user linked via user_identities.
   */
  async resolveOrCreateUser(input: {
    provider: AuthProviderType;
    providerUserId: string;
    email?: string;
    name?: string;
    username?: string;
    avatarUrl?: string;
    telegramId?: number;
    metadata?: Record<string, any>;
  }): Promise<ResolvedUserAuth> {
    const { provider, providerUserId, email, name, username, avatarUrl, telegramId, metadata } = input;

    // 1. Check if identity mapping already exists in user_identities
    const existing = await userIdentitiesDB.findUserByIdentity(provider, providerUserId);
    if (existing) {
      const updateData: Record<string, any> = {};
      if (email && !existing.user.email) {
        updateData.email = email;
        existing.user.email = email;
      }
      // Telegram profile always takes precedence for avatar and display name
      if (provider === "telegram") {
        if (!existing.user.telegram_id) updateData.telegram_id = Number(providerUserId);
        if (avatarUrl && avatarUrl !== existing.user.photo_url) updateData.photo_url = avatarUrl;
        if (name && name !== existing.user.first_name) updateData.first_name = name;
      }
      if (Object.keys(updateData).length > 0) {
        await db.update(users).set(updateData).where(eq(users.user_id, existing.user.user_id));
      }

      const token = await createPlatformToken({
        userId: existing.user.user_id,
        userUuid: existing.user.uuid || undefined,
        provider,
        email: existing.user.email || undefined,
        telegramId: existing.user.telegram_id || undefined,
        role: existing.user.role || "user",
      });

      return {
        user: existing.user,
        token,
        isNewUser: false,
        provider,
      };
    }

    // 2. Check if a user with this verified email already exists (auto-link)
    if (email) {
      const userWithEmail = await db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase()),
      });

      if (userWithEmail) {
        await userIdentitiesDB.createIdentity({
          user_id: userWithEmail.user_id,
          provider,
          provider_user_id: providerUserId,
          provider_metadata: metadata,
          verified: true,
        });

        const token = await createPlatformToken({
          userId: userWithEmail.user_id,
          userUuid: userWithEmail.uuid || undefined,
          provider,
          email: userWithEmail.email || undefined,
          telegramId: userWithEmail.telegram_id || undefined,
          role: userWithEmail.role || "user",
        });

        return {
          user: userWithEmail,
          token,
          isNewUser: false,
          provider,
        };
      }
    }

    // 2.5. Check if legacy user already exists in users table (e.g. created prior to user_identities)
    if (provider === "telegram" || telegramId) {
      const targetId = telegramId || Number(providerUserId);
      if (!isNaN(targetId) && targetId > 0) {
        const legacyUser = await db.query.users.findFirst({
          where: or(eq(users.user_id, targetId), eq(users.telegram_id, targetId)),
        });

        if (legacyUser) {
          await userIdentitiesDB.createIdentity({
            user_id: legacyUser.user_id,
            provider: "telegram",
            provider_user_id: providerUserId,
            provider_metadata: metadata,
            verified: true,
          }).catch(() => {});

          const token = await createPlatformToken({
            userId: legacyUser.user_id,
            userUuid: legacyUser.uuid || undefined,
            provider,
            email: legacyUser.email || undefined,
            telegramId: legacyUser.telegram_id || undefined,
            role: legacyUser.role || "user",
          });

          return {
            user: legacyUser,
            token,
            isNewUser: false,
            provider,
          };
        }
      }
    }

    // 3. Create new user row
    let newUserId: number;
    if (provider === "telegram") {
      newUserId = Number(providerUserId);
    } else {
      // Generate clean unique numeric ID for web/omnichannel user
      let isUnique = false;
      let candidateId = 0;
      while (!isUnique) {
        candidateId = 1e14 + Math.floor(Math.random() * 1e12);
        const exists = await db.query.users.findFirst({
          where: eq(users.user_id, candidateId),
        });
        if (!exists) isUnique = true;
      }
      newUserId = candidateId;
    }

    const cleanUsername =
      username ||
      (email ? email.split("@")[0] + `_${provider.slice(0, 2)}` : `${provider}_${providerUserId.slice(-6)}`);

    const [newUser] = await db
      .insert(users)
      .values({
        user_id: newUserId,
        email: email ? email.toLowerCase() : null,
        auth_provider: provider,
        telegram_id: telegramId || (provider === "telegram" ? Number(providerUserId) : null),
        first_name: name || "Attendee",
        username: cleanUsername,
        role: "user",
        photo_url: avatarUrl || null,
        language_code: "en",
        updatedBy: "authEngine",
      })
      .returning();

    // 4. Create primary identity record
    await userIdentitiesDB.createIdentity({
      user_id: newUser.user_id,
      provider,
      provider_user_id: providerUserId,
      provider_metadata: metadata,
      verified: true,
    });

    const token = await createPlatformToken({
      userId: newUser.user_id,
      userUuid: newUser.uuid || undefined,
      provider,
      email: newUser.email || undefined,
      telegramId: newUser.telegram_id || undefined,
      role: newUser.role || "user",
    });

    return {
      user: newUser,
      token,
      isNewUser: true,
      provider,
    };
  },

  /**
   * 5. Link an external TON wallet address to an existing authenticated user.
   */
  async linkWallet(userId: number, walletAddress: string) {
    return userIdentitiesDB.linkIdentity(userId, "ton_wallet", walletAddress, { address: walletAddress });
  },

  /**
   * 6. Link an external Google account to an existing authenticated user.
   */
  async linkGoogle(userId: number, googleSub: string, profile: { email?: string; name?: string; picture?: string }) {
    return userIdentitiesDB.linkIdentity(userId, "google", googleSub, profile);
  },
};

export default authEngine;
