import React, { useCallback, useState } from "react";
import { UploadCloud } from "lucide-react";

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
      className={`dropzone-neo relative w-full h-80 flex flex-col items-center justify-center p-6 ${
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
            className="w-full h-full object-contain rounded-xl opacity-40 border-4 border-black"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isLoading ? (
              <div className="flex flex-col items-center bg-white border-4 border-black p-4 rounded-xl shadow-[4px_4px_0px_black]">
                <div className="spinner-dots mb-4">
                  <div></div><div></div><div></div>
                </div>
                <p className="font-black text-lg text-black">
                  Sedang Menganalisis...
                </p>
              </div>
            ) : (
              <div className="bg-[var(--primary)] p-4 rounded-xl text-center cursor-pointer hover:bg-[var(--primary-light)] transition-colors border-4 border-black shadow-[4px_4px_0px_black] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_black]">
                <p className="font-black text-black">Klik atau Tarik untuk mengganti</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center z-10 flex flex-col items-center">
          <div className="w-24 h-24 mb-6 rounded-full bg-[var(--primary)] flex items-center justify-center text-black border-4 border-black shadow-[4px_4px_0px_black] animate-bounce">
            <UploadCloud size={40} strokeWidth={3} />
          </div>
          <p className="text-2xl font-black text-black mb-2">
            Tarik & Lepas gambar di sini!
          </p>
          <p className="text-gray-600 font-bold text-sm mb-6 bg-gray-100 px-4 py-1 rounded-full border-2 border-black">
            Mendukung JPEG, PNG, WEBP (Maks 5MB)
          </p>
          <button className="btn-neo bg-[var(--secondary)] text-white pointer-events-none">
            Cari Berkas 📂
          </button>
        </div>
      )}
    </div>
  );
}
