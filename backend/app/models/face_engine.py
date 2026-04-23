"""
face_engine.py — InsightFace + Liveness Detection Engine
=========================================================
Wraps InsightFace's FaceAnalysis for detection, alignment, and embedding.
Also implements blink-based liveness detection using MediaPipe Face Mesh.

Architecture (Backbone + Head pattern):
  ┌──────────────────────────────────────────────────┐
  │  FaceEngine                                       │
  │  ┌──────────────────┐  ┌───────────────────────┐ │
  │  │  BACKBONE         │  │  HEAD                  │ │
  │  │  SCRFD Detector   │  │  ArcFace Embedder     │ │
  │  │  (Face Detection  │──│  (512-d Embedding     │ │
  │  │   + Landmarks)    │  │   + L2 Normalization) │ │
  │  └──────────────────┘  └───────────────────────┘ │
  │                                                    │
  │  ┌──────────────────────────────────────────────┐ │
  │  │  LivenessDetector (Anti-Spoofing)            │ │
  │  │  MediaPipe Face Mesh → EAR Blink Detection   │ │
  │  └──────────────────────────────────────────────┘ │
  └──────────────────────────────────────────────────┘
"""

from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np


class FaceEngine:
    """
    Face detection and recognition engine using InsightFace.
    
    Uses the 'buffalo_l' model pack which includes:
      - SCRFD: Face Detection
      - 2D106Det: Landmark Detection  
      - ArcFace: Face Recognition (512-d embeddings)
    """

    _instance: Optional["FaceEngine"] = None

    def __init__(self):
        self.app = None
        self.model_name = "buffalo_l"
        self.det_size = (640, 640)

    @classmethod
    def get_instance(cls) -> "FaceEngine":
        """Get or create the singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def initialize(self, ctx_id: int = 0) -> None:
        """
        Initialize InsightFace models.
        
        Args:
            ctx_id: GPU device ID (0 for first GPU, -1 for CPU).
        """
        from insightface.app import FaceAnalysis

        print(f"[FaceEngine] Initializing with model: {self.model_name}")
        self.app = FaceAnalysis(name=self.model_name)
        self.app.prepare(ctx_id=ctx_id, det_size=self.det_size)
        print("[FaceEngine] Ready!")

    def detect_faces(self, image: np.ndarray) -> List[dict]:
        """
        Detect faces in an image and extract embeddings.
        
        Args:
            image: BGR image (OpenCV format).
        
        Returns:
            List of face dicts with keys:
              bbox, score, embedding, landmarks, age, gender
        """
        if self.app is None:
            raise RuntimeError("FaceEngine not initialized! Call initialize() first.")

        from insightface.utils import face_align

        faces = self.app.get(image)
        results = []

        for face in faces:
            # Perform alignment if landmarks are available
            aligned_face = None
            if face.kps is not None:
                try:
                    aligned_face = face_align.norm_crop(image, landmark=face.kps)
                except Exception as e:
                    print(f"[FaceEngine] Alignment error: {e}")

            result = {
                "bbox": face.bbox.tolist(),
                "score": float(face.det_score),
                "embedding": face.normed_embedding,  # 512-d, L2-normalized
                "landmarks": face.kps.tolist() if face.kps is not None else None,
                "aligned_face": aligned_face,
            }

            # Optional attributes
            if hasattr(face, "age"):
                result["age"] = int(face.age)
            if hasattr(face, "gender"):
                result["gender"] = "male" if face.gender == 1 else "female"

            results.append(result)

        return results

    def get_embedding(self, image: np.ndarray) -> Optional[np.ndarray]:
        """
        Get the embedding for the largest face in the image.
        
        Returns:
            512-d normalized embedding vector, or None if no face found.
        """
        faces = self.detect_faces(image)
        if not faces:
            return None

        # Return embedding of the largest face (by bbox area)
        largest = max(
            faces,
            key=lambda f: (f["bbox"][2] - f["bbox"][0]) * (f["bbox"][3] - f["bbox"][1]),
        )
        return largest["embedding"]


class LivenessDetector:
    """
    Blink-based liveness detection using MediaPipe Face Mesh.
    
    Anti-Spoofing Strategy:
      1. Track Eye Aspect Ratio (EAR) across frames
      2. Detect blink pattern (EAR drops below threshold then recovers)
      3. Require at least 1 natural blink to confirm liveness
    
    This defeats presentation attacks using:
      - Printed photos (no blink possible)
      - Screen replays (inconsistent EAR patterns)
    """

    # MediaPipe Face Mesh landmark indices for eyes
    # Left eye
    LEFT_EYE = [33, 160, 158, 133, 153, 144]
    # Right eye
    RIGHT_EYE = [362, 385, 387, 263, 373, 380]

    def __init__(
        self,
        ear_threshold: float = 0.21,
        consec_frames: int = 2,
        required_blinks: int = 1,
    ):
        """
        Args:
            ear_threshold: EAR value below which eyes are considered closed.
            consec_frames: Minimum consecutive frames with low EAR for a blink.
            required_blinks: Number of blinks required to confirm liveness.
        """
        self.ear_threshold = ear_threshold
        self.consec_frames = consec_frames
        self.required_blinks = required_blinks
        self.face_mesh = None

    def initialize(self) -> None:
        """Initialize MediaPipe Face Mesh."""
        import mediapipe as mp

        self.face_mesh = mp.solutions.face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        print("[LivenessDetector] MediaPipe Face Mesh initialized.")

    @staticmethod
    def _compute_ear(landmarks: np.ndarray, eye_indices: List[int]) -> float:
        """
        Compute Eye Aspect Ratio (EAR).
        
        EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
        
        Where p1-p6 are the 6 eye landmarks in order:
          p1: outer corner, p4: inner corner
          p2,p3: upper lid, p5,p6: lower lid
        
        High EAR = eyes open, Low EAR = eyes closed.
        """
        p = landmarks[eye_indices]

        # Vertical distances
        v1 = np.linalg.norm(p[1] - p[5])  # |p2-p6|
        v2 = np.linalg.norm(p[2] - p[4])  # |p3-p5|

        # Horizontal distance
        h = np.linalg.norm(p[0] - p[3])   # |p1-p4|

        if h == 0:
            return 0.0

        ear = (v1 + v2) / (2.0 * h)
        return ear

    def check_liveness(self, frames: List[np.ndarray]) -> Tuple[bool, dict]:
        """
        Check liveness across a sequence of frames.
        
        Args:
            frames: List of BGR images (video frames).
        
        Returns:
            Tuple of (is_live, metadata) where metadata contains:
              blink_count, ear_values, status_message
        """
        if self.face_mesh is None:
            self.initialize()

        blink_count = 0
        consec_below = 0
        ear_values = []

        for frame in frames:
            # Convert BGR to RGB for MediaPipe
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.face_mesh.process(rgb_frame)

            if not results.multi_face_landmarks:
                ear_values.append(None)
                continue

            # Get landmarks as numpy array
            face_landmarks = results.multi_face_landmarks[0]
            h, w = frame.shape[:2]
            landmarks = np.array([
                [lm.x * w, lm.y * h] for lm in face_landmarks.landmark
            ])

            # Compute EAR for both eyes
            left_ear = self._compute_ear(landmarks, self.LEFT_EYE)
            right_ear = self._compute_ear(landmarks, self.RIGHT_EYE)
            avg_ear = (left_ear + right_ear) / 2.0
            ear_values.append(avg_ear)

            # Check for blink
            if avg_ear < self.ear_threshold:
                consec_below += 1
            else:
                if consec_below >= self.consec_frames:
                    blink_count += 1
                consec_below = 0

        is_live = blink_count >= self.required_blinks
        metadata = {
            "blink_count": blink_count,
            "ear_values": ear_values,
            "total_frames": len(frames),
            "status": "LIVE" if is_live else "SPOOF_SUSPECTED",
            "message": (
                f"Liveness confirmed: {blink_count} blink(s) detected."
                if is_live
                else f"Liveness check failed: only {blink_count} blink(s) detected. "
                     f"Need {self.required_blinks}."
            ),
        }

        return is_live, metadata

    def compute_ear_single(self, frame: np.ndarray) -> Optional[float]:
        """
        Compute EAR for a single frame.
        Useful for real-time UI feedback.
        
        Returns:
            Average EAR value or None if no face detected.
        """
        if self.face_mesh is None:
            self.initialize()

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb)

        if not results.multi_face_landmarks:
            return None

        face_landmarks = results.multi_face_landmarks[0]
        h, w = frame.shape[:2]
        landmarks = np.array([
            [lm.x * w, lm.y * h] for lm in face_landmarks.landmark
        ])

        left_ear = self._compute_ear(landmarks, self.LEFT_EYE)
        right_ear = self._compute_ear(landmarks, self.RIGHT_EYE)

        return (left_ear + right_ear) / 2.0
