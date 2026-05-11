import type { Prisma } from "@corlens/db";
import { pathDb } from "@corlens/db/path";

export function createRagRepo(prisma: Prisma) {
  const db = pathDb(prisma);
  return {
    async upsertDoc(input: {
      analysisId: string;
      content: string;
      metadata: unknown;
      embedding: number[];
    }) {
      const vec = `[${input.embedding.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO path."RagDocument" (id, "analysisId", content, metadata, embedding, "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4::vector, NOW())`,
        input.analysisId,
        input.content,
        JSON.stringify(input.metadata),
        vec,
      );
    },

    async searchByEmbedding(analysisId: string, embedding: number[], limit: number) {
      const vec = `[${embedding.join(",")}]`;
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          analysisId: string;
          content: string;
          metadata: unknown;
          distance: number;
        }>
      >(
        `SELECT id, "analysisId", content, metadata, embedding <-> $1::vector AS distance
         FROM path."RagDocument"
         WHERE "analysisId" = $3
         ORDER BY embedding <-> $1::vector
         LIMIT $2`,
        vec,
        limit,
        analysisId,
      );
      return rows;
    },

    async clearDocs(analysisId: string) {
      await db.ragDocument.deleteMany({ where: { analysisId } });
    },

    async createChat(analysisId: string) {
      return db.ragChat.create({ data: { analysisId } });
    },

    async appendMessage(input: {
      chatId: string;
      role: string;
      content: string;
      sources?: unknown;
    }) {
      await db.ragMessage.create({
        data: {
          chatId: input.chatId,
          role: input.role,
          content: input.content,
          sources: (input.sources ?? null) as never,
        },
      });
    },

    async findLatestChatByAnalysisId(analysisId: string) {
      const chat = await db.ragChat.findFirst({
        where: { analysisId },
        orderBy: { createdAt: "desc" },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
        },
      });
      return chat ?? null;
    },
  };
}

export type RagRepo = ReturnType<typeof createRagRepo>;
