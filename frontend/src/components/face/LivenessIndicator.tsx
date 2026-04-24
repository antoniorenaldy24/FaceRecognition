import React from "react";
import { ShieldAlert, ShieldCheck, Eye } from "lucide-react";

interface LivenessIndicatorProps {
  isActive: boolean;
  isLive: boolean | null;
  message: string;
}

export default function LivenessIndicator({ isActive, isLive, message }: LivenessIndicatorProps) {
  if (!isActive) return null;

  let bgClass = "bg-white text-black";
  let icon = <Eye className="w-8 h-8 text-[var(--secondary)] animate-bounce" />;
  
  if (isLive === true) {
    bgClass = "bg-[var(--accent-green)] text-white";
    icon = <ShieldCheck className="w-8 h-8 text-white" />;
  } else if (isLive === false) {
    bgClass = "bg-[var(--accent-rose)] text-white";
    icon = <ShieldAlert className="w-8 h-8 text-white animate-pulse" />;
  }

  return (
    <div className={`neo-card flex items-center gap-4 p-4 border-4 border-black shadow-[4px_4px_0px_black] ${bgClass}`}>
      <div className="p-2 bg-white rounded-xl border-4 border-black shadow-[2px_2px_0px_black] rotate-3">
        {icon}
      </div>
      <div>
        <h3 className="font-black text-xl uppercase drop-shadow-[1px_1px_0px_black] text-inherit">
          {isLive === true ? "Wajah Asli! ✅" : isLive === false ? "Wajah Palsu! ❌" : "Deteksi Kedipan 👀"}
        </h3>
        <p className="text-sm font-bold opacity-90 mt-1">
          {message}
        </p>
      </div>
    </div>
  );
}
