"""
transforms.py — Image Transform Utilities
==========================================
Shared image transformation functions for inference endpoints.
"""

import io
from typing import Tuple

import numpy as np
import torch
from PIL import Image
import torchvision.transforms.functional as F


def load_image_from_bytes(image_bytes: bytes) -> Image.Image:
    """Load a PIL Image from raw bytes."""
    return Image.open(io.BytesIO(image_bytes)).convert("RGB")


def image_to_tensor(image: Image.Image) -> torch.Tensor:
    """Convert PIL Image to normalized tensor for model input."""
    return F.to_tensor(image)


def tensor_to_numpy(tensor: torch.Tensor) -> np.ndarray:
    """Convert a tensor image (C,H,W) to numpy array (H,W,C) for OpenCV."""
    img = tensor.permute(1, 2, 0).cpu().numpy()
    img = (img * 255).astype(np.uint8)
    return img


def resize_image(
    image: Image.Image,
    max_size: int = 1024,
) -> Tuple[Image.Image, float]:
    """
    Resize image while preserving aspect ratio.
    
    Returns:
        Tuple of (resized_image, scale_factor)
    """
    w, h = image.size
    scale = min(max_size / max(w, h), 1.0)

    if scale < 1.0:
        new_w = int(w * scale)
        new_h = int(h * scale)
        image = image.resize((new_w, new_h), Image.LANCZOS)

    return image, scale
