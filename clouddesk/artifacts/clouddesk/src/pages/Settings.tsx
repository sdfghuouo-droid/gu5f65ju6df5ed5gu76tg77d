export default function Settings() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage global configuration for CloudDesk.</p>
      </div>

      <div className="bg-card border border-border/50 rounded-lg p-8 text-center border-dashed">
        <h3 className="text-lg font-medium text-foreground mb-2">Configuration not available in preview</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Settings are read-only in this environment. System administrators can configure advanced properties via the core configuration files.
        </p>
      </div>
    </div>
  );
}
