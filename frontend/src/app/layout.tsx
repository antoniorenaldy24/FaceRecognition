import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700", "800"],
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
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased`}>
        <div className="min-h-screen bg-mesh">
          <Navbar />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
