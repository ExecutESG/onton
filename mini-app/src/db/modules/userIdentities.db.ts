import { db } from "@/db/db";
import { user_identities, UserIdentityInsert, UserIdentityRow } from "@/db/schema/userIdentities";
import { users } from "@/db/schema/users";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "@/server/utils/logger";

let identitiesTableEnsured = false;

export async function ensureUserIdentitiesTable(): Promise<void> {
  if (identitiesTableEnsured) return;
  try {
    await db.execute(sql`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      CREATE TABLE IF NOT EXISTS "public"."user_identities" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" bigint NOT NULL,
        "provider" varchar(50) NOT NULL,
        "provider_user_id" text NOT NULL,
        "provider_metadata" jsonb,
        "verified" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "user_identities_provider_user_id_uq" ON "public"."user_identities" ("provider","provider_user_id");
      CREATE INDEX IF NOT EXISTS "user_identities_user_id_idx" ON "public"."user_identities" ("user_id");
      CREATE INDEX IF NOT EXISTS "user_identities_provider_idx" ON "public"."user_identities" ("provider");
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "uuid" uuid DEFAULT gen_random_uuid();
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" varchar(255);
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_provider" varchar(50) DEFAULT 'telegram';
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_id" bigint;
    `);
    identitiesTableEnsured = true;
  } catch (error) {
    logger.error("Error ensuring user_identities table:", error);
  }
}

export const userIdentitiesDB = {
  /**
   * Find an identity record by provider and external provider user ID.
   */
  async findIdentity(provider: string, provider_user_id: string): Promise<UserIdentityRow | null> {
    await ensureUserIdentitiesTable();
    try {
      const result = await db.query.user_identities.findFirst({
        where: and(
          eq(user_identities.provider, provider),
          eq(user_identities.provider_user_id, String(provider_user_id))
        ),
      });
      return result || null;
    } catch (error) {
      logger.error("Error finding user identity:", { provider, provider_user_id, error });
      return null;
    }
  },

  /**
   * Find a user by external identity provider and ID.
   */
  async findUserByIdentity(provider: string, provider_user_id: string) {
    try {
      const identity = await this.findIdentity(provider, provider_user_id);
      if (!identity) return null;

      const user = await db.query.users.findFirst({
        where: eq(users.user_id, identity.user_id),
      });

      if (!user) return null;
      return { user, identity };
    } catch (error) {
      logger.error("Error finding user by identity:", { provider, provider_user_id, error });
      return null;
    }
  },

  /**
   * Insert a new user identity record.
   */
  async createIdentity(data: UserIdentityInsert): Promise<UserIdentityRow | null> {
    await ensureUserIdentitiesTable();
    try {
      const [inserted] = await db
        .insert(user_identities)
        .values({
          ...data,
          provider_user_id: String(data.provider_user_id),
        })
        .onConflictDoUpdate({
          target: [user_identities.provider, user_identities.provider_user_id],
          set: {
            user_id: data.user_id,
            provider_metadata: data.provider_metadata,
            verified: data.verified ?? true,
            updated_at: new Date(),
          },
        })
        .returning();

      return inserted || null;
    } catch (error) {
      logger.error("Error creating user identity:", { data, error });
      return null;
    }
  },

  /**
   * Get all identities linked to a specific ONTON user.
   */
  async getIdentitiesByUserId(userId: number): Promise<UserIdentityRow[]> {
    await ensureUserIdentitiesTable();
    try {
      return await db.query.user_identities.findMany({
        where: eq(user_identities.user_id, userId),
      });
    } catch (error) {
      logger.error("Error fetching identities for user:", { userId, error });
      return [];
    }
  },

  /**
   * Link an external identity provider to an existing ONTON user.
   */
  async linkIdentity(
    userId: number,
    provider: string,
    providerUserId: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; identity?: UserIdentityRow; error?: string }> {
    try {
      const existing = await this.findIdentity(provider, providerUserId);
      if (existing) {
        if (existing.user_id === userId) {
          // Already linked to this user, update metadata
          const [updated] = await db
            .update(user_identities)
            .set({
              provider_metadata: metadata,
              updated_at: new Date(),
            })
            .where(eq(user_identities.id, existing.id))
            .returning();
          return { success: true, identity: updated };
        } else {
          return {
            success: false,
            error: "This external account is already linked to a different ONTON profile.",
          };
        }
      }

      const created = await this.createIdentity({
        user_id: userId,
        provider,
        provider_user_id: providerUserId,
        provider_metadata: metadata,
        verified: true,
      });

      if (created) {
        // Sync with primary fields on users table
        try {
          if (provider === "telegram") {
            // Telegram takes precedence for name and avatar
            const updateData: Record<string, any> = {
              telegram_id: Number(providerUserId),
            };
            if (metadata?.first_name) updateData.first_name = metadata.first_name;
            if (metadata?.last_name) updateData.last_name = metadata.last_name;
            if (metadata?.username) updateData.username = metadata.username;
            if (metadata?.photo_url) updateData.photo_url = metadata.photo_url;
            await db.update(users).set(updateData).where(eq(users.user_id, userId));
          } else if (provider === "ton_wallet") {
            await db.update(users).set({ wallet_address: providerUserId }).where(eq(users.user_id, userId));
          } else if (provider === "google") {
            const currentUser = await db.query.users.findFirst({ where: eq(users.user_id, userId) });
            const updateData: Record<string, any> = {};
            if (!currentUser?.email && metadata?.email) updateData.email = metadata.email;
            // Only update photo/name from Google if Telegram identity is not already set
            if (!currentUser?.telegram_id) {
              if (!currentUser?.photo_url && metadata?.picture) updateData.photo_url = metadata.picture;
              if ((!currentUser?.first_name || currentUser.first_name === "Attendee" || currentUser.first_name === "Web") && metadata?.name) {
                updateData.first_name = metadata.name;
              }
            }
            if (Object.keys(updateData).length > 0) {
              await db.update(users).set(updateData).where(eq(users.user_id, userId));
            }
          } else if (provider === "email") {
            const currentUser = await db.query.users.findFirst({ where: eq(users.user_id, userId) });
            if (!currentUser?.email) {
              await db.update(users).set({ email: providerUserId }).where(eq(users.user_id, userId));
            }
          }
        } catch (syncErr) {
          logger.error("Error syncing identity to users table:", { userId, provider, syncErr });
        }
      }

      return { success: !!created, identity: created || undefined };
    } catch (error: any) {
      logger.error("Error linking identity to user:", { userId, provider, providerUserId, error });
      return { success: false, error: error?.message || "Failed to link identity" };
    }
  },

  /**
   * Unlink an external provider from a user account (ensures account is not orphaned).
   */
  async unlinkIdentity(userId: number, provider: string): Promise<{ success: boolean; error?: string }> {
    try {
      const identities = await this.getIdentitiesByUserId(userId);
      if (provider !== "ton_wallet" && identities.length <= 1) {
        return {
          success: false,
          error: "Cannot unlink the only authentication method on this account.",
        };
      }

      await db
        .delete(user_identities)
        .where(
          and(
            eq(user_identities.user_id, userId),
            eq(user_identities.provider, provider)
          )
        );

      // Clean up primary column if unlinking
      try {
        if (provider === "telegram") {
          await db.update(users).set({ telegram_id: null }).where(eq(users.user_id, userId));
        } else if (provider === "ton_wallet") {
          await db.update(users).set({ wallet_address: null }).where(eq(users.user_id, userId));
        }
      } catch (cleanErr) {
        logger.error("Error clearing unlinked provider column:", { userId, provider, cleanErr });
      }

      return { success: true };
    } catch (error: any) {
      logger.error("Error unlinking identity:", { userId, provider, error });
      return { success: false, error: error?.message || "Failed to unlink identity" };
    }
  },
};

export default userIdentitiesDB;
