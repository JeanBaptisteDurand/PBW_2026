import type { UsageRollup } from "@corlens/contracts/dist/ai.js";
import type { PromptLogRepo } from "../repositories/prompt-log.repo.js";

export type UsageServiceOptions = {
  promptLog: PromptLogRepo;
};

export type UsageService = ReturnType<typeof createUsageService>;

export function createUsageService(opts: UsageServiceOptions) {
  return {
    async rollupSinceMonthStart(): Promise<UsageRollup> {
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const byPurpose = await opts.promptLog.rollupByPurpose(monthStart.toISOString());
      return { since: monthStart.toISOString(), byPurpose };
    },
  };
}
