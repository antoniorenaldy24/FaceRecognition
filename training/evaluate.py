"""
evaluate.py — mAP Evaluation for Faster R-CNN
===============================================
Computes Mean Average Precision (mAP) using IoU-based matching.
Visualizes detection results on sample images.
"""

import sys
from pathlib import Path
from typing import Dict, List

import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import torch
from torch.utils.data import DataLoader

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from training.dataset import VOCDetectionDataset, get_transforms, collate_fn
from training.model import get_model_for_inference


# Class labels
CLASS_NAMES = {0: "background", 1: "person", 2: "bicycle"}
CLASS_COLORS = {1: "#00BFFF", 2: "#00FF7F"}  # person=cyan, bicycle=green


def compute_iou(box1: torch.Tensor, box2: torch.Tensor) -> torch.Tensor:
    """
    Compute IoU (Intersection over Union) between two sets of boxes.
    
    Args:
        box1: (N, 4) tensor of boxes [x1, y1, x2, y2]
        box2: (M, 4) tensor of boxes [x1, y1, x2, y2]
    
    Returns:
        (N, M) tensor of pairwise IoU values.
    """
    x1 = torch.max(box1[:, 0].unsqueeze(1), box2[:, 0].unsqueeze(0))
    y1 = torch.max(box1[:, 1].unsqueeze(1), box2[:, 1].unsqueeze(0))
    x2 = torch.min(box1[:, 2].unsqueeze(1), box2[:, 2].unsqueeze(0))
    y2 = torch.min(box1[:, 3].unsqueeze(1), box2[:, 3].unsqueeze(0))

    intersection = torch.clamp(x2 - x1, min=0) * torch.clamp(y2 - y1, min=0)

    area1 = (box1[:, 2] - box1[:, 0]) * (box1[:, 3] - box1[:, 1])
    area2 = (box2[:, 2] - box2[:, 0]) * (box2[:, 3] - box2[:, 1])

    union = area1.unsqueeze(1) + area2.unsqueeze(0) - intersection

    return intersection / (union + 1e-6)


def compute_ap(recalls: np.ndarray, precisions: np.ndarray) -> float:
    """
    Compute Average Precision using the 11-point interpolation method.
    
    This is the standard PASCAL VOC AP computation:
    AP = (1/11) * sum(max_precision at recall >= r) for r in [0, 0.1, ..., 1.0]
    """
    ap = 0.0
    for t in np.arange(0.0, 1.1, 0.1):
        mask = recalls >= t
        if mask.any():
            ap += precisions[mask].max()
    return ap / 11.0


def compute_map(
    predictions: List[dict],
    targets: List[dict],
    iou_threshold: float = 0.5,
    score_threshold: float = 0.05,
) -> Dict[str, float]:
    """
    Compute mAP (Mean Average Precision) across all classes.
    
    Args:
        predictions: List of prediction dicts from model output.
        targets: List of ground truth target dicts.
        iou_threshold: IoU threshold for matching (default: 0.5 for VOC).
        score_threshold: Minimum confidence to consider a detection.
    
    Returns:
        Dict with per-class AP and overall mAP.
    """
    results = {}

    for class_id in [1, 2]:  # person, bicycle
        class_name = CLASS_NAMES[class_id]
        all_scores = []
        all_matches = []  # True Positive or False Positive
        total_gt = 0

        for pred, gt in zip(predictions, targets):
            # Filter predictions for this class
            pred_mask = (pred["labels"] == class_id) & (pred["scores"] >= score_threshold)
            pred_boxes = pred["boxes"][pred_mask]
            pred_scores = pred["scores"][pred_mask]

            # Ground truth for this class
            gt_mask = gt["labels"] == class_id
            gt_boxes = gt["boxes"][gt_mask]
            total_gt += len(gt_boxes)

            if len(pred_boxes) == 0:
                continue

            if len(gt_boxes) == 0:
                # All predictions are false positives
                all_scores.extend(pred_scores.tolist())
                all_matches.extend([False] * len(pred_scores))
                continue

            # Compute IoU matrix
            ious = compute_iou(pred_boxes, gt_boxes)
            
            # Sort by score (descending)
            sorted_idx = torch.argsort(pred_scores, descending=True)
            matched_gt = set()

            for idx in sorted_idx:
                score = pred_scores[idx].item()
                best_iou, best_gt = ious[idx].max(0)

                all_scores.append(score)

                if best_iou.item() >= iou_threshold and best_gt.item() not in matched_gt:
                    all_matches.append(True)  # True Positive
                    matched_gt.add(best_gt.item())
                else:
                    all_matches.append(False)  # False Positive

        # Compute precision-recall curve
        if total_gt == 0:
            results[class_name] = 0.0
            continue

        # Sort by score
        sorted_indices = np.argsort(-np.array(all_scores))
        matches = np.array(all_matches)[sorted_indices]

        tp_cumsum = np.cumsum(matches)
        fp_cumsum = np.cumsum(~matches)

        precisions = tp_cumsum / (tp_cumsum + fp_cumsum + 1e-6)
        recalls = tp_cumsum / total_gt

        ap = compute_ap(recalls, precisions)
        results[class_name] = ap

    # Compute mAP
    results["mAP"] = np.mean(list(results.values()))

    return results


def visualize_detections(
    images: List[torch.Tensor],
    predictions: List[dict],
    targets: List[dict] = None,
    score_threshold: float = 0.5,
    max_images: int = 6,
    save_path: str = None,
):
    """
    Visualize detection results on images.
    
    Args:
        images: List of image tensors (C, H, W).
        predictions: Model predictions.
        targets: Optional ground truth for comparison.
        score_threshold: Minimum score to display.
        max_images: Maximum number of images to show.
        save_path: Optional path to save the figure.
    """
    n = min(len(images), max_images)
    cols = min(n, 3)
    rows = (n + cols - 1) // cols

    fig, axes = plt.subplots(rows, cols, figsize=(6 * cols, 6 * rows))
    if n == 1:
        axes = np.array([axes])
    axes = axes.flatten()

    for i in range(n):
        ax = axes[i]
        
        # Convert tensor to numpy for display
        img = images[i].permute(1, 2, 0).numpy()
        img = np.clip(img, 0, 1)
        ax.imshow(img)

        pred = predictions[i]
        
        # Draw predictions
        for j in range(len(pred["boxes"])):
            score = pred["scores"][j].item()
            if score < score_threshold:
                continue

            box = pred["boxes"][j].numpy()
            label = pred["labels"][j].item()
            color = CLASS_COLORS.get(label, "#FF0000")
            class_name = CLASS_NAMES.get(label, f"class_{label}")

            x1, y1, x2, y2 = box
            rect = patches.Rectangle(
                (x1, y1), x2 - x1, y2 - y1,
                linewidth=2, edgecolor=color, facecolor="none",
            )
            ax.add_patch(rect)
            ax.text(
                x1, y1 - 5,
                f"{class_name}: {score:.2f}",
                color="white",
                fontsize=9,
                fontweight="bold",
                bbox=dict(boxstyle="round,pad=0.2", facecolor=color, alpha=0.8),
            )

        # Draw ground truth if provided
        if targets is not None and i < len(targets):
            gt = targets[i]
            for j in range(len(gt["boxes"])):
                box = gt["boxes"][j].numpy()
                label = gt["labels"][j].item()
                x1, y1, x2, y2 = box
                rect = patches.Rectangle(
                    (x1, y1), x2 - x1, y2 - y1,
                    linewidth=2, edgecolor="yellow", facecolor="none",
                    linestyle="--",
                )
                ax.add_patch(rect)

        ax.set_title(f"Image {i+1}", fontsize=12)
        ax.axis("off")

    # Hide unused axes
    for i in range(n, len(axes)):
        axes[i].axis("off")

    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches="tight")
        print(f"[Eval] Visualization saved: {save_path}")
    
    plt.show()


def main():
    """Run full evaluation on the validation set."""
    DATA_DIR = str(Path(__file__).resolve().parent.parent / "data")
    WEIGHTS_DIR = Path(__file__).resolve().parent.parent / "backend" / "weights"
    
    # Find best checkpoint
    checkpoint_path = str(WEIGHTS_DIR / "frcnn_best.pth")
    if not Path(checkpoint_path).exists():
        # Try latest epoch checkpoint
        checkpoints = sorted(WEIGHTS_DIR.glob("frcnn_epoch_*.pth"))
        if not checkpoints:
            print("[Eval] No checkpoints found! Train the model first.")
            return
        checkpoint_path = str(checkpoints[-1])
        print(f"[Eval] Using latest checkpoint: {checkpoint_path}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[Eval] Device: {device}")

    # Load model
    model = get_model_for_inference(checkpoint_path, num_classes=3, device=str(device))

    # Load validation dataset
    val_dataset = VOCDetectionDataset(
        root=DATA_DIR,
        year="2012",
        image_set="val",
        transforms=get_transforms(train=False),
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=4,
        shuffle=False,
        num_workers=2,
        collate_fn=collate_fn,
    )

    # Run evaluation
    print("\n[Eval] Running evaluation...")
    all_preds = []
    all_targets = []
    all_images = []

    with torch.inference_mode():
        for images, targets in val_loader:
            images_gpu = [img.to(device) for img in images]
            outputs = model(images_gpu)

            for img, output, target in zip(images, outputs, targets):
                all_images.append(img.cpu())
                all_preds.append({k: v.cpu() for k, v in output.items()})
                all_targets.append({k: v.cpu() for k, v in target.items()})

    # Compute mAP
    map_results = compute_map(all_preds, all_targets, iou_threshold=0.5)

    print(f"\n{'='*50}")
    print(f"  Evaluation Results (IoU=0.5)")
    print(f"{'='*50}")
    for k, v in map_results.items():
        print(f"  {k:>10s}: {v:.4f}")
    print(f"{'='*50}")

    # Visualize sample detections
    save_path = str(WEIGHTS_DIR.parent / "detection_results.png")
    visualize_detections(
        all_images[:6],
        all_preds[:6],
        all_targets[:6],
        score_threshold=0.5,
        save_path=save_path,
    )


if __name__ == "__main__":
    main()
