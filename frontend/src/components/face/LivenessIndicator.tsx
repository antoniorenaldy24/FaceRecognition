"use client";

import { motion } from "framer-motion";
import { Activity } from "lucide-react";

interface LivenessIndicatorProps {
  isActive: boolean;
  isLive: boolean | null;
  message: string;
}

export default function LivenessIndicator({ isActive, isLive, message }: LivenessIndicatorProps) {
  if (!isActive) return null;

  // Determine color based on status
  let color = "var(--secondary)"; // scanning
  if (isLive === true) color = "var(--accent-green)";
  else if (isLive === false) color = "var(--accent-rose)";

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-[var(--surface-hover)] rounded-2xl border border-[var(--border)] relative overflow-hidden">
      {/* Background glow */}
      <div 
        className="absolute inset-0 opacity-10" 
        style={{ background: `radial-gradient(circle at center, ${color} 0%, transparent 70%)` }} 
      />

      <div className="flex items-center gap-4 relative z-10">
        {/* Pulse Ring */}
        <div className="relative flex items-center justify-center w-12 h-12">
          {isLive === null && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full border-2"
                style={{ borderColor: color }}
                animate={{ scale: [1, 2], opacity: [1, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-2"
                style={{ borderColor: color }}
                animate={{ scale: [1, 2], opacity: [1, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.75 }}
              />
            </>
          )}
          <div className="relative w-10 h-10 rounded-full bg-[var(--surface)] border flex items-center justify-center shadow-lg" style={{ borderColor: color }}>
            <Activity className="w-5 h-5" style={{ color }} />
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
            Bio-Metric Scanner
            {isLive !== null && (
              <span className="text-xs px-2 py-0.5 rounded bg-black/50" style={{ color }}>
                {isLive ? "PASSED" : "FAILED"}
              </span>
            )}
          </h4>
          <p className="text-xs text-[var(--text-muted)] font-mono">
            {message || "Monitoring for vital signs..."}
          </p>
        </div>
      </div>
    </div>
  );
}
