import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth";
import { userIdentitiesDB } from "@/db/modules/userIdentities.db";
import { selectUserById } from "@/db/modules/users.db";
import "@/lib/gracefullyShutdown";

export async function GET(req: NextRequest) {
  const [userId, authError] = getAuthenticatedUser(req);
  if (authError) {
    return authError;
  }

  try {
    const user = await selectUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const identities = await userIdentitiesDB.getIdentitiesByUserId(userId);

    return NextResponse.json({
      ok: true,
      user: {
        userId: user.user_id,
        uuid: user.uuid,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        photoUrl: user.photo_url,
        role: user.role,
        authProvider: user.auth_provider,
        telegramId: user.telegram_id,
        walletAddress: user.wallet_address,
        userPoint: user.user_point,
      },
      identities: identities.map((id) => ({
        id: id.id,
        provider: id.provider,
        providerUserId: id.provider_user_id,
        verified: id.verified,
        createdAt: id.created_at,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch user profile", message: error?.message },
      { status: 500 }
    );
  }
}
