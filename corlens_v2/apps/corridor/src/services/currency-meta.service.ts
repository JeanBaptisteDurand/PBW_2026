import type { corridor as cc } from "@corlens/contracts";
import type { CurrencyMetaRepo, CurrencyMetaRow } from "../repositories/currency-meta.repo.js";

type ActorEntry = cc.ActorEntry;
type CurrencyMeta = cc.CurrencyMeta;
type IssuerEntry = cc.IssuerEntry;

export interface CurrencyMetaService {
  getByCode(code: string): Promise<CurrencyMeta | null>;
  list(): Promise<{ currencies: CurrencyMeta[]; globalHubs: ActorEntry[] }>;
}

function toCurrencyMeta(row: CurrencyMetaRow): CurrencyMeta {
  return {
    code: row.code,
    issuers: (row.issuers as IssuerEntry[]) ?? [],
    actors: (row.actors as ActorEntry[]) ?? [],
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createCurrencyMetaService(deps: {
  repo: CurrencyMetaRepo;
  globalHubs: ActorEntry[];
}): CurrencyMetaService {
  return {
    async getByCode(code) {
      const row = await deps.repo.findByCode(code.toUpperCase());
      return row ? toCurrencyMeta(row) : null;
    },
    async list() {
      const rows = await deps.repo.list();
      return { currencies: rows.map(toCurrencyMeta), globalHubs: deps.globalHubs };
    },
  };
}
