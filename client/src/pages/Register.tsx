import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Mail, Lock, ShieldCheck, ArrowRight, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const benefits = [
  "Instant WhatsApp bot pairing",
  "Real-time status monitoring",
  "Auto-restart on disconnect",
  "24/7 uptime guarantee",
];

export default function Register() {
  const [, navigate] = useLocation();
  const { register, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  if (isAuthenticated) {
    navigate("/dashboard");
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    register.mutate(
      { email, password, confirmPassword },
      {
        onSuccess: () => navigate("/dashboard"),
        onError: (err) => setError(err.message),
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 items-center justify-center p-12 overflow-hidden">
        <div className="absolute top-20 right-20 w-72 h-72 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-primary/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-primary/10 rounded-full" />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 max-w-md"
        >
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary to-primary/80 rounded-3xl flex items-center justify-center shadow-xl shadow-primary/25 mb-8">
            <Bot className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight mb-3 text-center">
            Join <span className="text-primary">LUCA Bot</span>
          </h2>
          <p className="text-muted-foreground text-lg text-center mb-10">
            Start managing your WhatsApp bots today
          </p>

          <div className="space-y-4">
            {benefits.map((b, i) => (
              <motion.div
                key={b}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                className="flex items-center gap-3 glass-card rounded-xl p-3.5"
              >
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-semibold">{b}</span>
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
                Get Started
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2" data-testid="text-register-title">
                Create your account
              </h1>
              <p className="text-muted-foreground text-sm">
                Set up your bot in under a minute
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
                    disabled={register.isPending}
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
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 h-12 rounded-xl bg-secondary/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all"
                    data-testid="input-password"
                    disabled={register.isPending}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Confirm Password
                </label>
                <div className="relative group">
                  <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-11 h-12 rounded-xl bg-secondary/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all"
                    data-testid="input-confirm-password"
                    disabled={register.isPending}
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
                    data-testid="text-register-error"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                size="lg"
                className="w-full h-12 rounded-xl group text-base font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                disabled={register.isPending || !email || !password || !confirmPassword}
                data-testid="button-register"
              >
                {register.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary font-bold hover:underline" data-testid="link-login">
                Sign in
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            By creating an account, you agree to our Terms of Service
          </p>
        </motion.div>
      </div>
    </div>
  );
}
