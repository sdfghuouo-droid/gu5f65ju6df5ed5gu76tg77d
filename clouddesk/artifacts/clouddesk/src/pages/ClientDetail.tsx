import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { 
  useGetClient, 
  useListCommands, 
  useRunCommand, 
  useGetCommand,
  useListFiles,
  useUpdateClient,
  useDeleteClient,
  getGetClientQueryKey,
  getListCommandsQueryKey,
  getGetCommandQueryKey,
  Client,
  Command,
  FileEntry,
  CommandStatus,
  ClientUpdateStatus
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatBytes, timeAgo, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { 
  Terminal, Activity, HardDrive, Cpu, MemoryStick, ArrowLeft, 
  Play, File as FileIcon, Folder, ChevronRight, AlertTriangle, CheckCircle2,
  Trash2, Wrench
} from "lucide-react";
import { Link } from "wouter";

// Helper for status dot
const StatusDot = ({ status }: { status: string }) => {
  const colors = {
    online: "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]",
    offline: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]",
    alerting: "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]",
    maintenance: "bg-slate-400"
  };
  return (
    <div className={`w-2.5 h-2.5 rounded-full ${colors[status as keyof typeof colors] || "bg-slate-400"}`} />
  );
};

export default function ClientDetail() {
  const params = useParams();
  const id = params.id as string;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: client, isLoading: isClientLoading } = useGetClient(id, {
    query: {
      enabled: !!id,
      queryKey: getGetClientQueryKey(id)
    }
  });

  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const handleToggleMaintenance = () => {
    if (!client) return;
    const newStatus: ClientUpdateStatus = client.status === 'maintenance' ? 'online' : 'maintenance';
    updateClient.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: (updatedData) => {
          queryClient.setQueryData(getGetClientQueryKey(id), updatedData);
          toast({ title: `Client marked as ${newStatus}` });
        },
        onError: () => {
          toast({ title: "Failed to update status", variant: "destructive" });
        }
      }
    );
  };

  const handleDelete = () => {
    if (!client || !window.confirm(`Are you sure you want to remove ${client.hostname} from the fleet?`)) return;
    deleteClient.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Client removed from fleet" });
          setLocation("/clients");
        },
        onError: () => {
          toast({ title: "Failed to remove client", variant: "destructive" });
        }
      }
    );
  };

  if (isClientLoading || !client) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
        <div className="h-12 bg-muted/50 rounded w-1/3" />
        <div className="h-[400px] bg-card border border-border/50 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-start justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="h-10 w-10 shrink-0 rounded-full bg-card border border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30">
            <Link href="/clients"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Terminal className="h-6 w-6 text-primary" />
                {client.hostname}
              </h1>
              <Badge variant="outline" className="uppercase text-[10px] tracking-wider px-2 py-0.5 border-border/50 bg-card">
                {client.os || 'Unknown OS'}
              </Badge>
              {client.group && (
                <Badge variant="secondary" className="uppercase text-[10px] tracking-wider px-2 py-0.5 bg-primary/10 text-primary border-transparent">
                  {client.group}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground font-mono">
              <span className="flex items-center gap-1.5 text-foreground bg-muted/30 px-2 py-0.5 rounded border border-border/50">
                <StatusDot status={client.status} />
                <span className="uppercase text-[10px] font-bold tracking-wider">{client.status}</span>
              </span>
              <span>IP: {client.ipAddress || 'Unknown'}</span>
              <span>ID: {client.id.split('-')[0]}</span>
              <span>Last seen: {timeAgo(client.lastSeen)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleToggleMaintenance}
            disabled={updateClient.isPending}
            className="border-border bg-card text-muted-foreground hover:text-foreground"
          >
            <Wrench className="h-4 w-4 mr-2" />
            {client.status === 'maintenance' ? 'Exit Maintenance' : 'Maintenance Mode'}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDelete}
            disabled={deleteClient.isPending}
            className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove Agent
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="bg-card border border-border/50 p-1 shrink-0 w-fit">
          <TabsTrigger value="overview" className="gap-2 px-4 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Activity className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="console" className="gap-2 px-4 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Terminal className="h-4 w-4" /> Console
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-2 px-4 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <HardDrive className="h-4 w-4" /> Filesystem
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 mt-4 overflow-hidden relative">
          <TabsContent value="overview" className="h-full m-0 overflow-y-auto pr-2">
            <OverviewTab client={client} />
          </TabsContent>
          
          <TabsContent value="console" className="h-full m-0 flex flex-col">
            <ConsoleTab clientId={client.id} />
          </TabsContent>
          
          <TabsContent value="files" className="h-full m-0 flex flex-col">
            <FilesTab clientId={client.id} onRunCommand={() => {
              setActiveTab("console");
            }} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// --- Overview Tab ---
function OverviewTab({ client }: { client: Client }) {
  const StatBlock = ({ icon: Icon, title, value, subValue, percent }: any) => (
    <Card className="bg-card border-border/50">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground font-medium text-sm">
              <Icon className="h-4 w-4" /> {title}
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight">{value}</div>
            {subValue && <div className="text-xs text-muted-foreground">{subValue}</div>}
          </div>
          {percent !== undefined && (
            <div className="w-12 h-12 rounded-full border-4 border-muted flex items-center justify-center relative">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className={`${percent > 85 ? 'text-destructive' : percent > 70 ? 'text-yellow-500' : 'text-primary'}`}
                  strokeDasharray={`${percent}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"
                />
              </svg>
              <span className="text-[10px] font-mono font-bold absolute">{Math.round(percent)}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatBlock 
          icon={Cpu} 
          title="CPU Usage" 
          value={`${Math.round(client.cpu || 0)}%`} 
          percent={client.cpu || 0} 
        />
        <StatBlock 
          icon={MemoryStick} 
          title="Memory" 
          value={client.ram ? `${client.ram.toFixed(1)} GB` : '-'} 
          subValue={client.ramTotal ? `of ${client.ramTotal.toFixed(1)} GB total` : ''}
          percent={client.ram && client.ramTotal ? (client.ram / client.ramTotal) * 100 : 0} 
        />
        <StatBlock 
          icon={HardDrive} 
          title="Disk Space" 
          value={client.disk ? `${client.disk.toFixed(1)} GB` : '-'} 
          subValue={client.diskTotal ? `of ${client.diskTotal.toFixed(1)} GB total` : ''}
          percent={client.disk && client.diskTotal ? (client.disk / client.diskTotal) * 100 : 0} 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-base">System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 py-2 border-b border-border/50 text-sm">
                <span className="text-muted-foreground">Hostname</span>
                <span className="col-span-2 font-mono text-foreground">{client.hostname}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b border-border/50 text-sm">
                <span className="text-muted-foreground">Operating System</span>
                <span className="col-span-2 font-mono text-foreground">{client.os || '-'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b border-border/50 text-sm">
                <span className="text-muted-foreground">IP Address</span>
                <span className="col-span-2 font-mono text-foreground">{client.ipAddress || '-'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b border-border/50 text-sm">
                <span className="text-muted-foreground">Agent Version</span>
                <span className="col-span-2 font-mono text-foreground">{client.agentVersion || '-'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 text-sm">
                <span className="text-muted-foreground">Tags</span>
                <div className="col-span-2 flex flex-wrap gap-1.5">
                  {client.tags && client.tags.length > 0 ? (
                    client.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="bg-muted text-muted-foreground font-mono text-[10px]">{tag}</Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-xs italic">No tags</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Health Status</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-muted/20">
               {client.health === 'critical' ? (
                 <AlertTriangle className="h-10 w-10 text-destructive shrink-0" />
               ) : client.health === 'warning' ? (
                 <AlertTriangle className="h-10 w-10 text-yellow-500 shrink-0" />
               ) : (
                 <CheckCircle2 className="h-10 w-10 text-green-500 shrink-0" />
               )}
               <div>
                 <h4 className="font-semibold capitalize text-foreground">{client.health || 'good'}</h4>
                 <p className="text-sm text-muted-foreground mt-1">
                   {client.health === 'critical' 
                     ? 'System requires immediate attention. Resources critically high.'
                     : client.health === 'warning'
                     ? 'System is showing warning signs. Review resources.'
                     : 'All systems operational. Telemetry normal.'}
                 </p>
               </div>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Console Tab ---
function ConsoleTab({ clientId }: { clientId: string }) {
  const [cmdInput, setCmdInput] = useState("");
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [pollingCmdId, setPollingCmdId] = useState<string | null>(null);

  const { data: commands = [], isLoading: isLoadingCmds } = useListCommands(clientId, {
    query: {
      enabled: !!clientId,
      queryKey: getListCommandsQueryKey(clientId),
      refetchInterval: pollingCmdId ? false : 5000 // Poll list occasionally if not polling specific
    }
  });

  const runCommand = useRunCommand();
  const { data: polledCommand } = useGetCommand(clientId, pollingCmdId || "", {
    query: {
      enabled: !!pollingCmdId,
      queryKey: getGetCommandQueryKey(clientId, pollingCmdId || ""),
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status === 'completed' || status === 'failed' || status === 'timeout') {
          return false;
        }
        return 1500;
      }
    }
  });

  useEffect(() => {
    if (polledCommand) {
      if (['completed', 'failed', 'timeout'].includes(polledCommand.status)) {
        setPollingCmdId(null);
        queryClient.invalidateQueries({ queryKey: getListCommandsQueryKey(clientId) });
      } else {
        queryClient.setQueryData(getListCommandsQueryKey(clientId), (old: any) => {
          if (!old) return old;
          return old.map((c: Command) => c.id === polledCommand.id ? polledCommand : c);
        });
      }
    }
  }, [polledCommand, clientId, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [commands]);

  const handleRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmdInput.trim() || runCommand.isPending) return;
    
    const input = cmdInput;
    setCmdInput("");
    
    runCommand.mutate({ id: clientId, data: { command: input } }, {
      onSuccess: (newCmd) => {
        setPollingCmdId(newCmd.id);
        queryClient.invalidateQueries({ queryKey: getListCommandsQueryKey(clientId) });
      }
    });
  };

  return (
    <Card className="flex flex-col h-full bg-[#0a0f18] border-border/50 rounded-md overflow-hidden">
      <div className="bg-[#121a28] border-b border-border/30 p-2 flex items-center gap-2 shrink-0">
        <div className="flex gap-1.5 ml-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <div className="text-xs font-mono text-muted-foreground ml-4">root@{clientId.split('-')[0]}:~#</div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
        {isLoadingCmds ? (
          <div className="text-muted-foreground/50">Connecting to agent console...</div>
        ) : (
          <div className="space-y-6">
            {[...commands].reverse().map(cmd => (
              <div key={cmd.id} className="space-y-1">
                <div className="flex items-center gap-2 text-primary/80">
                  <span className="text-green-500/60">➜</span>
                  <span className="text-blue-400 font-bold">~</span>
                  <span className="text-white">{cmd.command}</span>
                  
                  {cmd.status === 'pending' || cmd.status === 'running' ? (
                     <Badge variant="outline" className="ml-2 text-[10px] bg-yellow-500/10 text-yellow-500 border-transparent animate-pulse h-4 py-0">running</Badge>
                  ) : cmd.status === 'failed' ? (
                     <Badge variant="outline" className="ml-2 text-[10px] bg-red-500/10 text-red-500 border-transparent h-4 py-0">failed {cmd.exitCode !== null ? `(${cmd.exitCode})` : ''}</Badge>
                  ) : cmd.status === 'timeout' ? (
                     <Badge variant="outline" className="ml-2 text-[10px] bg-slate-500/10 text-slate-400 border-transparent h-4 py-0">timeout</Badge>
                  ) : null}
                </div>
                
                {cmd.output && (
                  <div className="text-slate-300 whitespace-pre-wrap break-all mt-1 bg-black/40 p-2 rounded-sm border border-white/5">
                    {cmd.output}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="p-3 bg-[#121a28] border-t border-border/30 shrink-0">
        <form onSubmit={handleRun} className="flex items-center gap-2">
          <span className="text-green-500 font-mono pl-2">➜</span>
          <Input 
            value={cmdInput}
            onChange={(e) => setCmdInput(e.target.value)}
            placeholder="Enter command..."
            className="flex-1 bg-transparent border-none text-white font-mono focus-visible:ring-0 px-2 h-10 shadow-none"
            autoFocus
            disabled={runCommand.isPending}
          />
          <Button type="submit" size="icon" disabled={!cmdInput.trim() || runCommand.isPending} className="bg-primary/20 text-primary hover:bg-primary/30 h-8 w-8">
            <Play className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}

// --- Filesystem Tab ---
function FilesTab({ clientId, onRunCommand }: { clientId: string, onRunCommand: (cmd: string) => void }) {
  const { data: files = [], isLoading } = useListFiles(clientId, {
    query: {
      enabled: !!clientId
    }
  });
  const runCommand = useRunCommand();
  const queryClient = useQueryClient();

  const handleFolderClick = (path: string) => {
    runCommand.mutate({ id: clientId, data: { command: `ls -la "${path}"` } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCommandsQueryKey(clientId) });
        onRunCommand(`ls -la "${path}"`);
      }
    });
  };

  return (
    <Card className="flex flex-col h-full bg-card border-border/50 rounded-md overflow-hidden">
      <div className="p-3 border-b border-border/50 bg-muted/20 flex items-center gap-2 text-sm font-mono text-muted-foreground shrink-0">
        <HardDrive className="h-4 w-4" />
        <span className="text-foreground">/</span>
        <span>root directory</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-0">
        {isLoading ? (
          <div className="p-8 space-y-4 animate-pulse">
            {[1,2,3,4].map(i => <div key={i} className="h-10 bg-muted/30 rounded" />)}
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
            <Folder className="h-12 w-12 opacity-20 mb-4" />
            <p>No files found or unable to read directory.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-mono text-xs sticky top-0 backdrop-blur-md">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Size</th>
                <th className="px-4 py-2 font-medium">Modified</th>
              </tr>
            </thead>
            <tbody>
              {files.sort((a, b) => {
                if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                return a.isDirectory ? -1 : 1;
              }).map((file, i) => (
                <tr key={i} className="border-b border-border/20 hover:bg-muted/30 group transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {file.isDirectory ? (
                        <Folder className="h-4 w-4 text-blue-400 fill-blue-500/20" />
                      ) : (
                        <FileIcon className="h-4 w-4 text-slate-400" />
                      )}
                      {file.isDirectory ? (
                        <button 
                          onClick={() => handleFolderClick(file.path)}
                          className="font-medium text-foreground hover:text-primary transition-colors focus:outline-none flex items-center gap-1 group/btn"
                        >
                          {file.name}
                          <ChevronRight className="h-3 w-3 opacity-0 -ml-2 group-hover/btn:opacity-100 group-hover/btn:ml-0 transition-all text-primary" />
                        </button>
                      ) : (
                        <span className="font-medium text-foreground/80">{file.name}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {file.isDirectory ? '--' : formatBytes(file.size || 0)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {file.modifiedAt ? formatDate(file.modifiedAt) : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
