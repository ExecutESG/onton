import { InferSelectModel } from "drizzle-orm";
import { users } from "@/db/schema/users";
import { userRolesDB } from "@/db/modules/userRoles.db";

export interface InitUserData {
  user: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    language_code: string;
    is_premium?: boolean;
    allows_write_to_pm?: boolean;
    photo_url?: string;
  };
}

interface OrgUser {
  user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  wallet_address: string | null;
  language_code: string | null;
  role: string;
  created_at: Date | null;
  updatedAt: Date | null;
  updatedBy: string;
  is_premium: boolean | null;
  allows_write_to_pm: boolean | null;
  photo_url: string | null;
  participated_event_count: number | null;
  hosted_event_count: number | null;
  has_blocked_the_bot: boolean | null;

  // Fallback columns as string | null
  org_channel_name: string | null;
  org_support_telegram_user_name: string | null;
  org_x_link: string | null;
  org_bio: string | null;
  org_image: string | null;
}

export interface MinimalOrganizerData {
  user_id: number;
  photo_url: string | null;
  participated_event_count: number | null;
  hosted_event_count: number | null;
  org_channel_name: string | null;
  org_support_telegram_user_name: string | null;
  org_x_link: string | null;
  org_bio: string | null;
  org_image: string | null;
  role: string;
}
// 1. Drizzle's base user type
export type BaseUser = InferSelectModel<typeof users>;

/**
 * 2. If listActiveUserRolesForEvent returns an array of
 *    something like { itemId, userId, username, role, ... },
 *    we can extract the element type:
 */
type ActiveUserRole = Awaited<ReturnType<typeof userRolesDB.listActiveUserRolesForUser>>[number];

/**
 * 3. Define an extended user type that includes CustomAccessRoles
 */
export interface ExtendedUser extends OrgUser {
  CustomAccessRoles: ActiveUserRole[];
}
