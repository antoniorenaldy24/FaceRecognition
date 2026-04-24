import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface ScannerHUDProps {
  children: React.ReactNode;
  status: "idle" | "scanning" | "success" | "failed";
  message: string;
}

export default function ScannerHUD({ children, status, message }: ScannerHUDProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useGSAP(() => {
    if (status === "scanning") {
      gsap.to(".scan-line", {
        y: "100%",
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
      gsap.to(".hud-message", {
        scale: 1.05,
        duration: 0.5,
        repeat: -1,
        yoyo: true
      });
    } else {
      gsap.killTweensOf(".scan-line");
      gsap.set(".scan-line", { y: "-10%" });
    }
    
    if (status === "success") {
      gsap.fromTo(".hud-overlay", 
        { backgroundColor: "rgba(72, 187, 120, 0.4)" },
        { backgroundColor: "rgba(72, 187, 120, 0)", duration: 1 }
      );
    } else if (status === "failed") {
      gsap.fromTo(".hud-overlay", 
        { backgroundColor: "rgba(245, 101, 101, 0.4)" },
        { backgroundColor: "rgba(245, 101, 101, 0)", duration: 1 }
      );
    }
  }, [status]);

  let statusColor = "bg-[var(--primary)]";
  if (status === "success") statusColor = "bg-[var(--accent-green)] text-white";
  if (status === "failed") statusColor = "bg-[var(--accent-rose)] text-white";
  if (status === "scanning") statusColor = "bg-[var(--secondary)] text-white";

  return (
    <div ref={containerRef} className="relative w-full aspect-video rounded-3xl overflow-hidden bg-white border-8 border-black shadow-[8px_8px_0px_black] group">
      {/* Video Content */}
      <div className="absolute inset-0">
        {children}
      </div>

      {/* Decorative corners */}
      <div className="absolute top-4 left-4 w-8 h-8 border-t-8 border-l-8 border-[var(--primary)] z-20"></div>
      <div className="absolute top-4 right-4 w-8 h-8 border-t-8 border-r-8 border-[var(--primary)] z-20"></div>
      <div className="absolute bottom-4 left-4 w-8 h-8 border-b-8 border-l-8 border-[var(--primary)] z-20"></div>
      <div className="absolute bottom-4 right-4 w-8 h-8 border-b-8 border-r-8 border-[var(--primary)] z-20"></div>

      {/* Playful Scan Line */}
      {status === "scanning" && (
        <div className="scan-line absolute top-0 left-0 w-full h-[15%] bg-gradient-to-b from-transparent via-[var(--primary)]/50 to-[var(--primary)] border-b-8 border-[var(--primary)] z-30 opacity-70"></div>
      )}

      {/* Color overlay flash */}
      <div className="hud-overlay absolute inset-0 z-10 pointer-events-none"></div>

      {/* Top Status Bar */}
      <div className="absolute top-0 left-0 w-full flex justify-center p-4 z-40">
        {message && (
          <div className={`hud-message px-6 py-2 rounded-xl border-4 border-black font-black text-lg tracking-wide uppercase shadow-[4px_4px_0px_black] ${statusColor}`}>
            {message}
          </div>
        )}
      </div>
      
      {/* Recording Indicator */}
      {status === "scanning" && (
        <div className="absolute top-6 right-6 z-40 flex items-center gap-2 bg-white px-3 py-1 rounded-full border-2 border-black">
          <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse border-2 border-black"></div>
          <span className="font-black text-black text-xs">REC</span>
        </div>
      )}
    </div>
  );
}
