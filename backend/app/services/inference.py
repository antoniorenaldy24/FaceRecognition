"""
inference.py — Detection Inference Service
============================================
Handles image preprocessing and post-processing for
the object detection pipeline.
"""

from typing import Dict, List

import torch
from PIL import Image

from ..models.detector import DetectionModel
from ..utils.transforms import image_to_tensor, load_image_from_bytes, resize_image


class DetectionService:
    """Service layer for object detection inference."""

    def __init__(self):
        self.detector = DetectionModel.get_instance()

    async def detect_objects(
        self,
        image_bytes: bytes,
        confidence_threshold: float = 0.5,
    ) -> Dict:
        """
        Run object detection on an uploaded image.
        
        Args:
            image_bytes: Raw image file bytes.
            confidence_threshold: Minimum score threshold.
        
        Returns:
            Dict with detections list and image metadata.
        """
        # Load and preprocess
        image = load_image_from_bytes(image_bytes)
        original_width, original_height = image.size

        # Resize if too large (preserve aspect ratio)
        image, scale = resize_image(image, max_size=1024)

        # Convert to tensor
        tensor = image_to_tensor(image)

        # Run inference
        detections = self.detector.predict(
            tensor,
            confidence_threshold=confidence_threshold,
        )

        # Scale bounding boxes back to original size if resized
        if scale < 1.0:
            for det in detections:
                det["bbox"] = [coord / scale for coord in det["bbox"]]

        return {
            "detections": detections,
            "image_width": original_width,
            "image_height": original_height,
            "num_detections": len(detections),
        }
