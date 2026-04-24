import React, { useRef } from "react";
import { UserCheck, UserX, AlertCircle } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface HoloCardProps {
  name: string | null;
  similarity: number;
  isMatch: boolean;
  message: string;
  alignedFaceB64?: string;
}

export default function HoloCard({ name, similarity, isMatch, message, alignedFaceB64 }: HoloCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // A bouncy reveal for the card
    gsap.from(cardRef.current, {
      scale: 0.8,
      rotation: isMatch ? -2 : 2,
      opacity: 0,
      duration: 0.6,
      ease: "back.out(1.5)"
    });
  }, { scope: cardRef });

  const isUnknown = name === null;
  
  let borderColor = "border-[var(--accent-rose)]";
  let bgColor = "bg-white";
  let icon = <UserX className="w-12 h-12 text-[var(--accent-rose)]" />;
  let badgeText = "TIDAK DIKENAL";
  let badgeColor = "bg-[var(--accent-rose)] text-white";

  if (isMatch) {
    borderColor = "border-[var(--accent-green)]";
    icon = <UserCheck className="w-12 h-12 text-[var(--accent-green)]" />;
    badgeText = "COCOK!";
    badgeColor = "bg-[var(--accent-green)] text-white";
  } else if (!isUnknown) {
    borderColor = "border-[var(--accent-amber)]";
    icon = <AlertCircle className="w-12 h-12 text-[var(--accent-amber)]" />;
    badgeText = "MIRIP TAPI BEDA";
    badgeColor = "bg-[var(--accent-amber)] text-black";
  }

  return (
    <div ref={cardRef} className={`relative overflow-hidden p-6 bg-white border-4 ${borderColor} rounded-3xl shadow-[6px_6px_0px_black] group hover:-translate-y-2 hover:shadow-[8px_8px_0px_black] transition-all duration-300`}>
      
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--text-muted)_2px,_transparent_2px)] bg-[length:20px_20px]"></div>

      <div className="relative z-10 flex items-start gap-6">
        
        {/* Face Thumbnail */}
        <div className={`shrink-0 w-28 h-28 rounded-2xl border-4 border-black overflow-hidden bg-gray-100 shadow-[4px_4px_0px_black] flex items-center justify-center -rotate-3 group-hover:rotate-0 transition-transform`}>
          {alignedFaceB64 ? (
            <img 
              src={`data:image/jpeg;base64,${alignedFaceB64}`} 
              alt="Detected Face"
              className="w-full h-full object-cover"
            />
          ) : (
            icon
          )}
        </div>

        {/* Identity Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="text-3xl font-black text-black truncate uppercase tracking-tight">
              {name || "Orang Asing"}
            </h3>
            <span className={`px-3 py-1 rounded-xl font-black text-sm border-2 border-black shadow-[2px_2px_0px_black] ${badgeColor}`}>
              {badgeText}
            </span>
          </div>

          <div className="bg-gray-100 p-3 rounded-xl border-4 border-black inline-block shadow-[2px_2px_0px_black] mt-2">
            <div className="text-sm font-bold text-gray-500 mb-1">Skor Kemiripan</div>
            <div className="flex items-center gap-3">
              {/* Progress bar Neobrutalism style */}
              <div className="w-32 h-6 bg-white border-2 border-black rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[var(--primary)] border-r-2 border-black transition-all duration-1000"
                  style={{ width: `${Math.max(0, similarity * 100)}%` }}
                />
              </div>
              <span className="font-black text-lg text-black">
                {(similarity * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          
          <div className="mt-4 font-bold text-gray-700 bg-[var(--secondary-light)] px-3 py-2 border-2 border-black rounded-xl inline-block shadow-[2px_2px_0px_black]">
            💬 {message}
          </div>
        </div>
      </div>
    </div>
  );
}
