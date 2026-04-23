import React, { useCallback, useState } from "react";

interface ImageDropzoneProps {
  onImageDrop: (file: File) => void;
  isLoading: boolean;
}

export default function ImageDropzone({ onImageDrop, isLoading }: ImageDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith("image/")) {
          onImageDrop(file);
          setPreviewUrl(URL.createObjectURL(file));
        }
      }
    },
    [onImageDrop]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        if (file.type.startsWith("image/")) {
          onImageDrop(file);
          setPreviewUrl(URL.createObjectURL(file));
        }
      }
    },
    [onImageDrop]
  );

  return (
    <div
      className={`dropzone relative w-full h-80 flex flex-col items-center justify-center p-6 ${
        isDragActive ? "active" : ""
      } ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg, image/png, image/webp"
        className="hidden"
        onChange={handleFileInput}
      />

      {previewUrl ? (
        <div className="absolute inset-0 w-full h-full p-4">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-full object-contain rounded-lg opacity-30"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isLoading ? (
              <div className="flex flex-col items-center">
                <div className="spinner mb-4"></div>
                <p className="text-[var(--primary-light)] font-medium text-lg shadow-black drop-shadow-md">
                  Analyzing Image...
                </p>
              </div>
            ) : (
              <div className="bg-[var(--surface)]/80 p-4 rounded-xl backdrop-blur-md text-center cursor-pointer hover:bg-[var(--surface)] transition-colors border border-[var(--border)]">
                <p className="font-semibold text-white">Click or drag to replace</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center z-10">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--surface-hover)] flex items-center justify-center text-4xl shadow-inner border border-[var(--border)]">
            📸
          </div>
          <p className="text-xl font-bold text-white mb-2">
            Drag & Drop an image here
          </p>
          <p className="text-[var(--text-muted)] text-sm mb-6">
            Supports JPEG, PNG, WEBP (Max 5MB)
          </p>
          <button className="btn-secondary rounded-full px-6 py-2 text-sm pointer-events-none">
            Browse Files
          </button>
        </div>
      )}
    </div>
  );
}
