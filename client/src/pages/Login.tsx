import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Mail, Lock, ArrowRight, Loader2, Sparkles, Shield, Zap, Users } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const features = [
  { icon: Zap, title: "Instant Pairing", desc: "Connect in seconds" },
  { icon: Shield, title: "Secure", desc: "End-to-end encrypted" },
  { icon: Users, title: "Multi-User", desc: "100+ bots supported" },
];

export default function Login() {
  const [, navigate] = useLocation();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (isAuthenticated) {
    navigate("/dashboard");
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    login.mutate(
      { email, password },
      {
        onSuccess: () => navigate("/dashboard"),
        onError: (err) => setError(err.message),
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 items-center justify-center p-12 overflow-hidden">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-primary/10 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] border border-primary/15 rounded-full" />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 text-center max-w-md"
        >
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary to-primary/80 rounded-3xl flex items-center justify-center shadow-xl shadow-primary/25 mb-6">
              <Bot className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight mb-3">
              LUCA <span className="text-primary">Bot</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              The most powerful WhatsApp bot management platform
            </p>
          </motion.div>

          <div className="grid grid-cols-3 gap-4 mt-12">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.15, duration: 0.5 }}
                className="glass-card rounded-2xl p-4 text-center"
              >
                <div className="w-10 h-10 mx-auto bg-primary/10 rounded-xl flex items-center justify-center mb-2">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs font-bold">{f.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-12 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] pointer-events-none lg:hidden" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-[420px] relative z-10"
        >
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight">LUCA <span className="text-primary">Bot</span></span>
          </div>

          <div className="glass-card rounded-[2rem] p-6 sm:p-8 md:p-10 relative overflow-hidden border border-white/10">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                Welcome Back
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2" data-testid="text-login-title">
                Sign in to your account
              </h1>
              <p className="text-muted-foreground text-sm">
                Access your bot dashboard and manage everything
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-12 rounded-xl bg-secondary/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all"
                    data-testid="input-email"
                    disabled={login.isPending}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 h-12 rounded-xl bg-secondary/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all"
                    data-testid="input-password"
                    disabled={login.isPending}
                  />
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-destructive/10 text-destructive text-sm font-medium px-4 py-3 rounded-xl border border-destructive/20"
                    data-testid="text-login-error"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                size="lg"
                className="w-full h-12 rounded-xl group text-base font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                disabled={login.isPending || !email || !password}
                data-testid="button-login"
              >
                {login.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/register" className="text-primary font-bold hover:underline" data-testid="link-register">
                Create one
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Secure pairing powered by LUCA Bot
          </p>
        </motion.div>
      </div>
    </div>
  );
}
