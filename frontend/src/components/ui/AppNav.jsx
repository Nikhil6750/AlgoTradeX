import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  BarChart2,
  Brain,
  Clock3,
  FlaskConical,
  LayoutDashboard,
  Menu,
  PlayCircle,
  TrendingUp,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/dashboard",     label: "Dashboard",    Icon: LayoutDashboard },
  { to: "/market-replay", label: "Market Replay", Icon: PlayCircle },
  { to: "/strategy-lab", label: "Strategy Lab",  Icon: FlaskConical },
  { to: "/backtests",    label: "Backtests",     Icon: Clock3 },
  { to: "/results",      label: "Results",       Icon: TrendingUp },
  { to: "/analytics",   label: "Analytics",     Icon: BarChart2 },
  { to: "/sentiment-lab", label: "Sentiment",   Icon: Brain },
];

function NavItems({ onNavigate = () => {} }) {
  return (
    <div className="flex-1 py-4">
      {NAV_ITEMS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `mx-3 mb-1 flex items-center gap-3 rounded-2xl px-4 py-3 text-[13px] font-medium transition ${
              isActive
                ? "border border-[#222222] bg-[#111111] text-white"
                : "text-[#a0a0a0] hover:bg-[#111111] hover:text-white"
            }`
          }
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
    </div>
  );
}

function SidebarContent({ onNavigate = () => {} }) {
  return (
    <>
      <div className="border-b border-[#222222] px-5 py-5">
        <span className="block text-sm font-black tracking-[0.18em] text-white">AlgoTradeX</span>
        <span className="mt-1 block text-[10px] uppercase tracking-[0.28em] text-[#a0a0a0]">
          Trading Intelligence Platform
        </span>
      </div>
      <NavItems onNavigate={onNavigate} />
    </>
  );
}

export default function AppNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-50 rounded-2xl border border-[#222222] bg-[#111111] p-3 text-white md:hidden"
      >
        <Menu size={18} />
      </button>

      <aside className="fixed left-0 top-0 z-50 hidden h-full w-[240px] border-r border-[#222222] bg-[#000000] md:flex md:flex-col">
        <SidebarContent />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/65"
          />
          <aside className="relative z-10 flex h-full w-[280px] flex-col border-r border-[#222222] bg-[#000000]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-full border border-[#222222] p-2 text-[#a0a0a0]"
            >
              <X size={16} />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
