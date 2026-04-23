"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ScannerHUD from "@/components/face/ScannerHUD";
import HoloCard from "@/components/face/HoloCard";
import LivenessIndicator from "@/components/face/LivenessIndicator";
import { Camera, Database, Shield, ScanLine, UserPlus, RefreshCw, Upload, Video } from "lucide-react";

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
  const canvasRef = useRef<HTMLCanvasElement>(null); // For capturing frames
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null); // For drawing bounding boxes
  
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

  // Auto-resize overlay canvas to match video display size
  useEffect(() => {
    const handleResize = () => {
      if (videoRef.current && overlayCanvasRef.current) {
        overlayCanvasRef.current.width = videoRef.current.clientWidth;
        overlayCanvasRef.current.height = videoRef.current.clientHeight;
        drawBoundingBoxes(matchResults); // redraw on resize
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [matchResults]);

  // Fetch DB on mount
  useEffect(() => {
    fetchDatabase();
  }, []);

  const requestCameraPermission = async () => {
    setIsRequestingCamera(true);
    setHudMessage("REQUESTING PERMISSION...");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("navigator.mediaDevices is undefined");
      }
      // Request permission with user interaction
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
        setHudMessage("SECURITY_BLOCK: MUST USE LOCALHOST OR HTTPS FOR WEBCAM");
      } else {
        setHudMessage("CAMERA_ACCESS_DENIED_OR_NOT_FOUND");
        // Also alert user so it's obvious it was clicked
        alert("Gagal mengakses kamera! Pastikan kamera terhubung dan browser Anda memberi izin akses kamera.");
      }
      setSelectedDeviceId("default"); // Fallback
    } finally {
      setIsRequestingCamera(false);
    }
  };

  // Handle stream switching
  useEffect(() => {
    if (videoFile) return; // Ignore if playing local video file
    if (selectedDeviceId) {
      startCamera(selectedDeviceId);
    }
    return () => stopCamera();
  }, [selectedDeviceId, videoFile]);

  // --- Media Helpers ---
  const startCamera = async (deviceId: string) => {
    stopCamera();
    try {
      const constraints: MediaStreamConstraints = {
        video: { width: 1280, height: 720 },
      };
      
      // Use specific deviceId if it's not the generic "default"
      if (deviceId && deviceId !== "default" && deviceId !== "FILE") {
        constraints.video = { ...constraints.video, deviceId: { exact: deviceId } } as MediaTrackConstraints;
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
      console.error("Webcam error:", err);
      setHudStatus("failed");
      setHudMessage("CAMERA_ACCESS_DENIED");
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
    
    // We must use videoWidth/videoHeight (actual resolution), not clientWidth
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

    // Map natural video dimensions to displayed dimensions
    const videoObj = videoRef.current;
    const scaleX = canvas.width / (videoObj.videoWidth || 1280);
    const scaleY = canvas.height / (videoObj.videoHeight || 720);

    results.forEach((res) => {
      const [x1, y1, x2, y2] = res.bbox;
      const w = x2 - x1;
      const h = y2 - y1;

      // Draw bracket corners
      const color = res.is_match ? "#10b981" : "#f43f5e"; // green or red
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;

      const px = x1 * scaleX;
      const py = y1 * scaleY;
      const pw = w * scaleX;
      const ph = h * scaleY;
      const len = 15; // bracket length

      ctx.beginPath();
      // Top left
      ctx.moveTo(px, py + len); ctx.lineTo(px, py); ctx.lineTo(px + len, py);
      // Top right
      ctx.moveTo(px + pw - len, py); ctx.lineTo(px + pw, py); ctx.lineTo(px + pw, py + len);
      // Bottom left
      ctx.moveTo(px, py + ph - len); ctx.lineTo(px, py + ph); ctx.lineTo(px + len, py + ph);
      // Bottom right
      ctx.moveTo(px + pw - len, py + ph); ctx.lineTo(px + pw, py + ph); ctx.lineTo(px + pw, py + ph - len);
      ctx.stroke();

      // Label text
      ctx.font = "12px monospace";
      ctx.fillStyle = color;
      ctx.fillText(`${res.name || "UNKNOWN"} ${(res.similarity * 100).toFixed(0)}%`, px, py - 5);
    });
  };

  // --- Actions ---
  const fetchDatabase = async () => {
    try {
      const res = await fetch("/api/face/database");
      if (!res.ok) throw new Error("Backend offline");
      const data = await res.json();
      setIdentities(data.identities || []);
    } catch (err) {
      console.warn("Database fetch failed. Backend may be offline:", err);
    }
  };

  const rebuildDatabase = async () => {
    setIsProcessingDB(true);
    try {
      await fetch("/api/face/build-db", { method: "POST" });
      fetchDatabase();
    } finally {
      setIsProcessingDB(false);
    }
  };

  const handleGuidedRegister = async () => {
    if (!regName.trim()) return;
    setHudStatus("scanning");
    
    const instructions = [
      "LOOK STRAIGHT", "LOOK STRAIGHT", "LOOK STRAIGHT", "LOOK STRAIGHT",
      "TURN HEAD LEFT 30°", "TURN HEAD LEFT 30°", "TURN HEAD LEFT 30°",
      "TURN HEAD RIGHT 30°", "TURN HEAD RIGHT 30°", "TURN HEAD RIGHT 30°"
    ];

    let successCount = 0;

    for (let i = 0; i < instructions.length; i++) {
      setHudMessage(`GUIDED ENROLLMENT [${i+1}/10]: ${instructions[i]}`);
      await new Promise((r) => setTimeout(r, 1000)); // Wait 1s per pose
      
      try {
        const blob = await captureFrameAsync();
        if (!blob) continue;
        
        const formData = new FormData();
        formData.append("file", blob, `reg_${i}.jpg`);
        formData.append("name", regName.trim());
        
        const res = await fetch("/api/face/register", {
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
      setHudMessage(`SUBJECT REGISTERED: ${successCount} SNAPSHOTS SAVED`);
      setRegName("");
    } else {
      setHudStatus("failed");
      setHudMessage("REGISTRATION FAILED. NO FACES DETECTED.");
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
        setHudMessage("ANALYZING BIO METRICS...");
        const frames: Blob[] = [];
        for (let i = 0; i < 15; i++) {
          const blob = await captureFrameAsync();
          if (blob) frames.push(blob);
          await new Promise(r => setTimeout(r, 200));
        }
        
        const liveData = new FormData();
        frames.forEach((f, i) => liveData.append("frames", f, `frame_${i}.jpg`));
        
        const liveRes = await fetch("/api/face/liveness-check", {
          method: "POST",
          body: liveData,
        });
        const liveDataJson = await liveRes.json();
        setLivenessResult(liveDataJson);
        
        if (!liveRes.ok || !liveDataJson.is_live) {
          setHudStatus("failed");
          setHudMessage("LIVENESS CHECK FAILED: SPOOF DETECTED");
          return; // Stop pipeline
        }
      }
      
      setHudMessage("EXTRACTING ARCFACE EMBEDDINGS...");
      const blob = await captureFrameAsync();
      if (!blob) throw new Error("Capture failed");
      
      const formData = new FormData();
      formData.append("file", blob, "capture.jpg");
      
      const res = await fetch(`/api/face/recognize?threshold=${threshold}`, {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error("API Error");
      
      const results: MatchResult[] = data.results || [];
      setMatchResults(results);
      drawBoundingBoxes(results);

      if (results.length === 0) {
        setHudStatus("failed");
        setHudMessage("NO FACES DETECTED");
      } else {
        const matches = results.filter(r => r.is_match).length;
        setHudStatus(matches > 0 ? "success" : "failed");
        setHudMessage(`MULTIPLE TARGETS: ${matches}/${results.length} IDENTIFIED`);
      }
      
    } catch (err) {
      setHudStatus("failed");
      setHudMessage("SYSTEM ERROR");
    }
  };

  return (
    <div className="min-h-screen bg-[#05060A] text-white p-4 md:p-8 overflow-hidden relative">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[var(--primary-glow)]/20 via-[#05060A] to-[#05060A]" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-[var(--border)] pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight uppercase flex items-center gap-3">
              <Shield className="w-8 h-8 text-[var(--primary-light)]" />
              Bio-Metric <span className="text-[var(--text-muted)] font-light">Terminal</span>
            </h1>
            <p className="text-[var(--primary-light)] font-mono text-sm mt-1 tracking-widest opacity-80">
              SYS.VER // 3.1.0_PRO_MULTI
            </p>
          </div>
          
          <div className="flex gap-2 bg-black/40 p-1.5 rounded-xl border border-[var(--border)] backdrop-blur-md overflow-x-auto max-w-full">
            {[
              { id: "SCAN", icon: ScanLine, label: "Scan" },
              { id: "REGISTER", icon: UserPlus, label: "Register" },
              { id: "DATABASE", icon: Database, label: "Database" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id as AppMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm uppercase transition-all duration-300 whitespace-nowrap ${
                  mode === tab.id 
                    ? "bg-[var(--primary)] text-white shadow-[0_0_15px_var(--primary-glow)]" 
                    : "text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface)]"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </header>

        {/* Source Selector Bar */}
        <div className="mb-6 flex flex-wrap gap-4 items-center p-3 glass-card text-xs font-mono">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Video className="w-4 h-4" /> SOURCE:
          </div>
          <select 
            className="bg-black border border-[var(--border)] rounded px-2 py-1 text-white focus:outline-none focus:border-[var(--primary)]"
            value={videoFile ? "FILE" : selectedDeviceId || "default"}
            onChange={(e) => {
              if (e.target.value !== "FILE") {
                setVideoFile(null);
                setSelectedDeviceId(e.target.value);
              }
            }}
          >
            <option value="default">Default Camera</option>
            {devices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0,5)}`}</option>
            ))}
            <option value="FILE" disabled={!videoFile}>Local Video File...</option>
          </select>

          <label className="flex items-center gap-2 px-3 py-1 bg-[var(--surface)] border border-[var(--border)] rounded hover:bg-[var(--surface-hover)] cursor-pointer transition-colors">
            <Upload className="w-3 h-3" /> UPLOAD MP4
            <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={handleVideoUpload} />
          </label>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left: Camera Viewport */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <ScannerHUD status={hudStatus} message={hudMessage}>
              <video 
                ref={videoRef}
                className="w-full h-full object-cover filter contrast-125 saturate-50"
                playsInline 
                muted
              />
              <canvas 
                ref={overlayCanvasRef} 
                className="absolute top-0 left-0 w-full h-full pointer-events-none" 
              />
              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-40 text-center p-6 backdrop-blur-sm">
                  {hudMessage.includes("SECURITY_BLOCK") ? (
                    <div className="flex flex-col items-center">
                      <span className="animate-pulse font-mono text-[var(--accent-amber)] tracking-widest mb-2 font-bold text-xl">
                        ⚠️ SECURE CONTEXT REQUIRED
                      </span>
                      <p className="text-sm font-mono text-white max-w-md mt-4 bg-black/60 p-4 rounded border border-[var(--accent-rose)] leading-relaxed">
                        Browser blocks webcam on HTTP IP addresses (e.g. 192.168.x.x).<br/><br/>
                        Please access this page via <strong className="text-[var(--accent-green)] text-lg">http://localhost:3000</strong> on your PC.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-6">
                      <div className="w-24 h-24 rounded-full border-2 border-dashed border-[var(--text-muted)] flex items-center justify-center">
                        <Camera className="w-10 h-10 text-[var(--text-muted)]" />
                      </div>
                      <div className="font-mono text-[var(--text-muted)]">SYSTEM STANDBY</div>
                      <button 
                        onClick={requestCameraPermission}
                        disabled={isRequestingCamera}
                        className="relative z-50 pointer-events-auto px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-light)] text-white font-bold rounded-lg tracking-widest font-mono transition-all shadow-[0_0_20px_var(--primary-glow)] disabled:opacity-50"
                      >
                        {isRequestingCamera ? "REQUESTING..." : "INITIALIZE HARDWARE"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </ScannerHUD>
            <canvas ref={canvasRef} className="hidden" />

            <AnimatePresence>
              {useLiveness && (mode === "SCAN") && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <LivenessIndicator 
                    isActive={true}
                    isLive={livenessResult?.is_live ?? null}
                    message={livenessResult?.message || "LIVENESS_MODULE_ACTIVE"}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: Contextual Panel */}
          <div className="lg:col-span-5">
            <AnimatePresence mode="wait">
              
              {/* SCAN MODE */}
              {mode === "SCAN" && (
                <motion.div 
                  key="scan"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="h-full flex flex-col gap-6"
                >
                  <div className="glass-card p-6">
                    <h2 className="font-mono text-[var(--primary-light)] text-sm mb-4 uppercase tracking-widest flex items-center justify-between">
                      <span>// Operation Parameters</span>
                    </h2>
                    
                    {/* Threshold Slider (Cyberpunk Style) */}
                    <div className="mb-6 bg-black/40 p-4 rounded-xl border border-[var(--border)]">
                      <div className="flex justify-between font-mono text-xs mb-2">
                        <span className="text-[var(--text-muted)]">SIMILARITY THRESHOLD</span>
                        <span className="font-bold" style={{ color: threshold > 0.5 ? "var(--accent-green)" : threshold < 0.4 ? "var(--accent-rose)" : "var(--accent-amber)" }}>
                          {(threshold * 100).toFixed(0)}%
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="0.1" max="0.9" step="0.05" 
                        value={threshold} 
                        onChange={(e) => setThreshold(parseFloat(e.target.value))}
                        disabled={hudStatus === "scanning"}
                        className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, 
                            var(--accent-rose) 0%, 
                            var(--accent-rose) 30%, 
                            var(--accent-amber) 40%, 
                            var(--accent-amber) 50%, 
                            var(--accent-green) 60%, 
                            var(--accent-green) 100%)`
                        }}
                      />
                      <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)] mt-1">
                        <span>STRICT</span>
                        <span>BALANCED</span>
                        <span>LOOSE</span>
                      </div>
                    </div>
                    
                    <label className="flex items-center justify-between cursor-pointer p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] hover:border-[var(--primary)]/50 transition-colors">
                      <div>
                        <div className="font-bold text-white mb-1">Require Liveness</div>
                        <div className="text-xs text-[var(--text-muted)]">Analyze blinks to prevent spoofing</div>
                      </div>
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={useLiveness}
                          onChange={(e) => setUseLiveness(e.target.checked)}
                          disabled={hudStatus === "scanning"}
                        />
                        <div className="w-11 h-6 bg-black border border-[var(--border)] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)] peer-checked:border-[var(--primary)]"></div>
                      </div>
                    </label>

                    <button 
                      onClick={handleRecognize}
                      disabled={hudStatus === "scanning" || !isCameraActive}
                      className="w-full mt-6 py-4 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] rounded-xl font-bold uppercase tracking-widest text-white shadow-[0_0_30px_var(--primary-glow)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {hudStatus === "scanning" ? "PROCESSING..." : "INITIATE SCAN"}
                    </button>
                  </div>

                  {/* Multi-Target Result Holograms */}
                  {matchResults.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex-1 overflow-y-auto space-y-4 max-h-[600px] scrollbar-hide"
                    >
                      {matchResults.map((res, idx) => (
                        <motion.div 
                          key={idx}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.1 }}
                        >
                          <HoloCard 
                            name={res.name}
                            similarity={res.similarity}
                            isMatch={res.is_match}
                            message={res.message}
                            alignedFaceB64={res.aligned_face_b64}
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* REGISTER MODE */}
              {mode === "REGISTER" && (
                <motion.div 
                  key="register"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="glass-card p-6"
                >
                  <h2 className="font-mono text-[var(--secondary)] text-sm mb-6 uppercase tracking-widest flex items-center justify-between">
                    <span>// Guided Subject Enrollment</span>
                  </h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-mono text-[var(--text-muted)] mb-2 uppercase">Subject ID</label>
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                        placeholder="e.g. john_doe"
                        disabled={hudStatus === "scanning"}
                        className="w-full bg-black border border-[var(--border)] rounded-xl px-4 py-3 font-mono text-white focus:outline-none focus:border-[var(--secondary)] focus:ring-1 focus:ring-[var(--secondary)] uppercase disabled:opacity-50"
                      />
                    </div>
                    
                    <button 
                      onClick={handleGuidedRegister}
                      disabled={hudStatus === "scanning" || !regName || !isCameraActive}
                      className="w-full py-4 bg-[var(--surface-hover)] border border-[var(--secondary)] rounded-xl font-bold uppercase tracking-widest text-[var(--secondary)] hover:bg-[var(--secondary)] hover:text-black shadow-[0_0_20px_rgba(6,182,212,0.1)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                      START ENROLLMENT (10 POSES)
                    </button>
                    
                    <div className="p-4 bg-[var(--accent-amber)]/10 border border-[var(--accent-amber)]/30 rounded-xl text-xs text-[var(--accent-amber)] font-mono leading-relaxed">
                      <strong className="block mb-1">INSTRUCTIONS:</strong>
                      System will take 10 snapshots automatically over 10 seconds. Follow the on-screen HUD directions to turn your head. Do not move too fast.
                    </div>
                  </div>
                </motion.div>
              )}

              {/* DATABASE MODE */}
              {mode === "DATABASE" && (
                <motion.div 
                  key="database"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="glass-card p-6 h-full flex flex-col max-h-[800px]"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="font-mono text-[var(--primary-light)] text-sm uppercase tracking-widest">
                      // Neural Database
                    </h2>
                    <button 
                      onClick={rebuildDatabase}
                      disabled={isProcessingDB}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--primary)]/50 text-[var(--primary-light)] hover:bg-[var(--primary)]/20 transition-colors font-mono text-xs"
                    >
                      <RefreshCw className={`w-3 h-3 ${isProcessingDB ? "animate-spin" : ""}`} />
                      COMPILE DB
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                    {identities.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-[var(--text-muted)] font-mono text-sm border-2 border-dashed border-[var(--border)] rounded-xl">
                        DATABASE_EMPTY
                      </div>
                    ) : (
                      identities.map((id, idx) => (
                        <div key={idx} className="flex justify-between items-center p-4 bg-black/40 border border-[var(--border)] rounded-xl hover:border-[var(--primary)]/30 transition-colors">
                          <div>
                            <div className="font-mono font-bold text-white uppercase">{id.name}</div>
                            <div className="text-xs text-[var(--text-muted)] font-mono mt-1">SAMPLES: {id.photo_count}/10</div>
                          </div>
                          <div>
                            {id.has_embedding ? (
                              <div className="px-2 py-1 bg-[var(--accent-green)]/10 text-[var(--accent-green)] border border-[var(--accent-green)]/30 rounded text-[10px] font-mono font-bold">
                                ACTIVE
                              </div>
                            ) : (
                              <div className="px-2 py-1 bg-[var(--accent-amber)]/10 text-[var(--accent-amber)] border border-[var(--accent-amber)]/30 rounded text-[10px] font-mono font-bold">
                                UNCOMPILED
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
        </div>
      </div>
    </div>
  );
}
