"use client";

import { motion } from "framer-motion";
import { Scan, ScanFace, ShieldAlert, ShieldCheck } from "lucide-react";
import { ReactNode } from "react";

interface ScannerHUDProps {
  children: ReactNode;
  status: "idle" | "scanning" | "success" | "failed";
  message?: string;
}

export default function ScannerHUD({ children, status, message }: ScannerHUDProps) {
  // Define colors based on status
  const colors = {
    idle: "var(--primary-light)",
    scanning: "var(--secondary)",
    success: "var(--accent-green)",
    failed: "var(--accent-rose)",
  };
  
  const color = colors[status];

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-[var(--border)] shadow-2xl group">
      {/* Video Content */}
      <div className="absolute inset-0 z-0 opacity-80 group-hover:opacity-100 transition-opacity">
        {children}
      </div>

      {/* Cyberpunk Grid Overlay */}
      <div 
        className="absolute inset-0 z-10 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
          backgroundSize: "40px 40px"
        }}
      />

      {/* Dark Vignette */}
      <div className="absolute inset-0 z-10 bg-gradient-to-c from-transparent via-black/20 to-black/80 pointer-events-none" />

      {/* HUD Corners (Targeting Brackets) */}
      <div className="absolute inset-6 z-20 pointer-events-none">
        {/* Top Left */}
        <div className={`absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 rounded-tl-xl transition-colors duration-500`} style={{ borderColor: color }} />
        {/* Top Right */}
        <div className={`absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 rounded-tr-xl transition-colors duration-500`} style={{ borderColor: color }} />
        {/* Bottom Left */}
        <div className={`absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 rounded-bl-xl transition-colors duration-500`} style={{ borderColor: color }} />
        {/* Bottom Right */}
        <div className={`absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 rounded-br-xl transition-colors duration-500`} style={{ borderColor: color }} />
      </div>

      {/* Sweeping Laser (Only active when scanning) */}
      {status === "scanning" && (
        <motion.div
          className="absolute left-0 right-0 h-[2px] z-20 pointer-events-none shadow-[0_0_20px_4px_rgba(6,182,212,0.8)]"
          style={{ backgroundColor: color }}
          initial={{ top: "0%" }}
          animate={{ top: ["0%", "100%", "0%"] }}
          transition={{ duration: 3, ease: "linear", repeat: Infinity }}
        />
      )}

      {/* Status Overlay */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center">
        <motion.div 
          className="px-6 py-2 rounded-full backdrop-blur-md bg-black/40 border flex items-center gap-3"
          style={{ borderColor: `${color}80` }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          key={status} // re-animate on status change
        >
          {status === "idle" && <Scan className="w-5 h-5 text-white" />}
          {status === "scanning" && <ScanFace className="w-5 h-5 text-white animate-pulse" />}
          {status === "success" && <ShieldCheck className="w-5 h-5 text-[var(--accent-green)]" />}
          {status === "failed" && <ShieldAlert className="w-5 h-5 text-[var(--accent-rose)]" />}
          
          <span className="font-mono font-bold tracking-widest text-sm text-white uppercase">
            {status}
          </span>
        </motion.div>
        
        {message && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-xs font-mono bg-black/60 px-4 py-1.5 rounded text-[var(--text-muted)] uppercase tracking-wider"
          >
            {message}
          </motion.div>
        )}
      </div>

      {/* Decorative Data Streams */}
      <div className="absolute top-6 right-6 z-20 font-mono text-[10px] text-[var(--text-muted)] text-right opacity-60">
        <div>SYS.OPT: ONLINE</div>
        <div>CAM.FPS: 60</div>
        <div>NET.LAT: &lt;10ms</div>
        <div className="mt-2 text-xs" style={{ color }}>{status === 'scanning' ? 'ANALYZING_BIO_METRICS...' : 'AWAITING_INPUT...'}</div>
      </div>
    </div>
  );
}
