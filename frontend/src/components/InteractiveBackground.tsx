"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export default function InteractiveBackground() {
  const bgRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!bgRef.current) return;
    
    const shapes = bgRef.current.querySelectorAll(".bg-shape");
    
    // Initial floating animation
    shapes.forEach((shape) => {
      gsap.to(shape, {
        x: "random(-100, 100)",
        y: "random(-100, 100)",
        rotation: "random(-45, 45)",
        duration: "random(4, 8)",
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
    });

    // Mouse interactive parallax
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const xPos = (clientX / window.innerWidth - 0.5) * 40;
      const yPos = (clientY / window.innerHeight - 0.5) * 40;

      gsap.to(shapes, {
        x: (index, target) => {
          const depth = target.getAttribute("data-depth") || 1;
          return xPos * Number(depth);
        },
        y: (index, target) => {
          const depth = target.getAttribute("data-depth") || 1;
          return yPos * Number(depth);
        },
        duration: 1,
        ease: "power2.out"
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div ref={bgRef} className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
      <div 
        className="bg-shape absolute top-[10%] left-[10%] w-32 h-32 rounded-full border-8 border-black bg-[var(--primary)] opacity-40 mix-blend-multiply"
        data-depth="2"
      ></div>
      <div 
        className="bg-shape absolute top-[60%] left-[80%] w-48 h-48 border-8 border-black bg-[var(--secondary)] opacity-40 mix-blend-multiply rotate-12"
        data-depth="3"
      ></div>
      <div 
        className="bg-shape absolute top-[80%] left-[20%] w-24 h-24 rounded-full border-8 border-black bg-[var(--accent-pink)] opacity-40 mix-blend-multiply"
        data-depth="1.5"
      ></div>
      <div 
        className="bg-shape absolute top-[20%] left-[70%] w-40 h-40 rounded-3xl border-8 border-black bg-[var(--accent-green)] opacity-40 mix-blend-multiply -rotate-12"
        data-depth="2.5"
      ></div>
      <div 
        className="bg-shape absolute top-[40%] left-[40%] w-16 h-16 rounded-full border-4 border-black bg-[var(--accent-rose)] opacity-40 mix-blend-multiply"
        data-depth="4"
      ></div>
    </div>
  );
}
