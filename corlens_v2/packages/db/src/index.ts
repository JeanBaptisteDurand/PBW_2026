import { PrismaClient } from "@prisma/client";

export type Prisma = PrismaClient;

export function makePrisma(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: ["warn", "error"],
  });
}
