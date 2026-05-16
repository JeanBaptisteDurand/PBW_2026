import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

interface AnalysisStatusCardProps {
  isError: boolean;
  statusValue?: "queued" | "running" | "error" | string;
  errorMessage?: string;
}

export function AnalysisStatusCard({
  isError,
  statusValue,
  errorMessage,
}: AnalysisStatusCardProps) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {isError ? "Analysis Failed" : "Running Analysis"}
          </CardTitle>
          {isError ? (
            <Badge variant="high">ERROR</Badge>
          ) : statusValue === "queued" ? (
            <Badge variant="low">QUEUED</Badge>
          ) : (
            <Badge variant="info">RUNNING</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p className="text-sm text-red-400">{errorMessage ?? "An unknown error occurred."}</p>
        ) : (
          <div className="flex items-center gap-3">
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-xrp-400" />
            <span className="text-sm text-slate-300">
              {statusValue === "running" ? "Crawling XRPL…" : "Queued — waiting…"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
