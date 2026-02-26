import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Phone, Copy, CheckCircle2, ArrowRight, Loader2, RefreshCcw } from "lucide-react";
import { useCopyToClipboard, useWindowSize } from "react-use";
import Confetti from "react-confetti";
import { z } from "zod";

import { useRequestPairing, usePairingStatus } from "@/hooks/use-pairing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Minimal local validation before hitting the API
const phoneSchema = z.string().min(8, "Phone number is too short").regex(/^\d+$/, "Only numbers are allowed, no +, -, or spaces");

export default function Home() {
  const { width, height } = useWindowSize();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  
  const [, copyToClipboard] = useCopyToClipboard();
  const [copied, setCopied] = useState(false);

  const requestMutation = useRequestPairing();
  const { data: statusData, isError: isStatusError } = usePairingStatus(activePhone);

  const isConnected = statusData?.status === "connected";
  const isFailed = statusData?.status === "failed" || isStatusError;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");

    // Strip out +, -, spaces, parentheses
    const cleanPhone = phoneNumber.replace(/[\s\-\+\(\)]/g, "");
    
    try {
      phoneSchema.parse(cleanPhone);
      
      requestMutation.mutate({ phoneNumber: cleanPhone }, {
        onSuccess: (data) => {
          setPairingCode(data.code);
          setActivePhone(cleanPhone);
        },
        onError: (err) => {
          setPhoneError(err.message);
        }
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        setPhoneError(err.errors[0].message);
      }
    }
  };

  const handleCopy = () => {
    if (pairingCode) {
      copyToClipboard(pairingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setPairingCode(null);
    setActivePhone(null);
    setPhoneNumber("");
    setPhoneError("");
    requestMutation.reset();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {isConnected && (
        <Confetti 
          width={width} 
          height={height} 
          recycle={false} 
          numberOfPieces={400} 
          gravity={0.15}
          colors={['#16a34a', '#22c55e', '#4ade80', '#ffffff']}
        />
      )}

      {/* Decorative background elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="glass-card rounded-[2rem] p-8 md:p-10 relative overflow-hidden">
          
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-inner">
              <Bot className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-3">Pair your Bot</h1>
            <p className="text-muted-foreground text-base">
              Connect LUCA to your WhatsApp account seamlessly in seconds.
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
                onSubmit={handleSubmit} 
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
                    />
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    Include country code, without '+' or leading zeros (e.g. 1 for US, 44 for UK).
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
                  <span className="font-mono text-4xl sm:text-5xl font-bold tracking-[0.2em] sm:tracking-[0.3em] text-foreground ml-[0.2em] sm:ml-[0.3em]">
                    {pairingCode}
                  </span>
                  
                  <button
                    onClick={handleCopy}
                    className="absolute top-3 right-3 p-2 bg-background rounded-lg border shadow-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all active:scale-95"
                    title="Copy to clipboard"
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
                
                <Button variant="ghost" className="mt-6 text-muted-foreground" onClick={handleReset}>
                  Cancel and try another number
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
                <p className="text-muted-foreground mb-8">
                  The pairing session expired or was rejected. Please try again.
                </p>
                <Button onClick={handleReset} size="lg" className="w-full">
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
                <h3 className="text-2xl font-bold mb-2">Successfully Paired!</h3>
                <p className="text-muted-foreground mb-8">
                  LUCA is now connected to your WhatsApp account.
                </p>
                <Button onClick={handleReset} variant="outline" size="lg" className="w-full">
                  Pair Another Device
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      
      <div className="mt-8 text-center text-sm text-muted-foreground">
        Secure pairing powered by LUCA Bot
      </div>
    </div>
  );
}
