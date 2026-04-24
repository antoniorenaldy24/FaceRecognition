FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for OpenCV and onnxruntime
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    build-essential \
    libgomp1 \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/requirements-prod.txt /app/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code and training module
COPY backend /app/backend
COPY training /app/training

# Create non-root user expected by Hugging Face Spaces
RUN useradd -m -u 1000 user && \
    mkdir -p /app/backend/weights/insightface && \
    mkdir -p /app/backend/known_faces && \
    chown -R user:user /app

USER user

# Set environment variables for InsightFace to download models if needed
ENV INSIGHTFACE_HOME=/app/backend/weights/insightface
ENV PYTHONPATH=/app

# Expose port (Hugging Face Spaces defaults to 7860, but we can bind to it)
EXPOSE 7860

# Command to run FastAPI server
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "7860"]
