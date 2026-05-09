import { type Prisma, makePrisma } from "@corlens/db";
import { type IdentityDb, identityDb } from "@corlens/db/identity";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    prisma: Prisma;
    db: IdentityDb;
  }
}

export interface PrismaPluginOptions {
  databaseUrl: string;
}

export const prismaPlugin = fp<PrismaPluginOptions>(
  async (app, opts) => {
    const prisma = makePrisma(opts.databaseUrl);
    const db = identityDb(prisma);
    app.decorate("prisma", prisma);
    app.decorate("db", db);
    app.addHook("onClose", async () => {
      await prisma.$disconnect();
    });
  },
  { name: "prisma" },
);
