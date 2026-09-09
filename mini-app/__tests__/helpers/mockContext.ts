export interface MockUserContext {
  user_id: number;
  telegram_id: number;
  username: string;
  role: "user" | "organizer" | "admin";
  wallet_address?: string;
}

export function createMockContext(overrides?: Partial<MockUserContext>) {
  const user: MockUserContext = {
    user_id: 12345,
    telegram_id: 99887766,
    username: "onton_tester",
    role: "user",
    ...overrides,
  };

  return {
    user,
    userId: user.user_id,
    userRole: user.role,
    userAddress: user.wallet_address,
    isOrganizer: user.role === "organizer" || user.role === "admin",
    isAdmin: user.role === "admin",
  };
}
