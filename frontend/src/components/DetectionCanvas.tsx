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

        // Set styles based on class (Neobrutalism colors)
        let color = "#000000"; 
        let bgColor = "#ED64A6"; // Pink for bicycle
        if (det.label_name.toLowerCase() === "person") {
          bgColor = "#48BB78"; // Green for person
        }

        // Draw rectangle
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(4, image.width * 0.008);
        ctx.strokeRect(x1, y1, width, height);
        
        // Draw inner border for that pop effect
        ctx.strokeStyle = bgColor;
        ctx.lineWidth = Math.max(2, image.width * 0.004);
        ctx.strokeRect(x1 + 2, y1 + 2, width - 4, height - 4);

        // Draw label background
        const text = `${det.label_name === "person" ? "👤 Orang" : "🚲 Sepeda"} ${(det.score * 100).toFixed(1)}%`;
        ctx.font = `900 ${Math.max(18, image.width * 0.025)}px Nunito, sans-serif`;
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = parseInt(ctx.font, 10);

        ctx.fillStyle = bgColor;
        // background padding
        ctx.fillRect(x1 - ctx.lineWidth/2, y1 - textHeight - 16, textWidth + 20, textHeight + 16);
        
        // Label border
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(2, image.width * 0.004);
        ctx.strokeRect(x1 - ctx.lineWidth/2, y1 - textHeight - 16, textWidth + 20, textHeight + 16);

        // Draw label text
        ctx.fillStyle = "#000000"; // Black text on colored background for contrast
        ctx.fillText(text, x1 + 10, y1 - 8);
      });
    };
  }, [imageUrl, detections]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden flex justify-center items-center">
      <canvas
        ref={canvasRef}
        className="max-w-full max-h-[70vh] object-contain rounded-lg"
        style={{ display: imageUrl ? "block" : "none" }}
      />
      {!imageUrl && (
        <div className="w-full h-64 flex items-center justify-center font-bold text-gray-500">
          Tidak ada gambar untuk ditampilkan
        </div>
      )}
    </div>
  );
}
