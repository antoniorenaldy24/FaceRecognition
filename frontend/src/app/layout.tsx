import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import InteractiveBackground from "@/components/InteractiveBackground";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "ML Vision Lab | Object Detection & Face Recognition",
  description:
    "Full-stack Computer Vision platform with Faster R-CNN object detection, InsightFace recognition, and anti-spoofing liveness detection. Built with PyTorch & Next.js.",
  keywords: [
    "object detection",
    "face recognition",
    "computer vision",
    "machine learning",
    "faster rcnn",
    "insightface",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="light">
      <body className={`${nunito.variable} antialiased bg-[var(--background)] font-sans`}>
        <InteractiveBackground />
        <div className="min-h-screen">
          <Navbar />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
