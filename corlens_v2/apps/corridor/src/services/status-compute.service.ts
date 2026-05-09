export type StatusInput = {
  pathCount: number;
  hasError: boolean;
  lastRefreshedAt: Date | null;
};

export type Status = "GREEN" | "AMBER" | "RED" | "UNKNOWN";

export function computeStatus(input: StatusInput): Status {
  if (input.lastRefreshedAt === null) return "UNKNOWN";
  if (input.hasError) return "RED";
  if (input.pathCount === 0) return "RED";
  if (input.pathCount === 1) return "AMBER";
  return "GREEN";
}
