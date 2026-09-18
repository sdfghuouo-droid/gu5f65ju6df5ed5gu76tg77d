import { Link } from "wouter";
import { Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center text-muted-foreground border border-border/50">
        <Terminal size={32} />
      </div>
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tighter">404</h1>
        <h2 className="text-xl font-medium text-muted-foreground">System not found</h2>
        <p className="text-sm text-muted-foreground max-w-[300px] mx-auto mt-2">
          The node or page you are trying to access does not exist or has been decommissioned.
        </p>
      </div>
      <Button asChild className="mt-4">
        <Link href="/">Return to Control Center</Link>
      </Button>
    </div>
  );
}
