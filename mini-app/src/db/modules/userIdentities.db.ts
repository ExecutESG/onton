import { db } from "@/db/db";
import { user_identities, UserIdentityInsert, UserIdentityRow } from "@/db/schema/userIdentities";
import { users } from "@/db/schema/users";
import { and, eq } from "drizzle-orm";
import { logger } from "@/server/utils/logger";

export const userIdentitiesDB = {
  /**
   * Find an identity record by provider and external provider user ID.
   */
  async findIdentity(provider: string, provider_user_id: string): Promise<UserIdentityRow | null> {
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
      if (identities.length <= 1) {
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

      return { success: true };
    } catch (error: any) {
      logger.error("Error unlinking identity:", { userId, provider, error });
      return { success: false, error: error?.message || "Failed to unlink identity" };
    }
  },
};

export default userIdentitiesDB;
