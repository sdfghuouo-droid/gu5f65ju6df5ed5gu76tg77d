import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Terminal, LayoutDashboard, Server, Settings, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { logout } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Server },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("en-GB", { hour12: false }) + " UTC+" + (-new Date().getTimezoneOffset() / 60),
      );
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      window.location.reload();
    }
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border gap-3">
          <div className="bg-primary/10 p-1.5 rounded text-primary border border-primary/30">
            <Terminal size={20} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-lg tracking-tight text-primary text-shadow-[0_0_8px_rgba(0,255,65,0.6)]">
              CLOUD//DESK
            </span>
            <span className="text-[9px] text-muted-foreground font-mono tracking-widest">[ secure remote ops ]</span>
          </div>
          <Badge variant="outline" className="ml-auto text-[10px] bg-primary/5 text-primary border-primary/20">v2.4.1</Badge>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <div className="text-xs font-semibold text-muted-foreground mb-3 px-2 tracking-wider uppercase">// nav</div>
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 font-mono",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
                )}
              >
                <item.icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                <span className="tracking-wide">{isActive ? "> " : "  "}{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_6px_rgba(0,255,65,0.9)]" />
            <span className="text-xs text-muted-foreground font-mono">root@secure // online</span>
          </div>
          <div className="flex items-center gap-3 px-2">
            <ShieldCheck size={12} className="text-primary" />
            <span className="text-xs text-muted-foreground font-mono">{clock}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-2 py-1.5 w-full text-xs text-muted-foreground hover:text-destructive transition-colors font-mono"
          >
            <LogOut size={14} />
            logout --session
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background z-0" />
        <div className="flex-1 overflow-y-auto z-10 p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}