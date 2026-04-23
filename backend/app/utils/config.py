"""
config.py — Global Configuration & Settings
=============================================
Centralized configuration for the entire ML project.
"""

import os
from pathlib import Path

# ============================================
# Path Configuration
# ============================================
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent  # Modul2/
BACKEND_DIR = PROJECT_ROOT / "backend"
TRAINING_DIR = PROJECT_ROOT / "training"
DATA_DIR = PROJECT_ROOT / "data"
NOTEBOOKS_DIR = PROJECT_ROOT / "notebooks"
WEIGHTS_DIR = BACKEND_DIR / "weights"
KNOWN_FACES_DIR = BACKEND_DIR / "known_faces"
FACE_DB_PATH = BACKEND_DIR / "face_db.pkl"

# ============================================
# Model Configuration
# ============================================
# Faster R-CNN (Phase 1)
FRCNN_NUM_CLASSES = 3  # background + person + bicycle
FRCNN_BACKBONE = "resnet50"
FRCNN_CONFIDENCE_THRESHOLD = 0.5
FRCNN_NMS_THRESHOLD = 0.3

# Class mapping for Pascal VOC subset
VOC_CLASS_MAP = {
    "person": 1,
    "bicycle": 2,
}
VOC_CLASS_NAMES = {v: k for k, v in VOC_CLASS_MAP.items()}
VOC_CLASS_NAMES[0] = "background"

# ============================================
# Training Configuration
# ============================================
TRAIN_BATCH_SIZE = 4
TRAIN_NUM_WORKERS = 2
TRAIN_EPOCHS = 10
TRAIN_LR = 0.005
TRAIN_MOMENTUM = 0.9
TRAIN_WEIGHT_DECAY = 0.0005
TRAIN_LR_STEP_SIZE = 3
TRAIN_LR_GAMMA = 0.1

# ============================================
# Face Recognition Configuration (Phase 3)
# ============================================
FACE_MODEL_NAME = "buffalo_l"
FACE_DET_SIZE = (640, 640)
FACE_SIMILARITY_THRESHOLD = 0.4  # tau
FACE_EMBEDDING_DIM = 512

# ============================================
# Liveness Detection Configuration (Phase 4)
# ============================================
EAR_THRESHOLD = 0.21  # Eye Aspect Ratio threshold for blink
EAR_CONSEC_FRAMES = 2  # Min consecutive frames below EAR threshold
BLINK_REQUIRED = 1  # Number of blinks required for liveness

# ============================================
# API Configuration
# ============================================
API_HOST = "0.0.0.0"
API_PORT = 8000
CORS_ORIGINS = [
    "*",  # Allow Vercel and local network
]
