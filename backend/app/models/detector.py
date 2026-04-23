"""
detector.py — Faster R-CNN Model Wrapper
=========================================
Wraps the Faster R-CNN model for inference in the FastAPI server.
Implements the Backbone + Head pattern.

Architecture:
  ┌─────────────────────────────────────────┐
  │  DetectionModel (Wrapper)                │
  │  ┌─────────────┐  ┌──────────────────┐  │
  │  │  BACKBONE    │  │  HEAD            │  │
  │  │  ResNet50    │──│  FastRCNN        │  │
  │  │  FPN         │  │  Predictor (3cls)│  │
  │  └─────────────┘  └──────────────────┘  │
  └─────────────────────────────────────────┘
"""

import sys
from pathlib import Path
from typing import Dict, List, Optional

import torch
import torch.nn as nn

# Add project root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from training.model import build_frcnn


class DetectionModel:
    """
    Singleton wrapper for the Faster R-CNN detection model.
    Handles model loading, device management, and inference.
    """

    _instance: Optional["DetectionModel"] = None

    def __init__(self):
        self.model: Optional[nn.Module] = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.class_names = {0: "background", 1: "person", 2: "bicycle"}

    @classmethod
    def get_instance(cls) -> "DetectionModel":
        """Get or create the singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load_model(self, checkpoint_path: str = None) -> None:
        """
        Load the Faster R-CNN model.
        
        If no checkpoint_path is provided, loads the COCO-pretrained model
        with a modified head for 3 classes.
        """
        if checkpoint_path and Path(checkpoint_path).exists():
            # Load fine-tuned model
            self.model = build_frcnn(
                num_classes=3, pretrained=False, freeze_backbone=False
            )
            checkpoint = torch.load(
                checkpoint_path,
                map_location=self.device,
                weights_only=True,
            )
            if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
                self.model.load_state_dict(checkpoint["model_state_dict"])
            else:
                self.model.load_state_dict(checkpoint)
            print(f"[Detector] Loaded fine-tuned model from: {checkpoint_path}")
        else:
            # Use pretrained COCO model (91 classes) for initial testing
            from torchvision.models.detection import (
                fasterrcnn_resnet50_fpn_v2,
                FasterRCNN_ResNet50_FPN_V2_Weights,
            )
            self.model = fasterrcnn_resnet50_fpn_v2(
                weights=FasterRCNN_ResNet50_FPN_V2_Weights.DEFAULT
            )
            # Map COCO class names for person and bicycle
            self.class_names = {
                0: "background",
                1: "person",
                2: "bicycle",
            }
            # Full COCO labels for pretrained model
            self._coco_labels = FasterRCNN_ResNet50_FPN_V2_Weights.DEFAULT.meta["categories"]
            print("[Detector] Loaded COCO-pretrained Faster R-CNN (full 91 classes).")

        self.model.to(self.device)
        self.model.eval()
        print(f"[Detector] Model ready on device: {self.device}")

    @torch.inference_mode()
    def predict(
        self,
        image_tensor: torch.Tensor,
        confidence_threshold: float = 0.5,
        nms_threshold: float = 0.3,
    ) -> List[Dict]:
        """
        Run detection inference on a single image tensor.
        
        Args:
            image_tensor: (3, H, W) float tensor, normalized to [0, 1].
            confidence_threshold: Minimum confidence to keep.
            nms_threshold: NMS IoU threshold (unused here, model handles it).
        
        Returns:
            List of detection dicts with keys:
              bbox, label, label_name, score
        """
        if self.model is None:
            raise RuntimeError("Model not loaded! Call load_model() first.")

        # Move to device and add batch dimension
        img = image_tensor.to(self.device)
        outputs = self.model([img])
        output = outputs[0]

        # Filter by confidence
        mask = output["scores"] >= confidence_threshold
        boxes = output["boxes"][mask].cpu()
        labels = output["labels"][mask].cpu()
        scores = output["scores"][mask].cpu()

        detections = []
        for i in range(len(boxes)):
            label_id = labels[i].item()

            # Resolve label name
            if hasattr(self, "_coco_labels") and self._coco_labels:
                label_name = (
                    self._coco_labels[label_id]
                    if label_id < len(self._coco_labels)
                    else f"class_{label_id}"
                )
            else:
                label_name = self.class_names.get(label_id, f"class_{label_id}")

            detections.append({
                "bbox": boxes[i].tolist(),
                "label": label_id,
                "label_name": label_name,
                "score": round(scores[i].item(), 4),
            })

        return detections
