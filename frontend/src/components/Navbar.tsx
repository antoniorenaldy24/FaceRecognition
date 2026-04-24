"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, Focus, ScanFace, Menu, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export default function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
    }, 50);
    return () => clearTimeout(timer);
  }, [pathname]);

  useGSAP(() => {
    gsap.from(navRef.current, {
      y: -100,
      opacity: 0,
      duration: 1,
      ease: "elastic.out(1, 0.5)",
    });

    gsap.to(logoRef.current, {
      y: -5,
      rotation: 5,
      duration: 1.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
  }, { scope: navRef });

  const navLinks = [
    { href: "/detect", label: "Deteksi Objek", icon: Focus },
    { href: "/face", label: "Pengenalan Wajah", icon: ScanFace },
  ];

  return (
    <nav ref={navRef} className="sticky top-0 z-50 p-4">
      <div className="max-w-7xl mx-auto neo-card bg-white px-6 py-4 flex items-center justify-between">

        <Link href="/" className="flex items-center gap-3 group">
          <div ref={logoRef} className="bg-[var(--primary)] text-black p-2 rounded-xl border-2 border-black shadow-[2px_2px_0px_black] group-hover:bg-[var(--accent-pink)] transition-colors">
            <Camera size={28} strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-black tracking-tight text-black">
            Visi<span className="text-[var(--secondary)]">Mesin</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-4">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-5 py-2.5 rounded-full font-bold border-2 border-black flex items-center gap-2 transition-all duration-300
                  ${isActive
                    ? "bg-[var(--primary)] shadow-[4px_4px_0px_black] translate-x-[-2px] translate-y-[-2px]"
                    : "bg-white hover:bg-[var(--primary-light)] hover:shadow-[4px_4px_0px_black] hover:translate-x-[-2px] hover:translate-y-[-2px]"}
                `}
              >
                <Icon size={20} strokeWidth={isActive ? 3 : 2} />
                {link.label}
              </Link>
            );
          })}
        </div>

        <button
          className="md:hidden p-2 rounded-xl border-2 border-black bg-[var(--primary)] shadow-[2px_2px_0px_black] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_black] transition-all"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden mt-4 neo-card bg-white p-4 flex flex-col gap-3 animate-fade-in-up">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`p-4 rounded-xl font-bold border-2 border-black flex items-center gap-3
                  ${isActive ? "bg-[var(--primary)]" : "bg-gray-50"}
                `}
              >
                <Icon size={24} />
                <span className="text-lg">{link.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}