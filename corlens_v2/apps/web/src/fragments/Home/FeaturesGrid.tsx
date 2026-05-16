import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

interface FeatureItem {
  title: string;
  description: string;
  icon: string;
  badge: string;
}

interface FeaturesGridProps {
  features: FeatureItem[];
}

export function FeaturesGrid({ features }: FeaturesGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {features.map((feature) => (
        <Card
          key={feature.title}
          className="group relative overflow-hidden transition-all duration-200 hover:border-xrp-700/60 hover:shadow-lg hover:shadow-xrp-900/20"
        >
          <div
            aria-hidden
            className="home-feature-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
          <CardHeader>
            <div className="flex items-center justify-between">
              <span className="text-2xl text-xrp-400">{feature.icon}</span>
              <Badge variant="info">{feature.badge}</Badge>
            </div>
            <CardTitle className="mt-3">{feature.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-slate-400">{feature.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
