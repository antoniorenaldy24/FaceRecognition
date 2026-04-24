"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export default function InteractiveBackground() {
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bgRef.current) return;

    const parallaxLayers = bgRef.current.querySelectorAll(".parallax-layer");
    const shapes = bgRef.current.querySelectorAll(".bg-shape");

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

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) return;

      const xPos = (e.clientX / window.innerWidth - 0.5) * 60;
      const yPos = (e.clientY / window.innerHeight - 0.5) * 60;

      gsap.to(parallaxLayers, {
        x: (index, target) => {
          const depth = target.getAttribute("data-depth") || 1;
          return xPos * Number(depth);
        },
        y: (index, target) => {
          const depth = target.getAttribute("data-depth") || 1;
          return yPos * Number(depth);
        },
        duration: 1.5,
        ease: "power2.out",
        overwrite: "auto"
      });
    };

    const handleMouseLeave = () => {
      gsap.to(parallaxLayers, {
        x: 0,
        y: 0,
        duration: 1,
        ease: "power2.out",
        overwrite: "auto"
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div ref={bgRef} className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
      <div className="parallax-layer absolute top-[10%] left-[10%]" data-depth="2">
        <div className="bg-shape w-32 h-32 rounded-full border-8 border-black bg-[var(--primary)] opacity-40 mix-blend-multiply"></div>
      </div>
      <div className="parallax-layer absolute top-[60%] left-[80%]" data-depth="3">
        <div className="bg-shape w-48 h-48 border-8 border-black bg-[var(--secondary)] opacity-40 mix-blend-multiply rotate-12"></div>
      </div>
      <div className="parallax-layer absolute top-[80%] left-[20%]" data-depth="1.5">
        <div className="bg-shape w-24 h-24 rounded-full border-8 border-black bg-[var(--accent-pink)] opacity-40 mix-blend-multiply"></div>
      </div>
      <div className="parallax-layer absolute top-[20%] left-[70%]" data-depth="2.5">
        <div className="bg-shape w-40 h-40 rounded-3xl border-8 border-black bg-[var(--accent-green)] opacity-40 mix-blend-multiply -rotate-12"></div>
      </div>
      <div className="parallax-layer absolute top-[40%] left-[40%]" data-depth="4">
        <div className="bg-shape w-16 h-16 rounded-full border-4 border-black bg-[var(--accent-rose)] opacity-40 mix-blend-multiply"></div>
      </div>
    </div>
  );
}