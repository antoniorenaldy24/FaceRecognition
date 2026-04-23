import os
import io
import requests
import json
import pygame
from PIL import Image
import tkinter as tk
from tkinter import filedialog

# Konfigurasi Endpoint FastAPI
API_URL = "http://127.0.0.1:8000/api/detect"

# Inisialisasi Pygame
pygame.init()
WINDOW_WIDTH = 1000
WINDOW_HEIGHT = 700
screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
pygame.display.set_caption("Lab 2: Object Detection (Drag & Drop)")

# Warna
BG_COLOR = (30, 30, 40)
TEXT_COLOR = (200, 200, 200)
BOX_COLORS = {
    "person": (0, 191, 255),  # Cyan
    "bicycle": (0, 255, 127)  # Spring Green
}

font_large = pygame.font.SysFont("segoeui", 32, bold=True)
font_small = pygame.font.SysFont("segoeui", 18)

def draw_text_center(surface, text, font, color, y_offset=0):
    text_surface = font.render(text, True, color)
    text_rect = text_surface.get_rect(center=(WINDOW_WIDTH/2, WINDOW_HEIGHT/2 + y_offset))
    surface.blit(text_surface, text_rect)

def load_image_with_pil(filepath):
    """Menggunakan Pillow untuk membaca gambar sebagai workaround bug libjpeg pygame di Windows."""
    pil_img = Image.open(filepath).convert("RGB")
    return pygame.image.fromstring(pil_img.tobytes(), pil_img.size, pil_img.mode)

def process_image(filepath):
    """Mengirim gambar ke FastAPI dan mengembalikan hasil gambar yang sudah digambar bounding box."""
    try:
        # 1. Load gambar asli ke Pygame menggunakan PIL (Workaround bug Windows libjpeg)
        original_surface = load_image_with_pil(filepath)
        
        # 2. Kirim gambar ke FastAPI Endpoint
        with open(filepath, 'rb') as f:
            files = {'file': (os.path.basename(filepath), f, 'image/jpeg')}
            response = requests.post(API_URL, files=files, params={'confidence': 0.5})
            
        if response.status_code != 200:
            print(f"Error API: {response.text}")
            return original_surface, "Error: Gagal menghubungi API"
            
        data = response.json()
        detections = data.get("detections", [])
        
        # 3. Gambar Bounding Box di atas surface gambar
        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            label = det["label_name"]
            score = det["score"]
            color = BOX_COLORS.get(label.lower(), (255, 0, 0))
            
            # Gambar kotak
            rect = pygame.Rect(x1, y1, x2 - x1, y2 - y1)
            pygame.draw.rect(original_surface, color, rect, 4)
            
            # Gambar label (background box)
            label_text = f"{label} {score*100:.1f}%"
            text_surf = font_small.render(label_text, True, (0, 0, 0))
            bg_rect = pygame.Rect(x1, max(0, y1 - 25), text_surf.get_width() + 10, 25)
            pygame.draw.rect(original_surface, color, bg_rect)
            original_surface.blit(text_surf, (x1 + 5, max(0, y1 - 25) + 2))
            
        return original_surface, f"Success: {len(detections)} objects found"
        
    except Exception as e:
        print(f"Exception: {e}")
        return None, f"Error: {str(e)}"

def scale_image_to_fit(image_surface, max_w, max_h):
    """Mengubah ukuran gambar agar muat di dalam layar tanpa merusak aspect ratio."""
    img_w, img_h = image_surface.get_size()
    scale_w = max_w / img_w
    scale_h = max_h / img_h
    scale = min(scale_w, scale_h)
    
    if scale < 1:  # Hanya perkecil, jangan perbesar
        new_w = int(img_w * scale)
        new_h = int(img_h * scale)
        return pygame.transform.smoothscale(image_surface, (new_w, new_h))
    return image_surface

def open_file_dialog():
    """Membuka dialog file explorer untuk memilih gambar."""
    root = tk.Tk()
    root.withdraw() # Hide main window
    root.attributes('-topmost', True) # Bring to front
    filepath = filedialog.askopenfilename(
        title="Pilih Gambar",
        filetypes=[("Image Files", "*.jpg *.jpeg *.png")]
    )
    root.destroy()
    return filepath

def main():
    running = True
    current_image = None
    status_msg = "Menunggu gambar... (API Server harus berjalan di port 8000)"
    
    # Render awal
    screen.fill(BG_COLOR)
    draw_text_center(screen, "Drag & Drop ATAU Klik di Sini Untuk Mengunggah", font_large, TEXT_COLOR, -20)
    draw_text_center(screen, "(Format: JPG, PNG)", font_small, (150, 150, 150), 20)
    pygame.display.flip()

    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
                
            elif event.type == pygame.DROPFILE:
                filepath = event.file
            
            elif event.type == pygame.MOUSEBUTTONDOWN or (event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE):
                filepath = open_file_dialog()

            if 'filepath' in locals() and filepath:
                # Tampilkan status loading
                screen.fill(BG_COLOR)
                draw_text_center(screen, "Memproses gambar dengan Faster R-CNN...", font_large, (100, 200, 100))
                pygame.display.flip()
                
                # Proses via API
                result_surface, msg = process_image(filepath)
                status_msg = msg
                
                if result_surface:
                    # Sesuaikan ukuran agar muat di layar
                    current_image = scale_image_to_fit(result_surface, WINDOW_WIDTH - 40, WINDOW_HEIGHT - 80)
                
                # Reset filepath agar tidak diproses berulang
                filepath = None
        if current_image:
            screen.fill((20, 20, 20))  # Background gelap
            
            # Hitung posisi agar gambar berada di tengah
            img_rect = current_image.get_rect(center=(WINDOW_WIDTH/2, (WINDOW_HEIGHT - 40)/2))
            screen.blit(current_image, img_rect)
            
            # Tampilkan status di bawah
            status_surf = font_small.render(status_msg, True, (255, 255, 255))
            screen.blit(status_surf, (20, WINDOW_HEIGHT - 30))
            
            pygame.display.flip()

    pygame.quit()

if __name__ == "__main__":
    main()
