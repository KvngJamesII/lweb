import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Users, Cpu, HardDrive, Clock, Shield, Power, Ban,
  RefreshCcw, Loader2, ArrowLeft, ToggleLeft, ToggleRight,
  Wifi, WifiOff, Activity, Server, Megaphone, MessageSquare,
  Plus, Trash2, Send, X, ArrowRight,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Request failed");
  return json;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function Admin() {
  const [, navigate] = useLocation();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"overview" | "users" | "system" | "support" | "announcements">("overview");

  if (!isAdmin) {
    navigate("/dashboard");
    return null;
  }

  const systemQuery = useQuery({
    queryKey: ["/api/admin/system"],
    queryFn: () => apiRequest("/api/admin/system"),
    refetchInterval: 5000,
  });

  const usersQuery = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: () => apiRequest("/api/admin/users"),
  });

  const maintenanceQuery = useQuery({
    queryKey: ["/api/admin/maintenance"],
    queryFn: () => apiRequest("/api/admin/maintenance"),
  });

  const toggleMaintenance = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest("/api/admin/maintenance", { method: "POST", body: JSON.stringify({ enabled }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const banUser = useMutation({
    mutationFn: ({ id, banned }: { id: number; banned: boolean }) =>
      apiRequest(`/api/admin/users/${id}/ban`, { method: "POST", body: JSON.stringify({ banned }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
  });

  const restartBot = useMutation({
    mutationFn: (userId: number) =>
      apiRequest(`/api/admin/bot/${userId}/restart`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
  });

  const stopBot = useMutation({
    mutationFn: (userId: number) =>
      apiRequest(`/api/admin/bot/${userId}/stop`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
  });

  const restartAllBots = useMutation({
    mutationFn: () => apiRequest("/api/admin/bots/restart-all", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
  });

  const sys = systemQuery.data;
  const allUsers = usersQuery.data || [];
  const isMaintenanceOn = maintenanceQuery.data?.enabled;

  const memPercent = sys ? Math.round((sys.memory.rss / sys.memory.systemTotal) * 100) : 0;
  const cpuLoad = sys ? Math.min(100, Math.round((sys.cpu.loadAverage[0] / sys.cpu.cores) * 100)) : 0;

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Activity },
    { id: "users" as const, label: "Users", icon: Users },
    { id: "system" as const, label: "System", icon: Server },
    { id: "support" as const, label: "Support", icon: MessageSquare },
    { id: "announcements" as const, label: "Announce", icon: Megaphone },
  ];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="absolute top-1/4 -left-40 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-40 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <header className="relative z-10 border-b border-border/50 bg-card/30 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="h-9" data-testid="link-back-dashboard">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Dashboard
              </Button>
            </Link>
            <div className="h-5 w-px bg-border/50" />
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-lg font-extrabold tracking-tight">Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
              sys?.vpsConnected
                ? "bg-primary/10 text-primary"
                : "bg-destructive/10 text-destructive"
            }`} data-testid="text-vps-status">
              <span className={`w-2 h-2 rounded-full ${sys?.vpsConnected ? "bg-primary animate-pulse" : "bg-destructive"}`} />
              VPS {sys?.vpsConnected ? "Online" : "Offline"}
            </span>
            <button
              onClick={() => toggleMaintenance.mutate(!isMaintenanceOn)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                isMaintenanceOn
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-secondary text-muted-foreground"
              }`}
              data-testid="button-toggle-maintenance"
            >
              {isMaintenanceOn ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              Maintenance {isMaintenanceOn ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto w-full px-4 py-3">
        <div className="flex gap-1 bg-secondary/30 rounded-xl p-1 w-fit overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                tab === t.id
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${t.id}`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 relative z-10 max-w-6xl mx-auto w-full px-4 pb-8">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {tab === "overview" && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={<Users className="w-5 h-5" />} label="Total Users" value={sys?.totalUsers || 0} color="text-blue-500" testId="stat-total-users" />
              <StatCard icon={<Wifi className="w-5 h-5" />} label="Active Bots" value={sys?.activeBots || 0} color="text-primary" testId="stat-active-bots" />
              <StatCard icon={<HardDrive className="w-5 h-5" />} label="Memory" value={sys ? formatBytes(sys.memory.rss) : "..."} sub={sys ? `${memPercent}% of ${formatBytes(sys.memory.systemTotal)}` : ""} color="text-purple-500" testId="stat-memory" />
              <StatCard icon={<Cpu className="w-5 h-5" />} label="CPU Load" value={`${cpuLoad}%`} sub={sys ? `${sys.cpu.cores} cores` : ""} color="text-orange-500" testId="stat-cpu" />

              <div className="glass-card rounded-2xl p-5 md:col-span-2 border border-white/5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Memory Usage</h3>
                <div className="space-y-3">
                  <ProgressBar label="System Used" value={(sys?.memory.systemTotal || 0) - (sys?.memory.systemFree || 0)} max={sys?.memory.systemTotal || 1} />
                  <ProgressBar label="App Memory (RSS)" value={sys?.memory.rss || 0} max={sys?.memory.systemTotal || 1} />
                  <ProgressBar label="Heap Used" value={sys?.memory.heapUsed || 0} max={sys?.memory.systemTotal || 1} />
                </div>
              </div>

              <div className="glass-card rounded-2xl p-5 md:col-span-2 border border-white/5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <InfoRow label="Uptime" value={sys ? formatUptime(sys.uptime) : "..."} testId="info-uptime" />
                  <InfoRow label="Node.js" value={sys?.nodeVersion || "..."} testId="info-node" />
                  <InfoRow label="Platform" value={sys?.platform || "..."} testId="info-platform" />
                  <InfoRow label="CPU" value={sys?.cpu.model || "..."} testId="info-cpu" />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-4 h-9 rounded-xl text-xs font-bold"
                  onClick={() => restartAllBots.mutate()}
                  disabled={restartAllBots.isPending}
                  data-testid="button-restart-all-bots"
                >
                  {restartAllBots.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Restart All Bots
                </Button>
              </div>
            </div>
          )}

          {tab === "users" && (
            <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
              <div className="p-4 border-b border-border/50 flex items-center justify-between">
                <h3 className="font-bold text-sm">All Users ({allUsers.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-left">
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Role</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">IP</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Bot</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map((u: any) => (
                      <tr key={u.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors" data-testid={`row-user-${u.id}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs">{u.email}</span>
                            {u.banned && (
                              <span className="text-[9px] font-black bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full">BANNED</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            u.role === "admin" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{u.registrationIp || "-"}</td>
                        <td className="px-4 py-3 font-mono text-[10px]">{u.bot?.phoneNumber || "-"}</td>
                        <td className="px-4 py-3">
                          {u.bot ? (
                            <span className={`flex items-center gap-1 text-[10px] font-bold ${
                              u.bot.status === "connected" ? "text-primary" : "text-muted-foreground"
                            }`}>
                              {u.bot.status === "connected" ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                              {u.bot.status}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {u.role !== "admin" && (
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => banUser.mutate({ id: u.id, banned: !u.banned })} data-testid={`button-ban-${u.id}`}>
                                <Ban className="w-3 h-3 mr-0.5" />
                                {u.banned ? "Unban" : "Ban"}
                              </Button>
                            )}
                            {u.bot && (
                              <>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => restartBot.mutate(u.id)} data-testid={`button-restart-bot-${u.id}`}>
                                  <RefreshCcw className="w-3 h-3 mr-0.5" />
                                  Restart
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-destructive" onClick={() => stopBot.mutate(u.id)} data-testid={`button-stop-bot-${u.id}`}>
                                  <Power className="w-3 h-3 mr-0.5" />
                                  Stop
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "system" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="glass-card rounded-2xl p-5 border border-white/5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                  <HardDrive className="w-4 h-4" />
                  Memory Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground text-xs">RSS (Total Process)</span>
                      <span className="font-bold text-xs" data-testid="text-mem-rss">{sys ? formatBytes(sys.memory.rss) : "..."}</span>
                    </div>
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <motion.div className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full" initial={{ width: 0 }} animate={{ width: `${memPercent}%` }} transition={{ duration: 0.5 }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 text-sm">
                    <InfoBox label="Heap Used" value={sys ? formatBytes(sys.memory.heapUsed) : "..."} />
                    <InfoBox label="Heap Total" value={sys ? formatBytes(sys.memory.heapTotal) : "..."} />
                    <InfoBox label="System Total" value={sys ? formatBytes(sys.memory.systemTotal) : "..."} />
                    <InfoBox label="System Free" value={sys ? formatBytes(sys.memory.systemFree) : "..."} />
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-5 border border-white/5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  CPU Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground text-xs">CPU Load</span>
                      <span className="font-bold text-xs" data-testid="text-cpu-load">{cpuLoad}%</span>
                    </div>
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <motion.div className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full" initial={{ width: 0 }} animate={{ width: `${cpuLoad}%` }} transition={{ duration: 0.5 }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 text-sm">
                    <InfoBox label="Cores" value={sys?.cpu.cores?.toString() || "..."} />
                    <InfoBox label="Model" value={sys?.cpu.model || "..."} small />
                  </div>
                  <div className="p-3 bg-secondary/30 rounded-xl border border-border/30 text-xs">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Load Average (1m / 5m / 15m)</p>
                    <p className="font-mono font-bold">
                      {sys ? sys.cpu.loadAverage.map((l: number) => l.toFixed(2)).join(" / ") : "..."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-5 md:col-span-2 border border-white/5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Process Info
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <InfoBox label="Uptime" value={sys ? formatUptime(sys.uptime) : "..."} testId="text-uptime" />
                  <InfoBox label="Node.js" value={sys?.nodeVersion || "..."} />
                  <InfoBox label="Platform" value={sys?.platform || "..."} />
                  <InfoBox label="Active Bots" value={sys?.activeBots?.toString() || "0"} highlight />
                </div>
              </div>
            </div>
          )}

          {tab === "support" && <AdminSupportTab />}
          {tab === "announcements" && <AdminAnnouncementsTab />}
        </motion.div>
      </main>
    </div>
  );
}

function AdminSupportTab() {
  const queryClient = useQueryClient();
  const [activeTicket, setActiveTicket] = useState<number | null>(null);
  const [reply, setReply] = useState("");

  const ticketsQuery = useQuery({
    queryKey: ["/api/admin/support/tickets"],
    queryFn: () => apiRequest("/api/admin/support/tickets"),
    refetchInterval: 10000,
  });

  const messagesQuery = useQuery({
    queryKey: ["/api/support/tickets", activeTicket, "messages"],
    queryFn: () => apiRequest(`/api/support/tickets/${activeTicket}/messages`),
    enabled: !!activeTicket,
    refetchInterval: activeTicket ? 5000 : false,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest(`/api/admin/support/tickets/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", activeTicket, "messages"] });
    },
  });

  const sendReply = useMutation({
    mutationFn: () =>
      apiRequest(`/api/support/tickets/${activeTicket}/messages`, { method: "POST", body: JSON.stringify({ message: reply }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", activeTicket, "messages"] });
      setReply("");
    },
  });

  const tickets = ticketsQuery.data || [];
  const ticketData = messagesQuery.data;

  if (activeTicket && ticketData) {
    return (
      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveTicket(null)} className="text-xs font-bold text-primary hover:underline flex items-center gap-1" data-testid="button-back-admin-tickets">
              <ArrowRight className="w-3 h-3 rotate-180" />
              Back
            </button>
            <div className="h-4 w-px bg-border/50" />
            <span className="text-sm font-bold">{ticketData.ticket.subject}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              ticketData.ticket.status === "open" ? "bg-primary/10 text-primary" :
              ticketData.ticket.status === "closed" ? "bg-secondary text-muted-foreground" :
              "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            }`}>
              {ticketData.ticket.status}
            </span>
          </div>
          <div className="flex gap-1.5">
            {ticketData.ticket.status !== "closed" && (
              <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-lg" onClick={() => updateStatus.mutate({ id: activeTicket, status: "closed" })} data-testid="button-close-ticket">
                Close
              </Button>
            )}
            {ticketData.ticket.status === "closed" && (
              <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-lg" onClick={() => updateStatus.mutate({ id: activeTicket, status: "open" })} data-testid="button-reopen-ticket">
                Reopen
              </Button>
            )}
          </div>
        </div>
        <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
          {(ticketData.messages || []).map((m: any) => (
            <div key={m.id} className={`max-w-[70%] p-3 rounded-xl text-xs ${m.senderRole === "admin" ? "bg-primary/10 ml-auto" : "bg-secondary/50 mr-auto"}`} data-testid={`admin-message-${m.id}`}>
              <p className="font-bold text-[10px] text-muted-foreground mb-0.5">{m.senderRole === "admin" ? "You (Admin)" : "User"}</p>
              <p>{m.message}</p>
            </div>
          ))}
        </div>
        {ticketData.ticket.status !== "closed" && (
          <div className="p-4 border-t border-border/50">
            <div className="flex gap-2">
              <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply as admin..." className="text-xs h-9 rounded-lg" data-testid="input-admin-reply" onKeyDown={(e) => e.key === "Enter" && reply.trim() && sendReply.mutate()} />
              <Button size="sm" className="h-9 px-4" onClick={() => sendReply.mutate()} disabled={!reply.trim() || sendReply.isPending} data-testid="button-admin-send">
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
      <div className="p-4 border-b border-border/50">
        <h3 className="font-bold text-sm">Support Tickets ({tickets.length})</h3>
      </div>
      {tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No support tickets yet</p>
      ) : (
        <div className="divide-y divide-border/20">
          {tickets.map((t: any) => (
            <button key={t.id} onClick={() => setActiveTicket(t.id)} className="w-full text-left p-4 hover:bg-secondary/20 transition-colors flex items-center justify-between" data-testid={`admin-ticket-${t.id}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">{t.subject}</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                    t.status === "open" ? "bg-primary/10 text-primary" :
                    t.status === "closed" ? "bg-secondary text-muted-foreground" :
                    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  }`}>
                    {t.status}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  #{t.id} by {t.user?.email || "Unknown"}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminAnnouncementsTab() {
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");

  const announcementsQuery = useQuery({
    queryKey: ["/api/admin/announcements"],
    queryFn: () => apiRequest("/api/admin/announcements"),
  });

  const createAnnouncement = useMutation({
    mutationFn: () => apiRequest("/api/admin/announcements", { method: "POST", body: JSON.stringify({ message: newMessage }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      setNewMessage("");
    },
  });

  const deleteAnnouncement = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    },
  });

  const announcements = announcementsQuery.data || [];

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-5 border border-white/5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Create Announcement</h3>
        <div className="flex gap-2">
          <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type announcement message..." className="text-xs h-10 rounded-xl flex-1" data-testid="input-announcement" onKeyDown={(e) => e.key === "Enter" && newMessage.trim() && createAnnouncement.mutate()} />
          <Button size="sm" className="h-10 px-4 rounded-xl" onClick={() => createAnnouncement.mutate()} disabled={!newMessage.trim() || createAnnouncement.isPending} data-testid="button-create-announcement">
            {createAnnouncement.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Post</>}
          </Button>
        </div>
      </div>

      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h3 className="font-bold text-sm">All Announcements ({announcements.length})</h3>
        </div>
        {announcements.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No announcements yet</p>
        ) : (
          <div className="divide-y divide-border/20">
            {announcements.map((a: any) => (
              <div key={a.id} className="p-4 flex items-start justify-between gap-3" data-testid={`admin-announcement-${a.id}`}>
                <div className="flex items-start gap-3 flex-1">
                  <Megaphone className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium">{a.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {a.active ? "Active" : "Inactive"} | {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => deleteAnnouncement.mutate(a.id)} data-testid={`button-delete-announcement-${a.id}`}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color, testId }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string; testId: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-5 border border-white/5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`} style={{ backgroundColor: "currentColor", opacity: 0.1 }}>
        <div className={color}>{icon}</div>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 -mt-[52px] ${color}`}>
        {icon}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-3">{label}</p>
      <p className="text-2xl font-extrabold" data-testid={testId}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </motion.div>
  );
}

function ProgressBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold">{formatBytes(value)} ({pct}%)</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-primary/70 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function InfoRow({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/20 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-bold" data-testid={testId}>{value}</span>
    </div>
  );
}

function InfoBox({ label, value, testId, small, highlight }: { label: string; value: string; testId?: string; small?: boolean; highlight?: boolean }) {
  return (
    <div className="p-3 bg-secondary/30 rounded-xl border border-border/30">
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</p>
      <p className={`font-bold ${small ? "text-[10px]" : "text-xs"} ${highlight ? "text-primary" : ""}`} data-testid={testId}>{value}</p>
    </div>
  );
}
