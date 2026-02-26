import { motion } from "framer-motion";
import { Bot, Wrench } from "lucide-react";

export default function Maintenance() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="glass-card rounded-[2rem] p-8 md:p-10 relative overflow-hidden">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-inner">
              <Wrench className="w-8 h-8 text-amber-500" />
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight mb-3" data-testid="text-maintenance-title">
              Under Maintenance
            </h1>
            <p className="text-muted-foreground text-base mb-6">
              LUCA Bot is currently undergoing scheduled maintenance. We'll be back shortly.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Bot className="w-4 h-4 text-primary" />
              <span>Powered by LUCA Bot</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
