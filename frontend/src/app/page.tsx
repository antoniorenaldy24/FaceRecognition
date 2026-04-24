"use client";

import Link from "next/link";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

const features = [
  {
    icon: "🎯",
    title: "Deteksi Objek",
    description:
      "Kenali orang dan sepeda secara langsung dengan model Faster R-CNN yang super pintar!",
    href: "/detect",
    color: "bg-[var(--secondary)]",
    stats: "ResNet50 Backbone",
  },
  {
    icon: "👤",
    title: "Pengenalan Wajah",
    description:
      "Bandingkan wajah secara instan menggunakan teknologi ArcFace dengan akurasi tinggi.",
    href: "/face",
    color: "bg-[var(--accent-pink)]",
    stats: "512-d ArcFace",
  },
  {
    icon: "🛡️",
    title: "Anti-Kecurangan",
    description:
      "Deteksi kedipan mata asli untuk mencegah penipuan menggunakan foto atau video palsu!",
    href: "/face",
    color: "bg-[var(--accent-green)]",
    stats: "Liveness Check",
  },
];

const techStack = [
  { name: "PyTorch", icon: "🔥" },
  { name: "FastAPI", icon: "⚡" },
  { name: "Next.js", icon: "▲" },
  { name: "InsightFace", icon: "🧠" },
  { name: "MediaPipe", icon: "📹" },
];

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useGSAP(() => {
    const tl = gsap.timeline();
    
    // Animate Hero Text
    tl.from(".hero-text", {
      y: 100,
      opacity: 0,
      duration: 1,
      stagger: 0.2,
      ease: "back.out(1.7)",
    });

    // Animate Buttons
    tl.from(".hero-btn", {
      scale: 0,
      opacity: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: "elastic.out(1, 0.5)",
    }, "-=0.4");

    // Animate Feature Cards
    tl.from(".feature-card", {
      y: 50,
      opacity: 0,
      duration: 0.8,
      stagger: 0.15,
      ease: "back.out(1.2)",
    }, "-=0.2");
    
    // Floating animation for icons inside cards
    gsap.to(".floating-icon", {
      y: -8,
      duration: 1.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      stagger: 0.2
    });

  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="max-w-7xl mx-auto px-6 py-12">
      {/* Hero Section */}
      <section className="text-center mb-24 mt-10">
        {/* Badge */}
        <div className="hero-text inline-flex items-center gap-3 px-6 py-3 rounded-full neo-card font-bold text-black mb-8 border-2">
          <span className="w-4 h-4 rounded-full bg-[var(--accent-rose)] border-2 border-black animate-pulse"></span>
          Modul 2 — Praktikum Machine Learning
        </div>

        <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-8 text-black drop-shadow-[4px_4px_0px_white]">
          <span className="hero-text block mb-2">Laboratorium</span>
          <span className="hero-text inline-block bg-[var(--primary)] px-6 py-2 rounded-2xl border-4 border-black shadow-[8px_8px_0px_black] rotate-2">
            Visi Mesin!
          </span>
        </h1>

        <p className="hero-text text-xl md:text-2xl text-gray-800 font-bold max-w-3xl mx-auto mb-12 leading-relaxed">
          Platform komputer cerdas yang bisa melihat dan mengenali objek seperti manusia. Ditenagai oleh keajaiban AI terbaru! ✨
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <Link href="/detect" className="hero-btn btn-neo text-lg px-8 py-4 bg-[var(--secondary)] text-white hover:bg-[var(--secondary-light)]">
            <span className="text-2xl">🎯</span> Coba Deteksi Objek
          </Link>
          <Link href="/face" className="hero-btn btn-neo text-lg px-8 py-4 bg-[var(--accent-pink)] text-white hover:bg-[#F687B3]">
            <span className="text-2xl">👤</span> Pengenalan Wajah
          </Link>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="mb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <Link
              key={feature.title}
              href={feature.href}
              className={`feature-card neo-card p-8 group flex flex-col items-center text-center ${feature.color}`}
            >
              {/* Icon */}
              <div className="floating-icon w-20 h-20 rounded-full bg-white border-4 border-black shadow-[4px_4px_0px_black] flex items-center justify-center text-4xl mb-6">
                {feature.icon}
              </div>

              <h3 className="text-2xl font-black text-black mb-4">
                {feature.title}
              </h3>

              <p className="text-black font-semibold text-lg leading-relaxed mb-6 flex-grow">
                {feature.description}
              </p>

              {/* Stats Badge */}
              <div className="mt-auto px-4 py-2 rounded-xl bg-white border-2 border-black font-bold text-sm shadow-[2px_2px_0px_black]">
                {feature.stats}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="mb-16">
        <h2 className="text-3xl font-black text-center mb-8 text-black">Teknologi Di Balik Layar 🛠️</h2>
        <div className="flex flex-wrap items-center justify-center gap-6">
          {techStack.map((tech) => (
            <div
              key={tech.name}
              className="feature-card flex items-center gap-3 px-6 py-3 rounded-2xl bg-white border-4 border-black shadow-[4px_4px_0px_black] font-bold text-lg hover:-translate-y-2 hover:shadow-[6px_6px_0px_black] transition-all cursor-default"
            >
              <span className="text-2xl">{tech.icon}</span>
              <span>{tech.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center font-bold text-gray-600 text-base py-12 mt-12 border-t-4 border-black border-dashed">
        <p>
          Dibuat dengan ❤️ untuk Praktikum Machine Learning Modul 2
        </p>
      </footer>
    </div>
  );
}
