import { type Prisma, makePrisma } from "@corlens/db";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    prisma: Prisma;
  }
}

export interface PrismaPluginOptions {
  databaseUrl: string;
}

export const prismaPlugin = fp<PrismaPluginOptions>(
  async (app, opts) => {
    const prisma = makePrisma(opts.databaseUrl);
    app.decorate("prisma", prisma);
    app.addHook("onClose", async () => {
      await prisma.$disconnect();
    });
  },
  { name: "prisma" },
);
