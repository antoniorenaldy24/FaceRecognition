import React, { useEffect, useRef } from "react";

interface Detection {
  bbox: [number, number, number, number];
  label: number;
  label_name: string;
  score: number;
}

interface DetectionCanvasProps {
  imageUrl: string;
  detections: Detection[];
}

export default function DetectionCanvas({ imageUrl, detections }: DetectionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!imageUrl || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const image = new Image();
    image.src = imageUrl;

    image.onload = () => {
      // Set canvas dimensions to match the image's original dimensions
      canvas.width = image.width;
      canvas.height = image.height;

      // Draw the image onto the canvas
      ctx.drawImage(image, 0, 0, image.width, image.height);

      // Draw bounding boxes
      detections.forEach((det) => {
        const [x1, y1, x2, y2] = det.bbox;
        const width = x2 - x1;
        const height = y2 - y1;

        // Set styles based on class
        let color = "#FF0000"; // default red
        if (det.label_name.toLowerCase() === "person") {
          color = "#00BFFF"; // cyan
        } else if (det.label_name.toLowerCase() === "bicycle") {
          color = "#00FF7F"; // green
        }

        // Draw rectangle
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(3, image.width * 0.005);
        ctx.strokeRect(x1, y1, width, height);

        // Draw label background
        const text = `${det.label_name} ${(det.score * 100).toFixed(1)}%`;
        ctx.font = `bold ${Math.max(16, image.width * 0.02)}px Inter, sans-serif`;
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = parseInt(ctx.font, 10);

        ctx.fillStyle = color;
        // background padding
        ctx.fillRect(x1 - ctx.lineWidth/2, y1 - textHeight - 10, textWidth + 10, textHeight + 10);

        // Draw label text
        ctx.fillStyle = "#000000"; // Black text on colored background for contrast
        ctx.fillText(text, x1 + 5, y1 - 5);
      });
    };
  }, [imageUrl, detections]);

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl bg-[var(--surface)] flex justify-center border border-[var(--border)] shadow-xl shadow-black/50">
      {/* We use object-contain to make sure the canvas scales correctly within its container while maintaining aspect ratio */}
      <canvas
        ref={canvasRef}
        className="max-w-full max-h-[70vh] object-contain"
        style={{ display: imageUrl ? "block" : "none" }}
      />
      {!imageUrl && (
        <div className="w-full h-64 flex items-center justify-center text-[var(--text-muted)]">
          No image to display
        </div>
      )}
    </div>
  );
}
