import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Bot, Users, Cpu, HardDrive, Clock, Shield, Power, Ban,
  RefreshCcw, Loader2, ArrowLeft, ToggleLeft, ToggleRight,
  Wifi, WifiOff, Activity, Server,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

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
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"overview" | "users" | "system">("overview");

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

  const sys = systemQuery.data;
  const allUsers = usersQuery.data || [];
  const isMaintenanceOn = maintenanceQuery.data?.enabled;

  const memPercent = sys ? Math.round((sys.memory.rss / sys.memory.systemTotal) * 100) : 0;
  const cpuLoad = sys ? Math.min(100, Math.round((sys.cpu.loadAverage[0] / sys.cpu.cores) * 100)) : 0;

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Activity },
    { id: "users" as const, label: "Users", icon: Users },
    { id: "system" as const, label: "System", icon: Server },
  ];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <header className="relative z-10 border-b border-border/50 bg-card/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" data-testid="link-back-dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-lg font-bold tracking-tight">Admin Panel</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
              sys?.vpsConnected
                ? "bg-primary/10 text-primary"
                : "bg-destructive/10 text-destructive"
            }`} data-testid="text-vps-status">
              <span className={`w-2 h-2 rounded-full ${sys?.vpsConnected ? "bg-primary animate-pulse" : "bg-destructive"}`} />
              VPS {sys?.vpsConnected ? "Connected" : "Offline"}
            </span>
            <button
              onClick={() => toggleMaintenance.mutate(!isMaintenanceOn)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                isMaintenanceOn
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-secondary text-muted-foreground"
              }`}
              data-testid="button-toggle-maintenance"
            >
              {isMaintenanceOn ? (
                <ToggleRight className="w-4 h-4" />
              ) : (
                <ToggleLeft className="w-4 h-4" />
              )}
              Maintenance {isMaintenanceOn ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto w-full px-4 py-4">
        <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${t.id}`}
            >
              <t.icon className="w-4 h-4" />
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
              <StatCard
                icon={<Users className="w-5 h-5" />}
                label="Total Users"
                value={sys?.totalUsers || 0}
                color="text-blue-500"
                testId="stat-total-users"
              />
              <StatCard
                icon={<Wifi className="w-5 h-5" />}
                label="Active Bots"
                value={sys?.activeBots || 0}
                color="text-primary"
                testId="stat-active-bots"
              />
              <StatCard
                icon={<HardDrive className="w-5 h-5" />}
                label="Memory"
                value={sys ? formatBytes(sys.memory.rss) : "..."}
                sub={sys ? `${memPercent}% of ${formatBytes(sys.memory.systemTotal)}` : ""}
                color="text-purple-500"
                testId="stat-memory"
              />
              <StatCard
                icon={<Cpu className="w-5 h-5" />}
                label="CPU Load"
                value={`${cpuLoad}%`}
                sub={sys ? `${sys.cpu.cores} cores` : ""}
                color="text-orange-500"
                testId="stat-cpu"
              />

              <div className="glass-card rounded-2xl p-6 md:col-span-2">
                <h3 className="text-sm font-semibold text-muted-foreground mb-4">Memory Usage</h3>
                <div className="space-y-3">
                  <ProgressBar label="System Used" value={(sys?.memory.systemTotal || 0) - (sys?.memory.systemFree || 0)} max={sys?.memory.systemTotal || 1} />
                  <ProgressBar label="App Memory (RSS)" value={sys?.memory.rss || 0} max={sys?.memory.systemTotal || 1} />
                  <ProgressBar label="Heap Used" value={sys?.memory.heapUsed || 0} max={sys?.memory.systemTotal || 1} />
                </div>
              </div>

              <div className="glass-card rounded-2xl p-6 md:col-span-2">
                <h3 className="text-sm font-semibold text-muted-foreground mb-4">System Info</h3>
                <div className="space-y-2 text-sm">
                  <InfoRow label="Uptime" value={sys ? formatUptime(sys.uptime) : "..."} testId="info-uptime" />
                  <InfoRow label="Node.js" value={sys?.nodeVersion || "..."} testId="info-node" />
                  <InfoRow label="Platform" value={sys?.platform || "..."} testId="info-platform" />
                  <InfoRow label="CPU" value={sys?.cpu.model || "..."} testId="info-cpu" />
                  <InfoRow label="Load Average" value={sys ? sys.cpu.loadAverage.map((l: number) => l.toFixed(2)).join(", ") : "..."} testId="info-load" />
                </div>
              </div>
            </div>
          )}

          {tab === "users" && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-border/50">
                <h3 className="font-semibold">All Users ({allUsers.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-left">
                      <th className="px-4 py-3 font-semibold text-muted-foreground">Email</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground">Role</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground">IP</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground">Bot</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map((u: any) => (
                      <tr key={u.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors" data-testid={`row-user-${u.id}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{u.email}</span>
                            {u.banned && (
                              <span className="text-[10px] font-bold bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">BANNED</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            u.role === "admin" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.registrationIp || "-"}</td>
                        <td className="px-4 py-3 font-mono text-xs">{u.bot?.phoneNumber || "-"}</td>
                        <td className="px-4 py-3">
                          {u.bot ? (
                            <span className={`flex items-center gap-1 text-xs font-medium ${
                              u.bot.status === "connected" ? "text-primary" : "text-muted-foreground"
                            }`}>
                              {u.bot.status === "connected" ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                              {u.bot.status}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {u.role !== "admin" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => banUser.mutate({ id: u.id, banned: !u.banned })}
                                data-testid={`button-ban-${u.id}`}
                              >
                                <Ban className="w-3 h-3 mr-1" />
                                {u.banned ? "Unban" : "Ban"}
                              </Button>
                            )}
                            {u.bot && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => restartBot.mutate(u.id)}
                                  data-testid={`button-restart-bot-${u.id}`}
                                >
                                  <RefreshCcw className="w-3 h-3 mr-1" />
                                  Restart
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-destructive"
                                  onClick={() => stopBot.mutate(u.id)}
                                  data-testid={`button-stop-bot-${u.id}`}
                                >
                                  <Power className="w-3 h-3 mr-1" />
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
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                  <HardDrive className="w-4 h-4" />
                  Memory Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">RSS (Total Process)</span>
                      <span className="font-semibold" data-testid="text-mem-rss">{sys ? formatBytes(sys.memory.rss) : "..."}</span>
                    </div>
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${memPercent}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-secondary/50 rounded-xl">
                      <p className="text-xs text-muted-foreground">Heap Used</p>
                      <p className="font-semibold">{sys ? formatBytes(sys.memory.heapUsed) : "..."}</p>
                    </div>
                    <div className="p-3 bg-secondary/50 rounded-xl">
                      <p className="text-xs text-muted-foreground">Heap Total</p>
                      <p className="font-semibold">{sys ? formatBytes(sys.memory.heapTotal) : "..."}</p>
                    </div>
                    <div className="p-3 bg-secondary/50 rounded-xl">
                      <p className="text-xs text-muted-foreground">System Total</p>
                      <p className="font-semibold">{sys ? formatBytes(sys.memory.systemTotal) : "..."}</p>
                    </div>
                    <div className="p-3 bg-secondary/50 rounded-xl">
                      <p className="text-xs text-muted-foreground">System Free</p>
                      <p className="font-semibold">{sys ? formatBytes(sys.memory.systemFree) : "..."}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  CPU Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">CPU Load</span>
                      <span className="font-semibold" data-testid="text-cpu-load">{cpuLoad}%</span>
                    </div>
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${cpuLoad}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-secondary/50 rounded-xl">
                      <p className="text-xs text-muted-foreground">Cores</p>
                      <p className="font-semibold">{sys?.cpu.cores || "..."}</p>
                    </div>
                    <div className="p-3 bg-secondary/50 rounded-xl">
                      <p className="text-xs text-muted-foreground">Model</p>
                      <p className="font-semibold text-xs">{sys?.cpu.model || "..."}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-secondary/50 rounded-xl text-sm">
                    <p className="text-xs text-muted-foreground mb-1">Load Average (1m / 5m / 15m)</p>
                    <p className="font-mono font-semibold">
                      {sys ? sys.cpu.loadAverage.map((l: number) => l.toFixed(2)).join(" / ") : "..."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-6 md:col-span-2">
                <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Process Info
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="p-3 bg-secondary/50 rounded-xl">
                    <p className="text-xs text-muted-foreground">Uptime</p>
                    <p className="font-semibold" data-testid="text-uptime">{sys ? formatUptime(sys.uptime) : "..."}</p>
                  </div>
                  <div className="p-3 bg-secondary/50 rounded-xl">
                    <p className="text-xs text-muted-foreground">Node.js</p>
                    <p className="font-semibold">{sys?.nodeVersion || "..."}</p>
                  </div>
                  <div className="p-3 bg-secondary/50 rounded-xl">
                    <p className="text-xs text-muted-foreground">Platform</p>
                    <p className="font-semibold">{sys?.platform || "..."}</p>
                  </div>
                  <div className="p-3 bg-secondary/50 rounded-xl">
                    <p className="text-xs text-muted-foreground">Active Bots</p>
                    <p className="font-semibold text-primary">{sys?.activeBots || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color, testId }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  testId: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-5"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color} bg-current/10`}
        style={{ backgroundColor: "currentColor", opacity: 0.1 }}
      >
        <div className={color}>{icon}</div>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 -mt-[52px] ${color}`}>
        {icon}
      </div>
      <p className="text-xs text-muted-foreground font-medium mt-3">{label}</p>
      <p className="text-2xl font-bold" data-testid={testId}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </motion.div>
  );
}

function ProgressBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{formatBytes(value)} ({pct}%)</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-primary/70 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function InfoRow({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium" data-testid={testId}>{value}</span>
    </div>
  );
}
