"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { UserCheck, UserX, Info } from "lucide-react";
import React from "react";

interface HoloCardProps {
  name: string | null;
  similarity: number;
  isMatch: boolean;
  message: string;
  alignedFaceB64?: string | null;
}

export default function HoloCard({ name, similarity, isMatch, message, alignedFaceB64 }: HoloCardProps) {
  // 3D Tilt Effect Setup
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["17.5deg", "-17.5deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-17.5deg", "17.5deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  // Styling based on match status
  const color = isMatch ? "var(--accent-green)" : "var(--accent-rose)";
  const bgGradient = isMatch 
    ? "from-[var(--accent-green)]/20 to-[var(--surface-hover)]"
    : "from-[var(--accent-rose)]/20 to-[var(--surface-hover)]";

  return (
    <div className="perspective-1000 w-full">
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`relative w-full rounded-2xl border p-8 backdrop-blur-xl bg-gradient-to-br ${bgGradient} overflow-hidden shadow-2xl`}
        style={{ borderColor: `${color}40` } as any}
      >
        {/* Holographic reflection effect */}
        <div className="absolute inset-0 z-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ transform: "translateZ(1px)" }} />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center" style={{ transform: "translateZ(50px)" }}>
          
          {/* Canonical Aligned Face Thumbnail */}
          {alignedFaceB64 && (
            <div className="absolute top-0 right-0 w-16 h-16 rounded-lg overflow-hidden border-2 shadow-lg" style={{ borderColor: color }}>
              <img src={`data:image/jpeg;base64,${alignedFaceB64}`} alt="Aligned Face" className="w-full h-full object-cover" />
              <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] font-mono text-center py-0.5">ALIGNED</div>
            </div>
          )}

          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,0,0,0.5)] border-4`}
            style={{ borderColor: color, backgroundColor: "var(--surface)" }}
          >
            {isMatch ? (
              <UserCheck className="w-12 h-12" style={{ color }} />
            ) : (
              <UserX className="w-12 h-12" style={{ color }} />
            )}
          </motion.div>

          <h3 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
            {isMatch ? name?.toUpperCase() : "UNKNOWN IDENTITY"}
          </h3>
          
          <div className="flex items-center gap-2 mb-6">
            <span className={`px-3 py-1 text-xs font-mono font-bold rounded-full border`} style={{ color, borderColor: color, backgroundColor: `${color}15` }}>
              {isMatch ? "VERIFIED MATCH" : "ACCESS DENIED"}
            </span>
          </div>

          <p className="text-[var(--text-muted)] text-sm mb-8 leading-relaxed max-w-xs">
            {message}
          </p>

          {/* Confidence Meter */}
          {similarity > 0 && (
            <div className="w-full bg-black/40 p-4 rounded-xl border border-[var(--border)]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-wider flex items-center gap-1">
                  <Info className="w-3 h-3" /> Confidence
                </span>
                <span className="text-sm font-bold text-white">{(similarity * 100).toFixed(1)}%</span>
              </div>
              
              <div className="h-2 w-full bg-black rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, similarity * 100)}%` }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
                />
              </div>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
}
