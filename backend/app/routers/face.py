"""
face.py — Face Recognition API Router
=======================================
Endpoints for face recognition, registration,
database management, and liveness detection.
"""

import io
import base64
from typing import List, Optional

import cv2
import numpy as np
from fastapi import APIRouter, File, Form, Query, UploadFile
from fastapi.responses import JSONResponse
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from ..models.face_engine import FaceEngine, LivenessDetector
from ..services.face_service import FaceService

router = APIRouter(prefix="/api/face", tags=["face-recognition"])


# --- Pydantic Models ---
class RecognitionResult(BaseModel):
    results: List[dict]
    num_faces_detected: int


class LivenessResult(BaseModel):
    is_live: bool
    blink_count: int
    total_frames: int
    status: str
    message: str


# --- Service instances (initialized in lifespan) ---
_face_service: Optional[FaceService] = None
_liveness_detector: Optional[LivenessDetector] = None


def get_face_service() -> FaceService:
    global _face_service
    if _face_service is None:
        from ..utils.config import KNOWN_FACES_DIR, FACE_DB_PATH, FACE_SIMILARITY_THRESHOLD
        _face_service = FaceService(
            known_faces_dir=str(KNOWN_FACES_DIR),
            db_path=str(FACE_DB_PATH),
            threshold=FACE_SIMILARITY_THRESHOLD,
        )
    return _face_service


def get_liveness_detector() -> LivenessDetector:
    global _liveness_detector
    if _liveness_detector is None:
        _liveness_detector = LivenessDetector()
        _liveness_detector.initialize()
    return _liveness_detector


@router.post("/recognize")
async def recognize_face(
    file: UploadFile = File(..., description="Image containing a face"),
    threshold: float = Query(0.4, ge=0.1, le=0.9, description="Similarity threshold (tau)"),
):
    """
    Recognize a face in the uploaded image.
    
    Compares the detected face against the known faces database
    using cosine similarity of ArcFace embeddings.
    """
    image_bytes = await file.read()
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None:
        return JSONResponse(status_code=400, content={"error": "Invalid image"})

    engine = FaceEngine.get_instance()
    faces = await run_in_threadpool(engine.detect_faces, image)

    if not faces:
        return JSONResponse(
            status_code=200,
            content={
                "results": [],
                "num_faces_detected": 0,
                "message": "No face detected in the image.",
            },
        )

    service = get_face_service()
    results_list = []

    for face in faces:
        name, similarity = service.recognize(
            face["embedding"],
            threshold=threshold,
        )
        
        b64_aligned = None
        if face.get("aligned_face") is not None:
            _, buffer = cv2.imencode('.jpg', face["aligned_face"])
            b64_aligned = base64.b64encode(buffer).decode('utf-8')

        results_list.append({
            "name": name,
            "similarity": round(similarity, 4),
            "is_match": name is not None,
            "bbox": face["bbox"],
            "aligned_face_b64": b64_aligned,
            "message": (
                f"Matched: {name} ({similarity:.4f})" if name 
                else f"Unknown ({similarity:.4f})"
            )
        })

    return {
        "results": results_list,
        "num_faces_detected": len(faces),
        "message": f"Processed {len(faces)} face(s)."
    }


@router.post("/register")
async def register_face(
    file: UploadFile = File(..., description="Photo of the person"),
    name: str = Form(..., description="Name of the person"),
):
    """Register a new face identity or add a photo to an existing identity."""
    image_bytes = await file.read()
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None:
        return JSONResponse(status_code=400, content={"error": "Invalid image"})

    # Verify a face exists in the image
    engine = FaceEngine.get_instance()
    faces = await run_in_threadpool(engine.detect_faces, image)
    if not faces:
        return JSONResponse(
            status_code=400,
            content={"error": "No face detected in the uploaded image."},
        )

    service = get_face_service()
    success = service.register_identity(name, image)

    return {
        "success": success,
        "name": name,
        "faces_detected": len(faces),
        "message": f"Photo registered for '{name}'. Rebuild the database to update embeddings.",
    }


@router.post("/build-db")
async def build_database():
    """
    Rebuild the face embedding database from known_faces/ directory.
    
    Scans all subdirectories, extracts ArcFace embeddings from each photo,
    averages per identity, and saves as pickle file.
    """
    service = get_face_service()
    stats = service.build_database()

    return {
        "success": True,
        "identities_processed": len(stats),
        "details": stats,
        "message": f"Database rebuilt with {len(stats)} identities.",
    }


@router.get("/database")
async def list_database():
    """List all registered identities in the database."""
    service = get_face_service()
    identities = service.get_registered_identities()

    return {
        "identities": identities,
        "total": len(identities),
        "database_loaded": len(service.database) > 0,
    }


@router.post("/liveness-check")
async def check_liveness(
    frames: List[UploadFile] = File(
        ...,
        description="Sequence of video frames for blink detection (min 10 frames)",
    ),
):
    """
    Check liveness by analyzing a sequence of frames for natural blinks.
    
    Anti-spoofing pipeline:
      1. Receive sequence of frames (captured from webcam)
      2. Analyze Eye Aspect Ratio (EAR) across frames
      3. Detect blink patterns
      4. Return liveness verdict
    """
    if len(frames) < 5:
        return JSONResponse(
            status_code=400,
            content={"error": "Need at least 5 frames for liveness check."},
        )

    # Decode all frames
    frame_images = []
    for frame_file in frames:
        img_bytes = await frame_file.read()
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is not None:
            frame_images.append(img)

    if len(frame_images) < 5:
        return JSONResponse(
            status_code=400,
            content={"error": "Could not decode enough valid frames."},
        )

    # Run liveness check
    detector = get_liveness_detector()
    is_live, metadata = await run_in_threadpool(detector.check_liveness, frame_images)

    return {
        "is_live": is_live,
        "blink_count": metadata["blink_count"],
        "total_frames": metadata["total_frames"],
        "status": metadata["status"],
        "message": metadata["message"],
    }
