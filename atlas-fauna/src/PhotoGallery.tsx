// src/PhotoGallery.tsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import './App.css';

interface GalleryImage {
  name: string;
  url: string;
}

interface Props {
  folderName: string;
  count: number;
  images?: GalleryImage[];
  canDelete?: boolean;
  onDelete?: (name: string) => void;
}

export default function PhotoGallery({
  folderName,
  count,
  images: providedImages,
  canDelete,
  onDelete
}: Props) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const fallbackImages: GalleryImage[] = Array.from(
    { length: count },
    (_, i) => ({ name: `${i + 1}.jpg`, url: `/images/${folderName}/${i + 1}.jpg` })
  );
  const images = providedImages && providedImages.length > 0 ? providedImages : fallbackImages;

  return (
    <>
      <div className="gallery-grid">
        {images.map((img, index) => (
          <div key={`${img.name}-${index}`} className="gallery-item" onClick={() => setSelectedImage(img.url)}>
            <img
              src={img.url}
              alt={`Фото ${index + 1}`}
              className="gallery-img"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                const imageEl = e.target as HTMLImageElement;
                if (imageEl.src.endsWith('.jpg')) {
                  imageEl.src = imageEl.src.replace('.jpg', '.png');
                } else {
                  imageEl.style.display = 'none';
                }
              }}
            />
            {canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(img.name);
                }}
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: 26,
                  height: 26,
                  cursor: 'pointer',
                  fontSize: 14
                }}
                title="Удалить фото"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {images.length === 0 && (
          <p style={{ color: '#888', gridColumn: '1/-1', textAlign: 'center', padding: '20px' }}>
            Фотографий пока нет.
          </p>
        )}
      </div>

      {selectedImage && createPortal(
        <div className="lightbox-overlay" onClick={() => setSelectedImage(null)}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <button
              className="lightbox-close"
              onClick={() => setSelectedImage(null)}
              style={{
                position: 'absolute',
                top: -40,
                right: 0,
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '40px',
                cursor: 'pointer'
              }}
            >
              ×
            </button>

            <img
              src={selectedImage}
              className="lightbox-img"
              decoding="async"
              alt="Просмотр"
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '90vh',
                borderRadius: '8px',
                boxShadow: '0 5px 30px rgba(0,0,0,0.5)'
              }}
            />
          </div>

          <div style={{ position: 'absolute', bottom: 20, color: 'rgba(255,255,255,0.7)', fontSize: '14px', pointerEvents: 'none' }}>
            Нажмите в любом месте, чтобы закрыть
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
