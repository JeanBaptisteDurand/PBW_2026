import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";
import { useAuth } from "../../hooks/useAuth";
import sdk from "@crossmarkio/sdk";

const NAV_LINKS = [
  { to: "/home", label: "Home" },
  { to: "/corridors", label: "Corridor Atlas" },
  { to: "/safe-path", label: "Safe Path Agent" },
  { to: "/analyze", label: "Entity Audit" },
  { to: "/developers", label: "Docs" },
];

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isPremium, connect, logout } = useAuth();

  const handleConnect = async () => {
    try {
      // Check if Crossmark extension is available
      const installed = sdk.sync?.isInstalled?.() ?? false;
      if (!installed) {
        navigate("/premium");
        return;
      }
      const signIn = await sdk.methods.signInAndWait();
      const address = signIn?.response?.data?.address;
      if (address) {
        await connect(address);
      }
    } catch {
      navigate("/premium");
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-6 bg-slate-950/56 backdrop-blur-md border-b border-[color:var(--app-glass-panel-border)] shadow-[0_8px_26px_rgba(6,10,28,0.28)]">
      {/* Logo */}
      <NavLink
        to="/home"
        className="group flex items-center gap-3 select-none"
        aria-label="Go to corelens home"
      >
        <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-[rgba(151,214,239,0.5)] bg-[linear-gradient(145deg,#7ff2bf_8%,#8f9dff_56%,#6fd8b7_100%)] shadow-[0_8px_20px_rgba(72,128,173,0.35)] transition-transform duration-200 group-hover:scale-[1.04]">
          <span className="pointer-events-none absolute inset-[1px] rounded-[10px] bg-slate-950/28" />
          <span className="relative text-[0.72rem] font-black leading-none tracking-[-0.06em] text-white">
            CL
          </span>
        </div>
        <span className="bg-[linear-gradient(120deg,#7ff2bf_0%,#8f9dff_56%,#72e6a0_100%)] bg-clip-text text-base font-semibold tracking-[0.05em] lowercase text-transparent">
          corelens
        </span>
      </NavLink>

      {/* Nav Links */}
      <div className="flex items-center gap-1">
        {NAV_LINKS.map(({ to, label }) => {
          const isActive =
            to === "/home"
              ? location.pathname === "/home"
              : location.pathname.startsWith(to);

          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-[linear-gradient(145deg,color-mix(in_srgb,var(--page-accent-500)_16%,transparent),color-mix(in_srgb,var(--page-accent-700)_18%,transparent))] text-[color:var(--page-accent-300)] border border-[color:color-mix(in_srgb,var(--page-accent-300)_52%,transparent)]"
                  : "text-slate-300 hover:text-slate-100 hover:bg-slate-900/60 border border-transparent hover:border-slate-700/50",
              )}
            >
              {label}
            </NavLink>
          );
        })}
      </div>

      {/* Wallet / Auth */}
      <div className="flex items-center gap-2">
        {user ? (
          <>
            {isPremium && (
              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-500/16 text-emerald-300 border border-emerald-500/32">
                Premium
              </span>
            )}
            <button
              onClick={() => navigate("/account")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 border",
                isPremium
                  ? "bg-slate-900/52 border-[color:var(--app-glass-panel-border)] text-slate-300 hover:bg-slate-900/72"
                  : "btn-primary-themed text-white border-[color:color-mix(in_srgb,var(--page-accent-400)_44%,transparent)]",
              )}
            >
              {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
            </button>
            <button
              onClick={logout}
              className="px-2.5 py-1.5 rounded-md text-[11px] text-slate-500 hover:text-slate-200 hover:bg-slate-900/60 transition-all duration-150"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={handleConnect}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 btn-primary-themed text-white border border-[color:color-mix(in_srgb,var(--page-accent-400)_44%,transparent)]"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  );
}
