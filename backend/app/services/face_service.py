"""
face_service.py — Face Recognition Service
============================================
Handles face database management, identity matching,
and embedding operations.
"""

import os
import pickle
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

from ..models.face_engine import FaceEngine


class FaceService:
    """
    Service layer for face recognition operations.
    
    Manages:
      - Building embedding database from known_faces/
      - Identity matching via cosine similarity
      - Registration of new identities
    """

    def __init__(
        self,
        known_faces_dir: str,
        db_path: str,
        threshold: float = 0.4,
    ):
        self.known_faces_dir = Path(known_faces_dir)
        self.db_path = Path(db_path)
        self.threshold = threshold
        self.database: Dict[str, np.ndarray] = {}

        # Load existing database if available
        if self.db_path.exists():
            self._load_database()

    def _load_database(self) -> None:
        """Load pre-computed embedding database from pickle file."""
        with open(self.db_path, "rb") as f:
            self.database = pickle.load(f)
        print(
            f"[FaceService] Loaded database with "
            f"{len(self.database)} identities."
        )

    def _save_database(self) -> None:
        """Save embedding database to pickle file."""
        with open(self.db_path, "wb") as f:
            pickle.dump(self.database, f)
        print(f"[FaceService] Database saved to: {self.db_path}")

    def build_database(self) -> Dict[str, int]:
        """
        Build embedding database from known_faces/ directory.
        
        Directory structure:
          known_faces/
            ├── person_name_1/
            │   ├── photo1.jpg
            │   ├── photo2.jpg
            │   └── ...
            └── person_name_2/
                └── ...
        
        Process per identity:
          1. Load all photos
          2. Detect face & extract 512-d ArcFace embedding for each
          3. L2 normalize each embedding
          4. Average embeddings → representative vector
          5. L2 normalize the average → final embedding
        
        Returns:
            Dict mapping identity names to number of photos processed.
        """
        engine = FaceEngine.get_instance()
        if engine.app is None:
            engine.initialize(ctx_id=0)

        self.database = {}
        stats = {}

        if not self.known_faces_dir.exists():
            print(f"[FaceService] known_faces dir not found: {self.known_faces_dir}")
            return stats

        for person_dir in sorted(self.known_faces_dir.iterdir()):
            if not person_dir.is_dir():
                continue

            person_name = person_dir.name
            embeddings = []

            image_files = list(person_dir.glob("*.jpg")) + \
                          list(person_dir.glob("*.jpeg")) + \
                          list(person_dir.glob("*.png"))

            for img_path in image_files:
                img = cv2.imread(str(img_path))
                if img is None:
                    print(f"  [Warning] Could not load: {img_path}")
                    continue

                embedding = engine.get_embedding(img)
                if embedding is not None:
                    embeddings.append(embedding)
                else:
                    print(f"  [Warning] No face found in: {img_path.name}")

            if embeddings:
                # Average embeddings and L2 normalize
                avg_embedding = np.mean(embeddings, axis=0)
                avg_embedding = avg_embedding / (
                    np.linalg.norm(avg_embedding) + 1e-8
                )
                self.database[person_name] = avg_embedding
                stats[person_name] = len(embeddings)
                print(
                    f"  [FaceService] {person_name}: "
                    f"{len(embeddings)} photos → embedding computed"
                )
            else:
                print(f"  [FaceService] {person_name}: No valid faces found!")

        self._save_database()
        return stats

    def recognize(
        self,
        embedding: np.ndarray,
        threshold: float = None,
    ) -> Tuple[Optional[str], float]:
        """
        Match an embedding against the database using cosine similarity.
        
        Cosine Similarity = dot(a, b) / (||a|| * ||b||)
        Since embeddings are L2-normalized: cos_sim = dot(a, b)
        
        Args:
            embedding: 512-d L2-normalized face embedding.
            threshold: Override the default similarity threshold (tau).
        
        Returns:
            Tuple of (identity_name, similarity_score).
            Returns (None, 0.0) if no match above threshold.
        """
        if not self.database:
            return None, 0.0

        tau = threshold if threshold is not None else self.threshold
        best_match = None
        best_score = 0.0

        for name, db_embedding in self.database.items():
            # Cosine similarity (dot product of normalized vectors)
            similarity = float(np.dot(embedding, db_embedding))

            if similarity > best_score:
                best_score = similarity
                best_match = name

        if best_score >= tau:
            return best_match, best_score
        else:
            return None, best_score

    def recognize_all(
        self,
        embedding: np.ndarray,
        threshold: float = None,
    ) -> List[Dict]:
        """
        Get similarity scores against all identities.
        
        Returns:
            List of dicts sorted by similarity (descending).
        """
        if not self.database:
            return []

        tau = threshold if threshold is not None else self.threshold
        results = []

        for name, db_embedding in self.database.items():
            similarity = float(np.dot(embedding, db_embedding))
            results.append({
                "name": name,
                "similarity": round(similarity, 4),
                "is_match": similarity >= tau,
            })

        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results

    def register_identity(
        self,
        name: str,
        image: np.ndarray,
    ) -> bool:
        """
        Register a new identity or add a photo to existing identity.
        
        Args:
            name: Identity name.
            image: BGR image containing a face.
        
        Returns:
            True if registration successful.
        """
        # Save image to known_faces directory
        person_dir = self.known_faces_dir / name
        person_dir.mkdir(parents=True, exist_ok=True)

        # Count existing photos
        existing = list(person_dir.glob("*.jpg"))
        photo_num = len(existing) + 1
        photo_path = person_dir / f"photo_{photo_num:03d}.jpg"

        cv2.imwrite(str(photo_path), image)
        print(f"[FaceService] Saved photo: {photo_path}")

        return True

    def get_registered_identities(self) -> List[Dict]:
        """List all registered identities and their photo counts."""
        identities = []

        if not self.known_faces_dir.exists():
            return identities

        for person_dir in sorted(self.known_faces_dir.iterdir()):
            if not person_dir.is_dir():
                continue

            photos = list(person_dir.glob("*.jpg")) + \
                     list(person_dir.glob("*.jpeg")) + \
                     list(person_dir.glob("*.png"))

            identities.append({
                "name": person_dir.name,
                "photo_count": len(photos),
                "has_embedding": person_dir.name in self.database,
            })

        return identities
