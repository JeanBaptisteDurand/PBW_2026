import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth.js";
import { Button } from "./button.js";

export function PremiumGate({ children }: { children: ReactNode }): JSX.Element {
  const { user, isPremium } = useAuth();
  const navigate = useNavigate();

  if (!user || !isPremium) {
    return (
      <div className="relative">
        <div className="pointer-events-none opacity-20 blur-sm select-none">{children}</div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="app-glass-surface rounded-2xl px-8 py-10 text-center max-w-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--page-accent-500)_16%,transparent)] border border-[color:color-mix(in_srgb,var(--page-accent-400)_30%,transparent)]">
              <svg
                className="h-5 w-5 text-[color:var(--page-accent-400)]"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-100">Premium Feature</h3>
            <p className="mb-6 text-sm text-slate-400">
              Unlock with a one-time XRP or RLUSD payment on XRPL
            </p>
            <Button onClick={() => navigate("/premium")}>Unlock Premium</Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
