import { useState, useMemo } from "react";
import { useListClients, ListClientsStatus } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Search, Download, LayoutGrid, List as ListIcon, Terminal,
  MonitorSmartphone, Plus, Copy, Check, ChevronRight
} from "lucide-react";
import { timeAgo } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";

// ─── Build the PS1 agent script ───────────────────────────────────────────────
function buildAgentPs1(serverUrl: string): string {
  return `# CloudDesk Agent - auto-installed by clouddesk-setup.bat
$ServerUrl  = "${serverUrl}"
$ConfigFile = "C:\\ProgramData\\CloudDesk\\agent.json"
$LogFile    = "C:\\ProgramData\\CloudDesk\\agent.log"

function Write-Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    try { Add-Content -Path $LogFile -Value $line -ErrorAction SilentlyContinue } catch {}
}

function Get-LocalIP {
    try {
        (Get-NetIPAddress -AddressFamily IPv4 |
         Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -ne "WellKnown" } |
         Select-Object -First 1).IPAddress
    } catch { "unknown" }
}

function Get-OSCaption {
    try { (Get-CimInstance Win32_OperatingSystem).Caption }
    catch { $env:OS }
}

if (-not (Test-Path $ConfigFile)) {
    Write-Log "Registering with CloudDesk..."
    $body = @{
        hostname     = $env:COMPUTERNAME
        username     = $env:USERNAME
        os           = (Get-OSCaption)
        agentVersion = "v1.0.0"
        ipAddress    = (Get-LocalIP)
    } | ConvertTo-Json

    try {
        $reg = Invoke-RestMethod -Uri "$ServerUrl/api/clients/register" -Method Post -Body $body -ContentType "application/json"
        $reg | ConvertTo-Json | Out-File $ConfigFile -Encoding utf8
        Write-Log "Registered OK. ClientID: $($reg.clientId)"
    } catch {
        Write-Log "Registration FAILED: $_"
        Start-Sleep -Seconds 30
        exit 1
    }
}

$cfg = Get-Content $ConfigFile | ConvertFrom-Json
Write-Log "Agent running. ClientID: $($cfg.clientId)"

while ($true) {
    try {
        $cpu = [math]::Round((Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average, 1)

        $osObj    = Get-CimInstance Win32_OperatingSystem
        $ramTotal = [math]::Round($osObj.TotalVisibleMemorySize / 1MB, 2)
        $ram      = [math]::Round($ramTotal - ($osObj.FreePhysicalMemory / 1MB), 2)

        $dsk       = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
        $diskTotal = [math]::Round($dsk.Size / 1GB, 2)
        $disk      = [math]::Round(($dsk.Size - $dsk.FreeSpace) / 1GB, 2)

        $hb = @{
            clientId  = $cfg.clientId
            token     = $cfg.token
            cpu       = $cpu
            ram       = $ram
            ramTotal  = $ramTotal
            disk      = $disk
            diskTotal = $diskTotal
            ipAddress = (Get-LocalIP)
        } | ConvertTo-Json

        try {
            $resp = Invoke-RestMethod -Uri "$ServerUrl/api/agents/heartbeat" -Method Post -Body $hb -ContentType "application/json" -ErrorAction Stop
        } catch {
            # If 401 (token rejected / device removed from dashboard) — re-register
            if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 401) {
                Write-Log "Token rejected (401). Re-registering..."
                Remove-Item $ConfigFile -Force -ErrorAction SilentlyContinue
                $body = @{
                    hostname     = $env:COMPUTERNAME
                    username     = $env:USERNAME
                    os           = (Get-OSCaption)
                    agentVersion = "v1.0.0"
                    ipAddress    = (Get-LocalIP)
                } | ConvertTo-Json
                $reg = Invoke-RestMethod -Uri "$ServerUrl/api/clients/register" -Method Post -Body $body -ContentType "application/json"
                $reg | ConvertTo-Json | Out-File $ConfigFile -Encoding utf8
                $cfg = $reg
                Write-Log "Re-registered OK. New ClientID: $($cfg.clientId)"
                Start-Sleep -Seconds 5
                continue
            }
            throw
        }

        foreach ($cmd in $resp.pendingCommands) {
            Write-Log "CMD >> $($cmd.command)"
            try {
                # Route through cmd.exe if the command uses && or || (not valid in PS)
                if ($cmd.command -match '&&|\|\|') {
                    $out      = cmd /c $cmd.command 2>&1 | Out-String
                } else {
                    $out      = Invoke-Expression $cmd.command 2>&1 | Out-String
                }
                $exitCode = if ($LASTEXITCODE) { $LASTEXITCODE } else { 0 }
                $status   = "completed"
            } catch {
                $out      = $_.ToString()
                $exitCode = 1
                $status   = "failed"
            }
            $res = @{
                commandId   = $cmd.id
                clientToken = $cfg.token
                output      = $out
                exitCode    = $exitCode
                status      = $status
            } | ConvertTo-Json
            Invoke-RestMethod -Uri "$ServerUrl/api/agents/command-result" -Method Post -Body $res -ContentType "application/json" | Out-Null
            Write-Log "CMD done [$status]"
        }
    } catch {
        Write-Log "Heartbeat error: $_"
    }
    Start-Sleep -Seconds 10
}
`;
}

// ─── Build a self-elevating .bat installer ────────────────────────────────────
// The BAT: double-click → auto-elevates → writes agent.ps1 → registers
// as a Windows Scheduled Task (runs at system start as SYSTEM) → starts now.
function buildInstallerBat(serverUrl: string): string {
  const ps1 = buildAgentPs1(serverUrl);
  const b64 = btoa(unescape(encodeURIComponent(ps1)));

  return `@echo off
setlocal

:: ── Auto-elevate to Administrator ──────────────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    PowerShell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo   CloudDesk Agent Installer
echo   =========================
echo   Server: ${serverUrl}
echo.

:: ── Create install directory ────────────────────────────────────────────────
set "INSTALL=C:\\ProgramData\\CloudDesk"
if not exist "%INSTALL%" mkdir "%INSTALL%"

:: ── Test connectivity to server ──────────────────────────────────────────────
echo   [0/3] Testing connection to server...
PowerShell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r = Invoke-WebRequest -Uri '${serverUrl}/api/healthz' -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop; Write-Host '  OK - server reachable (HTTP ' $r.StatusCode ')' } catch { Write-Host '  WARN - could not reach server: ' $_.Exception.Message }"

:: ── Write agent.ps1 from embedded base64 ────────────────────────────────────
echo   [1/3] Writing agent script...
PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$b='${b64}';[IO.File]::WriteAllBytes('%INSTALL%\\agent.ps1',[System.Text.Encoding]::UTF8.GetBytes([System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b))))"

if not exist "%INSTALL%\\agent.ps1" (
    echo.
    echo   ERROR: Could not write agent script to %INSTALL%
    echo   Check that you have write access to C:\\ProgramData
    echo.
    pause
    exit /b 1
)
echo   Script written OK.

:: ── Register as a Scheduled Task (auto-start at boot) ───────────────────────
echo   [2/3] Registering scheduled task...
schtasks /delete /tn "CloudDesk Agent" /f >nul 2>&1
schtasks /create /tn "CloudDesk Agent" /sc onstart /delay 0000:30 /ru "SYSTEM" /rl HIGHEST /tr "PowerShell.exe -WindowStyle Hidden -NonInteractive -ExecutionPolicy Bypass -File \\"%INSTALL%\\agent.ps1\\"" /f
if %errorLevel% neq 0 (
    echo   WARNING: Scheduled task registration failed. Agent will not auto-start on boot.
    echo   You can run it manually: PowerShell -ExecutionPolicy Bypass -File "%INSTALL%\\agent.ps1"
)

:: ── First-run: register with server NOW (visible, so you can see errors) ────
echo   [3/3] Starting agent (first registration)...
echo   This window will stay open for 15 seconds then close.
echo   Check below for registration result:
echo.
PowerShell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$log='%INSTALL%\\agent.log'; Remove-Item $log -ErrorAction SilentlyContinue; Start-Process PowerShell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%INSTALL%\\agent.ps1\"' -NoNewWindow:$false; Start-Sleep 8; if (Test-Path $log) { Get-Content $log } else { Write-Host '  (no log yet - agent may still be starting)' }"

echo.
echo   ── Agent log (C:\\ProgramData\\CloudDesk\\agent.log) ──
if exist "%INSTALL%\\agent.log" (
    PowerShell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content '%INSTALL%\\agent.log' | Select-Object -Last 20"
) else (
    echo   (log not created yet)
)

echo.
echo   If the device does not appear in CloudDesk within 30 seconds,
echo   open %INSTALL%\\agent.log for details.
echo.
timeout /t 15
exit /b 0
`;
}

// ─── Add Device Dialog ────────────────────────────────────────────────────────
function AddDeviceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const serverUrl = window.location.origin;

  function handleDownload() {
    const bat = buildInstallerBat(serverUrl);
    const blob = new Blob([bat], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clouddesk-setup.bat";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCopyPs1() {
    navigator.clipboard.writeText(buildAgentPs1(serverUrl));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-4 w-4 text-primary" />
            Connect a New Device
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Install the CloudDesk agent on any Windows machine to bring it online.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Steps */}
          {[
            {
              n: "1",
              title: "Download the installer",
              body: (
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={handleDownload}
                    className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30"
                    variant="outline"
                    data-testid="button-download-agent"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download clouddesk-setup.bat
                  </Button>
                  <Button
                    onClick={handleCopyPs1}
                    variant="outline"
                    size="icon"
                    title="Copy raw agent script"
                    className="border-border bg-muted/30 shrink-0"
                    data-testid="button-copy-agent"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              ),
            },
            {
              n: "2",
              title: "Double-click the file on the target machine",
              body: (
                <div className="mt-3 bg-background/80 border border-border/50 rounded-md p-3 font-mono text-[11px] leading-relaxed space-y-1.5">
                  <p className="text-primary">clouddesk-setup.bat → double-click (or right-click → Open)</p>
                  <p className="text-muted-foreground">Windows will ask for Admin permission — click Yes.</p>
                  <p className="text-muted-foreground">The installer runs, registers the device, and installs itself as a background service that starts automatically with Windows.</p>
                </div>
              ),
            },
            {
              n: "3",
              title: "Device appears in the fleet automatically",
              body: (
                <p className="mt-1 text-sm text-muted-foreground">
                  The agent registers and sends a heartbeat every 10 seconds with
                  live CPU / RAM / Disk metrics. The machine appears in the Clients
                  list within seconds — and reconnects automatically after every reboot.
                </p>
              ),
            },
          ].map((step) => (
            <div key={step.n} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                  {step.n}
                </div>
                <div className="w-px flex-1 bg-border/40 my-1" />
              </div>
              <div className="pb-4 flex-1">
                <p className="font-semibold text-sm text-foreground">{step.title}</p>
                {step.body}
              </div>
            </div>
          ))}

          {/* Server URL info */}
          <div className="bg-muted/20 border border-border/40 rounded-md px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground font-mono">Server URL embedded in script:</span>
            <span className="text-xs font-mono text-primary truncate">{serverUrl}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClientsList() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialStatus = (urlParams.get("status") as ListClientsStatus) || "all";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListClientsStatus | "all">(initialStatus);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [addOpen, setAddOpen] = useState(false);

  const apiStatus = statusFilter === "all" ? undefined : statusFilter;
  const { data: clients, isLoading } = useListClients({ status: apiStatus });

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter(c =>
      c.hostname.toLowerCase().includes(q) ||
      (c.ipAddress && c.ipAddress.toLowerCase().includes(q)) ||
      (c.os && c.os.toLowerCase().includes(q))
    );
  }, [clients, search]);

  const StatusDot = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      online: "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]",
      offline: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]",
      alerting: "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]",
      maintenance: "bg-slate-400",
    };
    return <div className={`w-2 h-2 rounded-full ${colors[status] ?? "bg-slate-400"}`} />;
  };

  const ResourceBar = ({ value, label }: { value?: number | null; label: string }) => {
    if (typeof value !== "number") return <span className="text-muted-foreground text-xs">-</span>;
    const isHigh = value > 85;
    const isMed = value > 70;
    return (
      <div className="flex items-center gap-2 w-full max-w-[120px]">
        <span className="text-[10px] w-6 text-muted-foreground font-mono">{label}</span>
        <Progress
          value={value}
          className="h-1.5 bg-muted"
          indicatorClassName={isHigh ? "bg-destructive" : isMed ? "bg-yellow-500" : "bg-primary"}
        />
        <span className="text-[10px] w-8 text-right font-mono">{Math.round(value)}%</span>
      </div>
    );
  };

  const handleExportCSV = () => {
    if (!filteredClients.length) return;
    const headers = ["Hostname", "IP", "OS", "Status", "Health", "CPU", "RAM", "Disk", "Last Seen"];
    const rows = filteredClients.map(c => [
      c.hostname, c.ipAddress || "", c.os || "", c.status, c.health || "",
      c.cpu ? `${c.cpu}%` : "",
      c.ram && c.ramTotal ? `${Math.round((c.ram / c.ramTotal) * 100)}%` : "",
      c.disk && c.diskTotal ? `${Math.round((c.disk / c.diskTotal) * 100)}%` : "",
      c.lastSeen ? new Date(c.lastSeen).toISOString() : "",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `clients-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <AddDeviceDialog open={addOpen} onClose={() => setAddOpen(false)} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MonitorSmartphone className="h-6 w-6 text-primary" />
            Device Fleet
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage and monitor all connected agents.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setAddOpen(true)}
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="button-add-device"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Device
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="border-border bg-card">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <div className="flex border border-border rounded-md overflow-hidden">
            <Button
              variant="ghost" size="icon"
              className={`rounded-none h-8 w-8 ${viewMode === "list" ? "bg-primary/20 text-primary" : ""}`}
              onClick={() => setViewMode("list")}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className={`rounded-none h-8 w-8 ${viewMode === "grid" ? "bg-primary/20 text-primary" : ""}`}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search hostname, IP, OS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border/50"
            data-testid="input-search-clients"
          />
        </div>
        <div className="w-[180px]">
          <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
            <SelectTrigger className="bg-card border-border/50">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="alerting">Alerting</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-card border border-border/50 rounded-md" />
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <Card className="border-border/50 bg-card/30 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MonitorSmartphone className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-foreground">No devices found</p>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              {search || statusFilter !== "all"
                ? "Try adjusting your filters or search query."
                : "Click \"Add Device\" to connect your first machine."}
            </p>
            {!search && statusFilter === "all" && (
              <Button
                onClick={() => setAddOpen(true)}
                className="mt-4 bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Device
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "list" ? (
        <Card className="border-border/50 overflow-hidden bg-card/50">
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[250px]">Hostname</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>OS</TableHead>
                <TableHead className="w-[150px]">Resources</TableHead>
                <TableHead className="text-right">Last Seen</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow key={client.id} className="group">
                  <TableCell>
                    <Link href={`/clients/${client.id}`} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Terminal size={14} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground group-hover:text-primary transition-colors cursor-pointer tracking-tight">
                          {client.hostname}
                        </span>
                        {client.group && (
                          <span className="text-[10px] text-muted-foreground uppercase">{client.group}</span>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusDot status={client.status} />
                      <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                        {client.status}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {client.ipAddress || "-"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {client.os || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1.5">
                      <ResourceBar label="CPU" value={client.cpu} />
                      <ResourceBar
                        label="RAM"
                        value={client.ram && client.ramTotal ? (client.ram / client.ramTotal) * 100 : undefined}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                    {timeAgo(client.lastSeen)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/clients/${client.id}`}>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredClients.map((client) => (
            <Card key={client.id} className="border-border/50 bg-card hover:border-primary/50 transition-colors group">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Terminal size={18} />
                    </div>
                    <div>
                      <Link href={`/clients/${client.id}`} className="font-semibold text-foreground hover:text-primary transition-colors cursor-pointer tracking-tight block">
                        {client.hostname}
                      </Link>
                      <div className="flex items-center gap-1.5 mt-1">
                        <StatusDot status={client.status} />
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                          {client.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-4 text-xs font-mono text-muted-foreground bg-muted/20 p-3 rounded-md border border-border/30">
                  <div className="flex justify-between">
                    <span>IP</span>
                    <span className="text-foreground">{client.ipAddress || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>OS</span>
                    <span className="text-foreground truncate max-w-[120px]">{client.os || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Seen</span>
                    <span className="text-foreground">{timeAgo(client.lastSeen)}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/50">
                  <ResourceBar label="CPU" value={client.cpu} />
                  <ResourceBar
                    label="RAM"
                    value={client.ram && client.ramTotal ? (client.ram / client.ramTotal) * 100 : undefined}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
