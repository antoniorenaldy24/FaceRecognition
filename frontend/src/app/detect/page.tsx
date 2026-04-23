"use client";

import { useState } from "react";
import { Loader2, Upload, SlidersHorizontal, AlertTriangle, Cpu } from "lucide-react";
import ImageDropzone from "@/components/ImageDropzone";
import DetectionCanvas from "@/components/DetectionCanvas";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface Detection {
  bbox: [number, number, number, number];
  label: number;
  label_name: string;
  score: number;
}

interface DetectionResponse {
  detections: Detection[];
  image_width: number;
  image_height: number;
  num_detections: number;
}

export default function DetectPage() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [results, setResults] = useState<DetectionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0.5);

  const handleImageDrop = async (droppedFile: File) => {
    setFile(droppedFile);
    setImageUrl(URL.createObjectURL(droppedFile));
    setResults(null);
    setError(null);
    await processImage(droppedFile, confidence);
  };

  const processImage = async (imgFile: File, conf: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append("file", imgFile);
      
      const response = await fetch(`${API_BASE}/api/detect?confidence=${conf}`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        let errorText = "";
        try { errorText = await response.text(); } catch(e) {}
        throw new Error(`API error ${response.status}: ${errorText.substring(0, 100)}`);
      }
      
      const data = await response.json();
      setResults(data);
    } catch (err: any) {
      console.error("Detection error:", err);
      setError(err.message || "Failed to process image");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newConf = parseFloat(e.target.value);
    setConfidence(newConf);
    if (file && !isLoading) {
      processImage(file, newConf);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-10 animate-fade-in-up">
        <h1 className="text-4xl font-bold text-white mb-4">
          <span className="text-[var(--primary-light)]">Object</span> Detection
        </h1>
        <p className="text-[var(--text-muted)] text-lg max-w-3xl">
          Upload an image to detect people and bicycles using our fine-tuned Faster R-CNN model.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Upload & Controls */}
        <div className="lg:col-span-1 space-y-6 animate-fade-in-up delay-100">
          <div className="glass-card p-6">
            <h2 className="text-xl font-bold text-white mb-4">Input Image</h2>
            <ImageDropzone onImageDrop={handleImageDrop} isLoading={isLoading} />
            
            {error && (
              <div className="mt-4 p-4 rounded-xl bg-[var(--accent-rose)]/10 border border-[var(--accent-rose)]/30 text-[var(--accent-rose)] text-sm">
                {error}
              </div>
            )}
          </div>

          <div className="glass-card p-6">
            <h2 className="text-xl font-bold text-white mb-4">Parameters</h2>
            
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-[var(--text-muted)]">Confidence Threshold</label>
                <span className="text-sm text-white font-bold">{confidence.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={confidence}
                onChange={handleConfidenceChange}
                disabled={isLoading}
                className="w-full h-2 bg-[var(--surface-hover)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
              />
              <div className="flex justify-between mt-1 px-1">
                <span className="text-xs text-[var(--text-muted)]">0.1</span>
                <span className="text-xs text-[var(--text-muted)]">1.0</span>
              </div>
            </div>
            
            <button 
              className="w-full btn-primary mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              onClick={() => file && processImage(file, confidence)}
              disabled={!file || isLoading}
            >
              {isLoading ? (
                <>
                  <div className="spinner w-5 h-5 border-2"></div>
                  Processing...
                </>
              ) : (
                <>🎯 Re-run Detection</>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-2 space-y-6 animate-fade-in-up delay-200">
          <div className="glass-card p-6 min-h-[500px] flex flex-col">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center justify-between">
              <span>Detection Results</span>
              {results && (
                <span className="text-sm font-normal px-3 py-1 bg-[var(--primary)]/20 text-[var(--primary-light)] rounded-full border border-[var(--primary)]/30">
                  {results.num_detections} objects found
                </span>
              )}
            </h2>
            
            <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] rounded-xl overflow-hidden border border-[var(--border)]">
              {imageUrl ? (
                results ? (
                  <DetectionCanvas imageUrl={imageUrl} detections={results.detections} />
                ) : isLoading ? (
                  <div className="flex flex-col items-center p-8">
                    <div className="spinner w-10 h-10 mb-4"></div>
                    <p className="text-[var(--text-muted)]">Running inference model...</p>
                  </div>
                ) : (
                  <img src={imageUrl} alt="Uploaded" className="max-w-full max-h-[70vh] object-contain opacity-50" />
                )
              ) : (
                <div className="text-[var(--text-muted)] flex flex-col items-center">
                  <span className="text-4xl mb-2">🖼️</span>
                  <p>Upload an image to see results</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Results Details Table */}
          {results && results.num_detections > 0 && (
            <div className="glass-card p-6 animate-fade-in-up">
              <h3 className="text-lg font-bold text-white mb-4">Detections Detail</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[var(--text-muted)]">
                  <thead className="text-xs uppercase bg-[var(--surface-hover)] text-white">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg">ID</th>
                      <th className="px-4 py-3">Class</th>
                      <th className="px-4 py-3">Confidence</th>
                      <th className="px-4 py-3 rounded-tr-lg">Bounding Box [x1, y1, x2, y2]</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.detections.map((det, idx) => (
                      <tr key={idx} className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)]/50 transition-colors">
                        <td className="px-4 py-3 font-medium">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold text-black ${
                            det.label_name.toLowerCase() === 'person' ? 'bg-[#00BFFF]' : 'bg-[#00FF7F]'
                          }`}>
                            {det.label_name}
                          </span>
                        </td>
                        <td className="px-4 py-3">{(det.score * 100).toFixed(2)}%</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          [{det.bbox.map(v => Math.round(v)).join(', ')}]
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
