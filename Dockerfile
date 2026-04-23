FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for building C++ extensions if needed
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/requirements-prod.txt /app/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code and weights
COPY backend /app/backend

# Set environment variables for InsightFace to download models if needed
ENV INSIGHTFACE_HOME=/app/backend/weights/insightface
ENV PYTHONPATH=/app

# Expose port (Hugging Face Spaces defaults to 7860, but we can bind to it)
EXPOSE 7860

# Command to run FastAPI server
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "7860"]
