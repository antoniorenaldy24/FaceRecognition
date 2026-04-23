"""
train.py — Faster R-CNN Training Loop
======================================
Complete training pipeline for fine-tuning Faster R-CNN on
Pascal VOC 2012 (person + bicycle subset).

Features:
  - SGD optimizer with momentum and weight decay
  - StepLR scheduler for learning rate decay
  - Per-epoch loss logging and checkpoint saving
  - Automatic CUDA/CPU device selection
  - Resume from checkpoint support
"""

import os
import sys
import time
from pathlib import Path

import torch
from torch.utils.data import DataLoader

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from training.dataset import VOCDetectionDataset, get_transforms, collate_fn
from training.model import build_frcnn


def train_one_epoch(
    model: torch.nn.Module,
    optimizer: torch.optim.Optimizer,
    data_loader: DataLoader,
    device: torch.device,
    epoch: int,
    scaler: torch.amp.GradScaler = None,
) -> float:
    """
    Train the model for one epoch.
    
    Faster R-CNN returns a dict of losses during training mode:
      - loss_classifier: Classification loss (Cross-Entropy)
      - loss_box_reg: Bounding box regression loss (Smooth L1)
      - loss_objectness: RPN objectness loss
      - loss_rpn_box_reg: RPN box regression loss
    
    Returns:
        Average total loss for the epoch.
    """
    model.train()
    total_loss = 0.0
    num_batches = len(data_loader)

    for batch_idx, (images, targets) in enumerate(data_loader):
        # Move data to device
        images = [img.to(device) for img in images]
        targets = [{k: v.to(device) for k, v in t.items()} for t in targets]

        # Forward pass — Faster R-CNN returns losses in train mode
        # Enable AMP for forward pass and loss computation
        if scaler is not None and device.type == 'cuda':
            with torch.amp.autocast('cuda'):
                loss_dict = model(images, targets)
                losses = sum(loss for loss in loss_dict.values())
                
            # Backward pass with scaler
            optimizer.zero_grad()
            scaler.scale(losses).backward()
            
            # Unscale before clipping
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=10.0)
            
            scaler.step(optimizer)
            scaler.update()
        else:
            loss_dict = model(images, targets)
            losses = sum(loss for loss in loss_dict.values())
            
            optimizer.zero_grad()
            losses.backward()
            
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=10.0)
            optimizer.step()

        total_loss += losses.item()

        # Log progress every 20 batches
        if (batch_idx + 1) % 20 == 0 or batch_idx == 0:
            loss_str = "  ".join(
                f"{k}: {v.item():.4f}" for k, v in loss_dict.items()
            )
            print(
                f"  [Epoch {epoch+1}] Batch {batch_idx+1}/{num_batches}  "
                f"Total Loss: {losses.item():.4f}  |  {loss_str}"
            )

    avg_loss = total_loss / num_batches
    return avg_loss


@torch.inference_mode()
def evaluate(
    model: torch.nn.Module,
    data_loader: DataLoader,
    device: torch.device,
) -> dict:
    """
    Run evaluation on the validation set.
    
    Returns detections for mAP computation (done in evaluate.py).
    Also reports basic statistics like avg number of detections per image.
    """
    model.eval()
    all_predictions = []
    all_targets = []

    for images, targets in data_loader:
        images = [img.to(device) for img in images]
        outputs = model(images)

        for output, target in zip(outputs, targets):
            all_predictions.append(
                {k: v.cpu() for k, v in output.items()}
            )
            all_targets.append(
                {k: v.cpu() for k, v in target.items()}
            )

    # Basic stats
    avg_detections = sum(
        len(p["boxes"]) for p in all_predictions
    ) / max(len(all_predictions), 1)

    avg_score = 0.0
    total_dets = 0
    for p in all_predictions:
        if len(p["scores"]) > 0:
            avg_score += p["scores"].sum().item()
            total_dets += len(p["scores"])
    avg_score = avg_score / max(total_dets, 1)

    return {
        "predictions": all_predictions,
        "targets": all_targets,
        "avg_detections_per_image": avg_detections,
        "avg_confidence": avg_score,
        "num_images": len(all_predictions),
    }


def download_voc_dataset(data_dir: str):
    """Download Pascal VOC 2012 dataset using torchvision."""
    from torchvision.datasets import VOCDetection as TorchVOC

    print("=" * 60)
    print("  Downloading Pascal VOC 2012 Dataset...")
    print("  This may take a while (~2GB).")
    print("=" * 60)

    # This triggers the download
    TorchVOC(root=data_dir, year="2012", image_set="train", download=True)
    print("[Dataset] Pascal VOC 2012 downloaded successfully!")


def main():
    """Main training entry point."""
    # =========================================
    # Configuration
    # =========================================
    DATA_DIR = str(Path(__file__).resolve().parent.parent / "data")
    WEIGHTS_DIR = str(Path(__file__).resolve().parent.parent / "backend" / "weights")
    os.makedirs(WEIGHTS_DIR, exist_ok=True)

    NUM_CLASSES = 3  # background + person + bicycle
    BATCH_SIZE = 4
    NUM_EPOCHS = 10
    LR = 0.0005  # Reduced LR to prevent exploding gradients (NaN loss)
    MOMENTUM = 0.9
    WEIGHT_DECAY = 0.0005
    LR_STEP_SIZE = 3
    LR_GAMMA = 0.1
    FREEZE_BACKBONE = True  # Set True for Linear Probing (Optimization 1)

    # Device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n[Train] Using device: {device}")
    if device.type == "cuda":
        print(f"[Train] GPU: {torch.cuda.get_device_name(0)}")
        print(f"[Train] VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

    # =========================================
    # Step 1: Download dataset (if needed)
    # =========================================
    voc_path = Path(DATA_DIR) / "VOCdevkit" / "VOC2012"
    if not voc_path.exists():
        download_voc_dataset(DATA_DIR)

    # =========================================
    # Step 2: Create datasets and data loaders
    # =========================================
    print("\n[Train] Loading datasets...")

    train_dataset = VOCDetectionDataset(
        root=DATA_DIR,
        year="2012",
        image_set="train",
        transforms=get_transforms(train=True),
    )

    val_dataset = VOCDetectionDataset(
        root=DATA_DIR,
        year="2012",
        image_set="val",
        transforms=get_transforms(train=False),
    )

    train_loader = DataLoader(
        train_dataset,
        batch_size=BATCH_SIZE,
        shuffle=True,
        num_workers=0,  # Set to 0 to fix multiprocessing overhead in Windows
        collate_fn=collate_fn,
        pin_memory=True if device.type == "cuda" else False,
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=0,  # Set to 0 to fix multiprocessing overhead in Windows
        collate_fn=collate_fn,
        pin_memory=True if device.type == "cuda" else False,
    )

    print(f"[Train] Train set: {len(train_dataset)} images")
    print(f"[Train] Val set:   {len(val_dataset)} images")

    # =========================================
    # Step 3: Build model
    # =========================================
    print("\n[Train] Building model...")
    model = build_frcnn(
        num_classes=NUM_CLASSES,
        pretrained=True,
        freeze_backbone=FREEZE_BACKBONE,
    )
    model.to(device)

    # =========================================
    # Step 4: Set up optimizer and scheduler
    # =========================================
    # Only optimize parameters that require gradients (Optimization 2)
    params = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.SGD(
        params,
        lr=LR,
        momentum=MOMENTUM,
        weight_decay=WEIGHT_DECAY,
    )
    lr_scheduler = torch.optim.lr_scheduler.StepLR(
        optimizer,
        step_size=LR_STEP_SIZE,
        gamma=LR_GAMMA,
    )

    print(f"\n[Train] Optimizer: SGD (lr={LR}, momentum={MOMENTUM})")
    print(f"[Train] Scheduler: StepLR (step={LR_STEP_SIZE}, gamma={LR_GAMMA})")

    # =========================================
    # Step 5: Training loop
    # =========================================
    print(f"\n{'='*60}")
    print(f"  Starting Training: {NUM_EPOCHS} epochs")
    print(f"{'='*60}\n")

    best_val_score = 0.0
    train_losses = []
    val_metrics = []

    # Setup AMP Scaler (Optimization 4)
    scaler = torch.amp.GradScaler('cuda') if device.type == 'cuda' else None

    # =========================================
    # Step 6: Resume Training Logic
    # =========================================
    start_epoch = 0
    import glob
    checkpoints = glob.glob(os.path.join(WEIGHTS_DIR, "frcnn_epoch_*.pth"))
    if checkpoints:
        # Sort by creation time to find the newest checkpoint
        latest_ckpt = max(checkpoints, key=os.path.getctime)
        print(f"\n[Resume] Found existing checkpoint: {latest_ckpt}")
        print("  Loading weights, optimizer, and scheduler state...")
        checkpoint = torch.load(latest_ckpt, map_location=device, weights_only=False)
        model.load_state_dict(checkpoint["model_state_dict"])
        optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        lr_scheduler.load_state_dict(checkpoint["scheduler_state_dict"])
        start_epoch = checkpoint.get("epoch", 0)
        if scaler and "scaler_state_dict" in checkpoint:
            scaler.load_state_dict(checkpoint["scaler_state_dict"])
        print(f"  Resuming from Epoch {start_epoch + 1}")

    for epoch in range(start_epoch, NUM_EPOCHS):
        epoch_start = time.time()

        # Train
        avg_loss = train_one_epoch(
            model, optimizer, train_loader, device, epoch, scaler
        )
        train_losses.append(avg_loss)

        # Step scheduler
        lr_scheduler.step()
        current_lr = optimizer.param_groups[0]["lr"]

        # Evaluate
        eval_results = evaluate(model, val_loader, device)
        val_metrics.append(eval_results)

        epoch_time = time.time() - epoch_start

        print(f"\n{'─'*60}")
        print(f"  Epoch {epoch+1}/{NUM_EPOCHS} Summary:")
        print(f"    Train Loss:          {avg_loss:.4f}")
        print(f"    Avg Detections/Img:  {eval_results['avg_detections_per_image']:.1f}")
        print(f"    Avg Confidence:      {eval_results['avg_confidence']:.4f}")
        print(f"    Learning Rate:       {current_lr:.6f}")
        print(f"    Time:                {epoch_time:.1f}s")
        print(f"{'─'*60}\n")

        # Save checkpoint every epoch
        checkpoint_path = os.path.join(WEIGHTS_DIR, f"frcnn_epoch_{epoch+1}.pth")
        torch.save(
            {
                "epoch": epoch + 1,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "scheduler_state_dict": lr_scheduler.state_dict(),
                "scaler_state_dict": scaler.state_dict() if scaler else None,
                "train_loss": avg_loss,
                "val_metrics": {
                    "avg_detections": eval_results["avg_detections_per_image"],
                    "avg_confidence": eval_results["avg_confidence"],
                },
            },
            checkpoint_path,
        )
        print(f"  [Checkpoint] Saved: {checkpoint_path}")

    # Save final best model
    final_path = os.path.join(WEIGHTS_DIR, "frcnn_best.pth")
    torch.save(model.state_dict(), final_path)
    print(f"\n[Train] Final model saved: {final_path}")

    # Print loss curve summary
    print(f"\n{'='*60}")
    print("  Training Complete! Loss Curve:")
    print(f"{'='*60}")
    for i, loss in enumerate(train_losses):
        bar = "█" * int(loss * 10)
        print(f"  Epoch {i+1:2d}: {loss:.4f} {bar}")


if __name__ == "__main__":
    main()
