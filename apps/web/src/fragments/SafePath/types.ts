import type { CorridorAnalysis, CorridorPath } from "@xrplens/core";

export type SafePathEvent =
  | { type: "step"; step: string; detail?: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; summary: string }
  | { type: "reasoning"; text: string }
  | { type: "corridor_update"; analysis: CorridorAnalysis }
  | { type: "path_active"; pathIndex: number }
  | {
      type: "path_rejected";
      pathIndex: number;
      reason: string;
      flags: string[];
    }
  | { type: "result"; result: SafePathResult }
  | { type: "error"; error: string };

export interface SafePathResult {
  winningPath: CorridorPath | null;
  winningPathIndex: number;
  riskScore: number;
  verdict: "SAFE" | "REJECTED" | "NO_PATHS";
  reasoning: string;
  rejected: Array<{ pathIndex: number; reason: string; flags: string[] }>;
  corridorAnalysis: CorridorAnalysis;
}
