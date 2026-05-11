import type { Prisma } from "@corlens/db";

export type CurrencyMetaRow = {
  code: string;
  issuers: unknown;
  actors: unknown;
  updatedAt: Date;
};

export interface CurrencyMetaRepo {
  findByCode(code: string): Promise<CurrencyMetaRow | null>;
  list(): Promise<CurrencyMetaRow[]>;
  upsertMany(rows: { code: string; issuers: unknown; actors: unknown }[]): Promise<number>;
  count(): Promise<number>;
}

export function createCurrencyMetaRepo(prisma: Prisma): CurrencyMetaRepo {
  return {
    async findByCode(code) {
      return prisma.currencyMeta.findUnique({ where: { code } });
    },
    async list() {
      return prisma.currencyMeta.findMany({ orderBy: { code: "asc" } });
    },
    async upsertMany(rows) {
      let n = 0;
      for (const r of rows) {
        await prisma.currencyMeta.upsert({
          where: { code: r.code },
          update: { issuers: r.issuers as object, actors: r.actors as object },
          create: { code: r.code, issuers: r.issuers as object, actors: r.actors as object },
        });
        n++;
      }
      return n;
    },
    async count() {
      return prisma.currencyMeta.count();
    },
  };
}
