"use client";

import { useState, useRef, useEffect } from "react";
import ScannerHUD from "@/components/face/ScannerHUD";
import HoloCard from "@/components/face/HoloCard";
import LivenessIndicator from "@/components/face/LivenessIndicator";
import { Camera, Database, ScanFace, UserPlus, RefreshCw, Upload, Video } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://renaldyant-facerecognition-api.hf.space";

// Types
interface Identity {
  name: string;
  photo_count: number;
  has_embedding: boolean;
}

interface MatchResult {
  name: string | null;
  similarity: number;
  is_match: boolean;
  message: string;
  bbox: number[];
  aligned_face_b64?: string;
}

interface LivenessResult {
  is_live: boolean;
  blink_count: number;
  message: string;
}

type AppMode = "SCAN" | "REGISTER" | "DATABASE";
type HudStatus = "idle" | "scanning" | "success" | "failed";

export default function FaceDashboard() {
  const [mode, setMode] = useState<AppMode>("SCAN");
  
  // Media refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); 
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null); 
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [hudStatus, setHudStatus] = useState<HudStatus>("idle");
  const [hudMessage, setHudMessage] = useState<string>("");
  
  const [useLiveness, setUseLiveness] = useState(true);
  const [threshold, setThreshold] = useState<number>(0.4);

  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [livenessResult, setLivenessResult] = useState<LivenessResult | null>(null);
  
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [regName, setRegName] = useState("");
  const [isProcessingDB, setIsProcessingDB] = useState(false);

  // Entrance animations
  useGSAP(() => {
    gsap.to(".neo-header", { y: 0, opacity: 1, duration: 0.8, ease: "back.out(1.5)" });
    gsap.to(".neo-panel", { x: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: "power2.out" });
    gsap.to(".neo-camera", { scale: 1, opacity: 1, duration: 0.8, ease: "elastic.out(1, 0.5)" });
  }, { scope: containerRef });

  useEffect(() => {
    const handleResize = () => {
      if (videoRef.current && overlayCanvasRef.current) {
        overlayCanvasRef.current.width = videoRef.current.clientWidth;
        overlayCanvasRef.current.height = videoRef.current.clientHeight;
        drawBoundingBoxes(matchResults); 
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [matchResults]);

  useEffect(() => {
    fetchDatabase();
  }, []);

  const requestCameraPermission = async () => {
    setIsRequestingCamera(true);
    setHudMessage("Meminta izin kamera...");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("navigator.mediaDevices is undefined");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      
      const devs = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devs.filter((d) => d.kind === "videoinput");
      setDevices(videoInputs);
      
      if (videoInputs.length > 0) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      } else {
        setSelectedDeviceId("default");
      }
    } catch (err) {
      console.error("Permission denied or no devices:", err);
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setHudMessage("KEAMANAN BROWSER: HARUS PAKAI HTTPS/LOCALHOST");
      } else {
        setHudMessage("Kamera tidak ditemukan atau ditolak.");
        alert("Gagal mengakses kamera! Pastikan kamera terhubung dan browser Anda memberi izin.");
      }
      setSelectedDeviceId("default"); 
    } finally {
      setIsRequestingCamera(false);
    }
  };

  useEffect(() => {
    if (videoFile) return; 
    if (selectedDeviceId) {
      startCamera(selectedDeviceId);
    }
    return () => stopCamera();
  }, [selectedDeviceId, videoFile]);

  const startCamera = async (deviceId: string) => {
    stopCamera();
    try {
      const constraints: MediaStreamConstraints = { video: { width: 1280, height: 720 } };
      if (deviceId && deviceId !== "default" && deviceId !== "FILE") {
        constraints.video = { width: 1280, height: 720, deviceId: { exact: deviceId } };
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraActive(true);
        videoRef.current.onloadedmetadata = () => {
          if (overlayCanvasRef.current && videoRef.current) {
            overlayCanvasRef.current.width = videoRef.current.clientWidth;
            overlayCanvasRef.current.height = videoRef.current.clientHeight;
          }
        };
      }
    } catch (err) {
      setHudStatus("failed");
      setHudMessage("AKSES KAMERA DITOLAK");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVideoFile(file);
      stopCamera();
      if (videoRef.current) {
        videoRef.current.src = URL.createObjectURL(file);
        videoRef.current.play();
        videoRef.current.loop = true;
        setIsCameraActive(true);
      }
    }
  };

  const captureFrameAsync = async (): Promise<Blob | null> => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
    });
  };

  const drawBoundingBoxes = (results: MatchResult[]) => {
    if (!videoRef.current || !overlayCanvasRef.current) return;
    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const videoObj = videoRef.current;
    const scaleX = canvas.width / (videoObj.videoWidth || 1280);
    const scaleY = canvas.height / (videoObj.videoHeight || 720);

    results.forEach((res) => {
      const [x1, y1, x2, y2] = res.bbox;
      const w = x2 - x1;
      const h = y2 - y1;

      const color = res.is_match ? "#48BB78" : "#F56565"; 
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;

      const px = x1 * scaleX;
      const py = y1 * scaleY;
      const pw = w * scaleX;
      const ph = h * scaleY;

      // Playful thick boxes
      ctx.strokeRect(px, py, pw, ph);
      
      // Label
      const text = `${res.name || "TIDAK DIKENAL"} ${(res.similarity * 100).toFixed(0)}%`;
      ctx.font = "900 16px Nunito";
      const tWidth = ctx.measureText(text).width;
      
      ctx.fillStyle = color;
      ctx.fillRect(px - 2, py - 24, tWidth + 16, 24);
      
      ctx.fillStyle = "white";
      ctx.fillText(text, px + 6, py - 6);
    });
  };

  const fetchDatabase = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/face/database`);
      if (!res.ok) throw new Error("API Error");
      const data = await res.json();
      setIdentities(data.identities || []);
    } catch (err) {
      console.warn("Database fetch failed.");
    }
  };

  const rebuildDatabase = async () => {
    setIsProcessingDB(true);
    try {
      const res = await fetch(`${API_BASE}/api/face/build-db`, { method: "POST" });
      if (!res.ok) throw new Error("API Error");
      fetchDatabase();
    } catch (err: any) {
      alert(`Gagal kompilasi: ${err.message}`);
    } finally {
      setIsProcessingDB(false);
    }
  };

  const handleGuidedRegister = async () => {
    if (!regName.trim()) return;
    setHudStatus("scanning");
    
    const instructions = [
      "LIHAT LURUS", "LIHAT LURUS", "LIHAT LURUS", "LIHAT LURUS",
      "TENGOK KIRI 30°", "TENGOK KIRI 30°", "TENGOK KIRI 30°",
      "TENGOK KANAN 30°", "TENGOK KANAN 30°", "TENGOK KANAN 30°"
    ];

    let successCount = 0;

    for (let i = 0; i < instructions.length; i++) {
      setHudMessage(`PENDAFTARAN [${i+1}/10]: ${instructions[i]}`);
      await new Promise((r) => setTimeout(r, 1000)); 
      
      try {
        const blob = await captureFrameAsync();
        if (!blob) continue;
        
        const formData = new FormData();
        formData.append("file", blob, `reg_${i}.jpg`);
        formData.append("name", regName.trim());
        
        const res = await fetch(`${API_BASE}/api/face/register`, {
          method: "POST",
          body: formData,
        });
        
        if (res.ok) successCount++;
      } catch (err) {
        console.error("Frame register failed", err);
      }
    }

    if (successCount > 0) {
      setHudStatus("success");
      setHudMessage(`BERHASIL: ${successCount} FOTO DISIMPAN`);
      setRegName("");
    } else {
      setHudStatus("failed");
      setHudMessage("GAGAL. TIDAK ADA WAJAH.");
    }
    
    setTimeout(() => {
      if (hudStatus !== "scanning") setHudStatus("idle");
    }, 4000);
  };

  const handleRecognize = async () => {
    setMatchResults([]);
    if (overlayCanvasRef.current) {
        const ctx = overlayCanvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
    setLivenessResult(null);
    setHudStatus("scanning");
    
    try {
      if (useLiveness) {
        setHudMessage("MENGECEK KEDIPAN MATA...");
        const frames: Blob[] = [];
        for (let i = 0; i < 15; i++) {
          const blob = await captureFrameAsync();
          if (blob) frames.push(blob);
          await new Promise(r => setTimeout(r, 200));
        }
        
        const liveData = new FormData();
        frames.forEach((f, i) => liveData.append("frames", f, `frame_${i}.jpg`));
        
        const liveRes = await fetch(`${API_BASE}/api/face/liveness-check`, {
          method: "POST",
          body: liveData,
        });
        
        if (!liveRes.ok) throw new Error("Liveness Error");
        const liveDataJson = await liveRes.json();
        setLivenessResult(liveDataJson);
        
        if (!liveDataJson.is_live) {
          setHudStatus("failed");
          setHudMessage("AWAS! TERDETEKSI WAJAH PALSU!");
          return; 
        }
      }
      
      setHudMessage("MENGENALI WAJAH...");
      const blob = await captureFrameAsync();
      if (!blob) throw new Error("Capture failed");
      
      const formData = new FormData();
      formData.append("file", blob, "capture.jpg");
      
      const res = await fetch(`${API_BASE}/api/face/recognize?threshold=${threshold}`, {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) throw new Error("API Error");
      
      const data = await res.json();
      const results: MatchResult[] = data.results || [];
      setMatchResults(results);
      drawBoundingBoxes(results);

      if (results.length === 0) {
        setHudStatus("failed");
        setHudMessage("TIDAK ADA WAJAH DETEKSI");
      } else {
        const matches = results.filter(r => r.is_match).length;
        setHudStatus(matches > 0 ? "success" : "failed");
        setHudMessage(`SELESAI: ${matches}/${results.length} DIKENALI`);
      }
      
    } catch (err) {
      setHudStatus("failed");
      setHudMessage("TERJADI KESALAHAN SISTEM");
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header */}
        <header className="neo-header opacity-0 translate-y-[-50px] flex flex-col md:flex-row justify-between items-center mb-8 pb-6 gap-4 border-b-4 border-black border-dashed">
          <div>
            <h1 className="text-4xl font-black text-black flex items-center gap-3 drop-shadow-[2px_2px_0px_white]">
              <ScanFace className="w-10 h-10 text-[var(--primary)] fill-[var(--primary)] border-2 border-black rounded-full" />
              Pengenalan Wajah ✨
            </h1>
            <p className="text-gray-700 font-bold text-lg mt-2">
              Verifikasi canggih dengan AI agar lebih aman! 🔒
            </p>
          </div>
          
          <div className="flex gap-2 neo-card p-2">
            {[
              { id: "SCAN", icon: ScanFace, label: "Scan" },
              { id: "REGISTER", icon: UserPlus, label: "Daftar" },
              { id: "DATABASE", icon: Database, label: "Data" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id as AppMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold uppercase transition-all duration-300 ${
                  mode === tab.id 
                    ? "bg-[var(--secondary)] text-white border-2 border-black shadow-[4px_4px_0px_black] scale-105" 
                    : "text-black hover:bg-[var(--primary-light)] border-2 border-transparent hover:border-black"
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </header>

        {/* Source Selector Bar */}
        <div className="neo-header opacity-0 translate-y-[-50px] mb-8 flex flex-wrap gap-4 items-center p-4 neo-card bg-white">
          <div className="flex items-center gap-2 text-black font-black">
            <Video className="w-5 h-5" /> SUMBER KAMERA:
          </div>
          <select 
            className="bg-gray-100 border-4 border-black rounded-xl px-4 py-2 text-black font-bold focus:outline-none focus:ring-4 focus:ring-[var(--primary)] cursor-pointer"
            value={videoFile ? "FILE" : selectedDeviceId || "default"}
            onChange={(e) => {
              if (e.target.value !== "FILE") {
                setVideoFile(null);
                setSelectedDeviceId(e.target.value);
              }
            }}
          >
            <option value="default">Kamera Utama</option>
            {devices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Kamera ${d.deviceId.slice(0,5)}`}</option>
            ))}
            <option value="FILE" disabled={!videoFile}>Video Lokal (MP4)...</option>
          </select>

          <label className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] border-4 border-black rounded-xl font-bold hover:-translate-y-1 hover:shadow-[4px_4px_0px_black] cursor-pointer transition-all">
            <Upload className="w-4 h-4" /> UNGGAH MP4
            <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={handleVideoUpload} />
          </label>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left: Camera Viewport */}
          <div className="neo-camera opacity-0 scale-90 lg:col-span-7 flex flex-col gap-6">
            <ScannerHUD status={hudStatus} message={hudMessage}>
              <video 
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline 
                muted
              />
              <canvas 
                ref={overlayCanvasRef} 
                className="absolute top-0 left-0 w-full h-full pointer-events-none" 
              />
              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--primary-light)] z-40 text-center p-6 border-4 border-black">
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-24 h-24 rounded-full border-4 border-black bg-white flex items-center justify-center shadow-[4px_4px_0px_black] animate-bounce">
                      <Camera className="w-12 h-12 text-black" />
                    </div>
                    <div className="font-black text-2xl text-black">KAMERA MATI</div>
                    <button 
                      onClick={requestCameraPermission}
                      disabled={isRequestingCamera}
                      className="btn-neo text-lg py-4 px-8"
                    >
                      {isRequestingCamera ? "MEMINTA IZIN..." : "NYALAKAN KAMERA 📸"}
                    </button>
                  </div>
                </div>
              )}
            </ScannerHUD>
            <canvas ref={canvasRef} className="hidden" />

            {useLiveness && (mode === "SCAN") && (
              <LivenessIndicator 
                isActive={true}
                isLive={livenessResult?.is_live ?? null}
                message={livenessResult?.message || "Deteksi Kedipan Aktif 👀"}
              />
            )}
          </div>

          {/* Right: Contextual Panel */}
          <div className="lg:col-span-5">
              {/* SCAN MODE */}
              {mode === "SCAN" && (
                <div className="neo-panel opacity-0 translate-x-[50px] h-full flex flex-col gap-6">
                  <div className="neo-card p-6 bg-[var(--secondary-light)]">
                    <h2 className="font-black text-xl mb-4 flex items-center justify-between text-black">
                      <span>Pengaturan AI ⚙️</span>
                    </h2>
                    
                    <div className="mb-6 bg-white p-4 rounded-xl border-4 border-black shadow-[4px_4px_0px_black]">
                      <div className="flex justify-between font-black mb-2 text-black">
                        <span>Batas Kemiripan</span>
                        <span className="bg-black text-white px-2 py-1 rounded-lg">
                          {(threshold * 100).toFixed(0)}%
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="0.1" max="0.9" step="0.05" 
                        value={threshold} 
                        onChange={(e) => setThreshold(parseFloat(e.target.value))}
                        disabled={hudStatus === "scanning"}
                        className="w-full h-4 bg-gray-200 rounded-lg appearance-none cursor-pointer border-2 border-black accent-[var(--secondary)]"
                      />
                      <div className="flex justify-between text-xs font-bold text-gray-500 mt-2">
                        <span>Sangat Ketat</span>
                        <span>Normal</span>
                        <span>Mudah</span>
                      </div>
                    </div>
                    
                    <label className="flex items-center justify-between cursor-pointer p-4 rounded-xl border-4 border-black bg-white hover:-translate-y-1 hover:shadow-[4px_4px_0px_black] transition-all mb-6">
                      <div>
                        <div className="font-black text-black text-lg mb-1">Cek Anti-Palsu</div>
                        <div className="text-sm font-bold text-gray-500">Wajibkan berkedip ke kamera</div>
                      </div>
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={useLiveness}
                          onChange={(e) => setUseLiveness(e.target.checked)}
                          disabled={hudStatus === "scanning"}
                        />
                        <div className="w-14 h-8 bg-gray-300 border-4 border-black rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-2 after:border-black after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-green)]"></div>
                      </div>
                    </label>

                    <button 
                      onClick={handleRecognize}
                      disabled={hudStatus === "scanning" || !isCameraActive}
                      className="w-full btn-neo bg-[var(--accent-pink)] text-white text-xl py-5 hover:bg-[#F687B3]"
                    >
                      {hudStatus === "scanning" ? "MEMPROSES..." : "MULAI SCAN 🔍"}
                    </button>
                  </div>

                  {/* Multi-Target Result Holograms */}
                  {matchResults.length > 0 && (
                    <div className="flex-1 overflow-y-auto space-y-4 max-h-[600px] p-2">
                      {matchResults.map((res, idx) => (
                        <div key={idx} className="neo-panel">
                          <HoloCard 
                            name={res.name}
                            similarity={res.similarity}
                            isMatch={res.is_match}
                            message={res.message}
                            alignedFaceB64={res.aligned_face_b64}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* REGISTER MODE */}
              {mode === "REGISTER" && (
                <div className="neo-panel opacity-0 translate-x-[50px] neo-card p-6 bg-[var(--accent-purple)] text-white">
                  <h2 className="font-black text-2xl mb-6 text-white drop-shadow-[2px_2px_0px_black]">
                    Pendaftaran Wajah Baru 📝
                  </h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-lg font-black mb-2 text-white drop-shadow-[1px_1px_0px_black]">NAMA (ID):</label>
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                        placeholder="contoh: joko_123"
                        disabled={hudStatus === "scanning"}
                        className="w-full bg-white border-4 border-black rounded-xl px-4 py-4 font-bold text-black focus:outline-none focus:ring-4 focus:ring-[var(--primary)] uppercase"
                      />
                    </div>
                    
                    <button 
                      onClick={handleGuidedRegister}
                      disabled={hudStatus === "scanning" || !regName || !isCameraActive}
                      className="w-full py-4 btn-neo bg-[var(--primary)] text-black border-4 border-black hover:bg-[var(--primary-light)]"
                    >
                      MULAI REKAM (10 GAYA) 🎬
                    </button>
                    
                    <div className="p-4 bg-white border-4 border-black rounded-xl text-black font-bold">
                      <strong className="block mb-2 text-xl underline">PETUNJUK:</strong>
                      Kamera akan mengambil 10 foto secara otomatis dalam 10 detik. Ikuti teks di layar untuk menoleh perlahan ke kiri dan ke kanan. Jangan bergerak terlalu cepat!
                    </div>
                  </div>
                </div>
              )}

              {/* DATABASE MODE */}
              {mode === "DATABASE" && (
                <div className="neo-panel opacity-0 translate-x-[50px] neo-card p-6 h-full flex flex-col max-h-[800px] bg-white">
                  <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                    <h2 className="font-black text-2xl text-black">
                      Data Wajah 🗃️
                    </h2>
                    <button 
                      onClick={rebuildDatabase}
                      disabled={isProcessingDB}
                      className="btn-neo py-2 px-4 bg-[var(--accent-green)] text-white text-sm"
                    >
                      <RefreshCw className={`w-4 h-4 ${isProcessingDB ? "animate-spin" : ""}`} />
                      SINKRONISASI AI
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {identities.length === 0 ? (
                      <div className="h-40 flex items-center justify-center text-gray-500 font-bold border-4 border-dashed border-gray-300 rounded-2xl text-xl">
                        KOSONG MELOMPONG 🏜️
                      </div>
                    ) : (
                      identities.map((id, idx) => (
                        <div key={idx} className="flex justify-between items-center p-4 bg-[var(--primary-light)] border-4 border-black rounded-2xl shadow-[4px_4px_0px_black]">
                          <div>
                            <div className="font-black text-xl text-black uppercase">{id.name}</div>
                            <div className="font-bold text-gray-700 mt-1 bg-white px-2 py-1 rounded border-2 border-black inline-block text-xs">FOTO: {id.photo_count}/10</div>
                          </div>
                          <div>
                            {id.has_embedding ? (
                              <div className="px-3 py-2 bg-[var(--accent-green)] text-white border-2 border-black rounded-xl font-black text-sm rotate-2 shadow-[2px_2px_0px_black]">
                                SIAP DIPAKAI!
                              </div>
                            ) : (
                              <div className="px-3 py-2 bg-[var(--accent-rose)] text-white border-2 border-black rounded-xl font-black text-sm -rotate-2 shadow-[2px_2px_0px_black]">
                                BELUM DISINKRON
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
