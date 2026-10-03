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

// 1. Drizzle's base user type
export type BaseUser = InferSelectModel<typeof users>;

export interface OrgUser extends BaseUser {
  // Additional optional organizer fields
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

/**
 * 2. If listActiveUserRolesForEvent returns an array of
 * something like { itemId, userId, username, role, ... },
 * we can extract the element type:
 */
type ActiveUserRole = Awaited<ReturnType<typeof userRolesDB.listActiveUserRolesForUser>>[number];

/**
 * 3. Define an extended user type that includes CustomAccessRoles
 */
export interface ExtendedUser extends OrgUser {
  CustomAccessRoles: ActiveUserRole[];
}
