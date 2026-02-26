import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Phone, Copy, CheckCircle2, ArrowRight, Loader2, RefreshCcw,
  Power, Wifi, WifiOff, LogOut, Settings, Shield, Key, Bell,
  MessageSquare, Plus, Send, X, Megaphone, ExternalLink, User as UserIcon,
} from "lucide-react";
import { useCopyToClipboard, useWindowSize } from "react-use";
import Confetti from "react-confetti";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { useRequestPairing, usePairingStatus } from "@/hooks/use-pairing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const phoneSchema = z.string().min(8, "Phone number is too short").regex(/^\d+$/, "Only numbers allowed");

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Request failed");
  return json;
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

function AnnouncementBanner() {
  const { data: announcements } = useQuery({
    queryKey: ["/api/announcements"],
    queryFn: () => apiRequest("/api/announcements"),
    refetchInterval: 30000,
  });
  const [dismissed, setDismissed] = useState<number[]>([]);

  const visible = (announcements || []).filter((a: any) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {visible.map((a: any) => (
        <motion.div
          key={a.id}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 flex items-start gap-3"
        >
          <Megaphone className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium" data-testid={`text-announcement-${a.id}`}>{a.message}</p>
            {a.link && (
              <a
                href={a.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary font-bold mt-1 hover:underline"
                data-testid={`link-announcement-${a.id}`}
              >
                Learn more <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <button
            onClick={() => setDismissed(prev => [...prev, a.id])}
            className="text-muted-foreground hover:text-foreground p-0.5"
            data-testid={`button-dismiss-announcement-${a.id}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      ))}
    </div>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: () => apiRequest("/api/notifications"),
    refetchInterval: 15000,
  });

  const markAllRead = useMutation({
    mutationFn: () => apiRequest("/api/notifications/read-all", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markRead = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const notifs = data?.notifications || [];
  const unread = data?.unreadCount || 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-secondary/50 transition-colors"
        data-testid="button-notifications"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-[10px] font-bold text-white rounded-full flex items-center justify-center" data-testid="text-unread-count">
            {unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.95 }}
              className="fixed sm:absolute right-3 sm:right-0 left-3 sm:left-auto top-14 sm:top-full sm:mt-2 sm:w-80 glass-card rounded-xl border border-border/50 shadow-xl z-50 overflow-hidden"
            >
              <div className="p-3 border-b border-border/50 flex items-center justify-between">
                <span className="text-sm font-bold">Notifications</span>
                {unread > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    className="text-xs text-primary hover:underline font-medium"
                    data-testid="button-mark-all-read"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
                ) : (
                  notifs.map((n: any) => (
                    <div
                      key={n.id}
                      onClick={() => !n.read && markRead.mutate(n.id)}
                      className={`p-3 border-b border-border/30 last:border-0 cursor-pointer hover:bg-secondary/30 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                      data-testid={`notification-${n.id}`}
                    >
                      <p className="text-xs font-bold">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SupportPanel() {
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [activeTicket, setActiveTicket] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef<number>(0);

  const badgeQuery = useQuery({
    queryKey: ["/api/support/badge"],
    queryFn: () => apiRequest("/api/support/badge"),
    refetchInterval: 10000,
  });

  const ticketsQuery = useQuery({
    queryKey: ["/api/support/tickets"],
    queryFn: () => apiRequest("/api/support/tickets"),
    enabled: open,
  });

  const messagesQuery = useQuery({
    queryKey: ["/api/support/tickets", activeTicket, "messages"],
    queryFn: () => apiRequest(`/api/support/tickets/${activeTicket}/messages`),
    enabled: !!activeTicket,
    refetchInterval: activeTicket ? 3000 : false,
  });

  const createTicket = useMutation({
    mutationFn: () => apiRequest("/api/support/tickets", {
      method: "POST",
      body: JSON.stringify({ subject, message }),
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      setSubject("");
      setMessage("");
      setShowNew(false);
      setActiveTicket(data.id);
    },
  });

  const sendReply = useMutation({
    mutationFn: () => apiRequest(`/api/support/tickets/${activeTicket}/messages`, {
      method: "POST",
      body: JSON.stringify({ message: reply }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", activeTicket, "messages"] });
      setReply("");
    },
  });

  const requestAgent = useMutation({
    mutationFn: () => apiRequest(`/api/support/tickets/${activeTicket}/request-agent`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", activeTicket, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
    },
  });

  const tickets = ticketsQuery.data || [];
  const ticketData = messagesQuery.data;
  const badgeCount = badgeQuery.data?.count || 0;

  useEffect(() => {
    if (ticketData?.messages) {
      const newCount = ticketData.messages.length;
      if (newCount > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
        const lastMsg = ticketData.messages[newCount - 1];
        if (lastMsg?.senderRole === "ai" || lastMsg?.senderRole === "admin") {
          playNotificationSound();
        }
      }
      prevMsgCountRef.current = newCount;
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [ticketData?.messages?.length]);

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center shadow-xl shadow-primary/25 text-white"
        data-testid="button-support-chat"
      >
        <MessageSquare className="w-6 h-6" />
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center animate-pulse" data-testid="text-support-badge">
            {badgeCount}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed inset-3 sm:inset-auto sm:bottom-24 sm:right-6 z-50 sm:w-[360px] sm:max-h-[500px] glass-card rounded-2xl border border-border/50 shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-border/50 bg-primary/5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">Support</h3>
                  <p className="text-xs text-muted-foreground">AI-powered instant help</p>
                </div>
                <button onClick={() => { setOpen(false); setActiveTicket(null); setShowNew(false); }} className="p-1 hover:bg-secondary rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[200px]">
              {activeTicket && ticketData ? (
                <div className="flex flex-col h-full">
                  <button
                    onClick={() => { setActiveTicket(null); prevMsgCountRef.current = 0; }}
                    className="flex items-center gap-1 text-xs text-primary font-medium p-3 hover:bg-secondary/30"
                    data-testid="button-back-tickets"
                  >
                    <ArrowRight className="w-3 h-3 rotate-180" />
                    Back to tickets
                  </button>
                  <div className="px-3 pb-1 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold">{ticketData.ticket.subject}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        ticketData.ticket.status === "open" ? "bg-primary/10 text-primary" :
                        ticketData.ticket.status === "closed" ? "bg-secondary text-muted-foreground" :
                        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}>
                        {ticketData.ticket.status}
                      </span>
                    </div>
                    {ticketData.ticket.aiEnabled && ticketData.ticket.status !== "closed" && (
                      <button
                        onClick={() => requestAgent.mutate()}
                        disabled={requestAgent.isPending}
                        className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full hover:bg-primary/20 transition-colors"
                        data-testid="button-request-agent"
                      >
                        <UserIcon className="w-3 h-3" />
                        Live Agent
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[280px]">
                    {(ticketData.messages || []).map((m: any) => (
                      <div
                        key={m.id}
                        className={`max-w-[85%] p-2.5 rounded-xl text-xs ${
                          m.senderRole === "user"
                            ? "bg-secondary ml-auto"
                            : m.senderRole === "system"
                            ? "bg-amber-100/50 dark:bg-amber-900/20 mx-auto text-center max-w-full border border-amber-200/50 dark:border-amber-800/30"
                            : "bg-primary/10 mr-auto"
                        }`}
                        data-testid={`message-${m.id}`}
                      >
                        {m.senderRole !== "system" && (
                          <p className="font-bold text-[10px] text-muted-foreground mb-0.5">
                            {m.senderRole === "ai" ? "LUCA AI" : m.senderRole === "admin" ? "Support Agent" : "You"}
                          </p>
                        )}
                        <p>{m.message}</p>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  {ticketData.ticket.status !== "closed" && (
                    <div className="p-3 border-t border-border/50">
                      <div className="flex gap-2">
                        <Input
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          placeholder="Type a message..."
                          className="text-xs h-9 rounded-lg"
                          data-testid="input-support-reply"
                          onKeyDown={(e) => e.key === "Enter" && reply.trim() && sendReply.mutate()}
                        />
                        <Button
                          size="sm"
                          className="h-9 px-3"
                          onClick={() => sendReply.mutate()}
                          disabled={!reply.trim() || sendReply.isPending}
                          data-testid="button-send-reply"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : showNew ? (
                <div className="p-4 space-y-3">
                  <button
                    onClick={() => setShowNew(false)}
                    className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                  >
                    <ArrowRight className="w-3 h-3 rotate-180" />
                    Back
                  </button>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject"
                    className="text-xs h-9 rounded-lg"
                    data-testid="input-ticket-subject"
                  />
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your issue..."
                    className="w-full h-24 px-3 py-2 text-xs rounded-lg bg-secondary/50 border border-border/50 resize-none focus:outline-none focus:border-primary/50"
                    data-testid="input-ticket-message"
                  />
                  <Button
                    size="sm"
                    className="w-full h-9"
                    onClick={() => createTicket.mutate()}
                    disabled={!subject.trim() || !message.trim() || createTicket.isPending}
                    data-testid="button-create-ticket"
                  >
                    {createTicket.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Submit Ticket"}
                  </Button>
                </div>
              ) : (
                <div className="p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-9 mb-3 text-xs"
                    onClick={() => setShowNew(true)}
                    data-testid="button-new-ticket"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    New Ticket
                  </Button>
                  {tickets.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">No tickets yet</p>
                  ) : (
                    <div className="space-y-1">
                      {tickets.map((t: any) => (
                        <button
                          key={t.id}
                          onClick={() => setActiveTicket(t.id)}
                          className="w-full text-left p-3 rounded-lg hover:bg-secondary/50 transition-colors"
                          data-testid={`ticket-${t.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold truncate flex-1">{t.subject}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2 ${
                              t.status === "open" ? "bg-primary/10 text-primary" :
                              t.status === "closed" ? "bg-secondary text-muted-foreground" :
                              "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            }`}>
                              {t.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">#{t.id}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function Dashboard() {
  const { width, height } = useWindowSize();
  const [, navigate] = useLocation();
  const { user, logout, isAdmin, changePassword } = useAuth();
  const queryClient = useQueryClient();

  const [showPairing, setShowPairing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [, copyToClipboard] = useCopyToClipboard();
  const [copied, setCopied] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  const requestMutation = useRequestPairing();
  const { data: statusData, isError: isStatusError } = usePairingStatus(activePhone);

  const isConnected = statusData?.status === "connected";
  const isFailed = statusData?.status === "failed" || isStatusError;

  const botStatusQuery = useQuery({
    queryKey: ["/api/bot/status"],
    queryFn: async () => {
      const res = await fetch("/api/bot/status");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("/api/bot/disconnect", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bot/status"] });
    },
  });

  const adminBadgeQuery = useQuery({
    queryKey: ["/api/admin/support/badge"],
    queryFn: () => apiRequest("/api/admin/support/badge"),
    enabled: isAdmin,
    refetchInterval: 10000,
  });

  const prevAdminBadgeRef = useRef(0);
  useEffect(() => {
    const count = adminBadgeQuery.data?.count || 0;
    if (count > prevAdminBadgeRef.current && prevAdminBadgeRef.current >= 0 && isAdmin) {
      if (prevAdminBadgeRef.current > 0) playNotificationSound();
    }
    prevAdminBadgeRef.current = count;
  }, [adminBadgeQuery.data?.count]);

  const botStatus = botStatusQuery.data;
  const adminBadge = adminBadgeQuery.data?.count || 0;

  const handlePairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");
    const cleanPhone = phoneNumber.replace(/[\s\-\+\(\)]/g, "");
    try {
      phoneSchema.parse(cleanPhone);
      requestMutation.mutate(
        { phoneNumber: cleanPhone },
        {
          onSuccess: (data) => {
            setPairingCode(data.code);
            setActivePhone(cleanPhone);
          },
          onError: (err) => setPhoneError(err.message),
        }
      );
    } catch (err) {
      if (err instanceof z.ZodError) setPhoneError(err.errors[0].message);
    }
  };

  const handleCopy = () => {
    if (pairingCode) {
      copyToClipboard(pairingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePairReset = () => {
    setPairingCode(null);
    setActivePhone(null);
    setPhoneNumber("");
    setPhoneError("");
    requestMutation.reset();
    if (isConnected) {
      setShowPairing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/bot/status"] });
    }
  };

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => navigate("/login"),
    });
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg("");
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setPasswordMsg("Password updated successfully!");
          setCurrentPassword("");
          setNewPassword("");
        },
        onError: (err) => setPasswordMsg(err.message),
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {isConnected && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={400}
          gravity={0.15}
          colors={["#16a34a", "#22c55e", "#4ade80", "#ffffff"]}
        />
      )}

      <div className="absolute top-1/4 -left-40 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-40 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <header className="relative z-10 border-b border-border/50 bg-card/30 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-md shadow-primary/15">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight">LUCA <span className="text-primary">Bot</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link href="/admin">
                <Button variant="ghost" size="sm" className="h-9 px-3 relative" data-testid="link-admin">
                  <Shield className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">Admin</span>
                  {adminBadge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-[9px] font-bold text-white rounded-full flex items-center justify-center animate-pulse" data-testid="text-admin-badge">
                      {adminBadge}
                    </span>
                  )}
                </Button>
              </Link>
            )}
            <NotificationBell />
            <div className="h-5 w-px bg-border/50 mx-1" />
            <span className="text-xs font-medium text-muted-foreground hidden sm:block max-w-[120px] truncate">{user?.email}</span>
            <Button variant="ghost" size="sm" className="h-9 px-2.5" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10 max-w-5xl mx-auto w-full px-4 py-6">
        <AnnouncementBanner />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" data-testid="text-dashboard-title">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your WhatsApp bot connection</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card rounded-2xl p-6 border border-white/5"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold flex items-center gap-2">
                  {botStatus?.status === "connected" ? (
                    <div className="relative">
                      <Wifi className="w-5 h-5 text-primary" />
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
                    </div>
                  ) : (
                    <WifiOff className="w-5 h-5 text-muted-foreground" />
                  )}
                  Bot Status
                </h2>
                {botStatus?.status === "connected" && (
                  <span className="text-xs font-bold bg-primary/10 text-primary px-3 py-1.5 rounded-full" data-testid="text-bot-status">
                    Online
                  </span>
                )}
                {botStatus?.status !== "connected" && botStatus?.status !== "no_bot" && (
                  <span className="text-xs font-bold bg-destructive/10 text-destructive px-3 py-1.5 rounded-full" data-testid="text-bot-status">
                    Offline
                  </span>
                )}
              </div>

              {botStatus?.status === "no_bot" || !botStatus ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto bg-secondary/50 rounded-2xl flex items-center justify-center mb-4">
                    <WifiOff className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-5">No bot connected yet</p>
                  <Button onClick={() => setShowPairing(true)} className="group h-11 px-6 rounded-xl font-bold shadow-md shadow-primary/15" data-testid="button-pair-bot">
                    Connect Bot
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3.5 bg-secondary/30 rounded-xl border border-border/30">
                    <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Phone className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Connected Number</p>
                      <p className="font-bold font-mono text-sm" data-testid="text-phone-number">+{botStatus.phoneNumber}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-10 rounded-xl text-xs font-bold"
                      onClick={() => disconnectMutation.mutate()}
                      disabled={disconnectMutation.isPending}
                      data-testid="button-disconnect"
                    >
                      {disconnectMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Power className="w-3.5 h-3.5 mr-1.5" />
                          Disconnect
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-10 rounded-xl text-xs font-bold"
                      onClick={() => {
                        disconnectMutation.mutate(undefined, {
                          onSuccess: () => setShowPairing(true),
                        });
                      }}
                      data-testid="button-repare"
                    >
                      <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
                      Re-pair
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card rounded-2xl p-6 border border-white/5"
            >
              <h2 className="text-base font-bold flex items-center gap-2 mb-5">
                <Settings className="w-5 h-5 text-muted-foreground" />
                Account Settings
              </h2>

              {!showSettings ? (
                <div className="space-y-3">
                  <div className="p-3.5 bg-secondary/30 rounded-xl border border-border/30">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Email</p>
                    <p className="font-bold text-sm" data-testid="text-user-email">{user?.email}</p>
                  </div>
                  <div className="p-3.5 bg-secondary/30 rounded-xl border border-border/30">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Role</p>
                    <p className="font-bold text-sm capitalize" data-testid="text-user-role">{user?.role}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-10 rounded-xl text-xs font-bold"
                    onClick={() => setShowSettings(true)}
                    data-testid="button-change-password"
                  >
                    <Key className="w-3.5 h-3.5 mr-1.5" />
                    Change Password
                  </Button>
                </div>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-3">
                  <Input
                    type="password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="h-10 rounded-xl bg-secondary/50 text-sm"
                    data-testid="input-current-password"
                  />
                  <Input
                    type="password"
                    placeholder="New password (min 6 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-10 rounded-xl bg-secondary/50 text-sm"
                    data-testid="input-new-password"
                  />
                  {passwordMsg && (
                    <p className={`text-xs font-bold ${passwordMsg.includes("success") ? "text-primary" : "text-destructive"}`}>
                      {passwordMsg}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" className="flex-1 h-10 rounded-xl font-bold" disabled={changePassword.isPending} data-testid="button-save-password">
                      {changePassword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-10 rounded-xl" onClick={() => { setShowSettings(false); setPasswordMsg(""); }}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>

          <AnimatePresence>
            {showPairing && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mt-6"
              >
                <div className="glass-card rounded-2xl p-8 max-w-md mx-auto border border-white/5">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-extrabold tracking-tight mb-2">Pair your Bot</h2>
                    <p className="text-muted-foreground text-sm">
                      Connect LUCA to your WhatsApp account
                    </p>
                  </div>

                  <AnimatePresence mode="wait">
                    {!pairingCode && !isConnected ? (
                      <motion.form
                        key="form"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.3 }}
                        onSubmit={handlePairSubmit}
                        className="space-y-5"
                      >
                        <div className="space-y-1.5">
                          <label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            WhatsApp Number
                          </label>
                          <div className="relative group">
                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                              id="phone"
                              type="tel"
                              placeholder="e.g. 1234567890"
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              className="pl-11 h-12 rounded-xl bg-secondary/50 border-border/50 focus:border-primary/50 transition-all"
                              disabled={requestMutation.isPending}
                              data-testid="input-phone"
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground pt-1">
                            Include country code, without '+' or leading zeros.
                          </p>
                          <AnimatePresence>
                            {phoneError && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="bg-destructive/10 text-destructive text-xs font-medium px-3 py-2 rounded-lg border border-destructive/20"
                              >
                                {phoneError}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <Button
                          type="submit"
                          size="lg"
                          className="w-full h-12 rounded-xl group font-bold shadow-lg shadow-primary/15"
                          disabled={requestMutation.isPending || !phoneNumber}
                          data-testid="button-get-code"
                        >
                          {requestMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Generating Code...
                            </>
                          ) : (
                            <>
                              Get Pairing Code
                              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                            </>
                          )}
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full text-muted-foreground"
                          onClick={() => setShowPairing(false)}
                        >
                          Cancel
                        </Button>
                      </motion.form>
                    ) : !isConnected && !isFailed ? (
                      <motion.div
                        key="code"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.4, type: "spring", bounce: 0.4 }}
                        className="flex flex-col items-center"
                      >
                        <p className="text-xs font-bold uppercase tracking-wider text-primary mb-5">
                          Your Pairing Code
                        </p>
                        <div className="bg-secondary/30 border border-border/50 w-full rounded-2xl py-8 px-4 flex flex-col items-center justify-center relative group transition-colors hover:bg-secondary/50">
                          <span className="font-mono text-4xl sm:text-5xl font-black tracking-[0.2em] sm:tracking-[0.3em] text-foreground ml-[0.2em] sm:ml-[0.3em]" data-testid="text-pairing-code">
                            {pairingCode}
                          </span>
                          <button
                            onClick={handleCopy}
                            className="absolute top-3 right-3 p-2 bg-background rounded-lg border shadow-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all active:scale-95"
                            data-testid="button-copy-code"
                          >
                            {copied ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="mt-6 flex flex-col items-center text-center space-y-3">
                          <div className="flex items-center space-x-3 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            <span className="text-sm font-medium">Waiting for WhatsApp connection...</span>
                          </div>
                          <p className="text-xs text-muted-foreground max-w-[280px]">
                            Open WhatsApp, go to Linked Devices, then Link with phone number instead.
                          </p>
                        </div>
                        <Button variant="ghost" className="mt-6 text-muted-foreground" onClick={handlePairReset}>
                          Cancel
                        </Button>
                      </motion.div>
                    ) : isFailed ? (
                      <motion.div
                        key="error"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center text-center"
                      >
                        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
                          <RefreshCcw className="w-8 h-8 text-destructive" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Connection Failed</h3>
                        <p className="text-muted-foreground text-sm mb-8">The pairing session expired or was rejected.</p>
                        <Button onClick={handlePairReset} size="lg" className="w-full h-11 rounded-xl font-bold" data-testid="button-try-again">
                          Try Again
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center text-center"
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                          className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-primary/20 relative"
                        >
                          <div className="absolute inset-0 bg-primary rounded-full animate-ping opacity-20" />
                          <CheckCircle2 className="w-10 h-10 text-primary" />
                        </motion.div>
                        <h3 className="text-2xl font-extrabold mb-2" data-testid="text-success">Successfully Paired!</h3>
                        <p className="text-muted-foreground text-sm mb-8">
                          LUCA is now connected to your WhatsApp account.
                        </p>
                        <Button onClick={handlePairReset} variant="outline" size="lg" className="w-full h-11 rounded-xl font-bold" data-testid="button-done">
                          Done
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      <SupportPanel />
    </div>
  );
}
