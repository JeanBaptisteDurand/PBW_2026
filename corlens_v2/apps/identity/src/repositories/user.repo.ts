import type { IdentityDb } from "@corlens/db/identity";

export type UserRow = {
  id: string;
  walletAddress: string;
  role: "free" | "premium";
  apiKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function createUserRepo(db: IdentityDb) {
  return {
    async findByWallet(walletAddress: string): Promise<UserRow | null> {
      const row = await db.user.findUnique({ where: { walletAddress } });
      return row as UserRow | null;
    },

    async findById(id: string): Promise<UserRow | null> {
      const row = await db.user.findUnique({ where: { id } });
      return row as UserRow | null;
    },

    async findByApiKey(apiKey: string): Promise<UserRow | null> {
      const row = await db.user.findUnique({ where: { apiKey } });
      return row as UserRow | null;
    },

    async upsertByWallet(walletAddress: string): Promise<UserRow> {
      const row = await db.user.upsert({
        where: { walletAddress },
        update: {},
        create: { walletAddress },
      });
      return row as UserRow;
    },

    async setApiKey(id: string, apiKey: string | null): Promise<void> {
      await db.user.update({ where: { id }, data: { apiKey } });
    },

    async setRole(id: string, role: "free" | "premium"): Promise<void> {
      await db.user.update({ where: { id }, data: { role } });
    },

    async listProfile(id: string) {
      return db.user.findUnique({
        where: { id },
        include: {
          subscriptions: { orderBy: { paidAt: "desc" } },
        },
      });
    },
  };
}

export type UserRepo = ReturnType<typeof createUserRepo>;
