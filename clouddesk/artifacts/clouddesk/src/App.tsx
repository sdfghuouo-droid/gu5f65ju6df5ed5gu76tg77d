import { useState, useEffect } from "react";
import { Shell } from "@/components/layout/Shell";
import LoginScreen from "@/components/auth/LoginScreen";
import Dashboard from "@/pages/Dashboard";
import ClientsList from "@/pages/ClientsList";
import ClientDetail from "@/pages/ClientDetail";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";
import { Route, Switch, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getMe } from "@/lib/auth";

const queryClient = new QueryClient();
const maxRetries = 3;

function Router() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/clients" component={ClientsList} />
        <Route path="/clients/:id" component={ClientDetail} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  const [authState, setAuthState] = useState<"loading" | "guest" | "authed">("loading");

  useEffect(() => {
    let cancelled = false;
    let retries = 0;

    async function check() {
      const me = await getMe();
      if (cancelled) return;
      if (me) {
        setAuthState("authed");
      } else if (retries < maxRetries) {
        retries += 1;
        setTimeout(check, 800);
      } else {
        setAuthState("guest");
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (authState === "loading") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="font-mono text-2xl text-primary animate-pulse">&gt;_</div>
        <div className="font-mono text-xs text-muted-foreground tracking-widest">HANDSHAKING WITH SECURE NODE...</div>
      </div>
    );
  }

  if (authState === "guest") {
    return <LoginScreen onSuccess={() => setAuthState("authed")} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;