import type { Prisma } from "@corlens/db";
import { corridorDb } from "@corlens/db/corridor";

export function createRagRepo(prisma: Prisma) {
  const db = corridorDb(prisma);
  return {
    async upsertDoc(input: {
      corridorId: string;
      content: string;
      metadata: unknown;
      embedding: number[];
    }) {
      const vec = `[${input.embedding.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO corridor."CorridorRagDocument" (id, "corridorId", content, metadata, embedding, "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4::vector, NOW())`,
        input.corridorId,
        input.content,
        JSON.stringify(input.metadata),
        vec,
      );
    },

    async searchByEmbedding(corridorId: string | null, embedding: number[], limit: number) {
      const vec = `[${embedding.join(",")}]`;
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          corridorId: string | null;
          content: string;
          metadata: unknown;
          distance: number;
        }>
      >(
        `SELECT id, "corridorId", content, metadata, embedding <-> $1::vector AS distance
         FROM corridor."CorridorRagDocument"
         ${corridorId ? `WHERE "corridorId" = $3` : ""}
         ORDER BY embedding <-> $1::vector
         LIMIT $2`,
        vec,
        limit,
        ...(corridorId ? [corridorId] : []),
      );
      return rows;
    },

    async clearDocs(corridorId: string) {
      await db.corridorRagDocument.deleteMany({ where: { corridorId } });
    },

    async createChat(corridorId: string | null) {
      return db.corridorRagChat.create({ data: { corridorId } });
    },

    async appendMessage(input: {
      chatId: string;
      role: string;
      content: string;
      sources?: unknown;
    }) {
      await db.corridorRagMessage.create({
        data: {
          chatId: input.chatId,
          role: input.role,
          content: input.content,
          sources: (input.sources ?? null) as never,
        },
      });
    },
  };
}

export type RagRepo = ReturnType<typeof createRagRepo>;
