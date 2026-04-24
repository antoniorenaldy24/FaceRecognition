"use client";

import { useState, useRef } from "react";
import { Loader2, Upload, SlidersHorizontal, AlertTriangle, Cpu } from "lucide-react";
import ImageDropzone from "@/components/ImageDropzone";
import DetectionCanvas from "@/components/DetectionCanvas";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://renaldyant-facerecognition-api.hf.space";

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

  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline();
    
    tl.from(".header-anim", {
      y: -50,
      opacity: 0,
      duration: 0.8,
      stagger: 0.2,
      ease: "back.out(1.5)"
    });

    tl.from(".card-anim", {
      scale: 0.9,
      opacity: 0,
      duration: 0.6,
      stagger: 0.2,
      ease: "back.out(1.2)"
    }, "-=0.4");
  }, { scope: containerRef });

  // Add GSAP pop-in for results
  useGSAP(() => {
    if (results) {
      gsap.from(".result-row", {
        x: -50,
        opacity: 0,
        duration: 0.5,
        stagger: 0.1,
        ease: "back.out(1.2)"
      });
    }
  }, [results]);

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
      setError(err.message || "Gagal memproses gambar");
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
    <div ref={containerRef} className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-10 header-anim">
        <h1 className="text-5xl font-black text-black mb-4 drop-shadow-[2px_2px_0px_white]">
          Deteksi <span className="text-white bg-[var(--secondary)] px-4 py-1 rounded-xl border-4 border-black shadow-[4px_4px_0px_black] rotate-2 inline-block">Objek</span>
        </h1>
        <p className="text-gray-700 text-xl font-bold max-w-3xl mt-6">
          Unggah gambar untuk mendeteksi orang dan sepeda dengan model AI Faster R-CNN kami yang super canggih! 🚴‍♂️
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Upload & Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card-anim neo-card p-6 bg-[var(--primary-light)]">
            <h2 className="text-2xl font-black text-black mb-4">Input Gambar 🖼️</h2>
            <ImageDropzone onImageDrop={handleImageDrop} isLoading={isLoading} />
            
            {error && (
              <div className="mt-4 p-4 rounded-xl bg-white border-4 border-[var(--accent-rose)] font-bold text-[var(--accent-rose)] shadow-[4px_4px_0px_var(--accent-rose)]">
                Oops! {error}
              </div>
            )}
          </div>

          <div className="card-anim neo-card p-6 bg-[var(--accent-pink)]">
            <h2 className="text-2xl font-black text-white mb-4 drop-shadow-[2px_2px_0px_black]">Pengaturan 🎛️</h2>
            
            <div className="mb-4 bg-white p-4 rounded-xl border-4 border-black shadow-[4px_4px_0px_black]">
              <div className="flex justify-between mb-2">
                <label className="text-base font-black text-black">Batas Keyakinan AI</label>
                <span className="text-base text-white bg-black px-3 py-1 rounded-lg font-black">{confidence.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={confidence}
                onChange={handleConfidenceChange}
                disabled={isLoading}
                className="w-full h-4 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--secondary)] border-2 border-black"
              />
              <div className="flex justify-between mt-2 px-1">
                <span className="text-sm font-bold text-gray-500">Lemah (0.1)</span>
                <span className="text-sm font-bold text-gray-500">Kuat (1.0)</span>
              </div>
            </div>
            
            <button 
              className="w-full btn-neo bg-white hover:bg-gray-100 mt-4 disabled:opacity-50 disabled:cursor-not-allowed text-xl py-4"
              onClick={() => file && processImage(file, confidence)}
              disabled={!file || isLoading}
            >
              {isLoading ? (
                <>
                  <div className="spinner-dots">
                    <div></div><div></div><div></div>
                  </div>
                  <span className="ml-2">Memproses...</span>
                </>
              ) : (
                <>🎯 Ulangi Deteksi</>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card-anim neo-card p-6 min-h-[500px] flex flex-col bg-white">
            <h2 className="text-2xl font-black text-black mb-4 flex flex-wrap items-center justify-between gap-4">
              <span>Hasil Deteksi 🔍</span>
              {results && (
                <span className="text-lg font-black px-4 py-2 bg-[var(--accent-green)] text-white rounded-xl border-4 border-black shadow-[4px_4px_0px_black] rotate-1">
                  Ditemukan {results.num_detections} objek! 🎉
                </span>
              )}
            </h2>
            
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 rounded-2xl overflow-hidden border-4 border-black shadow-inner relative">
              {imageUrl ? (
                results ? (
                  <DetectionCanvas imageUrl={imageUrl} detections={results.detections} />
                ) : isLoading ? (
                  <div className="flex flex-col items-center p-8">
                    <div className="text-6xl mb-4 animate-bounce">🤖</div>
                    <p className="text-xl font-black text-gray-600">AI sedang berpikir keras...</p>
                  </div>
                ) : (
                  <img src={imageUrl} alt="Uploaded" className="max-w-full max-h-[70vh] object-contain opacity-50 grayscale blur-sm" />
                )
              ) : (
                <div className="text-gray-400 flex flex-col items-center">
                  <span className="text-6xl mb-4 grayscale">🖼️</span>
                  <p className="font-bold text-xl">Unggah gambar untuk melihat keajaiban!</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Results Details Table */}
          {results && results.num_detections > 0 && (
            <div className="card-anim neo-card p-6 bg-[var(--secondary-light)]">
              <h3 className="text-xl font-black text-black mb-4">Detail Objek 📋</h3>
              <div className="overflow-x-auto rounded-xl border-4 border-black bg-white shadow-[4px_4px_0px_black]">
                <table className="w-full text-left text-base font-bold text-black">
                  <thead className="bg-black text-white">
                    <tr>
                      <th className="px-6 py-4">No</th>
                      <th className="px-6 py-4">Jenis Objek</th>
                      <th className="px-6 py-4">Keyakinan AI</th>
                      <th className="px-6 py-4">Posisi (Kotak)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.detections.map((det, idx) => (
                      <tr key={idx} className="result-row border-t-4 border-black hover:bg-yellow-100 transition-colors">
                        <td className="px-6 py-4">{idx + 1}</td>
                        <td className="px-6 py-4">
                          <span className={`px-4 py-2 rounded-xl border-2 border-black shadow-[2px_2px_0px_black] text-sm uppercase ${
                            det.label_name.toLowerCase() === 'person' ? 'bg-[var(--accent-green)] text-white' : 'bg-[var(--accent-pink)] text-white'
                          }`}>
                            {det.label_name === 'person' ? '👤 Orang' : '🚲 Sepeda'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-4 border-2 border-black rounded-full overflow-hidden bg-gray-200">
                              <div className="h-full bg-[var(--primary)]" style={{ width: `${det.score * 100}%` }}></div>
                            </div>
                            {(det.score * 100).toFixed(1)}%
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm bg-gray-50 border-l-4 border-black">
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
