import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Phone, Copy, CheckCircle2, ArrowRight, Loader2, RefreshCcw,
  Power, Wifi, WifiOff, LogOut, Settings, Shield, Key,
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

  const botStatus = botStatusQuery.data;

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

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <header className="relative z-10 border-b border-border/50 bg-card/50 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <span className="text-lg font-bold tracking-tight">LUCA Bot</span>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link href="/admin">
                <Button variant="ghost" size="sm" data-testid="link-admin">
                  <Shield className="w-4 h-4 mr-2" />
                  Admin
                </Button>
              </Link>
            )}
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10 max-w-5xl mx-auto w-full px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold tracking-tight mb-2" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground mb-8">Manage your WhatsApp bot connection</p>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  {botStatus?.status === "connected" ? (
                    <Wifi className="w-5 h-5 text-primary" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-muted-foreground" />
                  )}
                  Bot Status
                </h2>
                {botStatus?.status === "connected" && (
                  <span className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full" data-testid="text-bot-status">
                    Online
                  </span>
                )}
                {botStatus?.status !== "connected" && botStatus?.status !== "no_bot" && (
                  <span className="text-xs font-semibold bg-destructive/10 text-destructive px-3 py-1 rounded-full" data-testid="text-bot-status">
                    Offline
                  </span>
                )}
              </div>

              {botStatus?.status === "no_bot" || !botStatus ? (
                <div className="text-center py-6">
                  <WifiOff className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-6">No bot connected yet</p>
                  <Button onClick={() => setShowPairing(true)} className="group" data-testid="button-pair-bot">
                    Connect Bot
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
                    <Phone className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Connected Number</p>
                      <p className="font-semibold font-mono" data-testid="text-phone-number">+{botStatus.phoneNumber}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => disconnectMutation.mutate()}
                      disabled={disconnectMutation.isPending}
                      data-testid="button-disconnect"
                    >
                      {disconnectMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Power className="w-4 h-4 mr-2" />
                          Disconnect
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        disconnectMutation.mutate(undefined, {
                          onSuccess: () => setShowPairing(true),
                        });
                      }}
                      data-testid="button-repare"
                    >
                      <RefreshCcw className="w-4 h-4 mr-2" />
                      Re-pair
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-6">
                <Settings className="w-5 h-5 text-muted-foreground" />
                Account Settings
              </h2>

              {!showSettings ? (
                <div className="space-y-4">
                  <div className="p-3 bg-secondary/50 rounded-xl">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-semibold" data-testid="text-user-email">{user?.email}</p>
                  </div>
                  <div className="p-3 bg-secondary/50 rounded-xl">
                    <p className="text-xs text-muted-foreground">Role</p>
                    <p className="font-semibold capitalize" data-testid="text-user-role">{user?.role}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowSettings(true)}
                    data-testid="button-change-password"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Change Password
                  </Button>
                </div>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <Input
                    type="password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    data-testid="input-current-password"
                  />
                  <Input
                    type="password"
                    placeholder="New password (min 6 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    data-testid="input-new-password"
                  />
                  {passwordMsg && (
                    <p className={`text-sm font-medium ${passwordMsg.includes("success") ? "text-primary" : "text-destructive"}`}>
                      {passwordMsg}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" className="flex-1" disabled={changePassword.isPending} data-testid="button-save-password">
                      {changePassword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>

          <AnimatePresence>
            {showPairing && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mt-6"
              >
                <div className="glass-card rounded-2xl p-8 max-w-md mx-auto">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold tracking-tight mb-2">Pair your Bot</h2>
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
                        className="space-y-6"
                      >
                        <div className="space-y-2">
                          <label htmlFor="phone" className="text-sm font-semibold block text-foreground/90">
                            WhatsApp Number
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                              id="phone"
                              type="tel"
                              placeholder="e.g. 1234567890"
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              className="pl-12"
                              disabled={requestMutation.isPending}
                              data-testid="input-phone"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground pt-1">
                            Include country code, without '+' or leading zeros.
                          </p>
                          <AnimatePresence>
                            {phoneError && (
                              <motion.p
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="text-sm font-medium text-destructive mt-2"
                              >
                                {phoneError}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>

                        <Button
                          type="submit"
                          size="lg"
                          className="w-full group"
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
                        <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-6">
                          Your Pairing Code
                        </p>
                        <div className="bg-secondary/50 border border-border w-full rounded-2xl py-8 px-4 flex flex-col items-center justify-center relative group transition-colors hover:bg-secondary/80">
                          <span className="font-mono text-4xl sm:text-5xl font-bold tracking-[0.2em] sm:tracking-[0.3em] text-foreground ml-[0.2em] sm:ml-[0.3em]" data-testid="text-pairing-code">
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
                        <div className="mt-8 flex flex-col items-center text-center space-y-4">
                          <div className="flex items-center space-x-3 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            <span className="text-sm font-medium">Waiting for WhatsApp connection...</span>
                          </div>
                          <p className="text-xs text-muted-foreground max-w-[280px]">
                            Open WhatsApp → Linked Devices → Link a Device → Link with phone number instead.
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
                        <p className="text-muted-foreground mb-8">The pairing session expired or was rejected.</p>
                        <Button onClick={handlePairReset} size="lg" className="w-full" data-testid="button-try-again">
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
                        <h3 className="text-2xl font-bold mb-2" data-testid="text-success">Successfully Paired!</h3>
                        <p className="text-muted-foreground mb-8">
                          LUCA is now connected to your WhatsApp account.
                        </p>
                        <Button onClick={handlePairReset} variant="outline" size="lg" className="w-full" data-testid="button-done">
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
    </div>
  );
}
