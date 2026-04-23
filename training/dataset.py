"""
dataset.py — Custom Pascal VOC Detection Dataset
=================================================
Loads Pascal VOC 2012 annotations, filtering for 'person' and 'bicycle' 
classes only. Returns (image_tensor, target_dict) suitable for Faster R-CNN.

Architecture Note (Separation of Concerns):
  This module handles ONLY data loading & transformation.
  Model definition lives in model.py.
"""

import os
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import torch
from PIL import Image
from torch.utils.data import Dataset
import torchvision.transforms.v2 as T
from torchvision import tv_tensors

# --- Target class filter ---
TARGET_CLASSES = {"person": 1, "bicycle": 2}


class VOCDetectionDataset(Dataset):
    """
    Custom Dataset for Pascal VOC 2012 Object Detection.
    Filters annotations to include only 'person' and 'bicycle' objects.
    
    Args:
        root: Path to the VOCdevkit directory.
        year: Dataset year ('2012' or '2007').
        image_set: 'train', 'val', or 'trainval'.
        transforms: Optional torchvision transforms to apply.
    """

    def __init__(
        self,
        root: str,
        year: str = "2012",
        image_set: str = "train",
        transforms: Optional[Any] = None,
    ):
        self.root = Path(root)
        self.year = year
        self.image_set = image_set
        self.transforms = transforms

        # Resolve VOC directory structure
        voc_root = self.root / f"VOCdevkit" / f"VOC{year}"
        self.images_dir = voc_root / "JPEGImages"
        self.annotations_dir = voc_root / "Annotations"
        imageset_file = voc_root / "ImageSets" / "Main" / f"{image_set}.txt"

        if not imageset_file.exists():
            raise FileNotFoundError(
                f"ImageSet file not found: {imageset_file}\n"
                f"Make sure the VOC dataset is downloaded to: {self.root}"
            )

        # Read image IDs and filter to only those containing target classes
        all_ids = imageset_file.read_text().strip().split("\n")
        all_ids = [x.strip() for x in all_ids if x.strip()]

        self.image_ids = []
        self._annotations_cache: Dict[str, dict] = {}

        print(f"[VOCDataset] Scanning {len(all_ids)} images for target classes...")
        for img_id in all_ids:
            annotation = self._parse_annotation(img_id)
            if annotation is not None and len(annotation["boxes"]) > 0:
                self.image_ids.append(img_id)
                self._annotations_cache[img_id] = annotation

        print(
            f"[VOCDataset] Found {len(self.image_ids)} images with "
            f"'person' or 'bicycle' objects (from {len(all_ids)} total)."
        )

    def _parse_annotation(self, img_id: str) -> Optional[dict]:
        """Parse VOC XML annotation, keeping only target classes."""
        ann_path = self.annotations_dir / f"{img_id}.xml"
        if not ann_path.exists():
            return None

        tree = ET.parse(str(ann_path))
        root = tree.getroot()

        boxes = []
        labels = []
        areas = []
        iscrowd = []

        for obj in root.findall("object"):
            name = obj.find("name").text.strip().lower()

            # Skip classes we don't care about
            if name not in TARGET_CLASSES:
                continue

            difficult = obj.find("difficult")
            if difficult is not None and int(difficult.text) == 1:
                continue  # Skip difficult examples

            bndbox = obj.find("bndbox")
            xmin = float(bndbox.find("xmin").text)
            ymin = float(bndbox.find("ymin").text)
            xmax = float(bndbox.find("xmax").text)
            ymax = float(bndbox.find("ymax").text)

            # Validate box dimensions
            if xmax <= xmin or ymax <= ymin:
                continue

            boxes.append([xmin, ymin, xmax, ymax])
            labels.append(TARGET_CLASSES[name])
            areas.append((xmax - xmin) * (ymax - ymin))
            iscrowd.append(0)

        if len(boxes) == 0:
            return None

        return {
            "boxes": boxes,
            "labels": labels,
            "areas": areas,
            "iscrowd": iscrowd,
        }

    def __len__(self) -> int:
        return len(self.image_ids)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, dict]:
        img_id = self.image_ids[idx]

        # Load image
        img_path = self.images_dir / f"{img_id}.jpg"
        image = Image.open(str(img_path)).convert("RGB")

        # Get cached annotation
        ann = self._annotations_cache[img_id]

        # Build target dict for Faster R-CNN
        target = {
            "boxes": tv_tensors.BoundingBoxes(
                ann["boxes"], format="XYXY", canvas_size=(image.height, image.width), dtype=torch.float32
            ),
            "labels": torch.as_tensor(ann["labels"], dtype=torch.int64),
            "image_id": torch.tensor([idx]),
            "area": torch.as_tensor(ann["areas"], dtype=torch.float32),
            "iscrowd": torch.as_tensor(ann["iscrowd"], dtype=torch.int64),
        }

        # Apply transforms
        if self.transforms is not None:
            image, target = self.transforms(image, target)
        else:
            # Default: convert to tensor
            image = T.Compose([T.ToImage(), T.ToDtype(torch.float32, scale=True)])(image)

        return image, target


def get_transforms(train: bool = True):
    """
    Get data augmentation transforms for training/evaluation.
    
    Args:
        train: If True, apply augmentations (flip, color jitter).
               If False, only convert to tensor.
    """
    transforms = []

    transforms.append(T.ToImage())

    if train:
        transforms.append(T.RandomHorizontalFlip(p=0.5))
        transforms.append(T.RandomPhotometricDistort(p=0.3))

    transforms.append(T.ToDtype(torch.float32, scale=True))
    transforms.append(T.ToPureTensor())

    return T.Compose(transforms)


def collate_fn(batch):
    """
    Custom collate function for detection DataLoader.
    Faster R-CNN expects a list of images and a list of targets,
    NOT a stacked batch tensor.
    """
    return tuple(zip(*batch))


# --- Quick test ---
if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

    data_root = Path(__file__).resolve().parent.parent / "data"
    print(f"Looking for VOC data in: {data_root}")

    try:
        dataset = VOCDetectionDataset(
            root=str(data_root),
            year="2012",
            image_set="train",
            transforms=get_transforms(train=True),
        )
        img, target = dataset[0]
        print(f"Image shape: {img.shape}")
        print(f"Boxes: {target['boxes']}")
        print(f"Labels: {target['labels']}")
        print(f"Number of objects: {len(target['boxes'])}")
    except FileNotFoundError as e:
        print(f"Dataset not found. Please download first.\n{e}")
