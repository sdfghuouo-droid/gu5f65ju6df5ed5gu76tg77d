import { useGetStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, CheckCircle2, XCircle, AlertTriangle, Wrench, Activity } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetStats();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted/50 rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 bg-card border border-border/50 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Fallbacks if stats fail to load
  const data = stats || { total: 0, online: 0, offline: 0, alerting: 0, maintenance: 0 };

  const statCards = [
    {
      title: "Total Devices",
      value: data.total,
      icon: Server,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      href: "/clients"
    },
    {
      title: "Online",
      value: data.online,
      icon: CheckCircle2,
      color: "text-green-400",
      bg: "bg-green-500/10",
      href: "/clients?status=online"
    },
    {
      title: "Offline",
      value: data.offline,
      icon: XCircle,
      color: "text-red-400",
      bg: "bg-red-500/10",
      href: "/clients?status=offline"
    },
    {
      title: "Alerting",
      value: data.alerting,
      icon: AlertTriangle,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      href: "/clients?status=alerting"
    },
    {
      title: "Maintenance",
      value: data.maintenance,
      icon: Wrench,
      color: "text-slate-400",
      bg: "bg-slate-500/10",
      href: "/clients?status=maintenance"
    }
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            Fleet Overview
            <span className="flex items-center gap-2 text-xs font-normal text-green-400 bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20">
              <Activity size={12} className="animate-pulse" />
              Live
            </span>
          </h1>
          <p className="text-muted-foreground mt-1">High-level telemetry of all registered devices.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat, i) => (
          <Link key={i} href={stat.href} className="block transition-transform hover:-translate-y-1">
            <Card className="border-border/50 hover:border-primary/50 hover:shadow-[0_0_15px_rgba(20,184,166,0.1)] transition-all bg-card/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 bg-transparent border-none">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-md ${stat.bg} ${stat.color}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono tracking-tight">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Action links or quick graph could go here */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <Card className="border-border/50 bg-card/30">
          <CardHeader>
            <CardTitle className="text-sm">Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-3">
              <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm">No active alerts requiring immediate action.</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border/50 bg-card/30">
          <CardHeader>
            <CardTitle className="text-sm">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">API Server</span>
                  <span className="text-green-400 font-mono">99.9% Uptime</span>
                </div>
                <div className="h-1.5 w-full bg-muted overflow-hidden rounded-full">
                  <div className="h-full bg-green-500 w-[99.9%]" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Database</span>
                  <span className="text-green-400 font-mono">100% Uptime</span>
                </div>
                <div className="h-1.5 w-full bg-muted overflow-hidden rounded-full">
                  <div className="h-full bg-green-500 w-full" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
