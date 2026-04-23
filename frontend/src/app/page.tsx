"use client";

import Link from "next/link";

const features = [
  {
    icon: "🎯",
    title: "Object Detection",
    description:
      "Faster R-CNN fine-tuned on Pascal VOC. Detects person & bicycle with bounding box overlays.",
    href: "/detect",
    color: "from-blue-500 to-cyan-400",
    stats: "ResNet50-FPN Backbone",
  },
  {
    icon: "👤",
    title: "Face Recognition",
    description:
      "InsightFace + ArcFace embedding pipeline. Real-time identity matching with cosine similarity.",
    href: "/face",
    color: "from-purple-500 to-pink-400",
    stats: "512-d ArcFace Embedding",
  },
  {
    icon: "🛡️",
    title: "Anti-Spoofing",
    description:
      "MediaPipe blink-based liveness detection. Prevents photo & video replay attacks.",
    href: "/face",
    color: "from-emerald-500 to-teal-400",
    stats: "EAR Blink Detection",
  },
];

const techStack = [
  { name: "PyTorch", icon: "🔥" },
  { name: "FastAPI", icon: "⚡" },
  { name: "Next.js", icon: "▲" },
  { name: "InsightFace", icon: "🧠" },
  { name: "MediaPipe", icon: "📹" },
  { name: "CUDA", icon: "🟢" },
];

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Hero Section */}
      <section className="text-center mb-20 animate-fade-in-up">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text-muted)] mb-8">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-green)] animate-pulse"></span>
          Modul 2 — Praktikum Machine Learning
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
          <span className="bg-gradient-to-r from-[var(--primary-light)] via-[var(--secondary)] to-[var(--accent-green)] bg-clip-text text-transparent">
            ML Vision
          </span>
          <br />
          <span className="text-white">Laboratory</span>
        </h1>

        <p className="text-lg md:text-xl text-[var(--text-muted)] max-w-2xl mx-auto mb-10 leading-relaxed">
          Full-stack Computer Vision platform powered by{" "}
          <span className="text-white font-medium">Faster R-CNN</span>,{" "}
          <span className="text-white font-medium">ArcFace</span>, and{" "}
          <span className="text-white font-medium">MediaPipe</span>. From
          transfer learning to anti-spoofing — all in one system.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/detect" className="btn-primary text-base px-8 py-3.5 inline-flex items-center gap-2">
            <span>🎯</span> Try Object Detection
          </Link>
          <Link href="/face" className="btn-secondary text-base px-8 py-3.5 inline-flex items-center gap-2">
            <span>👤</span> Face Recognition
          </Link>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="mb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <Link
              key={feature.title}
              href={feature.href}
              className={`glass-card p-8 group hover:scale-[1.02] transition-all duration-500 animate-fade-in-up`}
              style={{ animationDelay: `${(i + 1) * 100}ms`, opacity: 0 }}
            >
              {/* Icon */}
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-2xl mb-5 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg`}
              >
                {feature.icon}
              </div>

              <h3 className="text-xl font-bold text-white mb-3">
                {feature.title}
              </h3>

              <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-5">
                {feature.description}
              </p>

              {/* Stats Badge */}
              <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--primary-light)] font-medium">
                {feature.stats}
              </div>

              {/* Arrow */}
              <div className="mt-5 flex items-center gap-2 text-sm text-[var(--text-muted)] group-hover:text-[var(--primary-light)] transition-colors">
                Launch
                <svg
                  className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Architecture Section */}
      <section className="mb-20 animate-fade-in-up delay-400" style={{ opacity: 0 }}>
        <div className="glass-card p-10">
          <h2 className="text-2xl font-bold text-white mb-2 text-center">
            System Architecture
          </h2>
          <p className="text-[var(--text-muted)] text-center mb-8">
            Backbone + Head pattern with clean separation of concerns
          </p>

          {/* Architecture Diagram */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-3xl mb-3">🖼️</div>
              <h3 className="text-white font-semibold mb-1">Frontend</h3>
              <p className="text-[var(--text-muted)] text-sm">
                Next.js + React
                <br />
                Canvas Overlay • Webcam
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-[var(--primary)]/10 to-[var(--secondary)]/10 border border-[var(--primary)]/20">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="text-white font-semibold mb-1">API Server</h3>
              <p className="text-[var(--text-muted)] text-sm">
                FastAPI + Uvicorn
                <br />
                /detect • /face/*
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-3xl mb-3">🧠</div>
              <h3 className="text-white font-semibold mb-1">ML Models</h3>
              <p className="text-[var(--text-muted)] text-sm">
                Faster R-CNN • ArcFace
                <br />
                MediaPipe • CUDA
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="mb-16">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {techStack.map((tech) => (
            <div
              key={tech.name}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:scale-105 transition-all text-sm"
            >
              <span>{tech.icon}</span>
              <span className="text-[var(--text-muted)]">{tech.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-[var(--text-muted)] text-sm py-8 border-t border-[var(--border)]">
        <p>
          Modul 2 — Praktikum Machine Learning •{" "}
          <span className="text-[var(--primary-light)]">
            Computer Vision Pipeline
          </span>
        </p>
      </footer>
    </div>
  );
}
