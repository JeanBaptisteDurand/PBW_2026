export type RiskSeverity = "HIGH" | "MED" | "LOW";

export type RiskFlagData = {
  flag: string;
  severity: RiskSeverity;
  detail: string;
  data?: Record<string, unknown>;
};

export type ComplianceReportData = {
  title: string;
  generatedAt: string;
  seedAddress: string;
  seedLabel?: string;
  summary: string;
  riskAssessment: {
    overall: RiskSeverity;
    flags: RiskFlagData[];
  };
  entityBreakdown: {
    tokens: number;
    issuers: number;
    pools: number;
    accounts: number;
    orderBooks: number;
    escrows: number;
    paymentPaths: number;
    checks: number;
    payChannels: number;
    nfts: number;
    signerLists: number;
    dids: number;
    credentials: number;
    mpTokens: number;
    oracles: number;
    depositPreauths: number;
    offers: number;
    permissionedDomains: number;
    nftOffers: number;
    tickets: number;
    bridges: number;
    vaults: number;
  };
  concentrationAnalysis?: {
    topHolders: Array<{ address: string; percentage: number }>;
    herfindahlIndex: number;
  };
  gatewayAnalysis?: {
    totalObligations: Record<string, string>;
    gateways: string[];
  };
  recommendations: string[];
};
