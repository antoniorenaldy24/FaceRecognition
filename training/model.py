"""
model.py — Faster R-CNN Model Builder
======================================
Implements the Backbone + Head architecture pattern:
  - Backbone: Pre-trained ResNet50-FPN (Feature Extractor)
  - Head: FastRCNNPredictor (Task-Specific Classifier/Regressor)

This explicit separation follows the brain_project.md Rule 3:
  "WAJIB memisahkan secara eksplisit antara logika arsitektur 
   Backbone (Feature Extractor) dan Head (Task Predictor)"
"""

import torch
import torch.nn as nn
from torchvision.models.detection import (
    fasterrcnn_resnet50_fpn_v2,
    FasterRCNN_ResNet50_FPN_V2_Weights,
)
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor


def build_frcnn(
    num_classes: int = 3,
    pretrained: bool = True,
    freeze_backbone: bool = False,
) -> nn.Module:
    """
    Build a Faster R-CNN model with explicit Backbone + Head separation.
    
    Architecture:
    ┌──────────────────────────────────────────────────┐
    │  Faster R-CNN                                     │
    │  ┌────────────────────┐  ┌─────────────────────┐ │
    │  │   BACKBONE          │  │   HEAD               │ │
    │  │   ResNet50-FPN      │  │   FastRCNNPredictor  │ │
    │  │   (Feature Extrac.) │──│   (Box Classifier)   │ │
    │  │   [Pre-trained]     │  │   [num_classes=3]    │ │
    │  └────────────────────┘  └─────────────────────┘ │
    └──────────────────────────────────────────────────┘
    
    Args:
        num_classes: Number of output classes (including background).
                     For this project: 3 (bg + person + bicycle).
        pretrained: Whether to use COCO pre-trained weights for the 
                    backbone and initial head.
        freeze_backbone: If True, freeze all backbone parameters 
                        (Linear Probing strategy). Only the Head 
                        will be trained.
    
    Returns:
        Configured Faster R-CNN model ready for fine-tuning.
    """

    # =========================================
    # Step 1: Load pre-trained Faster R-CNN
    # =========================================
    if pretrained:
        weights = FasterRCNN_ResNet50_FPN_V2_Weights.DEFAULT
        model = fasterrcnn_resnet50_fpn_v2(weights=weights)
        print("[Model] Loaded Faster R-CNN ResNet50-FPN v2 with COCO weights.")
    else:
        model = fasterrcnn_resnet50_fpn_v2(weights=None)
        print("[Model] Loaded Faster R-CNN ResNet50-FPN v2 (random init).")

    # =========================================
    # Step 2: Replace the HEAD (Box Predictor)
    # =========================================
    # The original head predicts 91 COCO classes.
    # We replace it with a new head for our num_classes.
    in_features = model.roi_heads.box_predictor.cls_score.in_features
    model.roi_heads.box_predictor = FastRCNNPredictor(in_features, num_classes)
    print(
        f"[Model] Replaced HEAD: FastRCNNPredictor "
        f"(in_features={in_features}, num_classes={num_classes})"
    )

    # =========================================
    # Step 3: Optionally freeze the BACKBONE
    # =========================================
    if freeze_backbone:
        _freeze_backbone(model)
        print("[Model] BACKBONE frozen (Linear Probing mode).")
    else:
        print("[Model] Full Fine-Tuning mode (all parameters trainable).")

    # Print parameter summary
    _print_param_summary(model)

    return model


def _freeze_backbone(model: nn.Module) -> None:
    """
    Freeze all backbone parameters (requires_grad = False).
    Only the RPN and ROI heads remain trainable.
    
    Transfer Learning Strategy: Linear Probing
    - Suitable when target dataset is small or similar to source.
    """
    for name, param in model.backbone.named_parameters():
        param.requires_grad = False


def _unfreeze_backbone(model: nn.Module) -> None:
    """
    Unfreeze all backbone parameters for full fine-tuning.
    Call this after initial linear probing to allow gradual adaptation.
    """
    for name, param in model.backbone.named_parameters():
        param.requires_grad = True


def _print_param_summary(model: nn.Module) -> None:
    """Print a summary of trainable vs frozen parameters."""
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    frozen_params = total_params - trainable_params

    print(f"\n{'='*50}")
    print(f"  Parameter Summary")
    print(f"{'='*50}")
    print(f"  Total parameters:     {total_params:>12,}")
    print(f"  Trainable parameters: {trainable_params:>12,}")
    print(f"  Frozen parameters:    {frozen_params:>12,}")
    print(f"{'='*50}\n")


def get_model_for_inference(
    checkpoint_path: str,
    num_classes: int = 3,
    device: str = "cpu",
) -> nn.Module:
    """
    Load a trained model for inference.
    
    Args:
        checkpoint_path: Path to the saved .pth checkpoint.
        num_classes: Must match the training configuration.
        device: 'cpu' or 'cuda'.
    
    Returns:
        Model in eval mode, ready for inference.
    """
    model = build_frcnn(num_classes=num_classes, pretrained=False, freeze_backbone=False)
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=True)

    # Handle both full checkpoint dict and raw state_dict
    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        model.load_state_dict(checkpoint["model_state_dict"])
    else:
        model.load_state_dict(checkpoint)

    model.to(device)
    model.eval()
    print(f"[Model] Loaded checkpoint from: {checkpoint_path}")
    return model


# --- Quick test ---
if __name__ == "__main__":
    print("Building Faster R-CNN for Person + Bicycle detection...\n")
    
    # Test Full Fine-Tuning
    model_ft = build_frcnn(num_classes=3, pretrained=True, freeze_backbone=False)
    
    print("\n" + "="*60)
    print("Building with Linear Probing (frozen backbone)...\n")
    
    # Test Linear Probing
    model_lp = build_frcnn(num_classes=3, pretrained=True, freeze_backbone=True)
    
    # Test forward pass
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model_ft.to(device)
    model_ft.eval()
    
    dummy_input = torch.randn(1, 3, 640, 480).to(device)
    with torch.inference_mode():
        output = model_ft([dummy_input[0]])
    
    print(f"Test inference output keys: {output[0].keys()}")
    print(f"Boxes shape: {output[0]['boxes'].shape}")
    print(f"Labels shape: {output[0]['labels'].shape}")
    print(f"Scores shape: {output[0]['scores'].shape}")
