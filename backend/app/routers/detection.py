"""
detection.py — Object Detection API Router
============================================
Endpoint for Faster R-CNN object detection.
"""

from fastapi import APIRouter, File, Query, UploadFile
from fastapi.responses import JSONResponse

from ..services.inference import DetectionService

router = APIRouter(prefix="/api", tags=["detection"])

# Service instance
detection_service = DetectionService()


@router.post("/detect")
async def detect_objects(
    file: UploadFile = File(..., description="Image file (JPEG, PNG)"),
    confidence: float = Query(
        0.5,
        ge=0.1,
        le=1.0,
        description="Minimum confidence threshold (0.1-1.0)",
    ),
):
    """
    Detect objects in an uploaded image using Faster R-CNN.
    
    Returns bounding boxes, class labels, and confidence scores
    for detected 'person' and 'bicycle' objects.
    
    Response format:
    ```json
    {
        "detections": [
            {
                "bbox": [x1, y1, x2, y2],
                "label": 1,
                "label_name": "person",
                "score": 0.95
            }
        ],
        "image_width": 640,
        "image_height": 480,
        "num_detections": 3
    }
    ```
    """
    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg", "image/webp"]:
        return JSONResponse(
            status_code=400,
            content={"error": f"Unsupported file type: {file.content_type}. Use JPEG or PNG."},
        )

    # Read image bytes
    image_bytes = await file.read()

    # Run detection
    result = await detection_service.detect_objects(
        image_bytes=image_bytes,
        confidence_threshold=confidence,
    )

    return result
