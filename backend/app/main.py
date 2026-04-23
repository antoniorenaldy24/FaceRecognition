"""
main.py — FastAPI Application Entry Point
===========================================
ML Inference Server for Object Detection & Face Recognition.

Startup sequence:
  1. Load Faster R-CNN model (from checkpoint or COCO pretrained)
  2. Initialize InsightFace engine (buffalo_l model pack)
  3. Start serving HTTP endpoints

Run with: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Add project paths
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from .models.detector import DetectionModel
from .models.face_engine import FaceEngine
from .routers import detection, face
from .utils.config import API_HOST, API_PORT, CORS_ORIGINS, WEIGHTS_DIR


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Loads ML models once at startup, cleans up on shutdown.
    """
    print("\n" + "=" * 60)
    print("  🚀 Starting ML Inference Server...")
    print("=" * 60)

    # ---- STARTUP ----

    # 1. Load Object Detection model
    print("\n[Startup] Loading Faster R-CNN...")
    detector = DetectionModel.get_instance()

    # Check for fine-tuned checkpoint
    best_ckpt = WEIGHTS_DIR / "frcnn_best.pth"
    epoch_ckpts = sorted(WEIGHTS_DIR.glob("frcnn_epoch_*.pth"))
    
    if best_ckpt.exists():
        detector.load_model(str(best_ckpt))
    elif epoch_ckpts:
        detector.load_model(str(epoch_ckpts[-1]))
    else:
        # Use COCO pretrained as fallback
        detector.load_model(None)

    # 2. Initialize Face Recognition engine
    print("\n[Startup] Initializing InsightFace...")
    try:
        face_engine = FaceEngine.get_instance()
        face_engine.initialize(ctx_id=0)  # GPU
    except Exception as e:
        print(f"[Startup] Face engine init failed (non-critical): {e}")
        print("[Startup] Face recognition will be unavailable.")

    print("\n" + "=" * 60)
    print("  ✅ Server ready! All models loaded.")
    print("=" * 60 + "\n")

    yield  # Server is running

    # ---- SHUTDOWN ----
    print("\n[Shutdown] Cleaning up...")


# ============================================
# Create FastAPI App
# ============================================
app = FastAPI(
    title="ML Vision API",
    description=(
        "Computer Vision inference API for:\n"
        "- **Object Detection** (Faster R-CNN: Person & Bicycle)\n"
        "- **Face Recognition** (InsightFace / ArcFace)\n"
        "- **Liveness Detection** (Blink-based Anti-Spoofing)\n\n"
        "Built for Modul 2 Praktikum Machine Learning."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ============================================
# CORS Middleware
# ============================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# Include Routers
# ============================================
app.include_router(detection.router)
app.include_router(face.router)


# ============================================
# Root endpoint
# ============================================
@app.get("/")
async def root():
    """Health check and API info."""
    return {
        "status": "online",
        "name": "ML Vision API",
        "version": "1.0.0",
        "endpoints": {
            "detection": "/api/detect (POST)",
            "face_recognize": "/api/face/recognize (POST)",
            "face_register": "/api/face/register (POST)",
            "face_database": "/api/face/database (GET)",
            "face_build_db": "/api/face/build-db (POST)",
            "face_liveness": "/api/face/liveness-check (POST)",
            "docs": "/docs (GET)",
        },
    }


@app.get("/health")
async def health():
    """Detailed health check."""
    import torch

    detector = DetectionModel.get_instance()
    face_engine = FaceEngine.get_instance()

    return {
        "status": "healthy",
        "cuda_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "detection_model_loaded": detector.model is not None,
        "face_engine_loaded": face_engine.app is not None,
    }


# ============================================
# Run with: python -m app.main
# ============================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=API_HOST,
        port=API_PORT,
        reload=True,
    )
